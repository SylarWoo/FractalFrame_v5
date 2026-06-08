import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'

export type ChartRenderWindowSegmentV2 = {
  fromIndex: number
  key: string
  rows: number
  source: 'history' | 'realtime'
  timeFrom: number | null
  timeTo: number | null
  toIndex: number
}

export type ChartRenderWindowRowV2 = StoreV6WindowKLine & {
  windowSource: 'history' | 'realtime'
}

export type ChartRenderWindowV2 = {
  indicators: StoreV6HistoryPageWindowIndicators
  key: string
  pageIndex: number
  period: string
  rows: ChartRenderWindowRowV2[]
  segments: {
    history: ChartRenderWindowSegmentV2
    realtime?: ChartRenderWindowSegmentV2
  }
  source: 'chart-render-window-v2'
  symbol: string
}
