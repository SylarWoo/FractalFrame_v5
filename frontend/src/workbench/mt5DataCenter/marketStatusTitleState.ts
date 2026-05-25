import type { Mt5MarketStatus, Mt5RealtimeTick } from '../../services/mt5/mt5SymbolsApi'
import { readJson, writeJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'

export const marketStatusTitleChangedEvent = workbenchEvents.marketStatusTitleChanged

export type MarketStatusTitleSnapshot = {
  savedAt: string
  status: Mt5MarketStatus
  symbol: string
}

const realtimeStatusSnapshotWriteIntervalMs = 30_000
const realtimeStatusSnapshotWrittenAt = new Map<string, number>()

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase()
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
  const key = normalizeSymbol(tick.symbol)
  const now = Date.now()
  const lastWrittenAt = realtimeStatusSnapshotWrittenAt.get(key) ?? 0
  if (now - lastWrittenAt < realtimeStatusSnapshotWriteIntervalMs) return
  realtimeStatusSnapshotWrittenAt.set(key, now)

  const tickSeconds = resolveTickTimeSeconds(tick)
  saveMarketStatusTitleSnapshot(tick.symbol, {
    status: 'open',
    label: '开市',
    lastTickTime: tickSeconds,
    lastTickTimeMsc: tickSeconds * 1000,
    tickAgeSeconds: Math.max(0, Math.floor(Date.now() / 1000) - tickSeconds),
    reason: 'realtime_tick',
  })
}
