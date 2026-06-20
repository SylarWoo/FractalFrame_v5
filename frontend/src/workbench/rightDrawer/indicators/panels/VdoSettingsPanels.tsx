import { SettingsColorSwatch, SettingsLineSwatch } from '../../../settings/SettingsSwatches'
import type { VdoIndicatorSettings } from '../../indicatorPersistence'
import { CheckControl, NumberBox } from './IndicatorSettingControls'
import { updateVdoSettings } from './indicatorPanelShared'

export function VdoInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VdoIndicatorSettings) => void
  settings: VdoIndicatorSettings
}) {
  const patch = (next: Partial<VdoIndicatorSettings>) => onSettingsChange(updateVdoSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-vdo-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">VI 长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(length) => patch({ length })} value={settings.length} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">EMA smoothing</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={0} onChange={(emaSmoothing) => patch({ emaSmoothing })} value={settings.emaSmoothing} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">VDO-base MA</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(vdoMaLength) => patch({ vdoMaLength })} value={settings.vdoMaLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">VDO-base2 MA</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(vdoMa2Length) => patch({ vdoMa2Length })} value={settings.vdoMa2Length} />
          </span>
        </label>
      </section>
    </div>
  )
}

export function VdoStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VdoIndicatorSettings) => void
  settings: VdoIndicatorSettings
}) {
  const patch = (next: Partial<VdoIndicatorSettings>) => onSettingsChange(updateVdoSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-vdo-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.dpoVisible} label="VDO" onChange={(dpoVisible) => patch({ dpoVisible })} />
        <SettingsLineSwatch
          color={settings.dpoColor}
          lineStyle={settings.dpoLineStyle}
          onChange={(value) => patch({
            dpoColor: value.hex,
            dpoLineStyle: value.lineStyle,
            dpoLineWidth: value.thickness,
            dpoOpacity: value.opacity,
          })}
          thickness={settings.dpoLineWidth}
          value={{
            hex: settings.dpoColor,
            lineStyle: settings.dpoLineStyle,
            opacity: settings.dpoOpacity,
            thickness: settings.dpoLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.vdoMaVisible} label="VDO-base MA" onChange={(vdoMaVisible) => patch({ vdoMaVisible })} />
        <SettingsLineSwatch
          color={settings.vdoMaColor}
          lineStyle={settings.vdoMaLineStyle}
          onChange={(value) => patch({
            vdoMaColor: value.hex,
            vdoMaLineStyle: value.lineStyle,
            vdoMaLineWidth: value.thickness,
            vdoMaOpacity: value.opacity,
          })}
          thickness={settings.vdoMaLineWidth}
          value={{
            hex: settings.vdoMaColor,
            lineStyle: settings.vdoMaLineStyle,
            opacity: settings.vdoMaOpacity,
            thickness: settings.vdoMaLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.vdoMa2Visible} label="VDO-base2 MA" onChange={(vdoMa2Visible) => patch({ vdoMa2Visible })} />
        <SettingsLineSwatch
          color={settings.vdoMa2Color}
          lineStyle={settings.vdoMa2LineStyle}
          onChange={(value) => patch({
            vdoMa2Color: value.hex,
            vdoMa2LineStyle: value.lineStyle,
            vdoMa2LineWidth: value.thickness,
            vdoMa2Opacity: value.opacity,
          })}
          thickness={settings.vdoMa2LineWidth}
          value={{
            hex: settings.vdoMa2Color,
            lineStyle: settings.vdoMa2LineStyle,
            opacity: settings.vdoMa2Opacity,
            thickness: settings.vdoMa2LineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.zeroLineVisible} label="Zero line" onChange={(zeroLineVisible) => patch({ zeroLineVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.zeroLineColor}
            lineStyle={settings.zeroLineStyle}
            onChange={(value) => patch({
              zeroLineColor: value.hex,
              zeroLineStyle: value.lineStyle,
              zeroLineWidth: value.thickness,
              zeroLineOpacity: value.opacity,
            })}
            thickness={settings.zeroLineWidth}
            value={{
              hex: settings.zeroLineColor,
              lineStyle: settings.zeroLineStyle,
              opacity: settings.zeroLineOpacity,
              thickness: settings.zeroLineWidth,
            }}
          />
          <NumberBox max={0} min={0} onChange={() => undefined} value={0} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upLineVisible} label="Upper Band" onChange={(upLineVisible) => patch({ upLineVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upLineColor}
            lineStyle={settings.upLineStyle}
            onChange={(value) => patch({
              upLineColor: value.hex,
              upLineStyle: value.lineStyle,
              upLineWidth: value.thickness,
              upLineOpacity: value.opacity,
            })}
            thickness={settings.upLineWidth}
            value={{
              hex: settings.upLineColor,
              lineStyle: settings.upLineStyle,
              opacity: settings.upLineOpacity,
              thickness: settings.upLineWidth,
            }}
          />
          <NumberBox min={-500} onChange={(upLineValue) => patch({ upLineValue })} step={0.001} value={settings.upLineValue} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upLine2Visible} label="Upper Band 2 level" onChange={(upLine2Visible) => patch({ upLine2Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upLine2Color}
            lineStyle={settings.upLine2Style}
            onChange={(value) => patch({
              upLine2Color: value.hex,
              upLine2Style: value.lineStyle,
              upLine2Width: value.thickness,
              upLine2Opacity: value.opacity,
            })}
            thickness={settings.upLine2Width}
            value={{
              hex: settings.upLine2Color,
              lineStyle: settings.upLine2Style,
              opacity: settings.upLine2Opacity,
              thickness: settings.upLine2Width,
            }}
          />
          <NumberBox min={-500} onChange={(upLine2Value) => patch({ upLine2Value })} step={0.001} value={settings.upLine2Value} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upLine3Visible} label="Upper Band 3 level" onChange={(upLine3Visible) => patch({ upLine3Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upLine3Color}
            lineStyle={settings.upLine3Style}
            onChange={(value) => patch({
              upLine3Color: value.hex,
              upLine3Style: value.lineStyle,
              upLine3Width: value.thickness,
              upLine3Opacity: value.opacity,
            })}
            thickness={settings.upLine3Width}
            value={{
              hex: settings.upLine3Color,
              lineStyle: settings.upLine3Style,
              opacity: settings.upLine3Opacity,
              thickness: settings.upLine3Width,
            }}
          />
          <NumberBox min={-500} onChange={(upLine3Value) => patch({ upLine3Value })} step={0.001} value={settings.upLine3Value} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.downLineVisible} label="Lower Band" onChange={(downLineVisible) => patch({ downLineVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.downLineColor}
            lineStyle={settings.downLineStyle}
            onChange={(value) => patch({
              downLineColor: value.hex,
              downLineStyle: value.lineStyle,
              downLineWidth: value.thickness,
              downLineOpacity: value.opacity,
            })}
            thickness={settings.downLineWidth}
            value={{
              hex: settings.downLineColor,
              lineStyle: settings.downLineStyle,
              opacity: settings.downLineOpacity,
              thickness: settings.downLineWidth,
            }}
          />
          <NumberBox min={-500} onChange={(downLineValue) => patch({ downLineValue })} step={0.001} value={settings.downLineValue} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.downLine2Visible} label="Lower Band 2 level" onChange={(downLine2Visible) => patch({ downLine2Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.downLine2Color}
            lineStyle={settings.downLine2Style}
            onChange={(value) => patch({
              downLine2Color: value.hex,
              downLine2Style: value.lineStyle,
              downLine2Width: value.thickness,
              downLine2Opacity: value.opacity,
            })}
            thickness={settings.downLine2Width}
            value={{
              hex: settings.downLine2Color,
              lineStyle: settings.downLine2Style,
              opacity: settings.downLine2Opacity,
              thickness: settings.downLine2Width,
            }}
          />
          <NumberBox min={-500} onChange={(downLine2Value) => patch({ downLine2Value })} step={0.001} value={settings.downLine2Value} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.downLine3Visible} label="Lower Band 3 level" onChange={(downLine3Visible) => patch({ downLine3Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.downLine3Color}
            lineStyle={settings.downLine3Style}
            onChange={(value) => patch({
              downLine3Color: value.hex,
              downLine3Style: value.lineStyle,
              downLine3Width: value.thickness,
              downLine3Opacity: value.opacity,
            })}
            thickness={settings.downLine3Width}
            value={{
              hex: settings.downLine3Color,
              lineStyle: settings.downLine3Style,
              opacity: settings.downLine3Opacity,
              thickness: settings.downLine3Width,
            }}
          />
          <NumberBox min={-500} onChange={(downLine3Value) => patch({ downLine3Value })} step={0.001} value={settings.downLine3Value} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundVisible} label="背景" onChange={(backgroundVisible) => patch({ backgroundVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundColor}
          onChange={(value) => patch({ backgroundColor: value.hex, backgroundOpacity: value.opacity })}
          value={{ hex: settings.backgroundColor, opacity: settings.backgroundOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundUpperVisible} label="背景 Upper" onChange={(backgroundUpperVisible) => patch({ backgroundUpperVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundUpperColor}
          onChange={(value) => patch({ backgroundUpperColor: value.hex, backgroundUpperOpacity: value.opacity })}
          value={{ hex: settings.backgroundUpperColor, opacity: settings.backgroundUpperOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundUpper2Visible} label="背景 Upper 2" onChange={(backgroundUpper2Visible) => patch({ backgroundUpper2Visible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundUpper2Color}
          onChange={(value) => patch({ backgroundUpper2Color: value.hex, backgroundUpper2Opacity: value.opacity })}
          value={{ hex: settings.backgroundUpper2Color, opacity: settings.backgroundUpper2Opacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundLowerVisible} label="背景 Lower" onChange={(backgroundLowerVisible) => patch({ backgroundLowerVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundLowerColor}
          onChange={(value) => patch({ backgroundLowerColor: value.hex, backgroundLowerOpacity: value.opacity })}
          value={{ hex: settings.backgroundLowerColor, opacity: settings.backgroundLowerOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundLower2Visible} label="背景 Lower 2" onChange={(backgroundLower2Visible) => patch({ backgroundLower2Visible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundLower2Color}
          onChange={(value) => patch({ backgroundLower2Color: value.hex, backgroundLower2Opacity: value.opacity })}
          value={{ hex: settings.backgroundLower2Color, opacity: settings.backgroundLower2Opacity }}
        />
      </div>
    </div>
  )
}
