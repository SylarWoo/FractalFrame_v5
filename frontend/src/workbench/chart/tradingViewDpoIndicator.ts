import { IndicatorSeries, LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultDpoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { DpoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'

type DpoIndicatorRow = {
  dpo?: number
}

let registered = false

function normalizeDpoSettings(input?: Partial<DpoIndicatorSettings>): DpoIndicatorSettings {
  return { ...defaultDpoIndicatorSettings, ...(input ?? {}) }
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

function lineDashForStyle(style: DpoIndicatorSettings['dpoLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: DpoIndicatorSettings['dpoLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(
  color: string,
  visible: boolean,
  lineStyle: DpoIndicatorSettings['dpoLineStyle'],
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

function createDpoLineFigures() {
  return [
    {
      key: 'dpo',
      title: 'DPO: ',
      type: 'line',
      styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
        const settings = normalizeDpoSettings(indicator.calcParams[0] as Partial<DpoIndicatorSettings>)
        return createLineFigureStyle(settings.dpoColor, settings.dpoVisible, settings.dpoLineStyle, settings.dpoLineWidth, settings.dpoOpacity)
      },
    },
  ]
}

function calculateSmaSeries(values: Array<number | undefined>, period: number) {
  const output: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  let validCount = 0

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (Number.isFinite(value)) {
      sum += value as number
      validCount += 1
    }

    const removeIndex = index - period
    if (removeIndex >= 0) {
      const removed = values[removeIndex]
      if (Number.isFinite(removed)) {
        sum -= removed as number
        validCount -= 1
      }
    }

    if (index >= period - 1 && validCount === period) output[index] = sum / period
  }

  return output
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<DpoIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatDpoValue(value: number | undefined, precision: DpoIndicatorSettings['precision']) {
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

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  bounding: { left: number; width: number },
  yAxis: { convertToPixel: (value: number) => number },
  visible: boolean,
  value: number,
  color: string,
  lineStyle: DpoIndicatorSettings['dpoLineStyle'],
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
  settings: DpoIndicatorSettings,
) {
  if (!settings.backgroundVisible || !Number.isFinite(settings.upLineValue) || !Number.isFinite(settings.downLineValue)) return
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
  rows: DpoIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: DpoIndicatorSettings,
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
    const value = rows[index]?.dpo
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

export function calculateTradingViewDpoRows(dataList: KLineData[], inputSettings: Partial<DpoIndicatorSettings> = defaultDpoIndicatorSettings): DpoIndicatorRow[] {
  const settings = normalizeDpoSettings(inputSettings)
  const length = clampPeriod(settings.length, defaultDpoIndicatorSettings.length)
  const barsBack = Math.floor(length / 2) + 1
  const closes = dataList.map((row) => {
    const close = Number(row.close)
    return Number.isFinite(close) ? close : undefined
  })
  const smaValues = calculateSmaSeries(closes, length)

  return dataList.map((_, index) => {
    const row: DpoIndicatorRow = {}
    const priceIndex = settings.centered ? index - barsBack : index
    const smaIndex = settings.centered ? index : index - barsBack
    const price = closes[priceIndex]
    const sma = smaValues[smaIndex]

    if (Number.isFinite(price) && Number.isFinite(sma)) {
      row.dpo = (price as number) - (sma as number)
    }

    return row
  })
}

export function ensureTradingViewDpoIndicator() {
  if (registered) return
  registered = true

  registerIndicator<DpoIndicatorRow>({
    name: 'DPO',
    shortName: 'DPO',
    calcParams: [defaultDpoIndicatorSettings],
    precision: 2,
    series: IndicatorSeries.Normal,
    figures: createDpoLineFigures(),
    regenerateFigures: createDpoLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeDpoSettings(params.indicator.calcParams[0] as Partial<DpoIndicatorSettings>)
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputsInStatusLine && readIndicatorInputsVisible() ? ` ${settings.length}` : ''
      const values = []
      if (settings.valuesInStatusLine && readIndicatorValuesVisible() && settings.dpoVisible) {
        values.push({
          title: { text: 'DPO ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatDpoValue(row?.dpo, settings.precision), color: colorWithAlpha(settings.dpoColor, settings.dpoOpacity) },
        })
      }

      return { name: 'DPO', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeDpoSettings(indicator.calcParams[0] as Partial<DpoIndicatorSettings>)
      drawHorizontalBand(ctx, bounding, yAxis, settings)
      drawHorizontalLine(ctx, bounding, yAxis, settings.zeroLineVisible, settings.zeroLineValue, settings.zeroLineColor, settings.zeroLineStyle, settings.zeroLineWidth, settings.zeroLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upLineVisible, settings.upLineValue, settings.upLineColor, settings.upLineStyle, settings.upLineWidth, settings.upLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.downLineVisible, settings.downLineValue, settings.downLineColor, settings.downLineStyle, settings.downLineWidth, settings.downLineOpacity)

      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, settings)
      return true
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewDpoRows(realRows, indicator.calcParams[0] as Partial<DpoIndicatorSettings>),
    ),
  })
}
