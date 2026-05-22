import { LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultTsiIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { TsiIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'

type TsiIndicatorRow = {
  signal?: number
  tsi?: number
}

let registered = false

function normalizeTsiSettings(input?: Partial<TsiIndicatorSettings>): TsiIndicatorSettings {
  return { ...defaultTsiIndicatorSettings, ...(input ?? {}) }
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

function lineDashForStyle(style: TsiIndicatorSettings['tsiLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: TsiIndicatorSettings['tsiLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(color: string, visible: boolean, lineStyle: TsiIndicatorSettings['tsiLineStyle'], lineWidth: number, opacity: number) {
  return {
    color: visible ? colorWithAlpha(color, opacity) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle),
  } as any
}

function createTsiLineFigures() {
  return [
    { key: 'tsi', title: 'TSI: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeTsiSettings(indicator.calcParams[0] as Partial<TsiIndicatorSettings>)
      return createLineFigureStyle(settings.tsiColor, settings.tsiVisible, settings.tsiLineStyle, settings.tsiLineWidth, settings.tsiOpacity)
    } },
    { key: 'signal', title: 'Signal: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeTsiSettings(indicator.calcParams[0] as Partial<TsiIndicatorSettings>)
      return createLineFigureStyle(settings.signalColor, settings.signalVisible, settings.signalLineStyle, settings.signalLineWidth, settings.signalOpacity)
    } },
  ]
}

function calculateEmaSeries(values: Array<number | undefined>, period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
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

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<TsiIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatTsiValue(value: number | undefined, precision: TsiIndicatorSettings['precision']) {
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

function drawLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: TsiIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  key: keyof TsiIndicatorRow,
  color: string,
  visible: boolean,
  lineStyle: TsiIndicatorSettings['tsiLineStyle'],
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

export function calculateTradingViewTsiRows(dataList: KLineData[], inputSettings: Partial<TsiIndicatorSettings> = defaultTsiIndicatorSettings): TsiIndicatorRow[] {
  const settings = normalizeTsiSettings(inputSettings)
  const longLength = clampPeriod(settings.longLength, defaultTsiIndicatorSettings.longLength)
  const shortLength = clampPeriod(settings.shortLength, defaultTsiIndicatorSettings.shortLength)
  const signalLength = clampPeriod(settings.signalLength, defaultTsiIndicatorSettings.signalLength)
  const changeValues: Array<number | undefined> = dataList.map((data, index) => {
    if (index === 0) return 0
    return Number(data.close) - Number(dataList[index - 1]?.close)
  })
  const absChangeValues = changeValues.map((value) => Number.isFinite(value) ? Math.abs(value as number) : undefined)
  const doubleMomentum = calculateEmaSeries(calculateEmaSeries(changeValues, longLength), shortLength)
  const doubleAbsMomentum = calculateEmaSeries(calculateEmaSeries(absChangeValues, longLength), shortLength)
  const tsiValues = doubleMomentum.map((value, index) => {
    const absolute = doubleAbsMomentum[index]
    if (!Number.isFinite(value) || !Number.isFinite(absolute) || absolute === 0) return undefined
    return 100 * (value as number) / (absolute as number)
  })
  const signalValues = calculateEmaSeries(tsiValues, signalLength)
  return dataList.map((_, index) => {
    const row: TsiIndicatorRow = {}
    if (Number.isFinite(tsiValues[index])) row.tsi = tsiValues[index]
    if (Number.isFinite(signalValues[index])) row.signal = signalValues[index]
    return row
  })
}

export function ensureTradingViewTsiIndicator() {
  if (registered) return
  registered = true

  registerIndicator<TsiIndicatorRow>({
    name: 'TSI',
    shortName: 'TSI',
    calcParams: [defaultTsiIndicatorSettings],
    precision: 2,
    figures: createTsiLineFigures(),
    regenerateFigures: createTsiLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeTsiSettings(params.indicator.calcParams[0])
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputStatusLineVisible && readIndicatorInputsVisible()
        ? ` ${settings.longLength} ${settings.shortLength} ${settings.signalLength}`
        : ''
      const values = []
      if (settings.statusLineValuesVisible && readIndicatorValuesVisible()) {
        if (settings.tsiVisible) values.push({ title: { text: 'TSI ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatTsiValue(row?.tsi, settings.precision), color: colorWithAlpha(settings.tsiColor, settings.tsiOpacity) } })
        if (settings.signalVisible) values.push({ title: { text: 'Signal ', color: params.defaultStyles.tooltip.text.color }, value: { text: formatTsiValue(row?.signal, settings.precision), color: colorWithAlpha(settings.signalColor, settings.signalOpacity) } })
      }
      return { name: 'TSI', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeTsiSettings(indicator.calcParams[0])
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
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'tsi', settings.tsiColor, settings.tsiVisible, settings.tsiLineStyle, settings.tsiLineWidth, settings.tsiOpacity)
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, 'signal', settings.signalColor, settings.signalVisible, settings.signalLineStyle, settings.signalLineWidth, settings.signalOpacity)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewTsiRows(realRows, indicator.calcParams[0]),
    ),
  })
}
