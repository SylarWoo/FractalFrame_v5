import { useEffect, useState } from 'react'
import type { ChartLoadState, ChartPageNavigation } from './chartRuntimeTypes'
import { buildCachedKLineChartRenderFrameV2 } from './chartRenderCacheV2'
import type { StoreV6HistoryPageWindow } from './historyPageWindowV2'
import {
  createStoreV6IndicatorRegistryV2,
  preheatHistoryWindowForIndicatorsV2,
  refreshRealtimeWindowIndicatorsV2,
  requestHistoryWindowIndicatorsV2,
  storeV6MaIndicatorDefinitionV2,
  storeV6MorganRangeM5IndicatorDefinitionV2,
  storeV6StochIndicatorDefinitionV2,
  storeV6VolIndicatorDefinitionV2,
  storeV6VwapIndicatorDefinitionV2,
  type StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from './klineChartRenderFrameV2'
import { BlankKLineChartHostV2, KLineChartHostV2 } from './klineChartRendererV2'
import { traceKLineChartPageV2 } from './klineChartRendererV2/klineChartPageDebugProbeV2'
import {
  buildStoreV6RealtimePageWindow,
  mergeMt5RealtimeTickIntoWindow,
  requestStoreV6RealtimePageWindow,
  type Mt5RealtimeWindowTick,
  type StoreV6RealtimePageWindow,
} from './realtimePageWindowV2'

export type ChartWorkspaceTargetV2 = {
  historyPageWindow?: StoreV6HistoryPageWindow | null
  indicatorRequests?: StoreV6IndicatorRequestSpecV2[]
  pageNavigation?: ChartPageNavigation | null
  period: string
  realtimeEnabled?: boolean
  symbol: string
  totalRows?: number | null
}

type ChartWorkspaceV2Props = {
  displayName?: string
  onLoadStateChange?: (state: ChartLoadState) => void
  target: ChartWorkspaceTargetV2
}

const chartWorkspaceIndicatorRegistryV2 = createStoreV6IndicatorRegistryV2()
chartWorkspaceIndicatorRegistryV2.register(storeV6MaIndicatorDefinitionV2)
chartWorkspaceIndicatorRegistryV2.register(storeV6MorganRangeM5IndicatorDefinitionV2)
chartWorkspaceIndicatorRegistryV2.register(storeV6VolIndicatorDefinitionV2)
chartWorkspaceIndicatorRegistryV2.register(storeV6VwapIndicatorDefinitionV2)
chartWorkspaceIndicatorRegistryV2.register(storeV6StochIndicatorDefinitionV2)

function createIndicatorRequestSignature(requests: StoreV6IndicatorRequestSpecV2[] | null | undefined) {
  if (!requests || requests.length === 0) return 'no-indicators'
  return requests
    .map((request) => `${request.id}:${request.enabled === false ? 'off' : 'on'}:${request.paneId ?? ''}:${JSON.stringify(request.params ?? null)}`)
    .join('|')
}

function createHistoryWindowRealtimeSignature(historyWindow: StoreV6HistoryPageWindow | null, realtimeStart?: number | null) {
  if (!historyWindow) return 'no-history-window'
  const boundary = historyWindow.boundary
  return [
    historyWindow.key,
    historyWindow.symbol,
    historyWindow.period,
    historyWindow.pageIndex,
    realtimeStart ?? boundary.actualTimeTo ?? 'none',
    boundary.actualTimeFrom ?? 'none',
    boundary.actualTimeTo ?? 'none',
    historyWindow.historyRows.length,
  ].join(':')
}

function attachIndicatorsToHistoryWindow(
  historyWindow: StoreV6HistoryPageWindow,
  indicators: StoreV6HistoryPageWindow['indicators'],
  indicatorSignature: string,
): StoreV6HistoryPageWindow {
  return {
    ...historyWindow,
    indicators,
    key: `${historyWindow.key}:indicators:${indicatorSignature}`,
    renderData: {
      ...historyWindow.renderData,
      indicators,
    },
  }
}

export function ChartWorkspaceV2({ displayName, onLoadStateChange, target }: ChartWorkspaceV2Props) {
  const [frame, setFrame] = useState<KLineChartRenderFrameV2 | null>(null)
  const [historyPageWindowWithIndicators, setHistoryPageWindowWithIndicators] = useState<StoreV6HistoryPageWindow | null>(null)
  const [realtimeWindow, setRealtimeWindow] = useState<StoreV6RealtimePageWindow | null>(null)
  const historyPageWindowMatchesTarget = target.historyPageWindow?.symbol === target.symbol &&
    target.historyPageWindow?.period === target.period
  const activeHistoryPageWindow = historyPageWindowMatchesTarget ? target.historyPageWindow ?? null : null
  const indicatorSignature = createIndicatorRequestSignature(target.indicatorRequests)
  const preparedHistoryPageWindow = historyPageWindowWithIndicators
  const hasHistoryPageWindow = Boolean(preparedHistoryPageWindow)
  const realtimeStart = target.pageNavigation?.realtimeStart ?? preparedHistoryPageWindow?.boundary.actualTimeTo ?? null
  const historyWindowRealtimeSignature = createHistoryWindowRealtimeSignature(preparedHistoryPageWindow, realtimeStart)

  useEffect(() => {
    traceKLineChartPageV2('ChartWorkspace.target.received', {
      hasHistoryPageWindow,
      historyPageIndex: preparedHistoryPageWindow?.pageIndex ?? null,
      historyWindowKey: preparedHistoryPageWindow?.key ?? null,
      pageNavigationIndex: target.pageNavigation?.current.index ?? null,
      realtimeStart,
      symbol: target.symbol,
      period: target.period,
    })
  }, [hasHistoryPageWindow, preparedHistoryPageWindow?.key, preparedHistoryPageWindow?.pageIndex, realtimeStart, target.pageNavigation?.current.index, target.period, target.symbol])

  useEffect(() => {
    let disposed = false
    const historyPageWindow = activeHistoryPageWindow
    const indicatorRequests = target.indicatorRequests ?? []
    if (!historyPageWindow) {
      setHistoryPageWindowWithIndicators(null)
      return () => {
        disposed = true
      }
    }
    if (indicatorRequests.length === 0) {
      setHistoryPageWindowWithIndicators(historyPageWindow)
      return () => {
        disposed = true
      }
    }
    void preheatHistoryWindowForIndicatorsV2({
      registry: chartWorkspaceIndicatorRegistryV2,
      requests: indicatorRequests,
      window: historyPageWindow,
    })
      .then((preheatedWindow) => {
        if (disposed) return
        if (preheatedWindow !== historyPageWindow) {
          setHistoryPageWindowWithIndicators({
            ...preheatedWindow,
            key: `${preheatedWindow.key}:indicators:${indicatorSignature}`,
          })
          return
        }
        return requestHistoryWindowIndicatorsV2({
          boundary: historyPageWindow.boundary,
          calculationRows: historyPageWindow.calculationRows,
          displayOffset: historyPageWindow.displayOffset,
          displayRows: historyPageWindow.historyRows,
          pageIndex: historyPageWindow.pageIndex,
          period: historyPageWindow.period,
          registry: chartWorkspaceIndicatorRegistryV2,
          requests: indicatorRequests,
          symbol: historyPageWindow.symbol,
          warmupRows: historyPageWindow.warmupRows,
        })
      })
      .then((indicators) => {
        if (disposed || !indicators) return
        setHistoryPageWindowWithIndicators(attachIndicatorsToHistoryWindow(historyPageWindow, indicators, indicatorSignature))
      })
      .catch(() => {
        if (!disposed) setHistoryPageWindowWithIndicators(historyPageWindow)
      })
    return () => {
      disposed = true
    }
  }, [activeHistoryPageWindow, indicatorSignature])

  useEffect(() => {
    const historyPageWindow = preparedHistoryPageWindow
    if (!historyPageWindow) {
      setFrame(null)
      return
    }
    const nextFrame = buildCachedKLineChartRenderFrameV2({
      historyWindow: historyPageWindow,
      realtimeWindow,
    }).frame
    setFrame(nextFrame)
  }, [preparedHistoryPageWindow, realtimeWindow])

  useEffect(() => {
    let disposed = false
    const historyPageWindow = preparedHistoryPageWindow
    if (!historyPageWindow) {
      setRealtimeWindow(null)
      return () => {
        disposed = true
      }
    }
    const emptyRealtimeWindow = buildStoreV6RealtimePageWindow({
      enabled: target.realtimeEnabled === true,
      historyRows: historyPageWindow.calculationRows,
      indicatorRegistry: chartWorkspaceIndicatorRegistryV2,
      indicatorRequests: target.indicatorRequests ?? [],
      period: target.period,
      sessionTimeFrom: realtimeStart,
      sessionTimeTo: null,
      symbol: target.symbol,
    })
    const shouldRefreshRecoveredRealtimeIndicators = emptyRealtimeWindow &&
      emptyRealtimeWindow.activeRows.length > 0 &&
      (target.indicatorRequests ?? []).length > 0
    if (!shouldRefreshRecoveredRealtimeIndicators) {
      setRealtimeWindow(emptyRealtimeWindow)
    }
    let realtimeWindowState = emptyRealtimeWindow
    let realtimeIndicatorRefreshId = 0
    let pendingFrameId = 0
    let pendingRealtimeWindow: StoreV6RealtimePageWindow | null = null
    const scheduleRealtimeFrame = (realtimeWindow: StoreV6RealtimePageWindow) => {
      pendingRealtimeWindow = realtimeWindow
      if (pendingFrameId !== 0) return
      pendingFrameId = window.requestAnimationFrame(() => {
        pendingFrameId = 0
        if (disposed || !pendingRealtimeWindow) return
        setRealtimeWindow(pendingRealtimeWindow)
      })
    }
    if (target.realtimeEnabled !== true) {
      setRealtimeWindow(null)
    } else {
      if (shouldRefreshRecoveredRealtimeIndicators) {
        const refreshId = realtimeIndicatorRefreshId + 1
        realtimeIndicatorRefreshId = refreshId
        void refreshRealtimeWindowIndicatorsV2({
          historyRows: emptyRealtimeWindow.indicatorHistoryRows ?? historyPageWindow.calculationRows,
          registry: chartWorkspaceIndicatorRegistryV2,
          requests: target.indicatorRequests ?? [],
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
        indicatorRequests: target.indicatorRequests ?? [],
        period: target.period,
        sessionTimeFrom: realtimeStart,
        sessionTimeTo: null,
        symbol: target.symbol,
      })
        .then((realtimeWindow) => {
          if (disposed) return
          realtimeWindowState = realtimeWindow
          setRealtimeWindow(realtimeWindow)
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
      const indicatorRequests = target.indicatorRequests ?? []
      if (indicatorRequests.length === 0) {
        scheduleRealtimeFrame(nextRealtimeWindow)
        return
      }
      const refreshId = realtimeIndicatorRefreshId + 1
      realtimeIndicatorRefreshId = refreshId
      void refreshRealtimeWindowIndicatorsV2({
        historyRows: nextRealtimeWindow.indicatorHistoryRows ?? historyPageWindow.calculationRows,
        registry: chartWorkspaceIndicatorRegistryV2,
        requests: indicatorRequests,
        window: nextRealtimeWindow,
      }).then((refreshedWindow) => {
        if (disposed || refreshId !== realtimeIndicatorRefreshId) return
        realtimeWindowState = refreshedWindow
        scheduleRealtimeFrame(refreshedWindow)
      }).catch(() => {
        if (!disposed && refreshId === realtimeIndicatorRefreshId) scheduleRealtimeFrame(nextRealtimeWindow)
      })
    }
    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    return () => {
      disposed = true
      if (pendingFrameId !== 0) window.cancelAnimationFrame(pendingFrameId)
      window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    }
  }, [hasHistoryPageWindow, historyWindowRealtimeSignature, indicatorSignature, realtimeStart, target.period, target.realtimeEnabled, target.symbol])

  if (!frame) {
    return (
      <BlankKLineChartHostV2
        period={target.period}
        symbol={target.symbol}
      />
    )
  }

  return (
    <KLineChartHostV2
      displayName={displayName}
      frame={frame}
      onLoadStateChange={onLoadStateChange}
      pageNavigation={target.pageNavigation}
      totalRows={target.totalRows}
    />
  )
}
