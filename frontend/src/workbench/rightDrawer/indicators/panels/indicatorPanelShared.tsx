/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react'

import type {
  MacdIndicatorSettings,
  MacdMaType,
  DpoIndicatorSettings,
  MaIndicatorSettings,
  MaMarkerMode,
  MaSource,
  MaType,
  MrIndicatorSettings,
  RsiIndicatorSettings,
  RsiPrecision,
  RsiSmoothingType,
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
export const rsiSourceOptions: Array<{ label: string; value: RsiSource }> = [
  { value: 'close', label: '收盘价' },
  { value: 'open', label: '开盘价' },
  { value: 'high', label: '最高价' },
  { value: 'low', label: '最低价' },
  { value: 'hl2', label: 'HL2' },
  { value: 'hlc3', label: 'HLC3' },
  { value: 'ohlc4', label: 'OHLC4' },
]

export const rsiSmoothingOptions: Array<{ label: string; value: RsiSmoothingType }> = [
  { value: 'none', label: '无' },
  { value: 'sma', label: 'SMA' },
  { value: 'sma_bb', label: 'SMA + 布林带' },
  { value: 'ema', label: 'EMA' },
  { value: 'smma', label: 'SMMA (RMA)' },
  { value: 'wma', label: 'WMA' },
  { value: 'vwma', label: 'VWMA' },
]

export const macdMaTypeOptions: Array<{ label: string; value: MacdMaType }> = [
  { value: 'ema', label: 'EMA' },
  { value: 'sma', label: 'SMA' },
]

export const precisionOptions: Array<{ label: string; value: RsiPrecision }> = [
  { value: 'system', label: '系统预设' },
  { value: '0', label: '0 位小数' },
  { value: '1', label: '1 位小数' },
  { value: '2', label: '2 位小数' },
  { value: '3', label: '3 位小数' },
  { value: '4', label: '4 位小数' },
]

export const maTypeOptions: Array<{ label: string; value: MaType }> = [
  { value: 'sma', label: 'SMA' },
  { value: 'ema', label: 'EMA' },
  { value: 'smma', label: 'SMMA' },
  { value: 'wma', label: 'WMA' },
  { value: 'vwma', label: 'VWMA' },
]

export const maSourceOptions: Array<{ label: string; value: MaSource }> = [
  { value: 'close', label: '收盘价' },
  { value: 'open', label: '开盘价' },
  { value: 'high', label: '最高价' },
  { value: 'low', label: '最低价' },
  { value: 'hl2', label: '(高 + 低) / 2' },
  { value: 'hlc3', label: '(高 + 低 + 收) / 3' },
  { value: 'ohlc4', label: '(开 + 高 + 低 + 收) / 4' },
]

export const maMarkerModeOptions: Array<{ label: string; value: MaMarkerMode }> = [
  { value: 'bar_down', label: 'Bar 下方' },
  { value: 'bar_up', label: 'Bar 上方' },
  { value: 'triangle_down', label: '三角 下方' },
  { value: 'triangle_up', label: '三角 上方' },
]

export const vwapAnchorPeriodOptions: Array<{ label: string; value: VwapAnchorPeriod }> = [
  { value: 'session', label: 'Session' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'decade', label: 'Decade' },
  { value: 'century', label: 'Century' },
]

export const vwapSourceOptions: Array<{ label: string; value: VwapSource }> = [
  { value: 'hlc3', label: '(\u9ad8 + \u4f4e + \u6536\u76d8) / 3' },
  { value: 'close', label: '\u6536\u76d8\u4ef7' },
  { value: 'open', label: '\u5f00\u76d8\u4ef7' },
  { value: 'high', label: '\u6700\u9ad8\u4ef7' },
  { value: 'low', label: '\u6700\u4f4e\u4ef7' },
  { value: 'hl2', label: '(\u9ad8 + \u4f4e) / 2' },
  { value: 'ohlc4', label: '(\u5f00 + \u9ad8 + \u4f4e + \u6536) / 4' },
]

export const vwapBandCalculationModeOptions: Array<{ label: string; value: VwapBandCalculationMode }> = [
  { value: 'standard_deviation', label: '\u6807\u51c6\u504f\u5dee' },
  { value: 'percentage', label: '\u767e\u5206\u6bd4' },
]

export const vwapTimeframeOptions: Array<{ label: string; value: VwapTimeframe }> = [
  { value: 'chart', label: '\u56fe\u8868' },
  { value: '1m', label: '1 \u5206\u949f' },
  { value: '5m', label: '5 \u5206\u949f' },
  { value: '15m', label: '15 \u5206\u949f' },
  { value: '30m', label: '30 \u5206\u949f' },
  { value: '1h', label: '1 \u5c0f\u65f6' },
  { value: '4h', label: '4 \u5c0f\u65f6' },
  { value: '1d', label: '1 \u5929' },
]

export const vwapText = {
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

export const vwapStyleText = {
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

export const vwapPrecisionOptions: Array<{ label: string; value: RsiPrecision }> = [
  { value: 'system', label: '\u7cfb\u7edf\u9884\u8bbe' },
  { value: '0', label: '0 \u4f4d\u5c0f\u6570' },
  { value: '1', label: '1 \u4f4d\u5c0f\u6570' },
  { value: '2', label: '2 \u4f4d\u5c0f\u6570' },
  { value: '3', label: '3 \u4f4d\u5c0f\u6570' },
  { value: '4', label: '4 \u4f4d\u5c0f\u6570' },
]

export const stochText = {
  d: '%D',
  dSmoothing: '%D Smoothing',
  inputValues: '\u8f93\u5165\u503c',
  inputsInStatusLine: '\u72b6\u6001\u884c\u4e2d\u7684\u8f93\u5165',
  k: '%K',
  kLength: '%K Length',
  kSmoothing: '%K Smoothing',
  lowerBand: 'Lower Band',
  lowerBand2Level: 'Lower Band 2 level',
  outputValues: '\u8f93\u51fa\u503c',
  precision: '\u7cbe\u786e\u5ea6',
  priceScaleLabels: '\u4ef7\u683c\u5750\u6807\u4e0a\u7684\u6807\u7b7e',
  settings: 'Stoch \u8bbe\u7f6e',
  statusLineValues: '\u72b6\u6001\u884c\u4e2d\u7684\u503c',
  upperBand: 'Upper Band',
  upperBand2Level: 'Upper Band 2 level',
  backgroundFill: 'Background Fill',
  backgroundFillLower: 'Background Fill Lower',
  backgroundFillUpper: 'Background Fill Upper',
}


export function InfoBadge({ title }: { title: string }) {
  return <span className="ff-indicators-input-panel-v1__info" title={title}>i</span>
}

export function updateSettings(
  current: RsiIndicatorSettings,
  patch: Partial<RsiIndicatorSettings>,
): RsiIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMaSettings(
  current: MaIndicatorSettings,
  patch: Partial<MaIndicatorSettings>,
): MaIndicatorSettings {
  return { ...current, ...patch }
}

export function updateVwapSettings(
  current: VwapIndicatorSettings,
  patch: Partial<VwapIndicatorSettings>,
): VwapIndicatorSettings {
  return { ...current, ...patch }
}

export function updateStochSettings(
  current: StochIndicatorSettings,
  patch: Partial<StochIndicatorSettings>,
): StochIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMacdSettings(
  current: MacdIndicatorSettings,
  patch: Partial<MacdIndicatorSettings>,
): MacdIndicatorSettings {
  return { ...current, ...patch }
}

export function updateTsiSettings(
  current: TsiIndicatorSettings,
  patch: Partial<TsiIndicatorSettings>,
): TsiIndicatorSettings {
  return { ...current, ...patch }
}

export function updateViSettings(
  current: ViIndicatorSettings,
  patch: Partial<ViIndicatorSettings>,
): ViIndicatorSettings {
  return { ...current, ...patch }
}

export function updateDpoSettings(
  current: DpoIndicatorSettings,
  patch: Partial<DpoIndicatorSettings>,
): DpoIndicatorSettings {
  return { ...current, ...patch }
}

export function updateVdoSettings(
  current: VdoIndicatorSettings,
  patch: Partial<VdoIndicatorSettings>,
): VdoIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMrSettings(
  current: MrIndicatorSettings,
  patch: Partial<MrIndicatorSettings>,
): MrIndicatorSettings {
  return { ...current, ...patch }
}

export function CheckControl({
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

export function NumberBox({
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
  const [text, setText] = useState(String(value))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (focusedRef.current) return
    setText(String(value))
  }, [value])

  const commitText = (nextText: string) => {
    const nextValue = Number(nextText)
    if (nextText === '' || nextText === '-' || nextText === '+' || !Number.isFinite(nextValue)) return
    onChange(Math.max(min, Math.min(max, nextValue)))
  }

  return (
    <input
      className="ff-indicators-number-box-v1"
      inputMode="decimal"
      max={max}
      min={min}
      onChange={(event) => {
        const nextText = event.target.value
        setText(nextText)
        commitText(nextText)
      }}
      onBlur={() => {
        focusedRef.current = false
        const nextValue = Number(text)
        if (text === '' || text === '-' || text === '+' || !Number.isFinite(nextValue)) {
          setText(String(value))
          return
        }
        const clampedValue = Math.max(min, Math.min(max, nextValue))
        setText(String(clampedValue))
        onChange(clampedValue)
      }}
      onFocus={() => {
        focusedRef.current = true
      }}
      step={step}
      type="text"
      value={text}
    />
  )
}

