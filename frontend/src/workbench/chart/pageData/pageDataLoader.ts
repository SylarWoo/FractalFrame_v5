import type { KLineData } from 'klinecharts'
import { loadStoreV6KLineData } from '../../../datafeed/storeV6KLineDatafeed'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import { mergeKLineData } from '../chartCoreDataUtils'
import { createPageDataKey, normalizePageDataBars } from './pageDataKey'
import { writePageDataPackage } from './pageDataCache'
import type { PageDataPackage, PageDataPackageRequest } from './pageDataTypes'

export const defaultHistoricalPageWarmupRows = 1_200
export const defaultHistoricalPageLookaheadRows = 300

function resolveDisplayOffset(warmupRows: KLineData[], calculationRows: KLineData[], displayRows: KLineData[]) {
  const firstDisplayTimestamp = Number(displayRows[0]?.timestamp)
  if (Number.isFinite(firstDisplayTimestamp)) {
    const index = calculationRows.findIndex((row) => Number(row.timestamp) === firstDisplayTimestamp)
    if (index >= 0) return index
  }
  return warmupRows.length
}

export async function loadPageDataPackage(request: PageDataPackageRequest): Promise<PageDataPackage> {
  const limit = Math.max(1, Math.round(Number(request.rows ?? 0)))
  const periodSeconds = resolvePeriodSeconds(request.period)
  const indexFrom = typeof request.fromGlobalIndex === 'number' && Number.isFinite(request.fromGlobalIndex)
    ? request.fromGlobalIndex
    : undefined
  const indexTo = typeof request.toGlobalIndex === 'number' && Number.isFinite(request.toGlobalIndex)
    ? request.toGlobalIndex
    : undefined
  const displayRows = await loadStoreV6KLineData({
    indexFrom,
    indexTo,
    symbol: request.symbol,
    period: request.period,
    limit,
    timeFrom: indexFrom == null && typeof request.timeFrom === 'number' && Number.isFinite(request.timeFrom) ? request.timeFrom : undefined,
    timeTo: typeof request.timeTo === 'number' && Number.isFinite(request.timeTo) ? request.timeTo : undefined,
  })
  const first = displayRows[0]
  const last = displayRows[displayRows.length - 1]
  const warmupLimit = Math.max(0, Math.round(request.warmupRows ?? defaultHistoricalPageWarmupRows))
  const lookaheadLimit = Math.max(0, Math.round(request.lookaheadRows ?? defaultHistoricalPageLookaheadRows))
  const warmupTimeTo = typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) - 1 : null
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
  const key = createPageDataKey({
    displayRows,
    pageIndex: request.pageIndex,
    period: request.period,
    realtime: request.realtime,
    symbol: request.symbol,
  })
  return writePageDataPackage({
    calculatedAt: undefined,
    calculationRows: normalizePageDataBars(calculationRows, request.symbol, request.period),
    displayOffset: resolveDisplayOffset(warmupRows, calculationRows, displayRows),
    displayRows: normalizePageDataBars(displayRows, request.symbol, request.period),
    indicatorTables: {},
    key,
    lookaheadRows: normalizePageDataBars(lookaheadRows, request.symbol, request.period),
    pageIndex: request.pageIndex,
    period: request.period.trim().toUpperCase(),
    realtime: request.realtime,
    status: 'loading',
    symbol: request.symbol,
    warmupRows: normalizePageDataBars(warmupRows, request.symbol, request.period),
  })
}
