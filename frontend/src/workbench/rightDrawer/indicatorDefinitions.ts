import type { IndicatorTableRow } from './IndicatorsTable'

export type SupportedChartIndicator = 'MA' | 'MACD' | 'RSI' | 'Stoch' | 'TSI' | 'VI' | 'VWAP' | 'Vol'

export const indicatorRows: IndicatorTableRow[] = [
  { key: 'RSI', name: '相对强弱指数', type: '副图指标', description: 'Relative Strength Index' },
  { key: 'Stoch', name: '随机指标', type: '副图指标', description: 'Stochastic' },
  { key: 'MACD', name: '平滑异同移动平均线', type: '副图指标', description: 'Moving Average Convergence Divergence' },
  { key: 'TSI', name: '真实强弱指数', type: '副图指标', description: 'True Strength Index: 基于双 EMA 平滑动量的趋势强弱指标。' },
  { key: 'VI', name: '漩涡指标', type: '副图指标', description: 'Vortex Indicator' },
  { key: 'MA', name: '移动平均线', type: '主图指标', description: 'Moving Average: 基于价格源计算的趋势均线，叠加在主图价格区。' },
  { key: 'VWAP', name: '成交量加权平均价', type: '主图指标', description: 'Volume Weighted Average Price: 按成交量加权的平均价格。' },
  { key: 'Vol', name: '成交量', type: '主图指标', description: 'MT5 tick volume: 周期内跳动次数形成的柱。' },
]

export function isSupportedChartIndicator(key: string): key is SupportedChartIndicator {
  return key === 'MA' || key === 'MACD' || key === 'RSI' || key === 'Stoch' || key === 'TSI' || key === 'VI' || key === 'VWAP' || key === 'Vol'
}

export function resolveInitialSelectedKey(value: string) {
  return indicatorRows.some((row) => row.key === value) ? value : 'RSI'
}
