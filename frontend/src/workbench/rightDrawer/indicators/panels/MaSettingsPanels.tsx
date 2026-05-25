import { OpenableSelect } from '../../../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineWeightSwatch } from '../../../settings/SettingsSwatches'
import type { MaIndicatorSettings, MaMarkerMode, MaSource, MaType, RsiPrecision } from '../../indicatorPersistence'
import { CheckControl, NumberBox, maMarkerModeOptions, maSourceOptions, maTypeOptions, precisionOptions, updateMaSettings } from './indicatorPanelShared'
export function MaInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MaIndicatorSettings) => void
  settings: MaIndicatorSettings
}) {
  const patch = (next: Partial<MaIndicatorSettings>) => onSettingsChange(updateMaSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-ma-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">MA</h3>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-ma-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">类型</span>
          <span className="ff-indicators-input-panel-v1__control ff-indicators-ma-panel-v1__type-select">
            <OpenableSelect
              ariaLabel="MA type"
              onChange={(value) => patch({ type: value as MaType })}
              options={maTypeOptions}
              value={settings.type}
            />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-ma-panel-v1__row ff-indicators-ma-panel-v1__row--double">
          <span className="ff-indicators-input-panel-v1__label">长度</span>
          <span className="ff-indicators-ma-panel-v1__inline-controls">
            <span className="ff-indicators-input-panel-v1__control">
              <NumberBox min={1} onChange={(length) => patch({ length })} value={settings.length} />
            </span>
            <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
              <OpenableSelect
                ariaLabel="MA source"
                onChange={(value) => patch({ source: value as MaSource })}
                options={maSourceOptions}
                value={settings.source}
              />
            </span>
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">Color</h3>
        <div className="ff-indicators-ma-panel-v1__colors">
          {settings.colors.map((color, index) => (
            <SettingsColorSwatch
              color={color}
              key={index}
              onChange={(value) => {
                const nextColors = [...settings.colors]
                nextColors[index] = value.hex
                patch({ colors: nextColors })
              }}
              value={{ hex: color, opacity: 1 }}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

export function MaStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: MaIndicatorSettings) => void
  settings: MaIndicatorSettings
}) {
  const patch = (next: Partial<MaIndicatorSettings>) => onSettingsChange(updateMaSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-ma-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.maLineVisible} label="SMA-based MA" onChange={(maLineVisible) => patch({ maLineVisible })} />
        <SettingsLineWeightSwatch
          color={settings.colors[0] ?? settings.maLineColor}
          onChange={(value) => patch({
            maLineOpacity: value.opacity,
            maLineWidth: value.thickness,
          })}
          thickness={settings.maLineWidth}
          value={{
            opacity: settings.maLineOpacity,
            thickness: settings.maLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.maFadedVisible} label="SMA-based MA" onChange={(maFadedVisible) => patch({ maFadedVisible })} />
        <SettingsLineWeightSwatch
          color={settings.colors[0] ?? settings.maFadedColor}
          onChange={(value) => patch({
            maFadedOpacity: value.opacity,
            maFadedLineWidth: value.thickness,
          })}
          thickness={settings.maFadedLineWidth}
          value={{
            opacity: settings.maFadedOpacity,
            thickness: settings.maFadedLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-ma-style-panel-v1__divider" />
      <div className="ff-indicators-style-row-v1 ff-indicators-ma-style-panel-v1__marker-row">
        <CheckControl checked={settings.upVisible} label="Up" onChange={(upVisible) => patch({ upVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsColorSwatch
            color={settings.upColor}
            onChange={(value) => patch({ upColor: value.hex })}
            value={{ hex: settings.upColor, opacity: 1 }}
          />
          <span className="ff-indicators-input-panel-v1__control ff-indicators-ma-style-panel-v1__marker-select">
            <OpenableSelect
              ariaLabel="MA up marker mode"
              onChange={(value) => patch({ upMarkerMode: value as MaMarkerMode })}
              options={maMarkerModeOptions}
              value={settings.upMarkerMode}
            />
          </span>
        </span>
      </div>
      <div className="ff-indicators-style-row-v1 ff-indicators-ma-style-panel-v1__marker-row">
        <CheckControl checked={settings.dnVisible} label="Dn" onChange={(dnVisible) => patch({ dnVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsColorSwatch
            color={settings.dnColor}
            onChange={(value) => patch({ dnColor: value.hex })}
            value={{ hex: settings.dnColor, opacity: 1 }}
          />
          <span className="ff-indicators-input-panel-v1__control ff-indicators-ma-style-panel-v1__marker-select">
            <OpenableSelect
              ariaLabel="MA down marker mode"
              onChange={(value) => patch({ dnMarkerMode: value as MaMarkerMode })}
              options={maMarkerModeOptions}
              value={settings.dnMarkerMode}
            />
          </span>
        </span>
      </div>
      <h3 className="ff-indicators-style-panel-v1__subhead">输出值</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-ma-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">精确度</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect
            ariaLabel="MA precision"
            onChange={(value) => patch({ precision: value as RsiPrecision })}
            options={precisionOptions}
            value={settings.precision}
          />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label="价格坐标上的标签" onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label="状态行中的值" onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">输入值</h3>
      <CheckControl checked={settings.inputStatusLineVisible} label="状态行中的输入" onChange={(inputStatusLineVisible) => patch({ inputStatusLineVisible })} />
    </div>
  )
}
