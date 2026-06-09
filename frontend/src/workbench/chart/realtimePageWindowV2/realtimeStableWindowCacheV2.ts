import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6RealtimePageWindow } from './realtimePageWindowTypes'
import { combineRealtimeRowsV2, splitRealtimeRowsV2 } from './realtimePageWindowRowsV2'

const realtimeStableCacheStorageKey = 'fractalframe:klinechart-v2:realtimeStableWindow:v1'

type PersistedRealtimeStableWindow = {
  period: string
  savedAt: string
  sessionTimeFrom: number
  sessionTimeTo: number | null
  stableRows: StoreV6WindowKLine[]
  symbol: string
  tailRow: StoreV6WindowKLine | null
}

function realtimeCacheKey(symbol: string, period: string, sessionTimeFrom: number | null, sessionTimeTo: number | null) {
  return `${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}:${sessionTimeFrom ?? 'none'}:${sessionTimeTo ?? 'open'}`
}

function normalizeSymbol(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase()
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

export function readRealtimeStableWindowSnapshotV2(options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo?: number | null
  symbol: string
}) {
  if (options.sessionTimeFrom == null) return null
  const cached = readRealtimeStableCache()[realtimeCacheKey(
    options.symbol,
    options.period,
    options.sessionTimeFrom,
    options.sessionTimeTo ?? null,
  )]
  if (!cached) return null
  if (
    normalizeSymbol(cached.symbol) !== normalizeSymbol(options.symbol) ||
    cached.period.trim().toUpperCase() !== options.period.trim().toUpperCase() ||
    cached.sessionTimeFrom !== options.sessionTimeFrom ||
    cached.sessionTimeTo !== (options.sessionTimeTo ?? null)
  ) {
    return null
  }
  return {
    savedAt: cached.savedAt,
    sessionTimeFrom: cached.sessionTimeFrom,
    sessionTimeTo: cached.sessionTimeTo,
    stableRows: cached.stableRows ?? [],
    tailRow: cached.tailRow ?? null,
  }
}

export function clearRealtimeStableWindowCacheV2() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(realtimeStableCacheStorageKey)
  } catch {
    // Local realtime cache is an optimization only.
  }
}

export function readCachedRealtimeRowsV2(options: {
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
  return splitRealtimeRowsV2(combineRealtimeRowsV2(cached.stableRows ?? [], cached.tailRow ?? null))
}

export function writeCachedRealtimeRowsV2(window: StoreV6RealtimePageWindow) {
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
