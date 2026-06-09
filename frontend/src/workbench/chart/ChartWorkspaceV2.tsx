import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChartLoadState, ChartPageNavigation } from './chartRuntimeTypes'
import { buildCachedKLineChartRenderFrameV2 } from './chartRenderCacheV2'
import type { StoreV6HistoryPageWindow } from './historyPageWindowV2'
import type { StoreV6IndicatorRequestSpecV2 } from './indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from './klineChartRenderFrameV2'
import { BlankKLineChartHostV2, KLineChartHostV2 } from './klineChartRendererV2'
import { traceKLineChartPageV2 } from './klineChartRendererV2/klineChartPageDebugProbeV2'
import { resolveRealtimeModeForHistoryPageV2 } from './klineChartRendererV2/klineChartRenderViewportPolicyV2'
import { createStoreV6IndicatorRequestSignatureV2 } from './indicatorRequestV2/indicatorRequestSignatureV2'
import {
  applyStoreV6IndicatorRenderSettingsToHistoryWindowV2,
  applyStoreV6IndicatorRenderSettingsToRealtimeWindowV2,
  createStoreV6CalculationIndicatorRequestsV2,
  createStoreV6IndicatorRenderSettingsSignatureV2,
} from './indicatorRequestV2/indicatorRenderSettingsV2'
import { useHistoryWindowIndicatorsV2 } from './useHistoryWindowIndicatorsV2'
import { useRealtimePageWindowForChartV2 } from './useRealtimePageWindowForChartV2'

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

export function ChartWorkspaceV2({ displayName, onLoadStateChange, target }: ChartWorkspaceV2Props) {
  const [frame, setFrame] = useState<KLineChartRenderFrameV2 | null>(null)
  const calculationRequestsRef = useRef<{
    requests: StoreV6IndicatorRequestSpecV2[]
    signature: string
  }>({ requests: [], signature: 'no-indicators' })
  const indicatorRequests = useMemo(() => target.indicatorRequests ?? [], [target.indicatorRequests])
  const nextCalculationIndicatorRequests = createStoreV6CalculationIndicatorRequestsV2(indicatorRequests)
  const nextCalculationIndicatorSignature = createStoreV6IndicatorRequestSignatureV2(nextCalculationIndicatorRequests)
  if (calculationRequestsRef.current.signature !== nextCalculationIndicatorSignature) {
    calculationRequestsRef.current = {
      requests: nextCalculationIndicatorRequests,
      signature: nextCalculationIndicatorSignature,
    }
  }
  const calculationIndicatorRequests = calculationRequestsRef.current.requests
  const historyPageWindowMatchesTarget = target.historyPageWindow?.symbol === target.symbol &&
    target.historyPageWindow?.period === target.period
  const activeHistoryPageWindow = historyPageWindowMatchesTarget ? target.historyPageWindow ?? null : null
  const indicatorSignature = calculationRequestsRef.current.signature
  const renderSettingsSignature = createStoreV6IndicatorRenderSettingsSignatureV2(indicatorRequests)
  const historyPageWindowWithIndicators = useHistoryWindowIndicatorsV2({
    activeHistoryPageWindow,
    indicatorRequests: calculationIndicatorRequests,
    indicatorSignature,
  })
  const preparedHistoryPageWindow = useMemo(
    () => applyStoreV6IndicatorRenderSettingsToHistoryWindowV2(
      historyPageWindowWithIndicators,
      indicatorRequests,
      renderSettingsSignature,
    ),
    [historyPageWindowWithIndicators, indicatorRequests, renderSettingsSignature],
  )
  const hasHistoryPageWindow = Boolean(historyPageWindowWithIndicators)
  const realtimeStart = target.pageNavigation?.realtimeStart ?? historyPageWindowWithIndicators?.boundary.actualTimeTo ?? null
  const historyWindowRealtimeSignature = createHistoryWindowRealtimeSignature(historyPageWindowWithIndicators, realtimeStart)
  const realtimeMode = resolveRealtimeModeForHistoryPageV2(preparedHistoryPageWindow)
  const realtimeWindow = useRealtimePageWindowForChartV2({
    hasHistoryPageWindow,
    historyPageWindow: historyPageWindowWithIndicators,
    historyWindowRealtimeSignature,
    indicatorRequests: calculationIndicatorRequests,
    indicatorSignature,
    period: target.period,
    realtimeEnabled: target.realtimeEnabled,
    realtimeStart,
    symbol: target.symbol,
  })
  const realtimeWindowWithRenderSettings = useMemo(
    () => applyStoreV6IndicatorRenderSettingsToRealtimeWindowV2(
      realtimeWindow,
      indicatorRequests,
      renderSettingsSignature,
    ),
    [indicatorRequests, realtimeWindow, renderSettingsSignature],
  )
  const visualRealtimeWindow = realtimeMode === 'visual'
    ? realtimeWindowWithRenderSettings
    : null

  useEffect(() => {
    traceKLineChartPageV2('ChartWorkspace.target.received', {
      hasHistoryPageWindow,
      historyPageIndex: preparedHistoryPageWindow?.pageIndex ?? null,
      historyWindowKey: preparedHistoryPageWindow?.key ?? null,
      pageNavigationIndex: target.pageNavigation?.current.index ?? null,
      realtimeMode,
      realtimeStart,
      symbol: target.symbol,
      period: target.period,
    })
  }, [hasHistoryPageWindow, preparedHistoryPageWindow?.key, preparedHistoryPageWindow?.pageIndex, realtimeMode, realtimeStart, target.pageNavigation?.current.index, target.period, target.symbol])

  useEffect(() => {
    const historyPageWindow = preparedHistoryPageWindow
    if (!historyPageWindow) {
      setFrame(null)
      return
    }
    const nextFrame = buildCachedKLineChartRenderFrameV2({
      historyWindow: historyPageWindow,
      realtimeWindow: visualRealtimeWindow,
    }).frame
    setFrame(nextFrame)
  }, [preparedHistoryPageWindow, visualRealtimeWindow])

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
