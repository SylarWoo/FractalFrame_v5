import type {
  VwapAnchorPeriod,
  VwapBandCalculationMode,
  VwapIndicatorSettings,
  VwapSource,
  VwapTimeframe,
} from '../../indicatorPersistence'
import {
  IndicatorColorStyleRow,
  IndicatorLineStyleRow,
  IndicatorSelectRow,
  InfoBadge,
  NumberBox,
} from './IndicatorSettingControls'
import {
  vwapAnchorPeriodOptions,
  vwapBandCalculationModeOptions,
  vwapSourceOptions,
  vwapStyleText,
  vwapText,
  vwapTimeframeOptions,
} from './indicatorPanelOptions'
import { updateVwapSettings } from './indicatorPanelShared'

export function VwapStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VwapIndicatorSettings) => void
  settings: VwapIndicatorSettings
}) {
  const patch = (next: Partial<VwapIndicatorSettings>) => onSettingsChange(updateVwapSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-vwap-style-panel-v1" role="tabpanel">
      <IndicatorLineStyleRow
        checked={settings.vwapVisible}
        label={vwapStyleText.vwap}
        onCheckedChange={(vwapVisible) => patch({ vwapVisible })}
        onLineChange={(value) => patch({
          vwapColor: value.hex,
          vwapLineStyle: value.lineStyle,
          vwapLineWidth: value.thickness,
          vwapOpacity: value.opacity,
        })}
        value={{ hex: settings.vwapColor, lineStyle: settings.vwapLineStyle, opacity: settings.vwapOpacity, thickness: settings.vwapLineWidth }}
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

export function VwapInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VwapIndicatorSettings) => void
  settings: VwapIndicatorSettings
}) {
  const patch = (next: Partial<VwapIndicatorSettings>) => onSettingsChange(updateVwapSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-vwap-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{vwapText.settings}</h3>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.hideOnDailyOrAbove} onChange={(event) => patch({ hideOnDailyOrAbove: event.target.checked })} type="checkbox" />
          <span>{vwapText.hideOnDailyOrAbove}</span>
        </label>
        <IndicatorSelectRow className="ff-indicators-vwap-panel-v1__row" ariaLabel="VWAP anchor period" label={vwapText.period} onChange={(value) => patch({ anchorPeriod: value as VwapAnchorPeriod })} options={vwapAnchorPeriodOptions} value={settings.anchorPeriod} />
        <IndicatorSelectRow className="ff-indicators-vwap-panel-v1__row" ariaLabel="VWAP source" label={vwapText.source} onChange={(value) => patch({ source: value as VwapSource })} options={vwapSourceOptions} value={settings.source} />
        <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{vwapText.offset}</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox max={500} min={-500} onChange={(offset) => patch({ offset })} value={settings.offset} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{vwapText.bands}</h3>
        <IndicatorSelectRow
          className="ff-indicators-vwap-panel-v1__row"
          ariaLabel="VWAP band calculation mode"
          label={<>{vwapText.bandCalculationMode} <InfoBadge title={vwapText.bandCalculationModeInfo} /></>}
          onChange={(value) => patch({ bandCalculationMode: value as VwapBandCalculationMode })}
          options={vwapBandCalculationModeOptions}
          value={settings.bandCalculationMode}
        />
        <label className="ff-indicators-vwap-panel-v1__band-row">
          <span className="ff-indicators-vwap-panel-v1__band-check">
            <input checked={settings.band1Visible} onChange={(event) => patch({ band1Visible: event.target.checked })} type="checkbox" />
            <span>{vwapText.band1}</span>
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox max={100} min={0} onChange={(band1Multiplier) => patch({ band1Multiplier })} step={0.1} value={settings.band1Multiplier} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__band-row">
          <span className="ff-indicators-vwap-panel-v1__band-check">
            <input checked={settings.band2Visible} onChange={(event) => patch({ band2Visible: event.target.checked })} type="checkbox" />
            <span>{vwapText.band2}</span>
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <input disabled={!settings.band2Visible} max={100} min={0} onChange={(event) => patch({ band2Multiplier: Number(event.target.value) || 0 })} step={0.1} type="number" value={settings.band2Multiplier} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__band-row">
          <span className="ff-indicators-vwap-panel-v1__band-check">
            <input checked={settings.band3Visible} onChange={(event) => patch({ band3Visible: event.target.checked })} type="checkbox" />
            <span>{vwapText.band3}</span>
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <input disabled={!settings.band3Visible} max={100} min={0} onChange={(event) => patch({ band3Multiplier: Number(event.target.value) || 0 })} step={0.1} type="number" value={settings.band3Multiplier} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{vwapText.calculation}</h3>
        <IndicatorSelectRow
          className="ff-indicators-vwap-panel-v1__row"
          ariaLabel="VWAP timeframe"
          label={<>{vwapText.timeframe} <InfoBadge title={vwapText.timeframeInfo} /></>}
          onChange={(value) => patch({ timeframe: value as VwapTimeframe })}
          options={vwapTimeframeOptions}
          value={settings.timeframe}
        />
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>{vwapText.waitForTimeframeClose}</span>
        </label>
      </section>
    </div>
  )
}
