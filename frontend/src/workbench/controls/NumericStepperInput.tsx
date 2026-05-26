import { useEffect, useRef, useState } from 'react'
import './NumericStepperInput.css'

export type NumericStepperInputProps = {
  ariaLabel?: string
  className?: string
  formatValue?: (value: number) => string
  id?: string
  inputClassName?: string
  max?: number
  min?: number
  onChange: (value: number) => void
  parseValue?: (value: string) => number
  step?: number
  suffix?: string
  value?: number
}

export function NumericStepperInput({
  ariaLabel,
  className = '',
  formatValue = (value) => String(value),
  id,
  inputClassName = '',
  max = Number.POSITIVE_INFINITY,
  min = Number.NEGATIVE_INFINITY,
  onChange,
  parseValue = (value) => Number(value.trim().replace(/,/g, '')),
  step = 1,
  suffix,
  value,
}: NumericStepperInputProps) {
  const [text, setText] = useState(formatCurrentValue(value, formatValue))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (focusedRef.current) return
    setText(formatCurrentValue(value, formatValue))
  }, [formatValue, value])

  const clamp = (nextValue: number) => Math.max(min, Math.min(max, nextValue))

  const commitText = (nextText: string, options: { keepEditing?: boolean } = {}) => {
    const nextValue = parseValue(nextText)
    if (!Number.isFinite(nextValue)) {
      if (!options.keepEditing) setText(formatCurrentValue(value, formatValue))
      return
    }
    const clampedValue = clamp(nextValue)
    onChange(clampedValue)
    if (!options.keepEditing) setText(formatValue(clampedValue))
  }

  const stepValue = (direction: 1 | -1) => {
    const parsedText = parseValue(text)
    const baseValue = Number.isFinite(parsedText)
      ? parsedText
      : Number.isFinite(value)
        ? value as number
        : 0
    const nextValue = clamp(baseValue + step * direction)
    onChange(nextValue)
    setText(formatValue(nextValue))
  }

  return (
    <span className={`ff-numeric-stepper-v1 ${suffix ? 'ff-numeric-stepper-v1--suffix' : ''} ${className}`.trim()}>
      <input
        aria-label={ariaLabel}
        autoComplete="off"
        className={`ff-numeric-stepper-v1__input ${inputClassName}`.trim()}
        id={id}
        inputMode="decimal"
        onBlur={() => {
          focusedRef.current = false
          commitText(text)
        }}
        onChange={(event) => {
          const nextText = event.target.value
          setText(nextText)
          commitText(nextText, { keepEditing: true })
        }}
        onFocus={() => {
          focusedRef.current = true
          setText(formatCurrentValue(value, formatValue))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            focusedRef.current = false
            commitText(text)
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            stepValue(1)
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            stepValue(-1)
          }
        }}
        step={step}
        type="number"
        value={text}
      />
      {suffix ? <span className="ff-numeric-stepper-v1__suffix">{suffix}</span> : null}
    </span>
  )
}

function formatCurrentValue(value: number | undefined, formatValue: (value: number) => string) {
  return Number.isFinite(value) ? formatValue(value as number) : ''
}
