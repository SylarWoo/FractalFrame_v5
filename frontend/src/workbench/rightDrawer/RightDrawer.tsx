import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import './RightDrawer.css'
import type { ChartLoadState } from '../chart/ChartCoreHost'
import { resolveMt5SymbolDisplay } from './mt5SymbolDisplay'
import {
  cancelMt5M1CheckJob,
  cancelStoreV5PullJob,
  cleanStoreV5DirectM1,
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
  startStoreV5AggregateJob,
  startStoreV5PullJob,
  startMt5M1CheckJob,
} from './mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, Mt5SymbolRow, StoreV5AggregateJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from './mt5SymbolsApi'

type RightDrawerProps = {
  chartLoadState?: ChartLoadState | null
  drawerWidth: number
  open: boolean
  onClose: () => void
  onJumpChartToTime?: (timestamp: number) => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onResize: (width: number) => void
  onResetChartToLatest?: () => void
  onToggle: () => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null }) => void
}

const minDrawerWidth = 220
const maxDrawerWidth = 900
const splitHeightStorageKey = 'fractalframe:mt5ImportCenterTopPaneHeightPx:v1'
const columnWidthsStorageKey = 'fractalframe:mt5ImportCenterColumnWidthsPx:v1'
const symbolSnapshotStorageKey = 'fractalframe:mt5ImportCenterSymbolSnapshot:v1'
const mt5M1CheckResultsStorageKey = 'fractalframe:mt5ImportCenterM1CheckResults:v1'
const storeV5StatusStorageKey = 'fractalframe:mt5ImportCenterStoreV5Status:v1'
const storeV5ListSymbolsStorageKey = 'fractalframe:mt5ImportCenterStoreV5ListSymbols:v1'
const storePanelPersistenceEnabledStorageKey = 'fractalframe:mt5ImportCenterStorePanelPersistenceEnabled:v1'
const storePanelSelectedTableKeyStorageKey = 'fractalframe:mt5ImportCenterStorePanelSelectedTableKey:v1'
const storePanelPersistenceKeys = [
  mt5M1CheckResultsStorageKey,
  storeV5StatusStorageKey,
  storeV5ListSymbolsStorageKey,
  storePanelSelectedTableKeyStorageKey,
]
const storeTableAggregatePeriods = ['M5', 'M15', 'M30', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN1']

const defaultColumnWidths = {
  symbol: 96,
  name: 126,
  type: 64,
}

type ColumnKey = keyof typeof defaultColumnWidths
type SelectedPanelTab = 'details' | 'store' | 'watchlist' | 'settings'
type DetailRow =
  | readonly [string, string | number | boolean | null | undefined, string, string | number | boolean | null | undefined]
  | readonly [string, string | number | boolean | null | undefined]

type SymbolSnapshot = {
  selectedSymbol: string
  status: string
  symbols: Mt5SymbolRow[]
  savedAt: string
}

type PersistedM1CheckResult = {
  checkedAt: string
  payload: StoreV5CheckPayload
}

type PersistedStoreV5Status = {
  checkedAt: string
  payload: StoreV5CheckPayload
}

type PersistedStoreTableSelection = {
  key: string
  symbol: string
}

type StoreTableRow = {
  period: string
  count: string
  updated: string
  kind: 'm1' | 'aggregate'
  rowsCount?: number | null
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

function getInitialSymbolSnapshot(): SymbolSnapshot | null {
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

function saveSymbolSnapshot(snapshot: Omit<SymbolSnapshot, 'savedAt'>) {
  try {
    window.localStorage.setItem(
      symbolSnapshotStorageKey,
      JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }),
    )
  } catch {
    // Symbol persistence is best-effort only.
  }
}

function readStorePanelPersistenceEnabled() {
  try {
    const raw = window.localStorage.getItem(storePanelPersistenceEnabledStorageKey)
    return raw == null ? true : raw === '1'
  } catch {
    return true
  }
}

function saveStorePanelPersistenceEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(storePanelPersistenceEnabledStorageKey, enabled ? '1' : '0')
  } catch {
    // Store panel persistence flag is best-effort only.
  }
}

function clearStorePanelPersistence() {
  try {
    storePanelPersistenceKeys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Store panel persistence cleanup is best-effort only.
  }
}

function readPersistedM1CheckResult(symbol: string, enabled = true): PersistedM1CheckResult | null {
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

function savePersistedM1CheckResult(symbol: string, payload: StoreV5CheckPayload, checkedAt: string, enabled = true) {
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

function readPersistedStoreV5Status(symbol: string, enabled = true): PersistedStoreV5Status | null {
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

function savePersistedStoreV5Status(symbol: string, payload: StoreV5CheckPayload, checkedAt = new Date().toISOString(), enabled = true) {
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
  } catch {
    // Store status persistence is best-effort only.
  }
}

function readStoreV5ListSymbols(enabled = true): string[] {
  if (!enabled) return []
  try {
    const raw = window.localStorage.getItem(storeV5ListSymbolsStorageKey)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function saveStoreV5ListSymbols(symbols: string[], enabled = true) {
  if (!enabled) return
  try {
    window.localStorage.setItem(storeV5ListSymbolsStorageKey, JSON.stringify([...new Set(symbols)]))
  } catch {
    // Store list persistence is best-effort only.
  }
}

function readPersistedStoreTableSelection(symbol: string, enabled = true): string {
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

function savePersistedStoreTableSelection(symbol: string, key: string, enabled = true) {
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

function formatSymbolStatus(totalCount: number, visibleCount: number, merge?: { added?: number; updated?: number }) {
  return `共 ${totalCount} 个品种，本地已保存，刷新后自动恢复（当前显示 ${visibleCount} 个）`
    + (merge ? ` · 新增 ${merge.added ?? 0}，更新 ${merge.updated ?? 0}` : '')
}

function normalizeStoredStatus(status: string, symbolCount: number) {
  if (
    !status
    || status.includes('symbol(s)')
    || status.includes('stored locally')
    || status.includes('viewport renders')
    || status.includes('added')
    || /^[\x00-\x7F\s.,;:()/-]+$/.test(status)
  ) {
    return symbolCount ? formatSymbolStatus(symbolCount, symbolCount) : '点击 Scan MT5 加载品种列表。'
  }
  return status
}

function formatDetailValue(value: string | number | boolean | null | undefined) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '-'
}

function formatChartLoadStatus(state: ChartLoadState | null | undefined) {
  if (!state) return '-'
  if (state.loading) return `${state.symbol} ${state.period} 加载中 ${state.requestedRows.toLocaleString()}`
  if (state.error) return `${state.symbol} ${state.period} 加载失败`
  const localRows = typeof state.totalRows === 'number' && Number.isFinite(state.totalRows)
    ? state.totalRows
    : state.requestedRows
  return `${state.symbol} ${state.period} 已进图 ${state.rows.toLocaleString()} / 本地 ${localRows.toLocaleString()}${state.loadingMore ? ' · 加载历史' : ''}`
}

function formatCountWithWan(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (Math.abs(value) < 10000) return value.toLocaleString('en-US')
  const wan = value / 10000
  return `${value.toLocaleString('en-US')}（${wan.toFixed(wan >= 100 ? 0 : 1)}W）`
}

function formatCheckTime(value?: string | null) {
  if (!value) return '-'
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return value
  return new Date(time).toLocaleString()
}

function formatEpochSeconds(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Date(value * 1000).toLocaleString()
}

function parseChartJumpTime(value: string) {
  const normalized = value.trim().replace('T', ' ')
  if (!normalized) return null
  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function resolveLocalM1Rows(status: StoreV5CheckPayload | null) {
  return status?.directM1?.rowsCount
    ?? status?.directM1?.trueM1RowsCount
    ?? status?.rawDirectM1?.rowsCount
    ?? status?.rawDirectM1?.rawRowsCount
    ?? null
}

function resolveLocalM1LastTime(status: StoreV5CheckPayload | null) {
  return status?.directM1?.lastTime ?? status?.rawDirectM1?.lastTime ?? null
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function formatUtcRange(firstText?: string | null, lastText?: string | null) {
  if (!firstText || !lastText) return '-'
  return `${firstText.replace(':00 UTC', '')} ~ ${lastText.replace(':00 UTC', '')} (UTC)`
}

function formatStoreOperationLine(
  pullJob: StoreV5PullJobPayload | null,
  checkJob: Mt5M1CheckJobPayload | null,
  aggregateProgress: StoreV5AggregateJobPayload | null,
  fallback: string,
) {
  if (pullJob) {
    if (pullJob.progressLabel) return pullJob.progressLabel

    const batchSize = pullJob.fetchChunkSize ?? pullJob.writeBatchSize ?? 200000
    if (pullJob.phase === 'probing' || pullJob.phase === 'queued' || pullJob.phase === 'fetching') {
      return `开始读取 ${formatCountWithWan(batchSize)}，已读取 ${formatCountWithWan(pullJob.rowsFetched)}`
    }
    if (pullJob.phase === 'streaming' || pullJob.phase === 'writing') {
      const currentBatch = pullJob.writeBatchRows ?? batchSize
      return `开始写入 ${formatCountWithWan(currentBatch)}，已写入 ${formatCountWithWan(pullJob.rowsWritten)}`
    }
    if (pullJob.phase === 'checking' || pullJob.phase === 'validating') return '已经写完，开始检查错误字段'
    if (pullJob.phase === 'cleaning') {
      const deleted = pullJob.cleanupDeletedRows != null ? `，已删除 ${formatCountWithWan(pullJob.cleanupDeletedRows)}` : ''
      return `检查完，删除错误字段${deleted}`
    }
    if (pullJob.phase === 'completed') return '完成，本地 M1 数据已更新'
    if (pullJob.phase === 'cancelled') return '已取消'
    if (pullJob.phase === 'failed') return `失败：${pullJob.error || pullJob.status}`
    return pullJob.status || fallback
  }
  if (checkJob) {
    const batchSize = checkJob.chunkSize ?? 200000
    if (checkJob.phase === 'fetching' || checkJob.phase === 'queued') {
      if (checkJob.currentBatchIndex && checkJob.currentBatchRequested) {
        return `正在读取第 ${checkJob.currentBatchIndex} 批：计划 ${formatCountWithWan(checkJob.currentBatchRequested)}，已读取 ${formatCountWithWan(checkJob.mt5RowsCount)}`
      }
      return `开始读取 ${formatCountWithWan(batchSize)}，已读取 ${formatCountWithWan(checkJob.mt5RowsCount)}`
    }
    if (checkJob.phase === 'validating') return '已经读完，开始检查错误字段'
    if (checkJob.phase === 'completed') return '检查完成'
    if (checkJob.phase === 'cancelled') return '已取消'
    if (checkJob.phase === 'failed') return `失败：${checkJob.error || checkJob.status}`
    return checkJob.status || fallback
  }
  if (aggregateProgress) {
    if (aggregateProgress.progressLabel) return aggregateProgress.progressLabel
    if (aggregateProgress.phase === 'completed') {
      return `聚合完成：${aggregateProgress.periods.join('、')}`
    }
    if (aggregateProgress.phase === 'failed') {
      return `聚合失败：${aggregateProgress.currentPeriod ?? aggregateProgress.periods.join('、')}`
    }
    const current = aggregateProgress.currentPeriod ? `，当前 ${aggregateProgress.currentPeriod}` : ''
    return `正在聚合：${aggregateProgress.completed}/${aggregateProgress.total}${current}`
  }
  return fallback
}

function resolveStoreOperationProgress(
  pullJob: StoreV5PullJobPayload | null,
  checkJob: Mt5M1CheckJobPayload | null,
  aggregateProgress: StoreV5AggregateJobPayload | null,
) {
  if (pullJob) {
    if (pullJob.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (pullJob.phase === 'failed' || pullJob.phase === 'cancelled') return null
    if (typeof pullJob.progressPercent === 'number') {
      return {
        hasEstimate: true,
        width: Math.max(1, Math.min(99, Math.round(pullJob.progressPercent))),
      }
    }
    if (pullJob.phase === 'writing') {
      const written = typeof pullJob.rowsWritten === 'number' ? pullJob.rowsWritten : 0
      const total = typeof pullJob.trueM1RowsCount === 'number' && pullJob.trueM1RowsCount > 0 ? pullJob.trueM1RowsCount : null
      if (total) return { hasEstimate: true, width: Math.max(1, Math.min(99, Math.round((written / total) * 100))) }
    }
    const fetched = typeof pullJob.rowsFetched === 'number' ? pullJob.rowsFetched : 0
    const total = typeof pullJob.maxCount === 'number' && pullJob.maxCount > 0 ? pullJob.maxCount : null
    if (total) return { hasEstimate: true, width: Math.max(fetched > 0 ? 1 : 0, Math.min(99, Math.round((fetched / total) * 100))) }
    return { hasEstimate: false, width: 45 }
  }
  if (checkJob) {
    if (checkJob.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (checkJob.phase === 'failed' || checkJob.phase === 'cancelled') return null
    if (typeof checkJob.progressPercent === 'number') {
      return { hasEstimate: true, width: Math.max(1, Math.min(99, Math.round(checkJob.progressPercent))) }
    }
    return { hasEstimate: false, width: 45 }
  }
  if (aggregateProgress) {
    if (aggregateProgress.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (aggregateProgress.phase === 'failed') return null
    return {
      hasEstimate: true,
      width: Math.max(4, Math.min(99, Math.round((aggregateProgress.completed / Math.max(1, aggregateProgress.total)) * 100))),
    }
  }
  return null
}

function selectedDetailRows(row: Mt5SymbolRow): DetailRow[] {
  return [
    ['分类', row.category || row.market, '小数位', row.digits],
    ['合约量', row.tradeContractSize, '点差', row.spreadFloat ? '浮动' : row.spread],
    ['停损级别', row.tradeStopsLevel, '预付款货币', row.currencyMargin],
    ['盈利货币', row.currencyProfit, '基础货币', row.currencyBase],
    ['计算', row.tradeCalcMode, '图表模式', row.tradeMode],
    ['交易模式', row.tradeMode, '执行模式', row.tradeCalcMode],
    ['最小手数', row.volumeMin, '最大手数', row.volumeMax],
    ['手数步进', row.volumeStep, 'Tick Size', row.tradeTickSize],
    ['Tick Value', row.tradeTickValue, '可见', row.visible],
    ['路径', row.path],
  ]
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
  chartLoadState,
  drawerWidth,
  open,
  onClose,
  onJumpChartToTime,
  onLoadChartStep,
  onResize,
  onResetChartToLatest,
  onToggle,
  onOpenChart,
}: RightDrawerProps) {
  const initialSnapshot = useMemo(getInitialSymbolSnapshot, [])
  const [query, setQuery] = useState('')
  const [symbols, setSymbols] = useState<Mt5SymbolRow[]>(() => initialSnapshot?.symbols ?? [])
  const [selectedSymbol, setSelectedSymbol] = useState(() => initialSnapshot?.selectedSymbol ?? '')
  const [status, setStatus] = useState(
    () => normalizeStoredStatus(initialSnapshot?.status ?? '', initialSnapshot?.symbols.length ?? 0),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topPaneHeight, setTopPaneHeight] = useState(getInitialTopPaneHeight)
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths)
  const [selectedPanelTab, setSelectedPanelTab] = useState<SelectedPanelTab>('details')
  const [storePanelPersistenceEnabled, setStorePanelPersistenceEnabled] = useState(readStorePanelPersistenceEnabled)
  const initialPersistedM1Check = useMemo(
    () => readPersistedM1CheckResult(initialSnapshot?.selectedSymbol ?? '', storePanelPersistenceEnabled),
    [initialSnapshot?.selectedSymbol, storePanelPersistenceEnabled],
  )
  const initialPersistedStoreV5Status = useMemo(
    () => readPersistedStoreV5Status(initialSnapshot?.selectedSymbol ?? '', storePanelPersistenceEnabled),
    [initialSnapshot?.selectedSymbol, storePanelPersistenceEnabled],
  )
  const [storeCheck, setStoreCheck] = useState<StoreV5CheckPayload | null>(() => initialPersistedM1Check?.payload ?? null)
  const [mt5M1LastCheckedAt, setMt5M1LastCheckedAt] = useState(() => initialPersistedM1Check?.checkedAt ?? '')
  const [localStoreStatus, setLocalStoreStatus] = useState<StoreV5CheckPayload | null>(() => initialPersistedStoreV5Status?.payload ?? null)
  const [storeV5ListSymbols, setStoreV5ListSymbols] = useState<string[]>(() => readStoreV5ListSymbols(storePanelPersistenceEnabled))
  const [selectedStoreTableKey, setSelectedStoreTableKey] = useState(() =>
    readPersistedStoreTableSelection(initialSnapshot?.selectedSymbol ?? '', storePanelPersistenceEnabled),
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
  const selectedStoreTableKeyIsVisible = useMemo(
    () => visibleStoreTableRows.some((row) => `${row.kind}-${row.period}` === selectedStoreTableKey),
    [selectedStoreTableKey, visibleStoreTableRows],
  )

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
  const storeOperationLine = useMemo(
    () => formatStoreOperationLine(pullProgress, m1CheckJob, aggregateProgress, storeActionStatus),
    [aggregateProgress, m1CheckJob, pullProgress, storeActionStatus],
  )
  const storeOperationProgress = useMemo(
    () => resolveStoreOperationProgress(pullProgress, m1CheckJob, aggregateProgress),
    [aggregateProgress, m1CheckJob, pullProgress],
  )
  const isCheckingMt5M1 = storeCheckLoading && m1CheckJob != null
  const isPullingStoreV5 = storeCheckLoading && (pullProgress != null || storeActionStatus.includes('拉取'))

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
    setSelectedSymbol(symbol)
    setStoreCheck(persistedCheck?.payload ?? null)
    setMt5M1LastCheckedAt(persistedCheck?.checkedAt ?? '')
    setLocalStoreStatus(persistedStoreStatus?.payload ?? null)
    setSelectedStoreTableKey(readPersistedStoreTableSelection(symbol, storePanelPersistenceEnabled))
    setStoreCheckError('')
    setStoreActionStatus('')
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
    setStoreActionStatus('正在读取 StoreV5 仓库状态...')
    try {
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus((current) => (current.includes('鑱氬悎瀹屾垚') ? '' : current))
      }, 1600)
      setStoreActionStatus('StoreV5 仓库状态已刷新。')
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
    setStoreActionStatus('正在拉取 MT5 M1 写入 StoreV5...')
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
          ? '正在增量拉取 MT5 M1 写入 StoreV5...'
          : '正在首次拉取 MT5 M1 写入 StoreV5...',
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
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('拉取完成，仓库状态已刷新。')
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
      setPullProgress(null)
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteLocalStore() {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const ok = window.confirm(`确认删除 ${symbol} 的本地 StoreV5 数据？此操作会清空本地 M1 和聚合周期。`)
    if (!ok) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('正在删除本地 StoreV5 数据...')
    try {
      await deleteStoreV5Symbol(symbol)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('本地 StoreV5 数据已删除。')
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
      setStoreCheckError('请先勾选要删除的聚合周期。')
      return
    }
    const ok = window.confirm(`确认删除 ${symbol} 的聚合周期：${periods.join('、')}？M1 不会删除。`)
    if (!ok) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(null)
    setStoreActionStatus(`正在删除聚合周期：${periods.join('、')}...`)
    try {
      await deleteStoreV5AggregatedTimeframes(symbol, periods)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus(`已删除聚合周期：${periods.join('、')}。`)
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
    setStoreActionStatus('正在清理无效 1 分钟数据...')
    try {
      await cleanStoreV5DirectM1(symbol)
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus('本地 M1 已清理，并与真实 M1 数据对齐。')
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

  function handleOpenStoreTableRow(row: StoreTableRow) {
    const symbol = selectedRow?.symbol
    if (!symbol) return
    const key = `${row.kind}-${row.period}`
    setSelectedStoreTableKey(key)
    savePersistedStoreTableSelection(symbol, key, storePanelPersistenceEnabled)
    onOpenChart?.({
      symbol,
      period: row.period === 'M1' ? '1m' : row.period,
      totalRows: typeof row.rowsCount === 'number' && Number.isFinite(row.rowsCount) ? row.rowsCount : null,
    })
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
      setStoreCheckError('请至少勾选一个聚合周期。')
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
      setStoreActionStatus('聚合完成，仓库状态已刷新。')
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
          data-active={open}
          onClick={onToggle}
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
          <h2>MT5 Import Center</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">
            x
          </button>
        </header>

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
                      描述
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
                        {loading ? '正在扫描 MT5 品种...' : '暂无品种。请点击 Scan MT5。'}
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
                <h3>{selectedRow.symbol} · {selectedDisplay.chineseName}</h3>
                <p>{selectedDisplay.assetType}</p>
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
                        <strong>直连仓库 M1</strong>
                        {storeCheck?.directM1 ? (
                          <>
                            <span>MT5 条数：{formatCount(storeCheck.directM1.mt5RowsCount)}</span>
                            <span>真实条数：{formatCount(storeCheck.directM1.trueM1RowsCount)} · 最后检查：{formatCheckTime(mt5M1LastCheckedAt)}</span>
                            <span>
                              真实 M1 范围：
                              {formatUtcRange(storeCheck.directM1.firstTimeText, storeCheck.directM1.lastTimeText)}
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
                          本地 M1 数据：
                          {localStoreStatus?.directM1?.rowsCount != null
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

                    <div className="ff-store-direct-actions">
                      <button disabled={storeCheckLoading} onClick={handleRefreshStoreStatus} type="button">
                        {storeCheckLoading ? '刷新中' : '刷新仓库'}
                      </button>
                      <button disabled={storeCheckLoading || selectedAggregatePeriods.length === 0} onClick={handleDeleteSelectedAggregates} type="button">删除</button>
                      <button disabled={storeCheckLoading || selectedAggregatePeriods.length === 0} onClick={handleAggregateStore} type="button">聚合</button>
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
              </section>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
