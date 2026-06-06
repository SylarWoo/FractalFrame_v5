import type { KLineData } from 'klinecharts'
import { createBarKey, getKLineTimeSeconds } from './barIdentity'
import { stripFuturePlaceholders } from './chartFuturePlaceholders'
import {
  createIndicatorPageKey,
  createIndicatorSnapshotRows,
  readIndicatorPageSnapshot,
  writeIndicatorPageSnapshot,
  type IndicatorPageSnapshot,
  type IndicatorPageSnapshotRow,
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

function normalizeUniquePageIndicatorRows(rows: KLineData[], symbol: string, period: string) {
  const rowsByBarKey = new Map<string, KLineData>()
  stripFuturePlaceholders(rows).forEach((row) => {
    rowsByBarKey.set(createBarKey(symbol, period, getKLineTimeSeconds(row)), row)
  })
  return [...rowsByBarKey.values()]
}

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
  const realRows = normalizeUniquePageIndicatorRows(rows, normalizedSymbol, normalizedPeriod)
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
      return false
    }
    seen.add(barKey)
  }
  return true
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

export function createDisplayRowsSnapshotFromCalculationRows({
  calculationRows,
  createSnapshotRows,
  displayRows,
  period,
  symbol,
}: {
  calculationRows: KLineData[]
  createSnapshotRows: (realRows: KLineData[], dataList: KLineData[]) => PageIndicatorSnapshotRowsInput
  displayRows: KLineData[]
  period: string
  symbol: string
}): PageIndicatorSnapshotRowsInput {
  const normalizedPeriod = period.trim().toUpperCase()
  const normalizedSymbol = symbol.trim()
  const realCalculationRows = stripFuturePlaceholders(calculationRows)
  const realDisplayRows = stripFuturePlaceholders(displayRows)
  if (!realCalculationRows.length || !realDisplayRows.length) {
    return createSnapshotRows(realDisplayRows, displayRows)
  }

  const calculationIndexByBarKey = new Map<string, number>()
  realCalculationRows.forEach((row, index) => {
    calculationIndexByBarKey.set(createBarKey(normalizedSymbol, normalizedPeriod, getKLineTimeSeconds(row)), index)
  })

  const calculationSnapshotRows = createSnapshotRows(realCalculationRows, realCalculationRows) as Record<string, unknown>
  const displaySnapshotRows: Record<string, unknown> = {}
  Object.entries(calculationSnapshotRows).forEach(([key, value]) => {
    if (!Array.isArray(value)) {
      displaySnapshotRows[key] = value
      return
    }
    displaySnapshotRows[key] = realDisplayRows.map((row) => {
      const barKey = createBarKey(normalizedSymbol, normalizedPeriod, getKLineTimeSeconds(row))
      const calculationIndex = calculationIndexByBarKey.get(barKey)
      return calculationIndex == null ? {} : value[calculationIndex] ?? {}
    })
  })
  return displaySnapshotRows as PageIndicatorSnapshotRowsInput
}

export function mapPageIndicatorSnapshotToDataList<T>({
  dataList,
  indicator,
  pageKey,
  period,
  settingsHashKey,
  settingsHash,
  symbol,
}: {
  dataList: KLineData[]
  indicator: keyof Omit<IndicatorPageSnapshotRow, 'barKey' | 'sourceIndex' | 'time'>
  pageKey: string
  period: string
  settingsHashKey?: string
  settingsHash: string
  symbol: string
}): T[] | null {
  const normalizedPeriod = period.trim().toUpperCase()
  const normalizedSymbol = symbol.trim()
  const snapshot = readIndicatorPageSnapshot(pageKey)
  if (
    !snapshot ||
    snapshot.symbol !== normalizedSymbol ||
    snapshot.period !== normalizedPeriod ||
    snapshot.settingsHashes?.[settingsHashKey ?? indicator] !== settingsHash
  ) {
    return null
  }
  return stripFuturePlaceholders(dataList).map((row) => {
    const barKey = createBarKey(normalizedSymbol, normalizedPeriod, getKLineTimeSeconds(row))
    return (snapshot.byBarKey[barKey]?.[indicator] ?? {}) as T
  })
}
