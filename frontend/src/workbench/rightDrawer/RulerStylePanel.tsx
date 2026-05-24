import { useEffect, useRef, useState } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineSwatch } from '../settings/SettingsSwatches'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import type { DrawingRulerStatsData, DrawingRulerStyle } from './rulerDrawingStyle'
import { normalizeDrawingRulerStyle } from './rulerDrawingStyle'

const rulerStatsDataOptions: Array<{ label: string; value: DrawingRulerStatsData }> = [
  { label: '价格范围', value: 'price-range' },
  { label: '百分比变化', value: 'percent-change' },
  { label: '点数变化', value: 'point-change' },
  { label: 'K线范围', value: 'bars-range' },
  { label: '日期/时间范围', value: 'date-time-range' },
  { label: '成交量', value: 'volume' },
]

const rulerLabelFontSizeOptions = [
  { label: '8', value: '8' },
  { label: '10', value: '10' },
  { label: '12', value: '12' },
  { label: '14', value: '14' },
  { label: '16', value: '16' },
  { label: '18', value: '18' },
  { label: '20', value: '20' },
  { label: '24', value: '24' },
]

export function RulerStylePanel({
  lineStyle,
  onLineStyleChange,
  onPriceLabelChange,
  onQuickMeasureChange,
  onRulerStyleChange,
  priceLabelVisible,
  quickMeasureEnabled,
  rulerStyle,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  onQuickMeasureChange: (enabled: boolean) => void
  onRulerStyleChange: (value: DrawingRulerStyle) => void
  priceLabelVisible: boolean
  quickMeasureEnabled: boolean
  rulerStyle: DrawingRulerStyle
}) {
  const settings = normalizeDrawingRulerStyle(rulerStyle)
  const update = (patch: Partial<DrawingRulerStyle>) => {
    onRulerStyleChange(normalizeDrawingRulerStyle({ ...settings, ...patch }))
  }

  return (
    <div className="ff-drawing-tline-tv-style-v1 ff-drawing-ruler-style-v1">
      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">线形图</span>
        <div className="ff-drawing-tline-tv-line-control-v1">
          <SettingsLineSwatch
            color={lineStyle.hex}
            lineStyle={lineStyle.lineStyle}
            onChange={onLineStyleChange}
            thickness={lineStyle.thickness}
            value={lineStyle}
          />
        </div>
      </div>

      <div className="ff-drawing-ruler-check-row-v1">
        <div className="ff-drawing-ruler-check-label-v1">
          <Checkbox checked={settings.borderVisible} onChange={(checked) => update({ borderVisible: checked })} />
          <span className="ff-drawing-tline-tv-label-v1">边框</span>
        </div>
        <div className="ff-drawing-ruler-control-v1">
          <div className="ff-drawing-ruler-swatch-wrap-v1" data-disabled={settings.borderVisible ? undefined : 'true'}>
            <SettingsLineSwatch
              color={settings.borderLineStyle.hex}
              lineStyle={settings.borderLineStyle.lineStyle}
              onChange={(value) => update({ borderLineStyle: value })}
              thickness={settings.borderLineStyle.thickness}
              value={settings.borderLineStyle}
            />
          </div>
        </div>
      </div>

      <div className="ff-drawing-ruler-check-row-v1">
        <div className="ff-drawing-ruler-check-label-v1">
          <Checkbox checked={settings.backgroundVisible} onChange={(checked) => update({ backgroundVisible: checked })} />
          <span className="ff-drawing-tline-tv-label-v1">背景</span>
        </div>
        <div className="ff-drawing-ruler-control-v1">
          <div className="ff-drawing-ruler-swatch-wrap-v1" data-disabled={settings.backgroundVisible ? undefined : 'true'}>
            <SettingsColorSwatch
              checkerboard
              color={settings.background.hex}
              onChange={(value) => update({ background: value })}
              value={settings.background}
            />
          </div>
        </div>
      </div>

      <h3 className="ff-drawing-tline-tv-subhead-v1">信息</h3>

      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">统计数据</span>
        <RulerStatsDataSelect onChange={(value) => update({ statsData: value })} value={settings.statsData} />
      </div>

      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">标签</span>
        <div className="ff-drawing-ruler-label-control-v1">
          <SettingsColorSwatch
            color={settings.labelColor.hex}
            onChange={(value) => update({ labelColor: value })}
            value={settings.labelColor}
          />
          <OpenableSelect
            ariaLabel="标签字号"
            className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-ruler-font-size-v1"
            onChange={(value) => update({ labelFontSize: Number(value) })}
            options={rulerLabelFontSizeOptions}
            value={String(settings.labelFontSize)}
          />
        </div>
      </div>

      <div className="ff-drawing-ruler-check-row-v1">
        <div className="ff-drawing-ruler-check-label-v1">
          <Checkbox checked={settings.labelBackgroundVisible} onChange={(checked) => update({ labelBackgroundVisible: checked })} />
          <span className="ff-drawing-tline-tv-label-v1">标签背景</span>
        </div>
        <div className="ff-drawing-ruler-control-v1">
          <div className="ff-drawing-ruler-swatch-wrap-v1" data-disabled={settings.labelBackgroundVisible ? undefined : 'true'}>
            <SettingsColorSwatch
              checkerboard
              color={settings.labelBackground.hex}
              onChange={(value) => update({ labelBackground: value })}
              value={settings.labelBackground}
            />
          </div>
        </div>
      </div>

      <div className="ff-drawing-ruler-single-check-row-v1">
        <Checkbox checked={priceLabelVisible} onChange={onPriceLabelChange} />
        <span className="ff-drawing-tline-tv-label-v1">价格标签</span>
      </div>

      <div className="ff-drawing-ruler-single-check-row-v1">
        <Checkbox checked={settings.statsAlwaysVisible} onChange={(checked) => update({ statsAlwaysVisible: checked })} />
        <span className="ff-drawing-tline-tv-label-v1">始终显示统计信息</span>
      </div>

      <div className="ff-drawing-ruler-single-check-row-v1">
        <Checkbox checked={quickMeasureEnabled} onChange={onQuickMeasureChange} />
        <span className="ff-drawing-tline-tv-label-v1">测量</span>
        <span className="ff-drawing-ruler-shortcut-hint-v1">按住 Shift + 点击图表</span>
      </div>
    </div>
  )
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="ff-drawing-tline-tv-check-row-v1">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="ff-drawing-tline-tv-check-box-v1" />
    </label>
  )
}

function RulerStatsDataSelect({
  onChange,
  value,
}: {
  onChange: (value: DrawingRulerStatsData[]) => void
  value: DrawingRulerStatsData[]
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = new Set(value)
  const selectedLabels = rulerStatsDataOptions
    .filter((option) => selected.has(option.value))
    .map((option) => option.label)
  const display = selectedLabels.length > 0 ? selectedLabels.join(', ') : '隐藏'

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

  const toggle = (key: DrawingRulerStatsData) => {
    const next = selected.has(key)
      ? value.filter((item) => item !== key)
      : [...value, key]
    onChange(next)
  }

  return (
    <div className="ff-openable-select ff-drawing-tline-tv-openable-select-v1 ff-drawing-ruler-stats-select-v1" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="统计数据"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-drawing-ruler-stats-select-v1__value">{display}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{'\u2304'}</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu ff-drawing-ruler-stats-select-v1__menu" role="listbox">
          {rulerStatsDataOptions.map((option) => (
            <button
              className="ff-drawing-ruler-stats-select-v1__option"
              data-active={selected.has(option.value) ? 'true' : undefined}
              key={option.value}
              onClick={() => toggle(option.value)}
              role="option"
              type="button"
            >
              <span className="ff-drawing-ruler-stats-select-v1__box" data-checked={selected.has(option.value) ? 'true' : undefined} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
