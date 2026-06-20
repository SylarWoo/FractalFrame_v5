import { useEffect, useRef, useState } from 'react'
import type { DrawingTrendLineStyle } from '../drawingPersistence'

export function TrendExtendModeSelect({
  onChange,
  value,
}: {
  onChange: (value: DrawingTrendLineStyle['extendMode']) => void
  value: DrawingTrendLineStyle['extendMode']
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const leftChecked = value === 'left' || value === 'both'
  const rightChecked = value === 'right' || value === 'both'
  const display = leftChecked && rightChecked
    ? '\u53cc\u5411'
    : leftChecked
      ? '\u5411\u5de6'
      : rightChecked
        ? '\u5411\u53f3'
        : '\u4e0d\u8981\u6269\u5927'

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

  const commit = (nextLeft: boolean, nextRight: boolean) => {
    onChange(nextLeft && nextRight ? 'both' : nextLeft ? 'left' : nextRight ? 'right' : 'none')
  }

  return (
    <div className="ff-openable-select ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-check-select-v1" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="\u5ef6\u4f38"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-drawing-tline-tv-check-select-v1__value">{display}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{'\u2304'}</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu ff-drawing-tline-tv-check-select-v1__menu" role="listbox">
          <button
            className="ff-drawing-tline-tv-check-select-v1__option"
            data-active={leftChecked ? 'true' : undefined}
            onClick={() => commit(!leftChecked, rightChecked)}
            role="option"
            type="button"
          >
            <span className="ff-drawing-tline-tv-check-select-v1__box" data-checked={leftChecked ? 'true' : undefined} />
            <span>{'\u5411\u5de6\u6269\u5927'}</span>
          </button>
          <button
            className="ff-drawing-tline-tv-check-select-v1__option"
            data-active={rightChecked ? 'true' : undefined}
            onClick={() => commit(leftChecked, !rightChecked)}
            role="option"
            type="button"
          >
            <span className="ff-drawing-tline-tv-check-select-v1__box" data-checked={rightChecked ? 'true' : undefined} />
            <span>{'\u5411\u53f3\u6269\u5927'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
