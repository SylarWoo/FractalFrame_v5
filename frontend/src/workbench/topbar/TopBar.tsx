import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useShortcutMenuState } from './useShortcutMenuState'
import type { OpenChartOptions } from './useShortcutMenuState'
import type { StrategyShortcutItem } from '../rightDrawer/RightDrawerTypes'
import { readString, writeString } from '../persistence/jsonStorage'
import './TopBar.css'

type TopBarProps = {
  indicatorShortcuts?: Array<{ key: string; loaded: boolean; name: string }>
  strategyShortcuts?: StrategyShortcutItem[]
  onIndicatorShortcutToggle?: (key: string) => void
  onJumpChartToTime?: (timestamp: number) => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onOpenChart?: (options: OpenChartOptions) => void
  onResetChartToLatest?: () => void
  onStrategyShortcutToggle?: (key: string) => void
}

const shortcutMenuWidthKey = 'fractalframe:topbarShortcutMenuWidthPx:v1'
const shortcutMenuDefaultWidth = 490
const shortcutMenuMinWidth = 116
const calendarWeekdays = ['一', '二', '三', '四', '五', '六', '日']

function readShortcutMenuWidth() {
  const raw = readString(shortcutMenuWidthKey)
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

export function TopBar({
  indicatorShortcuts = [],
  strategyShortcuts = [],
  onIndicatorShortcutToggle,
  onJumpChartToTime,
  onLoadChartStep,
  onOpenChart,
  onResetChartToLatest,
  onStrategyShortcutToggle,
}: TopBarProps) {
  const symbolRootRef = useRef<HTMLDivElement | null>(null)
  const shortcutMenuRef = useRef<HTMLDivElement | null>(null)
  const calendarRootRef = useRef<HTMLDivElement | null>(null)
  const walletRootRef = useRef<HTMLDivElement | null>(null)
  const strategyRootRef = useRef<HTMLDivElement | null>(null)
  const [shortcutMenuWidth, setShortcutMenuWidth] = useState(readShortcutMenuWidth)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)
  const [strategyOpen, setStrategyOpen] = useState(false)
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
    if (!strategyOpen) return
    const close = (event: MouseEvent) => {
      if (strategyRootRef.current?.contains(event.target as Node)) return
      setStrategyOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStrategyOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [strategyOpen])

  function handleShortcutMenuResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const root = shortcutMenuRef.current
    if (!root) return
    event.preventDefault()
    const startRect = root.getBoundingClientRect()
    const maxWidth = Math.max(shortcutMenuMinWidth, window.innerWidth - startRect.left - 16)

    const applyWidth = (clientX: number) => {
      const next = Math.round(Math.min(maxWidth, Math.max(shortcutMenuMinWidth, clientX - startRect.left)))
      setShortcutMenuWidth(next)
      writeString(shortcutMenuWidthKey, String(next))
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
          <svg aria-hidden="true" className="ff-topbar-calendar-icon" viewBox="0 0 1024 1024">
            <path d="M224.3 251.4h556.2c14.3 0 25.9 11.6 25.9 25.9v501.8c0 14.3-11.6 25.9-25.9 25.9H224.3c-14.3 0-25.9-11.6-25.9-25.9V277.3c0-14.3 11.6-25.9 25.9-25.9z" fill="#FFFFFF" />
            <path d="M780.5 830.8H224.3c-28.5 0-51.7-23.2-51.7-51.7V277.3c0-28.5 23.2-51.7 51.7-51.7h556.2c28.5 0 51.7 23.2 51.7 51.7v501.8c0 28.5-23.2 51.7-51.7 51.7zM224.3 277.3v501.8h556.2V277.3H224.3z" fill="#333333" />
            <path d="M224.3 277h568.5v152.1H224.3z" fill="#FFDB5B" />
            <path d="M198.4 399.5h633.8v51.8H198.4zM495.6 638.8l101-101c11.8-11.8 30.9-11.8 42.7 0l0.1 0.1c11.8 11.8 11.8 30.9 0 42.7L518.7 701.2c-6.3 6.3-14.8 9.3-23.1 8.8-8.3 0.5-16.7-2.5-23.1-8.8l-76-76c-11.8-11.8-11.8-30.9 0-42.7l0.1-0.1c11.8-11.8 30.9-11.8 42.7 0l56.3 56.4z" fill="#333333" />
            <path d="M327.7 166.8c14.3 0 25.9 11.6 25.9 25.9v38.8h-51.7v-38.8c0-14.4 11.6-25.9 25.8-25.9zM664.1 166.8c14.3 0 25.9 11.6 25.9 25.9v38.8h-51.7v-38.8c-0.1-14.4 11.5-25.9 25.8-25.9z" fill="#333333" />
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
          <svg aria-hidden="true" className="ff-topbar-wallet-icon" viewBox="0 0 1024 1024">
            <path d="M225.1 251.9h592.7c14.2 0 25.8 11.5 25.8 25.8V690c0 14.2-11.5 25.8-25.8 25.8H225.1c-14.2 0-25.8-11.5-25.8-25.8V277.6c0-14.2 11.6-25.7 25.8-25.7z" fill="#FFFFFF" />
            <path d="M817.9 741.5H225.1c-28.4 0-51.5-23.1-51.5-51.5V277.6c0-28.4 23.1-51.5 51.5-51.5h592.7c28.4 0 51.5 23.1 51.5 51.5V690c0.1 28.4-23 51.5-51.4 51.5zM225.1 277.6V690h592.7V277.6H225.1z" fill="#2F2F33" />
            <path d="M379.7 544.1c-6 0-12.1-2.1-17-6.4-10.7-9.4-11.7-25.7-2.3-36.4l92.2-104.8c4.8-5.5 11.8-8.7 19.1-8.8 7.2 0.3 14.3 3 19.3 8.3l70.9 77.2L659.2 362c9.4-10.7 25.7-11.8 36.4-2.4s11.8 25.7 2.4 36.4L581.6 528.8c-4.8 5.5-11.8 8.7-19.1 8.8-7.1 0.1-14.3-2.9-19.3-8.3L472.3 452l-73.2 83.3c-5.1 5.8-12.2 8.8-19.4 8.8z" fill="#333333" />
            <path d="M225.1 638.4h592.7v51.5H225.1z" fill="#F4CE26" />
            <path d="M212.2 586.9h631.4v51.5H212.2z" fill="#303033" />
            <path d="M276.7 780.2h476.8c14.2 0 25.8 11.5 25.8 25.8 0 14.2-11.5 25.8-25.8 25.8H276.7c-14.2 0-25.8-11.5-25.8-25.8s11.5-25.8 25.8-25.8z" fill="#2F2F33" />
            <path d="M748.9 831.7H289.1L349.9 690h358.6l40.4 141.7z m-381.6-51.5h313.3l-11-38.7H383.8l-16.5 38.7z" fill="#2F2F33" />
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

      <div className="ff-topbar-strategy" data-open={strategyOpen} ref={strategyRootRef}>
        <button
          aria-expanded={strategyOpen}
          aria-label="Strategy shortcuts"
          className="ff-topbar-icon-btn ff-topbar-backtest-btn"
          onClick={() => setStrategyOpen((current) => strategyShortcuts.length > 0 ? !current : false)}
          type="button"
        >
          <svg aria-hidden="true" className="ff-topbar-backtest-icon" viewBox="0 0 1024 1024">
            <path d="M188.4 273.2h230.8v461.6H188.4V603l57.5-99-57.5-82.5z" fill="#8CAAFF" />
            <path d="M431.5 252.6h383.3v482.2H431.5z" fill="#FFFFFF" />
            <path d="M814.9 767.8h-610c-27.3 0-49.5-22.2-49.5-49.5V590.7c0-14.6 6.4-28.4 17.6-37.8 20.5-17.3 30.8-33.4 30.8-47.9 0-14.6-10.4-30.7-30.8-47.9-11.2-9.4-17.6-23.2-17.6-37.8V273.2c0-27.3 22.2-49.5 49.5-49.5h610c27.3 0 49.5 22.2 49.5 49.5v146.1c0 14.6-6.4 28.4-17.6 37.8-20.4 17.2-30.8 33.4-30.8 47.9s10.4 30.7 30.8 47.9c11.2 9.4 17.6 23.2 17.6 37.8v127.6c-0.1 27.3-22.3 49.5-49.5 49.5z m0-494.6h-610v146.1c32.1 27.1 48.4 55.9 48.4 85.7 0 29.8-16.3 58.6-48.4 85.7v127.6h610V590.7c-32.1-27.1-48.4-55.9-48.4-85.7 0-29.8 16.3-58.6 48.4-85.7V273.2z" fill="#333333" />
            <path d="M571.7 421.6h94.8c13.7 0 24.7 11.1 24.7 24.7 0 13.7-11.1 24.7-24.7 24.7h-94.8c-13.7 0-24.7-11-24.7-24.7 0-13.6 11-24.7 24.7-24.7zM571.7 537h94.8c13.7 0 24.7 11.1 24.7 24.7 0 13.7-11.1 24.7-24.7 24.7h-94.8c-13.7 0-24.7-11.1-24.7-24.7s11-24.7 24.7-24.7zM407.6 248.5l49.6 4.2v469.6l-49.6-4.2z" fill="#333333" />
          </svg>
        </button>
        {strategyOpen && strategyShortcuts.length > 0 && (
          <div className="ff-topbar-strategy__menu">
            {strategyShortcuts.map((item) => (
              <button data-loaded={item.loaded} key={item.key} onClick={() => onStrategyShortcutToggle?.(item.key)} type="button">
                <span className="ff-topbar-strategy__check">{item.loaded ? '✓' : ''}</span>
                <strong>{item.system}</strong>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
