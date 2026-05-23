import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { distanceToSegment } from './chartDrawingGeometry'
import { isCoordinate } from './chartDrawingTypes'
import type { HorizontalLineExtendData, TrendLineExtendData } from './chartDrawingTypes'
import { horizontalLineHitSlop } from './horizontalLineOverlayFigures'

type DrawingVisibilityState = {
  manualVisible: boolean
  periodVisible: boolean
  visible: boolean
}

export type OverlayPoint = {
  dataIndex?: number
  timestamp?: number
  value?: number
}

export type ScreenPoint = {
  x: number
  y: number
}

export function createChartDrawingHitTester({
  chart,
  fallbackPaneId,
  getPendingTrendLineOverlayId,
  horizontalLineOverlayIds,
  resolveHorizontalLineVisibility,
  resolveTrendLineVisibility,
  trendLineOverlayIds,
}: {
  chart: Chart
  fallbackPaneId: string
  getPendingTrendLineOverlayId: () => string | null
  horizontalLineOverlayIds: Set<string>
  resolveHorizontalLineVisibility: (extendData: HorizontalLineExtendData | undefined) => DrawingVisibilityState
  resolveTrendLineVisibility: (extendData: TrendLineExtendData | undefined) => DrawingVisibilityState
  trendLineOverlayIds: Set<string>
}) {
  const resolveOverlayPointPixel = (point: OverlayPoint, paneId: string): ScreenPoint | null => {
    const value = Number(point?.value)
    if (!Number.isFinite(value)) return null
    const dataIndex = Number(point?.dataIndex)
    const timestamp = Number(point?.timestamp)
    const pixel = chart.convertToPixel({
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      value,
    }, { paneId })
    const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
    const x = Number(coordinate?.x)
    const y = Number(coordinate?.y)
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
  }

  const eventHitsHorizontalLine = (event: MouseEvent, paneId: string, hitSlop = horizontalLineHitSlop) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventY = event.clientY - rect.top
    if (!Number.isFinite(eventY)) return false
    for (const id of horizontalLineOverlayIds) {
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || fallbackPaneId) !== paneId) continue
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (!resolveHorizontalLineVisibility(extendData).visible) continue
      const value = Number(overlay?.points[0]?.value)
      if (!Number.isFinite(value)) continue
      const pixel = chart.convertToPixel({ value }, { paneId })
      const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
      const y = Number(coordinate?.y)
      if (Number.isFinite(y) && Math.abs(eventY - y) <= hitSlop) return true
    }
    return false
  }

  const eventHitsTrendLine = (event: MouseEvent, paneId: string, hitSlop = horizontalLineHitSlop) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (!Number.isFinite(eventPoint.x) || !Number.isFinite(eventPoint.y)) return false
    for (const id of trendLineOverlayIds) {
      if (id === getPendingTrendLineOverlayId()) continue
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || fallbackPaneId) !== paneId) continue
      if (!resolveTrendLineVisibility(overlay.extendData as TrendLineExtendData | undefined).visible) continue
      const start = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
      const end = resolveOverlayPointPixel(overlay.points[1] ?? {}, paneId)
      if (!start || !end) continue
      if (distanceToSegment(eventPoint, start, end) <= hitSlop) return true
    }
    return false
  }

  return {
    eventHitsHorizontalLine,
    eventHitsTrendLine,
    resolveOverlayPointPixel,
  }
}
