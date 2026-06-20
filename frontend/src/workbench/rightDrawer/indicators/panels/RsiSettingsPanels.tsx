import type { RsiIndicatorSettings, RsiSmoothingType, RsiSource } from '../../indicatorPersistence'
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
import { rsiSmoothingOptions, rsiSourceOptions } from './indicatorPanelOptions'
import { updateSettings } from './indicatorPanelShared'

export function RsiInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  settings: RsiIndicatorSettings
}) {
  const patch = (next: Partial<RsiIndicatorSettings>) => onSettingsChange(updateSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-rsi-panel-v1" role="tabpanel">
      <IndicatorSection title="RSI 设置">
        <IndicatorNumberRow
          label={<>RSI 天数长度 <InfoBadge title="Wilder RSI 的 lookback 周期，默认 14。" /></>}
          min={2}
          onChange={(length) => patch({ length })}
          value={settings.length}
        />
        <IndicatorSelectRow
          ariaLabel="RSI source"
          label={<>来源 <InfoBadge title="用于逐根 K 线取价格序列，再计算 RSI。" /></>}
          onChange={(value) => patch({ source: value as RsiSource })}
          options={rsiSourceOptions}
          value={settings.source}
        />
        <IndicatorCheckboxRow
          checked={settings.calculateDivergence}
          label={<>计算背离 <InfoBadge title="检测价格与 RSI 背离形态；当前先保存面板偏好。" /></>}
          onChange={(calculateDivergence) => patch({ calculateDivergence })}
        />
        <IndicatorCheckboxRow
          checked={settings.crosshairMarkers}
          label={<>标记 <InfoBadge title="控制十字光标交点标记显示。" /></>}
          onChange={(crosshairMarkers) => patch({ crosshairMarkers })}
        />
      </IndicatorSection>
      <IndicatorSection title="平滑">
        <IndicatorSelectRow
          ariaLabel="RSI smoothing type"
          label={<>类型 <InfoBadge title="与 TradingView RSI 输入里的平滑类型对齐。" /></>}
          onChange={(value) => patch({ smoothingType: value as RsiSmoothingType })}
          options={rsiSmoothingOptions}
          value={settings.smoothingType}
        />
        <IndicatorNumberRow
          label={<>长度 <InfoBadge title="平滑均线长度。" /></>}
          min={2}
          onChange={(smoothingLength) => patch({ smoothingLength })}
          value={settings.smoothingLength}
        />
      </IndicatorSection>
    </div>
  )
}

export function RsiStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  settings: RsiIndicatorSettings
}) {
  const patch = (next: Partial<RsiIndicatorSettings>) => onSettingsChange(updateSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-rsi-style-panel-v1" role="tabpanel">
      <IndicatorLineStyleRow
        checked={settings.rsiVisible}
        label="RSI"
        onCheckedChange={(rsiVisible) => patch({ rsiVisible })}
        onLineChange={(value) => patch({
          rsiColor: value.hex,
          rsiLineStyle: value.lineStyle,
          rsiLineWidth: value.thickness,
          rsiOpacity: value.opacity,
        })}
        value={{ hex: settings.rsiColor, lineStyle: settings.rsiLineStyle, opacity: settings.rsiOpacity, thickness: settings.rsiLineWidth }}
      />
      <IndicatorLineStyleRow
        checked={settings.rsiMaVisible}
        label="RSI-based MA"
        onCheckedChange={(rsiMaVisible) => patch({ rsiMaVisible })}
        onLineChange={(value) => patch({
          rsiMaColor: value.hex,
          rsiMaLineStyle: value.lineStyle,
          rsiMaLineWidth: value.thickness,
          rsiMaOpacity: value.opacity,
        })}
        value={{ hex: settings.rsiMaColor, lineStyle: settings.rsiMaLineStyle, opacity: settings.rsiMaOpacity, thickness: settings.rsiMaLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.upperBandVisible}
        label="RSI Upper Band"
        max={100}
        min={0}
        numericValue={settings.upperBand}
        onCheckedChange={(upperBandVisible) => patch({ upperBandVisible })}
        onLineChange={(value) => patch({
          upperBandColor: value.hex,
          upperBandLineStyle: value.lineStyle,
          upperBandLineWidth: value.thickness,
          upperBandOpacity: value.opacity,
        })}
        onValueChange={(upperBand) => patch({ upperBand })}
        value={{ hex: settings.upperBandColor, lineStyle: settings.upperBandLineStyle, opacity: settings.upperBandOpacity, thickness: settings.upperBandLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.middleBandVisible}
        label="RSI Middle Band"
        max={100}
        min={0}
        numericValue={settings.middleBand}
        onCheckedChange={(middleBandVisible) => patch({ middleBandVisible })}
        onLineChange={(value) => patch({
          middleBandColor: value.hex,
          middleBandLineStyle: value.lineStyle,
          middleBandLineWidth: value.thickness,
          middleBandOpacity: value.opacity,
        })}
        onValueChange={(middleBand) => patch({ middleBand })}
        value={{ hex: settings.middleBandColor, lineStyle: settings.middleBandLineStyle, opacity: settings.middleBandOpacity, thickness: settings.middleBandLineWidth }}
      />
      <IndicatorLineValueStyleRow
        checked={settings.lowerBandVisible}
        label="RSI Lower Band"
        max={100}
        min={0}
        numericValue={settings.lowerBand}
        onCheckedChange={(lowerBandVisible) => patch({ lowerBandVisible })}
        onLineChange={(value) => patch({
          lowerBandColor: value.hex,
          lowerBandLineStyle: value.lineStyle,
          lowerBandLineWidth: value.thickness,
          lowerBandOpacity: value.opacity,
        })}
        onValueChange={(lowerBand) => patch({ lowerBand })}
        value={{ hex: settings.lowerBandColor, lineStyle: settings.lowerBandLineStyle, opacity: settings.lowerBandOpacity, thickness: settings.lowerBandLineWidth }}
      />
      <IndicatorColorStyleRow
        checked={settings.backgroundFillVisible}
        checkerboard
        label="RSI Background Fill"
        onCheckedChange={(backgroundFillVisible) => patch({ backgroundFillVisible })}
        onColorChange={(value) => patch({ backgroundFillColor: value.hex, backgroundFillOpacity: value.opacity })}
        value={{ hex: settings.backgroundFillColor, opacity: settings.backgroundFillOpacity }}
      />
    </div>
  )
}
