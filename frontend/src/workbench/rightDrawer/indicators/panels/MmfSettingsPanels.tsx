import { SymbolSelect } from '../../../controls/SymbolSelect'
import type { SymbolSelectSize } from '../../../controls/SymbolSelect'
import { SettingsColorSwatch } from '../../../settings/SettingsSwatches'
import { mmfHighSymbolOptions } from '../../stickerSymbols'
import type { MmfIndicatorSettings } from '../../indicatorPersistence'
import { CheckControl, NumberBox, updateMmfSettings } from './indicatorPanelShared'

function resolveMmfSymbolSize(symbol: string): SymbolSelectSize {
  if (['\u25b2', '\u25b3', '\u25bc', '\u25bd'].includes(symbol)) return 'triangle'
  if (['\u25c6', '\u25c7'].includes(symbol)) return 'diamond'
  if (['\u25cf', '\u25cb'].includes(symbol)) return 'circle'
  return 'small'
}

export function MmfInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
}) {
  const patch = (next: Partial<MmfIndicatorSettings>) => onSettingsChange(updateMmfSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mmf-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section ff-indicators-mmf-panel-v1__scroll-section">
        <MmfSignalInputBlock
          checked={settings.showHigh}
          dpoMax={40}
          dpoMin={0}
          dpoValue={settings.dpoValue}
          label={'\u9ad8\u70b9'}
          morganMax={0.236}
          morganMin={0.118}
          morganRatio={settings.highMorganRatio}
          onCheckedChange={(showHigh) => patch({ showHigh })}
          onDpoChange={(dpoValue) => patch({ dpoValue })}
          onMorganRatioChange={(highMorganRatio) => patch({ highMorganRatio })}
        />
        <MmfSignalInputBlock
          checked={settings.showLow}
          dpoMax={0}
          dpoMin={-40}
          dpoValue={settings.lowDpoValue}
          label={'\u4f4e\u70b9'}
          morganMax={-0.118}
          morganMin={-0.236}
          morganRatio={settings.lowMorganRatio}
          onCheckedChange={(showLow) => patch({ showLow })}
          onDpoChange={(lowDpoValue) => patch({ lowDpoValue })}
          onMorganRatioChange={(lowMorganRatio) => patch({ lowMorganRatio })}
        />
      </section>
    </div>
  )
}

function MmfSignalInputBlock({
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

export function MmfStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmfIndicatorSettings) => void
  settings: MmfIndicatorSettings
}) {
  const patch = (next: Partial<MmfIndicatorSettings>) => onSettingsChange(updateMmfSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-mmf-style-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <MmfMarkerStyleRow
          color={settings.highColor}
          label={'\u9ad8\u70b9'}
          onColorChange={(highColor) => patch({ highColor })}
          onSizeChange={(highSize) => patch({ highSize })}
          onSymbolChange={(highSymbol) => patch({ highSymbol })}
          size={settings.highSize}
          symbol={settings.highSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.lowColor}
          label={'\u4f4e\u70b9'}
          onColorChange={(lowColor) => patch({ lowColor })}
          onSizeChange={(lowSize) => patch({ lowSize })}
          onSymbolChange={(lowSymbol) => patch({ lowSymbol })}
          size={settings.lowSize}
          symbol={settings.lowSymbol}
        />
      </section>
    </div>
  )
}

function MmfMarkerStyleRow({
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
          width={80}
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
