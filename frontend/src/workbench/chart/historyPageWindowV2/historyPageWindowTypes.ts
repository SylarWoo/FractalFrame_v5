import type { StoreV6HistoryPageResult } from '../historyPageRequestV2'
import type { StoreV6IndicatorRegistryV2, StoreV6IndicatorRequestRuntimeV2, StoreV6IndicatorRequestSpecV2 } from '../indicatorRequestV2'
import type { StoreV6PageSliceBoundary, StoreV6WindowKLine } from '../pageSliceV2'

export type StoreV6HistoryPageWindowIndicatorSeries<Row = unknown> = {
  calculationMode?: 'computed' | 'mixed' | 'passthrough'
  displayRows?: Row[]
  id?: string
  key: string
  paneId?: string
  paneRole?: 'main' | 'sub'
  renderRole?: 'main-overlay' | 'sub-pane'
  rows: Row[]
  settings?: unknown
  source: string
}

export type StoreV6HistoryPageWindowIndicators = Record<string, StoreV6HistoryPageWindowIndicatorSeries>

export type StoreV6HistoryPageWindowIndicatorPreloadContext = {
  boundary: StoreV6PageSliceBoundary
  calculationRows: StoreV6WindowKLine[]
  displayOffset: number
  displayRows: StoreV6WindowKLine[]
  pageIndex: number
  period: string
  symbol: string
  warmupRows: StoreV6WindowKLine[]
}

export type StoreV6HistoryPageWindowIndicatorPreloader = (
  context: StoreV6HistoryPageWindowIndicatorPreloadContext,
) => Promise<StoreV6HistoryPageWindowIndicators> | StoreV6HistoryPageWindowIndicators

export type StoreV6HistoryPageWindowRequest = {
  historyPage: StoreV6HistoryPageResult
  indicatorRegistry?: StoreV6IndicatorRegistryV2
  indicatorPreloader?: StoreV6HistoryPageWindowIndicatorPreloader
  indicatorRequests?: StoreV6IndicatorRequestSpecV2[]
  indicatorRuntime?: StoreV6IndicatorRequestRuntimeV2
}

export type StoreV6HistoryPageWindow = {
  boundary: StoreV6PageSliceBoundary
  calculationRows: StoreV6WindowKLine[]
  displayOffset: number
  historyRows: StoreV6WindowKLine[]
  indicators: StoreV6HistoryPageWindowIndicators
  key: string
  pageIndex: number
  period: string
  renderData: {
    indicators: StoreV6HistoryPageWindowIndicators
    klineRows: StoreV6WindowKLine[]
  }
  source: 'store-v6-history-page-window-v2'
  status: 'ready'
  symbol: string
  warmupRows: StoreV6WindowKLine[]
}
