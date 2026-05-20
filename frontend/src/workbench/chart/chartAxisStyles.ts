import { YAxisType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import {
  chartNumberFontFamily,
  chartNumberFontWeight,
  readAxisLineColor,
  readAxisTextColor,
  readAxisTextSize,
} from './chartStyleReaders'

export function resetYAxisAutoScale(chart: Chart) {
  const axisLineColor = readAxisLineColor()
  chart.setStyles({
    yAxis: {
      axisLine: { color: axisLineColor, show: true, size: 1 },
      size: 'auto' as const,
      tickLine: { color: axisLineColor, length: 3, show: true, size: 1 },
      tickText: {
        color: readAxisTextColor(),
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size: readAxisTextSize(),
        weight: chartNumberFontWeight,
      },
      type: YAxisType.Normal,
    },
  })
}

export function applyAxisTextStyle(chart: Chart) {
  const color = readAxisTextColor()
  const size = readAxisTextSize()
  chart.setStyles({
    xAxis: {
      tickText: { color, family: chartNumberFontFamily, marginEnd: 4, marginStart: 4, size, weight: chartNumberFontWeight },
    },
    yAxis: {
      tickText: { color, family: chartNumberFontFamily, marginEnd: 10, marginStart: 7, size, weight: chartNumberFontWeight },
    },
  })
}

export function applyAxisLineStyle(chart: Chart) {
  const color = readAxisLineColor()
  chart.setStyles({
    xAxis: {
      axisLine: { color, show: true, size: 1 },
      tickLine: { color, length: 3, show: true, size: 1 },
    },
    yAxis: {
      axisLine: { color, show: true, size: 1 },
      tickLine: { color, length: 3, show: true, size: 1 },
    },
  })
}
