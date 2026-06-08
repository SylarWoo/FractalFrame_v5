import type { Chart } from 'klinecharts'
import {
  applyCandleBarStyle,
  applyCandleTooltipStyle,
  applyLastPriceLineStyle,
  applyPriceVolumePrecision,
} from '../chartCandleStyles'
import type { KLineChartDisplayContext } from './klineChartDisplayTypes'

export function applyKLineChartCandleControlsV2(chart: Chart, context: KLineChartDisplayContext) {
  applyPriceVolumePrecision(chart, context.symbol)
  applyCandleBarStyle(chart)
  applyCandleTooltipStyle(chart, context.symbol, context.period, context.displayName)
  applyLastPriceLineStyle(chart, context.symbol)
}
