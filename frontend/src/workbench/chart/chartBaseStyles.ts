import { LineType, TooltipShowRule } from 'klinecharts'
import type { Chart } from 'klinecharts'
import {
  chartNumberFontFamily,
  chartNumberFontWeight,
  readAxisLineColor,
  readAxisTextColor,
  readAxisTextSize,
} from './chartStyleReaders'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

function readIndicatorTooltipShowRule() {
  return readSettingsBooleanValue(
    chartSettingKeys.statusIndicatorTooltipVisible,
    chartSettingDefaults.statusIndicatorTooltipVisible,
  ) ? TooltipShowRule.Always : TooltipShowRule.None
}

export function applyIndicatorTooltipStyle(chart: Chart) {
  chart.setStyles({
    indicator: {
      tooltip: {
        showRule: readIndicatorTooltipShowRule(),
        text: {
          marginLeft: 8,
          marginRight: 0,
        },
      },
    },
  })
}

export function createChartBaseStyles() {
  return {
    grid: {
      horizontal: { color: '#eef2f7', dashedValue: [2, 2], show: true, size: 1, style: LineType.Solid },
      vertical: { color: '#eef2f7', dashedValue: [2, 2], show: true, size: 1, style: LineType.Solid },
    },
    separator: {
      activeBackgroundColor: 'rgba(33, 150, 243, 0.08)',
      color: '#858b98',
      fill: true,
      size: 1,
    },
    crosshair: {
      horizontal: {
        text: {
          backgroundColor: '#131722',
          borderColor: '#131722',
          borderRadius: 0,
          color: '#ffffff',
          family: chartNumberFontFamily,
          paddingBottom: 2,
          paddingLeft: 6,
          paddingRight: 7,
          paddingTop: 4,
          weight: chartNumberFontWeight,
        },
      },
      vertical: {
        text: {
          backgroundColor: '#131722',
          borderColor: '#131722',
          borderRadius: 0,
          color: '#ffffff',
          family: chartNumberFontFamily,
          paddingBottom: 3,
          paddingLeft: 9,
          paddingRight: 9,
          paddingTop: 8,
          weight: chartNumberFontWeight,
        },
      },
    },
    xAxis: {
      axisLine: { color: readAxisLineColor(), show: true, size: 1 },
      size: 27,
      tickLine: { color: readAxisLineColor(), length: 3, show: true, size: 1 },
      tickText: {
        color: readAxisTextColor(),
        family: chartNumberFontFamily,
        marginEnd: 4,
        marginStart: 4,
        size: readAxisTextSize(),
        weight: chartNumberFontWeight,
      },
    },
    yAxis: {
      axisLine: { color: readAxisLineColor(), show: true, size: 1 },
      size: 'auto' as const,
      tickLine: { color: readAxisLineColor(), length: 3, show: true, size: 1 },
      tickText: {
        color: readAxisTextColor(),
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size: readAxisTextSize(),
        weight: chartNumberFontWeight,
      },
    },
    indicator: {
      tooltip: {
        showRule: readIndicatorTooltipShowRule(),
        text: {
          marginLeft: 8,
          marginRight: 0,
        },
      },
    },
  }
}
