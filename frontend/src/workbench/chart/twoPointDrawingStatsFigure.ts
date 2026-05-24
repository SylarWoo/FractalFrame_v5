import { registerFigure } from 'klinecharts'
import type { ScreenPoint } from './chartDrawingTypes'

export const twoPointStatsBoxFigureName = 'ffTwoPointStatsBox'

let twoPointStatsBoxFigureRegistered = false

type TwoPointStatsBoxAttrs = {
  anchor: ScreenPoint
  backgroundColor?: string
  borderRadius?: number
  font?: string
  lineEnd: ScreenPoint
  lineHeight?: number
  lineStart: ScreenPoint
  padX?: number
  padY?: number
  placement?: 'above' | 'below'
  right: number
  rows: string[]
  shadowBlur?: number
  shadowColor?: string
  shadowOffsetY?: number
  textAlign?: 'center' | 'left'
  textColor?: string
}

export function ensureTwoPointStatsBoxFigure() {
  if (twoPointStatsBoxFigureRegistered) return
  twoPointStatsBoxFigureRegistered = true
  registerFigure({
    name: twoPointStatsBoxFigureName,
    checkEventOn: () => false,
    draw: (ctx, attrs: TwoPointStatsBoxAttrs) => {
      if (!Array.isArray(attrs.rows) || attrs.rows.length === 0) return
      ctx.save()
      ctx.font = attrs.font ?? '12px Arial, Tahoma, sans-serif'
      const lineHeight = attrs.lineHeight ?? 20
      const padX = attrs.padX ?? 12
      const padY = attrs.padY ?? 8
      const width = Math.ceil(attrs.rows.reduce((max, row) => Math.max(max, Number(ctx.measureText(row).width) || row.length * 7), 0) + padX * 2)
      const height = attrs.rows.length * lineHeight + padY * 2
      const box = resolveTwoPointStatsBoxPosition(attrs, width, height)
      ctx.shadowColor = attrs.shadowColor ?? 'transparent'
      ctx.shadowBlur = attrs.shadowBlur ?? 0
      ctx.shadowOffsetY = attrs.shadowOffsetY ?? 0
      ctx.fillStyle = attrs.backgroundColor ?? 'rgba(242, 242, 242, 0.94)'
      roundedRectPath(ctx, box.x, box.y, width, height, attrs.borderRadius ?? 4)
      ctx.fill()
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
      ctx.fillStyle = attrs.textColor ?? '#111827'
      ctx.textAlign = attrs.textAlign ?? 'left'
      ctx.textBaseline = 'middle'
      const textX = attrs.textAlign === 'center' ? box.x + width / 2 : box.x + padX
      attrs.rows.forEach((row, index) => {
        ctx.fillText(row, textX, box.y + padY + lineHeight * index + lineHeight / 2)
      })
      ctx.restore()
    },
  })
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

function resolveTwoPointStatsBoxPosition(attrs: TwoPointStatsBoxAttrs, width: number, height: number) {
  const rightLimit = Number.isFinite(attrs.right) && attrs.right > 0 ? attrs.right : attrs.anchor.x + width + 4
  const clampX = (x: number) => Math.max(0, Math.min(x, rightLimit - width - 4))
  if (attrs.placement === 'above' || attrs.placement === 'below') {
    return {
      height,
      width,
      x: clampX(attrs.anchor.x - width / 2),
      y: Math.max(0, attrs.placement === 'above' ? attrs.anchor.y - height - 8 : attrs.anchor.y + 8),
    }
  }
  const candidates = [
    { x: attrs.anchor.x + 10, y: attrs.anchor.y + 6 },
    { x: attrs.anchor.x + 10, y: attrs.anchor.y - height - 6 },
    { x: attrs.anchor.x - width - 10, y: attrs.anchor.y + 6 },
    { x: attrs.anchor.x - width - 10, y: attrs.anchor.y - height - 6 },
  ].map((row) => ({ x: clampX(row.x), y: Math.max(0, row.y), width, height }))
  return candidates.find((rect) => !rectIntersectsLine(rect, attrs.lineStart, attrs.lineEnd)) ?? candidates[0]
}
