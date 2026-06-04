import { IndicatorSeries, LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultVdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VdoIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'
import { formatIndicatorValue } from './indicatorValueFormat'
import { mapPageIndicatorSnapshotToDataList } from './pageIndicatorRuntime'
import { calculateVdoIndicatorRows } from './vdoCore'

export type VdoIndicatorRow = {
  vdo?: number
  vdoMa?: number
  vdoMa2?: number
}

let registered = false

function normalizeVdoSettings(input?: Partial<VdoIndicatorSettings>): VdoIndicatorSettings {
  return { ...defaultVdoIndicatorSettings, ...(input ?? {}) }
}

function readVdoSnapshotContext(input: unknown) {
  const context = input && typeof input === 'object' ? input as Partial<VdoIndicatorSettings> & { pageKey?: string; period?: string; runtimeOnly?: boolean; settingsHash?: string; symbol?: string } : {}
  return {
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    period: typeof context.period === 'string' ? context.period.trim().toUpperCase() : '',
    runtimeOnly: context.runtimeOnly === true,
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    symbol: typeof context.symbol === 'string' ? context.symbol.trim() : '',
  }
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
    { key: 'vdoMa', title: 'VDO MA: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeVdoSettings(indicator.calcParams[0] as Partial<VdoIndicatorSettings>)
      return createLineFigureStyle(settings.vdoMaColor, settings.vdoMaVisible, settings.vdoMaLineStyle, settings.vdoMaLineWidth, settings.vdoMaOpacity)
    } },
    { key: 'vdoMa2', title: 'VDO MA2: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeVdoSettings(indicator.calcParams[0] as Partial<VdoIndicatorSettings>)
      return createLineFigureStyle(settings.vdoMa2Color, settings.vdoMa2Visible, settings.vdoMa2LineStyle, settings.vdoMa2LineWidth, settings.vdoMa2Opacity)
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

function drawBandBetweenValues(
  ctx: CanvasRenderingContext2D,
  bounding: { left: number; width: number },
  yAxis: { convertToPixel: (value: number) => number },
  visible: boolean,
  upperValue: number,
  lowerValue: number,
  color: string,
  opacity: number,
) {
  if (!visible || !Number.isFinite(upperValue) || !Number.isFinite(lowerValue)) return
  const upY = yAxis.convertToPixel(upperValue)
  const downY = yAxis.convertToPixel(lowerValue)
  const top = Math.min(upY, downY)
  const height = Math.abs(downY - upY)
  if (height <= 0) return

  ctx.save()
  ctx.fillStyle = colorWithAlpha(color, opacity)
  ctx.fillRect(bounding.left, top, bounding.width, height)
  ctx.restore()
}

function drawHorizontalBands(
  ctx: CanvasRenderingContext2D,
  bounding: { left: number; width: number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: VdoIndicatorSettings,
) {
  drawBandBetweenValues(ctx, bounding, yAxis, settings.backgroundVisible, settings.upLineValue, settings.downLineValue, settings.backgroundColor, settings.backgroundOpacity)
  drawBandBetweenValues(ctx, bounding, yAxis, settings.backgroundUpperVisible, settings.upLineValue, settings.upLine2Value, settings.backgroundUpperColor, settings.backgroundUpperOpacity)
  drawBandBetweenValues(ctx, bounding, yAxis, settings.backgroundUpper2Visible, settings.upLine3Value, settings.upLine2Value, settings.backgroundUpper2Color, settings.backgroundUpper2Opacity)
  drawBandBetweenValues(ctx, bounding, yAxis, settings.backgroundLowerVisible, settings.downLine2Value, settings.downLineValue, settings.backgroundLowerColor, settings.backgroundLowerOpacity)
  drawBandBetweenValues(ctx, bounding, yAxis, settings.backgroundLower2Visible, settings.downLine2Value, settings.downLine3Value, settings.backgroundLower2Color, settings.backgroundLower2Opacity)
}

function drawLineSeries(
  ctx: CanvasRenderingContext2D,
  rows: VdoIndicatorRow[],
  visibleRange: { from: number; to: number },
  xAxis: { convertToPixel: (value: number) => number },
  yAxis: { convertToPixel: (value: number) => number },
  settings: VdoIndicatorSettings,
  valueKey: keyof VdoIndicatorRow = 'vdo',
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
    const value = rows[index]?.[valueKey]
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

export function calculateTradingViewVdoRows(
  dataList: KLineData[],
  inputSettings: Partial<VdoIndicatorSettings> = defaultVdoIndicatorSettings,
  options: { includeMovingAverages?: boolean } = {},
): VdoIndicatorRow[] {
  return calculateVdoIndicatorRows(dataList, inputSettings, options)
}

export function calculateVdoRowsForKLineChart(dataList: KLineData[], inputContext: unknown): VdoIndicatorRow[] {
  const context = readVdoSnapshotContext(inputContext)
  if (context.pageKey && context.symbol && context.period) {
    const rows = mapPageIndicatorSnapshotToDataList<VdoIndicatorRow>({
      dataList,
      indicator: 'vdo',
      pageKey: context.pageKey,
      period: context.period,
      settingsHashKey: 'VDO',
      settingsHash: context.settingsHash,
      symbol: context.symbol,
    })
    if (rows) {
      return calculateWithoutFuturePlaceholders(dataList, () => rows)
    }
    if (context.runtimeOnly) {
      return calculateWithoutFuturePlaceholders(dataList, (realRows) => realRows.map(() => ({})))
    }
  }
  return calculateWithoutFuturePlaceholders(
    dataList,
    (realRows) => calculateTradingViewVdoRows(realRows, inputContext as Partial<VdoIndicatorSettings>),
  )
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
      if (settings.valuesInStatusLine && readIndicatorValuesVisible() && settings.vdoMaVisible) {
        values.push({
          title: { text: 'MA ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVdoValue(row?.vdoMa, settings.precision), color: colorWithAlpha(settings.vdoMaColor, settings.vdoMaOpacity) },
        })
      }
      if (settings.valuesInStatusLine && readIndicatorValuesVisible() && settings.vdoMa2Visible) {
        values.push({
          title: { text: 'MA2 ', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVdoValue(row?.vdoMa2, settings.precision), color: colorWithAlpha(settings.vdoMa2Color, settings.vdoMa2Opacity) },
        })
      }
      return { name: 'VDO', calcParamsText: inputsText, icons: [], values }
    },
    draw: ({ bounding, ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeVdoSettings(indicator.calcParams[0] as Partial<VdoIndicatorSettings>)
      drawHorizontalBands(ctx, bounding, yAxis, settings)
      drawHorizontalLine(ctx, bounding, yAxis, settings.zeroLineVisible, 0, settings.zeroLineColor, settings.zeroLineStyle, settings.zeroLineWidth, settings.zeroLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upLineVisible, settings.upLineValue, settings.upLineColor, settings.upLineStyle, settings.upLineWidth, settings.upLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upLine2Visible, settings.upLine2Value, settings.upLine2Color, settings.upLine2Style, settings.upLine2Width, settings.upLine2Opacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.upLine3Visible, settings.upLine3Value, settings.upLine3Color, settings.upLine3Style, settings.upLine3Width, settings.upLine3Opacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.downLineVisible, settings.downLineValue, settings.downLineColor, settings.downLineStyle, settings.downLineWidth, settings.downLineOpacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.downLine2Visible, settings.downLine2Value, settings.downLine2Color, settings.downLine2Style, settings.downLine2Width, settings.downLine2Opacity)
      drawHorizontalLine(ctx, bounding, yAxis, settings.downLine3Visible, settings.downLine3Value, settings.downLine3Color, settings.downLine3Style, settings.downLine3Width, settings.downLine3Opacity)
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, settings)
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, {
        ...settings,
        dpoColor: settings.vdoMaColor,
        dpoLineStyle: settings.vdoMaLineStyle,
        dpoLineWidth: settings.vdoMaLineWidth,
        dpoOpacity: settings.vdoMaOpacity,
        dpoVisible: settings.vdoMaVisible,
      }, 'vdoMa')
      drawLineSeries(ctx, indicator.result, visibleRange, xAxis, yAxis, {
        ...settings,
        dpoColor: settings.vdoMa2Color,
        dpoLineStyle: settings.vdoMa2LineStyle,
        dpoLineWidth: settings.vdoMa2LineWidth,
        dpoOpacity: settings.vdoMa2Opacity,
        dpoVisible: settings.vdoMa2Visible,
      }, 'vdoMa2')
      return true
    },
    calc: (dataList, indicator) => calculateVdoRowsForKLineChart(dataList, indicator.calcParams[0]),
  })
}
