import type { KLineData } from 'klinecharts'
import { createBarKey, getKLineTimeSeconds } from '../barIdentity'
import { stripFuturePlaceholders } from '../chartFuturePlaceholders'
import type { PageDataBarRow } from './pageDataTypes'

function normalizePeriod(period: string) {
  return period.trim().toUpperCase()
}

export function createPageDataKey({
  displayRows,
  pageIndex,
  period,
  realtime,
  symbol,
}: {
  displayRows: KLineData[]
  pageIndex: number
  period: string
  realtime: boolean
  symbol: string
}) {
  const realRows = stripFuturePlaceholders(displayRows)
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return [
    symbol.trim(),
    normalizePeriod(period),
    pageIndex,
    realtime ? 'rt' : 'hist',
    first ? getKLineTimeSeconds(first) : '',
    last ? getKLineTimeSeconds(last) : '',
    realRows.length,
  ].join('|')
}

export function normalizePageDataBars(rows: KLineData[], symbol: string, period: string): PageDataBarRow[] {
  const normalizedPeriod = normalizePeriod(period)
  return stripFuturePlaceholders(rows).map((row, sourceIndex) => {
    const time = getKLineTimeSeconds(row)
    return {
      ...row,
      barKey: createBarKey(symbol, normalizedPeriod, time),
      sourceIndex,
      time,
    }
  })
}
