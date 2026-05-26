import { OpenableSelect } from '../../../controls/OpenableSelect'
import { SymbolSelect } from '../../../controls/SymbolSelect'
import type { SymbolSelectSize } from '../../../controls/SymbolSelect'
import { SettingsColorSwatch } from '../../../settings/SettingsSwatches'
import { mmfHighSymbolOptions } from '../../stickerSymbols'
import type { MmfIndicatorSettings, MmfMorganRatio } from '../../indicatorPersistence'
import { CheckControl, NumberBox, updateMmfSettings } from './indicatorPanelShared'

const mmfMorganRatioOptions: Array<{ label: string; value: MmfMorganRatio }> = [
  { label: '0.118', value: '0.118' },
  { label: '0.177', value: '0.177' },
  { label: '0.236', value: '0.236' },
]

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
      <section className="ff-indicators-input-panel-v1__section">
        <div className="ff-indicators-mmf-panel-v1__high-row">
          <CheckControl checked={settings.showHigh} label="高点" onChange={(showHigh) => patch({ showHigh })} />
        </div>
        <div className="ff-indicators-mmf-panel-v1__settings-grid">
          <span className="ff-indicators-mmf-panel-v1__label">摩根区间</span>
          <span className="ff-indicators-mmf-panel-v1__ratio-select">
            <OpenableSelect
              ariaLabel="MMF high Morgan ratio"
              onChange={(value) => patch({ highMorganRatio: value as MmfMorganRatio })}
              options={mmfMorganRatioOptions}
              value={settings.highMorganRatio}
            />
          </span>
          <span className="ff-indicators-mmf-panel-v1__label">微调</span>
          <span className="ff-indicators-mmf-panel-v1__offset-wrap">
            <span className="ff-indicators-mmf-panel-v1__offset-input">
              <NumberBox
                max={99}
                min={-99}
                onChange={(highOffsetPercent) => patch({ highOffsetPercent })}
                value={settings.highOffsetPercent}
              />
            </span>
            <span className="ff-indicators-mmf-panel-v1__offset-unit">%</span>
          </span>
          <span className="ff-indicators-mmf-panel-v1__label">DPO</span>
          <span className="ff-indicators-mmf-panel-v1__dpo-input">
            <NumberBox
              max={40}
              min={0}
              onChange={(dpoValue) => patch({ dpoValue })}
              value={settings.dpoValue}
            />
          </span>
        </div>
      </section>
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
        <div className="ff-indicators-mmf-style-panel-v1__row">
          <span className="ff-indicators-mmf-style-panel-v1__label">{'\u9ad8\u70b9'}</span>
          <span className="ff-indicators-mmf-style-panel-v1__symbol-select">
            <SymbolSelect
              ariaLabel="MMF high symbol"
              onChange={(highSymbol) => patch({ highSymbol })}
              options={mmfHighSymbolOptions}
              resolveSize={resolveMmfSymbolSize}
              value={settings.highSymbol}
              width={80}
            />
          </span>
          <span className="ff-indicators-mmf-style-panel-v1__size-input">
            <NumberBox
              max={96}
              min={8}
              onChange={(highSize) => patch({ highSize })}
              value={settings.highSize}
            />
          </span>
          <SettingsColorSwatch
            color={settings.highColor}
            onChange={(value) => patch({ highColor: value.hex })}
            value={{ hex: settings.highColor, opacity: 1 }}
          />
        </div>
      </section>
    </div>
  )
}
