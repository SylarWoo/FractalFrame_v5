import type { KLineData } from 'klinecharts'
import type { PageDataSlice } from '../../pageData/pageDataSlice'
import type { PageDataBarRow } from '../../pageData/pageDataTypes'

export type ChartPageWindowMode = 'history' | 'realtime'

export type ChartPageWindowBehavior = {
  acceptRealtimeTicks: boolean
  followLatest: boolean
  staticPage: boolean
}

export type ChartPageWindowMeta = {
  builtAt: string
  displayRows: number
  lookaheadRows: number
  pageKey: string
  settingsHashMap: Record<string, string>
  warmupRows: number
}

export type ChartPageWindow = {
  behavior: ChartPageWindowBehavior
  calculationRows: PageDataBarRow[]
  displayOffset: number
  displayRows: PageDataBarRow[]
  indicators: {
    byBarKey: Record<string, Record<string, unknown>>
    rows: Array<{ barKey: string; sourceIndex: number; time: number; values: Record<string, unknown> }>
  }
  key: string
  lookaheadRows: PageDataBarRow[]
  meta: ChartPageWindowMeta
  mode: ChartPageWindowMode
  pageIndex: number
  period: string
  symbol: string
  warmupRows: PageDataBarRow[]
}

export function createPageWindowKey(slice: Pick<PageDataSlice, 'mode' | 'pageIndex' | 'period' | 'range' | 'symbol'>) {
  if (slice.mode === 'realtime') {
    return `realtime:${slice.symbol}:${slice.period}`
  }
  return [
    'history',
    slice.symbol,
    slice.period,
    slice.pageIndex,
    slice.range.displayFromBarKey ?? '',
    slice.range.displayToBarKey ?? '',
  ].join(':')
}

export function createChartPageWindow(slice: PageDataSlice): ChartPageWindow {
  const staticPage = slice.mode === 'history'
  return {
    behavior: {
      acceptRealtimeTicks: slice.mode === 'realtime',
      followLatest: slice.mode === 'realtime',
      staticPage,
    },
    calculationRows: slice.calculationRows,
    displayOffset: slice.displayOffset,
    displayRows: slice.displayRows,
    indicators: {
      byBarKey: {},
      rows: slice.displayRows.map((row) => ({
        barKey: row.barKey,
        sourceIndex: row.sourceIndex,
        time: row.time,
        values: {},
      })),
    },
    key: createPageWindowKey(slice),
    lookaheadRows: slice.lookaheadRows,
    meta: {
      builtAt: new Date().toISOString(),
      displayRows: slice.displayRows.length,
      lookaheadRows: slice.lookaheadRows.length,
      pageKey: slice.key,
      settingsHashMap: {},
      warmupRows: slice.warmupRows.length,
    },
    mode: slice.mode,
    pageIndex: slice.pageIndex,
    period: slice.period,
    symbol: slice.symbol,
    warmupRows: slice.warmupRows,
  }
}

export function pageWindowDisplayRows(window: ChartPageWindow): KLineData[] {
  return window.displayRows
}
