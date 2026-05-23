import { registerFigure } from 'klinecharts'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { ScreenPoint } from './chartDrawingTypes'
import { distanceToSegment, isScreenPoint } from './chartDrawingGeometry'
import { measureCanvasText } from './drawingTextMeasure'
import { drawDrawingTextBoxRows, resolveDrawingTextBoxMetrics } from './drawingTextBoxCore'
import { resolveHorizontalLineTextLayout } from './horizontalLineTextLayout'
import { resolveTrendTextLayout } from './trendLineTextLayout'
import { ensureTwoPointStatsBoxFigure, twoPointStatsBoxFigureName } from './twoPointDrawingStatsFigure'

export const horizontalLineTextFigureName = 'ffHorizontalLineText'
export const rulerCenterTextFigureName = 'ffRulerCenterText'
export const trendLineHitFigureName = 'ffTrendLineHit'
export const trendLineTextFigureName = 'ffTrendLineText'
export const trendLineStatsBoxFigureName: string = twoPointStatsBoxFigureName
const rulerCenterTextOffsetY = 3

let horizontalLineTextFigureRegistered = false
let rulerCenterTextFigureRegistered = false
let trendLineHitFigureRegistered = false
let trendLineTextFigureRegistered = false

export function ensureTrendLineHitFigure() {
  if (trendLineHitFigureRegistered) return
  trendLineHitFigureRegistered = true
  registerFigure({
    name: trendLineHitFigureName,
    checkEventOn: (coordinate: unknown, attrs: unknown) => {
      const point = coordinate as Partial<ScreenPoint>
      const hitAttrs = attrs as { coordinates?: ScreenPoint[]; hitSlop?: number }
      const start = hitAttrs.coordinates?.[0]
      const end = hitAttrs.coordinates?.[1]
      const hitSlop = Number(hitAttrs.hitSlop)
      if (!isScreenPoint(point) || !isScreenPoint(start) || !isScreenPoint(end)) return false
      return distanceToSegment(point, start, end) <= (Number.isFinite(hitSlop) ? hitSlop : 8)
    },
    draw: () => undefined,
  })
}

export function ensureTrendLineStatsBoxFigure() {
  ensureTwoPointStatsBoxFigure()
}

export function ensureRulerCenterTextFigure() {
  if (rulerCenterTextFigureRegistered) return
  rulerCenterTextFigureRegistered = true
  registerFigure({
    name: rulerCenterTextFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: {
      center: ScreenPoint
      textStyle?: DrawingTextStyle
    }) => {
      const metrics = resolveDrawingTextBoxMetrics({
        measure: measureCanvasText,
        rowsMode: { trimEnd: true },
        textStyle: attrs.textStyle,
      })
      if (!metrics) return
      const totalHeight = metrics.rows.length * metrics.lineHeight
      ctx.save()
      drawDrawingTextBoxRows(ctx, {
        color: metrics.text.textColor,
        font: metrics.font,
        lineHeight: metrics.lineHeight,
        rows: metrics.rows,
        textAlign: 'center',
        textBaseline: 'top',
        x: attrs.center.x,
        y: attrs.center.y - totalHeight / 2 + rulerCenterTextOffsetY,
      })
      ctx.restore()
    },
  })
}

export function ensureHorizontalLineTextFigure() {
  if (horizontalLineTextFigureRegistered) return
  horizontalLineTextFigureRegistered = true
  registerFigure({
    name: horizontalLineTextFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: {
      left: number
      right: number
      textStyle?: DrawingTextStyle
      y: number
    }) => {
      const layout = resolveHorizontalLineTextLayout(
        attrs.textStyle,
        attrs.y,
        attrs.left,
        attrs.right,
        measureCanvasText,
      )
      if (!layout) return
      ctx.save()
      const offsetStart = layout.rows.length > 1 ? -((layout.rows.length - 1) * layout.lineHeight) / 2 : 0
      drawDrawingTextBoxRows(ctx, {
        color: layout.textColor,
        font: layout.font,
        lineHeight: layout.lineHeight,
        rows: layout.rows,
        textAlign: layout.alignH,
        textBaseline: layout.alignV === 'top' ? 'bottom' : layout.alignV === 'bottom' ? 'top' : 'middle',
        x: layout.x,
        y: layout.y + (layout.alignV === 'middle' ? offsetStart : 0),
      })
      ctx.restore()
    },
  })
}

export function ensureTrendLineTextFigure() {
  if (trendLineTextFigureRegistered) return
  trendLineTextFigureRegistered = true
  registerFigure({
    name: trendLineTextFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: {
      end: ScreenPoint
      start: ScreenPoint
      textStyle?: DrawingTextStyle
    }) => {
      const layout = resolveTrendTextLayout(attrs.textStyle, attrs.start, attrs.end, measureCanvasText)
      if (!layout) return
      ctx.save()
      ctx.translate(layout.anchor.x, layout.anchor.y)
      ctx.rotate(layout.angle)
      ctx.shadowColor = 'rgba(255, 255, 255, 0.92)'
      ctx.shadowBlur = 2
      drawDrawingTextBoxRows(ctx, {
        color: layout.text.textColor,
        font: layout.font,
        lineHeight: layout.lineHeight,
        rows: layout.lines,
        textAlign: layout.canvasAlign,
        textBaseline: 'top',
        x: 0,
        y: layout.offsetY,
      })
      ctx.restore()
    },
  })
}
