import { OpenableSelect } from '../../../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineSwatch } from '../../../settings/SettingsSwatches'
import type { RsiPrecision, VolIndicatorSettings } from '../../indicatorPersistence'
import { CheckControl, InfoBadge, NumberBox, precisionOptions } from './indicatorPanelShared'

export function VolInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VolIndicatorSettings) => void
  settings: VolIndicatorSettings
}) {
  const patch = (next: Partial<VolIndicatorSettings>) => onSettingsChange({ ...settings, ...next })

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-vol-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            MA 长度 <InfoBadge title="成交量均线长度，TradingView 默认 20。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(maLength) => patch({ maLength })} value={settings.maLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            K 线颜色基于前一收盘价 <InfoBadge title="成交量柱颜色是否基于当前收盘价与前一根收盘价比较。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--check">
            <input checked={settings.colorBasedOnPreviousClose} onChange={(event) => patch({ colorBasedOnPreviousClose: event.target.checked })} type="checkbox" />
          </span>
        </label>
      </section>
    </div>
  )
}

export function VolStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VolIndicatorSettings) => void
  settings: VolIndicatorSettings
}) {
  const patch = (next: Partial<VolIndicatorSettings>) => onSettingsChange({ ...settings, ...next })

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-vol-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.volumeChecked} label="成交量" onChange={(volumeChecked) => patch({ volumeChecked })} />
      </div>
      <div className="ff-indicators-style-row-v1">
        <span className="ff-indicators-input-panel-v1__tv-style-row-label">增长</span>
        <SettingsColorSwatch
          checkerboard
          color={settings.volumeUpColor}
          onChange={(value) => patch({ volumeUpColor: value.hex, volumeUpOpacity: value.opacity })}
          value={{ hex: settings.volumeUpColor, opacity: settings.volumeUpOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <span className="ff-indicators-input-panel-v1__tv-style-row-label">下降</span>
        <SettingsColorSwatch
          checkerboard
          color={settings.volumeDownColor}
          onChange={(value) => patch({ volumeDownColor: value.hex, volumeDownOpacity: value.opacity })}
          value={{ hex: settings.volumeDownColor, opacity: settings.volumeDownOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.maChecked} label="Volume MA" onChange={(maChecked) => patch({ maChecked })} />
        <SettingsLineSwatch
          color={settings.maColor}
          lineStyle={settings.maLineStyle}
          onChange={(value) => patch({
            maColor: value.hex,
            maLineStyle: value.lineStyle,
            maLineWidth: value.thickness,
            maOpacity: value.opacity,
          })}
          thickness={settings.maLineWidth}
          value={{
            hex: settings.maColor,
            lineStyle: settings.maLineStyle,
            opacity: settings.maOpacity,
            thickness: settings.maLineWidth,
          }}
        />
      </div>
      <h3 className="ff-indicators-style-panel-v1__subhead">输出值</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-vol-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">精确度</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect
            ariaLabel="Vol precision"
            onChange={(value) => patch({ precision: value as RsiPrecision })}
            options={precisionOptions}
            value={settings.precision}
          />
        </span>
      </label>
      <CheckControl checked={settings.labelsOnPriceScale} label="价格坐标上的标签" onChange={(labelsOnPriceScale) => patch({ labelsOnPriceScale })} />
      <CheckControl checked={settings.valuesInStatusLine} label="状态行中的值" onChange={(valuesInStatusLine) => patch({ valuesInStatusLine })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">输入值</h3>
      <CheckControl checked={settings.inputsInStatusLine} label="状态行中的输入" onChange={(inputsInStatusLine) => patch({ inputsInStatusLine })} />
    </div>
  )
}
