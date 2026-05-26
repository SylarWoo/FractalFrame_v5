import { IndicatorSeries, LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultVdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'

export type VdoIndicatorRow = {
  vdo?: number
}

let registered = false

function normalizeVdoSettings(input?: Partial<VdoIndicatorSettings>): VdoIndicatorSettings {
  return { ...defaultVdoIndicatorSettings, ...(input ?? {}) }
}

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(500, next)) : fallback
}

function clampSmoothingPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(0, Math.min(500, next)) : fallback
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

function lineDashForStyle(style: VdoIndicatorSettings['dpoLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: VdoIndicatorSettings['dpoLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(color: string, visible: boolean, lineStyle: VdoIndicatorSettings['dpoLineStyle'], lineWidth: number, opacity: number) {
  return {
    color: visible ? colorWithAlpha(color, opacity) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle) as never,
  }
}

function createVdoLineFigures() {
  return [
    { key: 'vdo', title: 'VDO: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeVdoSettings(indicator.calcParams[0] as Partial<VdoIndicatorSettings>)
      return createLineFigureStyle(settings.dpoColor, settings.dpoVisible, settings.dpoLineStyle, settings.dpoLineWidth, settings.dpoOpacity)
    } },
  ]
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<VdoIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatVdoValue(value: number | undefined, precision: VdoIndicatorSettings['precision']) {
  return formatIndicatorValue(value, precision, 4)
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

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  bounding: { left: number; width: number },
  yAxis: { convertToPixel: (value: number) => number },
  visible: boolean,
  value: number,
  color: string,
  lineStyle: VdoIndicatorSettings['dpoLineStyle'],
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

function drawHorizontalBand(
  ctx: CanvasRenderingContext2D,
  bounding: { left: number; width: number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: VdoIndicatorSettings,
) {
  if (!settings.backgroundVisible) return
  const upY = yAxis.convertToPixel(settings.upLineValue)
  const downY = yAxis.convertToPixel(settings.downLineValue)
  const top = Math.min(upY, downY)
  const height = Math.abs(downY - upY)
  if (height <= 0) return

  ctx.save()
  ctx.fillStyle = colorWithAlpha(settings.backgroundColor, settings.backgroundOpacity)
  ctx.fillRect(bounding.left, top, bounding.width, height)
  ctx.restore()
}

function drawLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: VdoIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: VdoIndicatorSettings,
) {
  if (!settings.dpoVisible) return
  const width = clampLineWidth(settings.dpoLineWidth)
  const start = Math.max(0, Math.floor(visibleRange.from) - 1)
  const end = Math.min(rows.length - 1, Math.ceil(visibleRange.to) + 1)
  let started = false

  ctx.save()
  ctx.beginPath()
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'round'
  ctx.lineWidth = width
  ctx.strokeStyle = colorWithAlpha(settings.dpoColor, settings.dpoOpacity)
  ctx.setLineDash(lineDashForStyle(settings.dpoLineStyle))

  for (let index = start; index <= end; index += 1) {
    const value = rows[index]?.vdo
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

function calculateEmaSeries(values: Array<number | undefined>, period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
  if (period <= 1) return values
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

export function calculateTradingViewVdoRows(dataList: KLineData[], inputSettings: Partial<VdoIndicatorSettings> = defaultVdoIndicatorSettings): VdoIndicatorRow[] {
  const settings = normalizeVdoSettings(inputSettings)
  const length = clampPeriod(settings.length, defaultVdoIndicatorSettings.length)
  const emaSmoothing = clampSmoothingPeriod(settings.emaSmoothing, defaultVdoIndicatorSettings.emaSmoothing)
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

  const rawValues = dataList.map((_, index) => {
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
    return { vdo: plusSum / trueRangeSum - minusSum / trueRangeSum }
  })

  if (emaSmoothing <= 1) return rawValues

  const smoothedValues = calculateEmaSeries(rawValues.map((row) => row.vdo), emaSmoothing)
  return rawValues.map((row, index) => Number.isFinite(smoothedValues[index]) ? { vdo: smoothedValues[index] } : row)
}

export function ensureTradingViewVdoIndicator() {
  if (registered) return
  registered = true

  registerIndicator<VdoIndicatorRow>({
    name: 'VDO',
    shortName: 'VDO',
    calcParams: [defaultVdoIndicatorSettings],
    precision: 4,
    series: IndicatorSeries.Normal,
    figures: createVdoLineFigures(),
    regenerateFigures: createVdoLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeVdoSettings(params.indicator.calcParams[0] as Partial<VdoIndicatorSettings>)
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputsInStatusLine && readIndicatorInputsVisible() ? ` ${settings.length} ${settings.emaSmoothing}` : ''
      const values = []
      if (settings.valuesInStatusLine && readIndicatorValuesVisible() && settings.dpoVisible) {
        values.push({
          title: { text: 'VDO ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVdoValue(row?.vdo, settings.precision), color: colorWithAlpha(settings.dpoColor, settings.dpoOpacity) },
        })
      }
      return { name: 'VDO', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeVdoSettings(indicator.calcParams[0] as Partial<VdoIndicatorSettings>)
      drawHorizontalBand(ctx, bounding, yAxis, settings)
      drawHorizontalLine(ctx, bounding, yAxis, settings.zeroLineVisible, 0, settings.zeroLineColor, settings.zeroLineStyle, settings.zeroLineWidth, settings.zeroLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upLineVisible, settings.upLineValue, settings.upLineColor, settings.upLineStyle, settings.upLineWidth, settings.upLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upLine2Visible, settings.upLine2Value, settings.upLine2Color, settings.upLine2Style, settings.upLine2Width, settings.upLine2Opacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.downLineVisible, settings.downLineValue, settings.downLineColor, settings.downLineStyle, settings.downLineWidth, settings.downLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.downLine2Visible, settings.downLine2Value, settings.downLine2Color, settings.downLine2Style, settings.downLine2Width, settings.downLine2Opacity)
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, settings)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewVdoRows(realRows, indicator.calcParams[0] as Partial<VdoIndicatorSettings>),
    ),
  })
}
