import type { KLineData } from 'klinecharts'
import type { PageDataBarRow, PageDataPackage } from './pageDataTypes'

export type PageDataSliceMode = 'history' | 'realtime'

export type PageDataSliceRange = {
  calculationFromBarKey: string | null
  calculationToBarKey: string | null
  displayFromBarKey: string | null
  displayToBarKey: string | null
}

export type PageDataSlice = {
  calculationRows: PageDataBarRow[]
  displayOffset: number
  displayRows: PageDataBarRow[]
  key: string
  lookaheadRows: PageDataBarRow[]
  mode: PageDataSliceMode
  pageIndex: number
  period: string
  range: PageDataSliceRange
  symbol: string
  warmupRows: PageDataBarRow[]
}

export type PageDataSliceRequest = {
  displayRows?: KLineData[]
  fromGlobalIndex?: number | null
  lookaheadRows?: number
  mode: PageDataSliceMode
  pageIndex: number
  period: string
  rows?: number | null
  symbol: string
  timeFrom?: number | null
  timeTo?: number | null
  toGlobalIndex?: number | null
  warmupRows?: number
}

export type PageDataRequirement = {
  lookaheadRows: number
  warmupRows: number
}

export const emptyPageDataRequirement: PageDataRequirement = {
  lookaheadRows: 0,
  warmupRows: 0,
}

function firstBarKey(rows: PageDataBarRow[]) {
  return rows[0]?.barKey ?? null
}

function lastBarKey(rows: PageDataBarRow[]) {
  return rows[rows.length - 1]?.barKey ?? null
}

export function pageDataPackageToSlice(entry: PageDataPackage): PageDataSlice {
  return {
    calculationRows: entry.calculationRows,
    displayOffset: entry.displayOffset,
    displayRows: entry.displayRows,
    key: entry.key,
    lookaheadRows: entry.lookaheadRows,
    mode: entry.realtime ? 'realtime' : 'history',
    pageIndex: entry.pageIndex,
    period: entry.period,
    range: {
      calculationFromBarKey: firstBarKey(entry.calculationRows),
      calculationToBarKey: lastBarKey(entry.calculationRows),
      displayFromBarKey: firstBarKey(entry.displayRows),
      displayToBarKey: lastBarKey(entry.displayRows),
    },
    symbol: entry.symbol,
    warmupRows: entry.warmupRows,
  }
}
