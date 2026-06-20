import { useEffect, useRef, useState } from 'react'
import {
  drawingCrossPeriodTargets,
  normalizeDrawingCrossPeriodTargets,
  type DrawingCrossPeriodTarget,
} from '../../drawing/drawingCrossPeriodModel'

const drawingCrossPeriodTargetOptions = drawingCrossPeriodTargets.map((target) => ({
  label: target,
  value: target,
}))

export function CrossPeriodTargetSelect({
  onChange,
  value,
}: {
  onChange: (value: DrawingCrossPeriodTarget[]) => void
  value: DrawingCrossPeriodTarget[]
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = new Set(normalizeDrawingCrossPeriodTargets(value))
  const selectedLabels = drawingCrossPeriodTargetOptions
    .filter((option) => selected.has(option.value))
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

  const toggle = (key: DrawingCrossPeriodTarget) => {
    const current = normalizeDrawingCrossPeriodTargets(value)
    const next = selected.has(key)
      ? current.filter((item) => item !== key)
      : drawingCrossPeriodTargets.filter((item) => item === key || selected.has(item))
    onChange(next)
  }

  return (
    <div className="ff-openable-select ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-check-select-v1" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="\u5468\u671f"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-drawing-tline-tv-check-select-v1__value">{display}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{'\u2304'}</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu ff-drawing-tline-tv-check-select-v1__menu" role="listbox">
          {drawingCrossPeriodTargetOptions.map((option) => (
            <button
              className="ff-drawing-tline-tv-check-select-v1__option"
              data-active={selected.has(option.value) ? 'true' : undefined}
              key={option.value}
              onClick={() => toggle(option.value)}
              role="option"
              type="button"
            >
              <span className="ff-drawing-tline-tv-check-select-v1__box" data-checked={selected.has(option.value) ? 'true' : undefined} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
