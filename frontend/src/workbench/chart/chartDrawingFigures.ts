import { registerFigure } from 'klinecharts'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { ScreenPoint } from './chartDrawingTypes'
import { distanceToSegment, isScreenPoint } from './chartDrawingGeometry'
import { measureCanvasText } from './drawingTextMeasure'
import { resolveHorizontalLineTextLayout } from './horizontalLineTextLayout'
import { resolveTrendTextLayout } from './trendLineTextLayout'

export const horizontalLineTextFigureName = 'ffHorizontalLineText'
export const trendLineHitFigureName = 'ffTrendLineHit'
export const trendLineTextFigureName = 'ffTrendLineText'
export const trendLineStatsBoxFigureName: string = 'ffTrendLineStatsBox'

let horizontalLineTextFigureRegistered = false
let trendLineHitFigureRegistered = false
let trendLineTextFigureRegistered = false
let trendLineStatsBoxFigureRegistered = false

type TrendStatsBoxAttrs = {
  anchor: ScreenPoint
  lineEnd: ScreenPoint
  lineStart: ScreenPoint
  right: number
  rows: string[]
}

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
  if (trendLineStatsBoxFigureRegistered) return
  trendLineStatsBoxFigureRegistered = true
  registerFigure({
    name: trendLineStatsBoxFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: TrendStatsBoxAttrs) => {
      if (!Array.isArray(attrs.rows) || attrs.rows.length === 0) return
      ctx.save()
      ctx.font = '12px Arial, Tahoma, sans-serif'
      const lineHeight = 20
      const padX = 12
      const padY = 8
      const width = Math.ceil(attrs.rows.reduce((max, row) => Math.max(max, Number(ctx.measureText(row).width) || row.length * 7), 0) + padX * 2)
      const height = attrs.rows.length * lineHeight + padY * 2
      const box = resolveTrendStatsBoxPosition(attrs, width, height)
      ctx.fillStyle = 'rgba(242, 242, 242, 0.94)'
      roundedRectPath(ctx, box.x, box.y, width, height, 4)
      ctx.fill()
      ctx.fillStyle = '#111827'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      attrs.rows.forEach((row, index) => {
        ctx.fillText(row, box.x + padX, box.y + padY + lineHeight * index + lineHeight / 2)
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
      ctx.font = layout.font
      ctx.fillStyle = layout.textColor
      ctx.textAlign = layout.alignH
      ctx.textBaseline = layout.alignV === 'top' ? 'bottom' : layout.alignV === 'bottom' ? 'top' : 'middle'
      const offsetStart = layout.rows.length > 1 ? -((layout.rows.length - 1) * layout.lineHeight) / 2 : 0
      layout.rows.forEach((row, index) => {
        ctx.fillText(row, layout.x, layout.y + (layout.alignV === 'middle' ? offsetStart + index * layout.lineHeight : index * layout.lineHeight))
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
      ctx.font = layout.font
      ctx.textAlign = layout.canvasAlign
      ctx.textBaseline = 'top'
      ctx.fillStyle = layout.text.textColor
      ctx.shadowColor = 'rgba(255, 255, 255, 0.92)'
      ctx.shadowBlur = 2
      layout.lines.forEach((row, index) => {
        ctx.fillText(row, 0, layout.offsetY + index * layout.lineHeight)
      })
      ctx.restore()
    },
  })
}

export function resolveTrendStatsAnchorPoint(style: DrawingTrendLineStyle, start: ScreenPoint, end: ScreenPoint): ScreenPoint {
  if (style.statsPosition === 'left') return start
  if (style.statsPosition === 'right') return end
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  }
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
}

function rectIntersectsLine(rect: { height: number; width: number; x: number; y: number }, start: ScreenPoint, end: ScreenPoint) {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxY = Math.max(start.y, end.y)
  if (maxX < rect.x || minX > rect.x + rect.width || maxY < rect.y || minY > rect.y + rect.height) return false
  const inside = (point: ScreenPoint) => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
  if (inside(start) || inside(end)) return true
  const ccw = (p: ScreenPoint, q: ScreenPoint, r: ScreenPoint) => (r.y - p.y) * (q.x - p.x) > (q.y - p.y) * (r.x - p.x)
  const intersects = (p: ScreenPoint, q: ScreenPoint, r: ScreenPoint, s: ScreenPoint) => ccw(p, r, s) !== ccw(q, r, s) && ccw(p, q, r) !== ccw(p, q, s)
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ]
  return corners.some((corner, index) => intersects(start, end, corner, corners[(index + 1) % corners.length]))
}

function resolveTrendStatsBoxPosition(attrs: TrendStatsBoxAttrs, width: number, height: number) {
  const rightLimit = Number.isFinite(attrs.right) && attrs.right > 0 ? attrs.right : attrs.anchor.x + width + 4
  const clampX = (x: number) => Math.max(0, Math.min(x, rightLimit - width - 4))
  const candidates = [
    { x: attrs.anchor.x + 10, y: attrs.anchor.y + 6 },
    { x: attrs.anchor.x + 10, y: attrs.anchor.y - height - 6 },
    { x: attrs.anchor.x - width - 10, y: attrs.anchor.y + 6 },
    { x: attrs.anchor.x - width - 10, y: attrs.anchor.y - height - 6 },
  ].map((row) => ({ x: clampX(row.x), y: Math.max(0, row.y), width, height }))
  return candidates.find((rect) => !rectIntersectsLine(rect, attrs.lineStart, attrs.lineEnd)) ?? candidates[0]
}
