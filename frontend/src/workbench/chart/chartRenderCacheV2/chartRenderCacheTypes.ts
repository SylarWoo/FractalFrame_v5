import type { ChartRenderWindowV2 } from '../chartRenderWindowV2'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'

export type ChartRenderCacheV2PerfEntry = {
  at: number
  buildMs: number
  cache: {
    finalFrameHit: boolean
    historyWindowHit: boolean
    realtimeWindowHit: boolean
    renderWindowHit: boolean
  }
  frameMs: number
  historyRows: number
  key: string
  pageIndex: number
  realtimeRows: number
  totalRows: number
  translateMs: number
}

export type ChartRenderCacheV2Debug = {
  finalFrame: {
    hits: number
    misses: number
    size: number
  }
  historyWindow: {
    hits: number
    misses: number
    size: number
  }
  realtimeWindow: {
    hits: number
    misses: number
    size: number
  }
  renderWindow: {
    hits: number
    misses: number
    size: number
  }
}

export type CachedChartRenderFrameV2 = {
  frame: KLineChartRenderFrameV2
  historyWindow: StoreV6HistoryPageWindow
  realtimeWindow: StoreV6RealtimePageWindow | null
  renderWindow: ChartRenderWindowV2
}
