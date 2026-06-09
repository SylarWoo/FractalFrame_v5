import { useEffect, useMemo } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { Mt5SymbolRow, StoreV6CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import type { ChartPageTarget } from '../chart/chartRuntimeTypes'
import { resolveStoreV6PagePartitionMode } from '../chart/pagePartition/pagePartitionBuilder'
import { hasStoreV6PeriodPageSystemV2 } from '../chart/pagePartition/periodPageSystemV2'
import type { StoreTableRow } from '../mt5DataCenter/storeV6StatusFormat'
import { storeTableKeyForPeriod } from '../mt5DataCenter/storeV6StatusFormat'
import {
  readPersistedM1CheckResult,
  readPersistedStoreV6Status,
  readSharedSelection,
  saveShortcutMenuPeriods,
  saveSymbolSnapshot,
  sharedSelectionChangedEvent,
} from '../mt5DataCenter/storeV6Persistence'
import type { SharedSelection } from '../mt5DataCenter/storeV6Persistence'
import { resolveMt5SymbolDisplay } from './mt5SymbolDisplay'
import {
  buildVisibleStoreTableRows,
  buildWatchlistAggregatedPeriods,
  buildWatchlistDirectPeriods,
} from './rightDrawerStoreTables'

type UseRightDrawerSelectionOptions = {
  query: string
  symbols: Mt5SymbolRow[]
  selectedSymbol: string
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  status: string
  storePanelPersistenceEnabled: boolean
  setStoreCheck: Dispatch<SetStateAction<StoreV6CheckPayload | null>>
  setMt5M1LastCheckedAt: Dispatch<SetStateAction<string>>
  localStoreStatus: StoreV6CheckPayload | null
  setLocalStoreStatus: Dispatch<SetStateAction<StoreV6CheckPayload | null>>
  watchlistSymbols: string[]
  shortcutMenuEnabled: boolean
  selectedStoreTableKey: string
  setSelectedStoreTableKey: Dispatch<SetStateAction<string>>
  setStoreCheckError: Dispatch<SetStateAction<string>>
  setStoreActionStatus: Dispatch<SetStateAction<string>>
  autoOpenedStoreTableRef: RefObject<string>
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
}

export function parseSymbolSearchTokens(query: string) {
  return query
    .split(/[,\s，、;；|]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

export function symbolRowMatchesSearchTokens(row: Mt5SymbolRow, tokens: string[]) {
  if (tokens.length === 0) return true
  const display = resolveMt5SymbolDisplay(row)
  const searchableText = [
    row.symbol,
    row.name,
    row.description,
    row.path,
    row.category,
    display.chineseName,
    display.assetType,
  ]
    .join(' ')
    .toLowerCase()

  return tokens.some((token) => searchableText.includes(token))
}

function shouldSkipChartOpen(period: string | null | undefined) {
  return resolveStoreV6PagePartitionMode(period) === 'm5-time' || !hasStoreV6PeriodPageSystemV2(period)
}

export function useRightDrawerSelection({
  query,
  symbols,
  selectedSymbol,
  setSelectedSymbol,
  status,
  storePanelPersistenceEnabled,
  setStoreCheck,
  setMt5M1LastCheckedAt,
  localStoreStatus,
  setLocalStoreStatus,
  watchlistSymbols,
  shortcutMenuEnabled,
  selectedStoreTableKey,
  setSelectedStoreTableKey,
  setStoreCheckError,
  setStoreActionStatus,
  autoOpenedStoreTableRef,
  onOpenChart,
}: UseRightDrawerSelectionOptions) {
  const visibleSymbols = useMemo(() => {
    const tokens = parseSymbolSearchTokens(query)
    if (tokens.length === 0) return symbols
    return symbols.filter((row) => symbolRowMatchesSearchTokens(row, tokens))
  }, [query, symbols])

  const selectedRow = useMemo(() => {
    return symbols.find((row) => row.symbol === selectedSymbol) ?? visibleSymbols[0] ?? null
  }, [selectedSymbol, symbols, visibleSymbols])

  const selectedDisplay = selectedRow ? resolveMt5SymbolDisplay(selectedRow) : null
  const selectedIsInWatchlist = selectedRow ? watchlistSymbols.includes(selectedRow.symbol) : false
  const watchlistRows = useMemo(() => {
    const rowsBySymbol = new Map(symbols.map((row) => [row.symbol, row]))
    return watchlistSymbols
      .map((symbol) => rowsBySymbol.get(symbol))
      .filter((row): row is Mt5SymbolRow => Boolean(row))
  }, [symbols, watchlistSymbols])
  const foregroundRealtimeSymbol = selectedRow?.symbol ?? ''

  const visibleStoreTableRows = useMemo<StoreTableRow[]>(() => {
    return buildVisibleStoreTableRows({ localStoreStatus, selectedRow })
  }, [localStoreStatus, selectedRow])
  const watchlistDirectPeriods = useMemo<StoreTableRow[]>(() => buildWatchlistDirectPeriods(localStoreStatus), [localStoreStatus])
  const watchlistAggregatedPeriods = useMemo<StoreTableRow[]>(
    () => buildWatchlistAggregatedPeriods(localStoreStatus),
    [localStoreStatus],
  )
  const selectedStoreTableKeyIsVisible = useMemo(
    () => visibleStoreTableRows.some((row) => `${row.kind}-${row.period}` === selectedStoreTableKey),
    [selectedStoreTableKey, visibleStoreTableRows],
  )

  useEffect(() => {
    const syncSelection = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as Partial<SharedSelection> : readSharedSelection()
      const nextSymbol = typeof detail.symbol === 'string' ? detail.symbol : ''
      const nextPeriod = typeof detail.period === 'string' ? detail.period.toUpperCase() : ''

      if (nextSymbol && nextSymbol !== selectedSymbol) {
        const persistedCheck = readPersistedM1CheckResult(nextSymbol, storePanelPersistenceEnabled)
        const persistedStoreStatus = readPersistedStoreV6Status(nextSymbol, storePanelPersistenceEnabled)
        setSelectedSymbol(nextSymbol)
        setStoreCheck(persistedCheck?.payload ?? null)
        setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
        setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
        setStoreCheckError('')
        setStoreActionStatus('')
        if (symbols.length) {
          saveSymbolSnapshot({
            selectedSymbol: nextSymbol,
            status,
            symbols,
          })
        }
      }

      if (nextPeriod) {
        setSelectedStoreTableKey(storeTableKeyForPeriod(nextPeriod, visibleStoreTableRows))
      }
    }

    window.addEventListener(sharedSelectionChangedEvent, syncSelection)
    return () => window.removeEventListener(sharedSelectionChangedEvent, syncSelection)
  }, [
    selectedSymbol,
    setLocalStoreStatus,
    setMt5M1LastCheckedAt,
    setSelectedStoreTableKey,
    setSelectedSymbol,
    setStoreActionStatus,
    setStoreCheck,
    setStoreCheckError,
    status,
    storePanelPersistenceEnabled,
    symbols,
    visibleStoreTableRows,
  ])

  useEffect(() => {
    if (!shortcutMenuEnabled) return
    saveShortcutMenuPeriods([...watchlistDirectPeriods, ...watchlistAggregatedPeriods])
  }, [shortcutMenuEnabled, watchlistAggregatedPeriods, watchlistDirectPeriods])

  useEffect(() => {
    const shared = readSharedSelection()
    if (!shared.period) return
    const nextKey = storeTableKeyForPeriod(shared.period, visibleStoreTableRows)
    if (selectedStoreTableKey !== nextKey) setSelectedStoreTableKey(nextKey)
  }, [selectedStoreTableKey, setSelectedStoreTableKey, visibleStoreTableRows])

  useEffect(() => {
    if (!selectedRow?.symbol || !selectedStoreTableKeyIsVisible || !selectedStoreTableKey) return

    const autoOpenKey = `${selectedRow.symbol}:${selectedStoreTableKey}`
    if (autoOpenedStoreTableRef.current === autoOpenKey) return

    const row = visibleStoreTableRows.find((item) => `${item.kind}-${item.period}` === selectedStoreTableKey)
    if (!row) return
    if (shouldSkipChartOpen(row.period)) {
      autoOpenedStoreTableRef.current = autoOpenKey
      return
    }

    autoOpenedStoreTableRef.current = autoOpenKey
    onOpenChart?.({
      symbol: selectedRow.symbol,
      period: row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
  }, [autoOpenedStoreTableRef, onOpenChart, selectedRow?.symbol, selectedStoreTableKey, selectedStoreTableKeyIsVisible, visibleStoreTableRows])

  return {
    foregroundRealtimeSymbol,
    selectedDisplay,
    selectedIsInWatchlist,
    selectedRow,
    selectedStoreTableKeyIsVisible,
    visibleStoreTableRows,
    visibleSymbols,
    watchlistAggregatedPeriods,
    watchlistDirectPeriods,
    watchlistRows,
  }
}
