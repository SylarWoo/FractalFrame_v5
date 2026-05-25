import type { Mt5RealtimeTick, Mt5SymbolRow, StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import { readBooleanFlag, readJson, readString, removeStorageItem, writeBooleanFlag, writeJson, writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { dispatchSharedSelectionChanged, dispatchWorkbenchEvent, workbenchEvents } from '../persistence/workbenchEvents'
import type { StoreTableRow } from './storeV5StatusFormat'

export const shortcutMenuChangedEvent = workbenchEvents.shortcutMenuChanged
export const watchlistChangedEvent = workbenchEvents.watchlistChanged
export const storeV5StatusChangedEvent = workbenchEvents.storeV5StatusChanged
export const sharedSelectionChangedEvent = workbenchEvents.sharedSelectionChanged
export const realtimeEnabledChangedEvent = workbenchEvents.realtimeEnabledChanged

const storePanelPersistenceKeys = [
  storageKeys.importCenterM1CheckResults,
  storageKeys.importCenterStoreV5Status,
  storageKeys.importCenterStoreV5ListSymbols,
  storageKeys.importCenterStorePanelSelectedTableKey,
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
  const parsed = readJson<Partial<SymbolSnapshot> | null>(storageKeys.importCenterSymbolSnapshot, null)
  if (!parsed || typeof parsed !== 'object') return null
  if (!Array.isArray(parsed.symbols)) return null

  return {
    selectedSymbol: typeof parsed.selectedSymbol === 'string' ? parsed.selectedSymbol : '',
    status: typeof parsed.status === 'string' ? parsed.status : '',
    symbols: parsed.symbols,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
  }
}

export function saveSymbolSnapshot(snapshot: Omit<SymbolSnapshot, 'savedAt'>) {
  writeJson(storageKeys.importCenterSymbolSnapshot, { ...snapshot, savedAt: new Date().toISOString() })
}

function mergeDefinedSymbolRowValues(base: Mt5SymbolRow, patch: Mt5SymbolRow): Mt5SymbolRow {
  const merged = { ...base } as Record<string, unknown>
  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    merged[key] = value
  })
  return merged as Mt5SymbolRow
}

export function mergeSymbolRowsWithSnapshot(rows: Mt5SymbolRow[], cachedRows: Mt5SymbolRow[] = []) {
  const cachedBySymbol = new Map(cachedRows.map((row) => [row.symbol, row]))
  const seen = new Set<string>()
  const mergedRows = rows
    .filter((row) => typeof row.symbol === 'string' && row.symbol)
    .map((row) => {
      seen.add(row.symbol)
      const cached = cachedBySymbol.get(row.symbol)
      return cached ? mergeDefinedSymbolRowValues(cached, row) : row
    })

  cachedRows.forEach((row) => {
    if (!row.symbol || seen.has(row.symbol)) return
    seen.add(row.symbol)
    mergedRows.push(row)
  })

  return mergedRows
}

export function readStorePanelPersistenceEnabled() {
  return readBooleanFlag(storageKeys.importCenterStorePanelPersistenceEnabled, true)
}

export function readWatchlistRealtimeEnabled() {
  return readBooleanFlag(storageKeys.importCenterWatchlistRealtimeEnabled, false)
}

export function saveWatchlistRealtimeEnabled(enabled: boolean) {
  const written = writeBooleanFlag(storageKeys.importCenterWatchlistRealtimeEnabled, enabled)
  if (written) dispatchWorkbenchEvent(realtimeEnabledChangedEvent)
}

export function readImportCenterQuery() {
  return readString(storageKeys.importCenterQuery)
}

export function saveImportCenterQuery(value: string) {
  writeString(storageKeys.importCenterQuery, value)
}

export function readImportCenterSelectedTab(): SelectedPanelTab {
  const value = readString(storageKeys.importCenterSelectedTab)
  return value === 'details' || value === 'store' || value === 'watchlist' || value === 'settings'
    ? value
    : 'details'
}

export function saveImportCenterSelectedTab(value: SelectedPanelTab) {
  writeString(storageKeys.importCenterSelectedTab, value)
}

export function readPersistedRealtimeSnapshot(): PersistedRealtimeSnapshot {
  const parsed = readJson<PersistedRealtimeSnapshot | null>(storageKeys.importCenterWatchlistRealtimeSnapshot, null)
  return {
    lastTickAt: typeof parsed?.lastTickAt === 'string' ? parsed.lastTickAt : '',
    log: Array.isArray(parsed?.log) ? parsed.log.filter((item: unknown): item is string => typeof item === 'string').slice(0, 8) : [],
    ticks: parsed?.ticks && typeof parsed.ticks === 'object' ? parsed.ticks as Record<string, Mt5RealtimeTick> : {},
  }
}

export function savePersistedRealtimeSnapshot(snapshot: PersistedRealtimeSnapshot) {
  writeJson(storageKeys.importCenterWatchlistRealtimeSnapshot, {
    lastTickAt: snapshot.lastTickAt ?? '',
    log: (snapshot.log ?? []).slice(0, 8),
    ticks: snapshot.ticks ?? {},
  })
}

export function saveStorePanelPersistenceEnabled(enabled: boolean) {
  writeBooleanFlag(storageKeys.importCenterStorePanelPersistenceEnabled, enabled)
}

export function clearStorePanelPersistence() {
  storePanelPersistenceKeys.forEach(removeStorageItem)
}

export function readPersistedM1CheckResult(symbol: string, enabled = true): PersistedM1CheckResult | null {
  if (!enabled) return null
  if (!symbol) return null
  const parsed = readJson<Record<string, PersistedM1CheckResult>>(storageKeys.importCenterM1CheckResults, {})
  const item = parsed?.[symbol]
  if (!item || typeof item !== 'object' || !item.payload) return null
  if (typeof item.checkedAt !== 'string') return null
  return item
}

export function savePersistedM1CheckResult(symbol: string, payload: StoreV5CheckPayload, checkedAt: string, enabled = true) {
  if (!enabled) return
  if (!symbol) return
  const parsed = readJson<Record<string, PersistedM1CheckResult>>(storageKeys.importCenterM1CheckResults, {})
  writeJson(storageKeys.importCenterM1CheckResults, {
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
    [symbol]: { checkedAt, payload },
  })
}

export function readPersistedStoreV5Status(symbol: string, enabled = true): PersistedStoreV5Status | null {
  if (!enabled) return null
  if (!symbol) return null
  const parsed = readJson<Record<string, PersistedStoreV5Status>>(storageKeys.importCenterStoreV5Status, {})
  const item = parsed?.[symbol]
  if (!item || typeof item !== 'object' || !item.payload) return null
  if (typeof item.checkedAt !== 'string') return null
  return item
}

export function savePersistedStoreV5Status(symbol: string, payload: StoreV5CheckPayload, checkedAt = new Date().toISOString(), enabled = true) {
  if (!enabled) return
  if (!symbol) return
  const parsed = readJson<Record<string, PersistedStoreV5Status>>(storageKeys.importCenterStoreV5Status, {})
  const written = writeJson(storageKeys.importCenterStoreV5Status, {
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
    [symbol]: { checkedAt, payload },
  })
  if (written) dispatchWorkbenchEvent(storeV5StatusChangedEvent)
}

export function readStoreV5ListSymbols(enabled = true): string[] {
  if (!enabled) return []
  const parsed = readJson<unknown[]>(storageKeys.importCenterStoreV5ListSymbols, [])
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

export function saveStoreV5ListSymbols(symbols: string[], enabled = true) {
  if (!enabled) return
  writeJson(storageKeys.importCenterStoreV5ListSymbols, [...new Set(symbols)])
}

export function readWatchlistSymbols(): string[] {
  const parsed = readJson<unknown[]>(storageKeys.importCenterWatchlistSymbols, [])
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

export function saveWatchlistSymbols(symbols: string[]) {
  const written = writeJson(storageKeys.importCenterWatchlistSymbols, [...new Set(symbols)])
  if (written) dispatchWorkbenchEvent(watchlistChangedEvent)
}

export function readShortcutMenuEnabled() {
  return readBooleanFlag(storageKeys.importCenterShortcutMenuEnabled)
}

export function saveShortcutMenuEnabled(enabled: boolean) {
  const written = writeBooleanFlag(storageKeys.importCenterShortcutMenuEnabled, enabled)
  if (written) dispatchWorkbenchEvent(shortcutMenuChangedEvent)
}

export function saveShortcutMenuPeriods(periods: StoreTableRow[]) {
  const written = writeJson(
    storageKeys.importCenterShortcutMenuPeriods,
    periods.map((row) => ({
      period: row.period,
      rowsCount: row.rowsCount ?? null,
    })),
  )
  if (written) dispatchWorkbenchEvent(shortcutMenuChangedEvent)
}

export function readSharedSelection(): SharedSelection {
  const parsed = readJson<Partial<SharedSelection> | null>(storageKeys.importCenterSharedSelection, null)
  return {
    symbol: typeof parsed?.symbol === 'string' ? parsed.symbol : '',
    period: typeof parsed?.period === 'string' ? parsed.period.toUpperCase() : '',
  }
}

export function publishSharedSelection(symbol: string, period: string) {
  writeJson(storageKeys.importCenterSharedSelection, { symbol, period })
  dispatchSharedSelectionChanged({ symbol, period })
}

export function readPersistedStoreTableSelection(symbol: string, enabled = true): string {
  if (!enabled || !symbol) return ''
  const parsed = readJson<Record<string, PersistedStoreTableSelection>>(storageKeys.importCenterStorePanelSelectedTableKey, {})
  const item = parsed?.[symbol]
  return item?.symbol === symbol && typeof item.key === 'string' ? item.key : ''
}

export function savePersistedStoreTableSelection(symbol: string, key: string, enabled = true) {
  if (!enabled || !symbol) return
  const parsed = readJson<Record<string, PersistedStoreTableSelection>>(storageKeys.importCenterStorePanelSelectedTableKey, {})
  writeJson(storageKeys.importCenterStorePanelSelectedTableKey, {
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
    [symbol]: { key, symbol },
  })
}
