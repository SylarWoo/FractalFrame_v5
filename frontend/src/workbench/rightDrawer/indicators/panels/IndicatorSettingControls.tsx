import type { ReactNode } from 'react'
import { OpenableSelect } from '../../../controls/OpenableSelect'
import type { OpenableSelectOption } from '../../../controls/OpenableSelect'
import { NumericStepperInput } from '../../../controls/NumericStepperInput'
import { SettingsColorSwatch, SettingsLineSwatch } from '../../../settings/SettingsSwatches'
import type { SettingsLineSwatchValue, SettingsSwatchValue } from '../../../settings/SettingsSwatches'

export function InfoBadge({ title }: { title: string }) {
  return <span className="ff-indicators-input-panel-v1__info" title={title}>i</span>
}

export function CheckControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <span className="ff-indicators-style-row-v1__check">
      <input aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <button onClick={() => onChange(!checked)} type="button">{label}</button>
    </span>
  )
}

export function NumberBox({
  className,
  formatValue,
  max = 500,
  min = 0,
  onChange,
  parseValue,
  step = 1,
  value,
}: {
  className?: string
  formatValue?: (value: number) => string
  max?: number
  min?: number
  onChange: (value: number) => void
  parseValue?: (value: string) => number
  step?: number
  value: number
}) {
  return (
    <NumericStepperInput
      className={className}
      formatValue={formatValue}
      inputClassName="ff-indicators-number-box-v1"
      max={max}
      min={min}
      onChange={onChange}
      parseValue={parseValue}
      step={step}
      value={value}
    />
  )
}

export function IndicatorSection({
  children,
  className,
  title,
}: {
  children: ReactNode
  className?: string
  title?: ReactNode
}) {
  return (
    <section className={`ff-indicators-input-panel-v1__section ${className ?? ''}`.trim()}>
      {title ? <h3 className="ff-indicators-input-panel-v1__section-title">{title}</h3> : null}
      {children}
    </section>
  )
}

export function IndicatorNumberRow({
  className,
  controlClassName,
  formatValue,
  label,
  max,
  min,
  onChange,
  parseValue,
  step,
  value,
}: {
  className?: string
  controlClassName?: string
  formatValue?: (value: number) => string
  label: ReactNode
  max?: number
  min?: number
  onChange: (value: number) => void
  parseValue?: (value: string) => number
  step?: number
  value: number
}) {
  return (
    <label className={`ff-indicators-input-panel-v1__row ${className ?? ''}`.trim()}>
      <span className="ff-indicators-input-panel-v1__label">{label}</span>
      <span className={`ff-indicators-input-panel-v1__control ${controlClassName ?? ''}`.trim()}>
        <NumberBox
          formatValue={formatValue}
          max={max}
          min={min}
          onChange={onChange}
          parseValue={parseValue}
          step={step}
          value={value}
        />
      </span>
    </label>
  )
}

export function IndicatorCheckboxRow({
  checked,
  className,
  controlClassName,
  info,
  label,
  onChange,
  variant = 'input',
}: {
  checked: boolean
  className?: string
  controlClassName?: string
  info?: ReactNode
  label: ReactNode
  onChange: (checked: boolean) => void
  variant?: 'input' | 'compact'
}) {
  if (variant === 'compact') {
    return (
      <label className={`ff-indicators-vwap-panel-v1__check-row ${className ?? ''}`.trim()}>
        <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
        <span>{label}</span>
        {info}
      </label>
    )
  }

  return (
    <label className={`ff-indicators-input-panel-v1__row ${className ?? ''}`.trim()}>
      <span className="ff-indicators-input-panel-v1__label">{label}</span>
      <span className={`ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--check ${controlClassName ?? ''}`.trim()}>
        <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      </span>
    </label>
  )
}

export function IndicatorSelectRow({
  ariaLabel,
  className,
  controlClassName,
  label,
  onChange,
  options,
  value,
}: {
  ariaLabel?: string
  className?: string
  controlClassName?: string
  label: ReactNode
  onChange: (value: string) => void
  options: OpenableSelectOption[]
  value: string
}) {
  return (
    <label className={`ff-indicators-input-panel-v1__row ${className ?? ''}`.trim()}>
      <span className="ff-indicators-input-panel-v1__label">{label}</span>
      <span className={`ff-indicators-input-panel-v1__control ${controlClassName ?? ''}`.trim()}>
        <OpenableSelect ariaLabel={ariaLabel} onChange={onChange} options={options} value={value} />
      </span>
    </label>
  )
}

export function IndicatorStyleRow({
  checked,
  children,
  className,
  label,
  onCheckedChange,
}: {
  checked: boolean
  children: ReactNode
  className?: string
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className={`ff-indicators-style-row-v1 ${className ?? ''}`.trim()}>
      <CheckControl checked={checked} label={label} onChange={onCheckedChange} />
      {children}
    </div>
  )
}

export function IndicatorLineStyleRow({
  checked,
  className,
  label,
  onCheckedChange,
  onLineChange,
  value,
}: {
  checked: boolean
  className?: string
  label: string
  onCheckedChange: (checked: boolean) => void
  onLineChange: (value: SettingsLineSwatchValue) => void
  value: SettingsLineSwatchValue
}) {
  return (
    <IndicatorStyleRow checked={checked} className={className} label={label} onCheckedChange={onCheckedChange}>
      <SettingsLineSwatch
        color={value.hex}
        lineStyle={value.lineStyle}
        onChange={onLineChange}
        thickness={value.thickness}
        value={value}
      />
    </IndicatorStyleRow>
  )
}

export function IndicatorColorStyleRow({
  checked,
  checkerboard,
  className,
  color,
  label,
  onCheckedChange,
  onColorChange,
  value,
}: {
  checked: boolean
  checkerboard?: boolean
  className?: string
  color?: string
  label: string
  onCheckedChange: (checked: boolean) => void
  onColorChange: (value: SettingsSwatchValue) => void
  value: SettingsSwatchValue
}) {
  return (
    <IndicatorStyleRow checked={checked} className={className} label={label} onCheckedChange={onCheckedChange}>
      <SettingsColorSwatch checkerboard={checkerboard} color={color} onChange={onColorChange} value={value} />
    </IndicatorStyleRow>
  )
}

export function IndicatorLineValueStyleRow({
  checked,
  className,
  label,
  max,
  min,
  onCheckedChange,
  onLineChange,
  onValueChange,
  step,
  value,
  numericValue,
}: {
  checked: boolean
  className?: string
  label: string
  max?: number
  min?: number
  onCheckedChange: (checked: boolean) => void
  onLineChange: (value: SettingsLineSwatchValue) => void
  onValueChange: (value: number) => void
  step?: number
  value: SettingsLineSwatchValue
  numericValue: number
}) {
  return (
    <IndicatorStyleRow checked={checked} className={className} label={label} onCheckedChange={onCheckedChange}>
      <span className="ff-indicators-style-row-v1__controls">
        <SettingsLineSwatch
          color={value.hex}
          lineStyle={value.lineStyle}
          onChange={onLineChange}
          thickness={value.thickness}
          value={value}
        />
        <NumberBox max={max} min={min} onChange={onValueChange} step={step} value={numericValue} />
      </span>
    </IndicatorStyleRow>
  )
}
