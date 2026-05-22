import { LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultRsiIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { RsiIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'

type RsiIndicatorRow = {
  rsi?: number
  rsiMa?: number
}

let registered = false

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(2, Math.min(500, next)) : fallback
}

function calculateSourceValue(row: KLineData, source: RsiIndicatorSettings['source']) {
  const open = Number(row.open)
  const high = Number(row.high)
  const low = Number(row.low)
  const close = Number(row.close)

  switch (source) {
    case 'open':
      return open
    case 'high':
      return high
    case 'low':
      return low
    case 'hl2':
      return Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : NaN
    case 'hlc3':
      return Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close) ? (high + low + close) / 3 : NaN
    case 'ohlc4':
      return Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
        ? (open + high + low + close) / 4
        : NaN
    default:
      return close
  }
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

function calculateEma(values: Array<number | undefined>, period: number) {
  const multiplier = 2 / (period + 1)
  let ema: number | undefined
  return values.map((value) => {
    if (!Number.isFinite(value)) return undefined
    ema = ema == null ? value as number : (value as number) * multiplier + ema * (1 - multiplier)
    return ema
  })
}

function calculateRma(values: Array<number | undefined>, period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  if (values.length < period) return out

  let sum = 0
  for (let index = 0; index < period; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) return out
    sum += value as number
  }

  let rma = sum / period
  out[period - 1] = rma
  for (let index = period; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    rma = (rma * (period - 1) + (value as number)) / period
    out[index] = rma
  }
  return out
}

function calculateWma(values: Array<number | undefined>, period: number, index: number) {
  if (index < period - 1) return undefined

  let numerator = 0
  const denominator = (period * (period + 1)) / 2
  for (let cursor = 0; cursor < period; cursor += 1) {
    const value = values[index - period + 1 + cursor]
    if (!Number.isFinite(value)) return undefined
    numerator += (value as number) * (cursor + 1)
  }
  return numerator / denominator
}

function calculateRsiMa(dataList: KLineData[], rsiValues: Array<number | undefined>, settings: RsiIndicatorSettings) {
  const period = clampPeriod(settings.smoothingLength, 14)
  const type = settings.smoothingType
  const out: Array<number | undefined> = rsiValues.map(() => undefined)
  if (type === 'none') return out
  if (type === 'ema') return calculateEma(rsiValues, period)
  if (type === 'smma') return calculateRma(rsiValues, period)

  for (let index = 0; index < rsiValues.length; index += 1) {
    if (type === 'wma') {
      out[index] = calculateWma(rsiValues, period, index)
    } else if (type === 'vwma') {
      if (index >= period - 1) {
        let numerator = 0
        let denominator = 0
        for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
          const value = rsiValues[cursor]
          const volume = Math.max(0, Number(dataList[cursor]?.volume) || 0)
          if (!Number.isFinite(value)) continue
          numerator += (value as number) * volume
          denominator += volume
        }
        out[index] = denominator > 0 ? numerator / denominator : rsiValues[index]
      }
    } else {
      out[index] = calculateSma(rsiValues, period, index)
    }
  }
  return out
}

function normalizeRsiSettings(input?: Partial<RsiIndicatorSettings> | number): RsiIndicatorSettings {
  if (typeof input === 'number') return { ...defaultRsiIndicatorSettings, length: input }
  return { ...defaultRsiIndicatorSettings, ...(input ?? {}) }
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<RsiIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatRsiValue(value: number | undefined, precision: RsiIndicatorSettings['precision']) {
  if (!Number.isFinite(value)) return '--'
  const digits = precision === 'system' ? 2 : Number(precision)
  return (value as number).toFixed(Number.isFinite(digits) ? digits : 2).replace(/\.?0+$/, '')
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function clampLineWidth(value: unknown, fallback = 1) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 4)) : fallback
}

function alignStrokePixel(value: number, lineWidth: number) {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
}

function lineDashForStyle(style: RsiIndicatorSettings['rsiLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: RsiIndicatorSettings['rsiLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(
  color: string,
  visible: boolean,
  lineStyle: RsiIndicatorSettings['rsiLineStyle'],
  lineWidth: number,
  opacity: number,
) {
  return {
    color: visible ? colorWithAlpha(color, clampOpacity(opacity)) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle),
  } as any
}

function createRsiLineFigures() {
  return [
    { key: 'rsi', title: 'RSI: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeRsiSettings(indicator.calcParams[0] as Partial<RsiIndicatorSettings>)
      return createLineFigureStyle(settings.rsiColor, settings.rsiVisible, settings.rsiLineStyle, settings.rsiLineWidth, settings.rsiOpacity)
    } },
    { key: 'rsiMa', title: 'RSI MA: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeRsiSettings(indicator.calcParams[0] as Partial<RsiIndicatorSettings>)
      return createLineFigureStyle(settings.rsiMaColor, settings.rsiMaVisible, settings.rsiMaLineStyle, settings.rsiMaLineWidth, settings.rsiMaOpacity)
    } },
  ]
}

function drawRsiLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: RsiIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  key: keyof RsiIndicatorRow,
  color: string,
  visible: boolean,
  lineStyle: RsiIndicatorSettings['rsiLineStyle'],
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

export function calculateTradingViewRsiRows(dataList: KLineData[], inputSettings: Partial<RsiIndicatorSettings> | number = defaultRsiIndicatorSettings): RsiIndicatorRow[] {
  const settings = normalizeRsiSettings(inputSettings)
  const length = clampPeriod(settings.length, 14)
  const rows: RsiIndicatorRow[] = dataList.map(() => ({}))
  if (dataList.length < length + 1) return rows

  const gains: number[] = []
  const losses: number[] = []

  for (let index = 1; index < dataList.length; index += 1) {
    const previous = calculateSourceValue(dataList[index - 1], settings.source)
    const current = calculateSourceValue(dataList[index], settings.source)
    const change = Number.isFinite(previous) && Number.isFinite(current) ? current - previous : 0
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? -change : 0)
  }

  let averageGain = 0
  let averageLoss = 0

  for (let index = 0; index < length; index += 1) {
    averageGain += gains[index] ?? 0
    averageLoss += losses[index] ?? 0
  }

  averageGain /= length
  averageLoss /= length

  const rsiValues: Array<number | undefined> = dataList.map(() => undefined)

  const assignRsi = (barIndex: number) => {
    const value = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss)
    rows[barIndex].rsi = value
    rsiValues[barIndex] = value
  }

  assignRsi(length)

  for (let gainIndex = length; gainIndex < gains.length; gainIndex += 1) {
    averageGain = (averageGain * (length - 1) + gains[gainIndex]) / length
    averageLoss = (averageLoss * (length - 1) + losses[gainIndex]) / length
    assignRsi(gainIndex + 1)
  }

  const rsiMaValues = calculateRsiMa(dataList, rsiValues, settings)
  for (let index = 0; index < rows.length; index += 1) {
    const rsiMa = rsiMaValues[index]
    if (Number.isFinite(rsiMa)) rows[index].rsiMa = rsiMa
  }

  return rows
}

export function ensureTradingViewRsiIndicator() {
  if (registered) return
  registered = true

  registerIndicator<RsiIndicatorRow>({
    name: 'RSI',
    shortName: 'RSI',
    calcParams: [defaultRsiIndicatorSettings],
    precision: 2,
    minValue: 0,
    maxValue: 100,
    figures: createRsiLineFigures(),
    regenerateFigures: createRsiLineFigures,
    createTooltipDataSource: (params) => {
      const { indicator } = params
      const settings = normalizeRsiSettings(indicator.calcParams[0])
      const row = indicator.result[resolveTooltipIndex(params)]
      const indicatorValuesVisible = readIndicatorValuesVisible()
      const inputsText = readIndicatorInputsVisible() ? ` ${settings.length} ${settings.smoothingLength}` : ''
      const values = []
      if (indicatorValuesVisible && settings.rsiVisible) {
        values.push({
          title: { text: 'RSI ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatRsiValue(row?.rsi, settings.precision), color: colorWithAlpha(settings.rsiColor, settings.rsiOpacity) },
        })
      }
      if (indicatorValuesVisible && settings.rsiMaVisible) {
        values.push({
          title: { text: 'MA ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatRsiValue(row?.rsiMa, settings.precision), color: colorWithAlpha(settings.rsiMaColor, settings.rsiMaOpacity) },
        })
      }
      return {
        name: 'RSI',
        calcParamsText: inputsText,
        icons: [],
        values,
      }
    },
    draw: ({ ctx, bounding, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeRsiSettings(indicator.calcParams[0])
      const left = bounding.left
      const right = bounding.left + bounding.width
      const drawHorizontal = (
        value: number,
        color: string,
        visible: boolean,
        lineStyle: RsiIndicatorSettings['rsiLineStyle'],
        lineWidth: number,
        opacity: number,
      ) => {
        if (!visible) return
        const lineSize = clampLineWidth(lineWidth)
        const y = alignStrokePixel(yAxis.convertToPixel(value), lineSize)
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash(lineDashForStyle(lineStyle))
        ctx.strokeStyle = colorWithAlpha(color, clampOpacity(opacity))
        ctx.lineWidth = lineSize
        ctx.moveTo(left, y)
        ctx.lineTo(right, y)
        ctx.stroke()
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

      drawHorizontal(
        settings.upperBand,
        settings.upperBandColor,
        settings.upperBandVisible,
        settings.upperBandLineStyle,
        settings.upperBandLineWidth,
        settings.upperBandOpacity,
      )
      drawHorizontal(
        settings.middleBand,
        settings.middleBandColor,
        settings.middleBandVisible,
        settings.middleBandLineStyle,
        settings.middleBandLineWidth,
        settings.middleBandOpacity,
      )
      drawHorizontal(
        settings.lowerBand,
        settings.lowerBandColor,
        settings.lowerBandVisible,
        settings.lowerBandLineStyle,
        settings.lowerBandLineWidth,
        settings.lowerBandOpacity,
      )
      drawRsiLineSeries(
        ctx,
        indicator.result,
        visibleRange,
        xAxis,
        yAxis,
        'rsi',
        settings.rsiColor,
        settings.rsiVisible,
        settings.rsiLineStyle,
        settings.rsiLineWidth,
        settings.rsiOpacity,
      )
      drawRsiLineSeries(
        ctx,
        indicator.result,
        visibleRange,
        xAxis,
        yAxis,
        'rsiMa',
        settings.rsiMaColor,
        settings.rsiMaVisible,
        settings.rsiMaLineStyle,
        settings.rsiMaLineWidth,
        settings.rsiMaOpacity,
      )
      return true
    },
    calc: (dataList, indicator) => {
      return calculateWithoutFuturePlaceholders(
        dataList,
        (realRows) => calculateTradingViewRsiRows(realRows, indicator.calcParams[0]),
      )
    },
  })
}
