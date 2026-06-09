import type { Mt5RealtimeWindowTick, StoreV6RealtimePageWindow, StoreV6RealtimePageWindowRequest } from './realtimePageWindowTypes'
import { resolveTimeAlignedTradingProfile } from '../pagePartition/timeAligned/timeAlignedTradingProfile'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { readStoreV6PageSlice } from '../pageSliceV2'
import type { StoreV6PagePartitionItem } from '../pagePartition/pagePartitionBuilder'
import { maxIndicatorWarmupRowsV2 } from '../indicatorRequestV2'
import { planCompositeIndicatorDependenciesV2 } from '../indicatorRequestV2/compositeIndicatorDependencyOrchestratorV2'
import { createStoreV6IndicatorRequestSignatureV2 } from '../indicatorRequestV2/indicatorRequestSignatureV2'
import { refreshRealtimeWindowIndicatorsWithStableCacheV2 } from '../indicatorRequestV2/realtimeIndicatorStableCacheV2'
import {
  floorToTradingDayBoundarySeconds,
} from '../pagePartition/timeAligned/tradingDayBoundary'
import { queryMt5Rates } from '../../../services/mt5/mt5SymbolsApi'
import type { StoreV6QueryRow } from '../../../services/mt5/mt5SymbolsApi'
import {
  combineRealtimeRowsV2,
  mergeRealtimeRowsV2,
  splitRealtimeRowsV2,
  stableRowsKeyV2,
  tailRowKeyV2,
} from './realtimePageWindowRowsV2'
import {
  readCachedRealtimeRowsV2,
  writeCachedRealtimeRowsV2,
} from './realtimeStableWindowCacheV2'

export {
  clearRealtimeStableWindowCacheV2,
  readRealtimeStableWindowSnapshotV2,
} from './realtimeStableWindowCacheV2'

const shanghaiOffsetSeconds = 8 * 60 * 60
const daySeconds = 24 * 60 * 60
const m5Seconds = 5 * 60
const sessionOpenSeconds = 6 * 60 * 60
const boundaryOffsetSeconds = sessionOpenSeconds - shanghaiOffsetSeconds

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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

function normalizeSymbol(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase()
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
  return mergeRealtimeRowsV2(rows, [row])
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

export function resolveM5RealtimeSessionStartSeconds(anchorTime: number | null, symbol?: string | null) {
  if (anchorTime == null) return null
  const tradingProfile = resolveTimeAlignedTradingProfile(symbol)
  const anchor = Math.floor(anchorTime)
  const boundary = tradingBoundaryFromDayNumber(tradingBoundaryDayNumber(anchor))
  if (anchor === boundary) {
    if (tradingProfile.weekendClosed && isWeekendTradingBoundary(boundary)) {
      return nextOpenBoundaryAfter(boundary, { skipWeekends: true })
    }
    return boundary
  }
  return resolveNextM5RealtimeSessionStartSeconds(anchor, symbol)
}

export function resolveActiveM5RealtimeSessionStartSeconds(latestTime: number | null, symbol?: string | null) {
  if (latestTime == null) return null
  const tradingProfile = resolveTimeAlignedTradingProfile(symbol)
  const latest = Math.floor(latestTime)
  const boundary = floorToTradingDayBoundarySeconds(latest, {
    boundaryHourShanghai: tradingProfile.boundaryHourShanghai,
    boundaryMinuteShanghai: tradingProfile.boundaryMinuteShanghai,
    windowDays: 1,
  }, { skipWeekends: tradingProfile.weekendClosed })
  if (boundary == null) return null
  const maintenance = tradingProfile.dailyMaintenance
  if (maintenance) {
    const closeSeconds = maintenance.closeHourShanghai * 60 * 60 + maintenance.closeMinuteShanghai * 60
    const openSeconds = tradingProfile.boundaryHourShanghai * 60 * 60 + tradingProfile.boundaryMinuteShanghai * 60
    const closeOffset = closeSeconds - openSeconds
    const normalizedCloseOffset = closeOffset <= 0 ? closeOffset + daySeconds : closeOffset
    const sessionClose = boundary + normalizedCloseOffset
    if (latest + resolvePeriodSeconds('M5') >= sessionClose) {
      return nextOpenBoundaryAfter(boundary, { skipWeekends: tradingProfile.weekendClosed })
    }
  }
  return boundary
}

function resolveRealtimeSessionStart(request: StoreV6RealtimePageWindowRequest) {
  const normalizedPeriod = request.period.trim().toUpperCase()
  const latest = finiteNumber(request.latestTime)
  if (normalizedPeriod === 'M5' && latest != null) return resolveActiveM5RealtimeSessionStartSeconds(latest, request.symbol)
  const requested = finiteNumber(request.sessionTimeFrom)
  if (normalizedPeriod === 'M5') return resolveM5RealtimeSessionStartSeconds(requested, request.symbol)
  if (normalizedPeriod === 'M30') return requested == null ? null : Math.floor(requested)
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

function createRealtimeIndicatorWarmupPage(options: {
  period: string
  timeFrom: number
}): StoreV6PagePartitionItem {
  return {
    fromGlobalIndex: null,
    index: 0,
    limit: 1,
    pageType: 'live',
    realtime: true,
    rows: 1,
    timeFrom: options.timeFrom,
    timeTo: options.timeFrom,
    toGlobalIndex: null,
  }
}

function resolveRequestedIndicatorDefinitions(request: StoreV6RealtimePageWindowRequest) {
  const registry = request.indicatorRegistry
  const requests = request.indicatorRequests ?? request.indicatorRuntime?.list() ?? []
  if (!registry || requests.length === 0) return []
  const plan = planCompositeIndicatorDependenciesV2(requests)
  return plan.computeRequests
    .filter((item) => item.enabled !== false)
    .map((item) => {
      const definition = registry.get(item.id)
      return definition ? { definition, request: item } : null
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
}

export async function resolveRealtimeIndicatorHistoryRowsV2(options: {
  activeRows: StoreV6WindowKLine[]
  request: StoreV6RealtimePageWindowRequest
}) {
  const fallbackRows = options.request.historyRows ?? []
  const firstActiveRow = options.activeRows[0]
  const firstActiveTime = finiteNumber(firstActiveRow?.time)
  const definitions = resolveRequestedIndicatorDefinitions(options.request)
  const requiredWarmupRows = maxIndicatorWarmupRowsV2({
    definitions,
    windowKind: 'realtime',
  })
  if (requiredWarmupRows <= 0 || firstActiveTime == null) return fallbackRows
  try {
    const slice = await readStoreV6PageSlice({
      mode: 'realtime-window',
      page: createRealtimeIndicatorWarmupPage({
        period: options.request.period,
        timeFrom: firstActiveTime,
      }),
      period: options.request.period,
      symbol: options.request.symbol,
      warmupRows: requiredWarmupRows,
    })
    return slice.warmupRows.length > 0 ? slice.warmupRows : fallbackRows
  } catch {
    return fallbackRows
  }
}

export function buildStoreV6RealtimePageWindow(
  request: StoreV6RealtimePageWindowRequest,
): StoreV6RealtimePageWindow | null {
  if (!request.enabled) return null
  const sessionTimeFrom = resolveRealtimeSessionStart(request)
  const sessionTimeTo = finiteNumber(request.sessionTimeTo)
  const cachedRows = readCachedRealtimeRowsV2({
    period: request.period,
    sessionTimeFrom,
    sessionTimeTo,
    symbol: request.symbol,
  })
  const stableRows = cachedRows.stableRows
  const tailRow = cachedRows.tailRow
  const activeRows = combineRealtimeRowsV2(stableRows, tailRow)
  const indicators = {}
  const indicatorRequests = request.indicatorRequests ?? request.indicatorRuntime?.list() ?? []
  const indicatorSignature = createStoreV6IndicatorRequestSignatureV2(indicatorRequests)
  return {
    activeRows,
    indicatorRequests,
    indicators,
    key: `realtime-window-v2:${request.symbol}:${request.period}:${sessionTimeFrom ?? 'none'}:${sessionTimeTo ?? 'none'}:${indicatorSignature}:${stableRowsKeyV2(stableRows)}:${tailRowKeyV2(tailRow)}`,
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
  const { stableRows, tailRow } = splitRealtimeRowsV2(activeRows)
  const composedRows = combineRealtimeRowsV2(stableRows, tailRow)
  const nextWindowWithoutIndicators: StoreV6RealtimePageWindow = {
    ...empty,
    activeRows: composedRows,
    indicatorHistoryRows: request.historyRows ?? [],
    key: `${realtimeWindowBaseKey(empty.key)}:mt5:${stableRowsKeyV2(stableRows)}:${tailRowKeyV2(tailRow)}`,
    renderData: {
      indicators: {},
      klineRows: composedRows,
    },
    stableRows,
    status: composedRows.length ? 'ready' : 'closed-empty',
    tailRow,
  }
  const indicatorHistoryRows = await resolveRealtimeIndicatorHistoryRowsV2({
    activeRows: composedRows,
    request,
  })
  const nextWindow = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
    historyRows: indicatorHistoryRows,
    registry: request.indicatorRegistry,
    requests: empty.indicatorRequests,
    runtime: request.indicatorRuntime,
    window: {
      ...nextWindowWithoutIndicators,
      indicatorHistoryRows,
    },
  })
  writeCachedRealtimeRowsV2(nextWindow)
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
  const volume = typeof tick.volume === 'number' && Number.isFinite(tick.volume) && tick.volume > 0
    ? Math.max(0, tick.volume)
    : sameBar
      ? Math.max(1, Number(latest.volume ?? 0) + 1)
      : 1
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
  const { stableRows, tailRow } = splitRealtimeRowsV2(activeRows)
  const composedRows = combineRealtimeRowsV2(stableRows, tailRow)
  const nextWindow: StoreV6RealtimePageWindow = {
    ...window,
    activeRows: composedRows,
    key: `${realtimeWindowBaseKey(window.key)}:tick:${stableRowsKeyV2(stableRows)}:${tailRowKeyV2(tailRow)}`,
    renderData: {
      indicators: window.indicators,
      klineRows: composedRows,
    },
    stableRows,
    status: composedRows.length ? 'ready' : window.status,
    tailRow,
  }
  if (!sameBar) writeCachedRealtimeRowsV2(nextWindow)
  return nextWindow
}
