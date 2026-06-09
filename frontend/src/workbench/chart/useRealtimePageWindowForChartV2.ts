import { useEffect, useState } from 'react'
import type { StoreV6HistoryPageWindow } from './historyPageWindowV2'
import {
  buildStoreV6RealtimePageWindow,
  mergeMt5RealtimeTickIntoWindow,
  requestStoreV6RealtimePageWindow,
  type Mt5RealtimeWindowTick,
  type StoreV6RealtimePageWindow,
} from './realtimePageWindowV2'
import {
  refreshRealtimeWindowIndicatorsV2,
  type StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestV2'
import { chartWorkspaceIndicatorRegistryV2 } from './chartWorkspaceIndicatorRegistryV2'

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
    const scheduleHeavyIndicatorRefresh = (nextRealtimeWindow: StoreV6RealtimePageWindow) => {
      pendingIndicatorWindow = nextRealtimeWindow
      if (indicatorRefreshInFlight || pendingIndicatorFrameId !== 0 || pendingHeavyIndicatorTimeoutId !== 0) return
      pendingHeavyIndicatorTimeoutId = window.setTimeout(() => {
        pendingHeavyIndicatorTimeoutId = 0
        scheduleIndicatorRefresh(pendingIndicatorWindow ?? nextRealtimeWindow)
      }, 80)
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
        })
        .catch(() => {
          if (!disposed) setRealtimeWindow(realtimeWindowState)
        })
    }

    const handleRealtimeTick = (event: Event) => {
      if (disposed || !realtimeWindowState) return
      const tick = (event as CustomEvent<Mt5RealtimeWindowTick>).detail
      if (!tick) return
      const nextRealtimeWindow = mergeMt5RealtimeTickIntoWindow(realtimeWindowState, tick)
      if (nextRealtimeWindow === realtimeWindowState) return
      realtimeWindowState = nextRealtimeWindow
      if (window.__ffKLineChartV2Interaction?.horizontalDragInProgress === true) return
      if (options.indicatorRequests.length === 0) {
        scheduleRealtimeFrame(nextRealtimeWindow)
        return
      }
      if (realtimeUpdateMode === 'tail') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        scheduleIndicatorRefresh(nextRealtimeWindow)
        return
      }
      if (realtimeUpdateMode === 'deferred') {
        scheduleRealtimeFrame(nextRealtimeWindow)
        scheduleHeavyIndicatorRefresh(nextRealtimeWindow)
        return
      }
      scheduleIndicatorRefresh(nextRealtimeWindow)
    }
    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    return () => {
      disposed = true
      if (pendingFrameId !== 0) window.cancelAnimationFrame(pendingFrameId)
      if (pendingIndicatorFrameId !== 0) window.cancelAnimationFrame(pendingIndicatorFrameId)
      if (pendingHeavyIndicatorTimeoutId !== 0) window.clearTimeout(pendingHeavyIndicatorTimeoutId)
      window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
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
