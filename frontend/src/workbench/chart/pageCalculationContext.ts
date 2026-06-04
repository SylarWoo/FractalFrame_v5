import type { KLineData } from 'klinecharts'
import { createPageDataKey, normalizePageDataBars } from './pageData/pageDataKey'
import { pageDataPackageChangedEvent, readPageDataPackage, writePageDataPackage } from './pageData/pageDataCache'
import type { PageDataPackage } from './pageData/pageDataTypes'

export type PageCalculationContext = {
  calculationRows: KLineData[]
  displayRows: KLineData[]
  key: string
  olderWarmupRows: number
  period: string
  newerLookaheadRows: number
  pageIndex: number
  realtime: boolean
  symbol: string
}

export const pageCalculationContextChangedEvent = pageDataPackageChangedEvent

export function createPageCalculationContextKey({
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
  return createPageDataKey({ displayRows, pageIndex, period, realtime, symbol })
}

function packageToContext(entry: PageDataPackage): PageCalculationContext {
  return {
    calculationRows: entry.calculationRows,
    displayRows: entry.displayRows,
    key: entry.key,
    newerLookaheadRows: entry.lookaheadRows.length,
    olderWarmupRows: entry.warmupRows.length,
    pageIndex: entry.pageIndex,
    period: entry.period,
    realtime: entry.realtime,
    symbol: entry.symbol,
  }
}

export function writePageCalculationContext(context: Omit<PageCalculationContext, 'key'>) {
  const key = createPageCalculationContextKey({
    displayRows: context.displayRows,
    pageIndex: context.pageIndex,
    period: context.period,
    realtime: context.realtime,
    symbol: context.symbol,
  })
  writePageDataPackage({
    calculationRows: normalizePageDataBars(context.calculationRows, context.symbol, context.period),
    displayOffset: Math.max(0, context.olderWarmupRows),
    displayRows: normalizePageDataBars(context.displayRows, context.symbol, context.period),
    indicatorTables: {},
    key,
    lookaheadRows: normalizePageDataBars(context.calculationRows.slice(context.olderWarmupRows + context.displayRows.length), context.symbol, context.period),
    pageIndex: context.pageIndex,
    period: context.period,
    realtime: context.realtime,
    status: 'ready',
    symbol: context.symbol,
    warmupRows: normalizePageDataBars(context.calculationRows.slice(0, context.olderWarmupRows), context.symbol, context.period),
  })
  return key
}

export function readPageCalculationContext(key: string) {
  const entry = readPageDataPackage(key)
  return entry ? packageToContext(entry) : null
}
