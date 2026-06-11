import type { Chart } from 'klinecharts'
import { applyNewDataWithFuturePlaceholders, stripFuturePlaceholders } from '../../chartFuturePlaceholders'
import type { ChartPageWindow } from '../pageWindow/chartPageWindow'

export type ChartWindowAdapterApplyResult = {
  activeWindowKey: string
  rows: number
}

const activeChartWindows = new WeakMap<Chart, ChartPageWindow>()

export function applyChartPageWindow(
  chart: Chart,
  window: ChartPageWindow,
  options: { hasMoreOlder?: boolean } = {},
): ChartWindowAdapterApplyResult {
  applyNewDataWithFuturePlaceholders(chart, window.displayRows, window.period, options.hasMoreOlder ?? false)
  activeChartWindows.set(chart, window)
  return {
    activeWindowKey: window.key,
    rows: stripFuturePlaceholders(chart.getDataList()).length || window.displayRows.length,
  }
}

export function updateChartPageWindowTail(chart: Chart, window: ChartPageWindow): ChartWindowAdapterApplyResult {
  const latest = window.displayRows[window.displayRows.length - 1]
  if (latest) chart.updateData(latest)
  activeChartWindows.set(chart, window)
  return {
    activeWindowKey: window.key,
    rows: stripFuturePlaceholders(chart.getDataList()).length || window.displayRows.length,
  }
}

export function clearChartPageWindow(chart: Chart, period: string): ChartWindowAdapterApplyResult {
  applyNewDataWithFuturePlaceholders(chart, [], period, false)
  activeChartWindows.delete(chart)
  return {
    activeWindowKey: '',
    rows: 0,
  }
}

export function readActiveChartPageWindow(chart: Chart) {
  return activeChartWindows.get(chart) ?? null
}
