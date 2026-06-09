import type { Chart } from 'klinecharts'
import { installKLineChartYAxisInteractionCoreV2 } from './klineChartYAxisLifecycleCoreV2'

const candlePaneId = 'candle_pane'

export function installKLineChartMainYAxisInteractionV2(
  chart: Chart,
  options: { onRangeChange?: () => void } = {},
) {
  return installKLineChartYAxisInteractionCoreV2({
    chart,
    onRangeChange: () => options.onRangeChange?.(),
    paneIds: () => [candlePaneId],
  })
}
