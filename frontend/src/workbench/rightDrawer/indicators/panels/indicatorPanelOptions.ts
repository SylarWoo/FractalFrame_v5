import type {
  MacdMaType,
  MaMarkerMode,
  MaSource,
  MaType,
  RsiPrecision,
  RsiSmoothingType,
  RsiSource,
  VwapAnchorPeriod,
  VwapBandCalculationMode,
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
  { value: 'hlc3', label: '(高 + 低 + 收盘) / 3' },
  { value: 'close', label: '收盘价' },
  { value: 'open', label: '开盘价' },
  { value: 'high', label: '最高价' },
  { value: 'low', label: '最低价' },
  { value: 'hl2', label: '(高 + 低) / 2' },
  { value: 'ohlc4', label: '(开 + 高 + 低 + 收) / 4' },
]

export const vwapBandCalculationModeOptions: Array<{ label: string; value: VwapBandCalculationMode }> = [
  { value: 'standard_deviation', label: '标准偏差' },
  { value: 'percentage', label: '百分比' },
]

export const vwapTimeframeOptions: Array<{ label: string; value: VwapTimeframe }> = [
  { value: 'chart', label: '图表' },
  { value: '1m', label: '1 分钟' },
  { value: '5m', label: '5 分钟' },
  { value: '15m', label: '15 分钟' },
  { value: '30m', label: '30 分钟' },
  { value: '1h', label: '1 小时' },
  { value: '4h', label: '4 小时' },
  { value: '1d', label: '1 天' },
]

export const vwapText = {
  band1: '带系数#1',
  band2: '带系数#2',
  band3: '带系数#3',
  bandCalculationMode: '带计算模式',
  bandCalculationModeInfo: 'TradingView VWAP Bands 的计算方式。',
  bands: '带设置',
  calculation: '计算',
  hideOnDailyOrAbove: '隐藏1D或以上VWAP',
  offset: '偏移',
  period: '锚定时段',
  settings: 'VWAP设置',
  source: '来源',
  timeframe: '时间周期',
  timeframeInfo: '当前先按图表周期计算，控件状态会被保存。',
  waitForTimeframeClose: '等待时间周期结束',
}

export const vwapStyleText = {
  bandsFill1: 'Bands Fill #1',
  inputValues: '输入值',
  inputsInStatusLine: '状态行中的输入',
  lowerBand1: 'Lower Band #1',
  outputValues: '输出值',
  precision: '精确度',
  priceScaleLabels: '价格坐标上的标签',
  statusLineValues: '状态行中的值',
  upperBand1: 'Upper Band #1',
  vwap: '成交量加权平均价',
}

export const vwapPrecisionOptions: Array<{ label: string; value: RsiPrecision }> = precisionOptions

export const stochText = {
  d: '%D',
  dSmoothing: '%D Smoothing',
  inputValues: '输入值',
  inputsInStatusLine: '状态行中的输入',
  k: '%K',
  kLength: '%K Length',
  kSmoothing: '%K Smoothing',
  lowerBand: 'Lower Band',
  lowerBand2Level: 'Lower Band 2 level',
  lowerBand3Level: 'Lower Band 3 level',
  outputValues: '输出值',
  precision: '精确度',
  priceScaleLabels: '价格坐标上的标签',
  settings: 'Stoch 设置',
  statusLineValues: '状态行中的值',
  upperBand: 'Upper Band',
  upperBand2Level: 'Upper Band 2 level',
  upperBand3Level: 'Upper Band 3 level',
  backgroundFill: 'Background Fill',
  backgroundFillLower: 'Background Fill Lower',
  backgroundFillUpper: 'Background Fill Upper',
}
