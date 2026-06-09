import type { KLineData } from 'klinecharts'

export type KLineChartFrameAlignment = {
  barKeyToDataIndex: Map<string, number>
  dataIndexToBarKey: string[]
  dataIndexToGlobalIndex: Array<number | null>
  dataIndexToTimestamp: number[]
  globalIndexToDataIndex: Map<number, number>
  timestampToDataIndex: Map<number, number>
}

export type KLineChartPaneFrame<Row = unknown> = {
  key: string
  paneId?: string
  paneRole?: 'main' | 'sub'
  renderRole?: 'main-overlay' | 'sub-pane'
  rows: Row[]
  settings?: unknown
  source: 'history-page-kline-chart-pane-frame-v2' | 'kline-chart-render-pane-frame-v2' | 'realtime-page-kline-chart-pane-frame-v2'
}

export type KLineChartHistoryFrame = {
  alignment: KLineChartFrameAlignment
  key: string
  mainRows: KLineData[]
  pageIndex: number
  period: string
  source: 'history-page-kline-chart-frame-v2'
  symbol: string
  panes: Record<string, KLineChartPaneFrame>
}
