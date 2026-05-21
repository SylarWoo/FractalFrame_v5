import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineSwatch, SettingsLineWeightSwatch } from '../settings/SettingsSwatches'
import { IndicatorSettingsShell } from './IndicatorSettingsShell'
import {
  clearPersistedIndicatorsState,
  readIndicatorPersistenceEnabled,
  readPersistedIndicatorsState,
  writeIndicatorPersistenceEnabled,
  writePersistedIndicatorsState,
} from './indicatorPersistence'
import type { IndicatorSettingsTab, MaIndicatorSettings, MaMarkerMode, MaSource, MaType, RsiIndicatorSettings, RsiPrecision, RsiSmoothingType, RsiSource, VolIndicatorSettings } from './indicatorPersistence'
import './IndicatorsDrawer.css'

type SupportedChartIndicator = 'MA' | 'RSI' | 'VWAP' | 'Vol'

type IndicatorRow = {
  key: string
  name: string
  type: string
  description: string
}

type IndicatorsDrawerProps = {
  onLoadIndicator?: (name: SupportedChartIndicator, settings?: MaIndicatorSettings | RsiIndicatorSettings | VolIndicatorSettings) => void
  onUnloadIndicator?: (name: SupportedChartIndicator) => void
}

type IndicatorColumnKey = 'indicator' | 'name' | 'type' | 'description' | 'status'
type IndicatorColumnWidths = Record<IndicatorColumnKey, number>
const defaultColumnWidths: IndicatorColumnWidths = {
  indicator: 58,
  name: 116,
  type: 64,
  description: 220,
  status: 54,
}

const minColumnWidths: IndicatorColumnWidths = {
  indicator: 44,
  name: 74,
  type: 54,
  description: 120,
  status: 48,
}

const indicatorRows: IndicatorRow[] = [
  { key: 'RSI', name: '相对强弱指数', type: '副图指标', description: 'Relative Strength Index' },
  { key: 'Stoch', name: '随机指标', type: '副图指标', description: 'Stochastic' },
  { key: 'MACD', name: '平滑异同移动均线', type: '副图指标', description: 'Moving Average Convergence Divergence' },
  { key: 'TSI', name: '真实强弱指数', type: '副图指标', description: 'True Strength Index：基于双重 EMA 平滑动量的趋势强弱指标。' },
  { key: 'VI', name: '漩涡指标', type: '副图指标', description: 'Vortex Indicator' },
  { key: 'MA', name: '移动均线', type: '主图指标', description: 'Moving Average：基于价格源计算的趋势均线，叠加在主图价格区。' },
  { key: 'VWAP', name: '成交量加权平均价', type: '主图指标', description: 'Volume Weighted Average Price：按成交量加权的平均价格。' },
  { key: 'Vol', name: '成交量', type: '主图指标', description: 'MT5 tick volume：周期内跳动次数形成的柱。' },
]

const rsiSourceOptions: Array<{ label: string; value: RsiSource }> = [
  { value: 'close', label: '收盘价' },
  { value: 'open', label: '开盘价' },
  { value: 'high', label: '最高价' },
  { value: 'low', label: '最低价' },
  { value: 'hl2', label: 'HL2' },
  { value: 'hlc3', label: 'HLC3' },
  { value: 'ohlc4', label: 'OHLC4' },
]

const rsiSmoothingOptions: Array<{ label: string; value: RsiSmoothingType }> = [
  { value: 'none', label: '无' },
  { value: 'sma', label: 'SMA' },
  { value: 'sma_bb', label: 'SMA + 布林带' },
  { value: 'ema', label: 'EMA' },
  { value: 'smma', label: 'SMMA (RMA)' },
  { value: 'wma', label: 'WMA' },
  { value: 'vwma', label: 'VWMA' },
]

const precisionOptions: Array<{ label: string; value: RsiPrecision }> = [
  { value: 'system', label: '系统预设' },
  { value: '0', label: '0 位小数' },
  { value: '1', label: '1 位小数' },
  { value: '2', label: '2 位小数' },
  { value: '3', label: '3 位小数' },
  { value: '4', label: '4 位小数' },
]

const maTypeOptions: Array<{ label: string; value: MaType }> = [
  { value: 'sma', label: 'SMA' },
  { value: 'ema', label: 'EMA' },
  { value: 'smma', label: 'SMMA' },
  { value: 'wma', label: 'WMA' },
  { value: 'vwma', label: 'VWMA' },
]

const maSourceOptions: Array<{ label: string; value: MaSource }> = [
  { value: 'close', label: '收盘价' },
  { value: 'open', label: '开盘价' },
  { value: 'high', label: '最高价' },
  { value: 'low', label: '最低价' },
  { value: 'hl2', label: '高 + 低 / 2' },
  { value: 'hlc3', label: '高 + 低 + 收 / 3' },
  { value: 'ohlc4', label: '开 + 高 + 低 + 收 / 4' },
]

const maMarkerModeOptions: Array<{ label: string; value: MaMarkerMode }> = [
  { value: 'bar_down', label: 'Bar 下...' },
  { value: 'bar_up', label: 'Bar 上...' },
  { value: 'triangle_down', label: '三角 下...' },
  { value: 'triangle_up', label: '三角 上...' },
]

function isSupportedChartIndicator(key: string): key is SupportedChartIndicator {
  return key === 'MA' || key === 'RSI' || key === 'VWAP' || key === 'Vol'
}

function resolveInitialSelectedKey(value: string) {
  return indicatorRows.some((row) => row.key === value) ? value : 'RSI'
}

function InfoBadge({ title }: { title: string }) {
  return <span className="ff-indicators-input-panel-v1__info" title={title}>i</span>
}

function updateSettings(
  current: RsiIndicatorSettings,
  patch: Partial<RsiIndicatorSettings>,
): RsiIndicatorSettings {
  return { ...current, ...patch }
}

function updateMaSettings(
  current: MaIndicatorSettings,
  patch: Partial<MaIndicatorSettings>,
): MaIndicatorSettings {
  return { ...current, ...patch }
}

function CheckControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <span className="ff-indicators-style-row-v1__check">
      <input aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <button onClick={() => onChange(!checked)} type="button">{label}</button>
    </span>
  )
}

function NumberBox({
  max = 500,
  min = 0,
  onChange,
  step = 1,
  value,
}: {
  max?: number
  min?: number
  onChange: (value: number) => void
  step?: number
  value: number
}) {
  return (
    <input
      max={max}
      min={min}
      onChange={(event) => onChange(Number(event.target.value) || min)}
      step={step}
      type="number"
      value={value}
    />
  )
}

function RsiInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  settings: RsiIndicatorSettings
}) {
  const patch = (next: Partial<RsiIndicatorSettings>) => onSettingsChange(updateSettings(settings, next))

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">
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
            计算跨度 <InfoBadge title="检测价格与 RSI 背离形态；当前先保存面板偏好。" />
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

function RsiStylePanel({
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

function MaInputPanel({
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
          <span className="ff-indicators-input-panel-v1__control">
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

function MaStylePanel({
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

function VolInputPanel({
  onSettingsChange,
  settings,
}: {
  onSettingsChange: (settings: VolIndicatorSettings) => void
  settings: VolIndicatorSettings
}) {
  const patch = (next: Partial<VolIndicatorSettings>) => onSettingsChange({ ...settings, ...next })

  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-vol-panel-v1" role="tabpanel">
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
            K线颜色基于前一收盘价 <InfoBadge title="成交量柱颜色是否基于当前收盘价与前一根收盘价比较。" />
          </span>
          <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--check">
            <input checked={settings.colorBasedOnPreviousClose} onChange={(event) => patch({ colorBasedOnPreviousClose: event.target.checked })} type="checkbox" />
          </span>
        </label>
      </section>
    </div>
  )
}

function VolStylePanel({
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
      <label className="ff-indicators-input-panel-v1__row">
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

function LoadedIndicatorSettingsPanel({
  maSettings,
  onMaSettingsChange,
  onSettingsChange,
  onVolSettingsChange,
  settingsTab,
  selectedKey,
  settings,
  volSettings,
}: {
  maSettings: MaIndicatorSettings
  onMaSettingsChange: (settings: MaIndicatorSettings) => void
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  onVolSettingsChange: (settings: VolIndicatorSettings) => void
  settingsTab: IndicatorSettingsTab
  selectedKey: string
  settings: RsiIndicatorSettings
  volSettings: VolIndicatorSettings
}) {
  return (
    <>
      {selectedKey === 'RSI' && settingsTab === 'input' ? <RsiInputPanel onSettingsChange={onSettingsChange} settings={settings} /> : null}
      {selectedKey === 'RSI' && settingsTab === 'style' ? <RsiStylePanel onSettingsChange={onSettingsChange} settings={settings} /> : null}
      {selectedKey === 'MA' && settingsTab === 'input' ? <MaInputPanel onSettingsChange={onMaSettingsChange} settings={maSettings} /> : null}
      {selectedKey === 'MA' && settingsTab === 'style' ? <MaStylePanel onSettingsChange={onMaSettingsChange} settings={maSettings} /> : null}
      {selectedKey === 'Vol' && settingsTab === 'input' ? <VolInputPanel onSettingsChange={onVolSettingsChange} settings={volSettings} /> : null}
      {selectedKey === 'Vol' && settingsTab === 'style' ? <VolStylePanel onSettingsChange={onVolSettingsChange} settings={volSettings} /> : null}
      {settingsTab === 'visibility' ? (
        <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">
          <p className="ff-indicators-input-panel-v1__placeholder">可见范围面板按当前指标框架预留。</p>
        </div>
      ) : null}
    </>
  )
}

export function IndicatorsDrawer({ onLoadIndicator, onUnloadIndicator }: IndicatorsDrawerProps) {
  const initialPersisted = readPersistedIndicatorsState()
  const [selectedKey, setSelectedKey] = useState(() => resolveInitialSelectedKey(initialPersisted.ui.selectedKey))
  const [settingsTab, setSettingsTab] = useState<IndicatorSettingsTab>(() => initialPersisted.ui.activeTab)
  const [persistenceEnabled, setPersistenceEnabled] = useState(readIndicatorPersistenceEnabled)
  const [maSettings, setMaSettings] = useState<MaIndicatorSettings>(() => initialPersisted.ma)
  const [rsiSettings, setRsiSettings] = useState<RsiIndicatorSettings>(() => initialPersisted.rsi)
  const [volSettings, setVolSettings] = useState<VolIndicatorSettings>(() => initialPersisted.vol)
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(() => {
    const next = new Set<string>()
    if (initialPersisted.loaded.MA) next.add('MA')
    if (initialPersisted.loaded.RSI) next.add('RSI')
    if (initialPersisted.loaded.VWAP) next.add('VWAP')
    if (initialPersisted.loaded.Vol) next.add('Vol')
    return next
  })
  const [topHeight, setTopHeight] = useState(254)
  const [columnWidths, setColumnWidths] = useState<IndicatorColumnWidths>(defaultColumnWidths)
  const selected = indicatorRows.find((row) => row.key === selectedKey) ?? indicatorRows[0]
  const selectedLoaded = loadedKeys.has(selected.key)

  useEffect(() => {
    if (!persistenceEnabled) return
    writePersistedIndicatorsState({
      loaded: { MA: loadedKeys.has('MA'), RSI: loadedKeys.has('RSI'), VWAP: loadedKeys.has('VWAP'), Vol: loadedKeys.has('Vol') },
      ma: maSettings,
      rsi: rsiSettings,
      vol: volSettings,
      ui: { activeTab: settingsTab, selectedKey },
    })
  }, [loadedKeys, maSettings, persistenceEnabled, rsiSettings, selectedKey, settingsTab, volSettings])

  function handleSettingsChange(next: RsiIndicatorSettings) {
    setRsiSettings(next)
    if (loadedKeys.has('RSI')) onLoadIndicator?.('RSI', next)
  }

  function handleMaSettingsChange(next: MaIndicatorSettings) {
    setMaSettings(next)
    if (loadedKeys.has('MA')) onLoadIndicator?.('MA', next)
  }

  function handleVolSettingsChange(next: VolIndicatorSettings) {
    setVolSettings(next)
    if (loadedKeys.has('Vol')) onLoadIndicator?.('Vol', next)
  }

  function handlePersistenceChange(enabled: boolean) {
    setPersistenceEnabled(enabled)
    writeIndicatorPersistenceEnabled(enabled)
    if (!enabled) {
      clearPersistedIndicatorsState()
      return
    }
    writePersistedIndicatorsState({
      loaded: { MA: loadedKeys.has('MA'), RSI: loadedKeys.has('RSI'), VWAP: loadedKeys.has('VWAP'), Vol: loadedKeys.has('Vol') },
      ma: maSettings,
      rsi: rsiSettings,
      vol: volSettings,
      ui: { activeTab: settingsTab, selectedKey },
    })
  }

  function handleLoadSelected() {
    setLoadedKeys((current) => {
      const next = new Set(current)
      next.add(selected.key)
      return next
    })

    if (selected.key === 'RSI') {
      onLoadIndicator?.(selected.key, rsiSettings)
    } else if (selected.key === 'MA') {
      onLoadIndicator?.(selected.key, maSettings)
    } else if (selected.key === 'VWAP') {
      onLoadIndicator?.(selected.key)
    } else if (selected.key === 'Vol') {
      onLoadIndicator?.(selected.key, volSettings)
    }
  }

  function handleUnloadSelected() {
    setLoadedKeys((current) => {
      const next = new Set(current)
      next.delete(selected.key)
      return next
    })

    if (isSupportedChartIndicator(selected.key)) {
      onUnloadIndicator?.(selected.key)
    }
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeIndicatorsSplitting = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(Math.max(96, Math.min(420, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-indicators-splitting')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  function handleColumnResizePointerDown(event: ReactPointerEvent<HTMLSpanElement>, column: IndicatorColumnKey) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeIndicatorsColumnResizing = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX)
      setColumnWidths((current) => ({
        ...current,
        [column]: Math.max(minColumnWidths[column], Math.round(nextWidth)),
      }))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-indicators-column-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  function resetColumnWidth(column: IndicatorColumnKey) {
    setColumnWidths((current) => ({ ...current, [column]: defaultColumnWidths[column] }))
  }

  function renderResizableHeader(label: string, column: IndicatorColumnKey) {
    return (
      <th scope="col">
        {label}
        <span
          className="ff-indicators-table-v1__column-resizer"
          onDoubleClick={() => resetColumnWidth(column)}
          onPointerDown={(event) => handleColumnResizePointerDown(event, column)}
        />
      </th>
    )
  }

  return (
    <section className="ff-indicators-drawer" data-right-widget-panel="indicators" data-testid="ff-indicators-drawer-panel">
      <div
        className="ff-indicators-split-v1"
        data-ff-indicators-split-v1
        style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}
      >
        <div className="ff-indicators-split-v1__top" data-ff-indicators-split-top-v1>
          <table className="right-widget-drawer__table ff-indicators-table-v1" aria-label="Indicators list">
            <colgroup>
              <col style={{ width: `${columnWidths.indicator}px` }} />
              <col style={{ width: `${columnWidths.name}px` }} />
              <col style={{ width: `${columnWidths.type}px` }} />
              <col style={{ width: `${columnWidths.description}px` }} />
              <col style={{ width: `${columnWidths.status}px` }} />
            </colgroup>
            <thead>
              <tr>
                {renderResizableHeader('Indicators', 'indicator')}
                {renderResizableHeader('中文名称', 'name')}
                {renderResizableHeader('类型', 'type')}
                {renderResizableHeader('描述', 'description')}
                {renderResizableHeader('状态', 'status')}
              </tr>
            </thead>
            <tbody>
              {indicatorRows.map((row) => {
                const loaded = loadedKeys.has(row.key)
                return (
                  <tr
                    data-ff-indicator-row-v1={row.key}
                    data-selected={selectedKey === row.key}
                    key={row.key}
                    onClick={() => setSelectedKey(row.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedKey(row.key)
                      }
                    }}
                    tabIndex={0}
                  >
                    <td>{row.key}</td>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td title={row.description}>{row.description}</td>
                    <td data-ff-indicator-status-v1={row.key}>{loaded ? '已加载' : '未加载'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button
          aria-label="Resize indicators drawer split"
          className="ff-indicators-split-v1__handle"
          data-ff-indicators-split-handle-v1="true"
          onPointerDown={handleSplitPointerDown}
          title="上下拖动调整窗口大小"
          type="button"
        />
        <div className="ff-indicators-split-v1__bottom" data-ff-indicators-split-bottom-v1>
          <IndicatorSettingsShell
            activeTab={settingsTab}
            loaded={selectedLoaded}
            persistenceEnabled={persistenceEnabled}
            title={`${selected.key} · ${selected.name}`}
            unloadedContent={
              <p className="ff-indicators-input-panel-v1__placeholder">
                {`\u8bf7\u5148\u5728\u4e0a\u65b9\u70b9\u51fb Load \u52a0\u8f7d ${selected.key} \u5230${selected.type === '\u4e3b\u56fe\u6307\u6807' ? '\u4e3b\u56fe' : '\u526f\u56fe'}\u3002`}
              </p>
            }
            onLoad={handleLoadSelected}
            onPersistenceChange={handlePersistenceChange}
            onTabChange={setSettingsTab}
            onUnload={handleUnloadSelected}
          >
            <LoadedIndicatorSettingsPanel
              maSettings={maSettings}
              onMaSettingsChange={handleMaSettingsChange}
              onSettingsChange={handleSettingsChange}
              onVolSettingsChange={handleVolSettingsChange}
              settingsTab={settingsTab}
              selectedKey={selected.key}
              settings={rsiSettings}
              volSettings={volSettings}
            />
          </IndicatorSettingsShell>
        </div>
      </div>
    </section>
  )
}
