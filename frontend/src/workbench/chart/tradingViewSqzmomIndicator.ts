import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultSqzmomIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { SqzmomIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'

export type SqzmomSqueezeState = 'on' | 'off' | 'none'

export type SqzmomIndicatorRow = {
  momentum?: number
  squeezeState?: SqzmomSqueezeState
}

let registered = false

function normalizeSqzmomSettings(input?: Partial<SqzmomIndicatorSettings>): SqzmomIndicatorSettings {
  return { ...defaultSqzmomIndicatorSettings, ...(input ?? {}) }
}

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(500, next)) : fallback
}

function clampMultiplier(value: unknown, fallback: number) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 100)) : fallback
}

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
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

function calculateStdDev(values: Array<number | undefined>, period: number, index: number) {
  const mean = calculateSma(values, period, index)
  if (!Number.isFinite(mean)) return undefined
  let sum = 0
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const value = values[cursor]
    if (!Number.isFinite(value)) return undefined
    const diff = (value as number) - (mean as number)
    sum += diff * diff
  }
  return Math.sqrt(sum / period)
}

function highest(values: number[], period: number, index: number) {
  if (index < period - 1) return undefined
  let output = -Infinity
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) output = Math.max(output, values[cursor])
  return Number.isFinite(output) ? output : undefined
}

function lowest(values: number[], period: number, index: number) {
  if (index < period - 1) return undefined
  let output = Infinity
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) output = Math.min(output, values[cursor])
  return Number.isFinite(output) ? output : undefined
}

function linreg(values: Array<number | undefined>, period: number, index: number) {
  if (index < period - 1) return undefined
  const xMean = (period - 1) / 2
  let ySum = 0
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const value = values[cursor]
    if (!Number.isFinite(value)) return undefined
    ySum += value as number
  }
  const yMean = ySum / period
  let numerator = 0
  let denominator = 0
  for (let offset = 0; offset < period; offset += 1) {
    const xDiff = offset - xMean
    const yDiff = (values[index - period + 1 + offset] as number) - yMean
    numerator += xDiff * yDiff
    denominator += xDiff * xDiff
  }
  const slope = denominator === 0 ? 0 : numerator / denominator
  const intercept = yMean - slope * xMean
  return intercept + slope * (period - 1)
}

function trueRange(dataList: KLineData[], index: number) {
  const current = dataList[index]
  const high = Number(current.high)
  const low = Number(current.low)
  if (index === 0) return high - low
  const previousClose = Number(dataList[index - 1].close)
  return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose))
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<SqzmomIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function histogramColor(row: SqzmomIndicatorRow, previous?: SqzmomIndicatorRow, settings = defaultSqzmomIndicatorSettings) {
  const value = row.momentum ?? 0
  const previousValue = previous?.momentum ?? value
  if (value >= 0) {
    return value >= previousValue
      ? colorWithAlpha(settings.histogramPositiveRisingColor, settings.histogramPositiveRisingOpacity)
      : colorWithAlpha(settings.histogramPositiveFallingColor, settings.histogramPositiveFallingOpacity)
  }
  return value < previousValue
    ? colorWithAlpha(settings.histogramNegativeFallingColor, settings.histogramNegativeFallingOpacity)
    : colorWithAlpha(settings.histogramNegativeRisingColor, settings.histogramNegativeRisingOpacity)
}

function squeezeColor(row: SqzmomIndicatorRow, settings: SqzmomIndicatorSettings) {
  if (row.squeezeState === 'on') return settings.squeezeOnVisible ? colorWithAlpha(settings.squeezeOnColor, settings.squeezeOnOpacity) : null
  if (row.squeezeState === 'off') return settings.squeezeOffVisible ? colorWithAlpha(settings.squeezeOffColor, settings.squeezeOffOpacity) : null
  return settings.noSqueezeVisible ? colorWithAlpha(settings.noSqueezeColor, settings.noSqueezeOpacity) : null
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  rows: SqzmomIndicatorRow[],
  visibleRange: { from: number; to: number },
  barSpace: { bar: number; halfGapBar: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: SqzmomIndicatorSettings,
) {
  if (!settings.histogramVisible) return
  const zeroY = yAxis.convertToPixel(0)
  const start = Math.max(0, Math.floor(visibleRange.from) - 1)
  const end = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  const fullBarWidth = Math.max(Number(barSpace.bar) || Number(barSpace.halfGapBar) * 2 || 3, 2)
  const width = Math.max(1, Math.round(fullBarWidth) - 1)
  const halfWidth = width / 2

  ctx.save()
  for (let index = start; index <= end; index += 1) {
    const value = rows[index]?.momentum
    if (!Number.isFinite(value)) continue
    const x = xAxis.convertToPixel(index)
    const y = yAxis.convertToPixel(value as number)
    const left = Math.round(x - halfWidth)
    ctx.fillStyle = histogramColor(rows[index], rows[index - 1], settings)
    ctx.fillRect(left, Math.min(y, zeroY), width, Math.max(1, Math.abs(zeroY - y)))
  }
  ctx.restore()
}

function drawSqueezeMarks(
  ctx: CanvasRenderingContext2D,
  rows: SqzmomIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: SqzmomIndicatorSettings,
) {
  const start = Math.max(0, Math.floor(visibleRange.from) - 1)
  const end = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  const y = yAxis.convertToPixel(0)
  const radius = 6
  ctx.save()
  for (let index = start; index <= end; index += 1) {
    const color = squeezeColor(rows[index] ?? {}, settings)
    if (!color) continue
    const x = xAxis.convertToPixel(index)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function calculateTradingViewSqzmomRows(dataList: KLineData[], inputSettings: Partial<SqzmomIndicatorSettings> = defaultSqzmomIndicatorSettings): SqzmomIndicatorRow[] {
  const settings = normalizeSqzmomSettings(inputSettings)
  const bbLength = clampPeriod(settings.bbLength, defaultSqzmomIndicatorSettings.bbLength)
  const kcLength = clampPeriod(settings.kcLength, defaultSqzmomIndicatorSettings.kcLength)
  const kcMultiplier = clampMultiplier(settings.kcMultiplier, defaultSqzmomIndicatorSettings.kcMultiplier)
  const close = dataList.map((data) => Number(data.close))
  const high = dataList.map((data) => Number(data.high))
  const low = dataList.map((data) => Number(data.low))
  const range = dataList.map((data, index) => settings.useTrueRange ? trueRange(dataList, index) : Number(data.high) - Number(data.low))
  const momentumSource: Array<number | undefined> = dataList.map((_, index) => {
    const highValue = highest(high, kcLength, index)
    const lowValue = lowest(low, kcLength, index)
    const closeMa = calculateSma(close, kcLength, index)
    if (!Number.isFinite(highValue) || !Number.isFinite(lowValue) || !Number.isFinite(closeMa)) return undefined
    return close[index] - ((((highValue as number) + (lowValue as number)) / 2 + (closeMa as number)) / 2)
  })

  return dataList.map((_, index) => {
    const basis = calculateSma(close, bbLength, index)
    const deviation = calculateStdDev(close, bbLength, index)
    const ma = calculateSma(close, kcLength, index)
    const rangeMa = calculateSma(range, kcLength, index)
    const momentum = linreg(momentumSource, kcLength, index)
    const row: SqzmomIndicatorRow = {}

    if (Number.isFinite(momentum)) row.momentum = momentum as number
    if (Number.isFinite(basis) && Number.isFinite(deviation) && Number.isFinite(ma) && Number.isFinite(rangeMa)) {
      // LazyBear's published SQZMOM source uses KC MultFactor for BB deviation here.
      // Keeping this typo-compatible is required for the squeeze state to match TradingView's original script.
      const upperBB = (basis as number) + kcMultiplier * (deviation as number)
      const lowerBB = (basis as number) - kcMultiplier * (deviation as number)
      const upperKC = (ma as number) + (rangeMa as number) * kcMultiplier
      const lowerKC = (ma as number) - (rangeMa as number) * kcMultiplier
      const sqzOn = lowerBB > lowerKC && upperBB < upperKC
      const sqzOff = lowerBB < lowerKC && upperBB > upperKC
      row.squeezeState = sqzOn ? 'on' : sqzOff ? 'off' : 'none'
    }
    return row
  })
}

export function ensureTradingViewSqzmomIndicator() {
  if (registered) return
  registered = true

  registerIndicator<SqzmomIndicatorRow>({
    name: 'SQZMOM',
    shortName: 'SQZMOM',
    calcParams: [defaultSqzmomIndicatorSettings],
    precision: 4,
    series: IndicatorSeries.Normal,
    figures: [],
    createTooltipDataSource: (params) => {
      const settings = normalizeSqzmomSettings(params.indicator.calcParams[0] as Partial<SqzmomIndicatorSettings>)
      const index = resolveTooltipIndex(params)
      const row = params.indicator.result[index]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible()
        ? ` ${settings.bbLength} ${settings.bbMultiplier} ${settings.kcLength} ${settings.kcMultiplier}`
        : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible() && settings.histogramVisible) {
        values.push({
          title: { text: 'Momentum ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatIndicatorValue(row?.momentum, settings.precision, 4), color: histogramColor(row ?? {}, params.indicator.result[index - 1], settings) },
        })
      }
      return { name: 'SQZMOM', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ barSpace, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeSqzmomSettings(indicator.calcParams[0] as Partial<SqzmomIndicatorSettings>)
      drawHistogram(ctx, indicator.result, visibleRange, barSpace, xAxis, yAxis, settings)
      drawSqueezeMarks(ctx, indicator.result, visibleRange, xAxis, yAxis, settings)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewSqzmomRows(realRows, indicator.calcParams[0] as Partial<SqzmomIndicatorSettings>),
    ),
  })
}
