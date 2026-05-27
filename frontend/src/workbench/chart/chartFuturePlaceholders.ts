import { ActionType } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { resolvePeriodSeconds } from './chartTimeFormatting'

export const futurePlaceholderFlag = '__ffFuturePlaceholder'
const futurePlaceholderDays = 2
const maxFuturePlaceholderBars = 3000

export type FuturePlaceholderKLineData = KLineData & {
  [futurePlaceholderFlag]?: true
}

export function isFuturePlaceholder(row: unknown): row is FuturePlaceholderKLineData {
  return Boolean(row && typeof row === 'object' && (row as Record<string, unknown>)[futurePlaceholderFlag] === true)
}

export function stripFuturePlaceholders<T extends KLineData>(rows: T[]) {
  return rows.filter((row) => !isFuturePlaceholder(row))
}

export function lastRealKLine(rows: KLineData[]) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]
    if (!isFuturePlaceholder(row)) return row
  }
  return null
}

export function readRightPlaceholderVisible() {
  return readSettingsBooleanValue(
    chartSettingKeys.rightPlaceholderVisible,
    chartSettingDefaults.rightPlaceholderVisible,
  )
}

export function resolveFuturePlaceholderCount(period: string) {
  const periodSeconds = resolvePeriodSeconds(period)
  if (!Number.isFinite(periodSeconds) || periodSeconds <= 0) return 0
  return Math.max(0, Math.min(maxFuturePlaceholderBars, Math.ceil((futurePlaceholderDays * 24 * 60 * 60) / periodSeconds)))
}

export function appendFuturePlaceholders(rows: KLineData[], period: string, enabled = readRightPlaceholderVisible()) {
  void period
  const realRows = stripFuturePlaceholders(rows)
  if (!enabled || realRows.length === 0) return realRows

  return realRows
}

export function applyRightPlaceholderOffset(chart: Chart, period: string) {
  void chart
  void period
  // Intentionally no-op: KLineCharts right-offset APIs switch the chart into
  // distance-limited scrolling, which breaks the existing free right-drag.
}

export function applyNewDataWithFuturePlaceholders(chart: Chart, rows: KLineData[], period: string, more?: boolean, callback?: () => void) {
  if (callback) {
    const handleDataReady = () => {
      chart.unsubscribeAction(ActionType.OnDataReady, handleDataReady)
      callback()
    }
    chart.subscribeAction(ActionType.OnDataReady, handleDataReady)
  }
  chart.applyNewData(appendFuturePlaceholders(rows, period), more)
}

export function refreshChartFuturePlaceholders(chart: Chart, period: string) {
  const currentRows = chart.getDataList()
  const realRows = stripFuturePlaceholders(currentRows)
  if (realRows.length !== currentRows.length) {
    applyNewDataWithFuturePlaceholders(chart, realRows, period, false)
  }
}

export function calculateWithoutFuturePlaceholders<T>(
  dataList: KLineData[],
  calculate: (realRows: KLineData[]) => T[],
) {
  const realRows = stripFuturePlaceholders(dataList)
  const realResult = calculate(realRows)
  const result: Array<T | undefined> = []
  let realIndex = 0
  for (const row of dataList) {
    if (isFuturePlaceholder(row)) {
      result.push(undefined)
    } else {
      result.push(realResult[realIndex])
      realIndex += 1
    }
  }
  return result as T[]
}
