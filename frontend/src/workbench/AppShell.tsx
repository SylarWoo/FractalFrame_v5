import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { bottomPanels } from './bottomDrawer/bottomPanels'
import { BottomWorkspace } from './bottomDrawer/BottomWorkspace'
import { ChartCoreHost } from './chart/ChartCoreHost'
import type { ChartLoadState } from './chart/ChartCoreHost'
import type { ChartIndicatorCommand } from './chart/ChartCoreHost'
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
import { readIndicatorPersistenceEnabled, readPersistedIndicatorsState } from './rightDrawer/indicatorPersistence'
import type { MacdIndicatorSettings, MaIndicatorSettings, RsiIndicatorSettings, StochIndicatorSettings, TsiIndicatorSettings, ViIndicatorSettings, VolIndicatorSettings, VwapIndicatorSettings } from './rightDrawer/indicatorPersistence'
import { resolveMt5SymbolDisplay } from './rightDrawer/mt5SymbolDisplay'
import type { IndicatorShortcutItem, RightDrawerId } from './rightDrawer/RightDrawerTypes'
import type { Mt5SymbolRow } from '../services/mt5/mt5SymbolsApi'
import { formatChartLoadStatus } from './mt5DataCenter/storeV5StatusFormat'
import { readBooleanFlag, readJson, readString, removeStorageItem, writeBooleanFlag, writeJson, writeString } from './persistence/jsonStorage'
import { storageKeys } from './persistence/storageKeys'
import { readSettingsBooleanValue, readSettingsStringValue, settingsSymbolChangedEvent } from './settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from './settings/chartSettingsSchema'
import { TopBar } from './topbar/TopBar'
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
  MACD: '平滑异同移动线',
  TSI: '真实强弱指数',
  VI: '漩涡指标',
  MA: '移动均线',
  VWAP: '成交量加权平均价',
  Vol: '成交量',
}

function readInitialLoadedIndicatorKeys() {
  if (!readIndicatorPersistenceEnabled()) return []
  const persisted = readPersistedIndicatorsState()
  const keys: string[] = []
  if (persisted.loaded.RSI) keys.push('RSI')
  if (persisted.loaded.Stoch) keys.push('Stoch')
  if (persisted.loaded.MACD) keys.push('MACD')
  if (persisted.loaded.TSI) keys.push('TSI')
  if (persisted.loaded.VI) keys.push('VI')
  if (persisted.loaded.MA) keys.push('MA')
  if (persisted.loaded.VWAP) keys.push('VWAP')
  if (persisted.loaded.Vol) keys.push('Vol')
  return keys
}

function readInitialIndicatorShortcutKeys() {
  const parsed = readJson<unknown[]>(storageKeys.indicatorShortcutKeys, [])
  const keys = parsed.filter((key): key is string => typeof key === 'string' && key in indicatorShortcutLabels)
  return [...new Set(keys)]
}

function getPersistedIndicatorSettings(name: ChartIndicatorCommand['name']) {
  const persisted = readPersistedIndicatorsState()
  if (name === 'MA') return persisted.ma
  if (name === 'MACD') return persisted.macd
  if (name === 'VWAP') return persisted.vwap
  if (name === 'Vol') return persisted.vol
  if (name === 'Stoch') return persisted.stoch
  if (name === 'TSI') return persisted.tsi
  if (name === 'VI') return persisted.vi
  return persisted.rsi
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
  return value === 'indicators' || value === 'mt5' || value === 'settings' ? value : null
}

function readSharedSelection() {
  const parsed = readJson<{ symbol?: string; period?: string } | null>(storageKeys.importCenterSharedSelection, null)
  return {
    symbol: typeof parsed?.symbol === 'string' && parsed.symbol ? parsed.symbol : 'XAUUSDm',
    period: typeof parsed?.period === 'string' && parsed.period ? parsed.period : 'M1',
  }
}

function periodToChartPeriod(period: string) {
  return period.toUpperCase() === 'M1' ? '1m' : period
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
  const [rightDrawerWidth, setRightDrawerWidth] = useState(getInitialDrawerWidth)
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(getInitialBottomDrawerOpen)
  const [bottomDrawerHeight, setBottomDrawerHeight] = useState(getInitialBottomDrawerHeight)
  const [activeBottomPanel, setActiveBottomPanel] = useState<(typeof bottomPanels)[number]['id']>('strategyTester')
  const [activeLeftTool, setActiveLeftTool] = useState('Cursor')
  const [indicatorShortcutKeys, setIndicatorShortcutKeys] = useState<string[]>(readInitialIndicatorShortcutKeys)
  const [loadedIndicatorKeys, setLoadedIndicatorKeys] = useState<string[]>(readInitialLoadedIndicatorKeys)
  const indicatorShortcuts: IndicatorShortcutItem[] = indicatorShortcutKeys.map((key) => ({
    key,
    loaded: loadedIndicatorKeys.includes(key),
    name: indicatorShortcutLabels[key] ?? key,
  }))
  const [chartTarget, setChartTarget] = useState<{ symbol: string; period: string; totalRows?: number | null; reloadId?: number }>(() => {
    const shared = readSharedSelection()
    return {
      symbol: shared.symbol,
      period: periodToChartPeriod(shared.period),
    }
  })
  const [chartJump, setChartJump] = useState<{ id: number; timestamp?: number } | null>(null)
  const [chartStepLoad, setChartStepLoad] = useState<{ direction: 'left' | 'right'; id: number } | null>(null)
  const [chartIndicatorCommand, setChartIndicatorCommand] = useState<ChartIndicatorCommand | null>(() => {
    if (!readIndicatorPersistenceEnabled()) return null
    const persisted = readPersistedIndicatorsState()
    if (persisted.loaded.RSI) return { action: 'load', id: Date.now(), name: 'RSI', settings: persisted.rsi }
    if (persisted.loaded.Stoch) return { action: 'load', id: Date.now(), name: 'Stoch', settings: persisted.stoch }
    if (persisted.loaded.MACD) return { action: 'load', id: Date.now(), name: 'MACD', settings: persisted.macd }
    if (persisted.loaded.TSI) return { action: 'load', id: Date.now(), name: 'TSI', settings: persisted.tsi }
    if (persisted.loaded.VI) return { action: 'load', id: Date.now(), name: 'VI', settings: persisted.vi }
    if (persisted.loaded.MA) return { action: 'load', id: Date.now(), name: 'MA', settings: persisted.ma }
    if (persisted.loaded.VWAP) return { action: 'load', id: Date.now(), name: 'VWAP', settings: persisted.vwap }
    if (persisted.loaded.Vol) return { action: 'load', id: Date.now(), name: 'Vol', settings: persisted.vol }
    return null
  })
  const restoredPersistedIndicatorsRef = useRef(false)
  const [chartLoadState, setChartLoadState] = useState<ChartLoadState | null>(null)
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
    if (restoredPersistedIndicatorsRef.current || !readIndicatorPersistenceEnabled()) return
    restoredPersistedIndicatorsRef.current = true
    const persisted = readPersistedIndicatorsState()
    const scheduled: ChartIndicatorCommand[] = []
    if (persisted.loaded.RSI && chartIndicatorCommand?.name !== 'RSI') scheduled.push({ action: 'load', id: Date.now(), name: 'RSI', settings: persisted.rsi })
    if (persisted.loaded.Stoch && chartIndicatorCommand?.name !== 'Stoch') scheduled.push({ action: 'load', id: Date.now(), name: 'Stoch', settings: persisted.stoch })
    if (persisted.loaded.MACD && chartIndicatorCommand?.name !== 'MACD') scheduled.push({ action: 'load', id: Date.now(), name: 'MACD', settings: persisted.macd })
    if (persisted.loaded.TSI && chartIndicatorCommand?.name !== 'TSI') scheduled.push({ action: 'load', id: Date.now(), name: 'TSI', settings: persisted.tsi })
    if (persisted.loaded.VI && chartIndicatorCommand?.name !== 'VI') scheduled.push({ action: 'load', id: Date.now(), name: 'VI', settings: persisted.vi })
    if (persisted.loaded.MA && chartIndicatorCommand?.name !== 'MA') scheduled.push({ action: 'load', id: Date.now(), name: 'MA', settings: persisted.ma })
    if (persisted.loaded.VWAP && chartIndicatorCommand?.name !== 'VWAP') scheduled.push({ action: 'load', id: Date.now(), name: 'VWAP', settings: persisted.vwap })
    if (persisted.loaded.Vol && chartIndicatorCommand?.name !== 'Vol') scheduled.push({ action: 'load', id: Date.now(), name: 'Vol', settings: persisted.vol })
    scheduled.forEach((command, index) => {
      window.setTimeout(() => setChartIndicatorCommand({ ...command, id: Date.now() }), index * 30)
    })
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

  function handleLoadIndicator(name: ChartIndicatorCommand['name'], settings?: MacdIndicatorSettings | MaIndicatorSettings | RsiIndicatorSettings | StochIndicatorSettings | TsiIndicatorSettings | ViIndicatorSettings | VolIndicatorSettings | VwapIndicatorSettings) {
    setLoadedIndicatorKeys((current) => current.includes(name) ? current : [...current, name])
    if (name === 'MA') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as MaIndicatorSettings })
    } else if (name === 'MACD') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as MacdIndicatorSettings })
    } else if (name === 'VWAP') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as VwapIndicatorSettings })
    } else if (name === 'Vol') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as VolIndicatorSettings })
    } else if (name === 'Stoch') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as StochIndicatorSettings })
    } else if (name === 'TSI') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as TsiIndicatorSettings })
    } else if (name === 'VI') {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as ViIndicatorSettings })
    } else {
      setChartIndicatorCommand({ action: 'load', id: Date.now(), name, settings: settings as RsiIndicatorSettings })
    }
  }

  function handleUnloadIndicator(name: ChartIndicatorCommand['name']) {
    setLoadedIndicatorKeys((current) => current.filter((key) => key !== name))
    if (name === 'MA') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else if (name === 'MACD') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else if (name === 'VWAP') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else if (name === 'Vol') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else if (name === 'Stoch') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else if (name === 'TSI') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else if (name === 'VI') {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name })
    } else {
      setChartIndicatorCommand({ action: 'unload', id: Date.now(), name: 'RSI' })
    }
  }

  function handleToggleIndicatorShortcutLoad(name: string) {
    if (name !== 'MA' && name !== 'MACD' && name !== 'RSI' && name !== 'Stoch' && name !== 'TSI' && name !== 'VI' && name !== 'VWAP' && name !== 'Vol') return
    if (loadedIndicatorKeys.includes(name)) {
      handleUnloadIndicator(name)
      return
    }
    handleLoadIndicator(name, getPersistedIndicatorSettings(name))
  }

  return (
    <div className="ff-app-shell">
      <TopBar
        indicatorShortcuts={indicatorShortcuts}
        onIndicatorShortcutToggle={handleToggleIndicatorShortcutLoad}
        onJumpChartToTime={(timestamp) => setChartJump({ id: Date.now(), timestamp })}
        onLoadChartStep={(direction) => setChartStepLoad({ direction, id: Date.now() })}
        onOpenChart={setChartTarget}
        onResetChartToLatest={() => setChartJump({ id: Date.now() })}
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
          <ChartCoreHost
            displayName={chartDisplayName}
            indicatorCommand={chartIndicatorCommand}
            jump={chartJump}
            onLoadStateChange={setChartLoadState}
            period={chartTarget.period}
            reloadId={chartTarget.reloadId}
            stepLoad={chartStepLoad}
            symbol={chartTarget.symbol}
            totalRows={chartTarget.totalRows}
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
          loadedIndicatorKeys={loadedIndicatorKeys}
          onClose={() => setActiveRightDrawer(null)}
          onIndicatorShortcutKeysChange={setIndicatorShortcutKeys}
          onLoadIndicator={handleLoadIndicator}
          onOpenChart={setChartTarget}
          onResize={setRightDrawerWidth}
          onToggleDrawer={(drawer) => setActiveRightDrawer((current) => (current === drawer ? null : drawer))}
          onUnloadIndicator={handleUnloadIndicator}
        />
      </main>
    </div>
  )
}
