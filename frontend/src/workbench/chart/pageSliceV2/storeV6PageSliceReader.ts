import { queryStoreV6Ohlcv } from '../../../services/mt5/mt5SymbolsApi'
import type { StoreV6QueryPayload, StoreV6QueryRow } from '../../../services/mt5/mt5SymbolsApi'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import { mergeKLineData } from '../chartCoreDataUtils'
import { createPageIdentity } from '../pageIdentity'
import type {
  StoreV6PageSlice,
  StoreV6PageSliceBoundary,
  StoreV6PageSliceRequest,
} from './pageSliceTypes'
import type { StoreV6WindowKLine } from './storeV6KLineTypes'

function finiteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

function normalizeStoreTimeframe(period: string) {
  return period.trim().toUpperCase()
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

function normalizeStoreV6Rows(rows: StoreV6QueryRow[], request: { period: string; symbol: string }) {
  const normalized = new Map<string, StoreV6WindowKLine>()
  const period = normalizeStoreTimeframe(request.period)
  rows.forEach((row) => {
    const time = Number(row.time)
    if (!Number.isFinite(time)) return
    const open = Number(row.open)
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    const volume = Number(row.volume ?? 0)
    if (![open, high, low, close, volume].every(Number.isFinite)) return
    const barKey = typeof row.barKey === 'string' && row.barKey
      ? row.barKey
      : `${request.symbol}|${period}|${time}`
    normalized.set(barKey, {
      barKey,
      close,
      closeTime: typeof row.closeTime === 'number' && Number.isFinite(row.closeTime) ? Math.round(row.closeTime) : undefined,
      globalIndex: typeof row.globalIndex === 'number' && Number.isFinite(row.globalIndex) ? Math.round(row.globalIndex) : null,
      high,
      low,
      open,
      period,
      sessionId: typeof row.sessionId === 'string' ? row.sessionId : undefined,
      source: 'store-v6-page-slice-v2',
      symbol: request.symbol,
      time,
      timestamp: time * 1000,
      tradingDay: typeof row.tradingDay === 'string' ? row.tradingDay : undefined,
      turnover: estimateTurnover(high, low, close, volume),
      volume,
    })
  })
  return [...normalized.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}

function resolveDisplayLimit(request: StoreV6PageSliceRequest) {
  const rows = finiteInteger(request.page.rows)
  if (rows != null && rows > 0) return rows
  const limit = finiteInteger(request.page.limit)
  if (limit != null && limit > 0) return limit
  return 100_000
}

function readPayloadBoundary(payload: StoreV6QueryPayload, fallback: StoreV6PageSliceBoundary): StoreV6PageSliceBoundary {
  return {
    ...fallback,
    actualFromGlobalIndex: finiteInteger(payload.metadata?.indexFromResult),
    actualTimeFrom: finiteInteger(payload.metadata?.timeFromResult),
    actualTimeTo: finiteInteger(payload.metadata?.timeToResult),
    actualToGlobalIndex: finiteInteger(payload.metadata?.indexToResult),
  }
}

function createRequestedBoundary(request: StoreV6PageSliceRequest): StoreV6PageSliceBoundary {
  return {
    actualFromGlobalIndex: null,
    actualTimeFrom: null,
    actualTimeTo: null,
    actualToGlobalIndex: null,
    requestedFromGlobalIndex: finiteInteger(request.page.fromGlobalIndex),
    requestedTimeFrom: finiteInteger(request.page.timeFrom),
    requestedTimeTo: finiteInteger(request.page.timeTo),
    requestedToGlobalIndex: finiteInteger(request.page.toGlobalIndex),
  }
}

async function queryStoreV6Slice(options: {
  indexFrom?: number | null
  indexTo?: number | null
  limit: number
  period: string
  symbol: string
  timeFrom?: number | null
  timeTo?: number | null
}) {
  const timeframe = normalizeStoreTimeframe(options.period)
  const isM1 = timeframe === 'M1'
  return queryStoreV6Ohlcv({
    anchor: isM1 ? undefined : 'UTC2200',
    baseTimeframe: isM1 ? undefined : 'M1',
    indexFrom: options.indexFrom ?? undefined,
    indexTo: options.indexTo ?? undefined,
    limit: options.limit,
    mode: isM1 ? 'direct' : 'aggregated',
    symbol: options.symbol,
    timeframe,
    timeFrom: options.indexFrom == null ? options.timeFrom ?? undefined : undefined,
    timeTo: options.timeTo ?? undefined,
  })
}

async function loadDisplayRows(request: StoreV6PageSliceRequest) {
  const boundary = createRequestedBoundary(request)
  const payload = await queryStoreV6Slice({
    indexFrom: boundary.requestedFromGlobalIndex,
    indexTo: boundary.requestedToGlobalIndex,
    limit: resolveDisplayLimit(request),
    period: request.period,
    symbol: request.symbol,
    timeFrom: boundary.requestedTimeFrom,
    timeTo: boundary.requestedTimeTo,
  })
  return {
    boundary: readPayloadBoundary(payload, boundary),
    rows: normalizeStoreV6Rows(payload.rows, request),
  }
}

function resolveDisplayOffset(warmupRows: StoreV6WindowKLine[], calculationRows: StoreV6WindowKLine[], displayRows: StoreV6WindowKLine[]) {
  const firstDisplayBarKey = displayRows[0]?.barKey
  if (firstDisplayBarKey) {
    const index = calculationRows.findIndex((row) => row.barKey === firstDisplayBarKey)
    if (index >= 0) return index
  }
  return warmupRows.length
}

function createSliceKey(request: StoreV6PageSliceRequest, boundary: StoreV6PageSliceBoundary) {
  return createPageIdentity({
    fromGlobalIndex: boundary.actualFromGlobalIndex ?? boundary.requestedFromGlobalIndex,
    index: request.page.index,
    timeFrom: boundary.actualTimeFrom ?? boundary.requestedTimeFrom,
    timeTo: boundary.actualTimeTo ?? boundary.requestedTimeTo,
    toGlobalIndex: boundary.actualToGlobalIndex ?? boundary.requestedToGlobalIndex,
  }, request.symbol, request.period)
    ?? [
      request.symbol.trim(),
      request.period.trim().toUpperCase(),
      request.page.index,
      boundary.requestedTimeFrom ?? '',
      boundary.requestedTimeTo ?? '',
      boundary.requestedFromGlobalIndex ?? '',
      boundary.requestedToGlobalIndex ?? '',
    ].join('|')
}

export async function readStoreV6PageSlice(request: StoreV6PageSliceRequest): Promise<StoreV6PageSlice> {
  const display = await loadDisplayRows(request)
  const first = display.rows[0]
  const last = display.rows[display.rows.length - 1]
  const warmupLimit = Math.max(0, Math.round(request.warmupRows ?? 0))
  const lookaheadLimit = Math.max(0, Math.round(request.lookaheadRows ?? 0))
  const periodSeconds = resolvePeriodSeconds(request.period)
  const warmupTimeTo = typeof first?.time === 'number' ? first.time - 1 : null
  const lookaheadTimeFrom = typeof last?.time === 'number' && Number.isFinite(periodSeconds)
    ? last.time + periodSeconds
    : null

  const [warmupPayload, lookaheadPayload] = await Promise.all([
    warmupLimit > 0 && warmupTimeTo != null
      ? queryStoreV6Slice({
        limit: warmupLimit,
        period: request.period,
        symbol: request.symbol,
        timeTo: warmupTimeTo,
      })
      : Promise.resolve(null),
    lookaheadLimit > 0 && lookaheadTimeFrom != null
      ? queryStoreV6Slice({
        limit: lookaheadLimit,
        period: request.period,
        symbol: request.symbol,
        timeFrom: lookaheadTimeFrom,
      })
      : Promise.resolve(null),
  ])

  const warmupRows = warmupPayload ? normalizeStoreV6Rows(warmupPayload.rows, request) : []
  const lookaheadRows = lookaheadPayload ? normalizeStoreV6Rows(lookaheadPayload.rows, request) : []
  const calculationRows = mergeKLineData(warmupRows, display.rows, lookaheadRows) as StoreV6WindowKLine[]

  return {
    boundary: display.boundary,
    calculationRows,
    displayOffset: resolveDisplayOffset(warmupRows, calculationRows, display.rows),
    displayRows: display.rows,
    key: createSliceKey(request, display.boundary),
    lookaheadRows,
    mode: request.mode ?? (request.page.realtime ? 'realtime-window' : 'history-page'),
    pageIndex: request.page.index,
    period: normalizeStoreTimeframe(request.period),
    source: 'store-v6-page-slice-v2',
    symbol: request.symbol,
    warmupRows,
  }
}
