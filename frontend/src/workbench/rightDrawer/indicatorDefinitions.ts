import type { IndicatorTableRow } from './IndicatorsTable'

export const indicatorRows = [
  { key: 'RSI', name: '相对强弱指数', type: '副图指标', description: 'Relative Strength Index' },
  { key: 'Stoch', name: '随机指标', type: '副图指标', description: 'Stochastic' },
  { key: 'MACD', name: '平滑异同移动平均线', type: '副图指标', description: 'Moving Average Convergence Divergence' },
  { key: 'DPO', name: '非趋势价格摆动指标', type: '副图指标', description: 'Detrended Price Oscillator' },
  { key: 'VDO', name: '漩涡差值指标', type: '副图指标', description: 'Vortex Difference Oscillator' },
  { key: 'TSI', name: '真实强弱指数', type: '副图指标', description: 'True Strength Index' },
  { key: 'VI', name: '漩涡指标', type: '副图指标', description: 'Vortex Indicator' },
  { key: 'MA', name: '移动平均线', type: '主图指标', description: 'Moving Average' },
  { key: 'MR', name: '摩根区间', type: '主图指标', description: 'Morgan Range' },
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
