import type { TsiIndicatorSettings, VwapTimeframe } from '../../indicatorPersistence'
import {
  IndicatorCheckboxRow,
  IndicatorColorStyleRow,
  IndicatorLineStyleRow,
  IndicatorLineValueStyleRow,
  IndicatorNumberRow,
  IndicatorSection,
  IndicatorSelectRow,
  InfoBadge,
} from './IndicatorSettingControls'
import { vwapTimeframeOptions } from './indicatorPanelOptions'
import { updateTsiSettings } from './indicatorPanelShared'

export function TsiInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: TsiIndicatorSettings) => void
  settings: TsiIndicatorSettings
}) {
  const patch = (next: Partial<TsiIndicatorSettings>) => onSettingsChange(updateTsiSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-tsi-panel-v1" role="tabpanel">
      <IndicatorSection>
        <IndicatorNumberRow label="长线长度" min={1} onChange={(longLength) => patch({ longLength })} value={settings.longLength} />
        <IndicatorNumberRow label="短线长度" min={1} onChange={(shortLength) => patch({ shortLength })} value={settings.shortLength} />
        <IndicatorNumberRow label="Signal length" min={1} onChange={(signalLength) => patch({ signalLength })} value={settings.signalLength} />
      </IndicatorSection>
      <IndicatorSection title="Calculation">
        <IndicatorSelectRow
          ariaLabel="TSI timeframe"
          label={<>Timeframe <InfoBadge title="Uses the chart timeframe for calculation; control state is persisted." /></>}
          onChange={(value) => patch({ timeframe: value as VwapTimeframe })}
          options={vwapTimeframeOptions}
          value={settings.timeframe}
        />
        <IndicatorCheckboxRow
          checked={settings.waitForTimeframeClose}
          label="Wait for timeframe close"
          onChange={(waitForTimeframeClose) => patch({ waitForTimeframeClose })}
          variant="compact"
        />
      </IndicatorSection>
    </div>
  )
}

export function TsiStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: TsiIndicatorSettings) => void
  settings: TsiIndicatorSettings
}) {
  const patch = (next: Partial<TsiIndicatorSettings>) => onSettingsChange(updateTsiSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-tsi-style-panel-v1" role="tabpanel">
      <IndicatorLineStyleRow
        checked={settings.tsiVisible}
        label="True Strength Index"
        onCheckedChange={(tsiVisible) => patch({ tsiVisible })}
        onLineChange={(value) => patch({ tsiColor: value.hex, tsiLineStyle: value.lineStyle, tsiLineWidth: value.thickness, tsiOpacity: value.opacity })}
        value={{ hex: settings.tsiColor, lineStyle: settings.tsiLineStyle, opacity: settings.tsiOpacity, thickness: settings.tsiLineWidth }}
      />
      <IndicatorLineStyleRow
        checked={settings.signalVisible}
        label="Signal"
        onCheckedChange={(signalVisible) => patch({ signalVisible })}
        onLineChange={(value) => patch({ signalColor: value.hex, signalLineStyle: value.lineStyle, signalLineWidth: value.thickness, signalOpacity: value.opacity })}
        value={{ hex: settings.signalColor, lineStyle: settings.signalLineStyle, opacity: settings.signalOpacity, thickness: settings.signalLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.zeroLineVisible}
        label="Zero line"
        max={0}
        min={0}
        numericValue={0}
        onCheckedChange={(zeroLineVisible) => patch({ zeroLineVisible })}
        onLineChange={(value) => patch({ zeroLineColor: value.hex, zeroLineStyle: value.lineStyle, zeroLineWidth: value.thickness, zeroLineOpacity: value.opacity })}
        onValueChange={() => undefined}
        value={{ hex: settings.zeroLineColor, lineStyle: settings.zeroLineStyle, opacity: settings.zeroLineOpacity, thickness: settings.zeroLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.upperBandVisible}
        label="Upper band"
        max={500}
        min={-500}
        numericValue={settings.upperBandValue}
        onCheckedChange={(upperBandVisible) => patch({ upperBandVisible })}
        onLineChange={(value) => patch({ upperBandColor: value.hex, upperBandLineStyle: value.lineStyle, upperBandLineWidth: value.thickness, upperBandOpacity: value.opacity })}
        onValueChange={(upperBandValue) => patch({ upperBandValue })}
        step={0.1}
        value={{ hex: settings.upperBandColor, lineStyle: settings.upperBandLineStyle, opacity: settings.upperBandOpacity, thickness: settings.upperBandLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.lowerBandVisible}
        label="Lower band"
        max={500}
        min={-500}
        numericValue={settings.lowerBandValue}
        onCheckedChange={(lowerBandVisible) => patch({ lowerBandVisible })}
        onLineChange={(value) => patch({ lowerBandColor: value.hex, lowerBandLineStyle: value.lineStyle, lowerBandLineWidth: value.thickness, lowerBandOpacity: value.opacity })}
        onValueChange={(lowerBandValue) => patch({ lowerBandValue })}
        step={0.1}
        value={{ hex: settings.lowerBandColor, lineStyle: settings.lowerBandLineStyle, opacity: settings.lowerBandOpacity, thickness: settings.lowerBandLineWidth }}
      />
      <IndicatorColorStyleRow
        checked={settings.backgroundFillVisible}
        checkerboard
        color={settings.backgroundFillColor}
        label="背景"
        onCheckedChange={(backgroundFillVisible) => patch({ backgroundFillVisible })}
        onColorChange={(value) => patch({ backgroundFillColor: value.hex, backgroundFillOpacity: value.opacity })}
        value={{ hex: settings.backgroundFillColor, opacity: settings.backgroundFillOpacity }}
      />
    </div>
  )
}
