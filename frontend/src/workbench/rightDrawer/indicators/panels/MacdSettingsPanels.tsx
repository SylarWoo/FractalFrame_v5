import { SettingsColorSwatch } from '../../../settings/SettingsSwatches'
import type { MacdIndicatorSettings, MacdMaType, RsiSource, VwapTimeframe } from '../../indicatorPersistence'
import {
  CheckControl,
  IndicatorCheckboxRow,
  IndicatorLineStyleRow,
  IndicatorLineValueStyleRow,
  IndicatorNumberRow,
  IndicatorSection,
  IndicatorSelectRow,
  InfoBadge,
} from './IndicatorSettingControls'
import { macdMaTypeOptions, rsiSourceOptions, vwapTimeframeOptions } from './indicatorPanelOptions'
import { updateMacdSettings } from './indicatorPanelShared'

export function MacdInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MacdIndicatorSettings) => void
  settings: MacdIndicatorSettings
}) {
  const patch = (next: Partial<MacdIndicatorSettings>) => onSettingsChange(updateMacdSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-macd-panel-v1" role="tabpanel">
      <IndicatorSection>
        <IndicatorSelectRow
          ariaLabel="MACD source"
          label="来源"
          onChange={(value) => patch({ source: value as RsiSource })}
          options={rsiSourceOptions}
          value={settings.source}
        />
        <IndicatorNumberRow label="快线长度" min={1} onChange={(fastLength) => patch({ fastLength })} value={settings.fastLength} />
        <IndicatorNumberRow label="慢线长度" min={1} onChange={(slowLength) => patch({ slowLength })} value={settings.slowLength} />
        <IndicatorNumberRow label="Signal length" min={1} onChange={(signalLength) => patch({ signalLength })} value={settings.signalLength} />
        <IndicatorSelectRow
          ariaLabel="MACD oscillator MA type"
          label="Oscillator MA type"
          onChange={(value) => patch({ oscillatorMaType: value as MacdMaType })}
          options={macdMaTypeOptions}
          value={settings.oscillatorMaType}
        />
        <IndicatorSelectRow
          ariaLabel="MACD signal MA type"
          label="Signal MA type"
          onChange={(value) => patch({ signalMaType: value as MacdMaType })}
          options={macdMaTypeOptions}
          value={settings.signalMaType}
        />
      </IndicatorSection>
      <IndicatorSection title="Calculation">
        <IndicatorSelectRow
          ariaLabel="MACD timeframe"
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

export function MacdStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MacdIndicatorSettings) => void
  settings: MacdIndicatorSettings
}) {
  const patch = (next: Partial<MacdIndicatorSettings>) => onSettingsChange(updateMacdSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-macd-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.histogramVisible} label="Histogram" onChange={(histogramVisible) => patch({ histogramVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsColorSwatch color={settings.histogramColor0} onChange={(value) => patch({ histogramColor0: value.hex, histogramColor0Opacity: value.opacity })} value={{ hex: settings.histogramColor0, opacity: settings.histogramColor0Opacity }} />
          <SettingsColorSwatch color={settings.histogramColor1} onChange={(value) => patch({ histogramColor1: value.hex, histogramColor1Opacity: value.opacity })} value={{ hex: settings.histogramColor1, opacity: settings.histogramColor1Opacity }} />
          <SettingsColorSwatch color={settings.histogramColor2} onChange={(value) => patch({ histogramColor2: value.hex, histogramColor2Opacity: value.opacity })} value={{ hex: settings.histogramColor2, opacity: settings.histogramColor2Opacity }} />
          <SettingsColorSwatch color={settings.histogramColor3} onChange={(value) => patch({ histogramColor3: value.hex, histogramColor3Opacity: value.opacity })} value={{ hex: settings.histogramColor3, opacity: settings.histogramColor3Opacity }} />
        </span>
      </div>
      <IndicatorLineStyleRow
        checked={settings.macdVisible}
        label="MACD"
        onCheckedChange={(macdVisible) => patch({ macdVisible })}
        onLineChange={(value) => patch({ macdColor: value.hex, macdLineStyle: value.lineStyle, macdLineWidth: value.thickness, macdOpacity: value.opacity })}
        value={{ hex: settings.macdColor, lineStyle: settings.macdLineStyle, opacity: settings.macdOpacity, thickness: settings.macdLineWidth }}
      />
      <IndicatorLineStyleRow
        checked={settings.signalVisible}
        label="Signal line"
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
    </div>
  )
}
