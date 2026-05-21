import { OpenableSelect } from '../controls/OpenableSelect'
import { SettingsColorSwatch, SettingsLineSwatch, SettingsLineWeightSwatch } from '../settings/SettingsSwatches'
import type {
  IndicatorSettingsTab,
  MacdIndicatorSettings,
  MacdMaType,
  MaIndicatorSettings,
  MaMarkerMode,
  MaSource,
  MaType,
  RsiIndicatorSettings,
  RsiPrecision,
  RsiSmoothingType,
  RsiSource,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  ViIndicatorSettings,
  VolIndicatorSettings,
  VwapAnchorPeriod,
  VwapBandCalculationMode,
  VwapIndicatorSettings,
  VwapSource,
  VwapTimeframe,
} from './indicatorPersistence'

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

const macdMaTypeOptions: Array<{ label: string; value: MacdMaType }> = [
  { value: 'ema', label: 'EMA' },
  { value: 'sma', label: 'SMA' },
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
  { value: 'hl2', label: '(高 + 低) / 2' },
  { value: 'hlc3', label: '(高 + 低 + 收) / 3' },
  { value: 'ohlc4', label: '(开 + 高 + 低 + 收) / 4' },
]

const maMarkerModeOptions: Array<{ label: string; value: MaMarkerMode }> = [
  { value: 'bar_down', label: 'Bar 下方' },
  { value: 'bar_up', label: 'Bar 上方' },
  { value: 'triangle_down', label: '三角 下方' },
  { value: 'triangle_up', label: '三角 上方' },
]

const vwapAnchorPeriodOptions: Array<{ label: string; value: VwapAnchorPeriod }> = [
  { value: 'session', label: 'Session' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'decade', label: 'Decade' },
  { value: 'century', label: 'Century' },
]

const vwapSourceOptions: Array<{ label: string; value: VwapSource }> = [
  { value: 'hlc3', label: '(\u9ad8 + \u4f4e + \u6536\u76d8) / 3' },
  { value: 'close', label: '\u6536\u76d8\u4ef7' },
  { value: 'open', label: '\u5f00\u76d8\u4ef7' },
  { value: 'high', label: '\u6700\u9ad8\u4ef7' },
  { value: 'low', label: '\u6700\u4f4e\u4ef7' },
  { value: 'hl2', label: '(\u9ad8 + \u4f4e) / 2' },
  { value: 'ohlc4', label: '(\u5f00 + \u9ad8 + \u4f4e + \u6536) / 4' },
]

const vwapBandCalculationModeOptions: Array<{ label: string; value: VwapBandCalculationMode }> = [
  { value: 'standard_deviation', label: '\u6807\u51c6\u504f\u5dee' },
  { value: 'percentage', label: '\u767e\u5206\u6bd4' },
]

const vwapTimeframeOptions: Array<{ label: string; value: VwapTimeframe }> = [
  { value: 'chart', label: '\u56fe\u8868' },
  { value: '1m', label: '1 \u5206\u949f' },
  { value: '5m', label: '5 \u5206\u949f' },
  { value: '15m', label: '15 \u5206\u949f' },
  { value: '30m', label: '30 \u5206\u949f' },
  { value: '1h', label: '1 \u5c0f\u65f6' },
  { value: '4h', label: '4 \u5c0f\u65f6' },
  { value: '1d', label: '1 \u5929' },
]

const vwapText = {
  band1: '\u5e26\u7cfb\u6570#1',
  band2: '\u5e26\u7cfb\u6570#2',
  band3: '\u5e26\u7cfb\u6570#3',
  bandCalculationMode: '\u5e26\u8ba1\u7b97\u6a21\u5f0f',
  bandCalculationModeInfo: 'TradingView VWAP Bands \u7684\u8ba1\u7b97\u65b9\u5f0f\u3002',
  bands: '\u5e26\u8bbe\u7f6e',
  calculation: '\u8ba1\u7b97',
  hideOnDailyOrAbove: '\u9690\u85cf1D\u6216\u4ee5\u4e0aVWAP',
  offset: '\u504f\u79fb',
  period: '\u951a\u5b9a\u65f6\u6bb5',
  settings: 'VWAP\u8bbe\u7f6e',
  source: '\u6765\u6e90',
  timeframe: '\u65f6\u95f4\u5468\u671f',
  timeframeInfo: '\u5f53\u524d\u5148\u6309\u56fe\u8868\u5468\u671f\u8ba1\u7b97\uff0c\u63a7\u4ef6\u72b6\u6001\u4f1a\u88ab\u4fdd\u5b58\u3002',
  waitForTimeframeClose: '\u7b49\u5f85\u65f6\u95f4\u5468\u671f\u7ed3\u675f',
}

const vwapStyleText = {
  bandsFill1: 'Bands Fill #1',
  inputValues: '\u8f93\u5165\u503c',
  inputsInStatusLine: '\u72b6\u6001\u884c\u4e2d\u7684\u8f93\u5165',
  lowerBand1: 'Lower Band #1',
  outputValues: '\u8f93\u51fa\u503c',
  precision: '\u7cbe\u786e\u5ea6',
  priceScaleLabels: '\u4ef7\u683c\u5750\u6807\u4e0a\u7684\u6807\u7b7e',
  statusLineValues: '\u72b6\u6001\u884c\u4e2d\u7684\u503c',
  upperBand1: 'Upper Band #1',
  vwap: '\u6210\u4ea4\u91cf\u52a0\u6743\u5e73\u5747\u4ef7',
}

const vwapPrecisionOptions: Array<{ label: string; value: RsiPrecision }> = [
  { value: 'system', label: '\u7cfb\u7edf\u9884\u8bbe' },
  { value: '0', label: '0 \u4f4d\u5c0f\u6570' },
  { value: '1', label: '1 \u4f4d\u5c0f\u6570' },
  { value: '2', label: '2 \u4f4d\u5c0f\u6570' },
  { value: '3', label: '3 \u4f4d\u5c0f\u6570' },
  { value: '4', label: '4 \u4f4d\u5c0f\u6570' },
]

const stochText = {
  d: '%D',
  dSmoothing: '%D Smoothing',
  inputValues: '\u8f93\u5165\u503c',
  inputsInStatusLine: '\u72b6\u6001\u884c\u4e2d\u7684\u8f93\u5165',
  k: '%K',
  kLength: '%K Length',
  kSmoothing: '%K Smoothing',
  lowerBand: 'Lower Band',
  outputValues: '\u8f93\u51fa\u503c',
  precision: '\u7cbe\u786e\u5ea6',
  priceScaleLabels: '\u4ef7\u683c\u5750\u6807\u4e0a\u7684\u6807\u7b7e',
  settings: 'Stoch \u8bbe\u7f6e',
  statusLineValues: '\u72b6\u6001\u884c\u4e2d\u7684\u503c',
  upperBand: 'Upper Band',
  backgroundFill: 'Background Fill',
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

function updateVwapSettings(
  current: VwapIndicatorSettings,
  patch: Partial<VwapIndicatorSettings>,
): VwapIndicatorSettings {
  return { ...current, ...patch }
}

function updateStochSettings(
  current: StochIndicatorSettings,
  patch: Partial<StochIndicatorSettings>,
): StochIndicatorSettings {
  return { ...current, ...patch }
}

function updateMacdSettings(
  current: MacdIndicatorSettings,
  patch: Partial<MacdIndicatorSettings>,
): MacdIndicatorSettings {
  return { ...current, ...patch }
}

function updateTsiSettings(
  current: TsiIndicatorSettings,
  patch: Partial<TsiIndicatorSettings>,
): TsiIndicatorSettings {
  return { ...current, ...patch }
}

function updateViSettings(
  current: ViIndicatorSettings,
  patch: Partial<ViIndicatorSettings>,
): ViIndicatorSettings {
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
      onChange={(event) => {
        const nextValue = Number(event.target.value)
        onChange(Number.isFinite(nextValue) ? nextValue : min)
      }}
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

function VwapStylePanel({
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
      <h3 className="ff-indicators-style-panel-v1__subhead">{vwapStyleText.outputValues}</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-vwap-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">{vwapStyleText.precision}</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect
            ariaLabel="VWAP precision"
            onChange={(value) => patch({ precision: value as RsiPrecision })}
            options={vwapPrecisionOptions}
            value={settings.precision}
          />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label={vwapStyleText.priceScaleLabels} onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label={vwapStyleText.statusLineValues} onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">{vwapStyleText.inputValues}</h3>
      <CheckControl checked={settings.inputsInStatusLine} label={vwapStyleText.inputsInStatusLine} onChange={(inputsInStatusLine) => patch({ inputsInStatusLine })} />
    </div>
  )
}

function StochInputPanel({
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

function MacdInputPanel({
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

function MacdStylePanel({
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
      <h3 className="ff-indicators-style-panel-v1__subhead">输出值</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-macd-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">精确度</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect ariaLabel="MACD precision" onChange={(value) => patch({ precision: value as RsiPrecision })} options={precisionOptions} value={settings.precision} />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label="价格坐标上的标签" onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label="状态行中的值" onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">输入值</h3>
      <CheckControl checked={settings.inputStatusLineVisible} label="状态行中的输入" onChange={(inputStatusLineVisible) => patch({ inputStatusLineVisible })} />
    </div>
  )
}

function TsiInputPanel({
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

function TsiStylePanel({
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
      <h3 className="ff-indicators-style-panel-v1__subhead">输出值</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-tsi-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">精确度</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect ariaLabel="TSI precision" onChange={(value) => patch({ precision: value as RsiPrecision })} options={precisionOptions} value={settings.precision} />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label="价格坐标上的标签" onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label="状态行中的值" onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">输入值</h3>
      <CheckControl checked={settings.inputStatusLineVisible} label="状态行中的输入" onChange={(inputStatusLineVisible) => patch({ inputStatusLineVisible })} />
    </div>
  )
}

function ViInputPanel({
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

function ViStylePanel({
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
      <h3 className="ff-indicators-style-panel-v1__subhead">输出值</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-vi-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">精确度</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect ariaLabel="VI precision" onChange={(value) => patch({ precision: value as RsiPrecision })} options={precisionOptions} value={settings.precision} />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label="价格坐标上的标签" onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label="状态行中的值" onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">输入值</h3>
      <CheckControl checked={settings.inputStatusLineVisible} label="状态行中的输入" onChange={(inputStatusLineVisible) => patch({ inputStatusLineVisible })} />
    </div>
  )
}

function StochStylePanel({
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
        <CheckControl checked={settings.backgroundFillVisible} label={stochText.backgroundFill} onChange={(backgroundFillVisible) => patch({ backgroundFillVisible })} />
        <SettingsColorSwatch
          checkerboard
          color={settings.backgroundFillColor}
          onChange={(value) => patch({ backgroundFillColor: value.hex, backgroundFillOpacity: value.opacity })}
          value={{ hex: settings.backgroundFillColor, opacity: settings.backgroundFillOpacity }}
        />
      </div>
      <h3 className="ff-indicators-style-panel-v1__subhead">{stochText.outputValues}</h3>
      <label className="ff-indicators-input-panel-v1__row ff-indicators-stoch-style-panel-v1__precision-row">
        <span className="ff-indicators-input-panel-v1__label">{stochText.precision}</span>
        <span className="ff-indicators-input-panel-v1__control ff-indicators-input-panel-v1__control--wide">
          <OpenableSelect ariaLabel="Stoch precision" onChange={(value) => patch({ precision: value as RsiPrecision })} options={precisionOptions} value={settings.precision} />
        </span>
      </label>
      <CheckControl checked={settings.priceScaleLabelsVisible} label={stochText.priceScaleLabels} onChange={(priceScaleLabelsVisible) => patch({ priceScaleLabelsVisible })} />
      <CheckControl checked={settings.statusLineValuesVisible} label={stochText.statusLineValues} onChange={(statusLineValuesVisible) => patch({ statusLineValuesVisible })} />
      <h3 className="ff-indicators-style-panel-v1__subhead">{stochText.inputValues}</h3>
      <CheckControl checked={settings.inputStatusLineVisible} label={stochText.inputsInStatusLine} onChange={(inputStatusLineVisible) => patch({ inputStatusLineVisible })} />
    </div>
  )
}

function VwapInputPanel({
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

export function LoadedIndicatorSettingsPanel({
  macdSettings,
  maSettings,
  onMacdSettingsChange,
  onMaSettingsChange,
  onSettingsChange,
  onStochSettingsChange,
  onTsiSettingsChange,
  onViSettingsChange,
  onVolSettingsChange,
  onVwapSettingsChange,
  settingsTab,
  selectedKey,
  settings,
  stochSettings,
  tsiSettings,
  viSettings,
  volSettings,
  vwapSettings,
}: {
  macdSettings: MacdIndicatorSettings
  maSettings: MaIndicatorSettings
  onMacdSettingsChange: (settings: MacdIndicatorSettings) => void
  onMaSettingsChange: (settings: MaIndicatorSettings) => void
  onSettingsChange: (settings: RsiIndicatorSettings) => void
  onStochSettingsChange: (settings: StochIndicatorSettings) => void
  onTsiSettingsChange: (settings: TsiIndicatorSettings) => void
  onViSettingsChange: (settings: ViIndicatorSettings) => void
  onVolSettingsChange: (settings: VolIndicatorSettings) => void
  onVwapSettingsChange: (settings: VwapIndicatorSettings) => void
  settingsTab: IndicatorSettingsTab
  selectedKey: string
  settings: RsiIndicatorSettings
  stochSettings: StochIndicatorSettings
  tsiSettings: TsiIndicatorSettings
  viSettings: ViIndicatorSettings
  volSettings: VolIndicatorSettings
  vwapSettings: VwapIndicatorSettings
}) {
  return (
    <>
      {selectedKey === 'RSI' && settingsTab === 'input' ? <RsiInputPanel onSettingsChange={onSettingsChange} settings={settings} /> : null}
      {selectedKey === 'RSI' && settingsTab === 'style' ? <RsiStylePanel onSettingsChange={onSettingsChange} settings={settings} /> : null}
      {selectedKey === 'Stoch' && settingsTab === 'input' ? <StochInputPanel onSettingsChange={onStochSettingsChange} settings={stochSettings} /> : null}
      {selectedKey === 'Stoch' && settingsTab === 'style' ? <StochStylePanel onSettingsChange={onStochSettingsChange} settings={stochSettings} /> : null}
      {selectedKey === 'MACD' && settingsTab === 'input' ? <MacdInputPanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} /> : null}
      {selectedKey === 'MACD' && settingsTab === 'style' ? <MacdStylePanel onSettingsChange={onMacdSettingsChange} settings={macdSettings} /> : null}
      {selectedKey === 'TSI' && settingsTab === 'input' ? <TsiInputPanel onSettingsChange={onTsiSettingsChange} settings={tsiSettings} /> : null}
      {selectedKey === 'TSI' && settingsTab === 'style' ? <TsiStylePanel onSettingsChange={onTsiSettingsChange} settings={tsiSettings} /> : null}
      {selectedKey === 'VI' && settingsTab === 'input' ? <ViInputPanel onSettingsChange={onViSettingsChange} settings={viSettings} /> : null}
      {selectedKey === 'VI' && settingsTab === 'style' ? <ViStylePanel onSettingsChange={onViSettingsChange} settings={viSettings} /> : null}
      {selectedKey === 'MA' && settingsTab === 'input' ? <MaInputPanel onSettingsChange={onMaSettingsChange} settings={maSettings} /> : null}
      {selectedKey === 'MA' && settingsTab === 'style' ? <MaStylePanel onSettingsChange={onMaSettingsChange} settings={maSettings} /> : null}
      {selectedKey === 'VWAP' && settingsTab === 'input' ? <VwapInputPanel onSettingsChange={onVwapSettingsChange} settings={vwapSettings} /> : null}
      {selectedKey === 'VWAP' && settingsTab === 'style' ? <VwapStylePanel onSettingsChange={onVwapSettingsChange} settings={vwapSettings} /> : null}
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
