import { LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultMacdIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MacdIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'

type MacdIndicatorRow = {
  histogram?: number
  macd?: number
  signal?: number
}

let registered = false

function normalizeMacdSettings(input?: Partial<MacdIndicatorSettings>): MacdIndicatorSettings {
  return { ...defaultMacdIndicatorSettings, ...(input ?? {}) }
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

function lineDashForStyle(style: MacdIndicatorSettings['macdLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: MacdIndicatorSettings['macdLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(
  color: string,
  visible: boolean,
  lineStyle: MacdIndicatorSettings['macdLineStyle'],
  lineWidth: number,
  opacity: number,
) {
  return {
    color: visible ? colorWithAlpha(color, opacity) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle),
  } as any
}

function createMacdLineFigures() {
  return [
    { key: 'histogram', title: 'Histogram: ', type: 'bar', baseValue: 0, styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeMacdSettings(indicator.calcParams[0] as Partial<MacdIndicatorSettings>)
      return { color: settings.histogramVisible ? colorWithAlpha(settings.histogramColor0, settings.histogramColor0Opacity) : 'rgba(0,0,0,0)' }
    } },
    { key: 'macd', title: 'MACD: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeMacdSettings(indicator.calcParams[0] as Partial<MacdIndicatorSettings>)
      return createLineFigureStyle(settings.macdColor, settings.macdVisible, settings.macdLineStyle, settings.macdLineWidth, settings.macdOpacity)
    } },
    { key: 'signal', title: 'Signal: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeMacdSettings(indicator.calcParams[0] as Partial<MacdIndicatorSettings>)
      return createLineFigureStyle(settings.signalColor, settings.signalVisible, settings.signalLineStyle, settings.signalLineWidth, settings.signalOpacity)
    } },
  ]
}

function sourceValue(data: KLineData, source: MacdIndicatorSettings['source']) {
  const open = Number(data.open)
  const high = Number(data.high)
  const low = Number(data.low)
  const close = Number(data.close)
  if (source === 'open') return open
  if (source === 'high') return high
  if (source === 'low') return low
  if (source === 'hl2') return (high + low) / 2
  if (source === 'hlc3') return (high + low + close) / 3
  if (source === 'ohlc4') return (open + high + low + close) / 4
  return close
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

function calculateMaSeries(values: Array<number | undefined>, period: number, type: MacdIndicatorSettings['oscillatorMaType']) {
  const output: Array<number | undefined> = values.map(() => undefined)
  if (type === 'sma') {
    for (let index = 0; index < values.length; index += 1) output[index] = calculateSma(values, period, index)
    return output
  }

  const alpha = 2 / (period + 1)
  let previous: number | undefined
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    previous = previous == null ? value : alpha * (value as number) + (1 - alpha) * previous
    output[index] = previous
  }
  return output
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<MacdIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatMacdValue(value: number | undefined, precision: MacdIndicatorSettings['precision']) {
  if (!Number.isFinite(value)) return '--'
  const digits = precision === 'system' ? 4 : Number(precision)
  return (value as number).toFixed(Number.isFinite(digits) ? digits : 4).replace(/\.?0+$/, '')
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function histogramColor(row: MacdIndicatorRow, previous?: MacdIndicatorRow, settings = defaultMacdIndicatorSettings) {
  const value = row.histogram ?? 0
  const previousValue = previous?.histogram ?? value
  if (value >= 0) {
    return value >= previousValue
      ? colorWithAlpha(settings.histogramColor0, settings.histogramColor0Opacity)
      : colorWithAlpha(settings.histogramColor1, settings.histogramColor1Opacity)
  }
  return value >= previousValue
    ? colorWithAlpha(settings.histogramColor2, settings.histogramColor2Opacity)
    : colorWithAlpha(settings.histogramColor3, settings.histogramColor3Opacity)
}

function alignStrokePixel(value: number, lineWidth: number) {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function drawLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: MacdIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  key: keyof MacdIndicatorRow,
  color: string,
  visible: boolean,
  lineStyle: MacdIndicatorSettings['macdLineStyle'],
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

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  rows: MacdIndicatorRow[],
  visibleRange: { from: number; to: number },
  barSpace: { halfGapBar: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: MacdIndicatorSettings,
) {
  if (!settings.histogramVisible) return
  const zeroY = yAxis.convertToPixel(0)
  const start = Math.max(0, Math.floor(visibleRange.from) - 1)
  const end = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  const halfWidth = Math.max(1, Number(barSpace.halfGapBar) || 2)

  ctx.save()
  for (let index = start; index <= end; index += 1) {
    const value = rows[index]?.histogram
    if (!Number.isFinite(value)) continue
    const x = xAxis.convertToPixel(index)
    const y = yAxis.convertToPixel(value as number)
    ctx.fillStyle = histogramColor(rows[index], rows[index - 1], settings)
    ctx.fillRect(Math.round(x - halfWidth), Math.min(y, zeroY), Math.max(1, Math.round(halfWidth * 2)), Math.max(1, Math.abs(zeroY - y)))
  }
  ctx.restore()
}

export function calculateTradingViewMacdRows(dataList: KLineData[], inputSettings: Partial<MacdIndicatorSettings> = defaultMacdIndicatorSettings): MacdIndicatorRow[] {
  const settings = normalizeMacdSettings(inputSettings)
  const fastLength = clampPeriod(settings.fastLength, defaultMacdIndicatorSettings.fastLength)
  const slowLength = clampPeriod(settings.slowLength, defaultMacdIndicatorSettings.slowLength)
  const signalLength = clampPeriod(settings.signalLength, defaultMacdIndicatorSettings.signalLength)
  const sourceValues = dataList.map((data) => sourceValue(data, settings.source))
  const fastMa = calculateMaSeries(sourceValues, fastLength, settings.oscillatorMaType)
  const slowMa = calculateMaSeries(sourceValues, slowLength, settings.oscillatorMaType)
  const macdValues: Array<number | undefined> = dataList.map((_, index) => {
    const fast = fastMa[index]
    const slow = slowMa[index]
    return Number.isFinite(fast) && Number.isFinite(slow) ? (fast as number) - (slow as number) : undefined
  })
  const signalValues = calculateMaSeries(macdValues, signalLength, settings.signalMaType)

  return dataList.map((_, index) => {
    const macd = macdValues[index]
    const signal = signalValues[index]
    const row: MacdIndicatorRow = {}
    if (Number.isFinite(macd)) row.macd = macd
    if (Number.isFinite(signal)) row.signal = signal
    if (Number.isFinite(macd) && Number.isFinite(signal)) row.histogram = (macd as number) - (signal as number)
    return row
  })
}

export function ensureTradingViewMacdIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MacdIndicatorRow>({
    name: 'MACD',
    shortName: 'MACD',
    calcParams: [defaultMacdIndicatorSettings],
    precision: 4,
    figures: createMacdLineFigures(),
    regenerateFigures: createMacdLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeMacdSettings(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible()
        ? ` ${settings.fastLength} ${settings.slowLength} ${settings.signalLength}`
        : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible()) {
        if (settings.macdVisible) values.push({ title: { text: 'MACD ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatMacdValue(row?.macd, settings.precision), color: colorWithAlpha(settings.macdColor, settings.macdOpacity) } })
        if (settings.signalVisible) values.push({ title: { text: 'Signal ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatMacdValue(row?.signal, settings.precision), color: colorWithAlpha(settings.signalColor, settings.signalOpacity) } })
        if (settings.histogramVisible) values.push({ title: { text: 'Histogram ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatMacdValue(row?.histogram, settings.precision), color: histogramColor(row ?? {}, params.indicator.result[resolveTooltipIndex(params) - 1], settings) } })
      }
      return { name: 'MACD', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ barSpace, bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeMacdSettings(indicator.calcParams[0])
      drawHistogram(ctx, indicator.result, visibleRange, barSpace, xAxis, yAxis, settings)

      if (settings.zeroLineVisible) {
        const width = clampLineWidth(settings.zeroLineWidth)
        const y = alignStrokePixel(yAxis.convertToPixel(0), width)
        ctx.save()
        ctx.beginPath()
        ctx.setLineDash(lineDashForStyle(settings.zeroLineStyle))
        ctx.strokeStyle = colorWithAlpha(settings.zeroLineColor, settings.zeroLineOpacity)
        ctx.lineWidth = width
        ctx.moveTo(bounding.left, y)
        ctx.lineTo(bounding.left + bounding.width, y)
        ctx.stroke()
        ctx.restore()
      }

      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'macd', settings.macdColor, settings.macdVisible, settings.macdLineStyle, settings.macdLineWidth, settings.macdOpacity)
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'signal', settings.signalColor, settings.signalVisible, settings.signalLineStyle, settings.signalLineWidth, settings.signalOpacity)
      return true
    },
    calc: (dataList, indicator) => calculateTradingViewMacdRows(dataList, indicator.calcParams[0]),
  })
}
