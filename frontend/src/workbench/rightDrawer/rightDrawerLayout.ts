import { readJson, readString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import type { SymbolTableColumnKey } from '../mt5DataCenter/SymbolTable'
import type { WatchlistTableColumnKey } from '../mt5DataCenter/WatchlistTable'

export const minDrawerWidth = 220
export const maxDrawerWidth = 900

export const defaultColumnWidths: Record<SymbolTableColumnKey, number> = {
  symbol: 96,
  name: 126,
  type: 64,
}

export const defaultWatchlistColumnWidths: Record<WatchlistTableColumnKey, number> = {
  symbol: 76,
  name: 78,
  assetType: 64,
  last: 90,
  change: 72,
}

export function clampDrawerWidth(width: number) {
  return Math.max(minDrawerWidth, Math.min(maxDrawerWidth, Math.round(width)))
}

export function getInitialTopPaneHeight() {
  const fallbackHeight = 300

  try {
    const raw = readString(storageKeys.importCenterTopPaneHeightPx)
    const value = raw === '' ? fallbackHeight : Number(raw)
    return Math.max(180, Math.min(360, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

export function getInitialWatchlistTableHeight() {
  const fallbackHeight = 228

  try {
    const raw = readString(storageKeys.importCenterWatchlistTableHeightPx)
    const value = raw === '' ? fallbackHeight : Number(raw)
    return Math.max(96, Math.min(1200, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

export function clampColumnWidth(width: number, column: SymbolTableColumnKey) {
  const minByColumn: Record<SymbolTableColumnKey, number> = {
    symbol: 46,
    name: 52,
    type: 40,
  }
  const maxByColumn: Record<SymbolTableColumnKey, number> = {
    symbol: 180,
    name: 260,
    type: 140,
  }
  const fallback = defaultColumnWidths[column]
  const value = Number.isFinite(width) ? width : fallback
  return Math.max(minByColumn[column], Math.min(maxByColumn[column], Math.round(value)))
}

export function clampWatchlistColumnWidth(width: number, column: WatchlistTableColumnKey) {
  const minByColumn: Record<WatchlistTableColumnKey, number> = {
    symbol: 52,
    name: 60,
    assetType: 50,
    last: 76,
    change: 62,
  }
  const maxByColumn: Record<WatchlistTableColumnKey, number> = {
    symbol: 160,
    name: 160,
    assetType: 130,
    last: 150,
    change: 120,
  }
  const fallback = defaultWatchlistColumnWidths[column]
  const value = Number.isFinite(width) ? width : fallback
  return Math.max(minByColumn[column], Math.min(maxByColumn[column], Math.round(value)))
}

export function getInitialColumnWidths() {
  try {
    const parsed = readJson<Partial<Record<SymbolTableColumnKey, number>> | null>(storageKeys.importCenterColumnWidthsPx, null)
    if (!parsed || typeof parsed !== 'object') return defaultColumnWidths
    return {
      symbol: clampColumnWidth(Number(parsed.symbol), 'symbol'),
      name: clampColumnWidth(Number(parsed.name), 'name'),
      type: clampColumnWidth(Number(parsed.type), 'type'),
    }
  } catch {
    return defaultColumnWidths
  }
}

export function getInitialWatchlistColumnWidths() {
  try {
    const parsed = readJson<Partial<Record<WatchlistTableColumnKey, number>> | null>(storageKeys.importCenterWatchlistColumnWidthsPx, null)
    if (!parsed || typeof parsed !== 'object') return defaultWatchlistColumnWidths
    return {
      symbol: clampWatchlistColumnWidth(Number(parsed.symbol), 'symbol'),
      name: clampWatchlistColumnWidth(Number(parsed.name), 'name'),
      assetType: clampWatchlistColumnWidth(Number(parsed.assetType), 'assetType'),
      last: clampWatchlistColumnWidth(Number(parsed.last), 'last'),
      change: clampWatchlistColumnWidth(Number(parsed.change), 'change'),
    }
  } catch {
    return defaultWatchlistColumnWidths
  }
}
