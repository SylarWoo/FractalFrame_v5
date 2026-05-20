import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import './RightDrawer.css'
import type { ChartLoadState } from '../chart/ChartCoreHost'
import type { SettingsPanelTab } from '../settings/SettingsPanel'
import { resolveMt5SymbolDisplay } from './mt5SymbolDisplay'
import { delay, formatChartLoadStatus, formatCheckTime, formatCount, formatDetailValue, formatEpochSeconds, formatMarketChange, formatMarketPercent, formatMarketPrice, formatStoreOperationLine, formatSymbolStatus, formatUtcRange, normalizeStoredStatus, parseChartJumpTime, periodFromStoreTableKey, resolveLocalM1LastTime, resolveLocalM1Rows, resolveStoreOperationProgress, selectedDetailRows, storeTableKeyForPeriod } from '../mt5DataCenter/storeV5StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV5StatusFormat'
import { clearStorePanelPersistence, getInitialSymbolSnapshot, publishSharedSelection, readImportCenterQuery, readImportCenterSelectedTab, readPersistedM1CheckResult, readPersistedRealtimeSnapshot, readPersistedStoreTableSelection, readPersistedStoreV5Status, readSharedSelection, readShortcutMenuEnabled, readStorePanelPersistenceEnabled, readStoreV5ListSymbols, readWatchlistRealtimeEnabled, readWatchlistSymbols, saveImportCenterQuery, saveImportCenterSelectedTab, savePersistedM1CheckResult, savePersistedRealtimeSnapshot, savePersistedStoreTableSelection, savePersistedStoreV5Status, saveShortcutMenuEnabled, saveShortcutMenuPeriods, saveStorePanelPersistenceEnabled, saveStoreV5ListSymbols, saveSymbolSnapshot, saveWatchlistRealtimeEnabled, saveWatchlistSymbols, sharedSelectionChangedEvent } from '../mt5DataCenter/storeV5Persistence'
import type { SelectedPanelTab, SharedSelection } from '../mt5DataCenter/storeV5Persistence'
import {
  cancelMt5M1CheckJob,
  cancelStoreV5PullJob,
  cleanStoreV5DirectM1,
  createMt5TicksEventSource,
  createStoreV5AggregateEventSource,
  createStoreV5PullEventSource,
  deleteStoreV5AggregatedTimeframes,
  deleteStoreV5Symbol,
  fetchMt5M1CheckJob,
  fetchMt5Symbols,
  fetchStoreV5AggregateJob,
  fetchStoreV5PullJob,
  fetchStoreV5Check,
  fetchStoreV5Status,
  repairStoreV5M1Gaps,
  startStoreV5AggregateJob,
  startStoreV5PullJob,
  startMt5M1CheckJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, Mt5RealtimeTick, Mt5SymbolRow, StoreV5AggregateJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'

type RightDrawerProps = {
  activeDrawer: 'mt5' | 'settings' | null
  chartLoadState?: ChartLoadState | null
  drawerWidth: number
  onClose: () => void
  onJumpChartToTime?: (timestamp: number) => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onResize: (width: number) => void
  onResetChartToLatest?: () => void
  onToggleDrawer: (drawer: 'mt5' | 'settings') => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}

const SettingsPanel = lazy(() => import('../settings/SettingsPanel').then((module) => ({ default: module.SettingsPanel })))

const minDrawerWidth = 220
const maxDrawerWidth = 900
const splitHeightStorageKey = 'fractalframe:mt5ImportCenterTopPaneHeightPx:v1'
const watchlistTableHeightStorageKey = 'fractalframe:mt5ImportCenterWatchlistTableHeightPx:v1'
const columnWidthsStorageKey = 'fractalframe:mt5ImportCenterColumnWidthsPx:v1'
const storeTableAggregatePeriods = ['M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN1']
const storeV5M1RepairLookbackMinutes = 720
const storeV5M1RepairMaxGapMinutes = 720

const defaultColumnWidths = {
  symbol: 96,
  name: 126,
  type: 64,
}

type ColumnKey = keyof typeof defaultColumnWidths
function resolveStoreV5AggregateTargets(status: StoreV5CheckPayload) {
  return status.aggregated
    .map((cell) => String(cell.timeframe || '').toUpperCase())
    .filter((period) => storeTableAggregatePeriods.includes(period))
}

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '细节' },
  { key: 'store', label: '仓库' },
  { key: 'watchlist', label: '自选列表' },
  { key: 'settings', label: '设置' },
]
function clampDrawerWidth(width: number) {
  return Math.max(minDrawerWidth, Math.min(maxDrawerWidth, Math.round(width)))
}

function getInitialTopPaneHeight() {
  const fallbackHeight = 430

  try {
    const raw = window.localStorage.getItem(splitHeightStorageKey)
    const value = raw == null ? fallbackHeight : Number(raw)
    return Math.max(180, Math.min(760, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialWatchlistTableHeight() {
  const fallbackHeight = 228

  try {
    const raw = window.localStorage.getItem(watchlistTableHeightStorageKey)
    const value = raw == null ? fallbackHeight : Number(raw)
    return Math.max(96, Math.min(1200, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialColumnWidths() {
  try {
    const raw = window.localStorage.getItem(columnWidthsStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
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

function clampColumnWidth(width: number, column: ColumnKey) {
  const minByColumn: Record<ColumnKey, number> = {
    symbol: 46,
    name: 52,
    type: 40,
  }
  const maxByColumn: Record<ColumnKey, number> = {
    symbol: 180,
    name: 260,
    type: 140,
  }
  const fallback = defaultColumnWidths[column]
  const value = Number.isFinite(width) ? width : fallback
  return Math.max(minByColumn[column], Math.min(maxByColumn[column], Math.round(value)))
}

export function RightDrawer({
  activeDrawer,
  chartLoadState,
  drawerWidth,
  onClose,
  onJumpChartToTime,
  onLoadChartStep,
  onResize,
  onResetChartToLatest,
  onToggleDrawer,
  onOpenChart,
}: RightDrawerProps) {
  const initialSnapshot = useMemo(getInitialSymbolSnapshot, [])
  const initialRealtimeSnapshot = useMemo(readPersistedRealtimeSnapshot, [])
  const initialSharedSelection = useMemo(readSharedSelection, [])
  const [query, setQuery] = useState(readImportCenterQuery)
  const [symbols, setSymbols] = useState<Mt5SymbolRow[]>(() => initialSnapshot?.symbols ?? [])
  const [selectedSymbol, setSelectedSymbol] = useState(() => initialSharedSelection.symbol || initialSnapshot?.selectedSymbol || '')
  const [status, setStatus] = useState(
    () => normalizeStoredStatus(initialSnapshot?.status ?? '', initialSnapshot?.symbols.length ?? 0),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topPaneHeight, setTopPaneHeight] = useState(getInitialTopPaneHeight)
  const [watchlistTableHeight, setWatchlistTableHeight] = useState(getInitialWatchlistTableHeight)
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths)
  const [selectedPanelTab, setSelectedPanelTab] = useState<SelectedPanelTab>(readImportCenterSelectedTab)
  const [selectedSettingsPanelTab, setSelectedSettingsPanelTab] = useState<SettingsPanelTab>('symbol')
  const [storePanelPersistenceEnabled, setStorePanelPersistenceEnabled] = useState(readStorePanelPersistenceEnabled)
  const initialPersistedM1Check = useMemo(
    () => readPersistedM1CheckResult(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const initialPersistedStoreV5Status = useMemo(
    () => readPersistedStoreV5Status(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const [storeCheck, setStoreCheck] = useState<StoreV5CheckPayload | null>(() => initialPersistedM1Check?.payload ?? null)
  const [mt5M1LastCheckedAt, setMt5M1LastCheckedAt] = useState(() => initialPersistedM1Check?.checkedAt ?? '')
  const [localStoreStatus, setLocalStoreStatus] = useState<StoreV5CheckPayload | null>(() => initialPersistedStoreV5Status?.payload ?? null)
  const [storeV5ListSymbols, setStoreV5ListSymbols] = useState<string[]>(() => readStoreV5ListSymbols(storePanelPersistenceEnabled))
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(readWatchlistSymbols)
  const [watchlistRealtimeEnabled, setWatchlistRealtimeEnabled] = useState(readWatchlistRealtimeEnabled)
  const [watchlistRealtimeReady, setWatchlistRealtimeReady] = useState(false)
  const [watchlistRealtimeStatus, setWatchlistRealtimeStatus] = useState('')
  const [watchlistRealtimeLog, setWatchlistRealtimeLog] = useState<string[]>(() => initialRealtimeSnapshot.log ?? [])
  const [watchlistTicks, setWatchlistTicks] = useState<Record<string, Mt5RealtimeTick>>(() => initialRealtimeSnapshot.ticks ?? {})
  const [watchlistLastTickAt, setWatchlistLastTickAt] = useState(() => initialRealtimeSnapshot.lastTickAt ?? '')
  const [shortcutMenuEnabled, setShortcutMenuEnabled] = useState(readShortcutMenuEnabled)
  const [selectedStoreTableKey, setSelectedStoreTableKey] = useState(() =>
    readPersistedStoreTableSelection(initialSharedSelection.symbol || initialSnapshot?.selectedSymbol || '', storePanelPersistenceEnabled),
  )
  const [selectedAggregatePeriods, setSelectedAggregatePeriods] = useState<string[]>([])
  const [storeCheckLoading, setStoreCheckLoading] = useState(false)
  const [storeCheckError, setStoreCheckError] = useState('')
  const [storeActionStatus, setStoreActionStatus] = useState('')
  const [chartJumpInput, setChartJumpInput] = useState('')
  const [chartJumpError, setChartJumpError] = useState('')
  const [m1CheckJob, setM1CheckJob] = useState<Mt5M1CheckJobPayload | null>(null)
  const [pullProgress, setPullProgress] = useState<StoreV5PullJobPayload | null>(null)
  const [aggregateProgress, setAggregateProgress] = useState<StoreV5AggregateJobPayload | null>(null)
  const tableWrapRef = useRef<HTMLDivElement | null>(null)
  const activeM1CheckJobRef = useRef('')
  const activePullJobRef = useRef('')
  const activeAggregateJobRef = useRef('')
  const autoOpenedStoreTableRef = useRef('')
  const pullEventSourceRef = useRef<EventSource | null>(null)
  const aggregateEventSourceRef = useRef<EventSource | null>(null)
  const open = activeDrawer != null
  const watchlistTicksEventSourceRef = useRef<EventSource | null>(null)
  const watchlistRealtimeRunRef = useRef(0)

  const visibleSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return symbols
    return symbols.filter((row) => {
      const display = resolveMt5SymbolDisplay(row)
      return [
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
        .includes(normalizedQuery)
    })
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

  function pushWatchlistRealtimeLog(message: string) {
    const timestamp = new Date().toLocaleTimeString()
    setWatchlistRealtimeLog((current) => [`${timestamp}  ${message}`, ...current].slice(0, 8))
  }

  const visibleStoreAggregateRows = useMemo(() => {
    const cellsByPeriod = new Map(
      (localStoreStatus?.aggregated ?? [])
        .filter((cell) => typeof cell.timeframe === 'string')
        .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
    )
    return storeTableAggregatePeriods.map((period) => {
      const cell = cellsByPeriod.get(period)
      return {
        period,
        count: formatCount(cell?.rowsCount),
        updated: cell ? formatEpochSeconds(cell.lastTime) : '未聚合',
        rowsCount: cell?.rowsCount ?? null,
      }
    })
  }, [localStoreStatus])
  const visibleStoreTableRows = useMemo<StoreTableRow[]>(() => {
    const rows: StoreTableRow[] = []
    if (selectedRow?.symbol && storeV5ListSymbols.includes(selectedRow.symbol)) {
      const rowsCount = resolveLocalM1Rows(localStoreStatus)
      rows.push({
        period: 'M1',
        count: formatCount(rowsCount),
        updated: formatEpochSeconds(resolveLocalM1LastTime(localStoreStatus)),
        kind: 'm1',
        rowsCount,
      })
    }
    return [...rows, ...visibleStoreAggregateRows.map((row) => ({
      ...row,
      kind: 'aggregate' as const,
      rowsCount: row.rowsCount,
    }))]
  }, [localStoreStatus, selectedRow?.symbol, storeV5ListSymbols, visibleStoreAggregateRows])
  const watchlistDirectPeriods = useMemo<StoreTableRow[]>(() => {
    const rowsCount = resolveLocalM1Rows(localStoreStatus)
    if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
    return [{
      period: 'M1',
      count: formatCount(rowsCount),
      updated: formatEpochSeconds(resolveLocalM1LastTime(localStoreStatus)),
      kind: 'm1',
      rowsCount,
    }]
  }, [localStoreStatus])
  const watchlistAggregatedPeriods = useMemo<StoreTableRow[]>(() => {
    const cellsByPeriod = new Map(
      (localStoreStatus?.aggregated ?? [])
        .filter((cell) => typeof cell.timeframe === 'string')
        .map((cell) => [String(cell.timeframe).toUpperCase(), cell]),
    )
    return storeTableAggregatePeriods.flatMap((period) => {
      const cell = cellsByPeriod.get(period)
      const rowsCount = cell?.rowsCount
      if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
      return [{
        period,
        count: formatCount(rowsCount),
        updated: formatEpochSeconds(cell?.lastTime),
        kind: 'aggregate' as const,
        rowsCount,
      }]
    })
  }, [localStoreStatus])
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
        const persistedStoreStatus = readPersistedStoreV5Status(nextSymbol, storePanelPersistenceEnabled)
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
  }, [selectedSymbol, status, storePanelPersistenceEnabled, symbols, visibleStoreTableRows])

  useEffect(() => {
    if (!shortcutMenuEnabled) return
    saveShortcutMenuPeriods([...watchlistDirectPeriods, ...watchlistAggregatedPeriods])
  }, [shortcutMenuEnabled, watchlistAggregatedPeriods, watchlistDirectPeriods])

  useEffect(() => {
    const shared = readSharedSelection()
    if (!shared.period) return
    const nextKey = storeTableKeyForPeriod(shared.period, visibleStoreTableRows)
    if (selectedStoreTableKey !== nextKey) setSelectedStoreTableKey(nextKey)
  }, [selectedStoreTableKey, visibleStoreTableRows])

  useEffect(() => {
    if (!selectedRow?.symbol || !selectedStoreTableKeyIsVisible || !selectedStoreTableKey) return

    const autoOpenKey = `${selectedRow.symbol}:${selectedStoreTableKey}`
    if (autoOpenedStoreTableRef.current === autoOpenKey) return

    const row = visibleStoreTableRows.find((item) => `${item.kind}-${item.period}` === selectedStoreTableKey)
    if (!row) return

    autoOpenedStoreTableRef.current = autoOpenKey
    onOpenChart?.({
      symbol: selectedRow.symbol,
      period: row.period === 'M1' ? '1m' : row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
  }, [onOpenChart, selectedRow?.symbol, selectedStoreTableKey, selectedStoreTableKeyIsVisible, visibleStoreTableRows])

  useEffect(() => {
    saveImportCenterQuery(query)
  }, [query])

  useEffect(() => {
    saveImportCenterSelectedTab(selectedPanelTab)
  }, [selectedPanelTab])

  useEffect(() => {
    saveWatchlistRealtimeEnabled(watchlistRealtimeEnabled)
  }, [watchlistRealtimeEnabled])

  useEffect(() => {
    savePersistedRealtimeSnapshot({
      lastTickAt: watchlistLastTickAt,
      log: watchlistRealtimeLog,
      ticks: watchlistTicks,
    })
  }, [watchlistLastTickAt, watchlistRealtimeLog, watchlistTicks])

  useEffect(() => {
    if (!watchlistRealtimeEnabled) {
      watchlistRealtimeRunRef.current += 1
      setWatchlistRealtimeReady(false)
      setWatchlistRealtimeStatus('')
      pushWatchlistRealtimeLog('Realtime stopped')
      return
    }

    if (!foregroundRealtimeSymbol) {
      setWatchlistRealtimeReady(false)
      setWatchlistRealtimeStatus('No symbols')
      pushWatchlistRealtimeLog('No foreground symbol, realtime not started')
      return
    }

    const runId = watchlistRealtimeRunRef.current + 1
    watchlistRealtimeRunRef.current = runId
    setWatchlistRealtimeReady(false)
    setWatchlistRealtimeStatus('Syncing')
    setWatchlistRealtimeLog([])
    pushWatchlistRealtimeLog(`Realtime requested for foreground symbol ${foregroundRealtimeSymbol}`)

    const waitForPullJob = (jobId: string, symbol: string) => new Promise<void>((resolve, reject) => {
      const source = createStoreV5PullEventSource(jobId)

      const cleanup = () => source.close()
      const fail = (message: string) => {
        cleanup()
        reject(new Error(message))
      }

      source.addEventListener('progress', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as StoreV5PullJobPayload
          if (watchlistRealtimeRunRef.current !== runId) {
            cleanup()
            resolve()
            return
          }
          const line = `${symbol} ${payload.progressLabel || payload.status || 'Pulling M1'}`
          setWatchlistRealtimeStatus(line)
          pushWatchlistRealtimeLog(line)
        } catch {
          setWatchlistRealtimeStatus(`${symbol} Pulling M1`)
        }
      })
      source.addEventListener('done', () => {
        pushWatchlistRealtimeLog(`${symbol} M1 gap fill completed`)
        cleanup()
        resolve()
      })
      source.addEventListener('cancelled', () => fail(`${symbol} pull cancelled`))
      source.addEventListener('error', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
          fail(payload.error || payload.status || `${symbol} pull failed`)
        } catch {
          fail(`${symbol} pull failed`)
        }
      })
      source.onerror = () => fail(`${symbol} pull disconnected`)
    })

    const waitForAggregateJob = (jobId: string, symbol: string) => new Promise<void>((resolve, reject) => {
      const source = createStoreV5AggregateEventSource(jobId)

      const cleanup = () => source.close()
      const fail = (message: string) => {
        cleanup()
        reject(new Error(message))
      }

      source.addEventListener('progress', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as StoreV5AggregateJobPayload
          if (watchlistRealtimeRunRef.current !== runId) {
            cleanup()
            resolve()
            return
          }
          const line = `${symbol} ${payload.progressLabel || payload.status || 'Aggregating'}`
          setWatchlistRealtimeStatus(line)
          pushWatchlistRealtimeLog(line)
        } catch {
          setWatchlistRealtimeStatus(`${symbol} Aggregating`)
        }
      })
      source.addEventListener('done', () => {
        pushWatchlistRealtimeLog(`${symbol} aggregation completed`)
        cleanup()
        resolve()
      })
      source.addEventListener('cancelled', () => fail(`${symbol} aggregate cancelled`))
      source.addEventListener('error', (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
          fail(payload.error || payload.status || `${symbol} aggregate failed`)
        } catch {
          fail(`${symbol} aggregate failed`)
        }
      })
      source.onerror = () => fail(`${symbol} aggregate disconnected`)
    })

    const runRealtimeSync = async () => {
      try {
        for (const symbol of [foregroundRealtimeSymbol]) {
          if (watchlistRealtimeRunRef.current !== runId) return

          setWatchlistRealtimeStatus(`${symbol} checking store`)
          pushWatchlistRealtimeLog(`${symbol} checking local StoreV5 status`)
          const statusPayload = await fetchStoreV5Status(symbol)
          const hasLocalM1 = typeof resolveLocalM1Rows(statusPayload) === 'number'
            && Number(resolveLocalM1Rows(statusPayload)) > 0

          setWatchlistRealtimeStatus(`${symbol} pulling missing M1`)
          pushWatchlistRealtimeLog(`${symbol} ${hasLocalM1 ? 'incremental M1 gap fill started' : 'full M1 download started'}`)
          const pullJob = await startStoreV5PullJob(symbol, hasLocalM1 ? 'incremental' : 'refresh')
          await waitForPullJob(pullJob.jobId, symbol)
          if (watchlistRealtimeRunRef.current !== runId) return

          setWatchlistRealtimeStatus(`${symbol} repairing M1 gaps`)
          pushWatchlistRealtimeLog(`${symbol} scanning and repairing recent M1 window`)
          const gapRepair = await repairStoreV5M1Gaps(symbol, {
            lookbackMinutes: storeV5M1RepairLookbackMinutes,
            maxGapMinutes: storeV5M1RepairMaxGapMinutes,
          })
          if ((gapRepair.gapsDetected ?? 0) > 0) {
            pushWatchlistRealtimeLog(
              `${symbol} gap repair: ${gapRepair.gapsDetected ?? 0} gaps, ${gapRepair.rowsWritten ?? 0} rows written`,
            )
          } else {
            pushWatchlistRealtimeLog(`${symbol} M1 recent window repaired, ${gapRepair.rowsWritten ?? 0} rows written`)
          }

          const statusAfterPull = await fetchStoreV5Status(symbol)

          const aggregateTargets = resolveStoreV5AggregateTargets(statusAfterPull)

          if (aggregateTargets.length) {
            setWatchlistRealtimeStatus(`${symbol} aggregating periods`)
            pushWatchlistRealtimeLog(`${symbol} aggregating ${aggregateTargets.join(', ')}`)
            const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets)
            await waitForAggregateJob(aggregateJob.jobId, symbol)
          } else {
            pushWatchlistRealtimeLog(`${symbol} no aggregate periods to rebuild`)
          }

          const statusAfterSync = await fetchStoreV5Status(symbol)
          if (symbol === selectedRow?.symbol) {
            setLocalStoreStatus(statusAfterSync)
            savePersistedStoreV5Status(symbol, statusAfterSync, new Date().toISOString(), storePanelPersistenceEnabled)
          }
        }

        if (watchlistRealtimeRunRef.current !== runId) return
        setWatchlistRealtimeReady(true)
        setWatchlistRealtimeStatus('Starting realtime')
        const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
        const latestStatus = await fetchStoreV5Status(foregroundRealtimeSymbol)
        const rowsForPeriod = period === 'M1'
          ? resolveLocalM1Rows(latestStatus)
          : latestStatus.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
        onOpenChart?.({
          symbol: foregroundRealtimeSymbol,
          period: period === 'M1' ? '1m' : period,
          totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
          reloadId: Date.now(),
        })
        pushWatchlistRealtimeLog('Gap fill and aggregation completed, starting tick realtime')
      } catch (error) {
        if (watchlistRealtimeRunRef.current !== runId) return
        setWatchlistRealtimeReady(false)
        setWatchlistRealtimeEnabled(false)
        setWatchlistRealtimeStatus(error instanceof Error ? error.message : 'Sync failed')
        pushWatchlistRealtimeLog(error instanceof Error ? `Realtime failed: ${error.message}` : 'Realtime failed')
      }
    }

    void runRealtimeSync()

    return () => {
      if (watchlistRealtimeRunRef.current === runId) {
        watchlistRealtimeRunRef.current += 1
      }
    }
  }, [foregroundRealtimeSymbol, onOpenChart, selectedStoreTableKey, watchlistRealtimeEnabled])

  useEffect(() => {
    watchlistTicksEventSourceRef.current?.close()
    watchlistTicksEventSourceRef.current = null

    if (!watchlistRealtimeEnabled || !watchlistRealtimeReady) return

    setWatchlistRealtimeStatus('Connecting')
    if (!foregroundRealtimeSymbol) return

    const source = createMt5TicksEventSource([foregroundRealtimeSymbol], 500)
    watchlistTicksEventSourceRef.current = source

    source.addEventListener('ready', () => {
      setWatchlistRealtimeStatus('Live')
      pushWatchlistRealtimeLog('Realtime feed connected')
    })

    source.addEventListener('ticks', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { ticks?: Mt5RealtimeTick[] }
        const ticks = Array.isArray(payload.ticks) ? payload.ticks : []
        if (!ticks.length) return
        const updatedSymbols = ticks.map((tick) => tick.symbol).filter(Boolean)
        setWatchlistTicks((current) => {
          const next = { ...current }
          ticks.forEach((tick) => {
            if (tick.symbol) next[tick.symbol] = tick
          })
          return next
        })
        ticks.forEach((tick) => {
          if (!tick.symbol) return
          window.dispatchEvent(new CustomEvent('fractalframe:mt5RealtimeTick', { detail: tick }))
        })
        if (updatedSymbols.length) {
          setWatchlistLastTickAt(new Date().toLocaleTimeString())
        }
        setWatchlistRealtimeStatus('Live')
      } catch {
        setWatchlistRealtimeStatus('Parse error')
        pushWatchlistRealtimeLog('Realtime tick parse error')
      }
    })

    source.addEventListener('error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
        const line = payload.error || payload.status || 'Error'
        setWatchlistRealtimeStatus(line)
        pushWatchlistRealtimeLog(`Realtime error: ${line}`)
      } catch {
        setWatchlistRealtimeStatus('Disconnected')
        pushWatchlistRealtimeLog('Realtime disconnected')
      }
    })

    source.onerror = () => {
      setWatchlistRealtimeStatus('Reconnecting')
      pushWatchlistRealtimeLog('Realtime reconnecting')
    }

    return () => {
      source.close()
      if (watchlistTicksEventSourceRef.current === source) {
        watchlistTicksEventSourceRef.current = null
      }
    }
  }, [foregroundRealtimeSymbol, watchlistRealtimeEnabled, watchlistRealtimeReady])

  const storeOperationLine = useMemo(
    () => formatStoreOperationLine(pullProgress, m1CheckJob, aggregateProgress, storeActionStatus),
    [aggregateProgress, m1CheckJob, pullProgress, storeActionStatus],
  )
  const storeOperationProgress = useMemo(
    () => resolveStoreOperationProgress(pullProgress, m1CheckJob, aggregateProgress),
    [aggregateProgress, m1CheckJob, pullProgress],
  )
  const isCheckingMt5M1 = storeCheckLoading && m1CheckJob != null
  const isPullingStoreV5 = storeCheckLoading && pullProgress != null
  const canAggregateStoreV5 = localStoreStatus?.directM1?.status !== 'raw_m1_ready_clean_pending'
    && localStoreStatus?.directM1?.datasetKey?.includes(':direct:M1') === true

  function handleToggleStorePanelPersistence(enabled: boolean) {
    setStorePanelPersistenceEnabled(enabled)
    saveStorePanelPersistenceEnabled(enabled)
    if (!enabled) {
      clearStorePanelPersistence()
      setSelectedStoreTableKey('')
    } else {
      setStoreV5ListSymbols(readStoreV5ListSymbols(true))
      setSelectedStoreTableKey(readPersistedStoreTableSelection(selectedRow?.symbol ?? '', true))
    }
  }

  async function loadSymbols(refresh: boolean) {
    setLoading(true)
    setError('')
    setStatus(refresh ? '正在扫描 MT5 品种...' : '正在读取 MT5 品种缓存...')

    try {
      const payload = await fetchMt5Symbols({ limit: 50000, refresh })
      const rows = Array.isArray(payload.symbols) ? payload.symbols : []
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
      setSymbols([])
      setSelectedSymbol('')
      setError(message)
      setStatus(`扫描失败：${message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = drawerWidth
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      onResize(clampDrawerWidth(startWidth - deltaX))
      window.dispatchEvent(new Event('resize'))
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
      window.dispatchEvent(new Event('resize'))
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = topPaneHeight
    const drawer = event.currentTarget.closest('.ff-right-drawer')
    const maxHeight = Math.max(220, (drawer?.clientHeight ?? 760) - 190)
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-splitting', 'true')
    handle.setAttribute('data-dragging', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      const next = Math.max(180, Math.min(maxHeight, Math.round(startHeight + deltaY)))
      setTopPaneHeight(next)
      try {
        window.localStorage.setItem(splitHeightStorageKey, String(next))
      } catch {
        // Split persistence is best-effort only.
      }
    }

    const finishSplit = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishSplit)
      ownerDocument.removeEventListener('pointercancel', finishSplit)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-splitting')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishSplit)
    ownerDocument.addEventListener('pointercancel', finishSplit)
  }

  function handleColumnResizePointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    column: ColumnKey,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const tableWrap = tableWrapRef.current
    const tableWidth = tableWrap?.clientWidth ?? 0
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-mt5-column-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      setColumnWidths((current) => {
        const otherColumnsWidth = Object.entries(current).reduce((sum, [key, value]) => {
          return key === column ? sum : sum + value
        }, 0)
        const maxToKeepTableFilled = Math.max(
          defaultColumnWidths[column],
          tableWidth - otherColumnsWidth - 90,
        )
        const next = {
          ...current,
          [column]: Math.min(clampColumnWidth(startWidth + deltaX, column), maxToKeepTableFilled),
        }
        try {
          window.localStorage.setItem(columnWidthsStorageKey, JSON.stringify(next))
        } catch {
          // Column width persistence is best-effort only.
        }
        return next
      })
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-mt5-column-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function handleWatchlistTableResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = watchlistTableHeight
    const drawer = event.currentTarget.closest('.ff-right-drawer')
    const tableWrap = event.currentTarget.previousElementSibling as HTMLElement | null
    const drawerBottom = drawer?.getBoundingClientRect().bottom ?? window.innerHeight
    const tableTop = tableWrap?.getBoundingClientRect().top ?? event.clientY
    const maxHeight = Math.max(96, Math.round(drawerBottom - tableTop - 14))
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-splitting', 'true')
    handle.setAttribute('data-dragging', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      const next = Math.max(96, Math.min(maxHeight, Math.round(startHeight + deltaY)))
      setWatchlistTableHeight(next)
      try {
        window.localStorage.setItem(watchlistTableHeightStorageKey, String(next))
      } catch {
        // Watchlist table height persistence is best-effort only.
      }
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-splitting')
      handle.removeAttribute('data-dragging')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function resetColumnWidth(column: ColumnKey) {
    setColumnWidths((current) => {
      const next = { ...current, [column]: defaultColumnWidths[column] }
      try {
        window.localStorage.setItem(columnWidthsStorageKey, JSON.stringify(next))
      } catch {
        // Column width persistence is best-effort only.
      }
      return next
    })
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
      period: period === 'M1' ? '1m' : period,
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

  async function handleCheckMt5M1() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setStoreActionStatus('正在检查 MT5 终端 M1...')

    try {
      const payload = await fetchStoreV5Check(symbol)
      setStoreCheck(payload)
      setStoreActionStatus('MT5 终端 M1 检查完成。')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreCheck(null)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  void handleCheckMt5M1

  async function handleCheckMt5M1Staged() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setStoreActionStatus('')

    try {
      const previous = storeCheck?.directM1
      const canIncremental = previous?.lastTime != null && (previous.trueM1RowsCount != null || previous.rowsCount != null)
      const started = await startMt5M1CheckJob(symbol, canIncremental
        ? {
            chunk: 200000,
            maxCount: 10000000,
            mode: 'incremental',
            sinceTime: previous.lastTime,
            baseFirstTime: previous.firstTime,
            baseLastTime: previous.lastTime,
            baseTrueM1RowsCount: previous.trueM1RowsCount ?? previous.rowsCount,
            baseMt5RowsCount: previous.mt5RowsCount ?? previous.trueM1RowsCount ?? previous.rowsCount,
            overlapBars: 1000,
          }
        : { chunk: 200000, maxCount: 10000000, mode: 'refresh' })
      activeM1CheckJobRef.current = started.jobId
      setM1CheckJob(started)

      while (activeM1CheckJobRef.current === started.jobId) {
        await delay(600)
        const current = await fetchMt5M1CheckJob(started.jobId)
        setM1CheckJob(current)
        if (current.phase === 'completed') {
          if (current.result) {
            const checkedAt = new Date().toISOString()
            setStoreCheck(current.result)
            setMt5M1LastCheckedAt(checkedAt)
            savePersistedM1CheckResult(symbol, current.result, checkedAt, storePanelPersistenceEnabled)
          }
          setM1CheckJob(null)
          break
        }
        if (current.phase === 'failed' || current.phase === 'cancelled') {
          throw new Error(current.error || current.status || current.phase)
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      activeM1CheckJobRef.current = ''
      setPullProgress(null)
      setStoreCheckLoading(false)
    }
  }

  async function handleCancelMt5M1Check() {
    const jobId = m1CheckJob?.jobId
    if (!jobId) return
    activeM1CheckJobRef.current = ''
    try {
      const payload = await cancelMt5M1CheckJob(jobId)
      setM1CheckJob(payload)
      setStoreActionStatus('')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    } finally {
      setM1CheckJob(null)
      setStoreCheckLoading(false)
    }
  }

  async function handleCancelPullStore() {
    const jobId = pullProgress?.jobId
    if (!jobId) return
    activePullJobRef.current = ''
    try {
      pullEventSourceRef.current?.close()
    } catch {
      // best effort
    }
    pullEventSourceRef.current = null
    setPullProgress(null)
    setStoreCheckLoading(false)
    setStoreActionStatus('已取消')
    try {
      await cancelStoreV5PullJob(jobId)
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    }
  }

  function waitStoreV5PullJobBySse(jobId: string) {
    return new Promise<StoreV5PullJobPayload>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        try {
          pullEventSourceRef.current?.close()
        } catch {
          // best effort
        }
        pullEventSourceRef.current = null
        fn()
      }
      const applyPayload = (event: MessageEvent) => {
        if (activePullJobRef.current !== jobId) return null
        const payload = JSON.parse(event.data || '{}') as StoreV5PullJobPayload
        setPullProgress(payload)
        return payload
      }

      try {
        const source = createStoreV5PullEventSource(jobId)
        pullEventSourceRef.current = source
        source.addEventListener('progress', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed progress
          }
        })
        source.addEventListener('done', (event) => {
          try {
            const payload = applyPayload(event as MessageEvent)
            finish(() => resolve(payload as StoreV5PullJobPayload))
          } catch (err) {
            finish(() => reject(err))
          }
        })
        source.addEventListener('cancelled', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed cancelled payload
          }
          finish(() => reject(new Error('store_v5_pull_cancelled')))
        })
        source.addEventListener('error', (event) => {
          const messageEvent = event as MessageEvent
          if (messageEvent.data) {
            try {
              const payload = applyPayload(messageEvent)
              finish(() => reject(new Error(payload?.error || payload?.status || 'store_v5_pull_failed')))
              return
            } catch {
              // fall through to generic error
            }
          }
          if (!settled && activePullJobRef.current === jobId) {
            finish(() => reject(new Error('store_v5_pull_sse_disconnected')))
          }
        })
      } catch (err) {
        finish(() => reject(err))
      }
    })
  }

  async function waitStoreV5PullJobByPolling(jobId: string) {
    while (activePullJobRef.current === jobId) {
      await delay(600)
      const current = await fetchStoreV5PullJob(jobId)
      setPullProgress(current)
      if (current.phase === 'completed') return current
      if (current.phase === 'failed' || current.phase === 'cancelled') {
        throw new Error(current.error || current.status || current.phase)
      }
    }
    throw new Error('store_v5_pull_cancelled')
  }

  async function handleRefreshStoreStatus() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Reading StoreV5 status...')
    try {
      setStoreActionStatus('Scanning and repairing M1 gaps...')
      const gapRepair = await repairStoreV5M1Gaps(symbol, {
        lookbackMinutes: storeV5M1RepairLookbackMinutes,
        maxGapMinutes: storeV5M1RepairMaxGapMinutes,
      })
      setStoreActionStatus(
        (gapRepair.gapsDetected ?? 0) > 0
          ? `M1 gap repair complete: found ${gapRepair.gapsDetected ?? 0} gaps, wrote ${gapRepair.rowsWritten ?? 0} rows.`
          : 'M1 gap check complete: no recent middle gaps.',
      )
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
      const rowsForPeriod = period === 'M1'
        ? resolveLocalM1Rows(payload)
        : payload.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
      onOpenChart?.({
        symbol,
        period: period === 'M1' ? '1m' : period,
        totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
        reloadId: Date.now(),
      })
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus((current) => (current.includes('refresh') ? '' : current))
      }, 1600)
      setStoreActionStatus('StoreV5 status refreshed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      activeAggregateJobRef.current = ''
      try {
        aggregateEventSourceRef.current?.close()
      } catch {
        // best effort
      }
      aggregateEventSourceRef.current = null
      setStoreCheckLoading(false)
    }
  }

  async function handlePullStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setM1CheckJob(null)
    setPullProgress(null)
    setStoreActionStatus('Pulling MT5 M1 into StoreV5...')
    try {
      let pullMode = 'refresh'
      try {
        const currentStore = await fetchStoreV5Status(symbol)
        if (
          currentStore.rawDirectM1?.lastTime != null ||
          currentStore.rawDirectM1?.rowsCount != null ||
          currentStore.directM1?.lastTime != null ||
          currentStore.directM1?.rowsCount != null
        ) {
          pullMode = 'incremental'
        }
      } catch {
        pullMode = 'refresh'
      }
      setStoreActionStatus(
        pullMode === 'incremental'
          ? 'Incremental MT5 M1 pull into StoreV5...'
          : 'Initial MT5 M1 pull into StoreV5...',
      )
      const started = await startStoreV5PullJob(symbol, pullMode)
      activePullJobRef.current = started.jobId
      setPullProgress(started)
      try {
        await waitStoreV5PullJobBySse(started.jobId)
      } catch (err) {
        if (activePullJobRef.current !== started.jobId) throw err
        await waitStoreV5PullJobByPolling(started.jobId)
      }
      setStoreActionStatus('Scanning and repairing recent M1 window...')
      await repairStoreV5M1Gaps(symbol, {
        lookbackMinutes: storeV5M1RepairLookbackMinutes,
        maxGapMinutes: storeV5M1RepairMaxGapMinutes,
      })

      const repairedStatus = await fetchStoreV5Status(symbol)
      const aggregateTargets = resolveStoreV5AggregateTargets(repairedStatus)
      if (aggregateTargets.length) {
        setStoreActionStatus(`Aggregating periods: ${aggregateTargets.join(', ')}...`)
        const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets)
        activeAggregateJobRef.current = aggregateJob.jobId
        setAggregateProgress(aggregateJob)
        try {
          await waitStoreV5AggregateJobBySse(aggregateJob.jobId)
        } catch (err) {
          if (activeAggregateJobRef.current !== aggregateJob.jobId) throw err
          await waitStoreV5AggregateJobByPolling(aggregateJob.jobId)
        }
      }
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
      const rowsForPeriod = period === 'M1'
        ? resolveLocalM1Rows(payload)
        : payload.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
      onOpenChart?.({
        symbol,
        period: period === 'M1' ? '1m' : period,
        totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
        reloadId: Date.now(),
      })
      setStoreActionStatus('Pull complete. Store status refreshed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      activePullJobRef.current = ''
      try {
        pullEventSourceRef.current?.close()
      } catch {
        // best effort
      }
      pullEventSourceRef.current = null
      activeAggregateJobRef.current = ''
      try {
        aggregateEventSourceRef.current?.close()
      } catch {
        // best effort
      }
      aggregateEventSourceRef.current = null
      setPullProgress(null)
      setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteLocalStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const ok = window.confirm(`Delete local StoreV5 data for ${symbol}? This clears local M1 and aggregated periods.`)
    if (!ok) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Deleting local StoreV5 data...')
    try {
      await deleteStoreV5Symbol(symbol)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('Local StoreV5 data deleted.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteSelectedAggregates() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const periods = [...selectedAggregatePeriods]
    if (!periods.length) {
      setStoreCheckError('Select aggregated periods to delete first.')
      return
    }
    const ok = window.confirm(`Delete aggregated periods for ${symbol}: ${periods.join(', ')}? M1 will not be deleted.`)
    if (!ok) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(null)
    setStoreActionStatus(`Deleting aggregated periods: ${periods.join(', ')}...`)
    try {
      await deleteStoreV5AggregatedTimeframes(symbol, periods)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus(`Deleted aggregated periods: ${periods.join(', ')}.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleCleanLocalM1() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Cleaning invalid 1-minute data...')
    try {
      await cleanStoreV5DirectM1(symbol)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('Local M1 cleaned and aligned with true M1 data.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  function handleAddM1ToStoreList() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    setStoreV5ListSymbols((current) => {
      const next = current.includes(symbol) ? current : [...current, symbol]
      saveStoreV5ListSymbols(next, storePanelPersistenceEnabled)
      return next
    })
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
      period: row.period === 'M1' ? '1m' : row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
  }

  function handleOpenWatchlistPeriod(row: StoreTableRow) {
    handleOpenStoreTableRow(row)
  }

  function handleJumpChartToTime() {
    const timestamp = parseChartJumpTime(chartJumpInput)
    if (timestamp == null) {
      setChartJumpError('请输入 YYYY-MM-DD HH:mm')
      return
    }
    setChartJumpError('')
    onJumpChartToTime?.(timestamp)
  }

  function handleResetChartToLatest() {
    setChartJumpError('')
    onResetChartToLatest?.()
  }

  function toggleAggregatePeriod(period: string) {
    setSelectedAggregatePeriods((current) => (
      current.includes(period)
        ? current.filter((item) => item !== period)
        : [...current, period]
    ))
  }

  function toggleAllAggregatePeriods() {
    setSelectedAggregatePeriods((current) => (
      current.length === storeTableAggregatePeriods.length ? [] : [...storeTableAggregatePeriods]
    ))
  }

  function waitStoreV5AggregateJobBySse(jobId: string) {
    return new Promise<StoreV5AggregateJobPayload>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        try {
          aggregateEventSourceRef.current?.close()
        } catch {
          // best effort
        }
        aggregateEventSourceRef.current = null
        fn()
      }
      const applyPayload = (event: MessageEvent) => {
        if (activeAggregateJobRef.current !== jobId) return null
        const payload = JSON.parse(event.data || '{}') as StoreV5AggregateJobPayload
        setAggregateProgress(payload)
        return payload
      }

      try {
        const source = createStoreV5AggregateEventSource(jobId)
        aggregateEventSourceRef.current = source
        source.addEventListener('progress', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed progress
          }
        })
        source.addEventListener('done', (event) => {
          try {
            const payload = applyPayload(event as MessageEvent)
            finish(() => resolve(payload as StoreV5AggregateJobPayload))
          } catch (err) {
            finish(() => reject(err))
          }
        })
        source.addEventListener('cancelled', (event) => {
          try {
            applyPayload(event as MessageEvent)
          } catch {
            // ignore malformed cancelled payload
          }
          finish(() => reject(new Error('store_v5_aggregate_cancelled')))
        })
        source.addEventListener('error', (event) => {
          const messageEvent = event as MessageEvent
          if (messageEvent.data) {
            try {
              const payload = applyPayload(messageEvent)
              finish(() => reject(new Error(payload?.error || payload?.status || 'store_v5_aggregate_failed')))
              return
            } catch {
              // fall through to generic error
            }
          }
          if (!settled && activeAggregateJobRef.current === jobId) {
            finish(() => reject(new Error('store_v5_aggregate_sse_disconnected')))
          }
        })
      } catch (err) {
        finish(() => reject(err))
      }
    })
  }

  async function waitStoreV5AggregateJobByPolling(jobId: string) {
    while (activeAggregateJobRef.current === jobId) {
      await delay(600)
      const current = await fetchStoreV5AggregateJob(jobId)
      setAggregateProgress(current)
      if (current.phase === 'completed') return current
      if (current.phase === 'failed' || current.phase === 'cancelled') {
        throw new Error(current.error || current.status || current.phase)
      }
    }
    throw new Error('store_v5_aggregate_cancelled')
  }

  async function handleAggregateStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const periods = [...selectedAggregatePeriods]
    if (!selectedAggregatePeriods.length) {
      setStoreCheckError('Select at least one aggregated period.')
      return
    }
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress({
      ok: true,
      jobId: '',
      symbol,
      phase: 'running',
      status: 'store_v5_aggregate_running',
      periods,
      currentPeriod: periods[0],
      completed: 0,
      total: periods.length,
    })
    setStoreActionStatus('正在从 M1 重建聚合周期...')
    try {
      if (!canAggregateStoreV5) {
        setStoreActionStatus('正在先清理无效 M1，生成 direct M1...')
        await cleanStoreV5DirectM1(symbol)
        const cleanedStatus = await fetchStoreV5Status(symbol)
        setLocalStoreStatus(cleanedStatus)
        savePersistedStoreV5Status(symbol, cleanedStatus, new Date().toISOString(), storePanelPersistenceEnabled)
        setStoreActionStatus('direct M1 已生成，开始聚合...')
      }
      const started = await startStoreV5AggregateJob(symbol, periods)
      activeAggregateJobRef.current = started.jobId
      setAggregateProgress(started)
      try {
        await waitStoreV5AggregateJobBySse(started.jobId)
      } catch (err) {
        if (activeAggregateJobRef.current !== started.jobId) throw err
        await waitStoreV5AggregateJobByPolling(started.jobId)
      }
      setAggregateProgress({
        ok: true,
        jobId: activeAggregateJobRef.current,
        symbol,
        phase: 'completed',
        status: 'store_v5_aggregate_completed',
        periods,
        completed: periods.length,
        total: periods.length,
      })
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus('')
      }, 1600)
      setStoreActionStatus('Aggregation complete. Store status refreshed.')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setAggregateProgress((current) => current ? { ...current, phase: 'failed' } : null)
      setStoreCheckError(message)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  return (
    <>
      <div className="ff-right-rail" aria-label="Right toolbar">
        <button
          className="ff-right-rail__button"
          data-active={activeDrawer === 'mt5'}
          onClick={() => onToggleDrawer('mt5')}
          title="MT5 Import Center"
          type="button"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M43.5,14.9312c0,4.251-8.73,7.6971-19.5,7.6971S4.5,19.1822,4.5,14.9312,13.23,7.234,24,7.234,43.5,10.68,43.5,14.9312Z" />
            <path d="M43.5,23.9991c0,4.251-8.73,7.6971-19.5,7.6971S4.5,28.25,4.5,23.9991" />
            <path d="M43.5,33.0688c0,4.251-8.73,7.6972-19.5,7.6972S4.5,37.32,4.5,33.0688" />
            <path d="M4.5,33.0688v-9.07" />
            <path d="M43.5,33.0688v-9.07" />
            <path d="M43.5,23.9991v-9.07" />
            <path d="M4.5,24V14.93" />
          </svg>
        </button>
        <button
          className="ff-right-rail__button"
          data-active={activeDrawer === 'settings'}
          onClick={() => onToggleDrawer('settings')}
          title="Settings"
          type="button"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <polygon points="34.75 5.38 13.25 5.38 2.5 24 13.25 42.62 34.75 42.62 45.5 24 34.75 5.38" />
            <circle cx="24" cy="24" r="7.5" />
          </svg>
        </button>
      </div>

      <aside
        className="ff-right-drawer"
        data-open={open}
        aria-hidden={!open}
        style={{
          ['--ff-mt5-top-pane-height' as string]: `${topPaneHeight}px`,
        }}
      >
        <div
          className="ff-right-drawer__resize-handle"
          onDoubleClick={() => onResize(280)}
          onPointerDown={handleResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          tabIndex={0}
        />

        <header className="ff-right-drawer__header">
          <h2>{activeDrawer === 'settings' ? 'Settings' : 'MT5 Import Center'}</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">
            x
          </button>
        </header>

        {activeDrawer === 'settings' ? (
          <Suspense fallback={<div className="ff-settings-drawer__body" />}>
            <SettingsPanel
              selectedTab={selectedSettingsPanelTab}
              onSelectedTabChange={setSelectedSettingsPanelTab}
            />
          </Suspense>
        ) : (
        <div className="ff-right-drawer__body">
          <section className="ff-mt5-pane ff-mt5-pane--top">
            <form className="ff-import-toolbar" onSubmit={handleSearch}>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                value={query}
              />
              <button className="ff-import-toolbar__search" type="submit">Search</button>
              <button disabled={loading} onClick={() => loadSymbols(true)} type="button">
                {loading ? 'Scanning...' : 'Scan MT5'}
              </button>
            </form>

            <div className="ff-import-note" data-error={Boolean(error)}>
              {status}
            </div>

            <div className="ff-symbol-table-wrap" ref={tableWrapRef}>
              <table className="ff-symbol-table">
                <colgroup>
                  <col style={{ width: `${columnWidths.symbol}px` }} />
                  <col style={{ width: `${columnWidths.name}px` }} />
                  <col style={{ width: `${columnWidths.type}px` }} />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th>
                      交易品种
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('symbol')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'symbol')}
                      />
                    </th>
                    <th>
                      中文名称
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('name')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'name')}
                      />
                    </th>
                    <th>
                      类型
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('type')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'type')}
                      />
                    </th>
                    <th>
                      鎻忚堪
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSymbols.map((row) => {
                    const display = resolveMt5SymbolDisplay(row)
                    return (
                      <tr
                        data-selected={selectedSymbol === row.symbol}
                        key={row.symbol}
                        onClick={() => handleSelectSymbol(row.symbol)}
                        tabIndex={0}
                      >
                        <td title={row.symbol}>{row.symbol}</td>
                        <td title={display.chineseName}>{display.chineseName}</td>
                        <td title={display.assetType}>{display.assetType}</td>
                        <td title={display.description || row.description || row.name || row.path || '-'}>
                          {display.description || row.description || row.name || row.path || '-'}
                        </td>
                      </tr>
                    )
                  })}
                  {!visibleSymbols.length && (
                    <tr>
                      <td className="ff-symbol-table__empty" colSpan={4}>
                        {loading ? 'Scanning MT5 symbols...' : 'No symbols. Click Scan MT5.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div
            className="ff-mt5-pane-splitter"
            onDoubleClick={() => setTopPaneHeight(430)}
            onPointerDown={handleSplitPointerDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize MT5 panel split"
            tabIndex={0}
          />

          <section className="ff-mt5-pane ff-mt5-pane--bottom" aria-label="MT5 lower workspace">
            {selectedRow && selectedDisplay && (
              <section className="ff-import-selected" aria-label="Selected MT5 symbol">
                <div className="ff-import-selected-head">
                  <div className="ff-import-selected-head__text">
                    <h3>{selectedRow.symbol} · {selectedDisplay.chineseName}</h3>
                    <p>{selectedDisplay.assetType}</p>
                  </div>
                  <div className="ff-import-selected-head__actions">
                    <div className="ff-import-load-row">
                      <span>添加自选列表：</span>
                      <div className="ff-import-load-switch" aria-label="添加自选列表">
                        <button
                          data-active={selectedIsInWatchlist}
                          onClick={() => handleSetSelectedWatchlistLoaded(true)}
                          type="button"
                        >
                          Load
                        </button>
                        <button
                          data-active={!selectedIsInWatchlist}
                          onClick={() => handleSetSelectedWatchlistLoaded(false)}
                          type="button"
                        >
                          Unload
                        </button>
                      </div>
                    </div>
                    <div className="ff-import-load-row">
                      <span>添加快捷菜单：</span>
                      <div className="ff-import-load-switch" aria-label="添加快捷菜单">
                        <button
                          data-active={shortcutMenuEnabled}
                          onClick={() => handleSetShortcutMenuLoaded(true)}
                          type="button"
                        >
                          Load
                        </button>
                        <button
                          data-active={!shortcutMenuEnabled}
                          onClick={() => handleSetShortcutMenuLoaded(false)}
                          type="button"
                        >
                          Unload
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ff-import-selected-tabs" role="tablist" aria-label="MT5 symbol panels">
                  {selectedPanelTabs.map((tab) => (
                    <button
                      aria-selected={selectedPanelTab === tab.key}
                      className="ff-import-selected-tabs__item"
                      data-active={selectedPanelTab === tab.key}
                      key={tab.key}
                      onClick={() => setSelectedPanelTab(tab.key)}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {selectedPanelTab === 'details' && (
                  <div className="ff-import-selected-detail" role="tabpanel">
                    {selectedDetailRows(selectedRow).map(([leftLabel, leftValue, rightLabel, rightValue]) => (
                      <div
                        className="ff-import-selected-detail__row"
                        data-wide={rightLabel == null}
                        key={`${leftLabel}-${rightLabel ?? 'wide'}`}
                      >
                        <span>{leftLabel}</span>
                        {rightLabel == null ? (
                          <strong
                            className="ff-import-selected-detail__wide-value"
                            title={formatDetailValue(leftValue)}
                          >
                            {formatDetailValue(leftValue)}
                          </strong>
                        ) : (
                          <>
                            <strong title={formatDetailValue(leftValue)}>{formatDetailValue(leftValue)}</strong>
                            <span>{rightLabel}</span>
                            <strong title={formatDetailValue(rightValue)}>{formatDetailValue(rightValue)}</strong>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedPanelTab === 'store' && (
                  <div className="ff-import-store-panel" role="tabpanel">
                    <section className="ff-store-card ff-store-card--direct">
                      <label className="ff-store-persistence-toggle">
                        <input
                          checked={storePanelPersistenceEnabled}
                          onChange={(event) => handleToggleStorePanelPersistence(event.target.checked)}
                          type="checkbox"
                        />
                        <span>持久化</span>
                      </label>
                      <div className="ff-store-direct-summary">
                        <strong>本地仓库 M1</strong>
                        {storeCheck?.directM1 ? (
                          <>
                            <span>MT5 条数：{formatCount(storeCheck.directM1.mt5RowsCount)}</span>
                            <span>真实条数：{formatCount(storeCheck.directM1.trueM1RowsCount)} · 最后检查：{formatCheckTime(mt5M1LastCheckedAt)}</span>
                            <span>
                              真实 M1 范围：{formatUtcRange(storeCheck.directM1.firstTimeText, storeCheck.directM1.lastTimeText)}
                            </span>
                            {storeCheck.directM1.validationError && (
                              <span className="ff-store-direct-summary__error">
                                校验失败：{storeCheck.directM1.validationError}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span>MT5 条数：-</span>
                            <span>真实条数：-</span>
                            <span>真实 M1 范围：-</span>
                          </>
                        )}
                        <span>
                          本地 M1 数据：{localStoreStatus?.directM1?.rowsCount != null
                            ? `${formatCount(localStoreStatus.directM1.rowsCount)} 条 · 最后更新时间：${formatCheckTime(localStoreStatus.directM1.lastImportAt)}`
                            : '无数据'}
                        </span>
                        {storeCheckError && (
                          <span className="ff-store-direct-summary__error">{storeCheckError}</span>
                        )}
                      </div>
                    </section>

                    {storeOperationLine && (
                      <div className="ff-store-status-line">
                        <div className="ff-store-status-line__row">
                          <span>{storeOperationLine}</span>
                          {m1CheckJob?.jobId && (
                            <button onClick={handleCancelMt5M1Check} type="button">取消</button>
                          )}
                          {pullProgress?.jobId && pullProgress.phase !== 'completed' && (
                            <button onClick={handleCancelPullStore} type="button">取消</button>
                          )}
                        </div>
                        {storeOperationProgress && (
                          <div
                            className="ff-store-status-line__bar"
                            data-estimated={storeOperationProgress.hasEstimate}
                            aria-hidden="true"
                          >
                            <span style={{ width: `${storeOperationProgress.width}%` }} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="ff-store-direct-actions">
                      <button disabled={storeCheckLoading} onClick={handleCheckMt5M1Staged} type="button">
                        {isCheckingMt5M1 ? '检查中' : '检查 MT5 数据'}
                      </button>
                      <button disabled={storeCheckLoading} onClick={handleRefreshStoreStatus} type="button">检查本地仓库</button>
                      <button disabled={storeCheckLoading} onClick={handlePullStore} type="button">
                        {isPullingStoreV5 ? '拉取中' : '拉取'}
                      </button>
                      <button disabled={storeCheckLoading} onClick={handleDeleteLocalStore} type="button">删除本地数据</button>
                      <button disabled={storeCheckLoading} onClick={handleCleanLocalM1} type="button">清理无效 M1</button>
                      <button disabled={storeCheckLoading} onClick={handleAddM1ToStoreList} type="button">加入列表</button>
                    </div>
                    <table className="ff-store-detail-table ff-store-aggregate-table">
                      <thead>
                        <tr>
                          <th>周期</th>
                          <th>条数</th>
                          <th>最后K线</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleStoreTableRows.map((row) => (
                          <tr
                            data-selected={selectedStoreTableKeyIsVisible && selectedStoreTableKey === `${row.kind}-${row.period}`}
                            key={`${row.kind}-${row.period}`}
                            onClick={() => handleOpenStoreTableRow(row)}
                          >
                            <td>
                              {row.kind === 'aggregate' ? (
                                <label className="ff-store-period-check" onClick={(event) => event.stopPropagation()}>
                                  <input
                                    checked={selectedAggregatePeriods.includes(row.period)}
                                    disabled={storeCheckLoading}
                                    onChange={() => toggleAggregatePeriod(row.period)}
                                    type="checkbox"
                                  />
                                  <strong>{row.period}</strong>
                                </label>
                              ) : (
                                <strong>{row.period}</strong>
                              )}
                            </td>
                            <td>{row.count}</td>
                            <td>{row.updated}</td>
                          </tr>
                        ))}
                        {!visibleStoreTableRows.length && (
                          <tr>
                            <td className="ff-symbol-table__empty" colSpan={3}>
                              暂无 StoreV5 聚合周期。请先拉取 M1，再执行聚合。
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div className="ff-store-direct-actions ff-store-direct-actions--aggregate">
                      <button
                        data-state={
                          selectedAggregatePeriods.length === 0
                            ? 'none'
                            : selectedAggregatePeriods.length === storeTableAggregatePeriods.length
                              ? 'all'
                              : 'mixed'
                        }
                        disabled={storeCheckLoading}
                        onClick={toggleAllAggregatePeriods}
                        type="button"
                      >
                        {selectedAggregatePeriods.length === storeTableAggregatePeriods.length ? '全不选' : '全选'}
                      </button>
                      <button disabled={storeCheckLoading} onClick={handleRefreshStoreStatus} type="button">
                        {storeCheckLoading ? '刷新中' : '刷新仓库'}
                      </button>
                      <button disabled={storeCheckLoading || selectedAggregatePeriods.length === 0} onClick={handleDeleteSelectedAggregates} type="button">删除</button>
                      <button
                        disabled={storeCheckLoading || selectedAggregatePeriods.length === 0}
                        onClick={handleAggregateStore}
                        title={!canAggregateStoreV5 ? '会先自动清理无效 M1，再聚合' : undefined}
                        type="button"
                      >
                        聚合
                      </button>
                    </div>

                    <div className="ff-chart-jump-controls">
                      <input
                        aria-label="跳转日期时间"
                        onChange={(event) => {
                          setChartJumpInput(event.target.value)
                          setChartJumpError('')
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleJumpChartToTime()
                          }
                        }}
                        placeholder="YYYY-MM-DD HH:mm"
                        type="text"
                        value={chartJumpInput}
                      />
                      <button onClick={handleJumpChartToTime} type="button">跳转</button>
                      <button onClick={handleResetChartToLatest} type="button">回到当前</button>
                      <button onClick={() => onLoadChartStep?.('left')} type="button">向左10000</button>
                      <button onClick={() => onLoadChartStep?.('right')} type="button">向右10000</button>
                      {chartJumpError && <span>{chartJumpError}</span>}
                    </div>

                    <div className="ff-chart-load-status">
                      {formatChartLoadStatus(chartLoadState)}
                    </div>

                  </div>
                )}

                {selectedPanelTab === 'watchlist' && (
                  <div className="ff-import-watchlist-panel" role="tabpanel">
                    <div
                      className="ff-watchlist-table-wrap"
                      style={{ height: `${watchlistTableHeight}px` }}
                    >
                      <table className="ff-watchlist-table" aria-label="Watchlist">
                        <thead>
                          <tr>
                            <th>SYMBOL</th>
                            <th>中文名称</th>
                            <th>资产类型</th>
                            <th>LAST</th>
                            <th>CHG</th>
                            <th>CHG%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {watchlistRows.map((row) => {
                            const display = resolveMt5SymbolDisplay(row)
                            const tick = watchlistTicks[row.symbol]
                            return (
                              <tr
                                data-selected={selectedSymbol === row.symbol}
                                data-realtime={watchlistRealtimeEnabled && tick ? 'true' : 'false'}
                                key={row.symbol}
                                onClick={() => handleSelectSymbol(row.symbol)}
                                tabIndex={0}
                              >
                                <td title={row.symbol}>{row.symbol}</td>
                                <td title={display.chineseName}>{display.chineseName}</td>
                                <td title={display.assetType}>{display.assetType}</td>
                                <td title={tick?.publishedAt ?? ''}>{formatMarketPrice(tick?.last)}</td>
                                <td data-direction={(tick?.change ?? 0) > 0 ? 'up' : (tick?.change ?? 0) < 0 ? 'down' : 'flat'}>
                                  {formatMarketChange(tick?.change)}
                                </td>
                                <td data-direction={(tick?.changePercent ?? 0) > 0 ? 'up' : (tick?.changePercent ?? 0) < 0 ? 'down' : 'flat'}>
                                  {formatMarketPercent(tick?.changePercent)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div
                      className="ff-watchlist-table-splitter"
                      onDoubleClick={() => {
                        setWatchlistTableHeight(228)
                        try {
                          window.localStorage.setItem(watchlistTableHeightStorageKey, '228')
                        } catch {
                          // Watchlist table height persistence is best-effort only.
                        }
                      }}
                      onPointerDown={handleWatchlistTableResizePointerDown}
                      role="separator"
                      aria-orientation="horizontal"
                      aria-label="Resize watchlist table"
                      tabIndex={0}
                    />
                    {(watchlistDirectPeriods.length > 0 || watchlistAggregatedPeriods.length > 0) && (
                      <div className="ff-watchlist-periods" aria-label="Watchlist available periods">
                        {watchlistDirectPeriods.length > 0 && (
                          <section className="ff-watchlist-periods__group">
                            <h4>Direct source</h4>
                            <div className="ff-watchlist-periods__buttons">
                              {watchlistDirectPeriods.map((row) => (
                                <button
                                  data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                                  key={`${row.kind}-${row.period}`}
                                  onClick={() => handleOpenWatchlistPeriod(row)}
                                  title={`${row.period} · ${row.count} 条 · ${row.updated}`}
                                  type="button"
                                >
                                  {row.period}
                                </button>
                              ))}
                            </div>
                          </section>
                        )}
                        {watchlistAggregatedPeriods.length > 0 && (
                          <section className="ff-watchlist-periods__group">
                            <h4>Aggregated source</h4>
                            <div className="ff-watchlist-periods__buttons">
                              {watchlistAggregatedPeriods.map((row) => (
                                <button
                                  data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                                  key={`${row.kind}-${row.period}`}
                                  onClick={() => handleOpenWatchlistPeriod(row)}
                                  title={`${row.period} · ${row.count} 条 · ${row.updated}`}
                                  type="button"
                                >
                                  {row.period}
                                </button>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>
                    )}
                    <div className="ff-watchlist-realtime-controls">
                      <button
                        className="ff-watchlist-realtime-toggle"
                        data-active={watchlistRealtimeEnabled}
                        data-ready={watchlistRealtimeReady}
                        onClick={() => setWatchlistRealtimeEnabled((current) => !current)}
                        type="button"
                        aria-pressed={watchlistRealtimeEnabled}
                      >
                        <span>{watchlistRealtimeEnabled && !watchlistRealtimeReady ? 'Syncing' : 'Realtime'}</span>
                        <i aria-hidden="true" />
                      </button>
                      {watchlistRealtimeStatus && (
                        <span className="ff-watchlist-realtime-status">
                          {watchlistRealtimeStatus || 'Live'}
                          {watchlistLastTickAt ? ` · ${watchlistLastTickAt}` : ''}
                        </span>
                      )}
                    </div>
                    {watchlistRealtimeLog.length > 0 && (
                      <div className="ff-watchlist-realtime-log" aria-label="Realtime sync log">
                        <div className="ff-watchlist-realtime-log__title">
                          {watchlistRealtimeReady ? 'Realtime Feed' : 'Realtime Sync'}
                        </div>
                        <div className="ff-watchlist-realtime-log__body">
                          {watchlistRealtimeLog.map((line, index) => (
                            <div key={`${line}-${index}`}>{line}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </section>
        </div>
        )}
      </aside>
    </>
  )
}





