import type { KLineData } from 'klinecharts'
import { createPageDataSliceFromDisplayRows } from '../../pageData/pageDataProvider'
import { createChartPageWindow } from './chartPageWindow'

export function createHistoryPageWindow(options: {
  pageIndex?: number
  period: string
  rows: KLineData[]
  symbol: string
}) {
  return createChartPageWindow(createPageDataSliceFromDisplayRows({
    displayRows: options.rows,
    mode: 'history',
    pageIndex: options.pageIndex ?? 0,
    period: options.period,
    symbol: options.symbol,
  }))
}
