import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { readJson, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'

export const marketStatusTitleChangedEvent = workbenchEvents.marketStatusTitleChanged

export type MarketStatusTitleSnapshot = {
  savedAt: string
  status: {
    label: string
    nextCheckAt?: string | null
    reason: 'session_schedule'
    status: 'open' | 'closed'
  }
  symbol: string
}

type SessionRange = {
  endMinute: number
  startMinute: number
}

const minutesPerDay = 24 * 60
const minutesPerWeek = 7 * minutesPerDay

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
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
  return snapshot?.status ? snapshot : null
}

export function saveMarketStatusTitleSnapshotFromSymbolSession(row: Mt5SymbolRow) {
  const key = normalizeSymbol(row.symbol)
  if (!key) return null
  const status = resolveMarketStatusFromSymbolSession(row)
  if (!status) return null
  const snapshots = readJson<Record<string, MarketStatusTitleSnapshot>>(storageKeys.marketStatusTitleSnapshots, {})
  const snapshot: MarketStatusTitleSnapshot = {
    savedAt: new Date().toISOString(),
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
