import { useEffect, useRef, useState } from 'react'
import type { DrawingTrendLineStatsData } from '../drawingPersistence'

export const drawingStatsDataOptions = [
  { label: '\u4ef7\u683c\u8303\u56f4', value: 'price-range' },
  { label: '\u6da8\u8dcc\u5e45', value: 'percent-change' },
  { label: '\u70b9\u6570\u53d8\u5316', value: 'point-change' },
  { label: 'K \u7ebf\u6570', value: 'bar-range' },
  { label: '\u65e5\u671f/\u65f6\u95f4\u8303\u56f4', value: 'date-time-range' },
  { label: '\u8ddd\u79bb', value: 'distance' },
  { label: '\u89d2\u5ea6', value: 'angle' },
]

export function TrendStatsDataSelect({
  onChange,
  value,
}: {
  onChange: (value: DrawingTrendLineStatsData[]) => void
  value: DrawingTrendLineStatsData[]
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = new Set(value)
  const selectedLabels = drawingStatsDataOptions
    .filter((option) => selected.has(option.value as DrawingTrendLineStatsData))
    .map((option) => option.label)
  const display = selectedLabels.length > 0 ? selectedLabels.join(', ') : '\u9690\u85cf'

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

  const toggle = (key: DrawingTrendLineStatsData) => {
    const next = selected.has(key)
      ? value.filter((item) => item !== key)
      : [...value, key]
    onChange(next)
  }

  return (
    <div className="ff-openable-select ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-stats-select-v1" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="\u7edf\u8ba1\u6570\u636e"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-drawing-tline-tv-stats-select-v1__value">{display}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{'\u2304'}</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu ff-drawing-tline-tv-stats-select-v1__menu" role="listbox">
          {drawingStatsDataOptions.map((option) => {
            const key = option.value as DrawingTrendLineStatsData
            return (
              <button
                className="ff-drawing-tline-tv-stats-select-v1__option"
                data-active={selected.has(key) ? 'true' : undefined}
                key={option.value}
                onClick={() => toggle(key)}
                role="option"
                type="button"
              >
                <span className="ff-drawing-tline-tv-stats-select-v1__box" data-checked={selected.has(key) ? 'true' : undefined} />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
