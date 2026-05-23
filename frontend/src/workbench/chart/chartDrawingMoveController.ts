import type { Chart } from 'klinecharts'
import type {
  HorizontalLineExtendData,
  HorizontalLineMoveEntry,
  MixedDrawingMoveState,
  ScreenPoint,
  TrendLineExtendData,
  TrendLineMoveEntry,
} from './chartDrawingTypes'
import { isCoordinate } from './chartDrawingTypes'

export type PressedHorizontalLineMoveState = {
  activeId: string
  activeStartValue: number
  entries: HorizontalLineMoveEntry[]
  paneId: string
}

export type ChartDrawingMoveController = ReturnType<typeof createChartDrawingMoveController>

export function createChartDrawingMoveController({
  chart,
  fallbackPaneId,
  getMixedMoveState,
  getPressedMoveState,
  getSelectedHorizontalLineIds,
  getSelectedTrendLineIds,
  markActiveHorizontalLine,
  resolveOverlayPointPixel,
  setMixedMoveState,
  setPressedMoveState,
  setSelectedHorizontalLine,
}: {
  chart: Chart
  fallbackPaneId: string
  getMixedMoveState: () => MixedDrawingMoveState | null
  getPressedMoveState: () => PressedHorizontalLineMoveState | null
  getSelectedHorizontalLineIds: () => string[]
  getSelectedTrendLineIds: () => string[]
  markActiveHorizontalLine: (id: string) => void
  resolveOverlayPointPixel: (point: { dataIndex?: number; timestamp?: number; value?: number }, paneId: string) => ScreenPoint | null
  setMixedMoveState: (state: MixedDrawingMoveState | null) => void
  setPressedMoveState: (state: PressedHorizontalLineMoveState | null) => void
  setSelectedHorizontalLine: (id: string, additive: boolean) => void
}) {
  const resolvePointValueFromMoveEvent = (event: { x?: number; y?: number }, paneId: string) => {
    const y = Number(event.y)
    if (!Number.isFinite(y)) return Number.NaN
    const point = chart.convertFromPixel([{ y }], { paneId })
    const coordinate = Array.isArray(point) ? point[0] : point
    const value = Number(coordinate?.value)
    return Number.isFinite(value) ? value : Number.NaN
  }

  const resolvePointFromPixel = (pixel: ScreenPoint, paneId: string) => {
    const point = chart.convertFromPixel([pixel], { paneId })
    const coordinate = Array.isArray(point) ? point[0] : point
    const dataIndex = Number(coordinate?.dataIndex)
    const timestamp = Number(coordinate?.timestamp)
    const value = Number(coordinate?.value)
    return {
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      ...(Number.isFinite(value) ? { value } : {}),
    }
  }

  const beginMixedDrawingMove = (activeId: string, paneId: string, event: { x?: number; y?: number }) => {
    const startX = Number(event.x)
    const startY = Number(event.y)
    if (!Number.isFinite(startX) || !Number.isFinite(startY)) {
      setMixedMoveState(null)
      return
    }
    const horizontalEntries = getSelectedHorizontalLineIds()
      .map((id) => {
        const overlay = chart.getOverlayById(id)
        const extendData = overlay?.extendData as HorizontalLineExtendData | undefined
        const value = Number(overlay?.points[0]?.value)
        if (!overlay || (overlay.paneId || fallbackPaneId) !== paneId || extendData?.locked === true || overlay.lock === true || !Number.isFinite(value)) return null
        const pixel = chart.convertToPixel({ value }, { paneId })
        const y = Number(isCoordinate(pixel) ? pixel.y : undefined)
        return Number.isFinite(y) ? { id, startValue: value, startY: y } : null
      })
      .filter((entry): entry is HorizontalLineMoveEntry & { startY: number } => entry != null)
    const trendEntries = getSelectedTrendLineIds()
      .map((id) => {
        const overlay = chart.getOverlayById(id)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay || (overlay.paneId || fallbackPaneId) !== paneId || extendData?.locked === true || overlay.lock === true) return null
        const points = overlay.points.slice(0, 2)
          .map((point) => {
            const pixel = resolveOverlayPointPixel(point, paneId)
            return pixel ? { point: { ...point }, pixel } : null
          })
          .filter((point): point is TrendLineMoveEntry['points'][number] => point != null)
        return points.length >= 2 ? { id, points } : null
      })
      .filter((entry): entry is TrendLineMoveEntry => entry != null)
    const entryCount = horizontalEntries.length + trendEntries.length
    setMixedMoveState(entryCount > 1 ? { activeId, horizontalEntries, paneId, startX, startY, trendEntries } : null)
  }

  const moveMixedDrawings = (event: { x?: number; y?: number }, activeId: string) => {
    const moveState = getMixedMoveState()
    if (!moveState || moveState.activeId !== activeId) return false
    const x = Number(event.x)
    const y = Number(event.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false
    const dx = x - moveState.startX
    const dy = y - moveState.startY
    moveState.horizontalEntries.forEach((entry) => {
      const overlay = chart.getOverlayById(entry.id)
      if (!overlay) return
      const coordinate = chart.convertFromPixel([{ y: entry.startY + dy }], { paneId: moveState.paneId })
      const value = Number((Array.isArray(coordinate) ? coordinate[0] : coordinate)?.value)
      if (!Number.isFinite(value)) return
      chart.overrideOverlay({
        id: entry.id,
        points: [{ ...(overlay.points[0] ?? {}), value }],
      })
    })
    moveState.trendEntries.forEach((entry) => {
      const overlay = chart.getOverlayById(entry.id)
      if (!overlay) return
      chart.overrideOverlay({
        id: entry.id,
        points: entry.points.map((point) => ({
          ...point.point,
          ...resolvePointFromPixel({ x: point.pixel.x + dx, y: point.pixel.y + dy }, moveState.paneId),
        })),
      })
    })
    return true
  }

  const beginPressedMove = (overlayId: string, event: { x?: number; y?: number }) => {
    const overlay = chart.getOverlayById(overlayId)
    if (!overlay) {
      setPressedMoveState(null)
      setMixedMoveState(null)
      return
    }
    const paneId = overlay.paneId || fallbackPaneId
    const selectedIds = getSelectedHorizontalLineIds()
    const selectedTrendIds = getSelectedTrendLineIds()
    const activeIsAlreadySelected = selectedIds.includes(overlayId)
    if (activeIsAlreadySelected && selectedIds.length + selectedTrendIds.length > 1) {
      markActiveHorizontalLine(overlayId)
    } else {
      setSelectedHorizontalLine(overlayId, false)
    }

    const moveIds = getSelectedHorizontalLineIds()
    const entries = moveIds
      .map((id) => {
        const selectedOverlay = chart.getOverlayById(id)
        const extendData = selectedOverlay?.extendData as HorizontalLineExtendData | undefined
        if (!selectedOverlay || (selectedOverlay.paneId || fallbackPaneId) !== paneId || extendData?.locked === true || selectedOverlay.lock === true) return null
        const startValue = Number(selectedOverlay.points[0]?.value)
        return Number.isFinite(startValue) ? { id, startValue } : null
      })
      .filter((entry): entry is HorizontalLineMoveEntry => entry != null)
    const activeEntry = entries.find((entry) => entry.id === overlayId)
    setPressedMoveState(activeEntry ? { activeId: overlayId, activeStartValue: activeEntry.startValue, entries, paneId } : null)
    beginMixedDrawingMove(overlayId, paneId, event)
  }

  const moveSelectedHorizontalLines = (event: { x?: number; y?: number }, overlayId: string) => {
    const moveState = getPressedMoveState()
    if (!moveState || moveState.activeId !== overlayId || moveState.entries.length <= 1) return false
    const value = resolvePointValueFromMoveEvent(event, moveState.paneId)
    if (!Number.isFinite(value)) return false
    const delta = value - moveState.activeStartValue
    moveState.entries.forEach((entry) => {
      const overlay = chart.getOverlayById(entry.id)
      if (!overlay) return
      chart.overrideOverlay({
        id: entry.id,
        points: [{ ...(overlay.points[0] ?? {}), value: entry.startValue + delta }],
      })
    })
    return true
  }

  return {
    beginMixedDrawingMove,
    beginPressedMove,
    moveMixedDrawings,
    moveSelectedHorizontalLines,
  }
}
