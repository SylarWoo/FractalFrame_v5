import type { KLineData } from 'klinecharts'
import type { KLineChartFrameAlignment, KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'

export type KLineChartRealtimeFrame = {
  alignment: KLineChartFrameAlignment
  key: string
  mainRows: KLineData[]
  panes: Record<string, KLineChartPaneFrame>
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  source: 'realtime-page-kline-chart-frame-v2'
  symbol: string
}
