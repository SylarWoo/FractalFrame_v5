export { VolInputPanel, VolStylePanel } from './VolSettingsPanels'
export { RsiInputPanel, RsiStylePanel } from './RsiSettingsPanels'
export { MaInputPanel, MaStylePanel } from './MaSettingsPanels'
export { MmfInputPanel, MmfStylePanel } from './MmfSettingsPanels'
import type { CSSProperties } from 'react'
import type { MorganRangeSegment } from '../../../chart/morganRangeModel'
import { OpenableSelect } from '../../../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineSwatch } from '../../../settings/SettingsSwatches'
import type {
  DpoIndicatorSettings,
  MacdIndicatorSettings,
  MacdMaType,
  MrIndicatorSettings,
  RsiSource,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  VwapAnchorPeriod,
  VwapBandCalculationMode,
  VwapIndicatorSettings,
  VwapSource,
  VwapTimeframe,
} from '../../indicatorPersistence'
import {
  CheckControl,
  InfoBadge,
  NumberBox,
  macdMaTypeOptions,
  rsiSourceOptions,
  stochText,
  updateDpoSettings,
  updateMacdSettings,
  updateStochSettings,
  updateTsiSettings,
  updateVdoSettings,
  updateViSettings,
  updateVwapSettings,
  vwapAnchorPeriodOptions,
  vwapBandCalculationModeOptions,
  vwapSourceOptions,
  vwapStyleText,
  vwapText,
  vwapTimeframeOptions,
} from './indicatorPanelShared'

export function VwapStylePanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VwapIndicatorSettings) => void
  settings: VwapIndicatorSettings
}) {
  const patch = (next: Partial<VwapIndicatorSettings>) => onSettingsChange(updateVwapSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-vwap-style-panel-v1" role="tabpanel">
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.vwapVisible} label={vwapStyleText.vwap} onChange={(vwapVisible) => patch({ vwapVisible })} />
        <SettingsLineSwatch
          color={settings.vwapColor}
          lineStyle={settings.vwapLineStyle}
          onChange={(value) => patch({
            vwapColor: value.hex,
            vwapLineStyle: value.lineStyle,
            vwapLineWidth: value.thickness,
            vwapOpacity: value.opacity,
          })}
          thickness={settings.vwapLineWidth}
          value={{
            hex: settings.vwapColor,
            lineStyle: settings.vwapLineStyle,
            opacity: settings.vwapOpacity,
            thickness: settings.vwapLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.band1UpperVisible} label={vwapStyleText.upperBand1} onChange={(band1UpperVisible) => patch({ band1UpperVisible })} />
        <SettingsLineSwatch
          color={settings.band1UpperColor}
          lineStyle={settings.band1UpperLineStyle}
          onChange={(value) => patch({
            band1UpperColor: value.hex,
            band1UpperLineStyle: value.lineStyle,
            band1UpperLineWidth: value.thickness,
            band1UpperOpacity: value.opacity,
          })}
          thickness={settings.band1UpperLineWidth}
          value={{
            hex: settings.band1UpperColor,
            lineStyle: settings.band1UpperLineStyle,
            opacity: settings.band1UpperOpacity,
            thickness: settings.band1UpperLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.band1LowerVisible} label={vwapStyleText.lowerBand1} onChange={(band1LowerVisible) => patch({ band1LowerVisible })} />
        <SettingsLineSwatch
          color={settings.band1LowerColor}
          lineStyle={settings.band1LowerLineStyle}
          onChange={(value) => patch({
            band1LowerColor: value.hex,
            band1LowerLineStyle: value.lineStyle,
            band1LowerLineWidth: value.thickness,
            band1LowerOpacity: value.opacity,
          })}
          thickness={settings.band1LowerLineWidth}
          value={{
            hex: settings.band1LowerColor,
            lineStyle: settings.band1LowerLineStyle,
            opacity: settings.band1LowerOpacity,
            thickness: settings.band1LowerLineWidth,
          }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.band1FillVisible} label={vwapStyleText.bandsFill1} onChange={(band1FillVisible) => patch({ band1FillVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.band1FillColor}
          onChange={(value) => patch({ band1FillColor: value.hex, band1FillOpacity: value.opacity })}
          value={{ hex: settings.band1FillColor, opacity: settings.band1FillOpacity }}
        />
      </div>
    </div>
  )
}

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
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">来源</span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="MACD source" onChange={(value) => patch({ source: value as RsiSource })} options={rsiSourceOptions} value={settings.source} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">快线长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(fastLength) => patch({ fastLength })} value={settings.fastLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">慢线长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(slowLength) => patch({ slowLength })} value={settings.slowLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">Signal length</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(signalLength) => patch({ signalLength })} value={settings.signalLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">Oscillator MA type</span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="MACD oscillator MA type" onChange={(value) => patch({ oscillatorMaType: value as MacdMaType })} options={macdMaTypeOptions} value={settings.oscillatorMaType} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">Signal MA type</span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="MACD signal MA type" onChange={(value) => patch({ signalMaType: value as MacdMaType })} options={macdMaTypeOptions} value={settings.signalMaType} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">计算</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">时间周期 <InfoBadge title="当前先按图表周期计算，控件状态会被保存。" /></span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="MACD timeframe" onChange={(value) => patch({ timeframe: value as VwapTimeframe })} options={vwapTimeframeOptions} value={settings.timeframe} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>等待时间周期结束</span>
        </label>
      </section>
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
        <CheckControl checked={settings.histogramVisible} label="直方图" onChange={(histogramVisible) => patch({ histogramVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsColorSwatch color={settings.histogramColor0} onChange={(value) => patch({ histogramColor0: value.hex, histogramColor0Opacity: value.opacity })} value={{ hex: settings.histogramColor0, opacity: settings.histogramColor0Opacity }} />
          <SettingsColorSwatch color={settings.histogramColor1} onChange={(value) => patch({ histogramColor1: value.hex, histogramColor1Opacity: value.opacity })} value={{ hex: settings.histogramColor1, opacity: settings.histogramColor1Opacity }} />
          <SettingsColorSwatch color={settings.histogramColor2} onChange={(value) => patch({ histogramColor2: value.hex, histogramColor2Opacity: value.opacity })} value={{ hex: settings.histogramColor2, opacity: settings.histogramColor2Opacity }} />
          <SettingsColorSwatch color={settings.histogramColor3} onChange={(value) => patch({ histogramColor3: value.hex, histogramColor3Opacity: value.opacity })} value={{ hex: settings.histogramColor3, opacity: settings.histogramColor3Opacity }} />
        </span>
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.macdVisible} label="MACD" onChange={(macdVisible) => patch({ macdVisible })} />
        <SettingsLineSwatch
          color={settings.macdColor}
          lineStyle={settings.macdLineStyle}
          onChange={(value) => patch({ macdColor: value.hex, macdLineStyle: value.lineStyle, macdLineWidth: value.thickness, macdOpacity: value.opacity })}
          thickness={settings.macdLineWidth}
          value={{ hex: settings.macdColor, lineStyle: settings.macdLineStyle, opacity: settings.macdOpacity, thickness: settings.macdLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.signalVisible} label="Signal line" onChange={(signalVisible) => patch({ signalVisible })} />
        <SettingsLineSwatch
          color={settings.signalColor}
          lineStyle={settings.signalLineStyle}
          onChange={(value) => patch({ signalColor: value.hex, signalLineStyle: value.lineStyle, signalLineWidth: value.thickness, signalOpacity: value.opacity })}
          thickness={settings.signalLineWidth}
          value={{ hex: settings.signalColor, lineStyle: settings.signalLineStyle, opacity: settings.signalOpacity, thickness: settings.signalLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.zeroLineVisible} label="零" onChange={(zeroLineVisible) => patch({ zeroLineVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.zeroLineColor}
            lineStyle={settings.zeroLineStyle}
            onChange={(value) => patch({ zeroLineColor: value.hex, zeroLineStyle: value.lineStyle, zeroLineWidth: value.thickness, zeroLineOpacity: value.opacity })}
            thickness={settings.zeroLineWidth}
            value={{ hex: settings.zeroLineColor, lineStyle: settings.zeroLineStyle, opacity: settings.zeroLineOpacity, thickness: settings.zeroLineWidth }}
          />
          <NumberBox max={0} min={0} onChange={() => undefined} value={0} />
        </span>
      </div>
    </div>
  )
}

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
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">长线长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(longLength) => patch({ longLength })} value={settings.longLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">短期长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(shortLength) => patch({ shortLength })} value={settings.shortLength} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">信号长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(signalLength) => patch({ signalLength })} value={settings.signalLength} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">计算</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">时间周期 <InfoBadge title="当前先按图表周期计算，控件状态会被保存。" /></span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="TSI timeframe" onChange={(value) => patch({ timeframe: value as VwapTimeframe })} options={vwapTimeframeOptions} value={settings.timeframe} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>等待时间周期结束</span>
        </label>
      </section>
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
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.tsiVisible} label="True Strength Index" onChange={(tsiVisible) => patch({ tsiVisible })} />
        <SettingsLineSwatch
          color={settings.tsiColor}
          lineStyle={settings.tsiLineStyle}
          onChange={(value) => patch({ tsiColor: value.hex, tsiLineStyle: value.lineStyle, tsiLineWidth: value.thickness, tsiOpacity: value.opacity })}
          thickness={settings.tsiLineWidth}
          value={{ hex: settings.tsiColor, lineStyle: settings.tsiLineStyle, opacity: settings.tsiOpacity, thickness: settings.tsiLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.signalVisible} label="信号" onChange={(signalVisible) => patch({ signalVisible })} />
        <SettingsLineSwatch
          color={settings.signalColor}
          lineStyle={settings.signalLineStyle}
          onChange={(value) => patch({ signalColor: value.hex, signalLineStyle: value.lineStyle, signalLineWidth: value.thickness, signalOpacity: value.opacity })}
          thickness={settings.signalLineWidth}
          value={{ hex: settings.signalColor, lineStyle: settings.signalLineStyle, opacity: settings.signalOpacity, thickness: settings.signalLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.zeroLineVisible} label="零" onChange={(zeroLineVisible) => patch({ zeroLineVisible })} />
        <span className="ff-indicators-style-row-v1__controls">
          <SettingsLineSwatch
            color={settings.zeroLineColor}
            lineStyle={settings.zeroLineStyle}
            onChange={(value) => patch({ zeroLineColor: value.hex, zeroLineStyle: value.lineStyle, zeroLineWidth: value.thickness, zeroLineOpacity: value.opacity })}
            thickness={settings.zeroLineWidth}
            value={{ hex: settings.zeroLineColor, lineStyle: settings.zeroLineStyle, opacity: settings.zeroLineOpacity, thickness: settings.zeroLineWidth }}
          />
          <NumberBox max={0} min={0} onChange={() => undefined} value={0} />
        </span>
      </div>
    </div>
  )
}

export function ViInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: ViIndicatorSettings) => void
  settings: ViIndicatorSettings
}) {
  const patch = (next: Partial<ViIndicatorSettings>) => onSettingsChange(updateViSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-vi-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(length) => patch({ length })} value={settings.length} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">计算</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">时间周期 <InfoBadge title="当前先按图表周期计算，控件状态会被保存。" /></span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect ariaLabel="VI timeframe" onChange={(value) => patch({ timeframe: value as VwapTimeframe })} options={vwapTimeframeOptions} value={settings.timeframe} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>等待时间周期结束</span>
        </label>
      </section>
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
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.plusVisible} label="VI +" onChange={(plusVisible) => patch({ plusVisible })} />
        <SettingsLineSwatch
          color={settings.plusColor}
          lineStyle={settings.plusLineStyle}
          onChange={(value) => patch({ plusColor: value.hex, plusLineStyle: value.lineStyle, plusLineWidth: value.thickness, plusOpacity: value.opacity })}
          thickness={settings.plusLineWidth}
          value={{ hex: settings.plusColor, lineStyle: settings.plusLineStyle, opacity: settings.plusOpacity, thickness: settings.plusLineWidth }}
        />
      </div>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.minusVisible} label="VI -" onChange={(minusVisible) => patch({ minusVisible })} />
        <SettingsLineSwatch
          color={settings.minusColor}
          lineStyle={settings.minusLineStyle}
          onChange={(value) => patch({ minusColor: value.hex, minusLineStyle: value.lineStyle, minusLineWidth: value.thickness, minusOpacity: value.opacity })}
          thickness={settings.minusLineWidth}
          value={{ hex: settings.minusColor, lineStyle: settings.minusLineStyle, opacity: settings.minusOpacity, thickness: settings.minusLineWidth }}
        />
      </div>
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

export function VwapInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VwapIndicatorSettings) => void
  settings: VwapIndicatorSettings
}) {
  const patch = (next: Partial<VwapIndicatorSettings>) => onSettingsChange(updateVwapSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-vwap-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{vwapText.settings}</h3>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.hideOnDailyOrAbove} onChange={(event) => patch({ hideOnDailyOrAbove: event.target.checked })} type="checkbox" />
          <span>{vwapText.hideOnDailyOrAbove}</span>
        </label>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{vwapText.period}</span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="VWAP anchor period"
              onChange={(value) => patch({ anchorPeriod: value as VwapAnchorPeriod })}
              options={vwapAnchorPeriodOptions}
              value={settings.anchorPeriod}
            />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{vwapText.source}</span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="VWAP source"
              onChange={(value) => patch({ source: value as VwapSource })}
              options={vwapSourceOptions}
              value={settings.source}
            />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">{vwapText.offset}</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox max={500} min={-500} onChange={(offset) => patch({ offset })} value={settings.offset} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{vwapText.bands}</h3>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            {vwapText.bandCalculationMode} <InfoBadge title={vwapText.bandCalculationModeInfo} />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="VWAP band calculation mode"
              onChange={(value) => patch({ bandCalculationMode: value as VwapBandCalculationMode })}
              options={vwapBandCalculationModeOptions}
              value={settings.bandCalculationMode}
            />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__band-row">
          <span className="ff-indicators-vwap-panel-v1__band-check">
            <input checked={settings.band1Visible} onChange={(event) => patch({ band1Visible: event.target.checked })} type="checkbox" />
            <span>{vwapText.band1}</span>
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox max={100} min={0} onChange={(band1Multiplier) => patch({ band1Multiplier })} step={0.1} value={settings.band1Multiplier} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__band-row">
          <span className="ff-indicators-vwap-panel-v1__band-check">
            <input checked={settings.band2Visible} onChange={(event) => patch({ band2Visible: event.target.checked })} type="checkbox" />
            <span>{vwapText.band2}</span>
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <input disabled={!settings.band2Visible} max={100} min={0} onChange={(event) => patch({ band2Multiplier: Number(event.target.value) || 0 })} step={0.1} type="number" value={settings.band2Multiplier} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__band-row">
          <span className="ff-indicators-vwap-panel-v1__band-check">
            <input checked={settings.band3Visible} onChange={(event) => patch({ band3Visible: event.target.checked })} type="checkbox" />
            <span>{vwapText.band3}</span>
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <input disabled={!settings.band3Visible} max={100} min={0} onChange={(event) => patch({ band3Multiplier: Number(event.target.value) || 0 })} step={0.1} type="number" value={settings.band3Multiplier} />
          </span>
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">{vwapText.calculation}</h3>
        <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">
            {vwapText.timeframe} <InfoBadge title={vwapText.timeframeInfo} />
          </span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="VWAP timeframe"
              onChange={(value) => patch({ timeframe: value as VwapTimeframe })}
              options={vwapTimeframeOptions}
              value={settings.timeframe}
            />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>{vwapText.waitForTimeframeClose}</span>
        </label>
      </section>
    </div>
  )
}

export function MrInputPanel() {
  return (
    <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">默认</div>
  )
}

export function MrStylePanel() {
  return (
    <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">默认</div>
  )
}

export function MrInputPanelV3(props: {
  onSettingsChange: (settings: MrIndicatorSettings) => void
  segment?: MorganRangeSegment | null
  settings: MrIndicatorSettings
}) {
  const { segment } = props
  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mr-panel-v1" role="tabpanel">
      {segment ? (
        <div className="ff-indicators-mr-level-table-v1">
          <div className="ff-indicators-mr-level-table-v1__meta">
            <span>Center {formatMorganRangePrice(segment.center)}</span>
            <span>Range {formatMorganRangePrice(segment.range)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ratio</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {segment.levels.map((level) => (
                <tr key={level.ratio}>
                  <td>{formatMorganRangeRatio(level.ratio)}</td>
                  <td>{formatMorganRangePrice(level.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ff-indicators-mr-level-table-v1__empty">No Morgan range data</div>
      )}
    </div>
  )
}

function formatMorganRangeRatio(value: number) {
  if (value === 0) return '0'
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function formatMorganRangePrice(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : '--'
}

export function MrStylePanelV3(props: {
  onSettingsChange: (settings: MrIndicatorSettings) => void
  settings: MrIndicatorSettings
}) {
  void props
  return <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mr-panel-v1" role="tabpanel" />
}

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
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(length) => patch({ length })} value={settings.length} />
          </span>
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.centered} onChange={(event) => patch({ centered: event.target.checked })} type="checkbox" />
          <span>居中</span>
          <InfoBadge title="当前只保存 UI 状态，后续接计算。" />
        </label>
      </section>
      <section className="ff-indicators-input-panel-v1__section">
        <h3 className="ff-indicators-input-panel-v1__section-title">计算</h3>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">时间周期</span>
          <span className="ff-indicators-input-panel-v1__control">
            <OpenableSelect
              ariaLabel="DPO timeframe"
              onChange={(value) => patch({ timeframe: value as VwapTimeframe })}
              options={vwapTimeframeOptions}
              value={settings.timeframe}
            />
          </span>
          <InfoBadge title="当前只保存 UI 状态，后续接计算。" />
        </label>
        <label className="ff-indicators-vwap-panel-v1__check-row">
          <input checked={settings.waitForTimeframeClose} onChange={(event) => patch({ waitForTimeframeClose: event.target.checked })} type="checkbox" />
          <span>等待时间周期结束</span>
        </label>
      </section>
    </div>
  )
}

export function DpoStylePanel({
  controlsOffsetPx = 0,
  lineLabel = 'DPO',
  onSettingsChange,
  showBand2Levels = false,
  showThresholds = true,
  settings,
  zeroLineEditable = true,
}: {
  controlsOffsetPx?: number
  lineLabel?: string
  onSettingsChange: (settings: DpoIndicatorSettings) => void
  showBand2Levels?: boolean
  showThresholds?: boolean
  settings: DpoIndicatorSettings
  zeroLineEditable?: boolean
}) {
  const patch = (next: Partial<DpoIndicatorSettings>) => onSettingsChange(updateDpoSettings(settings, next))
  const panelClassName = controlsOffsetPx > 0
    ? 'ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-dpo-style-panel-v1 ff-indicators-dpo-style-panel-v1--offset-controls'
    : 'ff-indicators-input-panel-v1__tab-panel ff-indicators-style-panel-v1 ff-indicators-dpo-style-panel-v1'
  const panelStyle = controlsOffsetPx > 0
    ? ({ '--ff-indicators-dpo-controls-offset': `${controlsOffsetPx}px` } as CSSProperties)
    : undefined

  return (
    <div className={panelClassName} role="tabpanel" style={panelStyle}>
      <div className="ff-indicators-style-row-v1">
        <CheckControl checked={settings.dpoVisible} label={lineLabel} onChange={(dpoVisible) => patch({ dpoVisible })} />
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
        <CheckControl checked={settings.zeroLineVisible} label="零线" onChange={(zeroLineVisible) => patch({ zeroLineVisible })} />
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
        <span className="ff-indicators-input-panel-v1__control ff-indicators-dpo-style-panel-v1__zero-value">
          <NumberBox max={zeroLineEditable ? 500 : 0} min={zeroLineEditable ? -500 : 0} onChange={(zeroLineValue) => patch({ zeroLineValue })} value={zeroLineEditable ? settings.zeroLineValue : 0} />
        </span>
      </div>
      {showThresholds ? (
        <>
          <div className="ff-indicators-style-row-v1">
            <CheckControl checked={settings.upLineVisible} label="Upper Band" onChange={(upLineVisible) => patch({ upLineVisible })} />
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
            <span className="ff-indicators-input-panel-v1__control ff-indicators-dpo-style-panel-v1__level-value">
              <NumberBox
                min={-500}
                onChange={(upLineValue) => patch({ upLineValue })}
                step={0.001}
                value={settings.upLineValue}
              />
            </span>
          </div>
          {showBand2Levels ? (
            <div className="ff-indicators-style-row-v1">
              <CheckControl checked={settings.upLine2Visible} label="Upper Band 2 level" onChange={(upLine2Visible) => patch({ upLine2Visible })} />
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
              <span className="ff-indicators-input-panel-v1__control ff-indicators-dpo-style-panel-v1__level-value">
                <NumberBox
                  min={-500}
                  onChange={(upLine2Value) => patch({ upLine2Value })}
                  step={0.001}
                  value={settings.upLine2Value}
                />
              </span>
            </div>
          ) : null}
          <div className="ff-indicators-style-row-v1">
            <CheckControl checked={settings.downLineVisible} label="Lower Band" onChange={(downLineVisible) => patch({ downLineVisible })} />
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
            <span className="ff-indicators-input-panel-v1__control ff-indicators-dpo-style-panel-v1__level-value">
              <NumberBox
                min={-500}
                onChange={(downLineValue) => patch({ downLineValue })}
                step={0.001}
                value={settings.downLineValue}
              />
            </span>
          </div>
          {showBand2Levels ? (
            <div className="ff-indicators-style-row-v1">
              <CheckControl checked={settings.downLine2Visible} label="Lower Band 2 level" onChange={(downLine2Visible) => patch({ downLine2Visible })} />
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
              <span className="ff-indicators-input-panel-v1__control ff-indicators-dpo-style-panel-v1__level-value">
                <NumberBox
                  min={-500}
                  onChange={(downLine2Value) => patch({ downLine2Value })}
                  step={0.001}
                  value={settings.downLine2Value}
                />
              </span>
            </div>
          ) : null}
          <div className="ff-indicators-style-row-v1">
            <CheckControl checked={settings.backgroundVisible} label="背景" onChange={(backgroundVisible) => patch({ backgroundVisible })} />
            <SettingsColorSwatch
              checkerboard
              color={settings.backgroundColor}
              onChange={(value) => patch({ backgroundColor: value.hex, backgroundOpacity: value.opacity })}
              value={{ hex: settings.backgroundColor, opacity: settings.backgroundOpacity }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}

export function VdoInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VdoIndicatorSettings) => void
  settings: VdoIndicatorSettings
}) {
  const patch = (next: Partial<VdoIndicatorSettings>) => onSettingsChange(updateVdoSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-dpo-panel-v1" role="tabpanel">
      <section className="ff-indicators-input-panel-v1__section">
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">VI长度</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={1} onChange={(length) => patch({ length })} value={settings.length} />
          </span>
        </label>
        <label className="ff-indicators-input-panel-v1__row">
          <span className="ff-indicators-input-panel-v1__label">EMA平滑</span>
          <span className="ff-indicators-input-panel-v1__control">
            <NumberBox min={0} onChange={(emaSmoothing) => patch({ emaSmoothing })} value={settings.emaSmoothing} />
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
  const handleStyleChange = (next: DpoIndicatorSettings) => {
    onSettingsChange({ ...settings, ...next, emaSmoothing: settings.emaSmoothing })
  }

  return <DpoStylePanel controlsOffsetPx={100} lineLabel="VDO" onSettingsChange={handleStyleChange} settings={settings} showBand2Levels zeroLineEditable={false} />
}
