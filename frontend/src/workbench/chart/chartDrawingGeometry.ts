import type { ScreenPoint } from './chartDrawingTypes'

export function isScreenPoint(value: Partial<ScreenPoint> | undefined): value is ScreenPoint {
  return Number.isFinite(value?.x) && Number.isFinite(value?.y)
}

export function distanceToSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq))
  const projected = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  }
  return Math.hypot(point.x - projected.x, point.y - projected.y)
}
