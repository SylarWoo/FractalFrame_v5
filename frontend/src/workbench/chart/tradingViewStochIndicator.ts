import { LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultStochIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { StochIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'

type StochIndicatorRow = {
  d?: number
  k?: number
}

let registered = false

function normalizeStochSettings(input?: Partial<StochIndicatorSettings> | number): StochIndicatorSettings {
  if (typeof input === 'number') return { ...defaultStochIndicatorSettings, length: input }
  return { ...defaultStochIndicatorSettings, ...(input ?? {}) }
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

function lineDashForStyle(style: StochIndicatorSettings['kLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: StochIndicatorSettings['kLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(
  color: string,
  visible: boolean,
  lineStyle: StochIndicatorSettings['kLineStyle'],
  lineWidth: number,
  opacity: number,
) {
  return {
    color: visible ? colorWithAlpha(color, opacity) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle) as never,
  }
}

function createStochLineFigures() {
  return [
    { key: 'k', title: '%K: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeStochSettings(indicator.calcParams[0] as Partial<StochIndicatorSettings>)
      return createLineFigureStyle(settings.kColor, settings.kVisible, settings.kLineStyle, settings.kLineWidth, settings.kOpacity)
    } },
    { key: 'd', title: '%D: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeStochSettings(indicator.calcParams[0] as Partial<StochIndicatorSettings>)
      return createLineFigureStyle(settings.dColor, settings.dVisible, settings.dLineStyle, settings.dLineWidth, settings.dOpacity)
    } },
  ]
}

function calculateSma(values: Array<number | undefined>, period: number, index: number) {
  if (index < period - 1) return undefined
  let sum = 0
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const value = values[cursor]
    if (!Number.isFinite(value)) return undefined
    sum += value as number
  }
  return sum / period
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<StochIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatStochValue(value: number | undefined, precision: StochIndicatorSettings['precision']) {
  return formatIndicatorValue(value, precision, 2)
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function alignStrokePixel(value: number, lineWidth: number) {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function drawStochLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: StochIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  key: keyof StochIndicatorRow,
  color: string,
  visible: boolean,
  lineStyle: StochIndicatorSettings['kLineStyle'],
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

export function calculateTradingViewStochRows(dataList: KLineData[], inputSettings: Partial<StochIndicatorSettings> | number = defaultStochIndicatorSettings): StochIndicatorRow[] {
  const settings = normalizeStochSettings(inputSettings)
  const length = clampPeriod(settings.length, defaultStochIndicatorSettings.length)
  const kSmoothing = clampPeriod(settings.kSmoothing, defaultStochIndicatorSettings.kSmoothing)
  const dSmoothing = clampPeriod(settings.dSmoothing, defaultStochIndicatorSettings.dSmoothing)
  const rawKValues: Array<number | undefined> = dataList.map(() => undefined)
  const kValues: Array<number | undefined> = dataList.map(() => undefined)
  const rows: StochIndicatorRow[] = dataList.map(() => ({}))

  for (let index = length - 1; index < dataList.length; index += 1) {
    let highestHigh = Number.NEGATIVE_INFINITY
    let lowestLow = Number.POSITIVE_INFINITY
    for (let cursor = index - length + 1; cursor <= index; cursor += 1) {
      highestHigh = Math.max(highestHigh, Number(dataList[cursor]?.high))
      lowestLow = Math.min(lowestLow, Number(dataList[cursor]?.low))
    }
    const close = Number(dataList[index]?.close)
    const range = highestHigh - lowestLow
    if (Number.isFinite(close) && Number.isFinite(range) && range !== 0) {
      rawKValues[index] = ((close - lowestLow) / range) * 100
    }
  }

  for (let index = 0; index < dataList.length; index += 1) {
    const k = calculateSma(rawKValues, kSmoothing, index)
    if (Number.isFinite(k)) {
      kValues[index] = k
      rows[index].k = k
    }
    const d = calculateSma(kValues, dSmoothing, index)
    if (Number.isFinite(d)) rows[index].d = d
  }

  return rows
}

export function ensureTradingViewStochIndicator() {
  if (registered) return
  registered = true

  registerIndicator<StochIndicatorRow>({
    name: 'Stoch',
    shortName: 'Stoch',
    calcParams: [defaultStochIndicatorSettings],
    precision: 2,
    minValue: 0,
    maxValue: 100,
    figures: createStochLineFigures(),
    regenerateFigures: createStochLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeStochSettings(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible()
        ? ` ${settings.length} ${settings.kSmoothing} ${settings.dSmoothing}`
        : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible()) {
        if (settings.kVisible) {
          values.push({
            title: { text: '%K ', color: params.defaultStyles.tooltip.text.color },
            value: { text: formatStochValue(row?.k, settings.precision), color: colorWithAlpha(settings.kColor, settings.kOpacity) },
          })
        }
        if (settings.dVisible) {
          values.push({
            title: { text: '%D ', color: params.defaultStyles.tooltip.text.color },
            value: { text: formatStochValue(row?.d, settings.precision), color: colorWithAlpha(settings.dColor, settings.dOpacity) },
          })
        }
      }
      return { name: 'Stoch', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ ctx, bounding, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeStochSettings(indicator.calcParams[0])
      const left = bounding.left
      const right = bounding.left + bounding.width
      const drawHorizontal = (
        value: number,
        color: string,
        visible: boolean,
        lineStyle: StochIndicatorSettings['kLineStyle'],
        lineWidth: number,
        opacity: number,
      ) => {
        if (!visible) return
        const size = clampLineWidth(lineWidth)
        const y = alignStrokePixel(yAxis.convertToPixel(value), size)
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash(lineDashForStyle(lineStyle))
        ctx.strokeStyle = colorWithAlpha(color, opacity)
        ctx.lineWidth = size
        ctx.moveTo(left, y)
        ctx.lineTo(right, y)
        ctx.stroke()
        ctx.restore()
      }

      const fillBetween = (fromValue: number, toValue: number, color: string, opacity: number, visible: boolean) => {
        if (!visible) return
        const fromY = yAxis.convertToPixel(fromValue)
        const toY = yAxis.convertToPixel(toValue)
        ctx.save()
        ctx.fillStyle = colorWithAlpha(color, opacity)
        ctx.fillRect(left, Math.min(fromY, toY), bounding.width, Math.abs(toY - fromY))
        ctx.restore()
      }

      if (settings.backgroundFillVisible && settings.upperBandVisible && settings.lowerBandVisible) {
        const upperY = yAxis.convertToPixel(settings.upperBand)
        const lowerY = yAxis.convertToPixel(settings.lowerBand)
        ctx.save()
        ctx.fillStyle = colorWithAlpha(settings.backgroundFillColor, settings.backgroundFillOpacity)
        ctx.fillRect(left, Math.min(upperY, lowerY), bounding.width, Math.abs(lowerY - upperY))
        ctx.restore()
      }
      fillBetween(
        settings.upperBand,
        settings.upperBand2,
        settings.backgroundFillUpperColor,
        settings.backgroundFillUpperOpacity,
        settings.backgroundFillVisible && settings.backgroundFillUpperVisible && settings.upperBandVisible && settings.upperBand2Visible,
      )
      fillBetween(
        settings.lowerBand,
        settings.lowerBand2,
        settings.backgroundFillLowerColor,
        settings.backgroundFillLowerOpacity,
        settings.backgroundFillVisible && settings.backgroundFillLowerVisible && settings.lowerBandVisible && settings.lowerBand2Visible,
      )

      drawHorizontal(settings.upperBand, settings.upperBandColor, settings.upperBandVisible, settings.upperBandLineStyle, settings.upperBandLineWidth, settings.upperBandOpacity)
      drawHorizontal(settings.upperBand2, settings.upperBand2Color, settings.upperBand2Visible, settings.upperBand2LineStyle, settings.upperBand2LineWidth, settings.upperBand2Opacity)
      drawHorizontal(settings.upperBand3, settings.upperBand3Color, settings.upperBand3Visible, settings.upperBand3LineStyle, settings.upperBand3LineWidth, settings.upperBand3Opacity)
      drawHorizontal(settings.middleBand, settings.middleBandColor, settings.middleBandVisible, settings.middleBandLineStyle, settings.middleBandLineWidth, settings.middleBandOpacity)
      drawHorizontal(settings.lowerBand, settings.lowerBandColor, settings.lowerBandVisible, settings.lowerBandLineStyle, settings.lowerBandLineWidth, settings.lowerBandOpacity)
      drawHorizontal(settings.lowerBand2, settings.lowerBand2Color, settings.lowerBand2Visible, settings.lowerBand2LineStyle, settings.lowerBand2LineWidth, settings.lowerBand2Opacity)
      drawHorizontal(settings.lowerBand3, settings.lowerBand3Color, settings.lowerBand3Visible, settings.lowerBand3LineStyle, settings.lowerBand3LineWidth, settings.lowerBand3Opacity)
      drawStochLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'k', settings.kColor, settings.kVisible, settings.kLineStyle, settings.kLineWidth, settings.kOpacity)
      drawStochLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'd', settings.dColor, settings.dVisible, settings.dLineStyle, settings.dLineWidth, settings.dOpacity)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewStochRows(realRows, indicator.calcParams[0]),
    ),
  })
}
