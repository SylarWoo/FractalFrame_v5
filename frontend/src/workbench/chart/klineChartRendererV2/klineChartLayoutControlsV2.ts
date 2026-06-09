import type { Chart } from 'klinecharts'
import type { LayoutChild } from 'klinecharts'
import type { PaneOptions } from 'klinecharts'
import {
  applyCrosshairLineStyle,
  applyGridStyle,
  applyPaneSeparatorStyle,
} from '../chartCrosshairStyles'
import { applyIndicatorTooltipStyle, createChartBaseStyles } from '../chartBaseStyles'
import { formatChartDate, readChartTimezone } from '../chartTimeFormatting'
import { kLineChartRealtimeXAxisNameV2, registerKLineChartRealtimeXAxisV2 } from './klineChartRealtimeXAxisV2'
import type { KLineChartDisplayContext } from './klineChartDisplayTypes'
import { applyKLineChartMainContainerSettingsWithContextV2 } from './klineChartMainContainerSettingsV2'

const bottomPanePosition = 'bottom' as PaneOptions['position']

export function createKLineChartLayoutInitOptionsV2() {
  registerKLineChartRealtimeXAxisV2()
  const layout: LayoutChild[] = [
    { type: 'candle' as LayoutChild['type'], options: { id: 'candle_pane' } },
    {
      type: 'xAxis' as LayoutChild['type'],
      options: {
        axisOptions: { name: kLineChartRealtimeXAxisNameV2 },
        position: bottomPanePosition,
      },
    },
  ]
  return {
    customApi: { formatDate: formatChartDate },
    layout,
    styles: createChartBaseStyles(),
    timezone: readChartTimezone(),
  }
}

export function applyKLineChartLayoutControlsV2(chart: Chart, context?: KLineChartDisplayContext) {
  chart.setTimezone(readChartTimezone())
  chart.setCustomApi({ formatDate: formatChartDate })
  applyGridStyle(chart)
  applyPaneSeparatorStyle(chart)
  applyIndicatorTooltipStyle(chart)
  applyCrosshairLineStyle(chart)
  applyKLineChartMainContainerSettingsWithContextV2(chart, {
    realtimeVisualOpen: context?.realtimeVisualOpen,
  })
}
