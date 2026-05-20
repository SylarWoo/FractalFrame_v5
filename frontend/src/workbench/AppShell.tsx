import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ChartCoreHost } from './chart/ChartCoreHost'
import type { ChartLoadState } from './chart/ChartCoreHost'
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
import { resolveMt5SymbolDisplay } from './rightDrawer/mt5SymbolDisplay'
import type { Mt5SymbolRow } from './rightDrawer/mt5SymbolsApi'
import { readSettingsStringValue, settingsSymbolChangedEvent } from './settingsSymbolState'
import { TopBar } from './topbar/TopBar'
import './openableControl.css'
import './AppShell.css'

const drawerWidthStorageKey = 'fractalframe:rightWidgetDrawerWidthPx:v1'
const rightDrawerActiveStorageKey = 'fractalframe:rightWidgetActiveDrawer:v1'
const bottomDrawerOpenStorageKey = 'fractalframe:bottomDrawerOpen:v1'
const bottomDrawerHeightStorageKey = 'fractalframe:bottomDrawerHeightPx:v1'
const sharedSelectionStorageKey = 'fractalframe:mt5ImportCenterSharedSelection:v1'
const symbolSnapshotStorageKey = 'fractalframe:mt5ImportCenterSymbolSnapshot:v1'

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

const bottomPanels = [
  { id: 'strategyTester', label: 'ST', title: 'Strategy Tester', placeholder: 'Strategy tester workspace' },
  { id: 'logs', label: 'Logs', title: 'Logs', placeholder: 'Runtime logs workspace' },
  { id: 'terminal', label: 'Term', title: 'Terminal', placeholder: 'Terminal workspace' },
  { id: 'notes', label: 'Notes', title: 'Notes', placeholder: 'Notes workspace' },
] as const

function getInitialDrawerWidth() {
  const fallbackWidth = 280

  try {
    const raw = window.localStorage.getItem(drawerWidthStorageKey)
    const value = raw == null ? fallbackWidth : Number(raw)
    return Math.max(220, Math.min(900, Math.round(value)))
  } catch {
    return fallbackWidth
  }
}

function getInitialBottomDrawerOpen() {
  try {
    return window.localStorage.getItem(bottomDrawerOpenStorageKey) === '1'
  } catch {
    return false
  }
}

function getInitialBottomDrawerHeight() {
  const fallbackHeight = 300

  try {
    const raw = window.localStorage.getItem(bottomDrawerHeightStorageKey)
    const value = raw == null ? fallbackHeight : Number(raw)
    return Math.max(220, Math.min(520, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialRightDrawerActive(): 'mt5' | 'settings' | null {
  try {
    const value = window.localStorage.getItem(rightDrawerActiveStorageKey)
    return value === 'mt5' || value === 'settings' ? value : null
  } catch {
    return null
  }
}

function readSharedSelection() {
  try {
    const raw = window.localStorage.getItem(sharedSelectionStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return {
      symbol: typeof parsed?.symbol === 'string' && parsed.symbol ? parsed.symbol : 'XAUUSDm',
      period: typeof parsed?.period === 'string' && parsed.period ? parsed.period : 'M1',
    }
  } catch {
    return { symbol: 'XAUUSDm', period: 'M1' }
  }
}

function periodToChartPeriod(period: string) {
  return period.toUpperCase() === 'M1' ? '1m' : period
}

function readSymbolDisplayName(symbol: string) {
  try {
    const raw = window.localStorage.getItem(symbolSnapshotStorageKey)
    const parsed = raw ? JSON.parse(raw) as { symbols?: Mt5SymbolRow[] } : null
    const row = parsed?.symbols?.find((item) => item.symbol === symbol)
    return row ? resolveMt5SymbolDisplay(row).chineseName : ''
  } catch {
    return ''
  }
}

function resolveWorkspaceTimezone() {
  const value = readSettingsStringValue('time.timezone', 'UTC')
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

export function AppShell() {
  const [activeRightDrawer, setActiveRightDrawer] = useState<'mt5' | 'settings' | null>(getInitialRightDrawerActive)
  const [rightDrawerWidth, setRightDrawerWidth] = useState(getInitialDrawerWidth)
  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(getInitialBottomDrawerOpen)
  const [bottomDrawerHeight, setBottomDrawerHeight] = useState(getInitialBottomDrawerHeight)
  const [activeBottomPanel, setActiveBottomPanel] = useState<(typeof bottomPanels)[number]['id']>('strategyTester')
  const [activeLeftTool, setActiveLeftTool] = useState('Cursor')
  const [chartTarget, setChartTarget] = useState<{ symbol: string; period: string; totalRows?: number | null; reloadId?: number }>(() => {
    const shared = readSharedSelection()
    return {
      symbol: shared.symbol,
      period: periodToChartPeriod(shared.period),
    }
  })
  const [chartJump, setChartJump] = useState<{ id: number; timestamp?: number } | null>(null)
  const [chartStepLoad, setChartStepLoad] = useState<{ direction: 'left' | 'right'; id: number } | null>(null)
  const [chartLoadState, setChartLoadState] = useState<ChartLoadState | null>(null)
  const [symbolDisplayVersion, setSymbolDisplayVersion] = useState(0)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const [clockTimezone, setClockTimezone] = useState(resolveWorkspaceTimezone)

  const currentBottomPanel = bottomPanels.find((panel) => panel.id === activeBottomPanel) ?? bottomPanels[0]
  const chartDisplayName = readSymbolDisplayName(chartTarget.symbol)
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
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(drawerWidthStorageKey, String(rightDrawerWidth))
    } catch {
      // Width persistence is best-effort only.
    }
  }, [rightDrawerWidth])

  useEffect(() => {
    try {
      if (activeRightDrawer) {
        window.localStorage.setItem(rightDrawerActiveStorageKey, activeRightDrawer)
      } else {
        window.localStorage.removeItem(rightDrawerActiveStorageKey)
      }
    } catch {
      // Right drawer open state persistence is best-effort only.
    }
  }, [activeRightDrawer])

  useEffect(() => {
    try {
      window.localStorage.setItem(bottomDrawerOpenStorageKey, bottomDrawerOpen ? '1' : '0')
    } catch {
      // Bottom drawer persistence is best-effort only.
    }
  }, [bottomDrawerOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(bottomDrawerHeightStorageKey, String(bottomDrawerHeight))
    } catch {
      // Bottom drawer height persistence is best-effort only.
    }
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

  return (
    <div className="ff-app-shell">
      <TopBar onOpenChart={setChartTarget} />

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
            jump={chartJump}
            onLoadStateChange={setChartLoadState}
            period={chartTarget.period}
            reloadId={chartTarget.reloadId}
            stepLoad={chartStepLoad}
            symbol={chartTarget.symbol}
            totalRows={chartTarget.totalRows}
          />

          <section className="ff-bottom-shell" aria-label="Bottom workspace drawer">
            <div className="ff-bottom-toggle-row">
              <div className="ff-bottom-toggle-row__panel-toggles" role="tablist" aria-label="Bottom drawer tabs">
                {bottomPanels.map((panel) => (
                  <button
                    aria-selected={activeBottomPanel === panel.id && bottomDrawerOpen}
                    className="ff-bottom-panel-toggle-btn"
                    data-active={activeBottomPanel === panel.id && bottomDrawerOpen ? 'true' : 'false'}
                    key={panel.id}
                    onClick={() => {
                      setActiveBottomPanel(panel.id)
                      setBottomDrawerOpen(true)
                    }}
                    role="tab"
                    type="button"
                  >
                    {panel.label}
                  </button>
                ))}
              </div>
              <div className="ff-workspace-bottom-status" aria-label="Workspace clock">
                {formatWorkspaceClock(clockNow, clockTimezone)}
              </div>
            </div>

            <section className="ff-bottom-panel" data-open={bottomDrawerOpen ? 'true' : 'false'}>
              {bottomDrawerOpen && (
                <div
                  aria-label="Resize bottom panel"
                  className="ff-bottom-panel__resize-handle"
                  onPointerDown={handleBottomResizePointerDown}
                  role="separator"
                  tabIndex={0}
                />
              )}
              <header className="ff-bottom-panel__header">
                <span className="ff-bottom-panel__title">{currentBottomPanel.title}</span>
                <button
                  aria-label="Close bottom panel"
                  className="ff-bottom-panel__close"
                  onClick={() => setBottomDrawerOpen(false)}
                  type="button"
                >
                  x
                </button>
              </header>
              <div className="ff-bottom-panel__body">
                <p className="ff-bottom-panel__placeholder">{currentBottomPanel.placeholder}</p>
              </div>
            </section>
          </section>
        </section>

        <RightDrawer
          activeDrawer={activeRightDrawer}
          chartLoadState={chartLoadState}
          drawerWidth={rightDrawerWidth}
          onClose={() => setActiveRightDrawer(null)}
          onJumpChartToTime={(timestamp) => setChartJump({ id: Date.now(), timestamp })}
          onLoadChartStep={(direction) => setChartStepLoad({ direction, id: Date.now() })}
          onOpenChart={setChartTarget}
          onResetChartToLatest={() => setChartJump({ id: Date.now() })}
          onResize={setRightDrawerWidth}
          onToggleDrawer={(drawer) => setActiveRightDrawer((current) => (current === drawer ? null : drawer))}
        />
      </main>
    </div>
  )
}
