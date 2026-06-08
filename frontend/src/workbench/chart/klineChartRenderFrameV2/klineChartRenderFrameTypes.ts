import type { KLineData } from 'klinecharts'
import type { KLineChartFrameAlignment, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'

export type KLineChartRenderFrameSegment = {
  fromIndex: number
  key: string
  rows: number
  source: 'history' | 'realtime'
  timeFrom: number | null
  timeTo: number | null
  toIndex: number
}

export type KLineChartRenderFrameV2 = {
  alignment: KLineChartFrameAlignment
  key: string
  mainRows: KLineData[]
  pageIndex: number
  panes: Record<string, KLineChartPaneFrame>
  period: string
  segments: {
    history: KLineChartRenderFrameSegment
    realtime?: KLineChartRenderFrameSegment
  }
  source: 'kline-chart-render-frame-v2'
  symbol: string
}
