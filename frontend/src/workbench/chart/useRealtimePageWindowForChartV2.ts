import { useEffect, useState } from 'react'
import type { StoreV6HistoryPageWindow } from './historyPageWindowV2'
import {
  buildStoreV6RealtimePageWindow,
  mergeMt5RealtimeTickIntoWindow,
  rebuildStoreV6RealtimeStablePageWindow,
  dispatchRealtimeStablePageRebuildCompleted,
  requestStoreV6RealtimePageWindow,
  realtimeStablePageRebuildRequestedEvent,
  type Mt5RealtimeWindowTick,
  type StoreV6RealtimePageWindow,
} from './realtimePageWindowV2'
import { readRealtimePageMonitorSnapshotV2 } from './realtimePageWindowV2/realtimePageMonitorV2'
import {
  isRealtimeWindowStructurallyInconsistent,
  resolveAutoRebuildRealtimeStablePageReason,
} from './realtimePageWindowV2/realtimeStablePageRebuildHeuristics'
import {
  refreshRealtimeWindowIndicatorsV2,
  type StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestV2'
import { chartWorkspaceIndicatorRegistryV2 } from './chartWorkspaceIndicatorRegistryV2'
import { workbenchEvents } from '../persistence/workbenchEvents'
import { traceKLineChartPageV2 } from './klineChartRendererV2/klineChartPageDebugProbeV2'
import { kLineChartHorizontalDragEndEventV2 } from './klineChartRendererV2/klineChartInteractionStateV2'
import { createRealtimeRateVolumeResolverV2 } from './realtimeRateVolumeResolverV2'

declare global {
  interface Window {
    __ffKLineChartV2Interaction?: {
      horizontalDragInProgress: boolean
    }
  }
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
    let pendingAutoRebuildFrameId = 0
    let pendingAutoRebuildWindow: StoreV6RealtimePageWindow | null = null
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
        scheduleMaybeAutoRebuildStablePage(pendingRealtimeWindow)
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
    const maybeAutoRebuildStablePageNow = (windowToCheck: StoreV6RealtimePageWindow | null) => {
      if (!windowToCheck || stablePageRebuildScheduled) return
      const monitor = isRealtimeWindowStructurallyInconsistent(windowToCheck)
        ? null
        : readRealtimePageMonitorSnapshotV2({
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
    const scheduleMaybeAutoRebuildStablePage = (windowToCheck: StoreV6RealtimePageWindow | null) => {
      pendingAutoRebuildWindow = windowToCheck
      if (pendingAutoRebuildFrameId !== 0) return
      pendingAutoRebuildFrameId = window.requestAnimationFrame(() => {
        pendingAutoRebuildFrameId = 0
        const windowForCheck = pendingAutoRebuildWindow
        pendingAutoRebuildWindow = null
        if (disposed) return
        maybeAutoRebuildStablePageNow(windowForCheck)
      })
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
          scheduleMaybeAutoRebuildStablePage(restoredRealtimeWindow)
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
          scheduleMaybeAutoRebuildStablePage(nextRealtimeWindow)
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
        scheduleMaybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      if (nextRealtimeWindow.updateKind === 'realtime-bar-close-settlement') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        flushSettlementIndicatorRefresh(nextRealtimeWindow)
        scheduleMaybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      if (realtimeUpdateMode === 'tail') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        scheduleIndicatorRefresh(nextRealtimeWindow)
        scheduleMaybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      if (realtimeUpdateMode === 'deferred') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        scheduleHeavyIndicatorRefresh(nextRealtimeWindow)
        scheduleMaybeAutoRebuildStablePage(nextRealtimeWindow)
        return
      }
      scheduleIndicatorRefresh(nextRealtimeWindow)
      scheduleMaybeAutoRebuildStablePage(nextRealtimeWindow)
    }
    const rateVolumeResolver = createRealtimeRateVolumeResolverV2({
      apply: applyRealtimeTick,
      period: options.period,
      symbol: options.symbol,
    })
    const handleRealtimeTick = (event: Event) => {
      if (disposed || !realtimeWindowState) return
      const tick = (event as CustomEvent<Mt5RealtimeWindowTick>).detail
      if (!tick) return
      applyRealtimeTick(tick, null)
      rateVolumeResolver.request(tick)
    }
    const handleStablePageRebuildRequest = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { period?: string | null; symbol?: string | null } : {}
      const matchesSymbol = !detail.symbol || detail.symbol === options.symbol
      const matchesPeriod = !detail.period || detail.period === options.period
      if (!matchesSymbol || !matchesPeriod) return
      scheduleStablePageRebuild()
    }
    const handleRealtimeStateChanged = () => {
      scheduleMaybeAutoRebuildStablePage(realtimeWindowState)
    }
    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    window.addEventListener(realtimeStablePageRebuildRequestedEvent, handleStablePageRebuildRequest)
    window.addEventListener(workbenchEvents.realtimePageBufferChanged, handleRealtimeStateChanged)
    window.addEventListener(workbenchEvents.realtimePageSnapshotChanged, handleRealtimeStateChanged)
    return () => {
      disposed = true
      rateVolumeResolver.dispose()
      clearDragEndFlush()
      if (pendingFrameId !== 0) window.cancelAnimationFrame(pendingFrameId)
      if (pendingIndicatorFrameId !== 0) window.cancelAnimationFrame(pendingIndicatorFrameId)
      if (pendingAutoRebuildFrameId !== 0) window.cancelAnimationFrame(pendingAutoRebuildFrameId)
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
