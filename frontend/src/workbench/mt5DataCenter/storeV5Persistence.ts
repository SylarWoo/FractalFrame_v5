import type { Mt5RealtimeTick, Mt5SymbolRow, StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import type { StoreTableRow } from './storeV5StatusFormat'

const watchlistSymbolsStorageKey = 'fractalframe:mt5ImportCenterWatchlistSymbols:v1'
const shortcutMenuEnabledStorageKey = 'fractalframe:mt5ImportCenterShortcutMenuEnabled:v1'
const shortcutMenuPeriodsStorageKey = 'fractalframe:mt5ImportCenterShortcutMenuPeriods:v1'
const sharedSelectionStorageKey = 'fractalframe:mt5ImportCenterSharedSelection:v1'
export const shortcutMenuChangedEvent = 'fractalframe:mt5ImportCenterShortcutMenuChanged'
export const watchlistChangedEvent = 'fractalframe:mt5ImportCenterWatchlistChanged'
export const storeV5StatusChangedEvent = 'fractalframe:mt5ImportCenterStoreV5StatusChanged'
export const sharedSelectionChangedEvent = 'fractalframe:mt5ImportCenterSharedSelectionChanged'
const symbolSnapshotStorageKey = 'fractalframe:mt5ImportCenterSymbolSnapshot:v1'
const mt5M1CheckResultsStorageKey = 'fractalframe:mt5ImportCenterM1CheckResults:v1'
const storeV5StatusStorageKey = 'fractalframe:mt5ImportCenterStoreV5Status:v1'
const storeV5ListSymbolsStorageKey = 'fractalframe:mt5ImportCenterStoreV5ListSymbols:v1'
const storePanelPersistenceEnabledStorageKey = 'fractalframe:mt5ImportCenterStorePanelPersistenceEnabled:v1'
const watchlistRealtimeEnabledStorageKey = 'fractalframe:mt5ImportCenterWatchlistRealtimeEnabled:v1'
const watchlistRealtimeSnapshotStorageKey = 'fractalframe:mt5ImportCenterWatchlistRealtimeSnapshot:v1'
const storePanelSelectedTableKeyStorageKey = 'fractalframe:mt5ImportCenterStorePanelSelectedTableKey:v1'
const importCenterQueryStorageKey = 'fractalframe:mt5ImportCenterQuery:v1'
const importCenterSelectedTabStorageKey = 'fractalframe:mt5ImportCenterSelectedTab:v1'
const storePanelPersistenceKeys = [
  mt5M1CheckResultsStorageKey,
  storeV5StatusStorageKey,
  storeV5ListSymbolsStorageKey,
  storePanelSelectedTableKeyStorageKey,
]

export type SelectedPanelTab = 'details' | 'store' | 'watchlist' | 'settings'
export type SymbolSnapshot = {
  selectedSymbol: string
  status: string
  symbols: Mt5SymbolRow[]
  savedAt: string
}

export type PersistedM1CheckResult = {
  checkedAt: string
  payload: StoreV5CheckPayload
}

export type PersistedStoreV5Status = {
  checkedAt: string
  payload: StoreV5CheckPayload
}

export type PersistedStoreTableSelection = {
  key: string
  symbol: string
}

export type SharedSelection = {
  symbol: string
  period: string
}

export type PersistedRealtimeSnapshot = {
  lastTickAt?: string
  log?: string[]
  ticks?: Record<string, Mt5RealtimeTick>
}

export function getInitialSymbolSnapshot(): SymbolSnapshot | null {
  try {
    const raw = window.localStorage.getItem(symbolSnapshotStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.symbols)) return null

    return {
      selectedSymbol: typeof parsed.selectedSymbol === 'string' ? parsed.selectedSymbol : '',
      status: typeof parsed.status === 'string' ? parsed.status : '',
      symbols: parsed.symbols,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

export function saveSymbolSnapshot(snapshot: Omit<SymbolSnapshot, 'savedAt'>) {
  try {
    window.localStorage.setItem(
      symbolSnapshotStorageKey,
      JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }),
    )
  } catch {
    // Symbol persistence is best-effort only.
  }
}

export function readStorePanelPersistenceEnabled() {
  try {
    const raw = window.localStorage.getItem(storePanelPersistenceEnabledStorageKey)
    return raw == null ? true : raw === '1'
  } catch {
    return true
  }
}

export function readWatchlistRealtimeEnabled() {
  try {
    return window.localStorage.getItem(watchlistRealtimeEnabledStorageKey) === '1'
  } catch {
    return false
  }
}

export function saveWatchlistRealtimeEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(watchlistRealtimeEnabledStorageKey, enabled ? '1' : '0')
  } catch {
    // Watchlist realtime persistence is best-effort only.
  }
}

export function readImportCenterQuery() {
  try {
    return window.localStorage.getItem(importCenterQueryStorageKey) ?? ''
  } catch {
    return ''
  }
}

export function saveImportCenterQuery(value: string) {
  try {
    window.localStorage.setItem(importCenterQueryStorageKey, value)
  } catch {
    // Query persistence is best-effort only.
  }
}

export function readImportCenterSelectedTab(): SelectedPanelTab {
  try {
    const value = window.localStorage.getItem(importCenterSelectedTabStorageKey)
    return value === 'details' || value === 'store' || value === 'watchlist' || value === 'settings'
      ? value
      : 'details'
  } catch {
    return 'details'
  }
}

export function saveImportCenterSelectedTab(value: SelectedPanelTab) {
  try {
    window.localStorage.setItem(importCenterSelectedTabStorageKey, value)
  } catch {
    // Tab persistence is best-effort only.
  }
}

export function readPersistedRealtimeSnapshot(): PersistedRealtimeSnapshot {
  try {
    const raw = window.localStorage.getItem(watchlistRealtimeSnapshotStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      lastTickAt: typeof parsed?.lastTickAt === 'string' ? parsed.lastTickAt : '',
      log: Array.isArray(parsed?.log) ? parsed.log.filter((item: unknown): item is string => typeof item === 'string').slice(0, 8) : [],
      ticks: parsed?.ticks && typeof parsed.ticks === 'object' ? parsed.ticks as Record<string, Mt5RealtimeTick> : {},
    }
  } catch {
    return { lastTickAt: '', log: [], ticks: {} }
  }
}

export function savePersistedRealtimeSnapshot(snapshot: PersistedRealtimeSnapshot) {
  try {
    window.localStorage.setItem(watchlistRealtimeSnapshotStorageKey, JSON.stringify({
      lastTickAt: snapshot.lastTickAt ?? '',
      log: (snapshot.log ?? []).slice(0, 8),
      ticks: snapshot.ticks ?? {},
    }))
  } catch {
    // Realtime snapshot persistence is best-effort only.
  }
}

export function saveStorePanelPersistenceEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(storePanelPersistenceEnabledStorageKey, enabled ? '1' : '0')
  } catch {
    // Store panel persistence flag is best-effort only.
  }
}

export function clearStorePanelPersistence() {
  try {
    storePanelPersistenceKeys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Store panel persistence cleanup is best-effort only.
  }
}

export function readPersistedM1CheckResult(symbol: string, enabled = true): PersistedM1CheckResult | null {
  if (!enabled) return null
  if (!symbol) return null
  try {
    const raw = window.localStorage.getItem(mt5M1CheckResultsStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const item = parsed?.[symbol]
    if (!item || typeof item !== 'object' || !item.payload) return null
    if (typeof item.checkedAt !== 'string') return null
    return item as PersistedM1CheckResult
  } catch {
    return null
  }
}

export function savePersistedM1CheckResult(symbol: string, payload: StoreV5CheckPayload, checkedAt: string, enabled = true) {
  if (!enabled) return
  if (!symbol) return
  try {
    const raw = window.localStorage.getItem(mt5M1CheckResultsStorageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    window.localStorage.setItem(
      mt5M1CheckResultsStorageKey,
      JSON.stringify({
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        [symbol]: { checkedAt, payload },
      }),
    )
  } catch {
    // Check result persistence is best-effort only.
  }
}

export function readPersistedStoreV5Status(symbol: string, enabled = true): PersistedStoreV5Status | null {
  if (!enabled) return null
  if (!symbol) return null
  try {
    const raw = window.localStorage.getItem(storeV5StatusStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const item = parsed?.[symbol]
    if (!item || typeof item !== 'object' || !item.payload) return null
    if (typeof item.checkedAt !== 'string') return null
    return item as PersistedStoreV5Status
  } catch {
    return null
  }
}

export function savePersistedStoreV5Status(symbol: string, payload: StoreV5CheckPayload, checkedAt = new Date().toISOString(), enabled = true) {
  if (!enabled) return
  if (!symbol) return
  try {
    const raw = window.localStorage.getItem(storeV5StatusStorageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    window.localStorage.setItem(
      storeV5StatusStorageKey,
      JSON.stringify({
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        [symbol]: { checkedAt, payload },
      }),
    )
    window.dispatchEvent(new Event(storeV5StatusChangedEvent))
  } catch {
    // Store status persistence is best-effort only.
  }
}

export function readStoreV5ListSymbols(enabled = true): string[] {
  if (!enabled) return []
  try {
    const raw = window.localStorage.getItem(storeV5ListSymbolsStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function saveStoreV5ListSymbols(symbols: string[], enabled = true) {
  if (!enabled) return
  try {
    window.localStorage.setItem(storeV5ListSymbolsStorageKey, JSON.stringify([...new Set(symbols)]))
  } catch {
    // Store list persistence is best-effort only.
  }
}

export function readWatchlistSymbols(): string[] {
  try {
    const raw = window.localStorage.getItem(watchlistSymbolsStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export function saveWatchlistSymbols(symbols: string[]) {
  try {
    window.localStorage.setItem(watchlistSymbolsStorageKey, JSON.stringify([...new Set(symbols)]))
    window.dispatchEvent(new Event(watchlistChangedEvent))
  } catch {
    // Watchlist persistence is best-effort only.
  }
}

export function readShortcutMenuEnabled() {
  try {
    return window.localStorage.getItem(shortcutMenuEnabledStorageKey) === '1'
  } catch {
    return false
  }
}

export function saveShortcutMenuEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(shortcutMenuEnabledStorageKey, enabled ? '1' : '0')
    window.dispatchEvent(new Event(shortcutMenuChangedEvent))
  } catch {
    // Shortcut menu persistence is best-effort only.
  }
}

export function saveShortcutMenuPeriods(periods: StoreTableRow[]) {
  try {
    window.localStorage.setItem(
      shortcutMenuPeriodsStorageKey,
      JSON.stringify(periods.map((row) => ({
        period: row.period,
        rowsCount: row.rowsCount ?? null,
      }))),
    )
    window.dispatchEvent(new Event(shortcutMenuChangedEvent))
  } catch {
    // Shortcut period persistence is best-effort only.
  }
}

export function readSharedSelection(): SharedSelection {
  try {
    const raw = window.localStorage.getItem(sharedSelectionStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      symbol: typeof parsed?.symbol === 'string' ? parsed.symbol : '',
      period: typeof parsed?.period === 'string' ? parsed.period.toUpperCase() : '',
    }
  } catch {
    return { symbol: '', period: '' }
  }
}

export function publishSharedSelection(symbol: string, period: string) {
  try {
    window.localStorage.setItem(sharedSelectionStorageKey, JSON.stringify({ symbol, period }))
  } catch {
    // Shared selection persistence is best-effort only.
  }
  window.dispatchEvent(new CustomEvent(sharedSelectionChangedEvent, { detail: { symbol, period } }))
}

export function readPersistedStoreTableSelection(symbol: string, enabled = true): string {
  if (!enabled || !symbol) return ''
  try {
    const raw = window.localStorage.getItem(storePanelSelectedTableKeyStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    const item = parsed?.[symbol] as PersistedStoreTableSelection | undefined
    return item?.symbol === symbol && typeof item.key === 'string' ? item.key : ''
  } catch {
    return ''
  }
}

export function savePersistedStoreTableSelection(symbol: string, key: string, enabled = true) {
  if (!enabled || !symbol) return
  try {
    const raw = window.localStorage.getItem(storePanelSelectedTableKeyStorageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    window.localStorage.setItem(
      storePanelSelectedTableKeyStorageKey,
      JSON.stringify({
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        [symbol]: { key, symbol },
      }),
    )
  } catch {
    // Store table selection persistence is best-effort only.
  }
}


