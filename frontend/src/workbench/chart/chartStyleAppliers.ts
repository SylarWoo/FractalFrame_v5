import { LineType, YAxisType } from 'klinecharts'
import type { CandleTooltipCustomCallbackData, Chart, KLineData } from 'klinecharts'
import { readSettingsNumberStringValue, readSettingsStringValue, readSettingsSymbolState } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

const chartNumberFontFamily = '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, Arial, sans-serif'
const chartNumberFontWeight = 400

type SettingsSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

function readSymbolLabelVisibleParts() {
  const visibleParts = readSettingsSymbolState()['coordinates.symbolLabel.visibleParts']
  return Array.isArray(visibleParts)
    ? visibleParts.filter((value): value is string => typeof value === 'string')
    : ['value', 'line']
}

function readAxisTextSize() {
  const raw = readSettingsStringValue('layout.axisText.size', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

function resolveSwatchColor(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as SettingsSwatchValue
  const hex = typeof swatch.hex === 'string' ? swatch.hex : fallback
  const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity)
    ? Math.max(0, Math.min(swatch.opacity, 1))
    : 1
  if (opacity >= 0.999) return hex
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function readAxisTextColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisText.color'], '#5f6675')
}

function readAxisLineColor() {
  return resolveSwatchColor(readSettingsSymbolState()['layout.axisLine.color'], '#858b98')
}

function readCandleBarStyle() {
  const state = readSettingsSymbolState()

  const bodyUp = resolveSwatchColor(state['candle.body.up'], '#26a69a')
  const bodyDown = resolveSwatchColor(state['candle.body.down'], '#ef5350')
  const borderUp = resolveSwatchColor(state['candle.border.up'], bodyUp)
  const borderDown = resolveSwatchColor(state['candle.border.down'], bodyDown)
  const wickUp = resolveSwatchColor(state['candle.wick.up'], bodyUp)
  const wickDown = resolveSwatchColor(state['candle.wick.down'], bodyDown)

  return {
    upColor: bodyUp,
    downColor: bodyDown,
    noChangeColor: '#888888',
    upBorderColor: borderUp,
    downBorderColor: borderDown,
    noChangeBorderColor: '#888888',
    upWickColor: wickUp,
    downWickColor: wickDown,
    noChangeWickColor: '#888888',
  }
}

function resolveCandleValueColor(data: KLineData, barStyle: ReturnType<typeof readCandleBarStyle>) {
  const open = Number(data.open)
  const close = Number(data.close)
  if (!Number.isFinite(open) || !Number.isFinite(close) || close === open) return barStyle.noChangeColor
  return close > open ? barStyle.upColor : barStyle.downColor
}

function readPricePrecision() {
  const raw = readSettingsNumberStringValue(chartSettingKeys.pricePrecision, chartSettingDefaults.pricePrecision)
  if (raw === 'system') return 3
  const precision = typeof raw === 'string' ? Number(raw) : 6
  return Number.isFinite(precision) ? Math.max(0, Math.min(Math.round(precision), 7)) : 6
}

function readHighLowTextSize() {
  const raw = readSettingsStringValue('coordinates.highLow.textSize', '12')
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 24)) : 12
}

function resolveLineStyle(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const lineStyle = swatch?.lineStyle
  if (lineStyle === 'dashed') return { dashedValue: [6, 4], style: LineType.Dashed }
  if (lineStyle === 'dotted') return { dashedValue: [1, 3], style: LineType.Dashed }
  return { dashedValue: [2, 2], style: LineType.Solid }
}

function resolveLineThickness(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsSwatchValue : null
  const thickness = typeof swatch?.thickness === 'number' && Number.isFinite(swatch.thickness) ? swatch.thickness : 1
  return Math.max(1, Math.min(Math.round(thickness), 4))
}

function resolveStatusTitle(symbol: string, displayName?: string) {
  const mode = readSettingsStringValue(chartSettingKeys.statusTitleMode, chartSettingDefaults.statusTitleMode)
  const name = displayName?.trim() || symbol
  if (mode === 'symbol') return symbol
  if (mode === 'name') return name
  return `${symbol} · ${name}`
}

export function resetYAxisAutoScale(chart: Chart) {
  const axisLineColor = readAxisLineColor()

  chart.setStyles({
    yAxis: {
      axisLine: {
        color: axisLineColor,
        show: true,
        size: 1,
      },
      size: 'auto' as const,
      tickLine: {
        color: axisLineColor,
        length: 3,
        show: true,
        size: 1,
      },
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

export function createChartBaseStyles() {
  return {
    grid: {
      horizontal: {
        color: '#eef2f7',
        dashedValue: [2, 2],
        show: true,
        size: 1,
        style: LineType.Solid,
      },
      vertical: {
        color: '#eef2f7',
        dashedValue: [2, 2],
        show: true,
        size: 1,
        style: LineType.Solid,
      },
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
      axisLine: {
        color: readAxisLineColor(),
        show: true,
        size: 1,
      },
      size: 27,
      tickLine: {
        color: readAxisLineColor(),
        length: 3,
        show: true,
        size: 1,
      },
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
      axisLine: {
        color: readAxisLineColor(),
        show: true,
        size: 1,
      },
      size: 'auto' as const,
      tickLine: {
        color: readAxisLineColor(),
        length: 3,
        show: true,
        size: 1,
      },
      tickText: {
        color: readAxisTextColor(),
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size: readAxisTextSize(),
        weight: chartNumberFontWeight,
      },
    },
  }
}

export function applyCandleBarStyle(chart: Chart) {
  chart.setStyles({
    candle: {
      bar: readCandleBarStyle(),
    },
  })
}

export function applyPriceVolumePrecision(chart: Chart) {
  chart.setPriceVolumePrecision(readPricePrecision(), 0)
}

export function applyGridStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const mode = typeof state['layout.grid.mode'] === 'string' ? state['layout.grid.mode'] : 'both'
  const verticalColor = resolveSwatchColor(state['layout.grid.vertical.color'], '#eef2f7')
  const horizontalColor = resolveSwatchColor(state['layout.grid.horizontal.color'], '#eef2f7')
  const showVertical = mode === 'both' || mode === 'vertical'
  const showHorizontal = mode === 'both' || mode === 'horizontal'

  chart.setStyles({
    grid: {
      show: showVertical || showHorizontal,
      horizontal: {
        color: horizontalColor,
        dashedValue: [2, 2],
        show: showHorizontal,
        size: 1,
        style: LineType.Solid,
      },
      vertical: {
        color: verticalColor,
        dashedValue: [2, 2],
        show: showVertical,
        size: 1,
        style: LineType.Solid,
      },
    },
  })
}

export function applyCrosshairLineStyle(chart: Chart) {
  const state = readSettingsSymbolState()
  const swatch = state['layout.crosshair.color']
  const color = resolveSwatchColor(swatch, '#e91e63')
  const line = resolveLineStyle(swatch)
  const size = resolveLineThickness(swatch)

  chart.setStyles({
    crosshair: {
      horizontal: {
        line: {
          color,
          dashedValue: line.dashedValue,
          show: true,
          size,
          style: line.style,
        },
      },
      vertical: {
        line: {
          color,
          dashedValue: line.dashedValue,
          show: true,
          size,
          style: line.style,
        },
      },
    },
  })
}

export function applyAxisTextStyle(chart: Chart) {
  const color = readAxisTextColor()
  const size = readAxisTextSize()

  chart.setStyles({
    xAxis: {
      tickText: {
        color,
        family: chartNumberFontFamily,
        marginEnd: 4,
        marginStart: 4,
        size,
        weight: chartNumberFontWeight,
      },
    },
    yAxis: {
      tickText: {
        color,
        family: chartNumberFontFamily,
        marginEnd: 10,
        marginStart: 7,
        size,
        weight: chartNumberFontWeight,
      },
    },
  })
}

export function applyAxisLineStyle(chart: Chart) {
  const color = readAxisLineColor()

  chart.setStyles({
    xAxis: {
      axisLine: {
        color,
        show: true,
        size: 1,
      },
      tickLine: {
        color,
        length: 3,
        show: true,
        size: 1,
      },
    },
    yAxis: {
      axisLine: {
        color,
        show: true,
        size: 1,
      },
      tickLine: {
        color,
        length: 3,
        show: true,
        size: 1,
      },
    },
  })
}

export function applyLastPriceLineStyle(chart: Chart) {
  const selectedParts = readSymbolLabelVisibleParts()
  const barStyle = readCandleBarStyle()
  const highLowParts = readSettingsSymbolState()['coordinates.highLow.visibleParts']
  const selectedHighLowParts = Array.isArray(highLowParts)
    ? highLowParts.filter((value): value is string => typeof value === 'string')
    : []
  const highLowTextSize = readHighLowTextSize()

  chart.setStyles({
    candle: {
      priceMark: {
        high: {
          color: '#131722',
          show: selectedHighLowParts.includes('high'),
          textFamily: chartNumberFontFamily,
          textSize: highLowTextSize,
          textWeight: String(chartNumberFontWeight),
        },
        last: {
          downColor: barStyle.downColor,
          line: {
            dashedValue: [2, 2],
            show: selectedParts.includes('line'),
            size: 1,
            style: LineType.Dashed,
          },
          noChangeColor: barStyle.noChangeColor,
          text: {
            borderRadius: 0,
            family: chartNumberFontFamily,
            show: selectedParts.includes('value'),
            paddingBottom: 2,
            paddingLeft: 6,
            paddingRight: 7,
            paddingTop: 4,
            weight: chartNumberFontWeight,
          },
          upColor: barStyle.upColor,
        },
        low: {
          color: '#131722',
          show: selectedHighLowParts.includes('low'),
          textFamily: chartNumberFontFamily,
          textSize: highLowTextSize,
          textWeight: String(chartNumberFontWeight),
        },
      },
    },
  })
}

export function applyCandleTooltipStyle(chart: Chart, symbol: string, period: string, displayName?: string) {
  const settings = readSettingsSymbolState()
  const chartValuesVisible = settings[chartSettingKeys.statusChartValuesVisible] !== false
  const candleChangeVisible = settings[chartSettingKeys.statusCandleChangeVisible] !== false
  const candleTimeVisible = settings[chartSettingKeys.statusCandleTimeVisible] !== false
  const barStyle = readCandleBarStyle()

  chart.setStyles({
    candle: {
      bar: barStyle,
      tooltip: {
        custom: ({ current }: CandleTooltipCustomCallbackData) => {
          const priceColor = resolveCandleValueColor(current, barStyle)
          return [
            {
              title: `${resolveStatusTitle(symbol, displayName)} ${period}${chartValuesVisible ? '  O: ' : ''}`,
              value: chartValuesVisible ? { text: '{open}', color: priceColor } : '',
            },
            ...(chartValuesVisible
              ? [
                  { title: 'H: ', value: { text: '{high}', color: priceColor } },
                  { title: 'L: ', value: { text: '{low}', color: priceColor } },
                  { title: 'C: ', value: { text: '{close}', color: priceColor } },
                ]
              : []),
            ...(candleChangeVisible ? [{ title: 'Chg: ', value: '{change}' }] : []),
            { title: 'Volume: ', value: '{volume}' },
            ...(candleTimeVisible ? [{ title: 'Time: ', value: '{time}' }] : []),
          ]
        },
      },
    },
  })
}
