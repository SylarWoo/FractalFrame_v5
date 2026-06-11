import type { StoreV6WindowKLine } from '../pageSliceV2'
import type { StoreV6RealtimePageWindow } from './realtimePageWindowTypes'
import { storageKeys } from '../../persistence/storageKeys'

const realtimePageStateEndpoint = '/__fractalframe_realtime_page_state'
const realtimeStablePageStorageKey = storageKeys.realtimeStablePage
const realtimeTailRuntimeStorageKey = storageKeys.realtimeTailRuntime
const physicalRealtimeStateCache = new Map<string, unknown>()
const physicalRealtimeStateLoaded = new Set<string>()

type PersistedRealtimeStablePage = {
  period: string
  savedAt: string
  sessionTimeFrom: number
  sessionTimeTo: number | null
  stableRows: StoreV6WindowKLine[]
  symbol: string
}

type PersistedRealtimeTailRuntime = {
  period: string
  savedAt: string
  sessionTimeFrom: number
  sessionTimeTo: number | null
  symbol: string
  tailRow: StoreV6WindowKLine | null
}

type RealtimePersistenceIdentity = {
  period: string
  symbol: string
}

function realtimeCacheKey(symbol: string, period: string, sessionTimeFrom: number | null, sessionTimeTo: number | null) {
  return `${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}:${sessionTimeFrom ?? 'none'}:${sessionTimeTo ?? 'open'}`
}

function normalizeSymbol(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase()
}

function physicalRealtimeStateKey(kind: 'stable' | 'tail', options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}) {
  return [
    kind,
    normalizeSymbol(options.symbol),
    options.period.trim().toUpperCase(),
    options.sessionTimeFrom ?? 'none',
    options.sessionTimeTo ?? 'open',
  ].join(':')
}

function resolveRealtimePageStateEndpoint() {
  try {
    const origin = window.location?.origin
    return origin ? new URL(realtimePageStateEndpoint, origin).toString() : null
  } catch {
    return null
  }
}

function readPhysicalRealtimeState<T>(kind: 'stable' | 'tail', options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}) {
  if (typeof window === 'undefined' || typeof XMLHttpRequest === 'undefined' || options.sessionTimeFrom == null) return null
  const key = physicalRealtimeStateKey(kind, options)
  if (physicalRealtimeStateCache.has(key)) return physicalRealtimeStateCache.get(key) as T
  if (physicalRealtimeStateLoaded.has(key)) return null
  physicalRealtimeStateLoaded.add(key)
  try {
    const params = new URLSearchParams({
      kind,
      period: options.period,
      sessionTimeFrom: String(options.sessionTimeFrom),
      sessionTimeTo: options.sessionTimeTo == null ? 'open' : String(options.sessionTimeTo),
      symbol: options.symbol,
    })
    const xhr = new XMLHttpRequest()
    xhr.open('GET', `${realtimePageStateEndpoint}?${params.toString()}`, false)
    xhr.send()
    if (xhr.status !== 200) return null
    const response = JSON.parse(xhr.responseText) as { value?: T | null }
    if (response.value != null) physicalRealtimeStateCache.set(key, response.value)
    return response.value ?? null
  } catch {
    return null
  }
}

function writePhysicalRealtimeState(kind: 'stable' | 'tail', value: PersistedRealtimeStablePage | PersistedRealtimeTailRuntime) {
  const key = physicalRealtimeStateKey(kind, value)
  physicalRealtimeStateCache.set(key, value)
  physicalRealtimeStateLoaded.add(key)
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolveRealtimePageStateEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({
        kind,
        period: value.period,
        sessionTimeFrom: value.sessionTimeFrom,
        sessionTimeTo: value.sessionTimeTo,
        symbol: value.symbol,
        value,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {})
  } catch {
    // LocalStorage fallback below keeps recovery available outside the dev endpoint.
  }
}

function clearPhysicalRealtimeState(scope?: { period?: string | null; symbol?: string | null }) {
  for (const [key, value] of physicalRealtimeStateCache.entries()) {
    const record = value as { period?: string; symbol?: string } | null
    if (!record) continue
    if (scope?.symbol != null && normalizeSymbol(record.symbol) !== normalizeSymbol(scope.symbol)) continue
    if (scope?.period != null && record.period?.trim().toUpperCase() !== scope.period.trim().toUpperCase()) continue
    physicalRealtimeStateCache.delete(key)
  }
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return
  const endpoint = resolveRealtimePageStateEndpoint()
  if (!endpoint) return
  try {
    void fetch(endpoint, {
      body: JSON.stringify({
        period: scope?.period ?? null,
        remove: true,
        symbol: scope?.symbol ?? null,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => {})
  } catch {
    // Clearing physical files is best-effort in production builds.
  }
}

function readStorageRecord<T>(storageKey: string) {
  if (typeof window === 'undefined') return {} as Record<string, T>
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Record<string, T>
  } catch {
    return {} as Record<string, T>
  }
}

function writeStorageRecord<T>(storageKey: string, value: Record<string, T>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // Local realtime persistence is a recovery optimization only.
  }
}

function clearStorageRecord(storageKey: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey)
  } catch {
    // Local realtime persistence is a recovery optimization only.
  }
}

function readRealtimeStablePageStore() {
  return readStorageRecord<PersistedRealtimeStablePage>(realtimeStablePageStorageKey)
}

function writeRealtimeStablePageStore(value: Record<string, PersistedRealtimeStablePage>) {
  writeStorageRecord(realtimeStablePageStorageKey, value)
}

function readRealtimeTailRuntimeStore() {
  return readStorageRecord<PersistedRealtimeTailRuntime>(realtimeTailRuntimeStorageKey)
}

function writeRealtimeTailRuntimeStore(value: Record<string, PersistedRealtimeTailRuntime>) {
  writeStorageRecord(realtimeTailRuntimeStorageKey, value)
}

function matchesRealtimeIdentity(
  cached: {
    period: string
    sessionTimeFrom: number
    sessionTimeTo: number | null
    symbol: string
  },
  options: {
    period: string
    sessionTimeFrom: number | null
    sessionTimeTo: number | null
    symbol: string
  },
) {
  return options.sessionTimeFrom != null &&
    normalizeSymbol(cached.symbol) === normalizeSymbol(options.symbol) &&
    cached.period.trim().toUpperCase() === options.period.trim().toUpperCase() &&
    cached.sessionTimeFrom === options.sessionTimeFrom &&
    cached.sessionTimeTo === options.sessionTimeTo
}

function matchesRealtimeScope(
  cached: { period: string; symbol: string },
  scope: { period?: string | null; symbol?: string | null },
) {
  const scopeSymbol = scope.symbol == null ? null : normalizeSymbol(scope.symbol)
  const scopePeriod = scope.period == null ? null : scope.period.trim().toUpperCase()
  if (scopeSymbol != null && normalizeSymbol(cached.symbol) !== scopeSymbol) return false
  if (scopePeriod != null && cached.period.trim().toUpperCase() !== scopePeriod) return false
  return scopeSymbol != null || scopePeriod != null
}

function replaceScopedStorageEntry<T extends RealtimePersistenceIdentity>(
  current: Record<string, T>,
  nextKey: string,
  nextValue: T,
) {
  const next: Record<string, T> = {}
  Object.entries(current).forEach(([key, value]) => {
    if (matchesRealtimeScope(value, nextValue)) return
    next[key] = value
  })
  next[nextKey] = nextValue
  return next
}

function clearScopedStorageRecord<T extends RealtimePersistenceIdentity>(
  storageKey: string,
  scope?: { period?: string | null; symbol?: string | null },
) {
  if (!scope || (scope.symbol == null && scope.period == null)) {
    clearStorageRecord(storageKey)
    return
  }
  const current = readStorageRecord<T>(storageKey)
  const next = Object.fromEntries(Object.entries(current).filter(([, value]) => !matchesRealtimeScope(value, scope)))
  writeStorageRecord(storageKey, next)
}

function readStableRealtimePage(options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}) {
  if (options.sessionTimeFrom == null) return null
  const physical = readPhysicalRealtimeState<PersistedRealtimeStablePage>('stable', options)
  if (physical && matchesRealtimeIdentity(physical, options)) return physical
  const cached = readRealtimeStablePageStore()[realtimeCacheKey(options.symbol, options.period, options.sessionTimeFrom, options.sessionTimeTo)]
  if (!cached || !matchesRealtimeIdentity(cached, options)) return null
  return cached
}

function readTailRuntimeCache(options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}) {
  if (options.sessionTimeFrom == null) return null
  const physical = readPhysicalRealtimeState<PersistedRealtimeTailRuntime>('tail', options)
  if (physical && matchesRealtimeIdentity(physical, options)) return physical
  const cached = readRealtimeTailRuntimeStore()[realtimeCacheKey(options.symbol, options.period, options.sessionTimeFrom, options.sessionTimeTo)]
  if (!cached || !matchesRealtimeIdentity(cached, options)) return null
  return cached
}

export function readRealtimeStableWindowSnapshotV2(options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo?: number | null
  symbol: string
}) {
  const sessionTimeTo = options.sessionTimeTo ?? null
  const stablePage = readStableRealtimePage({
    period: options.period,
    sessionTimeFrom: options.sessionTimeFrom,
    sessionTimeTo,
    symbol: options.symbol,
  })
  if (!stablePage) return null
  const tailRuntime = readTailRuntimeCache({
    period: options.period,
    sessionTimeFrom: options.sessionTimeFrom,
    sessionTimeTo,
    symbol: options.symbol,
  })
  return {
    savedAt: tailRuntime?.savedAt ?? stablePage.savedAt,
    sessionTimeFrom: stablePage.sessionTimeFrom,
    sessionTimeTo: stablePage.sessionTimeTo,
    stableRows: stablePage.stableRows ?? [],
    tailRow: tailRuntime?.tailRow ?? null,
  }
}

export function clearRealtimeStableWindowCacheV2(scope?: {
  period?: string | null
  symbol?: string | null
}) {
  clearPhysicalRealtimeState(scope)
  clearScopedStorageRecord<PersistedRealtimeStablePage>(realtimeStablePageStorageKey, scope)
  clearScopedStorageRecord<PersistedRealtimeTailRuntime>(realtimeTailRuntimeStorageKey, scope)
}

export function readCachedRealtimeRowsV2(options: {
  period: string
  sessionTimeFrom: number | null
  sessionTimeTo: number | null
  symbol: string
}) {
  const stablePage = readStableRealtimePage(options)
  const tailRuntime = readTailRuntimeCache(options)
  return {
    stableRows: stablePage?.stableRows ?? [],
    tailRow: tailRuntime?.tailRow ?? null,
  }
}

export function writeRealtimeStablePageSnapshotV2(window: StoreV6RealtimePageWindow) {
  if (window.sessionTimeFrom == null) return
  const storageKey = realtimeCacheKey(window.symbol, window.period, window.sessionTimeFrom, window.sessionTimeTo)
  const nextValue: PersistedRealtimeStablePage = {
    period: window.period,
    savedAt: new Date().toISOString(),
    sessionTimeFrom: window.sessionTimeFrom,
    sessionTimeTo: window.sessionTimeTo,
    stableRows: window.stableRows,
    symbol: window.symbol,
  }
  writePhysicalRealtimeState('stable', nextValue)
  writeRealtimeStablePageStore(replaceScopedStorageEntry(readRealtimeStablePageStore(), storageKey, nextValue))
}

export function writeRealtimeTailRuntimeCacheV2(window: StoreV6RealtimePageWindow) {
  if (window.sessionTimeFrom == null) return
  const storageKey = realtimeCacheKey(window.symbol, window.period, window.sessionTimeFrom, window.sessionTimeTo)
  const nextValue: PersistedRealtimeTailRuntime = {
    period: window.period,
    savedAt: new Date().toISOString(),
    sessionTimeFrom: window.sessionTimeFrom,
    sessionTimeTo: window.sessionTimeTo,
    symbol: window.symbol,
    tailRow: window.tailRow,
  }
  writePhysicalRealtimeState('tail', nextValue)
  writeRealtimeTailRuntimeStore(replaceScopedStorageEntry(readRealtimeTailRuntimeStore(), storageKey, nextValue))
}

export function writeCachedRealtimeRowsV2(window: StoreV6RealtimePageWindow) {
  writeRealtimeStablePageSnapshotV2(window)
  writeRealtimeTailRuntimeCacheV2(window)
}
