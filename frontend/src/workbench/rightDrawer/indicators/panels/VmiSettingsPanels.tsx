import { SettingsColorSwatch } from '../../../settings/SettingsSwatches'
import type { VmiIndicatorSettings } from '../../indicatorPersistence'
import {
  CheckControl,
  IndicatorLineStyleRow,
  IndicatorLineValueStyleRow,
  IndicatorNumberRow,
  IndicatorSection,
} from './IndicatorSettingControls'
import { updateVmiSettings } from './indicatorPanelShared'

export function VmiInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VmiIndicatorSettings) => void
  settings: VmiIndicatorSettings
}) {
  const patch = (next: Partial<VmiIndicatorSettings>) => onSettingsChange(updateVmiSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-vmi-panel-v1" role="tabpanel">
      <IndicatorSection>
        <IndicatorNumberRow label="Fast SMA" min={1} onChange={(fastLength) => patch({ fastLength })} value={settings.fastLength} />
        <IndicatorNumberRow label="Slow SMA" min={1} onChange={(slowLength) => patch({ slowLength })} value={settings.slowLength} />
      </IndicatorSection>
    </div>
  )
}

export function VmiStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VmiIndicatorSettings) => void
  settings: VmiIndicatorSettings
}) {
  const patch = (next: Partial<VmiIndicatorSettings>) => onSettingsChange(updateVmiSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-vmi-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.histogramVisible} label="Histogram" onChange={(histogramVisible) => patch({ histogramVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsColorSwatch
            color={settings.histogramPositiveColor}
            onChange={(value) => patch({ histogramPositiveColor: value.hex, histogramPositiveOpacity: value.opacity })}
            value={{ hex: settings.histogramPositiveColor, opacity: settings.histogramPositiveOpacity }}
          />
          <SettingsColorSwatch
            color={settings.histogramNegativeColor}
            onChange={(value) => patch({ histogramNegativeColor: value.hex, histogramNegativeOpacity: value.opacity })}
            value={{ hex: settings.histogramNegativeColor, opacity: settings.histogramNegativeOpacity }}
          />
        </span>
      </div>
      <IndicatorLineStyleRow
        checked={settings.zeroLineVisible}
        label="Zero line"
        onCheckedChange={(zeroLineVisible) => patch({ zeroLineVisible })}
        onLineChange={(value) => patch({
          zeroLineColor: value.hex,
          zeroLineStyle: value.lineStyle,
          zeroLineWidth: value.thickness,
          zeroLineOpacity: value.opacity,
        })}
        value={{ hex: settings.zeroLineColor, lineStyle: settings.zeroLineStyle, opacity: settings.zeroLineOpacity, thickness: settings.zeroLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.upperBandVisible}
        label="Upper Band"
        min={-500}
        numericValue={settings.upperBandValue}
        onCheckedChange={(upperBandVisible) => patch({ upperBandVisible })}
        onLineChange={(value) => patch({
          upperBandColor: value.hex,
          upperBandLineStyle: value.lineStyle,
          upperBandLineWidth: value.thickness,
          upperBandOpacity: value.opacity,
        })}
        onValueChange={(upperBandValue) => patch({ upperBandValue })}
        step={0.001}
        value={{ hex: settings.upperBandColor, lineStyle: settings.upperBandLineStyle, opacity: settings.upperBandOpacity, thickness: settings.upperBandLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.lowerBandVisible}
        label="Lower Band"
        min={-500}
        numericValue={settings.lowerBandValue}
        onCheckedChange={(lowerBandVisible) => patch({ lowerBandVisible })}
        onLineChange={(value) => patch({
          lowerBandColor: value.hex,
          lowerBandLineStyle: value.lineStyle,
          lowerBandLineWidth: value.thickness,
          lowerBandOpacity: value.opacity,
        })}
        onValueChange={(lowerBandValue) => patch({ lowerBandValue })}
        step={0.001}
        value={{ hex: settings.lowerBandColor, lineStyle: settings.lowerBandLineStyle, opacity: settings.lowerBandOpacity, thickness: settings.lowerBandLineWidth }}
      />
    </div>
  )
}
