import { LineType, PolygonType } from 'klinecharts'
import type { DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { HorizontalLineFigure, ScreenPoint } from './chartDrawingTypes'

export const trendHandleColor = '#2962ff'
export const trendHandleLineWidth = 2
export const trendMiddleHandleRadius = 3
export const trendMiddleHandleLineWidth = 1

const trendHandleRadius = 5.5
const trendLockedHandleRadius = 3
const trendLockedHandleLineWidth = 1

export function resolveTrendLineEndpoints(start: ScreenPoint, end: ScreenPoint, bounding: { height: number; width: number }, extendMode: DrawingTrendLineStyle['extendMode']) {
  if (extendMode === 'none') return { end, start }
  return {
    end: extendMode === 'right' || extendMode === 'both'
      ? resolveTrendLineBoundsEndpoint(start, end, bounding, false)
      : end,
    start: extendMode === 'left' || extendMode === 'both'
      ? resolveTrendLineBoundsEndpoint(end, start, bounding, false)
      : start,
  }
}

export function createTrendArrowFigures(tip: ScreenPoint, from: ScreenPoint, color: string, size: number): HorizontalLineFigure[] {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const length = 8
  const spread = 40 * Math.PI / 180
  const left = {
    x: tip.x - Math.cos(angle - spread) * length,
    y: tip.y - Math.sin(angle - spread) * length,
  }
  const right = {
    x: tip.x - Math.cos(angle + spread) * length,
    y: tip.y - Math.sin(angle + spread) * length,
  }
  return [{
    type: 'line',
    attrs: { coordinates: [left, tip, right] },
    styles: {
      color,
      dashedValue: [],
      size,
      style: LineType.Solid,
    },
  }]
}

export function createTrendHandleFigure(point: ScreenPoint, locked: boolean, selected: boolean, color = trendHandleColor, key?: string): HorizontalLineFigure {
  const borderSize = locked
    ? trendLockedHandleLineWidth
    : selected
      ? trendHandleLineWidth
      : 1
  const outerRadius = trendHandleRadius + trendHandleLineWidth / 2
  const radius = locked
    ? trendLockedHandleRadius
    : outerRadius - borderSize / 2
  return {
    ...(key ? { key } : {}),
    type: 'circle',
    attrs: {
      r: radius,
      x: point.x,
      y: point.y,
    },
    styles: {
      borderColor: color,
      borderSize,
      color: '#ffffff',
      style: PolygonType.StrokeFill,
    },
  }
}

function resolveTrendLineBoundsEndpoint(origin: ScreenPoint, through: ScreenPoint, bounding: { height: number; width: number }, reverse: boolean): ScreenPoint {
  const dx = through.x - origin.x
  const dy = through.y - origin.y
  const candidates: Array<{ point: ScreenPoint; t: number }> = []
  const pushCandidate = (t: number) => {
    if (!Number.isFinite(t)) return
    const x = origin.x + dx * t
    const y = origin.y + dy * t
    if (x >= 0 && x <= bounding.width && y >= 0 && y <= bounding.height) candidates.push({ point: { x, y }, t })
  }
  if (dx !== 0) {
    pushCandidate((0 - origin.x) / dx)
    pushCandidate((bounding.width - origin.x) / dx)
  }
  if (dy !== 0) {
    pushCandidate((0 - origin.y) / dy)
    pushCandidate((bounding.height - origin.y) / dy)
  }
  const directional = candidates
    .filter(({ t }) => reverse ? t <= 0 : t >= 0)
    .sort((a, b) => reverse ? a.t - b.t : b.t - a.t)
  return directional[0]?.point ?? origin
}
