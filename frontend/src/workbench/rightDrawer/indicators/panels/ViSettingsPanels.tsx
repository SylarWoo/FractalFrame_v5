import type { ViIndicatorSettings, VwapTimeframe } from '../../indicatorPersistence'
import {
  IndicatorCheckboxRow,
  IndicatorLineStyleRow,
  IndicatorNumberRow,
  IndicatorSection,
  IndicatorSelectRow,
  InfoBadge,
} from './IndicatorSettingControls'
import { vwapTimeframeOptions } from './indicatorPanelOptions'
import { updateViSettings } from './indicatorPanelShared'

export function ViInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: ViIndicatorSettings) => void
  settings: ViIndicatorSettings
}) {
  const patch = (next: Partial<ViIndicatorSettings>) => onSettingsChange(updateViSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-vi-panel-v1" role="tabpanel">
      <IndicatorSection>
        <IndicatorNumberRow label="长度" min={1} onChange={(length) => patch({ length })} value={settings.length} />
      </IndicatorSection>
      <IndicatorSection title="Calculation">
        <IndicatorSelectRow
          ariaLabel="VI timeframe"
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

export function ViStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: ViIndicatorSettings) => void
  settings: ViIndicatorSettings
}) {
  const patch = (next: Partial<ViIndicatorSettings>) => onSettingsChange(updateViSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-vi-style-panel-v1" role="tabpanel">
      <IndicatorLineStyleRow
        checked={settings.plusVisible}
        label="VI +"
        onCheckedChange={(plusVisible) => patch({ plusVisible })}
        onLineChange={(value) => patch({ plusColor: value.hex, plusLineStyle: value.lineStyle, plusLineWidth: value.thickness, plusOpacity: value.opacity })}
        value={{ hex: settings.plusColor, lineStyle: settings.plusLineStyle, opacity: settings.plusOpacity, thickness: settings.plusLineWidth }}
      />
      <IndicatorLineStyleRow
        checked={settings.minusVisible}
        label="VI -"
        onCheckedChange={(minusVisible) => patch({ minusVisible })}
        onLineChange={(value) => patch({ minusColor: value.hex, minusLineStyle: value.lineStyle, minusLineWidth: value.thickness, minusOpacity: value.opacity })}
        value={{ hex: settings.minusColor, lineStyle: settings.minusLineStyle, opacity: settings.minusOpacity, thickness: settings.minusLineWidth }}
      />
    </div>
  )
}
