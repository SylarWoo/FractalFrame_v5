import type { Chart } from 'klinecharts'
import { applySessionBreakIndicator } from '../sessionBreakIndicator'
import type { KLineChartDisplayContext } from './klineChartDisplayTypes'

export function applyKLineChartEventOverlayControlsV2(chart: Chart, context: KLineChartDisplayContext) {
  applySessionBreakIndicator(chart, context.symbol, context.period)
}
