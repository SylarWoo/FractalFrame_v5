import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useShortcutMenuState } from './useShortcutMenuState'
import type { OpenChartOptions } from './useShortcutMenuState'
import './TopBar.css'

type TopBarProps = {
  onOpenChart?: (options: OpenChartOptions) => void
}

const shortcutMenuWidthKey = 'fractalframe:topbarShortcutMenuWidthPx:v1'
const shortcutMenuDefaultWidth = 490
const shortcutMenuMinWidth = 116

function readShortcutMenuWidth() {
  const raw = window.localStorage.getItem(shortcutMenuWidthKey)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= shortcutMenuMinWidth ? parsed : shortcutMenuDefaultWidth
}

export function TopBar({ onOpenChart }: TopBarProps) {
  const symbolRootRef = useRef<HTMLDivElement | null>(null)
  const shortcutMenuRef = useRef<HTMLDivElement | null>(null)
  const [shortcutMenuWidth, setShortcutMenuWidth] = useState(readShortcutMenuWidth)
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

      <button aria-label="Calendar" className="ff-topbar-icon-btn" type="button">
        <svg aria-hidden="true" viewBox="0 0 48 48">
          <polyline points="20.287 37 29.963 19 18.037 19" />
          <circle cx="32.5" cy="11" r="2.5" />
          <circle cx="15.5" cy="11" r="2.5" />
          <path d="M7.5,5.5a2,2,0,0,0-2,2v33a2,2,0,0,0,2,2h33a2,2,0,0,0,2-2V7.5a2,2,0,0,0-2-2Z" />
        </svg>
      </button>
    </header>
  )
}
