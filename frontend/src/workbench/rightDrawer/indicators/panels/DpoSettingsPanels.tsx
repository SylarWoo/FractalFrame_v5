import type { DpoIndicatorSettings, VwapTimeframe } from '../../indicatorPersistence'
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
import { updateDpoSettings } from './indicatorPanelShared'

export function DpoInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: DpoIndicatorSettings) => void
  settings: DpoIndicatorSettings
}) {
  const patch = (next: Partial<DpoIndicatorSettings>) => onSettingsChange(updateDpoSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-dpo-panel-v1" role="tabpanel">
      <IndicatorSection>
        <IndicatorNumberRow label="长度" min={1} onChange={(length) => patch({ length })} value={settings.length} />
        <IndicatorCheckboxRow
          checked={settings.centered}
          info={<InfoBadge title="Persists UI state only; calculation can be wired later." />}
          label="Centered"
          onChange={(centered) => patch({ centered })}
          variant="compact"
        />
      </IndicatorSection>
      <IndicatorSection title="Calculation">
        <IndicatorSelectRow
          ariaLabel="DPO timeframe"
          label={<>Timeframe <InfoBadge title="Persists UI state only; calculation can be wired later." /></>}
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

export function DpoStylePanel({
  lineLabel = 'DPO',
  onSettingsChange,
  showBand2Levels = false,
  showThresholds = true,
  settings,
  zeroLineEditable = true,
}: {
  lineLabel?: string
  onSettingsChange: (settings: DpoIndicatorSettings) => void
  showBand2Levels?: boolean
  showThresholds?: boolean
  settings: DpoIndicatorSettings
  zeroLineEditable?: boolean
}) {
  const patch = (next: Partial<DpoIndicatorSettings>) => onSettingsChange(updateDpoSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-dpo-style-panel-v1" role="tabpanel">
      <IndicatorLineStyleRow
        checked={settings.dpoVisible}
        label={lineLabel}
        onCheckedChange={(dpoVisible) => patch({ dpoVisible })}
        onLineChange={(value) => patch({
          dpoColor: value.hex,
          dpoLineStyle: value.lineStyle,
          dpoLineWidth: value.thickness,
          dpoOpacity: value.opacity,
        })}
        value={{ hex: settings.dpoColor, lineStyle: settings.dpoLineStyle, opacity: settings.dpoOpacity, thickness: settings.dpoLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.zeroLineVisible}
        label="Zero line"
        max={zeroLineEditable ? 500 : 0}
        min={zeroLineEditable ? -500 : 0}
        numericValue={zeroLineEditable ? settings.zeroLineValue : 0}
        onCheckedChange={(zeroLineVisible) => patch({ zeroLineVisible })}
        onLineChange={(value) => patch({
          zeroLineColor: value.hex,
          zeroLineStyle: value.lineStyle,
          zeroLineWidth: value.thickness,
          zeroLineOpacity: value.opacity,
        })}
        onValueChange={(zeroLineValue) => patch({ zeroLineValue })}
        value={{ hex: settings.zeroLineColor, lineStyle: settings.zeroLineStyle, opacity: settings.zeroLineOpacity, thickness: settings.zeroLineWidth }}
      />
      {showThresholds ? (
        <>
          <IndicatorLineValueStyleRow
            checked={settings.upLineVisible}
            label="Upper Band"
            min={-500}
            numericValue={settings.upLineValue}
            onCheckedChange={(upLineVisible) => patch({ upLineVisible })}
            onLineChange={(value) => patch({
              upLineColor: value.hex,
              upLineStyle: value.lineStyle,
              upLineWidth: value.thickness,
              upLineOpacity: value.opacity,
            })}
            onValueChange={(upLineValue) => patch({ upLineValue })}
            step={0.001}
            value={{ hex: settings.upLineColor, lineStyle: settings.upLineStyle, opacity: settings.upLineOpacity, thickness: settings.upLineWidth }}
          />
          {showBand2Levels ? (
            <IndicatorLineValueStyleRow
              checked={settings.upLine2Visible}
              label="Upper Band 2 level"
              min={-500}
              numericValue={settings.upLine2Value}
              onCheckedChange={(upLine2Visible) => patch({ upLine2Visible })}
              onLineChange={(value) => patch({
                upLine2Color: value.hex,
                upLine2Style: value.lineStyle,
                upLine2Width: value.thickness,
                upLine2Opacity: value.opacity,
              })}
              onValueChange={(upLine2Value) => patch({ upLine2Value })}
              step={0.001}
              value={{ hex: settings.upLine2Color, lineStyle: settings.upLine2Style, opacity: settings.upLine2Opacity, thickness: settings.upLine2Width }}
            />
          ) : null}
          <IndicatorLineValueStyleRow
            checked={settings.downLineVisible}
            label="Lower Band"
            min={-500}
            numericValue={settings.downLineValue}
            onCheckedChange={(downLineVisible) => patch({ downLineVisible })}
            onLineChange={(value) => patch({
              downLineColor: value.hex,
              downLineStyle: value.lineStyle,
              downLineWidth: value.thickness,
              downLineOpacity: value.opacity,
            })}
            onValueChange={(downLineValue) => patch({ downLineValue })}
            step={0.001}
            value={{ hex: settings.downLineColor, lineStyle: settings.downLineStyle, opacity: settings.downLineOpacity, thickness: settings.downLineWidth }}
          />
          {showBand2Levels ? (
            <IndicatorLineValueStyleRow
              checked={settings.downLine2Visible}
              label="Lower Band 2 level"
              min={-500}
              numericValue={settings.downLine2Value}
              onCheckedChange={(downLine2Visible) => patch({ downLine2Visible })}
              onLineChange={(value) => patch({
                downLine2Color: value.hex,
                downLine2Style: value.lineStyle,
                downLine2Width: value.thickness,
                downLine2Opacity: value.opacity,
              })}
              onValueChange={(downLine2Value) => patch({ downLine2Value })}
              step={0.001}
              value={{ hex: settings.downLine2Color, lineStyle: settings.downLine2Style, opacity: settings.downLine2Opacity, thickness: settings.downLine2Width }}
            />
          ) : null}
          <IndicatorColorStyleRow
            checked={settings.backgroundVisible}
            checkerboard
            color={settings.backgroundColor}
            label="背景"
            onCheckedChange={(backgroundVisible) => patch({ backgroundVisible })}
            onColorChange={(value) => patch({ backgroundColor: value.hex, backgroundOpacity: value.opacity })}
            value={{ hex: settings.backgroundColor, opacity: settings.backgroundOpacity }}
          />
        </>
      ) : null}
    </div>
  )
}
