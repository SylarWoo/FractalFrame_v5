import type { MmadIndicatorSettings, MmadTimeframe } from '../../indicatorPersistence'
import {
  CheckControl,
  IndicatorColorStyleRow,
  IndicatorLineStyleRow,
  IndicatorSelectRow,
} from './IndicatorSettingControls'
import { vwapStyleText } from './indicatorPanelOptions'

const mmADTimeframeOptions: Array<{ label: string; value: MmadTimeframe }> = [
  { value: '5m', label: '5 \u5206\u949f' },
  { value: '30m', label: '30 \u5206\u949f' },
  { value: '2h', label: '2 \u5c0f\u65f6' },
]

export function MmadInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmadIndicatorSettings) => void
  settings: MmadIndicatorSettings
}) {
  const patch = (next: Partial<MmadIndicatorSettings>) => onSettingsChange({ ...settings, ...next })

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mmad-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <IndicatorSelectRow
          label="Timeframe"
          onChange={(timeframe) => patch({ timeframe: timeframe as MmadTimeframe })}
          options={mmADTimeframeOptions}
          value={settings.timeframe}
        />
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">Wait close</span>
          <span className="ff-indicators-input-panel-v1__control">
            <CheckControl checked={settings.waitForTimeframeClose} label="" onChange={(waitForTimeframeClose) => patch({ waitForTimeframeClose })} />
          </span>
        </label>
      </section>
    </div>
  )
}

export function MmadStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MmadIndicatorSettings) => void
  settings: MmadIndicatorSettings
}) {
  const patch = (next: Partial<MmadIndicatorSettings>) => onSettingsChange({ ...settings, ...next })

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-mmad-style-panel-v1" role="tabpanel">
      <IndicatorLineStyleRow
        checked={settings.lineVisible}
        label="MMAD"
        onCheckedChange={(lineVisible) => patch({ lineVisible })}
        onLineChange={(value) => patch({
          lineColor: value.hex,
          lineOpacity: value.opacity,
          lineStyle: value.lineStyle,
          lineWidth: value.thickness,
        })}
        value={{ hex: settings.lineColor, lineStyle: settings.lineStyle, opacity: settings.lineOpacity, thickness: settings.lineWidth }}
      />
      <IndicatorLineStyleRow
        checked={settings.band1UpperVisible}
        label={vwapStyleText.upperBand1}
        onCheckedChange={(band1UpperVisible) => patch({ band1UpperVisible })}
        onLineChange={(value) => patch({
          band1UpperColor: value.hex,
          band1UpperLineStyle: value.lineStyle,
          band1UpperLineWidth: value.thickness,
          band1UpperOpacity: value.opacity,
        })}
        value={{ hex: settings.band1UpperColor, lineStyle: settings.band1UpperLineStyle, opacity: settings.band1UpperOpacity, thickness: settings.band1UpperLineWidth }}
      />
      <IndicatorLineStyleRow
        checked={settings.band1LowerVisible}
        label={vwapStyleText.lowerBand1}
        onCheckedChange={(band1LowerVisible) => patch({ band1LowerVisible })}
        onLineChange={(value) => patch({
          band1LowerColor: value.hex,
          band1LowerLineStyle: value.lineStyle,
          band1LowerLineWidth: value.thickness,
          band1LowerOpacity: value.opacity,
        })}
        value={{ hex: settings.band1LowerColor, lineStyle: settings.band1LowerLineStyle, opacity: settings.band1LowerOpacity, thickness: settings.band1LowerLineWidth }}
      />
      <IndicatorColorStyleRow
        checked={settings.band1FillVisible}
        checkerboard
        color={settings.band1FillColor}
        label={vwapStyleText.bandsFill1}
        onCheckedChange={(band1FillVisible) => patch({ band1FillVisible })}
        onColorChange={(value) => patch({ band1FillColor: value.hex, band1FillOpacity: value.opacity })}
        value={{ hex: settings.band1FillColor, opacity: settings.band1FillOpacity }}
      />
    </div>
  )
}
