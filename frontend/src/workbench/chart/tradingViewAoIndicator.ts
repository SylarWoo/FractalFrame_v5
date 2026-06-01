import { registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultAoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { AoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { assignBarKey } from './barIdentity'
import { formatIndicatorValue } from './indicatorValueFormat'
import { readIndicatorPageSnapshot } from './indicatorPageSnapshotStore'

export type AoIndicatorRow = {
  histogram?: number
}

let registered = false

function normalizeAoSettings(input?: Partial<AoIndicatorSettings>): AoIndicatorSettings {
  return { ...defaultAoIndicatorSettings, ...(input ?? {}) }
}

function readAoSnapshotContext(input: unknown) {
  const context = input && typeof input === 'object' ? input as Partial<AoIndicatorSettings> & { pageKey?: string; period?: string; settingsHash?: string; symbol?: string } : {}
  return {
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    period: typeof context.period === 'string' ? context.period.trim().toUpperCase() : '',
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    symbol: typeof context.symbol === 'string' ? context.symbol.trim() : '',
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

function lineDashForStyle(style: AoIndicatorSettings['zeroLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function createAoFigures() {
  return [
    { key: 'histogram', title: 'AO: ', type: 'bar', baseValue: 0, styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeAoSettings(indicator.calcParams[0] as Partial<AoIndicatorSettings>)
      return { color: settings.histogramVisible ? colorWithAlpha(settings.histogramPositiveColor, settings.histogramPositiveOpacity) : 'rgba(0,0,0,0)' }
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

function sourceHl2Values(dataList: KLineData[]) {
  return dataList.map((row) => {
    const high = Number(row.high)
    const low = Number(row.low)
    return Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : undefined
  })
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<AoIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatAoValue(value: number | undefined, precision: AoIndicatorSettings['precision']) {
  return formatIndicatorValue(value, precision, 4)
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function histogramColor(row: AoIndicatorRow, previous?: AoIndicatorRow, settings = defaultAoIndicatorSettings) {
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
  lineStyle: AoIndicatorSettings['zeroLineStyle'],
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
  rows: AoIndicatorRow[],
  visibleRange: { from: number; to: number },
  _barSpace: { halfGapBar: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: AoIndicatorSettings,
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

export function calculateTradingViewAoRows(dataList: KLineData[], inputSettings: Partial<AoIndicatorSettings> = defaultAoIndicatorSettings): AoIndicatorRow[] {
  const settings = normalizeAoSettings(inputSettings)
  const fastLength = clampPeriod(settings.fastLength, defaultAoIndicatorSettings.fastLength)
  const slowLength = clampPeriod(settings.slowLength, defaultAoIndicatorSettings.slowLength)
  const hl2Values = sourceHl2Values(dataList)
  const fastSma = calculateSmaSeries(hl2Values, fastLength)
  const slowSma = calculateSmaSeries(hl2Values, slowLength)

  return dataList.map((_, index) => {
    const fast = fastSma[index]
    const slow = slowSma[index]
    const histogram = Number.isFinite(fast) && Number.isFinite(slow) ? (fast as number) - (slow as number) : undefined
    return Number.isFinite(histogram) ? { histogram } : {}
  })
}

export function ensureTradingViewAoIndicator() {
  if (registered) return
  registered = true

  registerIndicator<AoIndicatorRow>({
    name: 'AO',
    shortName: 'AO',
    calcParams: [defaultAoIndicatorSettings],
    precision: 4,
    figures: createAoFigures(),
    regenerateFigures: createAoFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeAoSettings(params.indicator.calcParams[0] as Partial<AoIndicatorSettings>)
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible() ? ` ${settings.fastLength} ${settings.slowLength}` : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible() && settings.histogramVisible) {
        values.push({
          title: { text: 'AO ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatAoValue(row?.histogram, settings.precision), color: histogramColor(row ?? {}, params.indicator.result[resolveTooltipIndex(params) - 1], settings) },
        })
      }
      return { name: 'AO', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ barSpace, bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeAoSettings(indicator.calcParams[0] as Partial<AoIndicatorSettings>)
      drawHistogram(ctx, indicator.result, visibleRange, barSpace, xAxis, yAxis, settings)
      drawHorizontalLine(ctx, bounding, yAxis, settings.zeroLineVisible, 0, settings.zeroLineColor, settings.zeroLineStyle, settings.zeroLineWidth, settings.zeroLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upperBandVisible, settings.upperBandValue, settings.upperBandColor, settings.upperBandLineStyle, settings.upperBandLineWidth, settings.upperBandOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.lowerBandVisible, settings.lowerBandValue, settings.lowerBandColor, settings.lowerBandLineStyle, settings.lowerBandLineWidth, settings.lowerBandOpacity)

      return true
    },
    calc: (dataList, indicator) => {
      const context = readAoSnapshotContext(indicator.calcParams[0])
      if (context.pageKey && context.symbol && context.period) {
        const snapshot = readIndicatorPageSnapshot(context.pageKey)
        if (
          snapshot &&
          snapshot.symbol === context.symbol &&
          snapshot.period === context.period &&
          snapshot.settingsHashes?.AO === context.settingsHash
        ) {
          return calculateWithoutFuturePlaceholders(
            dataList,
            (realRows) => realRows.map((row) => {
              const barKey = assignBarKey(row, context.symbol, context.period)
              return snapshot.byBarKey[barKey]?.ao ?? {}
            }),
          )
        }
        return calculateWithoutFuturePlaceholders(
          dataList,
          (realRows) => calculateTradingViewAoRows(realRows, indicator.calcParams[0]),
        )
      }
      return calculateWithoutFuturePlaceholders(
        dataList,
        (realRows) => calculateTradingViewAoRows(realRows, indicator.calcParams[0]),
      )
    },
  })
}
