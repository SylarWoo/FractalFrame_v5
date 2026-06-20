import { SettingsColorSwatch, SettingsLineSwatch } from '../../../settings/SettingsSwatches'
import type { StochIndicatorSettings } from '../../indicatorPersistence'
import { CheckControl, NumberBox } from './IndicatorSettingControls'
import { stochText } from './indicatorPanelOptions'
import { updateStochSettings } from './indicatorPanelShared'

export function StochInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: StochIndicatorSettings) => void
  settings: StochIndicatorSettings
}) {
  const patch = (next: Partial<StochIndicatorSettings>) => onSettingsChange(updateStochSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-stoch-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{stochText.settings}</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{stochText.kLength}</span>
          <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
            <NumberBox min={1} onChange={(length) => patch({ length })} value={settings.length} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{stochText.kSmoothing}</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(kSmoothing) => patch({ kSmoothing })} value={settings.kSmoothing} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{stochText.dSmoothing}</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(dSmoothing) => patch({ dSmoothing })} value={settings.dSmoothing} />
          </span>
        </label>
      </section>
    </div>
  )
}

export function StochStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: StochIndicatorSettings) => void
  settings: StochIndicatorSettings
}) {
  const patch = (next: Partial<StochIndicatorSettings>) => onSettingsChange(updateStochSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-stoch-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.kVisible} label={stochText.k} onChange={(kVisible) => patch({ kVisible })} />
        <SettingsLineSwatch
          color={settings.kColor}
          lineStyle={settings.kLineStyle}
          onChange={(value) => patch({ kColor: value.hex, kLineStyle: value.lineStyle, kLineWidth: value.thickness, kOpacity: value.opacity })}
          thickness={settings.kLineWidth}
          value={{ hex: settings.kColor, lineStyle: settings.kLineStyle, opacity: settings.kOpacity, thickness: settings.kLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.dVisible} label={stochText.d} onChange={(dVisible) => patch({ dVisible })} />
        <SettingsLineSwatch
          color={settings.dColor}
          lineStyle={settings.dLineStyle}
          onChange={(value) => patch({ dColor: value.hex, dLineStyle: value.lineStyle, dLineWidth: value.thickness, dOpacity: value.opacity })}
          thickness={settings.dLineWidth}
          value={{ hex: settings.dColor, lineStyle: settings.dLineStyle, opacity: settings.dOpacity, thickness: settings.dLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upperBandVisible} label={stochText.upperBand} onChange={(upperBandVisible) => patch({ upperBandVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upperBandColor}
            lineStyle={settings.upperBandLineStyle}
            onChange={(value) => patch({ upperBandColor: value.hex, upperBandLineStyle: value.lineStyle, upperBandLineWidth: value.thickness, upperBandOpacity: value.opacity })}
            thickness={settings.upperBandLineWidth}
            value={{ hex: settings.upperBandColor, lineStyle: settings.upperBandLineStyle, opacity: settings.upperBandOpacity, thickness: settings.upperBandLineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(upperBand) => patch({ upperBand })} value={settings.upperBand} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upperBand2Visible} label={stochText.upperBand2Level} onChange={(upperBand2Visible) => patch({ upperBand2Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upperBand2Color}
            lineStyle={settings.upperBand2LineStyle}
            onChange={(value) => patch({ upperBand2Color: value.hex, upperBand2LineStyle: value.lineStyle, upperBand2LineWidth: value.thickness, upperBand2Opacity: value.opacity })}
            thickness={settings.upperBand2LineWidth}
            value={{ hex: settings.upperBand2Color, lineStyle: settings.upperBand2LineStyle, opacity: settings.upperBand2Opacity, thickness: settings.upperBand2LineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(upperBand2) => patch({ upperBand2 })} value={settings.upperBand2} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.upperBand3Visible} label={stochText.upperBand3Level} onChange={(upperBand3Visible) => patch({ upperBand3Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.upperBand3Color}
            lineStyle={settings.upperBand3LineStyle}
            onChange={(value) => patch({ upperBand3Color: value.hex, upperBand3LineStyle: value.lineStyle, upperBand3LineWidth: value.thickness, upperBand3Opacity: value.opacity })}
            thickness={settings.upperBand3LineWidth}
            value={{ hex: settings.upperBand3Color, lineStyle: settings.upperBand3LineStyle, opacity: settings.upperBand3Opacity, thickness: settings.upperBand3LineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(upperBand3) => patch({ upperBand3 })} value={settings.upperBand3} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.lowerBandVisible} label={stochText.lowerBand} onChange={(lowerBandVisible) => patch({ lowerBandVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.lowerBandColor}
            lineStyle={settings.lowerBandLineStyle}
            onChange={(value) => patch({ lowerBandColor: value.hex, lowerBandLineStyle: value.lineStyle, lowerBandLineWidth: value.thickness, lowerBandOpacity: value.opacity })}
            thickness={settings.lowerBandLineWidth}
            value={{ hex: settings.lowerBandColor, lineStyle: settings.lowerBandLineStyle, opacity: settings.lowerBandOpacity, thickness: settings.lowerBandLineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(lowerBand) => patch({ lowerBand })} value={settings.lowerBand} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.lowerBand2Visible} label={stochText.lowerBand2Level} onChange={(lowerBand2Visible) => patch({ lowerBand2Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.lowerBand2Color}
            lineStyle={settings.lowerBand2LineStyle}
            onChange={(value) => patch({ lowerBand2Color: value.hex, lowerBand2LineStyle: value.lineStyle, lowerBand2LineWidth: value.thickness, lowerBand2Opacity: value.opacity })}
            thickness={settings.lowerBand2LineWidth}
            value={{ hex: settings.lowerBand2Color, lineStyle: settings.lowerBand2LineStyle, opacity: settings.lowerBand2Opacity, thickness: settings.lowerBand2LineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(lowerBand2) => patch({ lowerBand2 })} value={settings.lowerBand2} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.lowerBand3Visible} label={stochText.lowerBand3Level} onChange={(lowerBand3Visible) => patch({ lowerBand3Visible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.lowerBand3Color}
            lineStyle={settings.lowerBand3LineStyle}
            onChange={(value) => patch({ lowerBand3Color: value.hex, lowerBand3LineStyle: value.lineStyle, lowerBand3LineWidth: value.thickness, lowerBand3Opacity: value.opacity })}
            thickness={settings.lowerBand3LineWidth}
            value={{ hex: settings.lowerBand3Color, lineStyle: settings.lowerBand3LineStyle, opacity: settings.lowerBand3Opacity, thickness: settings.lowerBand3LineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(lowerBand3) => patch({ lowerBand3 })} value={settings.lowerBand3} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.middleBandVisible} label="Middle Band" onChange={(middleBandVisible) => patch({ middleBandVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.middleBandColor}
            lineStyle={settings.middleBandLineStyle}
            onChange={(value) => patch({ middleBandColor: value.hex, middleBandLineStyle: value.lineStyle, middleBandLineWidth: value.thickness, middleBandOpacity: value.opacity })}
            thickness={settings.middleBandLineWidth}
            value={{ hex: settings.middleBandColor, lineStyle: settings.middleBandLineStyle, opacity: settings.middleBandOpacity, thickness: settings.middleBandLineWidth }}
          />
          <NumberBox max={100} min={0} onChange={(middleBand) => patch({ middleBand })} value={settings.middleBand} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundFillVisible} label={stochText.backgroundFill} onChange={(backgroundFillVisible) => patch({ backgroundFillVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundFillColor}
          onChange={(value) => patch({ backgroundFillColor: value.hex, backgroundFillOpacity: value.opacity })}
          value={{ hex: settings.backgroundFillColor, opacity: settings.backgroundFillOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundFillUpperVisible} label={stochText.backgroundFillUpper} onChange={(backgroundFillUpperVisible) => patch({ backgroundFillUpperVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundFillUpperColor}
          onChange={(value) => patch({ backgroundFillUpperColor: value.hex, backgroundFillUpperOpacity: value.opacity })}
          value={{ hex: settings.backgroundFillUpperColor, opacity: settings.backgroundFillUpperOpacity }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.backgroundFillLowerVisible} label={stochText.backgroundFillLower} onChange={(backgroundFillLowerVisible) => patch({ backgroundFillLowerVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundFillLowerColor}
          onChange={(value) => patch({ backgroundFillLowerColor: value.hex, backgroundFillLowerOpacity: value.opacity })}
          value={{ hex: settings.backgroundFillLowerColor, opacity: settings.backgroundFillLowerOpacity }}
        />
      </div>
    </div>
  )
}
