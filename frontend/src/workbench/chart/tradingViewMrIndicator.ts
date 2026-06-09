import { IndicatorSeries, LineType, PolygonType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, IndicatorDrawParams, KLineData } from 'klinecharts'
import {
  defaultMrIndicatorSettings,
  normalizeMrSettings,
  type MrIndicatorSettings,
} from '../rightDrawer/indicatorSettingsSchema'
import type { HorizontalLineFigure, ScreenPoint } from './chartDrawingTypes'
import { createFibRetracementPointFigures } from './fibRetracementOverlayFigures'
import { readIndicatorPageSnapshot } from './indicatorPageSnapshotStore'
import { readMorganRangeFibExtendData } from './morganRangePreset'
import type { MorganRangeSegment } from './morganRangeModel'

export type MrIndicatorRow = Record<string, never>

type MrCalcSettings = Partial<MrIndicatorSettings> & {
  pageKey?: string
  runtimeOnly?: boolean
  settingsHash?: string
  settingsHashKey?: string
}

type PixelAxis = {
  convertToPixel: (value: number) => number
}

const registered = new Set<string>()

export type TradingViewMrIndicatorName = 'MR_M5' | 'MR_M30'

export function resolveTradingViewMrIndicatorName(name: 'MR-M5' | 'MR-M30'): TradingViewMrIndicatorName {
  return name === 'MR-M30' ? 'MR_M30' : 'MR_M5'
}

function normalizeCalcSettings(input: unknown) {
  const context = input && typeof input === 'object' ? input as MrCalcSettings : {}
  return {
    pageKey: typeof context.pageKey === 'string' ? context.pageKey : '',
    runtimeOnly: context.runtimeOnly === true,
    settings: normalizeMrSettings(context),
    settingsHash: typeof context.settingsHash === 'string' ? context.settingsHash : '',
    settingsHashKey: typeof context.settingsHashKey === 'string' ? context.settingsHashKey : '',
  }
}

export function calculateTradingViewMrRows(dataList: KLineData[]): MrIndicatorRow[] {
  return dataList.map(() => ({}))
}

function alignStrokePixel(value: number, width: number) {
  return width % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function readMorganRangeSegments(settings: ReturnType<typeof normalizeCalcSettings>) {
  const snapshot = readIndicatorPageSnapshot(settings.pageKey)
  if (!snapshot) return []
  const hashKey = settings.settingsHashKey || 'MR_M5'
  if (settings.settingsHash && snapshot.settingsHashes?.[hashKey] !== settings.settingsHash) return []
  return snapshot.morganRange?.segments ?? []
}

function convertPoint(xAxis: PixelAxis, yAxis: PixelAxis, index: number, value: number) {
  const x = xAxis.convertToPixel(index)
  const y = yAxis.convertToPixel(value)
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function numberAttr(attrs: Record<string, unknown>, key: string) {
  const value = Number(attrs[key])
  return Number.isFinite(value) ? value : null
}

function normalizeLineWidth(value: unknown) {
  const width = Math.round(Number(value))
  return Number.isFinite(width) ? Math.max(1, Math.min(width, 8)) : 1
}

function applyDash(ctx: CanvasRenderingContext2D, styles: Record<string, unknown> | undefined) {
  if (styles?.style === LineType.Solid || styles?.style === 'solid') {
    ctx.setLineDash([])
    return
  }
  const dashedValue = styles?.dashedValue
  if (Array.isArray(dashedValue)) {
    ctx.setLineDash(dashedValue.map(Number).filter(Number.isFinite))
    return
  }
  if (styles?.style === LineType.Dashed) {
    ctx.setLineDash([6, 4])
    return
  }
  ctx.setLineDash([])
}

function drawLineFigure(ctx: CanvasRenderingContext2D, figure: HorizontalLineFigure) {
  const coordinates = figure.attrs.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return
  const start = coordinates[0] as Partial<ScreenPoint>
  const end = coordinates[1] as Partial<ScreenPoint>
  const startX = Number(start.x)
  const startY = Number(start.y)
  const endX = Number(end.x)
  const endY = Number(end.y)
  if (![startX, startY, endX, endY].every(Number.isFinite)) return
  const styles = figure.styles
  const width = normalizeLineWidth(styles?.size)
  ctx.save()
  ctx.beginPath()
  ctx.lineWidth = width
  ctx.strokeStyle = typeof styles?.color === 'string' ? styles.color : '#787b86'
  applyDash(ctx, styles)
  const horizontal = Math.abs(startY - endY) < 0.5
  ctx.moveTo(startX, horizontal ? alignStrokePixel(startY, width) : startY)
  ctx.lineTo(endX, horizontal ? alignStrokePixel(endY, width) : endY)
  ctx.stroke()
  ctx.restore()
}

function drawRectFigure(ctx: CanvasRenderingContext2D, figure: HorizontalLineFigure) {
  const x = numberAttr(figure.attrs, 'x')
  const y = numberAttr(figure.attrs, 'y')
  const width = numberAttr(figure.attrs, 'width')
  const height = numberAttr(figure.attrs, 'height')
  if (x == null || y == null || width == null || height == null || width <= 0 || height <= 0) return
  const styles = figure.styles
  ctx.save()
  if (styles?.style !== PolygonType.Stroke) {
    ctx.fillStyle = typeof styles?.color === 'string' ? styles.color : '#787b86'
    ctx.fillRect(x, y, width, height)
  }
  if (styles?.style === PolygonType.Stroke || styles?.style === PolygonType.StrokeFill) {
    const lineWidth = normalizeLineWidth(styles?.borderSize ?? styles?.size)
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = typeof styles?.borderColor === 'string' ? styles.borderColor : '#787b86'
    applyDash(ctx, styles)
    ctx.strokeRect(x, y, width, height)
  }
  ctx.restore()
}

function drawTextFigure(ctx: CanvasRenderingContext2D, figure: HorizontalLineFigure) {
  const x = numberAttr(figure.attrs, 'x')
  const y = numberAttr(figure.attrs, 'y')
  const text = typeof figure.attrs.text === 'string' ? figure.attrs.text : ''
  if (x == null || y == null || !text) return
  const styles = figure.styles
  const size = Number(styles?.size)
  const fontSize = Number.isFinite(size) ? Math.max(8, Math.min(Math.round(size), 32)) : 12
  const weight = typeof styles?.weight === 'string' ? styles.weight : '500'
  const family = typeof styles?.family === 'string' ? styles.family : 'Inter, Arial, sans-serif'
  ctx.save()
  ctx.fillStyle = typeof styles?.color === 'string' ? styles.color : '#787b86'
  ctx.font = `${weight} ${fontSize}px ${family}`
  ctx.textAlign = figure.attrs.align === 'left' || figure.attrs.align === 'right' || figure.attrs.align === 'center'
    ? figure.attrs.align
    : 'center'
  ctx.textBaseline = figure.attrs.baseline === 'top' || figure.attrs.baseline === 'middle' || figure.attrs.baseline === 'bottom'
    ? figure.attrs.baseline
    : 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

function drawMorganFigure(ctx: CanvasRenderingContext2D, figure: HorizontalLineFigure) {
  if (figure.type === 'line') drawLineFigure(ctx, figure)
  if (figure.type === 'rect') drawRectFigure(ctx, figure)
  if (figure.type === 'text') drawTextFigure(ctx, figure)
}

function drawMorganRangeSegment(
  ctx: CanvasRenderingContext2D,
  bounding: { height: number; width: number },
  segment: MorganRangeSegment,
  xAxis: PixelAxis,
  yAxis: PixelAxis,
) {
  const start = Math.floor(Number(segment.startIndex))
  const end = Math.floor(Number(segment.endIndex))
  const center = Number(segment.center)
  const upper = Number(segment.upper)
  const lower = Number(segment.lower)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(center) || !Number.isFinite(upper) || !Number.isFinite(lower)) return

  const drawHalfRange = (edgeValue: number) => {
    const startPoint = convertPoint(xAxis, yAxis, start - 0.5, center)
    const endPoint = convertPoint(xAxis, yAxis, end + 0.5, edgeValue)
    if (!startPoint || !endPoint) return
    const figures = createFibRetracementPointFigures({
      bounding,
      coordinates: [startPoint, endPoint],
      overlay: {
        currentStep: 0,
        extendData: readMorganRangeFibExtendData(),
        paneId: 'candle_pane',
        points: [
          { dataIndex: start, timestamp: segment.startTimestamp, value: center },
          { dataIndex: end, timestamp: segment.startTimestamp, value: edgeValue },
        ],
        visible: true,
      },
    })
    figures.forEach((figure) => drawMorganFigure(ctx, figure))
  }

  drawHalfRange(upper)
  drawHalfRange(lower)
}

function drawTradingViewMrIndicator({
  bounding,
  ctx,
  indicator,
  visibleRange,
  xAxis,
  yAxis,
}: IndicatorDrawParams<MrIndicatorRow>) {
  const settingsContext = normalizeCalcSettings(indicator.calcParams[0])
  const segments = readMorganRangeSegments(settingsContext)
  if (segments.length === 0) return
  const from = Math.max(0, Math.floor(Number(visibleRange.from)) - 2)
  const to = Math.max(from, Math.floor(Number(visibleRange.to)) + 2)
  segments.forEach((segment) => {
    if (segment.endIndex < from || segment.startIndex > to) return
    drawMorganRangeSegment(ctx, bounding, segment, xAxis, yAxis)
  })
}

export function ensureTradingViewMrIndicator(name: TradingViewMrIndicatorName = 'MR_M5') {
  if (registered.has(name)) return
  registered.add(name)

  registerIndicator<MrIndicatorRow>({
    name,
    shortName: name,
    calcParams: [defaultMrIndicatorSettings],
    series: IndicatorSeries.Price,
    precision: 2,
    shouldOhlc: true,
    figures: [],
    regenerateFigures: () => [],
    createTooltipDataSource: (params: IndicatorCreateTooltipDataSourceParams<MrIndicatorRow>) => {
      const settings = normalizeCalcSettings(params.indicator.calcParams[0]).settings
      return {
        name,
        calcParamsText: settings.inputsInStatusLine ? ' H4/M5' : '',
        icons: [],
        values: [],
      }
    },
    draw: (params) => {
      drawTradingViewMrIndicator(params)
      return true
    },
    calc: (dataList) => calculateTradingViewMrRows(dataList),
  })
}
