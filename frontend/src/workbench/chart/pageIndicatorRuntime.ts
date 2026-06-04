import type { KLineData } from 'klinecharts'
import { createBarKey, getKLineTimeSeconds } from './barIdentity'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import {
  createIndicatorPageKey,
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
  type IndicatorPageSnapshot,
} from './indicatorPageSnapshotStore'

export type PageIndicatorMode = 'history' | 'jump' | 'realtime'

export type PageIndicatorRuntimeContext = {
  barKeyFrom: string | null
  barKeyTo: string | null
  mode: PageIndicatorMode
  pageIndex: number
  pageKey: string
  period: string
  rows: KLineData[]
  rowsCount: number
  symbol: string
}

export type PageIndicatorSnapshotRowsInput = Omit<
  Partial<Parameters<typeof createIndicatorSnapshotRows>[0]>,
  'period' | 'rows' | 'symbol'
>

export function createPageIndicatorRuntimeContext({
  mode,
  pageIndex,
  pageKey,
  period,
  rows,
  symbol,
}: {
  mode: PageIndicatorMode
  pageIndex: number
  pageKey?: string
  period: string
  rows: KLineData[]
  symbol: string
}): PageIndicatorRuntimeContext {
  const normalizedPeriod = period.trim().toUpperCase()
  const normalizedSymbol = symbol.trim()
  const realRows = stripFuturePlaceholders(rows)
  const first = realRows[0]
  const last = realRows[realRows.length - 1]
  return {
    barKeyFrom: first ? createBarKey(normalizedSymbol, normalizedPeriod, getKLineTimeSeconds(first)) : null,
    barKeyTo: last ? createBarKey(normalizedSymbol, normalizedPeriod, getKLineTimeSeconds(last)) : null,
    mode,
    pageIndex,
    pageKey: pageKey ?? createIndicatorPageKey({
      pageIndex,
      period: normalizedPeriod,
      realtime: mode === 'realtime',
      rows: realRows,
      symbol: normalizedSymbol,
    }),
    period: normalizedPeriod,
    rows: realRows,
    rowsCount: realRows.length,
    symbol: normalizedSymbol,
  }
}

export function assertUniquePageIndicatorBarKeys(context: PageIndicatorRuntimeContext) {
  const seen = new Set<string>()
  for (const row of context.rows) {
    const barKey = createBarKey(context.symbol, context.period, getKLineTimeSeconds(row))
    if (seen.has(barKey)) {
      throw new Error(`Duplicate page indicator barKey: ${barKey}`)
    }
    seen.add(barKey)
  }
}

export function writePageIndicatorRuntimeSnapshot({
  context,
  createSnapshotRows,
  settingsHash,
  settingsHashKey,
}: {
  context: PageIndicatorRuntimeContext
  createSnapshotRows: (realRows: KLineData[]) => PageIndicatorSnapshotRowsInput
  settingsHash: string
  settingsHashKey: string
}): IndicatorPageSnapshot {
  assertUniquePageIndicatorBarKeys(context)
  return writeIndicatorPageSnapshot({
    pageKey: context.pageKey,
    period: context.period,
    rows: createIndicatorSnapshotRows({
      period: context.period,
      rows: context.rows,
      symbol: context.symbol,
      ...createSnapshotRows(context.rows),
    }),
    settingsHash,
    settingsHashKey,
    symbol: context.symbol,
  })
}
