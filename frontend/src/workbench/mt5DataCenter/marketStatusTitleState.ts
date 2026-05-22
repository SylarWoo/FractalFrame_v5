import type { Mt5MarketStatus } from '../../services/mt5/mt5SymbolsApi'
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
