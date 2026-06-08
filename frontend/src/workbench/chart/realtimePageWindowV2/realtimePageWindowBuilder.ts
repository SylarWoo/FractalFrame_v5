import type { Mt5RealtimeWindowTick, StoreV6RealtimePageWindow, StoreV6RealtimePageWindowRequest } from './realtimePageWindowTypes'
import { resolveTimeAlignedTradingProfile } from '../pagePartition/timeAligned/timeAlignedTradingProfile'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6PagePartitionItem } from '../pagePartition/pagePartitionBuilder'
import { requestRealtimeWindowIndicatorsV2 } from '../indicatorRequestV2'
import {
  floorToTradingDayBoundarySeconds,
} from '../pagePartition/timeAligned/tradingDayBoundary'
import { queryMt5Rates } from '../../../services/mt5/mt5SymbolsApi'
import type { StoreV6QueryRow } from '../../../services/mt5/mt5SymbolsApi'

const shanghaiOffsetSeconds = 8 * 60 * 60
const daySeconds = 24 * 60 * 60
const m5Seconds = 5 * 60
const sessionOpenSeconds = 6 * 60 * 60
const boundaryOffsetSeconds = sessionOpenSeconds - shanghaiOffsetSeconds
const realtimeStableCacheStorageKey = 'fractalframe:klinechart-v2:realtimeStableWindow:v1'
const maxCachedRealtimeRows = 10_000

type PersistedRealtimeStableWindow = {
  period: string
  savedAt: string
  sessionTimeFrom: number
  sessionTimeTo: number | null
  stableRows: StoreV6WindowKLine[]
  symbol: string
  tailRow: StoreV6WindowKLine | null
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function realtimeCacheKey(symbol: string, period: string, sessionTimeFrom: number | null, sessionTimeTo: number | null) {
  return `${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}:${sessionTimeFrom ?? 'none'}:${sessionTimeTo ?? 'open'}`
}

function resolvePeriodSeconds(period: string) {
  const normalized = period.trim().toUpperCase()
  if (normalized === 'M5') return m5Seconds
  if (normalized === 'M1') return 60
  if (/^M\d+$/.test(normalized)) return Number(normalized.slice(1)) * 60 || 60
  return 60
}

function normalizeTimeframe(period: string) {
  const value = period.trim().toUpperCase()
  if (value === '1M' || value === 'M1') return 'M1'
  if (value === 'MN' || value === 'MN1') return 'MN1'
  if (/^\d+M$/.test(value)) return `M${value.slice(0, -1)}`
  if (/^\d+H$/.test(value)) return `H${value.slice(0, -1)}`
  return value
}

function estimateTurnover(high: number, low: number, close: number, volume: number) {
  const typicalPrice = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : close
  return Number.isFinite(typicalPrice) && Number.isFinite(volume) ? typicalPrice * volume : 0
}

function createRealtimeBarKey(symbol: string, period: string, time: number) {
  return `${symbol.trim()}|${normalizeTimeframe(period)}|${Math.floor(time)}`
}

function normalizeMt5RateRows(rows: StoreV6QueryRow[] | null | undefined, request: {
  period: string
  sessionTimeFrom: number
  sessionTimeTo: number | null
  symbol: string
}) {
  const byTime = new Map<number, StoreV6WindowKLine>()
  ;(rows ?? []).forEach((row) => {
    const time = Number(row.time ?? row.openTime ?? row.timestamp)
    const open = Number(row.open)
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    const volume = Number(row.volume ?? 0)
    if (![time, open, high, low, close, volume].every(Number.isFinite)) return
    if (time < request.sessionTimeFrom) return
    if (request.sessionTimeTo != null && time > request.sessionTimeTo) return
    byTime.set(time, {
      barKey: typeof row.barKey === 'string' && row.barKey ? row.barKey : createRealtimeBarKey(request.symbol, request.period, time),
      close,
      globalIndex: typeof row.globalIndex === 'number' && Number.isFinite(row.globalIndex) ? Math.round(row.globalIndex) : null,
      high,
      low,
      open,
      period: normalizeTimeframe(request.period),
      source: 'mt5-realtime-window-v2',
      symbol: request.symbol,
      time,
      timestamp: time * 1000,
      turnover: estimateTurnover(high, low, close, volume),
      volume,
    })
  })
  return [...byTime.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}

function normalizeSymbol(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase()
}

function splitRealtimeRows(rows: StoreV6WindowKLine[]) {
  const normalized = mergeRealtimeRows([], rows).slice(-maxCachedRealtimeRows)
  const tailRow = normalized[normalized.length - 1] ?? null
  const stableRows = tailRow ? normalized.slice(0, -1) : normalized
  return { stableRows, tailRow }
}

function combineRealtimeRows(stableRows: StoreV6WindowKLine[], tailRow: StoreV6WindowKLine | null) {
  return tailRow ? [...stableRows, tailRow] : stableRows
}

function stableRowsKey(rows: StoreV6WindowKLine[]) {
  if (!rows.length) return 'stable-empty'
  return `stable:${rows[0]?.time ?? 'none'}:${rows[rows.length - 1]?.time ?? 'none'}:${rows.length}`
}

function tailRowKey(row: StoreV6WindowKLine | null) {
  if (!row) return 'tail-empty'
  return `tail:${row.time}:${row.open}:${row.high}:${row.low}:${row.close}:${row.volume ?? 0}`
}

function readRealtimeStableCache() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(realtimeStableCacheStorageKey) || '{}') as Record<string, PersistedRealtimeStableWindow>
  } catch {
    return {}
  }
}

function writeRealtimeStableCache(cache: Record<string, PersistedRealtimeStableWindow>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(realtimeStableCacheStorageKey, JSON.stringify(cache))
  } catch {
    // Local realtime cache is an optimization only.
  }
}

function readCachedRealtimeRows(options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}) {
  if (options.sessionTimeFrom == null) return { stableRows: [], tailRow: null }
  const cached = readRealtimeStableCache()[realtimeCacheKey(options.symbol, options.period, options.sessionTimeFrom, options.sessionTimeTo)]
  if (!cached) return { stableRows: [], tailRow: null }
  if (
    normalizeSymbol(cached.symbol) !== normalizeSymbol(options.symbol) ||
    cached.period.trim().toUpperCase() !== options.period.trim().toUpperCase() ||
    cached.sessionTimeFrom !== options.sessionTimeFrom ||
    cached.sessionTimeTo !== options.sessionTimeTo
  ) {
    return { stableRows: [], tailRow: null }
  }
  return splitRealtimeRows(combineRealtimeRows(cached.stableRows ?? [], cached.tailRow ?? null))
}

function writeCachedRealtimeRows(window: StoreV6RealtimePageWindow) {
  if (window.sessionTimeFrom == null) return
  const cache = readRealtimeStableCache()
  cache[realtimeCacheKey(window.symbol, window.period, window.sessionTimeFrom, window.sessionTimeTo)] = {
    period: window.period,
    savedAt: new Date().toISOString(),
    sessionTimeFrom: window.sessionTimeFrom,
    sessionTimeTo: window.sessionTimeTo,
    stableRows: window.stableRows,
    symbol: window.symbol,
    tailRow: window.tailRow,
  }
  writeRealtimeStableCache(cache)
}

function resolveTickLast(tick: Mt5RealtimeWindowTick) {
  if (typeof tick.bid === 'number' && Number.isFinite(tick.bid)) return tick.bid
  if (typeof tick.last === 'number' && Number.isFinite(tick.last)) return tick.last
  if (typeof tick.bid === 'number' && typeof tick.ask === 'number') return (tick.bid + tick.ask) / 2
  return tick.ask
}

function resolveTickTimestampMs(tick: Mt5RealtimeWindowTick) {
  if (typeof tick.timeMsc === 'number' && Number.isFinite(tick.timeMsc)) {
    return tick.timeMsc < 1_000_000_000_000 ? tick.timeMsc * 1000 : tick.timeMsc
  }
  if (typeof tick.time === 'number' && Number.isFinite(tick.time)) {
    return tick.time < 1_000_000_000_000 ? tick.time * 1000 : tick.time
  }
  return Date.now()
}

function resolvePeriodStartSeconds(timestampMs: number, periodSeconds: number) {
  const periodMs = periodSeconds * 1000
  return Math.floor(timestampMs / periodMs) * periodSeconds
}

function mergeRealtimeRows(rows: StoreV6WindowKLine[], next: StoreV6WindowKLine[]) {
  const byTime = new Map<number, StoreV6WindowKLine>()
  rows.forEach((row) => {
    if (Number.isFinite(row.time)) byTime.set(Number(row.time), row)
  })
  next.forEach((row) => {
    if (Number.isFinite(row.time)) byTime.set(Number(row.time), row)
  })
  return [...byTime.values()].sort((left, right) => Number(left.timestamp) - Number(right.timestamp))
}

function mergeRealtimeTickRow(rows: StoreV6WindowKLine[], row: StoreV6WindowKLine) {
  const latest = rows[rows.length - 1]
  if (!latest) return [row]
  const latestTime = Number(latest.time)
  const rowTime = Number(row.time)
  if (Number.isFinite(latestTime) && Number.isFinite(rowTime)) {
    if (rowTime === latestTime) {
      const nextRows = rows.slice()
      nextRows[nextRows.length - 1] = row
      return nextRows
    }
    if (rowTime > latestTime) return [...rows, row]
  }
  return mergeRealtimeRows(rows, [row])
}

function sameRealtimeRow(left: StoreV6WindowKLine | undefined, right: StoreV6WindowKLine) {
  if (!left) return false
  return Number(left.time) === Number(right.time) &&
    Number(left.open) === Number(right.open) &&
    Number(left.high) === Number(right.high) &&
    Number(left.low) === Number(right.low) &&
    Number(left.close) === Number(right.close) &&
    Number(left.volume ?? 0) === Number(right.volume ?? 0)
}

function realtimeWindowBaseKey(key: string) {
  return key.split(':tick:')[0].split(':mt5:')[0]
}

function createIndicatorRequestSignature(requests: StoreV6RealtimePageWindowRequest['indicatorRequests']) {
  if (!requests || requests.length === 0) return 'no-indicators'
  return requests
    .map((request) => `${request.id}:${request.enabled === false ? 'off' : 'on'}:${request.paneId ?? ''}:${JSON.stringify(request.params ?? null)}`)
    .join('|')
}

function shanghaiWeekday(seconds: number) {
  return new Date((seconds + shanghaiOffsetSeconds) * 1000).getUTCDay()
}

function isWeekendTradingBoundary(boundary: number) {
  const weekday = shanghaiWeekday(boundary)
  return weekday === 0 || weekday === 6
}

function tradingBoundaryDayNumber(seconds: number) {
  return Math.floor((seconds - boundaryOffsetSeconds) / daySeconds)
}

function tradingBoundaryFromDayNumber(dayNumber: number) {
  return dayNumber * daySeconds + boundaryOffsetSeconds
}

function nextOpenBoundaryAfter(boundary: number, options: { skipWeekends: boolean }) {
  let dayNumber = tradingBoundaryDayNumber(boundary) + 1
  let next = tradingBoundaryFromDayNumber(dayNumber)
  while (options.skipWeekends && isWeekendTradingBoundary(next)) {
    dayNumber += 1
    next = tradingBoundaryFromDayNumber(dayNumber)
  }
  return next
}

export function resolveNextM5RealtimeSessionStartSeconds(lastTime: number | null, symbol?: string | null) {
  if (lastTime == null) return null
  const tradingProfile = resolveTimeAlignedTradingProfile(symbol)
  const skipWeekends = tradingProfile.weekendClosed
  const last = Math.floor(lastTime)
  const currentBoundary = tradingBoundaryFromDayNumber(tradingBoundaryDayNumber(last))
  if (skipWeekends && isWeekendTradingBoundary(currentBoundary)) return nextOpenBoundaryAfter(currentBoundary, { skipWeekends })

  const next = last + m5Seconds
  if (tradingProfile.dailyMaintenance) {
    const closeSeconds = tradingProfile.dailyMaintenance.closeHourShanghai * 60 * 60 + tradingProfile.dailyMaintenance.closeMinuteShanghai * 60
    const sessionClose = currentBoundary + (closeSeconds - sessionOpenSeconds + daySeconds)
    if (next >= sessionClose) return nextOpenBoundaryAfter(currentBoundary, { skipWeekends })
  }
  return next
}

export function resolveActiveM5RealtimeSessionStartSeconds(latestTime: number | null, symbol?: string | null) {
  if (latestTime == null) return null
  const tradingProfile = resolveTimeAlignedTradingProfile(symbol)
  return floorToTradingDayBoundarySeconds(Math.floor(latestTime), {
    boundaryHourShanghai: tradingProfile.boundaryHourShanghai,
    boundaryMinuteShanghai: tradingProfile.boundaryMinuteShanghai,
    windowDays: 1,
  }, { skipWeekends: tradingProfile.weekendClosed })
}

function resolveRealtimeSessionStart(request: StoreV6RealtimePageWindowRequest) {
  const latest = finiteNumber(request.latestTime)
  if (request.period.trim().toUpperCase() === 'M5' && latest != null) return resolveActiveM5RealtimeSessionStartSeconds(latest, request.symbol)
  const requested = finiteNumber(request.sessionTimeFrom)
  if (request.period.trim().toUpperCase() === 'M5') return resolveNextM5RealtimeSessionStartSeconds(requested, request.symbol)
  const periodSeconds = resolvePeriodSeconds(request.period)
  return requested == null ? null : Math.floor(requested) + periodSeconds
}

function createRealtimePage(options: {
  period: string
  sessionTimeFrom: number
  sessionTimeTo: number | null
}): StoreV6PagePartitionItem {
  return {
    fromGlobalIndex: null,
    index: 0,
    limit: 10_000,
    pageType: 'live',
    realtime: true,
    rows: null,
    timeFrom: options.sessionTimeFrom,
    timeTo: options.sessionTimeTo,
    toGlobalIndex: null,
  }
}

export function buildStoreV6RealtimePageWindow(
  request: StoreV6RealtimePageWindowRequest,
): StoreV6RealtimePageWindow | null {
  if (!request.enabled) return null
  const sessionTimeFrom = resolveRealtimeSessionStart(request)
  const sessionTimeTo = finiteNumber(request.sessionTimeTo)
  const cachedRows = readCachedRealtimeRows({
    period: request.period,
    sessionTimeFrom,
    sessionTimeTo,
    symbol: request.symbol,
  })
  const stableRows = cachedRows.stableRows
  const tailRow = cachedRows.tailRow
  const activeRows = combineRealtimeRows(stableRows, tailRow)
  const indicators = {}
  const indicatorRequests = request.indicatorRequests ?? request.indicatorRuntime?.list() ?? []
  const indicatorSignature = createIndicatorRequestSignature(indicatorRequests)
  return {
    activeRows,
    indicatorRequests,
    indicators,
    key: `realtime-window-v2:${request.symbol}:${request.period}:${sessionTimeFrom ?? 'none'}:${sessionTimeTo ?? 'none'}:${indicatorSignature}:${stableRowsKey(stableRows)}:${tailRowKey(tailRow)}`,
    period: request.period,
    renderData: {
      indicators,
      klineRows: activeRows,
    },
    sessionTimeFrom,
    sessionTimeTo,
    source: 'store-v6-realtime-page-window-v2',
    stableRows,
    status: activeRows.length ? 'ready' : 'closed-empty',
    symbol: request.symbol,
    tailRow,
  }
}

export async function requestStoreV6RealtimePageWindow(
  request: StoreV6RealtimePageWindowRequest,
): Promise<StoreV6RealtimePageWindow | null> {
  const empty = buildStoreV6RealtimePageWindow(request)
  if (!empty || empty.sessionTimeFrom == null) return empty
  const payload = await queryMt5Rates({
    limit: createRealtimePage({
      period: request.period,
      sessionTimeFrom: empty.sessionTimeFrom,
      sessionTimeTo: empty.sessionTimeTo,
    }).limit,
    symbol: request.symbol,
    timeframe: normalizeTimeframe(request.period),
    timeFrom: empty.sessionTimeFrom,
    timeTo: empty.sessionTimeTo ?? undefined,
  })
  const activeRows = normalizeMt5RateRows(payload.rows, {
    period: request.period,
    sessionTimeFrom: empty.sessionTimeFrom,
    sessionTimeTo: empty.sessionTimeTo,
    symbol: request.symbol,
  })
  const { stableRows, tailRow } = splitRealtimeRows(activeRows)
  const composedRows = combineRealtimeRows(stableRows, tailRow)
  const indicators = await requestRealtimeWindowIndicatorsV2({
    activeRows: composedRows,
    historyRows: request.historyRows,
    period: request.period,
    registry: request.indicatorRegistry,
    requests: empty.indicatorRequests,
    runtime: request.indicatorRuntime,
    sessionTimeFrom: empty.sessionTimeFrom,
    sessionTimeTo: empty.sessionTimeTo,
    symbol: request.symbol,
  })
  const nextWindow: StoreV6RealtimePageWindow = {
    ...empty,
    activeRows: composedRows,
    indicators,
    key: `${realtimeWindowBaseKey(empty.key)}:mt5:${stableRowsKey(stableRows)}:${tailRowKey(tailRow)}`,
    renderData: {
      indicators,
      klineRows: composedRows,
    },
    stableRows,
    status: composedRows.length ? 'ready' : 'closed-empty',
    tailRow,
  }
  writeCachedRealtimeRows(nextWindow)
  return nextWindow
}

export function mergeMt5RealtimeTickIntoWindow(
  window: StoreV6RealtimePageWindow,
  tick: Mt5RealtimeWindowTick,
): StoreV6RealtimePageWindow {
  if (normalizeSymbol(tick.symbol) !== normalizeSymbol(window.symbol)) return window
  if (window.sessionTimeFrom == null) return window
  const last = resolveTickLast(tick)
  if (typeof last !== 'number' || !Number.isFinite(last)) return window
  const periodSeconds = resolvePeriodSeconds(window.period)
  const tickTime = resolvePeriodStartSeconds(resolveTickTimestampMs(tick), periodSeconds)
  if (!Number.isFinite(tickTime) || tickTime < window.sessionTimeFrom) return window
  if (window.sessionTimeTo != null && tickTime > window.sessionTimeTo) return window
  const latest = window.activeRows[window.activeRows.length - 1]
  const sameBar = latest && Number(latest.time) === tickTime
  const volume = typeof tick.volume === 'number' && Number.isFinite(tick.volume)
    ? Math.max(0, tick.volume)
    : sameBar
      ? Number(latest.volume ?? 0)
      : 0
  const open = sameBar ? Number(latest.open) : Number(latest?.close ?? last)
  const high = sameBar ? Math.max(Number(latest.high), last) : Math.max(open, last)
  const low = sameBar ? Math.min(Number(latest.low), last) : Math.min(open, last)
  const row: StoreV6WindowKLine = {
    barKey: createRealtimeBarKey(window.symbol, window.period, tickTime),
    close: last,
    globalIndex: sameBar ? latest.globalIndex : null,
    high,
    low,
    open,
    period: normalizeTimeframe(window.period),
    source: 'mt5-realtime-window-v2',
    symbol: window.symbol,
    time: tickTime,
    timestamp: tickTime * 1000,
    turnover: estimateTurnover(high, low, last, volume),
    volume,
  }
  if (sameRealtimeRow(latest, row)) return window
  const activeRows = mergeRealtimeTickRow(window.activeRows, row)
  const { stableRows, tailRow } = splitRealtimeRows(activeRows)
  const composedRows = combineRealtimeRows(stableRows, tailRow)
  const nextWindow: StoreV6RealtimePageWindow = {
    ...window,
    activeRows: composedRows,
    key: `${realtimeWindowBaseKey(window.key)}:tick:${stableRowsKey(stableRows)}:${tailRowKey(tailRow)}`,
    renderData: {
      indicators: window.indicators,
      klineRows: composedRows,
    },
    stableRows,
    status: composedRows.length ? 'ready' : window.status,
    tailRow,
  }
  writeCachedRealtimeRows(nextWindow)
  return nextWindow
}
