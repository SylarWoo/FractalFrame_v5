import type { KLineData } from 'klinecharts'
import { loadStoreV6KLineData } from '../../../datafeed/storeV6KLineDatafeed'
import { mergeKLineData } from '../chartCoreDataUtils'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import { createPageIdentity } from '../pageIdentity'
import { createPageDataKey, normalizePageDataBars } from './pageDataKey'
import type { PageDataSlice, PageDataSliceRequest } from './pageDataSlice'

export const defaultPageWarmupRows = 0
export const defaultPageLookaheadRows = 0

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function resolveDisplayLimit(request: PageDataSliceRequest) {
  const rows = finiteNumber(request.rows)
  if (rows != null) return Math.max(1, Math.round(rows))
  return 1
}

function resolveDisplayOffset(warmupRows: KLineData[], calculationRows: KLineData[], displayRows: KLineData[]) {
  const firstDisplayTimestamp = Number(displayRows[0]?.timestamp)
  if (Number.isFinite(firstDisplayTimestamp)) {
    const index = calculationRows.findIndex((row) => Number(row.timestamp) === firstDisplayTimestamp)
    if (index >= 0) return index
  }
  return warmupRows.length
}

function firstBarKey(rows: Array<{ barKey?: string }>) {
  return rows[0]?.barKey ?? null
}

function lastBarKey(rows: Array<{ barKey?: string }>) {
  return rows[rows.length - 1]?.barKey ?? null
}

async function loadDisplayRows(request: PageDataSliceRequest) {
  if (request.displayRows) return request.displayRows

  const indexFrom = finiteNumber(request.fromGlobalIndex)
  const indexTo = finiteNumber(request.toGlobalIndex)
  const limit = resolveDisplayLimit(request)
  return loadStoreV6KLineData({
    indexFrom,
    indexTo,
    symbol: request.symbol,
    period: request.period,
    limit,
    timeFrom: indexFrom == null ? finiteNumber(request.timeFrom) : undefined,
    timeTo: finiteNumber(request.timeTo),
  })
}

export async function loadPageDataSlice(request: PageDataSliceRequest): Promise<PageDataSlice> {
  const displayRows = await loadDisplayRows(request)
  const first = displayRows[0]
  const last = displayRows[displayRows.length - 1]
  const periodSeconds = resolvePeriodSeconds(request.period)
  const warmupLimit = Math.max(0, Math.round(request.warmupRows ?? defaultPageWarmupRows))
  const lookaheadLimit = Math.max(0, Math.round(request.lookaheadRows ?? defaultPageLookaheadRows))
  const warmupTimeTo = typeof first?.timestamp === 'number'
    ? Math.floor(first.timestamp / 1000) - 1
    : null
  const lookaheadTimeFrom = typeof last?.timestamp === 'number' && Number.isFinite(periodSeconds)
    ? Math.floor(last.timestamp / 1000) + periodSeconds
    : null

  const [warmupRows, lookaheadRows] = await Promise.all([
    warmupLimit > 0 && warmupTimeTo != null
      ? loadStoreV6KLineData({ symbol: request.symbol, period: request.period, limit: warmupLimit, timeTo: warmupTimeTo })
      : Promise.resolve([]),
    lookaheadLimit > 0 && lookaheadTimeFrom != null
      ? loadStoreV6KLineData({ symbol: request.symbol, period: request.period, limit: lookaheadLimit, timeFrom: lookaheadTimeFrom })
      : Promise.resolve([]),
  ])

  const calculationRows = mergeKLineData(warmupRows, displayRows, lookaheadRows)
  const normalizedDisplayRows = normalizePageDataBars(displayRows, request.symbol, request.period)
  const normalizedWarmupRows = normalizePageDataBars(warmupRows, request.symbol, request.period)
  const normalizedLookaheadRows = normalizePageDataBars(lookaheadRows, request.symbol, request.period)
  const normalizedCalculationRows = normalizePageDataBars(calculationRows, request.symbol, request.period)
  const key = createPageDataKey({
    displayRows,
    pageIdentity: createPageIdentity({
      fromGlobalIndex: request.fromGlobalIndex,
      index: request.pageIndex,
      timeFrom: request.timeFrom,
      timeTo: request.timeTo,
      toGlobalIndex: request.toGlobalIndex,
    }, request.symbol, request.period),
    pageIndex: request.pageIndex,
    period: request.period,
    realtime: request.mode === 'realtime',
    symbol: request.symbol,
  })

  return {
    calculationRows: normalizedCalculationRows,
    displayOffset: resolveDisplayOffset(warmupRows, calculationRows, displayRows),
    displayRows: normalizedDisplayRows,
    key,
    lookaheadRows: normalizedLookaheadRows,
    mode: request.mode,
    pageIndex: request.pageIndex,
    period: request.period.trim().toUpperCase(),
    range: {
      calculationFromBarKey: firstBarKey(normalizedCalculationRows),
      calculationToBarKey: lastBarKey(normalizedCalculationRows),
      displayFromBarKey: firstBarKey(normalizedDisplayRows),
      displayToBarKey: lastBarKey(normalizedDisplayRows),
    },
    symbol: request.symbol,
    warmupRows: normalizedWarmupRows,
  }
}
