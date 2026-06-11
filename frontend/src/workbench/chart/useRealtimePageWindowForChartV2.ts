import { useEffect, useState } from 'react'
import type { StoreV6HistoryPageWindow } from './historyPageWindowV2'
import {
  buildStoreV6RealtimePageWindow,
  mergeMt5RealtimeTickIntoWindow,
  rebuildStoreV6RealtimeStablePageWindow,
  dispatchRealtimeStablePageRebuildCompleted,
  requestStoreV6RealtimePageWindow,
  realtimeStablePageRebuildRequestedEvent,
  resolveH2RealtimeRateVolumeForPeriodStartV2,
  resolveMt5RateVolumeForPeriodStartV2,
  type Mt5RealtimeWindowTick,
  type StoreV6RealtimePageWindow,
} from './realtimePageWindowV2'
import { readRealtimePageMonitorSnapshotV2 } from './realtimePageWindowV2/realtimePageMonitorV2'
import { resolveAutoRebuildRealtimeStablePageReason } from './realtimePageWindowV2/realtimeStablePageRebuildHeuristics'
import {
  refreshRealtimeWindowIndicatorsV2,
  type StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestV2'
import { chartWorkspaceIndicatorRegistryV2 } from './chartWorkspaceIndicatorRegistryV2'
import { workbenchEvents } from '../persistence/workbenchEvents'
import { traceKLineChartPageV2 } from './klineChartRendererV2/klineChartPageDebugProbeV2'
import { kLineChartHorizontalDragEndEventV2 } from './klineChartRendererV2/klineChartInteractionStateV2'
import { queryMt5Rates } from '../../services/mt5/mt5SymbolsApi'
import { resolvePeriodSeconds } from './chartTimeFormatting'

declare global {
  interface Window {
    __ffKLineChartV2Interaction?: {
      horizontalDragInProgress: boolean
    }
  }
}

function normalizeRealtimeRateTimeframe(period: string) {
  const value = period.trim().toUpperCase()
  if (value === 'H2') return 'M30'
  if (value === '1M' || value === 'M1') return 'M1'
  if (value === 'MN' || value === 'MN1') return 'MN1'
  if (/^\d+M$/.test(value)) return `M${value.slice(0, -1)}`
  if (/^\d+H$/.test(value)) return `H${value.slice(0, -1)}`
  return value
}

function resolveTickTimestampMs(tick: Mt5RealtimeWindowTick) {
  if (typeof tick.timeMsc === 'number' && Number.isFinite(tick.timeMsc)) {
    return tick.timeMsc < 1_000_000_000_000 ? tick.timeMsc * 1000 : tick.timeMsc
  }
  if (typeof tick.time === 'number' && Number.isFinite(tick.time)) {
    return tick.time < 1_000_000_000_000 ? tick.time * 1000 : tick.time
  }
  return Date.now()
}

function resolveTickPeriodStartSeconds(tick: Mt5RealtimeWindowTick, period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) return null
  return Math.floor(resolveTickTimestampMs(tick) / (periodSeconds * 1000)) * periodSeconds
}

export function useRealtimePageWindowForChartV2(options: {
  hasHistoryPageWindow: boolean
  historyPageWindow: StoreV6HistoryPageWindow | null
  historyWindowRealtimeSignature: string
  indicatorRequests: StoreV6IndicatorRequestSpecV2[]
  indicatorSignature: string
  period: string
  realtimeEnabled?: boolean
  realtimeStart?: number | null
  symbol: string
}) {
  const [realtimeWindow, setRealtimeWindow] = useState<StoreV6RealtimePageWindow | null>(null)

  useEffect(() => {
    let disposed = false
    const historyPageWindow = options.historyPageWindow
    if (!historyPageWindow) {
      setRealtimeWindow(null)
      return () => {
        disposed = true
      }
    }
    const emptyRealtimeWindow = buildStoreV6RealtimePageWindow({
      enabled: options.realtimeEnabled === true,
      historyRows: historyPageWindow.calculationRows,
      indicatorRegistry: chartWorkspaceIndicatorRegistryV2,
      indicatorRequests: options.indicatorRequests,
      period: options.period,
      sessionTimeFrom: options.realtimeStart,
      sessionTimeTo: null,
      symbol: options.symbol,
    })
    const shouldRefreshRecoveredRealtimeIndicators = emptyRealtimeWindow &&
      emptyRealtimeWindow.activeRows.length > 0 &&
      options.indicatorRequests.length > 0
    if (!shouldRefreshRecoveredRealtimeIndicators) {
      setRealtimeWindow(emptyRealtimeWindow)
    }
    let realtimeWindowState = emptyRealtimeWindow
    let realtimeIndicatorRefreshId = 0
    let pendingFrameId = 0
    let pendingRealtimeWindow: StoreV6RealtimePageWindow | null = null
    let pendingIndicatorFrameId = 0
    let pendingHeavyIndicatorTimeoutId = 0
    let pendingIndicatorWindow: StoreV6RealtimePageWindow | null = null
    let indicatorRefreshInFlight = false
    let stablePageRebuildId = 0
    let stablePageRebuildScheduled = false
    let rateVolumeInFlight = false
    let latestRateVolumeTick: Mt5RealtimeWindowTick | null = null
    let dragEndFlushTimer = 0
    let dragEndFlushHandler: (() => void) | null = null
    const realtimeUpdateMode = options.indicatorRequests.reduce<'deferred' | 'tail' | 'window'>((mode, request) => {
      if (request.enabled === false) return mode
      const definition = chartWorkspaceIndicatorRegistryV2.get(request.id)
      const nextMode = definition?.realtimeUpdateMode ?? 'window'
      if (nextMode === 'deferred') return 'deferred'
      if (nextMode === 'window' && mode === 'tail') return 'window'
      return mode
    }, 'tail')
    const scheduleRealtimeFrame = (nextRealtimeWindow: StoreV6RealtimePageWindow) => {
      pendingRealtimeWindow = nextRealtimeWindow
      if (pendingFrameId !== 0) return
      pendingFrameId = window.requestAnimationFrame(() => {
        pendingFrameId = 0
        if (disposed || !pendingRealtimeWindow) return
        setRealtimeWindow(pendingRealtimeWindow)
      })
    }
    const clearDragEndFlush = () => {
      if (dragEndFlushHandler) {
        window.removeEventListener(kLineChartHorizontalDragEndEventV2, dragEndFlushHandler)
        dragEndFlushHandler = null
      }
      if (dragEndFlushTimer !== 0) {
        window.clearTimeout(dragEndFlushTimer)
        dragEndFlushTimer = 0
      }
    }
    const scheduleRealtimeFrameAfterDragEnd = (nextRealtimeWindow: StoreV6RealtimePageWindow) => {
      pendingRealtimeWindow = nextRealtimeWindow
      if (dragEndFlushHandler) return
      const flush = () => {
        clearDragEndFlush()
        if (disposed || !pendingRealtimeWindow) return
        scheduleRealtimeFrame(pendingRealtimeWindow)
        maybeAutoRebuildStablePage(pendingRealtimeWindow)
      }
      dragEndFlushHandler = flush
      window.addEventListener(kLineChartHorizontalDragEndEventV2, flush, { once: true })
      dragEndFlushTimer = window.setTimeout(() => {
        if (window.__ffKLineChartV2Interaction?.horizontalDragInProgress === true) return
        flush()
      }, 250)
    }
    const runPendingIndicatorRefresh = () => {
      if (disposed || indicatorRefreshInFlight || !pendingIndicatorWindow) return
      const sourceWindow = pendingIndicatorWindow
      pendingIndicatorWindow = null
      indicatorRefreshInFlight = true
      const refreshId = realtimeIndicatorRefreshId + 1
      realtimeIndicatorRefreshId = refreshId
      void refreshRealtimeWindowIndicatorsV2({
        historyRows: sourceWindow.indicatorHistoryRows ?? historyPageWindow.calculationRows,
        registry: chartWorkspaceIndicatorRegistryV2,
        requests: options.indicatorRequests,
        window: sourceWindow,
      }).then((refreshedWindow) => {
        indicatorRefreshInFlight = false
        if (disposed || refreshId !== realtimeIndicatorRefreshId) return
        if (pendingIndicatorWindow) {
          runPendingIndicatorRefresh()
          return
        }
        realtimeWindowState = refreshedWindow
        scheduleRealtimeFrame(refreshedWindow)
      }).catch(() => {
        indicatorRefreshInFlight = false
        if (disposed || refreshId !== realtimeIndicatorRefreshId) return
        if (pendingIndicatorWindow) {
          runPendingIndicatorRefresh()
          return
        }
        scheduleRealtimeFrame(sourceWindow)
      })
    }
    const scheduleIndicatorRefresh = (nextRealtimeWindow: StoreV6RealtimePageWindow) => {
      pendingIndicatorWindow = nextRealtimeWindow
      if (indicatorRefreshInFlight || pendingIndicatorFrameId !== 0) return
      pendingIndicatorFrameId = window.requestAnimationFrame(() => {
        pendingIndicatorFrameId = 0
        runPendingIndicatorRefresh()
      })
    }
    const flushSettlementIndicatorRefresh = (nextRealtimeWindow: StoreV6RealtimePageWindow) => {
      pendingIndicatorWindow = nextRealtimeWindow
      if (pendingIndicatorFrameId !== 0) {
        window.cancelAnimationFrame(pendingIndicatorFrameId)
        pendingIndicatorFrameId = 0
      }
      if (pendingHeavyIndicatorTimeoutId !== 0) {
        window.clearTimeout(pendingHeavyIndicatorTimeoutId)
        pendingHeavyIndicatorTimeoutId = 0
      }
      runPendingIndicatorRefresh()
    }
    const scheduleHeavyIndicatorRefresh = (nextRealtimeWindow: StoreV6RealtimePageWindow) => {
      pendingIndicatorWindow = nextRealtimeWindow
      if (indicatorRefreshInFlight || pendingIndicatorFrameId !== 0 || pendingHeavyIndicatorTimeoutId !== 0) return
      pendingHeavyIndicatorTimeoutId = window.setTimeout(() => {
        pendingHeavyIndicatorTimeoutId = 0
        scheduleIndicatorRefresh(pendingIndicatorWindow ?? nextRealtimeWindow)
      }, 80)
    }
    const scheduleStablePageRebuild = () => {
      if (disposed || !realtimeWindowState || stablePageRebuildScheduled) return
      stablePageRebuildScheduled = true
      const rebuildId = stablePageRebuildId + 1
      stablePageRebuildId = rebuildId
      traceKLineChartPageV2('RealtimeStablePageRebuild.start', {
        activeRows: realtimeWindowState.activeRows.length,
        period: options.period,
        sessionTimeFrom: realtimeWindowState.sessionTimeFrom,
        stableRows: realtimeWindowState.stableRows.length,
        symbol: options.symbol,
        tailTime: realtimeWindowState.tailRow?.time ?? null,
      })
      void rebuildStoreV6RealtimeStablePageWindow({
        enabled: options.realtimeEnabled === true,
        historyRows: historyPageWindow.calculationRows,
        indicatorRegistry: chartWorkspaceIndicatorRegistryV2,
        indicatorRequests: options.indicatorRequests,
        period: options.period,
        sessionTimeFrom: options.realtimeStart,
        sessionTimeTo: null,
        symbol: options.symbol,
      }, realtimeWindowState).then((rebuiltWindow) => {
        stablePageRebuildScheduled = false
        if (disposed || rebuildId !== stablePageRebuildId || !rebuiltWindow) return
        realtimeWindowState = rebuiltWindow
        pendingIndicatorWindow = null
        scheduleRealtimeFrame(rebuiltWindow)
        traceKLineChartPageV2('RealtimeStablePageRebuild.completed', {
          activeRows: rebuiltWindow.activeRows.length,
          period: rebuiltWindow.period,
          stableRows: rebuiltWindow.stableRows.length,
          symbol: rebuiltWindow.symbol,
          tailTime: rebuiltWindow.tailRow?.time ?? null,
          updateKind: rebuiltWindow.updateKind ?? null,
        })
        dispatchRealtimeStablePageRebuildCompleted({
          period: rebuiltWindow.period,
          rows: rebuiltWindow.activeRows.length,
          stableRows: rebuiltWindow.stableRows.length,
          symbol: rebuiltWindow.symbol,
          tailTime: rebuiltWindow.tailRow?.time ?? null,
        })
      }).catch(() => {
        stablePageRebuildScheduled = false
        traceKLineChartPageV2('RealtimeStablePageRebuild.failed', {
          period: options.period,
          symbol: options.symbol,
        })
        // Keep the current realtime window if rebuild fails.
      })
    }
    const maybeAutoRebuildStablePage = (windowToCheck: StoreV6RealtimePageWindow | null) => {
      if (!windowToCheck || stablePageRebuildScheduled) return
      const monitor = readRealtimePageMonitorSnapshotV2({
        period: options.period,
        sessionTimeFrom: windowToCheck.sessionTimeFrom,
        sessionTimeTo: windowToCheck.sessionTimeTo,
        symbol: options.symbol,
      })
      const reason = resolveAutoRebuildRealtimeStablePageReason({ monitor, window: windowToCheck })
      if (reason) {
        traceKLineChartPageV2('RealtimeStablePageRebuild.autoRequested', {
          activeRows: windowToCheck.activeRows.length,
          monitorRows: monitor?.rows ?? null,
          monitorTailTime: monitor?.tailTime ?? null,
          period: options.period,
          reason,
          sessionTimeFrom: windowToCheck.sessionTimeFrom,
          stableRows: windowToCheck.stableRows.length,
          symbol: options.symbol,
          tailTime: windowToCheck.tailRow?.time ?? null,
        })
        scheduleStablePageRebuild()
      }
    }
    if (options.realtimeEnabled !== true) {
      setRealtimeWindow(null)
    } else {
      if (shouldRefreshRecoveredRealtimeIndicators) {
        const refreshId = realtimeIndicatorRefreshId + 1
        realtimeIndicatorRefreshId = refreshId
        void refreshRealtimeWindowIndicatorsV2({
          historyRows: emptyRealtimeWindow.indicatorHistoryRows ?? historyPageWindow.calculationRows,
          registry: chartWorkspaceIndicatorRegistryV2,
          requests: options.indicatorRequests,
          window: emptyRealtimeWindow,
        }).then((restoredRealtimeWindow) => {
          if (disposed || refreshId !== realtimeIndicatorRefreshId) return
          realtimeWindowState = restoredRealtimeWindow
          setRealtimeWindow(restoredRealtimeWindow)
          maybeAutoRebuildStablePage(restoredRealtimeWindow)
        }).catch(() => {
          if (!disposed && refreshId === realtimeIndicatorRefreshId) setRealtimeWindow(emptyRealtimeWindow)
        })
      }
      void requestStoreV6RealtimePageWindow({
        enabled: true,
        historyRows: historyPageWindow.calculationRows,
        indicatorRegistry: chartWorkspaceIndicatorRegistryV2,
        indicatorRequests: options.indicatorRequests,
        period: options.period,
        sessionTimeFrom: options.realtimeStart,
        sessionTimeTo: null,
        symbol: options.symbol,
      })
        .then((nextRealtimeWindow) => {
          if (disposed) return
          realtimeWindowState = nextRealtimeWindow
          setRealtimeWindow(nextRealtimeWindow)
          maybeAutoRebuildStablePage(nextRealtimeWindow)
        })
        .catch(() => {
          if (!disposed) setRealtimeWindow(realtimeWindowState)
        })
    }

    const applyRealtimeTick = (tick: Mt5RealtimeWindowTick, barVolume: number | null) => {
      if (disposed || !realtimeWindowState) return
      const nextRealtimeWindow = mergeMt5RealtimeTickIntoWindow(realtimeWindowState, {
        ...tick,
        barVolume,
      })
      if (nextRealtimeWindow === realtimeWindowState) return
      realtimeWindowState = nextRealtimeWindow
      if (window.__ffKLineChartV2Interaction?.horizontalDragInProgress === true) {
        scheduleRealtimeFrameAfterDragEnd(nextRealtimeWindow)
        return
      }
      if (options.indicatorRequests.length === 0) {
        scheduleRealtimeFrame(nextRealtimeWindow)
        maybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      if (nextRealtimeWindow.updateKind === 'realtime-bar-close-settlement') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        flushSettlementIndicatorRefresh(nextRealtimeWindow)
        maybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      if (realtimeUpdateMode === 'tail') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        scheduleIndicatorRefresh(nextRealtimeWindow)
        maybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      if (realtimeUpdateMode === 'deferred') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        scheduleHeavyIndicatorRefresh(nextRealtimeWindow)
        maybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      scheduleIndicatorRefresh(nextRealtimeWindow)
      maybeAutoRebuildStablePage(nextRealtimeWindow)
    }
    const requestRateVolumeForLatestTick = (tick: Mt5RealtimeWindowTick) => {
      latestRateVolumeTick = tick
      if (rateVolumeInFlight) return
      const sourceTick = latestRateVolumeTick
      const tickPeriodStart = sourceTick ? resolveTickPeriodStartSeconds(sourceTick, options.period) : null
      if (tickPeriodStart == null) {
        return
      }
      rateVolumeInFlight = true
      void queryMt5Rates({
        limit: 3,
        symbol: options.symbol,
        timeframe: normalizeRealtimeRateTimeframe(options.period),
      })
        .then((payload) => {
          if (disposed) return
          const currentTick = latestRateVolumeTick ?? sourceTick
          const currentPeriodStart = currentTick ? resolveTickPeriodStartSeconds(currentTick, options.period) : tickPeriodStart
          const barVolume = options.period.trim().toUpperCase() === 'H2'
            ? resolveH2RealtimeRateVolumeForPeriodStartV2(payload.rows, currentPeriodStart ?? tickPeriodStart)
            : resolveMt5RateVolumeForPeriodStartV2(payload.rows, currentPeriodStart ?? tickPeriodStart)
          if (currentTick) applyRealtimeTick(currentTick, barVolume)
        })
        .catch(() => {})
        .finally(() => {
          rateVolumeInFlight = false
          if (disposed) return
          const pendingTick = latestRateVolumeTick
          if (pendingTick && pendingTick !== sourceTick) requestRateVolumeForLatestTick(pendingTick)
        })
    }
    const handleRealtimeTick = (event: Event) => {
      if (disposed || !realtimeWindowState) return
      const tick = (event as CustomEvent<Mt5RealtimeWindowTick>).detail
      if (!tick) return
      applyRealtimeTick(tick, null)
      requestRateVolumeForLatestTick(tick)
    }
    const handleStablePageRebuildRequest = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { period?: string | null; symbol?: string | null } : {}
      const matchesSymbol = !detail.symbol || detail.symbol === options.symbol
      const matchesPeriod = !detail.period || detail.period === options.period
      if (!matchesSymbol || !matchesPeriod) return
      scheduleStablePageRebuild()
    }
    const handleRealtimeStateChanged = () => {
      maybeAutoRebuildStablePage(realtimeWindowState)
    }
    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    window.addEventListener(realtimeStablePageRebuildRequestedEvent, handleStablePageRebuildRequest)
    window.addEventListener(workbenchEvents.realtimePageBufferChanged, handleRealtimeStateChanged)
    window.addEventListener(workbenchEvents.realtimePageSnapshotChanged, handleRealtimeStateChanged)
    return () => {
      disposed = true
      clearDragEndFlush()
      if (pendingFrameId !== 0) window.cancelAnimationFrame(pendingFrameId)
      if (pendingIndicatorFrameId !== 0) window.cancelAnimationFrame(pendingIndicatorFrameId)
      if (pendingHeavyIndicatorTimeoutId !== 0) window.clearTimeout(pendingHeavyIndicatorTimeoutId)
      window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
      window.removeEventListener(realtimeStablePageRebuildRequestedEvent, handleStablePageRebuildRequest)
      window.removeEventListener(workbenchEvents.realtimePageBufferChanged, handleRealtimeStateChanged)
      window.removeEventListener(workbenchEvents.realtimePageSnapshotChanged, handleRealtimeStateChanged)
    }
  }, [
    options.hasHistoryPageWindow,
    options.historyPageWindow,
    options.historyWindowRealtimeSignature,
    options.indicatorRequests,
    options.indicatorSignature,
    options.period,
    options.realtimeEnabled,
    options.realtimeStart,
    options.symbol,
  ])

  return realtimeWindow
}
