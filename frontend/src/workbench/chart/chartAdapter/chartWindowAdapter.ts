import type { Chart } from 'klinecharts'
import { applyNewDataWithFuturePlaceholders, stripFuturePlaceholders } from '../chartFuturePlaceholders'
import type { ChartPageWindow } from '../pageWindow/chartPageWindow'

export type ChartWindowAdapterApplyResult = {
  activeWindowKey: string
  rows: number
}

export function applyChartPageWindow(
  chart: Chart,
  window: ChartPageWindow,
  options: { hasMoreOlder?: boolean } = {},
): ChartWindowAdapterApplyResult {
  applyNewDataWithFuturePlaceholders(chart, window.displayRows, window.period, options.hasMoreOlder ?? false)
  return {
    activeWindowKey: window.key,
    rows: stripFuturePlaceholders(chart.getDataList()).length || window.displayRows.length,
  }
}
