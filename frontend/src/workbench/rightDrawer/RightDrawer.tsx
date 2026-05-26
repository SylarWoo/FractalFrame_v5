import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './RightDrawer.css'
import '../mt5DataCenter/Mt5DataCenterPanel.css'
import type { SettingsPanelTab } from '../settings/SettingsPanel'
import { formatSymbolStatus, normalizeStoredStatus, periodFromStoreTableKey, storeTableKeyForPeriod } from '../mt5DataCenter/storeV5StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV5StatusFormat'
import { clearStorePanelPersistence, getInitialSymbolSnapshot, mergeSymbolRowsWithSnapshot, publishSharedSelection, readImportCenterQuery, readImportCenterSelectedTab, readPersistedM1CheckResult, readPersistedStoreTableSelection, readPersistedStoreV5Status, readSharedSelection, readShortcutMenuEnabled, readStorePanelPersistenceEnabled, readWatchlistSymbols, saveImportCenterQuery, saveImportCenterSelectedTab, savePersistedStoreTableSelection, saveShortcutMenuEnabled, saveShortcutMenuPeriods, saveStorePanelPersistenceEnabled, saveSymbolSnapshot, saveWatchlistSymbols } from '../mt5DataCenter/storeV5Persistence'
import type { SelectedPanelTab } from '../mt5DataCenter/storeV5Persistence'
import { storeTableAggregatePeriods } from './rightDrawerStoreTables'
import { useRightDrawerResize } from './useRightDrawerResize'
import { useRightDrawerSelection } from './useRightDrawerSelection'
import { useStoreV5Jobs } from './useStoreV5Jobs'
import { useWatchlistRealtime } from './useWatchlistRealtime'
import { DrawingsDrawer } from './DrawingsDrawer'
import { IndicatorsDrawer } from './IndicatorsDrawer'
import { ObjectTreeDrawer } from './ObjectTreeDrawer'
import { RightDrawerFrame } from './RightDrawerFrame'
import { RightDrawerMt5Body } from './RightDrawerMt5Body'
import { RightDrawerSettingsHost } from './RightDrawerSettingsHost'
import type { RightDrawerProps } from './RightDrawerTypes'
import {
  fetchStoreV5Status,
  fetchMt5Symbols,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'

function hasLoadedSymbolSessions(row: Mt5SymbolRow | undefined) {
  if (!row?.sessions) return false
  if (row.sessionsSource) return true
  return [...(row.sessions.quote ?? []), ...(row.sessions.trade ?? [])].some((value) => String(value ?? '').trim())
}

export function RightDrawer({
  activeDrawer,
  drawerWidth,
  indicatorShortcutKeys,
  indicatorsController,
  loadedIndicatorKeys,
  onClose,
  onIndicatorShortcutKeysChange,
  onResize,
  onToggleDrawer,
  onOpenChart,
}: RightDrawerProps) {
  const initialSnapshot = useMemo(() => getInitialSymbolSnapshot(), [])
  const initialSharedSelection = useMemo(() => readSharedSelection(), [])
  const [query, setQuery] = useState(readImportCenterQuery)
  const [symbols, setSymbols] = useState<Mt5SymbolRow[]>(() => initialSnapshot?.symbols ?? [])
  const [selectedSymbol, setSelectedSymbol] = useState(() => initialSharedSelection.symbol || initialSnapshot?.selectedSymbol || '')
  const [status, setStatus] = useState(
    () => normalizeStoredStatus(initialSnapshot?.status ?? '', initialSnapshot?.symbols.length ?? 0),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPanelTab, setSelectedPanelTab] = useState<SelectedPanelTab>(readImportCenterSelectedTab)
  const [selectedSettingsPanelTab, setSelectedSettingsPanelTab] = useState<SettingsPanelTab>('symbol')
  const [storePanelPersistenceEnabled, setStorePanelPersistenceEnabled] = useState(readStorePanelPersistenceEnabled)
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(readWatchlistSymbols)
  const [shortcutMenuEnabled, setShortcutMenuEnabled] = useState(readShortcutMenuEnabled)
  const [selectedStoreTableKey, setSelectedStoreTableKey] = useState(() =>
    readPersistedStoreTableSelection(initialSharedSelection.symbol || initialSnapshot?.selectedSymbol || '', storePanelPersistenceEnabled),
  )
  const autoOpenedStoreTableRef = useRef('')
  const symbolDetailsLoadedRef = useRef(new Set<string>())
  const open = activeDrawer != null
  const [renderedActiveDrawer, setRenderedActiveDrawer] = useState<RightDrawerProps['activeDrawer']>(activeDrawer)
  const {
    columnWidths,
    handleColumnResizePointerDown,
    handleResizePointerDown,
    handleSplitPointerDown,
    handleWatchlistColumnResizePointerDown,
    handleWatchlistTableResizePointerDown,
    resetColumnWidth,
    resetTopPaneHeight,
    resetWatchlistColumnWidth,
    resetWatchlistTableHeight,
    tableWrapRef,
    topPaneHeight,
    watchlistColumnWidths,
    watchlistTableHeight,
    watchlistTableWrapRef,
  } = useRightDrawerResize({ drawerWidth, onResize })
  const {
    canAggregateStoreV5,
    handleAggregateStore,
    handleCancelMt5M1Check,
    handleCancelPullStore,
    handleCheckMt5M1Staged,
    handleCleanLocalM1,
    handleDeleteLocalStore,
    handleDeleteSelectedAggregates,
    handlePullStore,
    handleRefreshStoreStatus,
    localStoreStatus,
    m1CheckJob,
    mt5M1LastCheckedAt,
    pullProgress,
    selectedAggregatePeriods,
    setLocalStoreStatus,
    setMt5M1LastCheckedAt,
    setStoreActionStatus,
    setStoreCheck,
    setStoreCheckError,
    storeCheck,
    storeCheckError,
    storeCheckLoading,
    storeOperationLine,
    storeOperationProgress,
    toggleAggregatePeriod,
    toggleAllAggregatePeriods,
  } = useStoreV5Jobs({
    selectedSymbol,
    selectedRowSymbol: selectedSymbol,
    selectedStoreTableKey,
    storePanelPersistenceEnabled,
    onOpenChart,
  })

  const {
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
  } = useRightDrawerSelection({
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
  })

  const {
    setWatchlistRealtimeEnabled,
    watchlistRealtimeEnabled,
    watchlistRealtimeLog,
    watchlistRealtimeReady,
    watchlistTicks,
  } = useWatchlistRealtime({
    foregroundRealtimeSymbol,
    selectedRowSymbol: selectedRow?.symbol ?? '',
    selectedStoreTableKey,
    storePanelPersistenceEnabled,
    watchlistSymbols: watchlistRows.map((row) => row.symbol),
    setLocalStoreStatus,
    onOpenChart,
  })

  useEffect(() => {
    let frame = 0
    if (!activeDrawer) {
      frame = window.requestAnimationFrame(() => setRenderedActiveDrawer(null))
      return () => window.cancelAnimationFrame(frame)
    }
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        setRenderedActiveDrawer(activeDrawer)
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeDrawer])

  useEffect(() => {
    saveImportCenterQuery(query)
  }, [query])

  useEffect(() => {
    saveImportCenterSelectedTab(selectedPanelTab)
  }, [selectedPanelTab])

  useEffect(() => {
    let cancelled = false

    const loadCachedMt5Symbols = async () => {
      try {
        setLoading(true)
        setError('')
        setStatus(initialSnapshot?.symbols.length ? initialSnapshot.status : '正在读取 MT5 品种缓存...')
        const payload = await fetchMt5Symbols({ limit: 50000, refresh: false })
        if (cancelled) return
        const rows = mergeSymbolRowsWithSnapshot(
          Array.isArray(payload.symbols) ? payload.symbols : [],
          initialSnapshot?.symbols ?? [],
        )
        const nextSelectedSymbol =
          selectedSymbol && rows.some((row) => row.symbol === selectedSymbol)
            ? selectedSymbol
            : rows[0]?.symbol ?? ''
        setSymbols(rows)
        setSelectedSymbol(nextSelectedSymbol)
        const nextStatus = formatSymbolStatus(
          payload.totalCount ?? payload.count ?? rows.length,
          rows.length,
          payload.scanReport ?? payload.cache?.lastScanReport,
        )
        setStatus(nextStatus)
        saveSymbolSnapshot({
          selectedSymbol: nextSelectedSymbol,
          status: nextStatus,
          symbols: rows,
        })
        if (nextSelectedSymbol) {
          const localStatus = await fetchStoreV5Status(nextSelectedSymbol)
          if (cancelled) return
          setLocalStoreStatus(localStatus)
          setSelectedStoreTableKey(readPersistedStoreTableSelection(nextSelectedSymbol, storePanelPersistenceEnabled))
        } else {
          setLocalStoreStatus(null)
          setSelectedStoreTableKey('')
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        setStatus(initialSnapshot?.symbols.length
          ? `${initialSnapshot.status} MT5 缓存刷新失败：${message}`
          : `MT5 品种缓存读取失败：${message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCachedMt5Symbols()
    return () => { cancelled = true }
  // Initial MT5 cache bootstrap intentionally runs once; realtime symbol changes are handled by dedicated selection hooks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedSymbol) return
    const currentRow = symbols.find((row) => row.symbol === selectedSymbol)
    if (hasLoadedSymbolSessions(currentRow)) return
    symbolDetailsLoadedRef.current.delete(selectedSymbol)
    if (symbolDetailsLoadedRef.current.has(selectedSymbol)) return

    let cancelled = false
    symbolDetailsLoadedRef.current.add(selectedSymbol)

    const loadSelectedSymbolDetails = async () => {
      try {
        const payload = await fetchMt5Symbols({ includeSessions: true, limit: 20, query: selectedSymbol, refresh: false })
        if (cancelled) return
        const detailRow = (Array.isArray(payload.symbols) ? payload.symbols : []).find((row) => row.symbol === selectedSymbol)
        if (!detailRow) return
        setSymbols((current) => {
          const next = current.map((row) => row.symbol === selectedSymbol ? { ...row, ...detailRow } : row)
          const merged = next.some((row) => row.symbol === selectedSymbol) ? next : [detailRow, ...next]
          saveSymbolSnapshot({
            selectedSymbol,
            status,
            symbols: merged,
          })
          return merged
        })
      } catch {
        symbolDetailsLoadedRef.current.delete(selectedSymbol)
      }
    }

    void loadSelectedSymbolDetails()
    return () => { cancelled = true }
  }, [selectedSymbol, status, symbols])

  function handleToggleStorePanelPersistence(enabled: boolean) {
    setStorePanelPersistenceEnabled(enabled)
    saveStorePanelPersistenceEnabled(enabled)
    if (!enabled) {
      clearStorePanelPersistence()
      setSelectedStoreTableKey('')
    } else {
      setSelectedStoreTableKey(readPersistedStoreTableSelection(selectedRow?.symbol ?? '', true))
    }
  }

  async function loadSymbols(refresh: boolean) {
    setLoading(true)
    setError('')
    setStatus(refresh ? '正在扫描 MT5 品种...' : '正在读取 MT5 品种缓存...')

    try {
      const payload = await fetchMt5Symbols({ limit: 50000, refresh })
        const rows = mergeSymbolRowsWithSnapshot(Array.isArray(payload.symbols) ? payload.symbols : [], symbols)
      const merge = payload.scanReport ?? payload.cache?.lastScanReport
      const nextSelectedSymbol =
        selectedSymbol && rows.some((row) => row.symbol === selectedSymbol)
          ? selectedSymbol
          : rows[0]?.symbol ?? ''
      const nextStatus = formatSymbolStatus(
        payload.totalCount ?? payload.count ?? rows.length,
        rows.length,
        merge,
      )

      setSymbols(rows)
      setSelectedSymbol(nextSelectedSymbol)
      const persistedCheck = readPersistedM1CheckResult(nextSelectedSymbol, storePanelPersistenceEnabled)
      const persistedStoreStatus = readPersistedStoreV5Status(nextSelectedSymbol, storePanelPersistenceEnabled)
      setStoreCheck(persistedCheck?.payload ?? null)
      setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
      setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
      setSelectedStoreTableKey(readPersistedStoreTableSelection(nextSelectedSymbol, storePanelPersistenceEnabled))
      setStatus(nextStatus)
      saveSymbolSnapshot({
        selectedSymbol: nextSelectedSymbol,
        status: nextStatus,
        symbols: rows,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus(`扫描失败：${message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  function handleSelectSymbol(symbol: string) {
    const persistedCheck = readPersistedM1CheckResult(symbol, storePanelPersistenceEnabled)
    const persistedStoreStatus = readPersistedStoreV5Status(symbol, storePanelPersistenceEnabled)
    const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
    setSelectedSymbol(symbol)
    setStoreCheck(persistedCheck?.payload ?? null)
    setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
    setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
    setSelectedStoreTableKey(storeTableKeyForPeriod(period, visibleStoreTableRows))
    setStoreCheckError('')
    setStoreActionStatus('')
    publishSharedSelection(symbol, period)
    onOpenChart?.({
      symbol,
      period,
      totalRows: null,
    })
    if (symbols.length) {
      saveSymbolSnapshot({
        selectedSymbol: symbol,
        status,
        symbols,
      })
    }
  }

  function handleSetSelectedWatchlistLoaded(loaded: boolean) {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setWatchlistSymbols((current) => {
      const next = loaded
        ? current.includes(symbol) ? current : [...current, symbol]
        : current.filter((item) => item !== symbol)
      saveWatchlistSymbols(next)
      return next
    })
  }

  function handleSetShortcutMenuLoaded(loaded: boolean) {
    if (!loaded) {
      setShortcutMenuEnabled(false)
      saveShortcutMenuEnabled(false)
      return
    }

    if (selectedRow?.symbol && !watchlistSymbols.includes(selectedRow.symbol)) {
      setWatchlistSymbols((current) => {
        const next = current.includes(selectedRow.symbol) ? current : [...current, selectedRow.symbol]
        saveWatchlistSymbols(next)
        return next
      })
    }
    saveShortcutMenuPeriods([...watchlistDirectPeriods, ...watchlistAggregatedPeriods])
    setShortcutMenuEnabled(true)
    saveShortcutMenuEnabled(true)
  }

  function handleOpenStoreTableRow(row: StoreTableRow) {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const key = `${row.kind}-${row.period}`
    setSelectedStoreTableKey(key)
    savePersistedStoreTableSelection(symbol, key, storePanelPersistenceEnabled)
    publishSharedSelection(symbol, row.period)
    onOpenChart?.({
      symbol,
      period: row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
  }

  function handleOpenWatchlistPeriod(row: StoreTableRow) {
    handleOpenStoreTableRow(row)
  }

  return (
    <RightDrawerFrame activeDrawer={activeDrawer} onClose={onClose} onResize={onResize} onResizePointerDown={handleResizePointerDown} onToggleDrawer={onToggleDrawer} open={open} topPaneHeight={topPaneHeight}>
        {renderedActiveDrawer === 'drawings' ? (
          <DrawingsDrawer />
        ) : renderedActiveDrawer === 'objectTree' ? (
          <ObjectTreeDrawer />
        ) : renderedActiveDrawer === 'settings' ? (
          <RightDrawerSettingsHost
            selectedTab={selectedSettingsPanelTab}
            onSelectedTabChange={setSelectedSettingsPanelTab}
          />
        ) : renderedActiveDrawer === 'indicators' ? (
          <IndicatorsDrawer
            indicatorShortcutKeys={indicatorShortcutKeys}
            indicatorsController={indicatorsController}
            loadedIndicatorKeys={loadedIndicatorKeys}
            onIndicatorShortcutKeysChange={onIndicatorShortcutKeysChange}
          />
        ) : renderedActiveDrawer === 'mt5' ? (
          <RightDrawerMt5Body
            canAggregateStoreV5={canAggregateStoreV5}
            columnWidths={columnWidths} error={error} loading={loading}
            localStoreStatus={localStoreStatus} m1CheckJob={m1CheckJob} mt5M1LastCheckedAt={mt5M1LastCheckedAt}
            onAggregateStore={handleAggregateStore}
            onCancelMt5M1Check={handleCancelMt5M1Check} onCancelPullStore={handleCancelPullStore}
            onCheckMt5M1Staged={handleCheckMt5M1Staged} onCleanLocalM1={handleCleanLocalM1}
            onColumnResizePointerDown={handleColumnResizePointerDown}
            onWatchlistColumnResizePointerDown={handleWatchlistColumnResizePointerDown}
            onDeleteLocalStore={handleDeleteLocalStore} onDeleteSelectedAggregates={handleDeleteSelectedAggregates}
            onLoadSymbols={loadSymbols}
            onOpenChart={onOpenChart}
            onOpenStoreTableRow={handleOpenStoreTableRow} onOpenWatchlistPeriod={handleOpenWatchlistPeriod}
            onPullStore={handlePullStore} onRefreshStoreStatus={handleRefreshStoreStatus}
            onRepairM1Gaps={handleRefreshStoreStatus}
            onResetColumnWidth={resetColumnWidth}
            onResetWatchlistColumnWidth={resetWatchlistColumnWidth}
            onResetTopPaneHeight={resetTopPaneHeight} onResetWatchlistHeight={resetWatchlistTableHeight}
            onResizeWatchlistPointerDown={handleWatchlistTableResizePointerDown}
            onSearch={handleSearch} onSelectSymbol={handleSelectSymbol}
            onSetQuery={setQuery}
            onSetSelectedPanelTab={setSelectedPanelTab}
            onSetSelectedWatchlistLoaded={handleSetSelectedWatchlistLoaded}
            onSetShortcutMenuLoaded={handleSetShortcutMenuLoaded} onSplitPointerDown={handleSplitPointerDown}
            onToggleAggregatePeriod={toggleAggregatePeriod} onToggleAllAggregatePeriods={toggleAllAggregatePeriods}
            onToggleRealtime={() => setWatchlistRealtimeEnabled((current) => !current)}
            onToggleStorePanelPersistence={handleToggleStorePanelPersistence}
            pullProgress={pullProgress} query={query} selectedAggregatePeriods={selectedAggregatePeriods}
            selectedDisplay={selectedDisplay} selectedIsInWatchlist={selectedIsInWatchlist}
            selectedPanelTab={selectedPanelTab} selectedRow={selectedRow} selectedStoreTableKey={selectedStoreTableKey}
            selectedStoreTableKeyIsVisible={selectedStoreTableKeyIsVisible}
            selectedSymbol={selectedSymbol} shortcutMenuEnabled={shortcutMenuEnabled} status={status}
            storeCheck={storeCheck} storeCheckError={storeCheckError} storeCheckLoading={storeCheckLoading}
            storeOperationLine={storeOperationLine} storeOperationProgress={storeOperationProgress}
            storePanelPersistenceEnabled={storePanelPersistenceEnabled} storeTableAggregatePeriods={storeTableAggregatePeriods}
            tableWrapRef={tableWrapRef} visibleStoreTableRows={visibleStoreTableRows} visibleSymbols={visibleSymbols}
            watchlistColumnWidths={watchlistColumnWidths}
            watchlistAggregatedPeriods={watchlistAggregatedPeriods}
            watchlistDirectPeriods={watchlistDirectPeriods}
            watchlistRealtimeEnabled={watchlistRealtimeEnabled} watchlistRealtimeLog={watchlistRealtimeLog}
            watchlistRealtimeReady={watchlistRealtimeReady}
            watchlistRows={watchlistRows} watchlistTableHeight={watchlistTableHeight}
            watchlistTableWrapRef={watchlistTableWrapRef} watchlistTicks={watchlistTicks}
          />
        ) : null}
    </RightDrawerFrame>
  )
}





