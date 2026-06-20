import type { KLineData } from 'klinecharts'
import { createPageDataKey, normalizePageDataBars } from '../../pageData/pageDataKey'
import type { PageDataSlice, PageDataSliceRequest } from '../../pageData/pageDataSlice'

function firstBarKey(rows: Array<{ barKey?: string }>) {
  return rows[0]?.barKey ?? null
}

function lastBarKey(rows: Array<{ barKey?: string }>) {
  return rows[rows.length - 1]?.barKey ?? null
}

export function createPageDataSliceFromDisplayRows(request: {
  displayRows: KLineData[]
  mode: PageDataSliceRequest['mode']
  pageIndex: number
  period: string
  symbol: string
}): PageDataSlice {
  const normalizedDisplayRows = normalizePageDataBars(request.displayRows, request.symbol, request.period)
  const key = createPageDataKey({
    displayRows: request.displayRows,
    pageIndex: request.pageIndex,
    period: request.period,
    realtime: request.mode === 'realtime',
    symbol: request.symbol,
  })
  return {
    calculationRows: normalizedDisplayRows,
    displayOffset: 0,
    displayRows: normalizedDisplayRows,
    key,
    lookaheadRows: [],
    mode: request.mode,
    pageIndex: request.pageIndex,
    period: request.period.trim().toUpperCase(),
    range: {
      calculationFromBarKey: firstBarKey(normalizedDisplayRows),
      calculationToBarKey: lastBarKey(normalizedDisplayRows),
      displayFromBarKey: firstBarKey(normalizedDisplayRows),
      displayToBarKey: lastBarKey(normalizedDisplayRows),
    },
    symbol: request.symbol,
    warmupRows: [],
  }
}
