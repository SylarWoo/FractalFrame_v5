import type { StoreV6HistoryPageWindowIndicators } from '../historyPageWindowV2'
import { resolveMorganRangeBucketKey, type MorganRangeSegment } from '../morganRangeModel'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import { requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import { maxIndicatorWarmupRowsV2 } from './indicatorWarmupPlannerV2'
import type {
  StoreV6IndicatorRegistryV2,
  StoreV6IndicatorRequestRuntimeV2,
  StoreV6IndicatorRequestSpecV2,
} from './indicatorRequestTypes'

type RealtimeStableIndicatorCacheEntry = {
  indicators: StoreV6HistoryPageWindowIndicators
  key: string
}

const stableIndicatorCache = new Map<string, RealtimeStableIndicatorCacheEntry>()
const maxStableIndicatorCacheEntries = 24

function rowsKey(rows: StoreV6WindowKLine[]) {
  if (!rows.length) return 'empty'
  const first = rows[0]
  const last = rows[rows.length - 1]
  return `${first?.barKey ?? first?.time ?? 'none'}:${last?.barKey ?? last?.time ?? 'none'}:${rows.length}`
}

function requestSignature(requests: StoreV6IndicatorRequestSpecV2[] | null | undefined) {
  if (!requests || requests.length === 0) return 'no-indicators'
  return requests
    .filter((request) => request.enabled !== false)
    .map((request) => `${request.id}:${request.paneId ?? ''}:${JSON.stringify(request.params ?? null)}`)
    .join('|')
}

function historyKey(rows: StoreV6WindowKLine[] | null | undefined) {
  return rowsKey(rows ?? [])
}

function cacheKey(options: {
  historyRows?: StoreV6WindowKLine[]
  requests?: StoreV6IndicatorRequestSpecV2[]
  window: StoreV6RealtimePageWindow
}) {
  return [
    options.window.symbol.trim().toUpperCase(),
    options.window.period.trim().toUpperCase(),
    options.window.sessionTimeFrom ?? 'none',
    options.window.sessionTimeTo ?? 'open',
    historyKey(options.historyRows),
    rowsKey(options.window.stableRows),
    requestSignature(options.requests ?? options.window.indicatorRequests),
  ].join('|')
}

function trimCache() {
  while (stableIndicatorCache.size > maxStableIndicatorCacheEntries) {
    const oldest = stableIndicatorCache.keys().next().value
    if (oldest == null) break
    stableIndicatorCache.delete(oldest)
  }
}

function indicatorRowKey(row: unknown) {
  if (!row || typeof row !== 'object') return null
  const barKey = (row as { barKey?: unknown }).barKey
  if (typeof barKey === 'string') return `bar:${barKey}`
  const time = (row as { time?: unknown }).time
  if (typeof time === 'number' && Number.isFinite(time)) return `time:${time}`
  return null
}

function klineRowKey(row: StoreV6WindowKLine) {
  return row.barKey ? `bar:${row.barKey}` : `time:${row.time}`
}

function lookupIndicatorRow(map: Map<string, unknown>, row: StoreV6WindowKLine) {
  return map.get(klineRowKey(row)) ?? map.get(`time:${row.time}`)
}

function displayRowsByKey(seriesRows: unknown[] | undefined) {
  const map = new Map<string, unknown>()
  ;(seriesRows ?? []).forEach((row) => {
    const key = indicatorRowKey(row)
    if (key) map.set(key, row)
  })
  return map
}

function isMorganRangeSeriesName(name: string) {
  return name === 'MR_M5' || name === 'MR_M30'
}

function isMorganRangeM5Request(request: StoreV6IndicatorRequestSpecV2) {
  const id = request.id.trim().toUpperCase()
  return id === 'MR-M5' || id === 'MR_M5'
}

function isVwapRequest(request: StoreV6IndicatorRequestSpecV2) {
  return request.id.trim().toUpperCase() === 'VWAP'
}

function isMorganRangeM5BoundaryTail(row: StoreV6WindowKLine | null | undefined, period: string) {
  if (!row) return false
  const timestamp = typeof row.timestamp === 'number' && Number.isFinite(row.timestamp)
    ? row.timestamp
    : typeof row.time === 'number' && Number.isFinite(row.time)
      ? row.time * 1000
      : null
  const periodSeconds = resolvePeriodSeconds(period)
  if (timestamp == null || !Number.isFinite(periodSeconds) || periodSeconds <= 0) return false
  const previousTimestamp = timestamp - periodSeconds * 1000
  return resolveMorganRangeBucketKey(timestamp, 'H4_M5') !== resolveMorganRangeBucketKey(previousTimestamp, 'H4_M5')
}

function filterTailIndicatorRequests(options: {
  period: string
  requests?: StoreV6IndicatorRequestSpecV2[]
  tailRow: StoreV6WindowKLine | null
}) {
  const requests = options.requests ?? []
  return requests.filter((request) => (
    !isMorganRangeM5Request(request) ||
    isMorganRangeM5BoundaryTail(options.tailRow, options.period)
  ))
}

function resolveRequestedDefinitions(options: {
  registry?: StoreV6IndicatorRegistryV2
  requests: StoreV6IndicatorRequestSpecV2[]
}) {
  if (!options.registry) return []
  return options.requests
    .map((request) => {
      const definition = options.registry?.get(request.id)
      return definition ? { definition, request } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
}

function sliceTailHistoryRows(options: {
  historyRows?: StoreV6WindowKLine[]
  registry?: StoreV6IndicatorRegistryV2
  requests: StoreV6IndicatorRequestSpecV2[]
  stableRows: StoreV6WindowKLine[]
}) {
  const rows = [...(options.historyRows ?? []), ...options.stableRows]
  if (options.requests.some(isVwapRequest)) return rows
  const definitions = resolveRequestedDefinitions({
    registry: options.registry,
    requests: options.requests,
  })
  if (definitions.length === 0) return rows
  const requiredRows = maxIndicatorWarmupRowsV2({
    definitions,
    windowKind: 'realtime',
  })
  if (requiredRows <= 0) return []
  return rows.slice(-requiredRows)
}

function isMorganRangeSegment(row: unknown): row is MorganRangeSegment {
  if (!row || typeof row !== 'object') return false
  const segment = row as Partial<MorganRangeSegment>
  return Number.isFinite(segment.startIndex) &&
    Number.isFinite(segment.endIndex) &&
    Number.isFinite(segment.startTimestamp) &&
    Number.isFinite(segment.center) &&
    Number.isFinite(segment.upper) &&
    Number.isFinite(segment.lower)
}

function offsetMorganRangeSegments(rows: unknown[] | undefined, offset: number) {
  return (rows ?? [])
    .filter(isMorganRangeSegment)
    .map((segment) => ({
      ...segment,
      endIndex: segment.endIndex + offset,
      startIndex: segment.startIndex + offset,
    }))
}

function mergeStableAndTailIndicators(options: {
  activeRows: StoreV6WindowKLine[]
  stableIndicators: StoreV6HistoryPageWindowIndicators
  tailIndicators: StoreV6HistoryPageWindowIndicators
}) {
  const result: StoreV6HistoryPageWindowIndicators = {}
  const names = new Set([
    ...Object.keys(options.stableIndicators),
    ...Object.keys(options.tailIndicators),
  ])
  names.forEach((name) => {
    const stable = options.stableIndicators[name]
    const tail = options.tailIndicators[name]
    if (isMorganRangeSeriesName(name)) {
      const tailOffset = Math.max(0, options.activeRows.length - 1)
      const rows = [
        ...offsetMorganRangeSegments(stable?.displayRows ?? stable?.rows, 0),
        ...offsetMorganRangeSegments(tail?.displayRows ?? tail?.rows, tailOffset),
      ]
      result[name] = {
        ...(stable ?? tail),
        displayRows: rows,
        key: `${stable?.key ?? 'no-stable'}:${tail?.key ?? 'no-tail'}`,
        rows,
      }
      return
    }
    const stableRowsByKey = displayRowsByKey(stable?.displayRows ?? stable?.rows)
    const tailRowsByKey = displayRowsByKey(tail?.displayRows ?? tail?.rows)
    const rows = options.activeRows.map((row) => (
      lookupIndicatorRow(tailRowsByKey, row) ??
      lookupIndicatorRow(stableRowsByKey, row) ??
      {}
    ))
    result[name] = {
      ...(stable ?? tail),
      displayRows: rows,
      key: `${stable?.key ?? 'no-stable'}:${tail?.key ?? 'no-tail'}`,
      rows,
    }
  })
  return result
}

export async function refreshRealtimeWindowIndicatorsWithStableCacheV2(options: {
  historyRows?: StoreV6WindowKLine[]
  registry?: StoreV6IndicatorRegistryV2
  requests?: StoreV6IndicatorRequestSpecV2[]
  runtime?: StoreV6IndicatorRequestRuntimeV2
  window: StoreV6RealtimePageWindow
}): Promise<StoreV6RealtimePageWindow> {
  const requests = options.requests ?? options.window.indicatorRequests
  const key = cacheKey({
    historyRows: options.historyRows,
    requests,
    window: options.window,
  })
  let stableEntry = stableIndicatorCache.get(key) ?? null
  if (!stableEntry) {
    const stableIndicators = await requestRealtimeWindowIndicatorsV2({
      activeRows: options.window.stableRows,
      historyRows: options.historyRows,
      period: options.window.period,
      registry: options.registry,
      requests,
      runtime: options.runtime,
      sessionTimeFrom: options.window.sessionTimeFrom,
      sessionTimeTo: options.window.sessionTimeTo,
      symbol: options.window.symbol,
    })
    stableEntry = { indicators: stableIndicators, key }
    stableIndicatorCache.set(key, stableEntry)
    trimCache()
  }

  if (!options.window.tailRow) {
    return {
      ...options.window,
      indicators: stableEntry.indicators,
      renderData: {
        ...options.window.renderData,
        indicators: stableEntry.indicators,
      },
    }
  }

  const tailRequests = filterTailIndicatorRequests({
    period: options.window.period,
    requests,
    tailRow: options.window.tailRow,
  })
  const tailIndicators = tailRequests.length > 0
    ? await requestRealtimeWindowIndicatorsV2({
      activeRows: [options.window.tailRow],
      historyRows: sliceTailHistoryRows({
        historyRows: options.historyRows,
        registry: options.registry,
        requests: tailRequests,
        stableRows: options.window.stableRows,
      }),
      period: options.window.period,
      registry: options.registry,
      requests: tailRequests,
      runtime: options.runtime,
      sessionTimeFrom: options.window.sessionTimeFrom,
      sessionTimeTo: options.window.sessionTimeTo,
      symbol: options.window.symbol,
    })
    : {}
  const indicators = mergeStableAndTailIndicators({
    activeRows: options.window.activeRows,
    stableIndicators: stableEntry.indicators,
    tailIndicators,
  })
  return {
    ...options.window,
    indicators,
    renderData: {
      ...options.window.renderData,
      indicators,
    },
  }
}

export function clearRealtimeIndicatorStableCacheV2() {
  stableIndicatorCache.clear()
}
