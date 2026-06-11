import type { KLineData } from 'klinecharts'
import { createPageDataSliceFromDisplayRows } from '../../pageData/pageDataProvider'
import { createChartPageWindow } from './chartPageWindow'

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
