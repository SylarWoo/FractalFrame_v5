import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { bottomPanels } from './bottomDrawer/bottomPanels'
import { BottomWorkspace } from './bottomDrawer/BottomWorkspace'
import { ChartWorkspaceV2 } from './chart/ChartWorkspaceV2'
import {
  storeV6MaIndicatorIdV2,
  storeV6MorganRangeM5RequestIdV2,
  storeV6StochIndicatorIdV2,
  storeV6VolIndicatorIdV2,
  storeV6VwapIndicatorIdV2,
  type StoreV6IndicatorRequestSpecV2,
} from './chart/indicatorRequestV2'
import {
  readKLineChartRefreshRestoreConfigV2,
  restoreKLineChartRefreshTargetV2,
  writeKLineChartRefreshRestoreConfigV2,
} from './chart/klineChartRendererV2/klineChartRefreshRestoreConfigV2'
import { kLineChartConfigV2 } from './chart/klineChartRendererV2/klineChartConfigV2'
import { traceKLineChartPageV2 } from './chart/klineChartRendererV2/klineChartPageDebugProbeV2'
import type { ChartLoadState, ChartPageNavigation, ChartPageTarget } from './chart/chartRuntimeTypes'
import {
  clearRealtimePageCachesV2,
} from './chart/historyPageCacheCleanupV2'
import {
  dispatchHistoryPageDailyRolloverRebuild,
  resolveNextHistoryPageDailyRolloverDelayMs,
} from './chart/pagePartition/historyPageDailyRolloverV2'
import type { StoreV6HistoryPageWindow } from './chart/historyPageWindowV2'
import { resolveStoreV6PagePartitionMode } from './chart/pagePartition/pagePartitionBuilder'
import {
  LEFT_RAIL_BRUSH_SVGREPO_ICON_48,
  LEFT_RAIL_CURSOR_ARROW_SVGREPO_ICON_48,
  LEFT_RAIL_DRAWING_FAVORITES_STAR_SVGREPO_48,
  LEFT_RAIL_FIB_RETRACEMENT_SVGREPO_ICON_48,
  LEFT_RAIL_FIVE_POINT_PATTERN_SVGREPO_ICON_48,
  LEFT_RAIL_HIDE_DRAWINGS_SVGREPO_ICON_48,
  LEFT_RAIL_LOCK_DRAWINGS_SVGREPO_ICON_48,
  LEFT_RAIL_LONG_POSITION_SVGREPO_ICON_48,
  LEFT_RAIL_MAGNET_STRONG_SVGREPO_ICON_48,
  LEFT_RAIL_MEASURE_RULER_SVGREPO_ICON_48,
  LEFT_RAIL_RAY_SVGREPO_ICON_48,
  LEFT_RAIL_REMOVE_SELECTED_DRAWINGS_SVGREPO_ICON_48,
  LEFT_RAIL_STAY_IN_DRAWING_MODE_SVGREPO_ICON_48,
  LEFT_RAIL_STICKER_EMOJI_SVGREPO_ICON_48,
  LEFT_RAIL_TEXT_SVGREPO_ICON_48,
  LEFT_RAIL_TREND_LINE_SVGREPO_ICON_48,
  LEFT_RAIL_ZOOM_IN_SVGREPO_ICON_48,
  LEFT_RAIL_ZOOM_OUT_SVGREPO_ICON_48,
} from './leftRailV4Icons'
import { RightDrawer } from './rightDrawer/RightDrawer'
import { useIndicatorsController } from './indicators/useIndicatorsController'
import { resolveMt5SymbolDisplay } from './rightDrawer/mt5SymbolDisplay'
import { objectTreeDrawingsChangedEvent } from './rightDrawer/objectTree/objectTreeModel'
import type { ObjectTreeDrawingItem } from './rightDrawer/objectTree/objectTreeTypes'
import type { IndicatorShortcutItem, RightDrawerId, StrategyShortcutItem } from './rightDrawer/RightDrawerTypes'
import type { Mt5SymbolRow } from '../services/mt5/mt5SymbolsApi'
import { formatChartLoadStatus } from './mt5DataCenter/storeV6StatusFormat'
import { readBooleanFlag, readJson, readString, removeStorageItem, writeBooleanFlag, writeJson, writeString } from './persistence/jsonStorage'
import { storageKeys } from './persistence/storageKeys'
import { readSettingsBooleanValue, readSettingsStringValue, settingsSymbolChangedEvent } from './settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './settings/chartSettingsSchema'
import { TopBar } from './topbar/TopBar'
import { visibilityRangeChangedEvent } from './visibilityRange/visibilityRangeModel'
import './openableControl.css'
import './AppShell.css'

const leftToolbarItems = [
  { type: 'button', label: 'Cursor', svg: LEFT_RAIL_CURSOR_ARROW_SVGREPO_ICON_48 },
  { type: 'button', label: 'Trend line', svg: LEFT_RAIL_TREND_LINE_SVGREPO_ICON_48 },
  { type: 'button', label: 'Ray', svg: LEFT_RAIL_RAY_SVGREPO_ICON_48 },
  { type: 'button', label: 'Fib retracement', svg: LEFT_RAIL_FIB_RETRACEMENT_SVGREPO_ICON_48 },
  { type: 'button', label: 'Brush', svg: LEFT_RAIL_BRUSH_SVGREPO_ICON_48 },
  { type: 'button', label: 'Text', svg: LEFT_RAIL_TEXT_SVGREPO_ICON_48 },
  { type: 'button', label: 'Five point pattern', svg: LEFT_RAIL_FIVE_POINT_PATTERN_SVGREPO_ICON_48 },
  { type: 'button', label: 'Long position', svg: LEFT_RAIL_LONG_POSITION_SVGREPO_ICON_48 },
  { type: 'button', label: 'Sticker', svg: LEFT_RAIL_STICKER_EMOJI_SVGREPO_ICON_48 },
  { type: 'divider' },
  { type: 'button', label: 'Measure', svg: LEFT_RAIL_MEASURE_RULER_SVGREPO_ICON_48 },
  { type: 'divider' },
  { type: 'button', label: 'Magnet', svg: LEFT_RAIL_MAGNET_STRONG_SVGREPO_ICON_48 },
  { type: 'button', label: 'Stay in drawing mode', svg: LEFT_RAIL_STAY_IN_DRAWING_MODE_SVGREPO_ICON_48 },
  { type: 'button', label: 'Lock drawings', svg: LEFT_RAIL_LOCK_DRAWINGS_SVGREPO_ICON_48 },
  { type: 'button', label: 'Hide drawings', svg: LEFT_RAIL_HIDE_DRAWINGS_SVGREPO_ICON_48 },
  { type: 'divider' },
  { type: 'button', label: 'Zoom in', svg: LEFT_RAIL_ZOOM_IN_SVGREPO_ICON_48 },
  { type: 'button', label: 'Zoom out', svg: LEFT_RAIL_ZOOM_OUT_SVGREPO_ICON_48 },
  { type: 'button', label: 'Remove drawings', svg: LEFT_RAIL_REMOVE_SELECTED_DRAWINGS_SVGREPO_ICON_48 },
] as const

const indicatorShortcutLabels: Record<string, string> = {
  RSI: '相对强弱指数',
  Stoch: '随机指标',
  SQZMOM: 'SQZMOM - Squeeze Momentum',
  MACD: '平滑异同移动平均线',
  DPO: '非趋势价格摆动指标',
  VDO: '漩涡差值指标',
  AO: '动量震荡指标',
  VMI: '漩涡动量指标',
  TSI: '真实强弱指数',
  VI: '漩涡指标',
  MA: '移动均线',
  MMF_V3: 'MMF v3 - 日内交易系统',
  'MR-M5': '\u6469\u6839\u533a\u95f4_5\u5206\u949f',
  'MR-M30': '\u6469\u6839\u533a\u95f4_30\u5206\u949f',
  VWAP: '成交量加权平均价',
  Vol: '成交量',
}

const strategyRows = [
  {
    key: 'main-trend-volatility',
    name: '主趋势波动策略',
    system: 'MMF_v3',
    type: '顺势',
  },
  {
    key: 'm5-breakout-pullback',
    name: '5分钟突破回撤策略',
    system: 'MMF_v3',
    type: '顺势',
  },
] as const

const strategyLabels = Object.fromEntries(strategyRows.map((row) => [row.key, row.name]))

function readInitialIndicatorShortcutKeys() {
  const parsed = readJson<unknown[]>(storageKeys.indicatorShortcutKeys, [])
  const keys = parsed
    .map((key) => key === 'MMF' || key === 'MMF_V2' ? 'MMF_V3' : key)
    .filter((key): key is string => typeof key === 'string' && key in indicatorShortcutLabels)
  return [...new Set(keys)]
}

function readInitialStrategyShortcutKeys() {
  const parsed = readJson<unknown[]>(storageKeys.strategyShortcutKeys, [])
  const keys = parsed.filter((key): key is string => typeof key === 'string' && key in strategyLabels)
  return [...new Set(keys)]
}

function readInitialStrategyPersistenceEnabled() {
  return readBooleanFlag(storageKeys.strategyPersistenceEnabled, true)
}

function readInitialLoadedStrategyKeys() {
  if (!readInitialStrategyPersistenceEnabled()) return []
  const parsed = readJson<unknown[]>(storageKeys.strategyLoadedKeys, [])
  const keys = parsed.filter((key): key is string => typeof key === 'string' && key in strategyLabels)
  return [...new Set(keys)]
}

function getInitialDrawerWidth() {
  const fallbackWidth = 280

  try {
    const raw = readString(storageKeys.rightWidgetDrawerWidthPx, '')
    const value = raw === '' ? fallbackWidth : Number(raw)
    return Math.max(220, Math.min(900, Math.round(value)))
  } catch {
    return fallbackWidth
  }
}

function getInitialBottomDrawerOpen() {
  return readBooleanFlag(storageKeys.bottomDrawerOpen)
}

function getInitialBottomDrawerHeight() {
  const fallbackHeight = 300

  try {
    const raw = readString(storageKeys.bottomDrawerHeightPx, '')
    const value = raw === '' ? fallbackHeight : Number(raw)
    return Math.max(220, Math.min(520, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialRightDrawerActive(): RightDrawerId | null {
  const value = readString(storageKeys.rightWidgetActiveDrawer)
  return value === 'drawings' || value === 'objectTree' || value === 'indicators' || value === 'strategy' || value === 'mt5' || value === 'settings' ? value : null
}

function readSharedSelection() {
  const parsed = readJson<{ symbol?: string; period?: string } | null>(storageKeys.importCenterSharedSelection, null)
  return {
    symbol: typeof parsed?.symbol === 'string' && parsed.symbol ? parsed.symbol : 'XAUUSDm',
    period: typeof parsed?.period === 'string' && parsed.period ? parsed.period : 'M1',
  }
}

function periodToChartPeriod(period: string) {
  return period.toUpperCase()
}

function isIsolatedChartPeriod(period: string | null | undefined) {
  return resolveStoreV6PagePartitionMode(period) === 'm5-time'
}

function createBlankChartTarget(symbol: string, period: string) {
  return {
    symbol,
    period,
    limit: 0,
    page: {
      blank: true,
      fromGlobalIndex: null,
      index: 0,
      limit: 0,
      realtime: false,
      rows: 0,
      toGlobalIndex: null,
    },
  }
}

function readInitialChartTarget(): ChartTarget {
  const restoreConfig = kLineChartConfigV2.refreshRestore.restoreLastPageOnRefresh
    ? readKLineChartRefreshRestoreConfigV2()
    : null
  if (restoreConfig && isIsolatedChartPeriod(restoreConfig.period)) {
    return createBlankChartTarget(restoreConfig.symbol, restoreConfig.period)
  }
  const shared = readSharedSelection()
  const period = periodToChartPeriod(shared.period)
  if (isIsolatedChartPeriod(period)) return createBlankChartTarget(shared.symbol, period)
  return {
    symbol: shared.symbol,
    period,
  }
}

type ChartTarget = {
  historyPageWindow?: StoreV6HistoryPageWindow | null
  pageNavigation?: ChartPageNavigation | null
  symbol: string
  period: string
  realtimeEnabled?: boolean
  totalRows?: number | null
  limit?: number
  reloadId?: number
  page?: ChartPageTarget | null
}

function readSymbolDisplayName(symbol: string) {
  const parsed = readJson<{ symbols?: Mt5SymbolRow[] } | null>(storageKeys.importCenterSymbolSnapshot, null)
  const row = parsed?.symbols?.find((item) => item.symbol === symbol)
  return row ? resolveMt5SymbolDisplay(row).chineseName : ''
}

function resolveWorkspaceTimezone() {
  const value = readSettingsStringValue(chartSettingKeys.timezone, chartSettingDefaults.timezone)
  return value === 'exchange' ? 'UTC' : value
}

function createDateFormatter(timezone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: timezone, ...options })
  } catch {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: 'UTC', ...options })
  }
}

function getDatePart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes, fallback: string) {
  return parts.find((part) => part.type === type)?.value ?? fallback
}

function formatWorkspaceClock(timestamp: number, timezone: string) {
  const date = new Date(timestamp)
  const weekday = createDateFormatter(timezone, { weekday: 'short' }).format(date)
  const parts = createDateFormatter(timezone, {
    day: 'numeric',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'numeric',
    second: '2-digit',
    year: 'numeric',
  }).formatToParts(date)
  const hour = getDatePart(parts, 'hour', '00')

  return `${weekday} ${getDatePart(parts, 'year', '1970')}/${getDatePart(parts, 'month', '1')}/${getDatePart(parts, 'day', '1')} ${hour === '24' ? '00' : hour}:${getDatePart(parts, 'minute', '00')}:${getDatePart(parts, 'second', '00')}`
}

function renderChartLoadStatus(state: ChartLoadState | null) {
  const text = formatChartLoadStatus(state)
  const match = /^(\S+)(\s+.*)$/.exec(text)
  if (!match) return text
  return (
    <>
      <strong>{match[1]}</strong>
      {match[2]}
    </>
  )
}

export function AppShell() {
  const [activeRightDrawer, setActiveRightDrawer] = useState<RightDrawerId | null>(getInitialRightDrawerActive)
  const activeRightDrawerRef = useRef<RightDrawerId | null>(activeRightDrawer)
  const [rightDrawerWidth, setRightDrawerWidth] = useState(getInitialDrawerWidth)
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(getInitialBottomDrawerOpen)
  const [bottomDrawerHeight, setBottomDrawerHeight] = useState(getInitialBottomDrawerHeight)
  const [activeBottomPanel, setActiveBottomPanel] = useState<(typeof bottomPanels)[number]['id']>('strategyTester')
  const [activeLeftTool, setActiveLeftTool] = useState('Cursor')
  const [indicatorShortcutKeys, setIndicatorShortcutKeys] = useState<string[]>(readInitialIndicatorShortcutKeys)
  const [strategyShortcutKeys, setStrategyShortcutKeys] = useState<string[]>(readInitialStrategyShortcutKeys)
  const [strategyPersistenceEnabled, setStrategyPersistenceEnabled] = useState(readInitialStrategyPersistenceEnabled)
  const [loadedStrategyKeys, setLoadedStrategyKeys] = useState<string[]>(readInitialLoadedStrategyKeys)
  const [chartTarget, setChartTarget] = useState<ChartTarget>(readInitialChartTarget)
  const [chartLoadState, setChartLoadState] = useState<ChartLoadState | null>(null)
  const indicatorsController = useIndicatorsController({
    chartLoadState,
    chartPeriod: chartTarget.period,
    chartSymbol: chartTarget.symbol,
    restoreContextExtra: [
      chartTarget.page?.index ?? 1,
      chartTarget.page?.realtime === false ? 'hist' : 'rt',
      chartTarget.page?.timeTo ?? '',
      chartTarget.reloadId ?? '',
    ].join(':'),
  })
  const loadedIndicatorKeys = indicatorsController.loadedIndicatorKeys
  const chartIndicatorRequestsV2 = useMemo<StoreV6IndicatorRequestSpecV2[]>(() => {
    const requests: StoreV6IndicatorRequestSpecV2[] = []
    if (loadedIndicatorKeys.includes('MA')) {
      requests.push({
        id: storeV6MaIndicatorIdV2,
        params: indicatorsController.settings.ma,
      })
    }
    if (loadedIndicatorKeys.includes('MR-M5')) {
      requests.push({
        id: storeV6MorganRangeM5RequestIdV2,
        params: indicatorsController.settings.mr,
      })
    }
    if (loadedIndicatorKeys.includes('Vol')) {
      requests.push({
        id: storeV6VolIndicatorIdV2,
        params: indicatorsController.settings.vol,
      })
    }
    if (loadedIndicatorKeys.includes('VWAP')) {
      requests.push({
        id: storeV6VwapIndicatorIdV2,
        params: indicatorsController.settings.vwap,
      })
    }
    if (loadedIndicatorKeys.includes('Stoch')) {
      requests.push({
        id: storeV6StochIndicatorIdV2,
        params: indicatorsController.settings.stoch,
      })
    }
    return requests
  }, [indicatorsController.settings.ma, indicatorsController.settings.mr, indicatorsController.settings.stoch, indicatorsController.settings.vol, indicatorsController.settings.vwap, loadedIndicatorKeys])
  const chartWorkspaceTarget = useMemo(() => ({
    ...chartTarget,
    indicatorRequests: chartIndicatorRequestsV2,
  }), [chartIndicatorRequestsV2, chartTarget])
  const refreshLoadedIndicatorsVisibility = indicatorsController.refreshLoadedIndicatorsVisibility
  const indicatorShortcuts: IndicatorShortcutItem[] = indicatorShortcutKeys.map((key) => ({
    key,
    loaded: loadedIndicatorKeys.some((loadedKey) => loadedKey === key),
    name: indicatorShortcutLabels[key] ?? key,
  }))
  const strategyShortcuts: StrategyShortcutItem[] = strategyShortcutKeys.map((key) => {
    const row = strategyRows.find((item) => item.key === key)
    return {
      key,
      loaded: loadedStrategyKeys.includes(key),
      name: row?.name ?? key,
      system: row?.system ?? '',
    }
  })
  const [symbolDisplayVersion, setSymbolDisplayVersion] = useState(0)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [clockTimezone, setClockTimezone] = useState(resolveWorkspaceTimezone)

  const chartDisplayName = readSymbolDisplayName(chartTarget.symbol)
  const chartLoadStatusVisible = readSettingsBooleanValue(
    chartSettingKeys.statusLocalDataLoadVisible,
    chartSettingDefaults.statusLocalDataLoadVisible,
  )
  void symbolDisplayVersion

  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const syncTimezone = () => setClockTimezone(resolveWorkspaceTimezone())
    window.addEventListener(settingsSymbolChangedEvent, syncTimezone)
    window.addEventListener('storage', syncTimezone)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, syncTimezone)
      window.removeEventListener('storage', syncTimezone)
    }
  }, [])

  useEffect(() => {
    const resize = () => window.dispatchEvent(new Event('resize'))
    resize()
    const timeoutId = window.setTimeout(resize, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [bottomDrawerHeight, bottomDrawerOpen, activeRightDrawer])

  useEffect(() => {
    const refresh = () => setSymbolDisplayVersion((current) => current + 1)
    window.addEventListener(settingsSymbolChangedEvent, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    writeString(storageKeys.rightWidgetDrawerWidthPx, String(rightDrawerWidth))
  }, [rightDrawerWidth])

  useEffect(() => {
    writeJson(storageKeys.indicatorShortcutKeys, indicatorShortcutKeys)
  }, [indicatorShortcutKeys])

  useEffect(() => {
    writeJson(storageKeys.strategyShortcutKeys, strategyShortcutKeys)
  }, [strategyShortcutKeys])

  useEffect(() => {
    writeBooleanFlag(storageKeys.strategyPersistenceEnabled, strategyPersistenceEnabled)
    if (strategyPersistenceEnabled) {
      writeJson(storageKeys.strategyLoadedKeys, loadedStrategyKeys)
    }
  }, [loadedStrategyKeys, strategyPersistenceEnabled])

  useEffect(() => {
    refreshLoadedIndicatorsVisibility()
  }, [chartTarget.period, chartTarget.symbol, refreshLoadedIndicatorsVisibility])

  useEffect(() => {
    activeRightDrawerRef.current = activeRightDrawer
  }, [activeRightDrawer])

  useEffect(() => {
    const handleObjectTreeDrawingsChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const items = Array.isArray(event.detail?.items) ? event.detail.items as ObjectTreeDrawingItem[] : []
      const selectedCount = items.filter((item) => item.selected).length
      if (selectedCount > 1 && activeRightDrawerRef.current !== 'drawings') setActiveRightDrawer('objectTree')
    }
    window.addEventListener(objectTreeDrawingsChangedEvent, handleObjectTreeDrawingsChanged)
    return () => window.removeEventListener(objectTreeDrawingsChangedEvent, handleObjectTreeDrawingsChanged)
  }, [])

  useEffect(() => {
    const handleVisibilityRangeChanged = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { key?: string } : {}
      const targetKey = typeof detail.key === 'string' && detail.key.startsWith('indicator:')
        ? detail.key.slice('indicator:'.length)
        : undefined
      refreshLoadedIndicatorsVisibility(targetKey)
    }
    window.addEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
    return () => window.removeEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
  }, [refreshLoadedIndicatorsVisibility])

  useEffect(() => {
    if (activeRightDrawer) {
      writeString(storageKeys.rightWidgetActiveDrawer, activeRightDrawer)
    } else {
      removeStorageItem(storageKeys.rightWidgetActiveDrawer)
    }
  }, [activeRightDrawer])

  useEffect(() => {
    writeBooleanFlag(storageKeys.bottomDrawerOpen, bottomDrawerOpen)
  }, [bottomDrawerOpen])

  useEffect(() => {
    let timer = 0
    const schedule = () => {
      const delay = resolveNextHistoryPageDailyRolloverDelayMs({
        symbol: chartTarget.symbol,
      })
      if (delay == null) return
      timer = window.setTimeout(() => {
        clearRealtimePageCachesV2({
          period: chartTarget.period,
          reason: 'daily-close',
          symbol: chartTarget.symbol,
        })
        dispatchHistoryPageDailyRolloverRebuild({
          period: chartTarget.period,
          symbol: chartTarget.symbol,
        })
        schedule()
      }, delay)
    }
    schedule()
    return () => {
      if (timer !== 0) window.clearTimeout(timer)
    }
  }, [chartTarget.period, chartTarget.symbol])

  useEffect(() => {
    writeString(storageKeys.bottomDrawerHeightPx, String(bottomDrawerHeight))
  }, [bottomDrawerHeight])

  const handleBottomResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = bottomDrawerHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeBottomPanelResizing = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (startY - moveEvent.clientY)
      setBottomDrawerHeight(Math.max(220, Math.min(520, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-bottom-panel-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Capture can already be gone if the pointer left the document.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  function handleToggleIndicatorShortcutLoad(name: string) {
    if (name !== 'DPO' && name !== 'MA' && name !== 'MACD' && name !== 'MMF_V3' && name !== 'MR-M5' && name !== 'MR-M30' && name !== 'RSI' && name !== 'SQZMOM' && name !== 'Stoch' && name !== 'TSI' && name !== 'VDO' && name !== 'VI' && name !== 'AO' && name !== 'VMI' && name !== 'VWAP' && name !== 'Vol') return
    if (loadedIndicatorKeys.includes(name)) {
      indicatorsController.unloadIndicator(name)
      return
    }
    indicatorsController.loadIndicator(name)
  }

  function handleLoadStrategy(key: string) {
    if (!(key in strategyLabels)) return
    setLoadedStrategyKeys((current) => current.includes(key) ? current : [...current, key])
  }

  function handleUnloadStrategy(key: string) {
    setLoadedStrategyKeys((current) => current.filter((item) => item !== key))
  }

  function handleToggleStrategyShortcutLoad(key: string) {
    if (loadedStrategyKeys.includes(key)) {
      handleUnloadStrategy(key)
      return
    }
    handleLoadStrategy(key)
  }

  function handleStrategyPersistenceEnabledChange(enabled: boolean) {
    setStrategyPersistenceEnabled(enabled)
    writeBooleanFlag(storageKeys.strategyPersistenceEnabled, enabled)
    if (enabled) {
      writeJson(storageKeys.strategyLoadedKeys, loadedStrategyKeys)
      return
    }
    removeStorageItem(storageKeys.strategyLoadedKeys)
  }

  function openChartTarget(nextTarget: ChartTarget) {
    const period = periodToChartPeriod(nextTarget.period)
    traceKLineChartPageV2('AppShell.openChartTarget', {
      hasHistoryPageWindow: Boolean(nextTarget.historyPageWindow),
      incomingPageIndex: nextTarget.page?.index ?? nextTarget.historyPageWindow?.pageIndex ?? null,
      incomingBlank: nextTarget.page?.blank === true,
      period,
      realtimeEnabled: nextTarget.realtimeEnabled ?? null,
      symbol: nextTarget.symbol,
    })
    if (isIsolatedChartPeriod(period) && nextTarget.historyPageWindow) {
      writeKLineChartRefreshRestoreConfigV2({
        pageIndex: nextTarget.page?.index ?? nextTarget.historyPageWindow.pageIndex,
        period,
        realtimeEnabled: nextTarget.realtimeEnabled,
        symbol: nextTarget.symbol,
      })
      setChartTarget({
        ...nextTarget,
        period,
      })
      traceKLineChartPageV2('AppShell.setChartTarget.historyWindow', {
        pageIndex: nextTarget.page?.index ?? nextTarget.historyPageWindow.pageIndex,
        period,
        symbol: nextTarget.symbol,
      })
      return
    }
    if (isIsolatedChartPeriod(period) && nextTarget.page?.blank !== true) {
      setChartTarget({
        ...createBlankChartTarget(nextTarget.symbol, period),
        reloadId: nextTarget.reloadId,
        totalRows: nextTarget.totalRows,
      })
      traceKLineChartPageV2('AppShell.setChartTarget.blankForIsolatedPeriod', {
        period,
        symbol: nextTarget.symbol,
      })
      return
    }
    setChartTarget({
      ...nextTarget,
      period,
    })
    traceKLineChartPageV2('AppShell.setChartTarget.direct', {
      pageIndex: nextTarget.page?.index ?? null,
      period,
      symbol: nextTarget.symbol,
    })
  }

  useEffect(() => {
    let cancelled = false
    if (!kLineChartConfigV2.refreshRestore.restoreLastPageOnRefresh) return
    if (!isIsolatedChartPeriod(chartTarget.period) || chartTarget.historyPageWindow || chartTarget.page?.blank !== true) return
    traceKLineChartPageV2('AppShell.restoreEffect.start', {
      currentPageIndex: chartTarget.page?.index ?? null,
      period: chartTarget.period,
      symbol: chartTarget.symbol,
    })
    void restoreKLineChartRefreshTargetV2()
      .then((target) => {
        traceKLineChartPageV2('AppShell.restoreEffect.result', {
          cancelled,
          pageIndex: target?.page.index ?? null,
          period: target?.period ?? null,
          symbol: target?.symbol ?? null,
        })
        if (cancelled || !target) return
        setChartTarget({
          historyPageWindow: target.historyPageWindow,
          page: target.page,
          pageNavigation: target.pageNavigation,
          period: target.period,
          realtimeEnabled: target.realtimeEnabled,
          reloadId: Date.now(),
          symbol: target.symbol,
          totalRows: target.totalRows,
        })
      })
      .catch(() => {
        // A missing or stale local restore cache should leave the clean blank chart.
      })
    return () => {
      cancelled = true
    }
  }, [chartTarget.historyPageWindow, chartTarget.page?.blank, chartTarget.period])

  return (
    <div className="ff-app-shell">
      <TopBar
        indicatorShortcuts={indicatorShortcuts}
        strategyShortcuts={strategyShortcuts}
        onIndicatorShortcutToggle={handleToggleIndicatorShortcutLoad}
        onJumpChartToTime={() => undefined}
        onLoadChartStep={() => undefined}
        onOpenChart={openChartTarget}
        onResetChartToLatest={() => undefined}
        onStrategyShortcutToggle={handleToggleStrategyShortcutLoad}
      />

      <main
        className="ff-app-main"
        data-right-drawer-open={activeRightDrawer != null}
        style={{
          ['--ff-right-drawer-width' as string]: `${rightDrawerWidth}px`,
        }}
      >
        <aside className="ff-left-rail" aria-label="Drawing toolbar">
          {leftToolbarItems.map((item, index) => {
            if (item.type === 'divider') {
              return <div className="ff-left-rail__divider" key={`divider-${index}`} />
            }

            return (
              <button
                className="ff-left-tool-btn"
                data-active={activeLeftTool === item.label}
                key={item.label}
                onClick={() => setActiveLeftTool(item.label)}
                aria-pressed={activeLeftTool === item.label}
                title={item.label}
                type="button"
                dangerouslySetInnerHTML={{ __html: item.svg }}
              />
            )
          })}
          <button
            className="ff-left-tool-btn ff-left-rail__favorite"
            title="Favorites"
            type="button"
            dangerouslySetInnerHTML={{ __html: LEFT_RAIL_DRAWING_FAVORITES_STAR_SVGREPO_48 }}
          />
        </aside>

        <section
          className="ff-chart-workspace"
          data-bottom-drawer-open={bottomDrawerOpen}
          style={{
            ['--ff-bottom-drawer-height' as string]: bottomDrawerOpen ? `${bottomDrawerHeight}px` : '40px',
          }}
        >
          <ChartWorkspaceV2
            displayName={chartDisplayName}
            onLoadStateChange={setChartLoadState}
            target={chartWorkspaceTarget}
          />
          {chartLoadStatusVisible && (
            <div className="ff-workspace-chart-load-status" aria-label="Chart load status">
              {renderChartLoadStatus(chartLoadState)}
            </div>
          )}
          <BottomWorkspace
            activeBottomPanel={activeBottomPanel}
            bottomDrawerOpen={bottomDrawerOpen}
            clockText={formatWorkspaceClock(clockNow, clockTimezone)}
            onClose={() => setBottomDrawerOpen(false)}
            onResizePointerDown={handleBottomResizePointerDown}
            onSelectPanel={(panel) => {
              setActiveBottomPanel(panel)
              setBottomDrawerOpen(true)
            }}
          />
        </section>

        <RightDrawer
          activeDrawer={activeRightDrawer}
          drawerWidth={rightDrawerWidth}
          indicatorShortcutKeys={indicatorShortcutKeys}
          indicatorsController={indicatorsController}
          loadedIndicatorKeys={loadedIndicatorKeys}
          loadedStrategyKeys={loadedStrategyKeys}
          strategyPersistenceEnabled={strategyPersistenceEnabled}
          morganRangeSegment={null}
          onClose={() => setActiveRightDrawer(null)}
          onIndicatorShortcutKeysChange={setIndicatorShortcutKeys}
          onStrategyLoad={handleLoadStrategy}
          onStrategyPersistenceEnabledChange={handleStrategyPersistenceEnabledChange}
          onStrategyShortcutKeysChange={setStrategyShortcutKeys}
          onStrategyUnload={handleUnloadStrategy}
          onOpenChart={openChartTarget}
          onResize={setRightDrawerWidth}
          onToggleDrawer={(drawer) => setActiveRightDrawer((current) => (current === drawer ? null : drawer))}
          strategyShortcutKeys={strategyShortcutKeys}
        />
      </main>
    </div>
  )
}

