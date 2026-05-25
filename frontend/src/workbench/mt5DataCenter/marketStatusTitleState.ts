import type { Mt5MarketStatus, Mt5RealtimeTick, Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { readJson, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'

export const marketStatusTitleChangedEvent = workbenchEvents.marketStatusTitleChanged

export type MarketStatusTitleSnapshot = {
  savedAt: string
  status: Mt5MarketStatus
  symbol: string
}

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

function isMinuteInSessionRange(range: string, currentMinute: number) {
  const [rawStart, rawEnd] = range.split('-')
  if (!rawStart || !rawEnd) return false
  const start = parseSessionMinute(rawStart)
  const end = parseSessionMinute(rawEnd)
  if (start == null || end == null) return false
  if (start === 0 && end === 0) return true
  if (start < end) return currentMinute >= start && currentMinute < end
  return currentMinute >= start || currentMinute < end
}

function isNowInsideTradeSession(row: Mt5SymbolRow, now = new Date()) {
  const tradeSessions = row.sessions?.trade
  if (!Array.isArray(tradeSessions)) return null
  const daySessions = tradeSessions[now.getUTCDay()]
  if (!daySessions || !daySessions.trim()) return false
  const currentMinute = now.getUTCHours() * 60 + now.getUTCMinutes()
  return daySessions.split(',').some((range) => isMinuteInSessionRange(range.trim(), currentMinute))
}

export function readMarketStatusTitleSnapshot(symbol: string): MarketStatusTitleSnapshot | null {
  const key = normalizeSymbol(symbol)
  if (!key) return null
  const snapshots = readJson<Record<string, MarketStatusTitleSnapshot>>(storageKeys.marketStatusTitleSnapshots, {})
  const snapshot = snapshots[key]
  return snapshot?.status ? snapshot : null
}

export function saveMarketStatusTitleSnapshot(symbol: string, status: Mt5MarketStatus | null | undefined) {
  const key = normalizeSymbol(symbol)
  if (!key || !status) return
  const snapshots = readJson<Record<string, MarketStatusTitleSnapshot>>(storageKeys.marketStatusTitleSnapshots, {})
  const written = writeJson(storageKeys.marketStatusTitleSnapshots, {
    ...snapshots,
    [key]: {
      savedAt: new Date().toISOString(),
      status,
      symbol,
    },
  })
  if (written) dispatchWorkbenchEvent(marketStatusTitleChangedEvent)
}

export function saveMarketStatusTitleSnapshotFromSymbolSession(row: Mt5SymbolRow) {
  if (!row.symbol) return
  const sessionOpen = isNowInsideTradeSession(row)
  if (sessionOpen == null) return
  const nowSeconds = Math.floor(Date.now() / 1000)
  saveMarketStatusTitleSnapshot(row.symbol, {
    status: sessionOpen ? 'open' : 'closed',
    label: sessionOpen ? '\u5f00\u5e02' : '\u4f11\u5e02',
    serverTime: nowSeconds,
    serverTimeIso: new Date(nowSeconds * 1000).toISOString().replace('.000Z', 'Z'),
    reason: 'session_schedule',
  })
}

function resolveTickTimeSeconds(tick: Mt5RealtimeTick) {
  if (typeof tick.timeMsc === 'number' && Number.isFinite(tick.timeMsc)) {
    return Math.floor(tick.timeMsc / 1000)
  }
  if (typeof tick.time === 'number' && Number.isFinite(tick.time)) {
    return Math.floor(tick.time > 10_000_000_000 ? tick.time / 1000 : tick.time)
  }
  const publishedAt = typeof tick.publishedAt === 'string' ? Date.parse(tick.publishedAt) : Number.NaN
  return Number.isFinite(publishedAt) ? Math.floor(publishedAt / 1000) : Math.floor(Date.now() / 1000)
}

export function saveMarketStatusTitleSnapshotFromRealtimeTick(tick: Mt5RealtimeTick) {
  if (!tick.symbol) return
  if (readMarketStatusTitleSnapshot(tick.symbol)?.status?.reason === 'session_schedule') return

  const tickSeconds = resolveTickTimeSeconds(tick)
  saveMarketStatusTitleSnapshot(tick.symbol, {
    status: 'open',
    label: '\u5f00\u5e02',
    lastTickTime: tickSeconds,
    lastTickTimeMsc: tickSeconds * 1000,
    tickAgeSeconds: Math.max(0, Math.floor(Date.now() / 1000) - tickSeconds),
    reason: 'realtime_tick',
  })
}
