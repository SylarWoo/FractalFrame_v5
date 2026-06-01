import { registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultVdoIndicatorSettings, defaultVmiIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VdoIndicatorSettings, VmiIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { assignBarKey } from './barIdentity'
import { formatIndicatorValue } from './indicatorValueFormat'
import { readIndicatorPageSnapshot } from './indicatorPageSnapshotStore'
import { calculateTradingViewVdoRows } from './tradingViewVdoIndicator'

export type VmiIndicatorRow = {
  histogram?: number
}

let registered = false

type VmiCalcContext = {
  pageKey?: string
  period?: string
  settings?: Partial<VmiIndicatorSettings>
  settingsHash?: string
  symbol?: string
  vdoSettings?: Partial<VdoIndicatorSettings>
}

function normalizeVmiSettings(input?: Partial<VmiIndicatorSettings>): VmiIndicatorSettings {
  return { ...defaultVmiIndicatorSettings, ...(input ?? {}) }
}

function normalizeVmiContext(input: unknown) {
  const context = input && typeof input === 'object' ? input as VmiCalcContext : {}
  return {
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    period: String(context.period || 'M5').trim().toUpperCase(),
    settings: normalizeVmiSettings(context.settings),
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    symbol: typeof context.symbol === 'string' ? context.symbol.trim() : '',
    vdoSettings: { ...defaultVdoIndicatorSettings, ...(context.vdoSettings ?? {}) },
  }
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

function lineDashForStyle(style: VmiIndicatorSettings['zeroLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function createVmiFigures() {
  return [
    { key: 'histogram', title: 'VMI: ', type: 'bar', baseValue: 0, styles: () => {
      return { color: 'rgba(0,0,0,0)' }
    } },
  ]
}

function calculateSmaSeries(values: Array<number | undefined>, period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  let finiteCount = 0

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (Number.isFinite(value)) {
      sum += value as number
      finiteCount += 1
    }

    if (index >= period) {
      const removed = values[index - period]
      if (Number.isFinite(removed)) {
        sum -= removed as number
        finiteCount -= 1
      }
    }

    if (index >= period - 1 && finiteCount === period) output[index] = sum / period
  }

  return output
}

function sourceVdoValues(dataList: KLineData[], inputVdoSettings: Partial<VdoIndicatorSettings> = defaultVdoIndicatorSettings) {
  const vdoSettings = { ...defaultVdoIndicatorSettings, ...(inputVdoSettings ?? {}) }
  return calculateTradingViewVdoRows(dataList, vdoSettings, { includeMovingAverages: false }).map((row) => row.vdo)
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<VmiIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatVmiValue(value: number | undefined, precision: VmiIndicatorSettings['precision']) {
  return formatIndicatorValue(value, precision, 4)
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function histogramColor(row: VmiIndicatorRow, previous?: VmiIndicatorRow, settings = defaultVmiIndicatorSettings) {
  const value = row.histogram
  const previousValue = previous?.histogram
  const rising = Number.isFinite(value) && Number.isFinite(previousValue)
    ? (value as number) >= (previousValue as number)
    : (value ?? 0) >= 0
  return rising
    ? colorWithAlpha(settings.histogramPositiveColor, settings.histogramPositiveOpacity)
    : colorWithAlpha(settings.histogramNegativeColor, settings.histogramNegativeOpacity)
}

function alignStrokePixel(value: number, lineWidth: number) {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  bounding: { left: number; width: number },
  yAxis: { convertToPixel: (value: number) => number },
  visible: boolean,
  value: number,
  color: string,
  lineStyle: VmiIndicatorSettings['zeroLineStyle'],
  lineWidth: number,
  opacity: number,
) {
  if (!visible || !Number.isFinite(value)) return
  const width = clampLineWidth(lineWidth)
  const y = alignStrokePixel(yAxis.convertToPixel(value), width)
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash(lineDashForStyle(lineStyle))
  ctx.strokeStyle = colorWithAlpha(color, opacity)
  ctx.lineWidth = width
  ctx.moveTo(bounding.left, y)
  ctx.lineTo(bounding.left + bounding.width, y)
  ctx.stroke()
  ctx.restore()
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  rows: VmiIndicatorRow[],
  visibleRange: { from: number; to: number },
  _barSpace: { halfGapBar: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: VmiIndicatorSettings,
) {
  if (!settings.histogramVisible) return
  const zeroY = yAxis.convertToPixel(0)
  const start = Math.max(0, Math.floor(visibleRange.from) - 1)
  const end = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)

  ctx.save()
  for (let index = start; index <= end; index += 1) {
    const value = rows[index]?.histogram
    if (!Number.isFinite(value)) continue
    const x = xAxis.convertToPixel(index)
    const y = yAxis.convertToPixel(value as number)
    const previousX = index > 0 ? xAxis.convertToPixel(index - 1) : undefined
    const nextX = index < rows.length - 1 ? xAxis.convertToPixel(index + 1) : undefined
    const leftBoundary = Number.isFinite(previousX) ? ((previousX as number) + x) / 2 : x - ((nextX as number) - x) / 2
    const rightBoundary = Number.isFinite(nextX) ? (x + (nextX as number)) / 2 : x + (x - (previousX as number)) / 2
    const left = Math.round(leftBoundary + 0.5)
    const right = Math.round(rightBoundary - 0.5)
    const width = Math.max(1, right - left)
    ctx.fillStyle = histogramColor(rows[index], rows[index - 1], settings)
    ctx.fillRect(left, Math.min(y, zeroY), width, Math.max(1, Math.abs(zeroY - y)))
  }
  ctx.restore()
}

export function calculateTradingViewVmiRows(
  dataList: KLineData[],
  inputSettings: Partial<VmiIndicatorSettings> = defaultVmiIndicatorSettings,
  inputVdoSettings: Partial<VdoIndicatorSettings> = defaultVdoIndicatorSettings,
): VmiIndicatorRow[] {
  const settings = normalizeVmiSettings(inputSettings)
  const fastLength = clampPeriod(settings.fastLength, defaultVmiIndicatorSettings.fastLength)
  const slowLength = clampPeriod(settings.slowLength, defaultVmiIndicatorSettings.slowLength)
  const vdoValues = sourceVdoValues(dataList, inputVdoSettings)
  const fastSma = calculateSmaSeries(vdoValues, fastLength)
  const slowSma = calculateSmaSeries(vdoValues, slowLength)

  return dataList.map((_, index) => {
    const fast = fastSma[index]
    const slow = slowSma[index]
    const histogram = Number.isFinite(fast) && Number.isFinite(slow) ? (fast as number) - (slow as number) : undefined
    return Number.isFinite(histogram) ? { histogram } : {}
  })
}

function calculateVmiRows(dataList: KLineData[], inputContext?: unknown): VmiIndicatorRow[] {
  const context = normalizeVmiContext(inputContext)
  if (context.pageKey && context.symbol && context.period) {
    const snapshot = readIndicatorPageSnapshot(context.pageKey)
    if (
      snapshot &&
      snapshot.symbol === context.symbol &&
      snapshot.period === context.period &&
      snapshot.settingsHashes?.VMI === context.settingsHash
    ) {
      return calculateWithoutFuturePlaceholders(
        dataList,
        (realRows) => realRows.map((row) => {
          const barKey = assignBarKey(row, context.symbol, context.period)
          return snapshot.byBarKey[barKey]?.vmi ?? {}
        }),
      )
    }
    return calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewVmiRows(realRows, context.settings, context.vdoSettings),
    )
  }
  return calculateWithoutFuturePlaceholders(
    dataList,
    (realRows) => calculateTradingViewVmiRows(realRows, context.settings, context.vdoSettings),
  )
}

export function ensureTradingViewVmiIndicator() {
  if (registered) return
  registered = true

  registerIndicator<VmiIndicatorRow>({
    name: 'VMI',
    shortName: 'VMI',
    calcParams: [defaultVmiIndicatorSettings],
    precision: 4,
    figures: createVmiFigures(),
    regenerateFigures: createVmiFigures,
    createTooltipDataSource: (params) => {
      const context = normalizeVmiContext(params.indicator.calcParams[0])
      const settings = context.settings
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible() ? ` ${settings.fastLength} ${settings.slowLength}` : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible() && settings.histogramVisible) {
        values.push({
          title: { text: 'VMI ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVmiValue(row?.histogram, settings.precision), color: histogramColor(row ?? {}, params.indicator.result[resolveTooltipIndex(params) - 1], settings) },
        })
      }
      return { name: 'VMI', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ barSpace, bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const context = normalizeVmiContext(indicator.calcParams[0])
      const settings = context.settings
      drawHistogram(ctx, indicator.result, visibleRange, barSpace, xAxis, yAxis, settings)
      drawHorizontalLine(ctx, bounding, yAxis, settings.zeroLineVisible, 0, settings.zeroLineColor, settings.zeroLineStyle, settings.zeroLineWidth, settings.zeroLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upperBandVisible, settings.upperBandValue, settings.upperBandColor, settings.upperBandLineStyle, settings.upperBandLineWidth, settings.upperBandOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.lowerBandVisible, settings.lowerBandValue, settings.lowerBandColor, settings.lowerBandLineStyle, settings.lowerBandLineWidth, settings.lowerBandOpacity)

      return true
    },
    calc: (dataList, indicator) => calculateVmiRows(dataList, indicator.calcParams[0]),
  })
}
