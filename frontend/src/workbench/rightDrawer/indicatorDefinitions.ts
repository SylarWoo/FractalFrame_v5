import type { IndicatorTableRow } from './IndicatorsTable'

export const indicatorRows = [
  { key: 'RSI', name: '相对强弱指数', type: '副图指标', description: 'Relative Strength Index' },
  { key: 'Stoch', name: '随机指数', type: '副图指标', description: 'Stochastic' },
  { key: 'SQZMOM', name: 'SQZMOM - Squeeze Momentum', type: '副图指标', description: 'Squeeze Momentum Indicator [LazyBear]' },
  { key: 'MACD', name: '平滑异同移动平均线', type: '副图指标', description: 'Moving Average Convergence Divergence' },
  { key: 'DPO', name: '非趋势价格摆动指标', type: '副图指标', description: 'Detrended Price Oscillator' },
  { key: 'VDO', name: '漩涡差值指标', type: '副图指标', description: 'Vortex Difference Oscillator' },
  { key: 'AO', name: '动量震荡指标', type: '副图指标', description: 'Awesome Oscillator' },
  { key: 'VMI', name: '漩涡动量指标', type: '副图指标', description: 'VDO-based Momentum Indicator' },
  { key: 'TSI', name: '真实强弱指数', type: '副图指标', description: 'True Strength Index' },
  { key: 'VI', name: '漩涡指标', type: '副图指标', description: 'Vortex Indicator' },
  { key: 'MA', name: '移动均线', type: '主图指标', description: 'Moving Average' },
  { key: 'MR-M5', name: '\u6469\u6839\u533a\u95f4_5\u5206\u949f', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Range H4-M5' },
  { key: 'MR-M30', name: '\u6469\u6839\u533a\u95f4_30\u5206\u949f', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Range D1-M30' },
  { key: 'MMF_V3', name: 'MMF v3 - 日内交易系统', type: '主图指标', description: 'Morgan Momentum Fractal v3' },
  { key: 'VWAP', name: '成交量加权平均价', type: '主图指标', description: 'Volume Weighted Average Price' },
  { key: 'Vol', name: '成交量', type: '主图指标', description: 'MT5 tick volume' },
] as const satisfies readonly IndicatorTableRow[]

export type SupportedChartIndicator = typeof indicatorRows[number]['key']

const supportedChartIndicatorKeys = new Set<string>(indicatorRows.map((row) => row.key))

export function isSupportedChartIndicator(key: string): key is SupportedChartIndicator {
  return supportedChartIndicatorKeys.has(key)
}

export function resolveInitialSelectedKey(value: string) {
  return indicatorRows.some((row) => row.key === value) ? value : 'RSI'
}
