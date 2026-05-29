import { OpenableSelect } from '../../../controls/OpenableSelect'
import { SettingsColorSwatch } from '../../../settings/SettingsSwatches'
import type { SqzmomIndicatorSettings, VwapTimeframe } from '../../indicatorPersistence'
import {
  CheckControl,
  InfoBadge,
  NumberBox,
  updateSqzmomSettings,
  vwapTimeframeOptions,
} from './indicatorPanelShared'

export function SqzmomInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: SqzmomIndicatorSettings) => void
  settings: SqzmomIndicatorSettings
}) {
  const patch = (next: Partial<SqzmomIndicatorSettings>) => onSettingsChange(updateSqzmomSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-sqzmom-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">SQZMOM</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">BB Length</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(bbLength) => patch({ bbLength })} value={settings.bbLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">BB MultFactor</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={0} onChange={(bbMultiplier) => patch({ bbMultiplier })} step={0.1} value={settings.bbMultiplier} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">KC Length</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(kcLength) => patch({ kcLength })} value={settings.kcLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">KC MultFactor</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={0} onChange={(kcMultiplier) => patch({ kcMultiplier })} step={0.1} value={settings.kcMultiplier} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.useTrueRange} onChange={(event) => patch({ useTrueRange: event.target.checked })} type="checkbox" />
          <span>Use TrueRange (KC)</span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">计算</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">时间周期 <InfoBadge title="当前先按图表周期计算，控件状态会被保存。" /></span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="SQZMOM timeframe" onChange={(value) => patch({ timeframe: value as VwapTimeframe })} options={vwapTimeframeOptions} value={settings.timeframe} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>等待时间周期结束</span>
        </label>
      </section>
    </div>
  )
}

export function SqzmomStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: SqzmomIndicatorSettings) => void
  settings: SqzmomIndicatorSettings
}) {
  const patch = (next: Partial<SqzmomIndicatorSettings>) => onSettingsChange(updateSqzmomSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-sqzmom-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.histogramVisible} label="Histogram" onChange={(histogramVisible) => patch({ histogramVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsColorSwatch color={settings.histogramPositiveRisingColor} onChange={(value) => patch({ histogramPositiveRisingColor: value.hex, histogramPositiveRisingOpacity: value.opacity })} value={{ hex: settings.histogramPositiveRisingColor, opacity: settings.histogramPositiveRisingOpacity }} />
          <SettingsColorSwatch color={settings.histogramPositiveFallingColor} onChange={(value) => patch({ histogramPositiveFallingColor: value.hex, histogramPositiveFallingOpacity: value.opacity })} value={{ hex: settings.histogramPositiveFallingColor, opacity: settings.histogramPositiveFallingOpacity }} />
          <SettingsColorSwatch color={settings.histogramNegativeFallingColor} onChange={(value) => patch({ histogramNegativeFallingColor: value.hex, histogramNegativeFallingOpacity: value.opacity })} value={{ hex: settings.histogramNegativeFallingColor, opacity: settings.histogramNegativeFallingOpacity }} />
          <SettingsColorSwatch color={settings.histogramNegativeRisingColor} onChange={(value) => patch({ histogramNegativeRisingColor: value.hex, histogramNegativeRisingOpacity: value.opacity })} value={{ hex: settings.histogramNegativeRisingColor, opacity: settings.histogramNegativeRisingOpacity }} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.squeezeOnVisible} label="Squeeze On" onChange={(squeezeOnVisible) => patch({ squeezeOnVisible })} />
        <SettingsColorSwatch color={settings.squeezeOnColor} onChange={(value) => patch({ squeezeOnColor: value.hex, squeezeOnOpacity: value.opacity })} value={{ hex: settings.squeezeOnColor, opacity: settings.squeezeOnOpacity }} />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.squeezeOffVisible} label="Squeeze Off" onChange={(squeezeOffVisible) => patch({ squeezeOffVisible })} />
        <SettingsColorSwatch color={settings.squeezeOffColor} onChange={(value) => patch({ squeezeOffColor: value.hex, squeezeOffOpacity: value.opacity })} value={{ hex: settings.squeezeOffColor, opacity: settings.squeezeOffOpacity }} />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.noSqueezeVisible} label="No Squeeze" onChange={(noSqueezeVisible) => patch({ noSqueezeVisible })} />
        <SettingsColorSwatch color={settings.noSqueezeColor} onChange={(value) => patch({ noSqueezeColor: value.hex, noSqueezeOpacity: value.opacity })} value={{ hex: settings.noSqueezeColor, opacity: settings.noSqueezeOpacity }} />
      </div>
    </div>
  )
}
