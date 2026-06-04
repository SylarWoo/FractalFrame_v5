import type { Mt5RealtimeTick, Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { readJson, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'

export const marketStatusTitleChangedEvent = workbenchEvents.marketStatusTitleChanged

export type MarketStatusTitleSnapshot = {
  savedAt: string
  sessions?: Mt5SymbolRow['sessions']
  status: {
    label: string
    lastTickTime?: number | null
    lastTickTimeMsc?: number | null
    nextCheckAt?: string | null
    reason: 'quote_tick' | 'session_schedule'
    status: 'open' | 'closed'
    tickAgeSeconds?: number | null
  }
  symbol: string
}

type SessionRange = {
  endMinute: number
  startMinute: number
}

const minutesPerDay = 24 * 60
const minutesPerWeek = 7 * minutesPerDay
const freshQuoteTickSeconds = 180

type RealtimeSnapshot = {
  ticks?: Record<string, Mt5RealtimeTick>
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
}

function resolveTickTimeMsc(tick: Mt5RealtimeTick) {
  if (typeof tick.timeMsc === 'number' && Number.isFinite(tick.timeMsc)) {
    return tick.timeMsc < 1_000_000_000_000 ? tick.timeMsc * 1000 : tick.timeMsc
  }
  if (typeof tick.time === 'number' && Number.isFinite(tick.time)) {
    return tick.time < 1_000_000_000_000 ? tick.time * 1000 : tick.time
  }
  const publishedAt = typeof tick.publishedAt === 'string' ? Date.parse(tick.publishedAt) : Number.NaN
  return Number.isFinite(publishedAt) ? publishedAt : null
}

function readFreshQuoteStatus(symbol: string, now = new Date()): MarketStatusTitleSnapshot['status'] | null {
  const key = normalizeSymbol(symbol)
  if (!key) return null
  const snapshot = readJson<RealtimeSnapshot | null>(storageKeys.importCenterWatchlistRealtimeSnapshot, null)
  const tick = Object.entries(snapshot?.ticks ?? {}).find(([tickSymbol]) => normalizeSymbol(tickSymbol) === key)?.[1]
  if (!tick) return null
  const tickTimeMsc = resolveTickTimeMsc(tick)
  if (tickTimeMsc == null) return null
  const tickAgeSeconds = Math.max(0, Math.floor((now.getTime() - tickTimeMsc) / 1000))
  if (tickAgeSeconds > freshQuoteTickSeconds) return null
  return {
    label: '\u5f00\u5e02',
    lastTickTime: Math.floor(tickTimeMsc / 1000),
    lastTickTimeMsc: tickTimeMsc,
    nextCheckAt: new Date(tickTimeMsc + (freshQuoteTickSeconds + 1) * 1000).toISOString(),
    reason: 'quote_tick',
    status: 'open',
    tickAgeSeconds,
  }
}

function isExpiredStatus(status: MarketStatusTitleSnapshot['status'], now = new Date()) {
  if (!status.nextCheckAt) return false
  const nextCheckAt = Date.parse(status.nextCheckAt)
  return Number.isFinite(nextCheckAt) && nextCheckAt <= now.getTime()
}

function expiredOpenStatusAsClosed(snapshot: MarketStatusTitleSnapshot): MarketStatusTitleSnapshot | null {
  if (snapshot.status.status !== 'open') return null
  return {
    ...snapshot,
    status: {
      ...snapshot.status,
      label: '休市',
      nextCheckAt: null,
      status: 'closed',
    },
  }
}

function parseSessionMinute(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function parseSessionRange(value: string): SessionRange | null {
  const [rawStart, rawEnd] = value.split('-')
  if (!rawStart || !rawEnd) return null
  const startMinute = parseSessionMinute(rawStart)
  const endMinute = parseSessionMinute(rawEnd)
  if (startMinute == null || endMinute == null) return null
  return { endMinute, startMinute }
}

function currentUtcWeekMinute(now: Date) {
  return now.getUTCDay() * minutesPerDay + now.getUTCHours() * 60 + now.getUTCMinutes()
}

function tradeSessionIntervals(row: Mt5SymbolRow) {
  const tradeSessions = row.sessions?.trade
  if (!Array.isArray(tradeSessions)) return []

  const intervals: Array<{ end: number; start: number }> = []
  tradeSessions.forEach((daySessions, day) => {
    if (!daySessions || !daySessions.trim()) return
    daySessions.split(',').forEach((rawRange) => {
      const range = parseSessionRange(rawRange.trim())
      if (!range) return
      const dayStart = day * minutesPerDay
      if (range.startMinute === 0 && range.endMinute === 0) {
        intervals.push({ start: dayStart, end: dayStart + minutesPerDay })
        return
      }
      const start = dayStart + range.startMinute
      const end = dayStart + range.endMinute + (range.startMinute >= range.endMinute ? minutesPerDay : 0)
      intervals.push({ start, end })
    })
  })
  return intervals
}

function shiftedIntervals(row: Mt5SymbolRow) {
  const intervals = tradeSessionIntervals(row)
  return [-minutesPerWeek, 0, minutesPerWeek].flatMap((shift) => (
    intervals.map((interval) => ({ start: interval.start + shift, end: interval.end + shift }))
  ))
}

function nextBoundaryMinute(row: Mt5SymbolRow, now = new Date()) {
  const nowMinute = currentUtcWeekMinute(now)
  const intervals = shiftedIntervals(row)
  if (!intervals.length) return null

  const active = intervals.find((interval) => nowMinute >= interval.start && nowMinute < interval.end)
  if (active) return active.end

  const future = intervals
    .filter((interval) => interval.start > nowMinute)
    .sort((left, right) => left.start - right.start)[0]
  return future?.start ?? null
}

export function resolveMarketStatusFromSymbolSession(row: Mt5SymbolRow, now = new Date()) {
  const intervals = shiftedIntervals(row)
  if (!row.symbol || !intervals.length) return null
  const nowMinute = currentUtcWeekMinute(now)
  const isOpen = intervals.some((interval) => nowMinute >= interval.start && nowMinute < interval.end)
  const boundaryMinute = nextBoundaryMinute(row, now)
  const nextCheckAt = boundaryMinute == null
    ? null
    : new Date(now.getTime() + Math.max(0, boundaryMinute - nowMinute) * 60_000).toISOString()
  return {
    label: isOpen ? '开市' : '休市',
    nextCheckAt,
    reason: 'session_schedule' as const,
    status: isOpen ? 'open' as const : 'closed' as const,
  }
}

export function millisecondsUntilNextMarketSessionCheck(row: Mt5SymbolRow, now = new Date()) {
  const boundaryMinute = nextBoundaryMinute(row, now)
  if (boundaryMinute == null) return null
  const delay = (boundaryMinute - currentUtcWeekMinute(now)) * 60_000
  return Math.max(1_000, delay + 1_000)
}

export function readMarketStatusTitleSnapshot(symbol: string): MarketStatusTitleSnapshot | null {
  const key = normalizeSymbol(symbol)
  if (!key) return null
  const snapshots = readJson<Record<string, MarketStatusTitleSnapshot>>(storageKeys.marketStatusTitleSnapshots, {})
  const snapshot = snapshots[key]
  if (!snapshot?.status) return null
  if (snapshot.sessions) {
    const status = resolveMarketStatusFromSymbolSession({ symbol: snapshot.symbol || symbol, sessions: snapshot.sessions })
    const quoteStatus = readFreshQuoteStatus(snapshot.symbol || symbol)
    return status ? { ...snapshot, status: quoteStatus ?? status } : null
  }
  const quoteStatus = readFreshQuoteStatus(snapshot.symbol || symbol)
  if (quoteStatus) return { ...snapshot, status: quoteStatus }
  if (!isExpiredStatus(snapshot.status)) return snapshot
  return expiredOpenStatusAsClosed(snapshot)
}

export function saveMarketStatusTitleSnapshotFromSymbolSession(row: Mt5SymbolRow) {
  const key = normalizeSymbol(row.symbol)
  if (!key) return null
  const status = readFreshQuoteStatus(row.symbol) ?? resolveMarketStatusFromSymbolSession(row)
  if (!status) return null
  const snapshots = readJson<Record<string, MarketStatusTitleSnapshot>>(storageKeys.marketStatusTitleSnapshots, {})
  const snapshot: MarketStatusTitleSnapshot = {
    savedAt: new Date().toISOString(),
    sessions: row.sessions,
    status,
    symbol: row.symbol,
  }
  const written = writeJson(storageKeys.marketStatusTitleSnapshots, {
    ...snapshots,
    [key]: snapshot,
  })
  if (written) dispatchWorkbenchEvent(marketStatusTitleChangedEvent)
  return snapshot
}
