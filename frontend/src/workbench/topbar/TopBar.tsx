import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useShortcutMenuState } from './useShortcutMenuState'
import type { OpenChartOptions } from './useShortcutMenuState'
import './TopBar.css'

type TopBarProps = {
  indicatorShortcuts?: Array<{ key: string; loaded: boolean; name: string }>
  onIndicatorShortcutToggle?: (key: string) => void
  onJumpChartToTime?: (timestamp: number) => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onOpenChart?: (options: OpenChartOptions) => void
  onResetChartToLatest?: () => void
}

const shortcutMenuWidthKey = 'fractalframe:topbarShortcutMenuWidthPx:v1'
const shortcutMenuDefaultWidth = 490
const shortcutMenuMinWidth = 116
const calendarWeekdays = ['一', '二', '三', '四', '五', '六', '日']

function readShortcutMenuWidth() {
  const raw = window.localStorage.getItem(shortcutMenuWidthKey)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= shortcutMenuMinWidth ? parsed : shortcutMenuDefaultWidth
}

function startOfCalendarMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addCalendarMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function addCalendarYears(date: Date, amount: number) {
  return new Date(date.getFullYear() + amount, date.getMonth(), 1)
}

function sameCalendarDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
}

function buildCalendarDays(month: Date) {
  const first = startOfCalendarMonth(month)
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - mondayOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

export function TopBar({ indicatorShortcuts = [], onIndicatorShortcutToggle, onJumpChartToTime, onLoadChartStep, onOpenChart, onResetChartToLatest }: TopBarProps) {
  const symbolRootRef = useRef<HTMLDivElement | null>(null)
  const shortcutMenuRef = useRef<HTMLDivElement | null>(null)
  const calendarRootRef = useRef<HTMLDivElement | null>(null)
  const walletRootRef = useRef<HTMLDivElement | null>(null)
  const [shortcutMenuWidth, setShortcutMenuWidth] = useState(readShortcutMenuWidth)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfCalendarMonth(new Date()))
  const {
    activePeriod,
    enabled,
    open,
    openPeriod,
    periods,
    selectedSymbol,
    selectSymbol,
    setOpen,
    symbols,
  } = useShortcutMenuState({ onOpenChart })

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (symbolRootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [open, setOpen])

  useEffect(() => {
    if (!calendarOpen) return
    const close = (event: MouseEvent) => {
      if (calendarRootRef.current?.contains(event.target as Node)) return
      setCalendarOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCalendarOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [calendarOpen])

  useEffect(() => {
    if (!walletOpen) return
    const close = (event: MouseEvent) => {
      if (walletRootRef.current?.contains(event.target as Node)) return
      setWalletOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWalletOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [walletOpen])

  useEffect(() => {
    if (indicatorShortcuts.length === 0) setWalletOpen(false)
  }, [indicatorShortcuts.length])

  function handleShortcutMenuResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const root = shortcutMenuRef.current
    if (!root) return
    event.preventDefault()
    const startRect = root.getBoundingClientRect()
    const maxWidth = Math.max(shortcutMenuMinWidth, window.innerWidth - startRect.left - 16)

    const applyWidth = (clientX: number) => {
      const next = Math.round(Math.min(maxWidth, Math.max(shortcutMenuMinWidth, clientX - startRect.left)))
      setShortcutMenuWidth(next)
      window.localStorage.setItem(shortcutMenuWidthKey, String(next))
    }
    const handleMove = (moveEvent: PointerEvent) => applyWidth(moveEvent.clientX)
    const handleUp = () => {
      document.body.removeAttribute('data-fractalframe-topbar-resizing')
      window.removeEventListener('pointermove', handleMove, true)
      window.removeEventListener('pointerup', handleUp, true)
      window.removeEventListener('pointercancel', handleUp, true)
    }

    document.body.setAttribute('data-fractalframe-topbar-resizing', 'true')
    window.addEventListener('pointermove', handleMove, true)
    window.addEventListener('pointerup', handleUp, true)
    window.addEventListener('pointercancel', handleUp, true)
  }

  return (
    <header className="ff-topbar">
      <div className="ff-topbar__brand">FractalFrame</div>

      {enabled && symbols.length > 0 && (
        <div
          className="ff-shortcut-menu"
          ref={shortcutMenuRef}
          style={{ '--ff-shortcut-menu-width': `${shortcutMenuWidth}px` } as CSSProperties}
        >
          <div className="ff-shortcut-symbol" data-open={open} ref={symbolRootRef}>
            <button
              aria-expanded={open}
              className="ff-shortcut-symbol__toggle ff-openable-control"
              onClick={() => setOpen((current) => !current)}
              type="button"
            >
              <span>{selectedSymbol || symbols[0]}</span>
            </button>
            {open && (
              <div className="ff-shortcut-symbol__menu">
                {symbols.map((symbol) => (
                  <button
                    data-active={symbol === selectedSymbol}
                    key={symbol}
                    onClick={() => selectSymbol(symbol)}
                    type="button"
                  >
                    <span>{symbol}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ff-shortcut-periods">
            {periods.map((option) => (
              <button
                data-active={activePeriod === option.period}
                key={option.period}
                onClick={() => openPeriod(option)}
                type="button"
              >
                {option.period}
              </button>
            ))}
          </div>

          <div
            aria-label="Resize shortcut menu"
            className="ff-shortcut-menu__resize-handle"
            onPointerDown={handleShortcutMenuResizePointerDown}
            role="separator"
          />
        </div>
      )}

      <div className="ff-topbar-calendar" data-open={calendarOpen} ref={calendarRootRef}>
        <button
          aria-expanded={calendarOpen}
          aria-label="Calendar"
          className="ff-topbar-icon-btn"
          onClick={() => setCalendarOpen((current) => !current)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 48 48">
            <polyline points="20.287 37 29.963 19 18.037 19" />
            <circle cx="32.5" cy="11" r="2.5" />
            <circle cx="15.5" cy="11" r="2.5" />
            <path d="M7.5,5.5a2,2,0,0,0-2,2v33a2,2,0,0,0,2,2h33a2,2,0,0,0,2-2V7.5a2,2,0,0,0-2-2Z" />
          </svg>
        </button>

        {calendarOpen && (
          <div className="ff-topbar-calendar__popover">
            <div className="ff-topbar-calendar__header">
              <button aria-label="上一年" onClick={() => setCalendarMonth((current) => addCalendarYears(current, -1))} type="button">&lt;&lt;</button>
              <button aria-label="上一月" onClick={() => setCalendarMonth((current) => addCalendarMonths(current, -1))} type="button">&lt;</button>
              <strong>{calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月</strong>
              <button aria-label="下一月" onClick={() => setCalendarMonth((current) => addCalendarMonths(current, 1))} type="button">&gt;</button>
              <button aria-label="下一年" onClick={() => setCalendarMonth((current) => addCalendarYears(current, 1))} type="button">&gt;&gt;</button>
            </div>
            <div className="ff-topbar-calendar__weekdays">
              {calendarWeekdays.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="ff-topbar-calendar__days">
              {buildCalendarDays(calendarMonth).map((day) => {
                const inMonth = day.getMonth() === calendarMonth.getMonth()
                const today = sameCalendarDate(day, new Date())
                return (
                  <button
                    data-current-month={inMonth}
                    data-today={today}
                    key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                    onClick={() => {
                      onJumpChartToTime?.(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0).getTime())
                      setCalendarOpen(false)
                    }}
                    type="button"
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
            <div className="ff-topbar-calendar__chart-nav" aria-label="Chart range navigation">
              <button aria-label="向左加载10000根K线" onClick={() => onLoadChartStep?.('left')} type="button">&lt;&lt;</button>
              <button aria-label="向右加载10000根K线" onClick={() => onLoadChartStep?.('right')} type="button">&gt;&gt;</button>
              <button aria-label="回到最后一根K线" onClick={onResetChartToLatest} type="button">回到现在</button>
            </div>
          </div>
        )}
      </div>

      <div className="ff-topbar-wallet" data-open={walletOpen} ref={walletRootRef}>
        <button
          aria-expanded={walletOpen}
          aria-label="Indicator shortcuts"
          className="ff-topbar-icon-btn ff-topbar-wallet-btn"
          onClick={() => setWalletOpen((current) => indicatorShortcuts.length > 0 ? !current : false)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 48 48">
            <path d="M6.7,23.25V16.13a2,2,0,0,1,2-2H41.5a2,2,0,0,1,2,2v23a2,2,0,0,1-2,2H8.7a2,2,0,0,1-2-2V32" />
            <path d="M5.5,23.25H17a2,2,0,0,1,2,2V30a2,2,0,0,1-2,2H5.5a1,1,0,0,1-1-1V24.25A1,1,0,0,1,5.5,23.25Z" />
            <circle cx="14.49" cy="27.63" r="2" />
            <polyline points="38.12 14.13 13.19 6.87 11.08 14.13" />
          </svg>
        </button>
        {walletOpen && indicatorShortcuts.length > 0 && (
          <div className="ff-topbar-wallet__menu">
            {indicatorShortcuts.map((item) => (
              <button data-loaded={item.loaded} key={item.key} onClick={() => onIndicatorShortcutToggle?.(item.key)} type="button">
                <span className="ff-topbar-wallet__check">{item.loaded ? '✓' : ''}</span>
                <strong>{item.key}</strong>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
