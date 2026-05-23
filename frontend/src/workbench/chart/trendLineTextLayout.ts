import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { normalizeDrawingTextBoxStyle, resolveDrawingTextBoxMetrics } from './drawingTextBoxCore'

export type ScreenPointLike = { x: number; y: number }

const trendTextTopLineGap = -1
const trendTextBottomLineGap = 4
const trendTextLineBreakGap = 3
const trendTextMiddleVisualBias = 2
const trendTextEndpointInset = 13
const trendTextVerticalNudge = 1

function normalizeTrendLineTextStyle(textStyle: DrawingTextStyle | undefined): DrawingTextStyle {
  const normalized = normalizeDrawingTextBoxStyle(textStyle)
  return textStyle?.alignH === 'left' || textStyle?.alignH === 'center' || textStyle?.alignH === 'right'
    ? normalized
    : { ...normalized, alignH: 'center' }
}

function resolveReadableTrendTextAngle(start: ScreenPointLike, end: ScreenPointLike) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9)) return 0
  let angle = Math.atan2(dy, dx)
  if (angle > Math.PI / 2) angle -= Math.PI
  else if (angle < -Math.PI / 2) angle += Math.PI
  return angle
}

function resolveTrendTextAnchor(text: DrawingTextStyle, start: ScreenPointLike, end: ScreenPointLike) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  const insetX = Number.isFinite(length) && length > 0 ? (dx / length) * trendTextEndpointInset : 0
  const insetY = Number.isFinite(length) && length > 0 ? (dy / length) * trendTextEndpointInset : 0
  if (text.alignH === 'left') return { x: start.x + insetX, y: start.y + insetY }
  if (text.alignH === 'right') return { x: end.x - insetX, y: end.y - insetY }
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
}

function resolveTrendTextCanvasAlign(text: DrawingTextStyle, start: ScreenPointLike, end: ScreenPointLike, angle: number): CanvasTextAlign {
  if (text.alignH === 'center') return 'center'
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const insideVector = text.alignH === 'left'
    ? { x: end.x - start.x, y: end.y - start.y }
    : { x: start.x - end.x, y: start.y - end.y }
  const localX = insideVector.x * ux + insideVector.y * uy
  return localX >= 0 ? 'left' : 'right'
}

export function resolveTrendTextLayout(textStyle: DrawingTextStyle | undefined, start: ScreenPointLike, end: ScreenPointLike, measure: (value: string, font: string) => number) {
  const text = normalizeTrendLineTextStyle(textStyle)
  const metrics = resolveDrawingTextBoxMetrics({
    measure,
    rowsMode: { dropBlank: true, trimEnd: true },
    textStyle: text,
  })
  if (!metrics) return null
  const totalHeight = metrics.rows.length * metrics.lineHeight
  const offsetY = text.alignV === 'bottom'
    ? trendTextBottomLineGap
    : text.alignV === 'middle'
      ? -totalHeight / 2 + trendTextMiddleVisualBias
      : -totalHeight - trendTextTopLineGap
  const angle = resolveReadableTrendTextAngle(start, end)
  return {
    anchor: resolveTrendTextAnchor(text, start, end),
    angle,
    canvasAlign: resolveTrendTextCanvasAlign(text, start, end, angle),
    font: metrics.font,
    lineHeight: metrics.lineHeight,
    lines: metrics.rows,
    offsetY: offsetY + trendTextVerticalNudge,
    text,
    width: metrics.width,
  }
}

function rotateTrendTextLocalPoint(anchor: ScreenPointLike, angle: number, x: number, y = 0): ScreenPointLike {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: anchor.x + x * cos - y * sin,
    y: anchor.y + x * sin + y * cos,
  }
}

export function resolveTrendTextLineExclusion(layout: ReturnType<typeof resolveTrendTextLayout>) {
  if (!layout || !Number.isFinite(layout.width) || layout.width <= 0) return null
  if (layout.text.alignV !== 'middle') return null
  const halfWidth = layout.width / 2
  const start = layout.text.alignH === 'left'
    ? -trendTextLineBreakGap
    : layout.text.alignH === 'right'
      ? -layout.width - trendTextLineBreakGap
      : -halfWidth - trendTextLineBreakGap
  const end = layout.text.alignH === 'left'
    ? layout.width + trendTextLineBreakGap
    : layout.text.alignH === 'right'
      ? trendTextLineBreakGap
      : halfWidth + trendTextLineBreakGap
  return {
    from: rotateTrendTextLocalPoint(layout.anchor, layout.angle, start),
    to: rotateTrendTextLocalPoint(layout.anchor, layout.angle, end),
  }
}

export function splitTrendLineSegments(start: ScreenPointLike, end: ScreenPointLike, exclusions: Array<{ from: ScreenPointLike; to: ScreenPointLike }>) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 0) return []
  const ranges = exclusions
    .map((exclusion) => {
      const from = ((exclusion.from.x - start.x) * dx + (exclusion.from.y - start.y) * dy) / lengthSq
      const to = ((exclusion.to.x - start.x) * dx + (exclusion.to.y - start.y) * dy) / lengthSq
      return { from: Math.max(0, Math.min(from, to)), to: Math.min(1, Math.max(from, to)) }
    })
    .filter((range) => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > 0 && range.from < 1)
    .sort((a, b) => a.from - b.from)
  const segments: Array<{ end: ScreenPointLike; start: ScreenPointLike }> = []
  let cursor = 0
  const pointAt = (t: number) => ({ x: start.x + dx * t, y: start.y + dy * t })
  ranges.forEach((range) => {
    const from = Math.max(cursor, range.from)
    if (from > cursor) segments.push({ start: pointAt(cursor), end: pointAt(from) })
    cursor = Math.max(cursor, range.to)
  })
  if (cursor < 1) segments.push({ start: pointAt(cursor), end: pointAt(1) })
  return segments
}
