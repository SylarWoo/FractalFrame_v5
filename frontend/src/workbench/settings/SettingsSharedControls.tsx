import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  readSettingsBooleanValue,
  readSettingsStringValue,
  readSettingsSymbolState,
  writeSettingsSymbolStateValue,
} from '../settingsSymbolState'
import './SettingsSharedControls.css'

export function SettingsCheckRow({
  checked = false,
  children,
  inset = false,
  onCheckedChange,
  storageKey,
}: {
  checked?: boolean
  children: ReactNode
  inset?: boolean
  onCheckedChange?: (checked: boolean) => void
  storageKey?: string
}) {
  const [isChecked, setIsChecked] = useState(() => {
    if (!storageKey) return checked
    return readSettingsBooleanValue(storageKey, checked)
  })

  return (
    <div className="ff-settings-status-row" data-inset={inset}>
      <input
        checked={isChecked}
        onChange={(event) => {
          const next = event.currentTarget.checked
          setIsChecked(next)
          if (storageKey) writeSettingsSymbolStateValue(storageKey, next)
          onCheckedChange?.(next)
        }}
        type="checkbox"
      />
      <span>{children}</span>
    </div>
  )
}

export function SettingsCheckboxInput({
  checked = false,
  onCheckedChange,
  storageKey,
}: {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  storageKey: string
}) {
  const [isChecked, setIsChecked] = useState(() => readSettingsBooleanValue(storageKey, checked))

  return (
    <input
      checked={isChecked}
      onChange={(event) => {
        const next = event.currentTarget.checked
        setIsChecked(next)
        writeSettingsSymbolStateValue(storageKey, next)
        onCheckedChange?.(next)
      }}
      type="checkbox"
    />
  )
}

export function SettingsMultiCheckSelect({
  ariaLabel,
  defaultValue,
  storageKey,
  options,
}: {
  ariaLabel: string
  defaultValue: string[]
  storageKey?: string
  options: Array<{ label: string; value: string }>
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => {
    const saved = storageKey ? readSettingsSymbolState()[storageKey] : null
    return new Set(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : defaultValue)
  })

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

  const label = options
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
    .join('，') || '隐藏'

  return (
    <div className="ff-settings-multicheck-select" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{open ? '⌃' : '⌄'}</span>
      </button>
      {open && (
        <div className="ff-settings-multicheck-select__menu" role="menu">
          {options.map((option) => {
            const active = selected.has(option.value)
            return (
              <button
                className="ff-settings-multicheck-select__option"
                key={option.value}
                onClick={() => {
                  setSelected((current) => {
                    const next = new Set(current)
                    if (next.has(option.value)) next.delete(option.value)
                    else next.add(option.value)
                    if (storageKey) writeSettingsSymbolStateValue(storageKey, [...next])
                    return next
                  })
                }}
                role="menuitemcheckbox"
                aria-checked={active}
                type="button"
              >
                <span className="ff-settings-multicheck-select__box" data-active={active}>
                  {active ? '✓' : ''}
                </span>
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SettingsTextInput({
  ariaLabel,
  defaultValue,
  storageKey,
}: {
  ariaLabel: string
  defaultValue: string
  storageKey: string
}) {
  const [value, setValue] = useState(() => readSettingsStringValue(storageKey, defaultValue))

  return (
    <input
      aria-label={ariaLabel}
      onChange={(event) => {
        const next = event.currentTarget.value
        setValue(next)
        writeSettingsSymbolStateValue(storageKey, next)
      }}
      value={value}
    />
  )
}
