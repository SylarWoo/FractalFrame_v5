import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'

export const priceMarkerHeightPx = 32
export const chartHostTopOffsetPx = 8

export function clampPriceMarkerTop(chart: Chart, y: number) {
  const mainDom = chart.getDom('candle_pane', DomPosition.Main)
  const mainHeight = mainDom?.getBoundingClientRect().height ?? Number.NaN
  const rawTop = y + chartHostTopOffsetPx
  if (!Number.isFinite(mainHeight) || mainHeight <= priceMarkerHeightPx) {
    return Math.max(chartHostTopOffsetPx + priceMarkerHeightPx / 2, rawTop)
  }
  const minTop = chartHostTopOffsetPx + priceMarkerHeightPx / 2
  const maxTop = chartHostTopOffsetPx + mainHeight - priceMarkerHeightPx / 2
  return Math.max(minTop, Math.min(rawTop, maxTop))
}
