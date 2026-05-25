import { useEffect, useRef, useState } from 'react'
import { readSettingsStringValue, writeSettingsSymbolStateValue } from '../settingsSymbolState'
import './OpenableSelect.css'

export type OpenableSelectOption = {
  label: string
  value: string
}

type OpenableSelectProps = {
  ariaLabel?: string
  className?: string
  defaultValue?: string
  onChange?: (value: string) => void
  options: OpenableSelectOption[]
  storageKey?: string
  value?: string
}

export function OpenableSelect({ ariaLabel, className = '', defaultValue, onChange, options, storageKey, value: controlledValue }: OpenableSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fallback = options[0]?.value ?? ''
  const [internalValue, setInternalValue] = useState(() => (
    storageKey ? readSettingsStringValue(storageKey, defaultValue ?? fallback) : defaultValue ?? fallback
  ))
  const [open, setOpen] = useState(false)
  const value = controlledValue ?? internalValue
  const selected = options.find((option) => option.value === value) ?? options[0] ?? { label: '', value: '' }

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
    <div className={`ff-openable-select ${className}`.trim()} data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{selected.label}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">⌄</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu" role="listbox">
          {options.map((option) => (
            <button
              className="ff-openable-select__option"
              data-active={option.value === value}
              key={option.value}
              onClick={() => {
                if (controlledValue == null) setInternalValue(option.value)
                if (storageKey) writeSettingsSymbolStateValue(storageKey, option.value)
                onChange?.(option.value)
                setOpen(false)
              }}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
