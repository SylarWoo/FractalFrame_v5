import type { Chart } from 'klinecharts'
import { kLineChartConfigV2 } from './klineChartConfigV2'

const candlePaneId = 'candle_pane'

export const kLineChartMainContainerSettingsV2 = {
  anchorRealtimeBoundaryOnFrameLoad: kLineChartConfigV2.viewport.anchorRealtimeBoundaryOnFrameLoad,
  maxOffsetLeftDistance: kLineChartConfigV2.viewport.maxOffsetLeftDistance,
  maxOffsetRightDistance: kLineChartConfigV2.viewport.maxOffsetRightDistance,
  restoreHorizontalViewportOnRefresh: kLineChartConfigV2.viewport.restoreHorizontalViewportOnRefresh,
  restoreYAxisOnRefresh: kLineChartConfigV2.viewport.restoreYAxisRangeOnRefresh,
} as const

export function applyKLineChartMainContainerSettingsV2(chart: Chart) {
  applyKLineChartMainContainerSettingsWithContextV2(chart, { realtimeVisualOpen: true })
}

export function applyKLineChartMainContainerSettingsWithContextV2(
  chart: Chart,
  options: { realtimeVisualOpen?: boolean } = {},
) {
  chart.setScrollEnabled?.(true)
  chart.setZoomEnabled?.(true)
  chart.setPaneOptions?.({
    axisOptions: {
      scrollZoomEnabled: true,
    },
    id: candlePaneId,
  })
  chart.setMaxOffsetLeftDistance?.(kLineChartMainContainerSettingsV2.maxOffsetLeftDistance)
  chart.setMaxOffsetRightDistance?.(
    options.realtimeVisualOpen === false
      ? kLineChartMainContainerSettingsV2.maxOffsetLeftDistance
      : kLineChartMainContainerSettingsV2.maxOffsetRightDistance,
  )
  if (options.realtimeVisualOpen === false) {
    chart.setOffsetRightDistance?.(0)
  }
}
