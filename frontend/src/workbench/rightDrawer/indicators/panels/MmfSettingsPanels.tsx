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
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showUpBreakPoint}
              label={'\u5411\u4e0a\u65b9\u5411\u70b9'}
              onChange={(showUpBreakPoint) => patch({ showUpBreakPoint })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.upBreakVdoLower}
            onLowerChange={(upBreakVdoLower) => patch({ upBreakVdoLower })}
            onUpperChange={(upBreakVdoUpper) => patch({ upBreakVdoUpper })}
            upper={settings.upBreakVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showDownBreakPoint}
              label={'\u5411\u4e0b\u65b9\u5411\u70b9'}
              onChange={(showDownBreakPoint) => patch({ showDownBreakPoint })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.downBreakVdoLower}
            onLowerChange={(downBreakVdoLower) => patch({ downBreakVdoLower })}
            onUpperChange={(downBreakVdoUpper) => patch({ downBreakVdoUpper })}
            upper={settings.downBreakVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showResistanceLevel}
              label={'\u963b\u529b\u4f4d'}
              onChange={(showResistanceLevel) => patch({ showResistanceLevel })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.resistanceVdoLower}
            onLowerChange={(resistanceVdoLower) => patch({ resistanceVdoLower })}
            onUpperChange={(resistanceVdoUpper) => patch({ resistanceVdoUpper })}
            upper={settings.resistanceVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showSupportLevel}
              label={'\u652f\u6491\u4f4d'}
              onChange={(showSupportLevel) => patch({ showSupportLevel })}
            />
          </div>
          <MmfVdoLimitRow
            lower={settings.supportVdoLower}
            onLowerChange={(supportVdoLower) => patch({ supportVdoLower })}
            onUpperChange={(supportVdoUpper) => patch({ supportVdoUpper })}
            upper={settings.supportVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendDownPoint}
              label={'\u8d8b\u52bf\u4e0b\u964d\u70b9'}
              onChange={(showTrendDownPoint) => patch({ showTrendDownPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(trendDownVdoUpper) => patch({ trendDownVdoUpper })}
            threshold={settings.trendDownVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showTrendUpPoint}
              label={'\u8d8b\u52bf\u4e0a\u5347\u70b9'}
              onChange={(showTrendUpPoint) => patch({ showTrendUpPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(trendUpVdoUpper) => patch({ trendUpVdoUpper })}
            threshold={settings.trendUpVdoUpper}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showReboundPoint}
              label={'\u53cd\u5f39\u70b9'}
              onChange={(showReboundPoint) => patch({ showReboundPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(reboundVdoThreshold) => patch({ reboundVdoThreshold })}
            threshold={settings.reboundVdoThreshold}
          />
        </div>
        <div className="ff-indicators-mmf-panel-v1__signal-block">
          <div className="ff-indicators-mmf-panel-v1__high-row">
            <CheckControl
              checked={settings.showPullbackPoint}
              label={'\u56de\u64a4\u70b9'}
              onChange={(showPullbackPoint) => patch({ showPullbackPoint })}
            />
          </div>
          <MmfVdoThresholdRow
            onThresholdChange={(pullbackVdoThreshold) => patch({ pullbackVdoThreshold })}
            threshold={settings.pullbackVdoThreshold}
          />
        </div>
      </section>
    </div>
  )
}

function MmfVdoLimitRow({
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

function MmfVdoThresholdRow({
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
        <MmfMarkerStyleRow
          color={settings.upBreakColor}
          label={'\u5411\u4e0a\u65b9\u5411\u70b9'}
          onColorChange={(upBreakColor) => patch({ upBreakColor })}
          onSizeChange={(upBreakSize) => patch({ upBreakSize })}
          onSymbolChange={(upBreakSymbol) => patch({ upBreakSymbol })}
          size={settings.upBreakSize}
          symbol={settings.upBreakSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.downBreakColor}
          label={'\u5411\u4e0b\u65b9\u5411\u70b9'}
          onColorChange={(downBreakColor) => patch({ downBreakColor })}
          onSizeChange={(downBreakSize) => patch({ downBreakSize })}
          onSymbolChange={(downBreakSymbol) => patch({ downBreakSymbol })}
          size={settings.downBreakSize}
          symbol={settings.downBreakSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.resistanceColor}
          label={'\u963b\u529b\u4f4d'}
          onColorChange={(resistanceColor) => patch({ resistanceColor })}
          onSizeChange={(resistanceSize) => patch({ resistanceSize })}
          onSymbolChange={(resistanceSymbol) => patch({ resistanceSymbol })}
          size={settings.resistanceSize}
          symbol={settings.resistanceSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.supportColor}
          label={'\u652f\u6491\u4f4d'}
          onColorChange={(supportColor) => patch({ supportColor })}
          onSizeChange={(supportSize) => patch({ supportSize })}
          onSymbolChange={(supportSymbol) => patch({ supportSymbol })}
          size={settings.supportSize}
          symbol={settings.supportSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendDownColor}
          label={'\u8d8b\u52bf\u4e0b\u964d\u70b9'}
          onColorChange={(trendDownColor) => patch({ trendDownColor })}
          onSizeChange={(trendDownSize) => patch({ trendDownSize })}
          onSymbolChange={(trendDownSymbol) => patch({ trendDownSymbol })}
          size={settings.trendDownSize}
          symbol={settings.trendDownSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.trendUpColor}
          label={'\u8d8b\u52bf\u4e0a\u5347\u70b9'}
          onColorChange={(trendUpColor) => patch({ trendUpColor })}
          onSizeChange={(trendUpSize) => patch({ trendUpSize })}
          onSymbolChange={(trendUpSymbol) => patch({ trendUpSymbol })}
          size={settings.trendUpSize}
          symbol={settings.trendUpSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.reboundColor}
          label={'\u53cd\u5f39\u70b9'}
          onColorChange={(reboundColor) => patch({ reboundColor })}
          onSizeChange={(reboundSize) => patch({ reboundSize })}
          onSymbolChange={(reboundSymbol) => patch({ reboundSymbol })}
          size={settings.reboundSize}
          symbol={settings.reboundSymbol}
        />
        <MmfMarkerStyleRow
          color={settings.pullbackColor}
          label={'\u56de\u64a4\u70b9'}
          onColorChange={(pullbackColor) => patch({ pullbackColor })}
          onSizeChange={(pullbackSize) => patch({ pullbackSize })}
          onSymbolChange={(pullbackSymbol) => patch({ pullbackSymbol })}
          size={settings.pullbackSize}
          symbol={settings.pullbackSymbol}
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
