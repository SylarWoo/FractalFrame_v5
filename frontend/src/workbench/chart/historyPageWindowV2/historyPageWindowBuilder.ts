import type {
  StoreV6HistoryPageWindow,
  StoreV6HistoryPageWindowIndicatorPreloadContext,
  StoreV6HistoryPageWindowIndicators,
  StoreV6HistoryPageWindowRequest,
} from './historyPageWindowTypes'
import { requestHistoryWindowIndicatorsV2 } from '../indicatorRequestV2'
import { traceKLineChartPageV2 } from '../klineChartRendererV2/klineChartPageDebugProbeV2'

function createIndicatorContext(request: StoreV6HistoryPageWindowRequest): StoreV6HistoryPageWindowIndicatorPreloadContext {
  const { historyPage } = request
  const { slice } = historyPage
  return {
    boundary: slice.boundary,
    calculationRows: slice.calculationRows,
    displayOffset: slice.displayOffset,
    displayRows: slice.displayRows,
    pageIndex: historyPage.pageIndex,
    period: slice.period,
    symbol: slice.symbol,
    warmupRows: slice.warmupRows,
  }
}

function normalizeIndicators(value: StoreV6HistoryPageWindowIndicators | null | undefined) {
  return value ?? {}
}

function mergeIndicators(
  left: StoreV6HistoryPageWindowIndicators,
  right: StoreV6HistoryPageWindowIndicators,
) {
  return {
    ...left,
    ...right,
  }
}

export async function buildStoreV6HistoryPageWindow(
  request: StoreV6HistoryPageWindowRequest,
): Promise<StoreV6HistoryPageWindow> {
  const { historyPage } = request
  const { slice } = historyPage
  const indicatorContext = createIndicatorContext(request)
  const controllerIndicators = await requestHistoryWindowIndicatorsV2({
    boundary: slice.boundary,
    calculationRows: slice.calculationRows,
    displayOffset: slice.displayOffset,
    displayRows: slice.displayRows,
    pageIndex: historyPage.pageIndex,
    period: slice.period,
    registry: request.indicatorRegistry,
    requests: request.indicatorRequests,
    runtime: request.indicatorRuntime,
    symbol: slice.symbol,
    warmupRows: slice.warmupRows,
  })
  const preloadIndicators = normalizeIndicators(
    request.indicatorPreloader ? await request.indicatorPreloader(indicatorContext) : {},
  )
  const indicators = mergeIndicators(controllerIndicators, preloadIndicators)
  traceKLineChartPageV2('HistoryPageWindow.build.ready', {
    actualTimeFrom: slice.boundary.actualTimeFrom,
    actualTimeTo: slice.boundary.actualTimeTo,
    displayRows: slice.displayRows.length,
    key: slice.key,
    pageIndex: historyPage.pageIndex,
    period: slice.period,
    symbol: slice.symbol,
  })

  return {
    boundary: slice.boundary,
    calculationRows: slice.calculationRows,
    displayOffset: slice.displayOffset,
    historyRows: slice.displayRows,
    indicators,
    key: `history-window-v2:${slice.key}`,
    page: historyPage.page,
    pageIndex: historyPage.pageIndex,
    period: slice.period,
    renderData: {
      indicators,
      klineRows: slice.displayRows,
    },
    source: 'store-v6-history-page-window-v2',
    status: 'ready',
    symbol: slice.symbol,
    warmupRows: slice.warmupRows,
  }
}
