import { SymbolSelect } from '../../../controls/SymbolSelect'
import type { SymbolSelectSize } from '../../../controls/SymbolSelect'
import { SettingsColorSwatch } from '../../../settings/SettingsSwatches'
import { mmfHighSymbolOptions } from '../../stickerSymbols'
import { CheckControl, NumberBox } from './indicatorPanelShared'

function resolveMmfSymbolSize(symbol: string): SymbolSelectSize {
  if (['\u25b2', '\u25b3', '\u25bc', '\u25bd'].includes(symbol)) return 'triangle'
  if (['\u25c6', '\u25c7'].includes(symbol)) return 'diamond'
  if (['\u25cf', '\u25cb'].includes(symbol)) return 'circle'
  if (['\u2605', '\u2606'].includes(symbol)) return 'star'
  if (['\u21d1', '\u21d3'].includes(symbol)) return 'small'
  return 'small'
}

export function MmfToggleBlock({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="ff-indicators-mmf-panel-v1__signal-block">
      <div className="ff-indicators-mmf-panel-v1__high-row">
        <CheckControl checked={checked} label={label} onChange={onChange} />
      </div>
    </div>
  )
}

export function MmfVdoLimitRow({
  lower,
  onLowerChange,
  onUpperChange,
  upper,
}: {
  lower: number
  onLowerChange: (value: number) => void
  onUpperChange: (value: number) => void
  upper: number
}) {
  return (
    <div className="ff-indicators-mmf-panel-v1__vdo-grid">
      <span className="ff-indicators-mmf-panel-v1__label">VDO</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-limit-label">{'\u4e0a\u9650'}</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-input">
        <NumberBox
          formatValue={(value) => value.toFixed(3)}
          max={500}
          min={-500}
          onChange={onUpperChange}
          parseValue={(value) => Number(value)}
          step={0.001}
          value={upper}
        />
      </span>
      <span className="ff-indicators-mmf-panel-v1__vdo-limit-label">{'\u4e0b\u9650'}</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-input">
        <NumberBox
          formatValue={(value) => value.toFixed(3)}
          max={500}
          min={-500}
          onChange={onLowerChange}
          parseValue={(value) => Number(value)}
          step={0.001}
          value={lower}
        />
      </span>
    </div>
  )
}

export function MmfVdoThresholdRow({
  onThresholdChange,
  threshold,
}: {
  onThresholdChange: (value: number) => void
  threshold: number
}) {
  return (
    <div className="ff-indicators-mmf-panel-v1__vdo-threshold-grid">
      <span className="ff-indicators-mmf-panel-v1__label">VDO</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-limit-label">{'\u9608\u503c'}</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-input">
        <NumberBox
          formatValue={(value) => value.toFixed(3)}
          max={500}
          min={-500}
          onChange={onThresholdChange}
          parseValue={(value) => Number(value)}
          step={0.001}
          value={threshold}
        />
      </span>
    </div>
  )
}

export function MmfMorganOnlyRow({
  max,
  min,
  onChange,
  onVdoThresholdChange,
  value,
  vdoThreshold,
}: {
  max: number
  min: number
  onChange: (value: number) => void
  onVdoThresholdChange: (value: number) => void
  value: number
  vdoThreshold: number
}) {
  return (
    <div className="ff-indicators-mmf-panel-v1__morgan-only-grid">
      <span className="ff-indicators-mmf-panel-v1__label">{'\u533a\u95f4\u6bd4\u4f8b'}</span>
      <span className="ff-indicators-mmf-panel-v1__morgan-input">
        <NumberBox
          formatValue={(numberValue) => numberValue.toFixed(3)}
          max={max}
          min={min}
          onChange={onChange}
          parseValue={(inputValue) => Number(inputValue)}
          step={0.001}
          value={Number(value)}
        />
      </span>
      <span className="ff-indicators-mmf-panel-v1__label">VDO</span>
      <span className="ff-indicators-mmf-panel-v1__vdo-input">
        <NumberBox
          formatValue={(numberValue) => numberValue.toFixed(3)}
          max={500}
          min={-500}
          onChange={onVdoThresholdChange}
          parseValue={(inputValue) => Number(inputValue)}
          step={0.001}
          value={Number(vdoThreshold)}
        />
      </span>
    </div>
  )
}

export function MmfSignalInputBlock({
  checked,
  dpoValue,
  dpoMax,
  dpoMin,
  label,
  morganMax,
  morganMin,
  morganRatio,
  onCheckedChange,
  onDpoChange,
  onMorganRatioChange,
}: {
  checked: boolean
  dpoMax: number
  dpoMin: number
  dpoValue: number
  label: string
  morganMax: number
  morganMin: number
  morganRatio: number
  onCheckedChange: (checked: boolean) => void
  onDpoChange: (value: number) => void
  onMorganRatioChange: (value: number) => void
}) {
  return (
    <div className="ff-indicators-mmf-panel-v1__signal-block">
      <div className="ff-indicators-mmf-panel-v1__high-row">
        <CheckControl checked={checked} label={label} onChange={onCheckedChange} />
      </div>
      <div className="ff-indicators-mmf-panel-v1__settings-grid">
        <span className="ff-indicators-mmf-panel-v1__label">{'\u6469\u6839\u533a\u95f4'}</span>
        <span className="ff-indicators-mmf-panel-v1__morgan-input">
          <NumberBox
            formatValue={(value) => value.toFixed(3)}
            max={morganMax}
            min={morganMin}
            onChange={onMorganRatioChange}
            parseValue={(value) => Number(value)}
            step={0.001}
            value={Number(morganRatio)}
          />
        </span>
        <span className="ff-indicators-mmf-panel-v1__label">DPO</span>
        <span className="ff-indicators-mmf-panel-v1__dpo-input">
          <NumberBox max={dpoMax} min={dpoMin} onChange={onDpoChange} value={dpoValue} />
        </span>
      </div>
    </div>
  )
}

export function MmfMarkerStyleRow({
  color,
  label,
  onColorChange,
  onSizeChange,
  onSymbolChange,
  size,
  symbol,
}: {
  color: string
  label: string
  onColorChange: (color: string) => void
  onSizeChange: (size: number) => void
  onSymbolChange: (symbol: string) => void
  size: number
  symbol: string
}) {
  return (
    <div className="ff-indicators-mmf-style-panel-v1__row">
      <span className="ff-indicators-mmf-style-panel-v1__label">{label}</span>
      <span className="ff-indicators-mmf-style-panel-v1__symbol-select">
        <SymbolSelect
          ariaLabel={`MMF ${label} symbol`}
          onChange={onSymbolChange}
          options={mmfHighSymbolOptions}
          resolveSize={resolveMmfSymbolSize}
          value={symbol}
          width={60}
        />
      </span>
      <span className="ff-indicators-mmf-style-panel-v1__size-input">
        <NumberBox max={96} min={8} onChange={onSizeChange} value={size} />
      </span>
      <SettingsColorSwatch
        color={color}
        onChange={(value) => onColorChange(value.hex)}
        value={{ hex: color, opacity: 1 }}
      />
    </div>
  )
}
