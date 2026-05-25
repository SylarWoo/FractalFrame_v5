import { OpenableSelect } from '../../../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineSwatch } from '../../../settings/SettingsSwatches'
import type { RsiIndicatorSettings, RsiPrecision, RsiSmoothingType, RsiSource } from '../../indicatorPersistence'
import { CheckControl, InfoBadge, NumberBox, precisionOptions, rsiSmoothingOptions, rsiSourceOptions, updateSettings } from './indicatorPanelShared'
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
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">RSI 设置</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            RSI 天数长度 <InfoBadge title="Wilder RSI 的 lookback 周期，默认 14。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={2} onChange={(length) => patch({ length })} value={settings.length} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            来源 <InfoBadge title="用于逐根 K 线取价格序列，再计算 RSI。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="RSI source"
              onChange={(value) => patch({ source: value as RsiSource })}
              options={rsiSourceOptions}
              value={settings.source}
            />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            计算背离 <InfoBadge title="检测价格与 RSI 背离形态；当前先保存面板偏好。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--check">
            <input checked={settings.calculateDivergence} onChange={(event) => patch({ calculateDivergence: event.target.checked })} type="checkbox" />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            标记 <InfoBadge title="控制十字光标交点标记显示。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--check">
            <input checked={settings.crosshairMarkers} onChange={(event) => patch({ crosshairMarkers: event.target.checked })} type="checkbox" />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">平滑</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            类型 <InfoBadge title="与 TradingView RSI 输入里的平滑类型对齐。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="RSI smoothing type"
              onChange={(value) => patch({ smoothingType: value as RsiSmoothingType })}
              options={rsiSmoothingOptions}
              value={settings.smoothingType}
            />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            长度 <InfoBadge title="平滑均线长度。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={2} onChange={(smoothingLength) => patch({ smoothingLength })} value={settings.smoothingLength} />
          </span>
        </label>
      </section>
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
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.rsiVisible} label="RSI" onChange={(rsiVisible) => patch({ rsiVisible })} />
        <SettingsLineSwatch
          color={settings.rsiColor}
          lineStyle={settings.rsiLineStyle}
          onChange={(value) => patch({
            rsiColor: value.hex,
            rsiLineStyle: value.lineStyle,
            rsiLineWidth: value.thickness,
            rsiOpacity: value.opacity,
          })}
          thickness={settings.rsiLineWidth}
          value={{
            hex: settings.rsiColor,
            lineStyle: settings.rsiLineStyle,
            opacity: settings.rsiOpacity,
            thickness: settings.rsiLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.rsiMaVisible} label="RSI-based MA" onChange={(rsiMaVisible) => patch({ rsiMaVisible })} />
        <SettingsLineSwatch
          color={settings.rsiMaColor}
          lineStyle={settings.rsiMaLineStyle}
          onChange={(value) => patch({
            rsiMaColor: value.hex,
            rsiMaLineStyle: value.lineStyle,
            rsiMaLineWidth: value.thickness,
            rsiMaOpacity: value.opacity,
          })}
          thickness={settings.rsiMaLineWidth}
          value={{
            hex: settings.rsiMaColor,
            lineStyle: settings.rsiMaLineStyle,
            opacity: settings.rsiMaOpacity,
            thickness: settings.rsiMaLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upperBandVisible} label="RSI Upper Band" onChange={(upperBandVisible) => patch({ upperBandVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upperBandColor}
            lineStyle={settings.upperBandLineStyle}
            onChange={(value) => patch({
              upperBandColor: value.hex,
              upperBandLineStyle: value.lineStyle,
              upperBandLineWidth: value.thickness,
              upperBandOpacity: value.opacity,
            })}
            thickness={settings.upperBandLineWidth}
            value={{
              hex: settings.upperBandColor,
              lineStyle: settings.upperBandLineStyle,
              opacity: settings.upperBandOpacity,
              thickness: settings.upperBandLineWidth,
            }}
          />
          <NumberBox max={100} min={0} onChange={(upperBand) => patch({ upperBand })} value={settings.upperBand} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.middleBandVisible} label="RSI Middle Band" onChange={(middleBandVisible) => patch({ middleBandVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.middleBandColor}
            lineStyle={settings.middleBandLineStyle}
            onChange={(value) => patch({
              middleBandColor: value.hex,
              middleBandLineStyle: value.lineStyle,
              middleBandLineWidth: value.thickness,
              middleBandOpacity: value.opacity,
            })}
            thickness={settings.middleBandLineWidth}
            value={{
              hex: settings.middleBandColor,
              lineStyle: settings.middleBandLineStyle,
              opacity: settings.middleBandOpacity,
              thickness: settings.middleBandLineWidth,
            }}
          />
          <NumberBox max={100} min={0} onChange={(middleBand) => patch({ middleBand })} value={settings.middleBand} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.lowerBandVisible} label="RSI Lower Band" onChange={(lowerBandVisible) => patch({ lowerBandVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.lowerBandColor}
            lineStyle={settings.lowerBandLineStyle}
            onChange={(value) => patch({
              lowerBandColor: value.hex,
              lowerBandLineStyle: value.lineStyle,
              lowerBandLineWidth: value.thickness,
              lowerBandOpacity: value.opacity,
            })}
            thickness={settings.lowerBandLineWidth}
            value={{
              hex: settings.lowerBandColor,
              lineStyle: settings.lowerBandLineStyle,
              opacity: settings.lowerBandOpacity,
              thickness: settings.lowerBandLineWidth,
            }}
          />
          <NumberBox max={100} min={0} onChange={(lowerBand) => patch({ lowerBand })} value={settings.lowerBand} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundFillVisible} label="RSI Background Fill" onChange={(backgroundFillVisible) => patch({ backgroundFillVisible })} />
        <SettingsColorSwatch
          checkerboard
          onChange={(value) => patch({ backgroundFillColor: value.hex, backgroundFillOpacity: value.opacity })}
          value={{ hex: settings.backgroundFillColor, opacity: settings.backgroundFillOpacity }}
        />
      </div>
      <h3 className="ff-indicators-style-panel-v1__subhead">输出值</h3>
      <label className="ff-indicators-input-panel-v1__row">
        <span className="ff-indicators-input-panel-v1__label">精确度</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect
            ariaLabel="RSI precision"
            onChange={(value) => patch({ precision: value as RsiPrecision })}
            options={precisionOptions}
            value={settings.precision}
          />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label="价格坐标上的标签" onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label="状态行中的值" onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
    </div>
  )
}
