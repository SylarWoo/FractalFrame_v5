import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './SymbolSelect.css'

export type SymbolSelectSize = 'circle' | 'compact' | 'diamond' | 'small' | 'star' | 'triangle' | 'default'

export function SymbolSelect({
  ariaLabel = 'Symbol',
  className = '',
  onChange,
  resolveSize = () => 'default',
  options,
  value,
  width = 80,
}: {
  ariaLabel?: string
  className?: string
  onChange: (value: string) => void
  options: readonly string[]
  resolveSize?: (symbol: string) => SymbolSelectSize
  value: string
  width?: number
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = options.includes(value) ? value : options[0] ?? ''
  const style = { '--ff-symbol-select-width': `${width}px` } as CSSProperties

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
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
  }, [open])

  return (
    <div className={`ff-symbol-select-v1 ${className}`.trim()} data-open={open} ref={rootRef} style={style}>
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="ff-symbol-select-v1__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-symbol-select-v1__glyph" data-size={resolveSize(selected)}>{selected}</span>
        <span aria-hidden="true" className="ff-symbol-select-v1__chevron">{'\u25be'}</span>
      </button>
      {open ? (
        <div className="ff-symbol-select-v1__menu" role="listbox">
          {options.map((symbol) => (
            <button
              aria-selected={symbol === selected}
              className="ff-symbol-select-v1__option"
              data-active={symbol === selected}
              key={symbol}
              onClick={() => {
                onChange(symbol)
                setOpen(false)
              }}
              role="option"
              type="button"
            >
              <span className="ff-symbol-select-v1__glyph" data-size={resolveSize(symbol)}>{symbol}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
