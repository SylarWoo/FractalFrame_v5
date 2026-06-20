import type { KLineData } from 'klinecharts'
import { createChartPageWindow } from './chartPageWindow'
import { createPageDataSliceFromDisplayRows } from './pageDataSliceBridge'

export function createRealtimePageWindow(options: {
  pageIndex?: number
  period: string
  rows: KLineData[]
  symbol: string
}) {
  return createChartPageWindow(createPageDataSliceFromDisplayRows({
    displayRows: options.rows,
    mode: 'realtime',
    pageIndex: options.pageIndex ?? 1,
    period: options.period,
    symbol: options.symbol,
  }))
}
