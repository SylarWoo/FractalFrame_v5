import { LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultViIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { ViIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'

type ViIndicatorRow = {
  minus?: number
  plus?: number
}

let registered = false

function normalizeViSettings(input?: Partial<ViIndicatorSettings>): ViIndicatorSettings {
  return { ...defaultViIndicatorSettings, ...(input ?? {}) }
}

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(500, next)) : fallback
}

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function clampLineWidth(value: unknown, fallback = 1) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 4)) : fallback
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
}

function lineDashForStyle(style: ViIndicatorSettings['plusLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: ViIndicatorSettings['plusLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(color: string, visible: boolean, lineStyle: ViIndicatorSettings['plusLineStyle'], lineWidth: number, opacity: number) {
  return {
    color: visible ? colorWithAlpha(color, opacity) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle) as never,
  }
}

function createViLineFigures() {
  return [
    { key: 'plus', title: 'VI +: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeViSettings(indicator.calcParams[0] as Partial<ViIndicatorSettings>)
      return createLineFigureStyle(settings.plusColor, settings.plusVisible, settings.plusLineStyle, settings.plusLineWidth, settings.plusOpacity)
    } },
    { key: 'minus', title: 'VI -: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeViSettings(indicator.calcParams[0] as Partial<ViIndicatorSettings>)
      return createLineFigureStyle(settings.minusColor, settings.minusVisible, settings.minusLineStyle, settings.minusLineWidth, settings.minusOpacity)
    } },
  ]
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<ViIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatViValue(value: number | undefined, precision: ViIndicatorSettings['precision']) {
  return formatIndicatorValue(value, precision, 4)
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function drawLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: ViIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  key: keyof ViIndicatorRow,
  color: string,
  visible: boolean,
  lineStyle: ViIndicatorSettings['plusLineStyle'],
  lineWidth: number,
  opacity: number,
) {
  if (!visible) return
  const width = clampLineWidth(lineWidth)
  const start = Math.max(0, Math.floor(visibleRange.from) - 1)
  const end = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  let started = false

  ctx.save()
  ctx.beginPath()
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = colorWithAlpha(color, opacity)
  ctx.setLineDash(lineDashForStyle(lineStyle))

  for (let index = start; index <= end; index += 1) {
    const value = rows[index]?.[key]
    if (!Number.isFinite(value)) {
      started = false
      continue
    }
    const x = xAxis.convertToPixel(index)
    const y = yAxis.convertToPixel(value as number)
    if (!started) {
      ctx.moveTo(x, y)
      started = true
    } else {
      ctx.lineTo(x, y)
    }
  }

  ctx.stroke()
  ctx.restore()
}

export function calculateTradingViewViRows(dataList: KLineData[], inputSettings: Partial<ViIndicatorSettings> = defaultViIndicatorSettings): ViIndicatorRow[] {
  const settings = normalizeViSettings(inputSettings)
  const length = clampPeriod(settings.length, defaultViIndicatorSettings.length)
  const plusMovement: number[] = dataList.map(() => 0)
  const minusMovement: number[] = dataList.map(() => 0)
  const trueRange: number[] = dataList.map(() => 0)

  for (let index = 1; index < dataList.length; index += 1) {
    const current = dataList[index]
    const previous = dataList[index - 1]
    const high = Number(current.high)
    const low = Number(current.low)
    const previousHigh = Number(previous.high)
    const previousLow = Number(previous.low)
    const previousClose = Number(previous.close)
    plusMovement[index] = Math.abs(high - previousLow)
    minusMovement[index] = Math.abs(low - previousHigh)
    trueRange[index] = Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose))
  }

  return dataList.map((_, index) => {
    if (index < length) return {}
    let plusSum = 0
    let minusSum = 0
    let trueRangeSum = 0
    for (let cursor = index - length + 1; cursor <= index; cursor += 1) {
      plusSum += plusMovement[cursor]
      minusSum += minusMovement[cursor]
      trueRangeSum += trueRange[cursor]
    }
    if (trueRangeSum === 0) return {}
    return {
      minus: minusSum / trueRangeSum,
      plus: plusSum / trueRangeSum,
    }
  })
}

export function ensureTradingViewViIndicator() {
  if (registered) return
  registered = true

  registerIndicator<ViIndicatorRow>({
    name: 'VI',
    shortName: 'VI',
    calcParams: [defaultViIndicatorSettings],
    precision: 4,
    figures: createViLineFigures(),
    regenerateFigures: createViLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeViSettings(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible() ? ` ${settings.length}` : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible()) {
        if (settings.plusVisible) values.push({ title: { text: 'VI + ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatViValue(row?.plus, settings.precision), color: colorWithAlpha(settings.plusColor, settings.plusOpacity) } })
        if (settings.minusVisible) values.push({ title: { text: 'VI - ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatViValue(row?.minus, settings.precision), color: colorWithAlpha(settings.minusColor, settings.minusOpacity) } })
      }
      return { name: 'VI', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeViSettings(indicator.calcParams[0])
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'plus', settings.plusColor, settings.plusVisible, settings.plusLineStyle, settings.plusLineWidth, settings.plusOpacity)
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'minus', settings.minusColor, settings.minusVisible, settings.minusLineStyle, settings.minusLineWidth, settings.minusOpacity)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewViRows(realRows, indicator.calcParams[0]),
    ),
  })
}
