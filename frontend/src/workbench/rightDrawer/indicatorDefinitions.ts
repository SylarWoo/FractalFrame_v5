import type { IndicatorTableRow } from './IndicatorsTable'

export const indicatorRows = [
  { key: 'RSI', name: '\u76f8\u5bf9\u5f3a\u5f31\u6307\u6570', type: '\u526f\u56fe\u6307\u6807', description: 'Relative Strength Index' },
  { key: 'Stoch', name: '\u968f\u673a\u6307\u6570', type: '\u526f\u56fe\u6307\u6807', description: 'Stochastic' },
  { key: 'SQZMOM', name: 'SQZMOM - Squeeze Momentum', type: '\u526f\u56fe\u6307\u6807', description: 'Squeeze Momentum Indicator [LazyBear]' },
  { key: 'MACD', name: '\u5e73\u6ed1\u5f02\u540c\u79fb\u52a8\u5e73\u5747\u7ebf', type: '\u526f\u56fe\u6307\u6807', description: 'Moving Average Convergence Divergence' },
  { key: 'DPO', name: '\u975e\u8d8b\u52bf\u4ef7\u683c\u6446\u52a8\u6307\u6807', type: '\u526f\u56fe\u6307\u6807', description: 'Detrended Price Oscillator' },
  { key: 'VDO', name: '\u6da1\u6da8\u5dee\u503c\u6307\u6807', type: '\u526f\u56fe\u6307\u6807', description: 'Vortex Difference Oscillator' },
  { key: 'AO', name: '\u52a8\u91cf\u9707\u8361\u6307\u6807', type: '\u526f\u56fe\u6307\u6807', description: 'Awesome Oscillator' },
  { key: 'VMI', name: '\u6da1\u6da8\u52a8\u91cf\u6307\u6807', type: '\u526f\u56fe\u6307\u6807', description: 'VDO-based Momentum Indicator' },
  { key: 'MMAD', name: '\u6469\u6839\u52a8\u91cf\u7d2f\u79ef\u6d3e\u53d1\u7ebf', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Momentum A/D' },
  { key: 'TSI', name: '\u771f\u5b9e\u5f3a\u5f31\u6307\u6570', type: '\u526f\u56fe\u6307\u6807', description: 'True Strength Index' },
  { key: 'VI', name: '\u6da1\u6da8\u6307\u6807', type: '\u526f\u56fe\u6307\u6807', description: 'Vortex Indicator' },
  { key: 'MA', name: '\u79fb\u52a8\u5747\u7ebf', type: '\u4e3b\u56fe\u6307\u6807', description: 'Moving Average' },
  { key: 'MR-M5', name: '\u6469\u6839\u533a\u95f4_5\u5206\u949f', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Range H4-M5' },
  { key: 'MR-M30', name: '\u6469\u6839\u533a\u95f4_30\u5206\u949f', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Range D1-M30' },
  { key: 'MR-H2', name: '\u6469\u6839\u533a\u95f4_2\u5c0f\u65f6', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Range D5-H2' },
  { key: 'MMF_V3', name: 'MMF v3 - \u65e5\u5185\u4ea4\u6613\u7cfb\u7edf', type: '\u4e3b\u56fe\u6307\u6807', description: 'Morgan Momentum Fractal v3' },
  { key: 'MMF_STOCH_H2', name: 'MMF-Stoch-H2', type: '\u526f\u56fe\u6307\u6807', description: 'MMF Stoch H2' },
  { key: 'VWAP', name: '\u6210\u4ea4\u91cf\u52a0\u6743\u5e73\u5747\u4ef7', type: '\u4e3b\u56fe\u6307\u6807', description: 'Volume Weighted Average Price' },
  { key: 'Vol', name: '\u6210\u4ea4\u91cf', type: '\u4e3b\u56fe\u6307\u6807', description: 'MT5 tick volume' },
] as const satisfies readonly IndicatorTableRow[]

export type SupportedChartIndicator = typeof indicatorRows[number]['key']

const supportedChartIndicatorKeys = new Set<string>(indicatorRows.map((row) => row.key))

export function isSupportedChartIndicator(key: string): key is SupportedChartIndicator {
  return supportedChartIndicatorKeys.has(key)
}

export function resolveInitialSelectedKey(value: string) {
  return indicatorRows.some((row) => row.key === value) ? value : 'RSI'
}
