import type { Chart } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import {
  readDrawingPersistence,
  readStoredHorizontalLineDrawings,
  readStoredTrendLineDrawings,
  writeStoredHorizontalLineDrawings,
  writeStoredTrendLineDrawings,
} from '../rightDrawer/drawingPersistence'
import type {
  DrawingTextStyle,
  DrawingTrendLineStyle,
  StoredHorizontalLineDrawing,
  StoredTrendLineDrawing,
} from '../rightDrawer/drawingPersistence'
import {
  createHorizontalLineObjectId,
  createTrendLineObjectId,
  syncHorizontalLineObjectIdSeed,
  syncTrendLineObjectIdSeed,
} from './chartDrawingObjectIds'
import { storedHorizontalLineFromOverlay, storedTrendLineFromOverlay } from './chartDrawingSerialization'

export type InitialStoredDrawingState = {
  horizontalLinePersistenceEnabled: boolean
  pendingHorizontalLineDrawings: StoredHorizontalLineDrawing[]
  pendingTrendLineDrawings: StoredTrendLineDrawing[]
  trendLinePersistenceEnabled: boolean
}

export function readInitialStoredDrawingState(): InitialStoredDrawingState {
  const horizontalLinePersistenceEnabled = readDrawingPersistence('horizontalLine')
  const trendLinePersistenceEnabled = readDrawingPersistence('trendLine')
  const pendingHorizontalLineDrawings = horizontalLinePersistenceEnabled ? readStoredHorizontalLineDrawings() : []
  const pendingTrendLineDrawings = trendLinePersistenceEnabled ? readStoredTrendLineDrawings() : []
  syncHorizontalLineObjectIdSeed(pendingHorizontalLineDrawings)
  syncTrendLineObjectIdSeed(pendingTrendLineDrawings)
  return {
    horizontalLinePersistenceEnabled,
    pendingHorizontalLineDrawings,
    pendingTrendLineDrawings,
    trendLinePersistenceEnabled,
  }
}

export function createChartDrawingPersistenceController({
  canCreateOverlayOnPane,
  chart,
  createHorizontalLineOverlay,
  createTrendLineOverlay,
  fallbackPaneId,
  getDestroyed,
  getHorizontalLinePersistenceEnabled,
  getPendingTrendLineOverlayId,
  getTrendLinePersistenceEnabled,
  horizontalLineOverlayIds,
  initialHorizontalLineDrawings,
  initialTrendLineDrawings,
  trendLineOverlayIds,
}: {
  canCreateOverlayOnPane: (paneId: string) => boolean
  chart: Chart
  createHorizontalLineOverlay: (options: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => unknown
  createTrendLineOverlay: (options: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  }) => unknown
  fallbackPaneId: string
  getDestroyed: () => boolean
  getHorizontalLinePersistenceEnabled: () => boolean
  getPendingTrendLineOverlayId: () => string | null
  getTrendLinePersistenceEnabled: () => boolean
  horizontalLineOverlayIds: Set<string>
  initialHorizontalLineDrawings: StoredHorizontalLineDrawing[]
  initialTrendLineDrawings: StoredTrendLineDrawing[]
  trendLineOverlayIds: Set<string>
}) {
  let pendingHorizontalLineDrawings = initialHorizontalLineDrawings
  let pendingTrendLineDrawings = initialTrendLineDrawings

  const persistCurrentHorizontalLines = () => {
    if (getDestroyed()) return
    if (!getHorizontalLinePersistenceEnabled()) return
    const drawings: StoredHorizontalLineDrawing[] = []
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        horizontalLineOverlayIds.delete(id)
        return
      }
      const drawing = storedHorizontalLineFromOverlay(overlay, createHorizontalLineObjectId, fallbackPaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredHorizontalLineDrawings(drawings)
  }

  const persistCurrentTrendLines = () => {
    if (getDestroyed()) return
    if (!getTrendLinePersistenceEnabled()) return
    const drawings: StoredTrendLineDrawing[] = []
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      if (overlay.id === getPendingTrendLineOverlayId() || overlay.points.length < 2) return
      const drawing = storedTrendLineFromOverlay(overlay, createTrendLineObjectId, fallbackPaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredTrendLineDrawings(drawings)
  }

  const restorePendingStoredHorizontalLines = () => {
    if (!getHorizontalLinePersistenceEnabled() || pendingHorizontalLineDrawings.length === 0) return
    const remaining: StoredHorizontalLineDrawing[] = []
    pendingHorizontalLineDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || fallbackPaneId
      if (!canCreateOverlayOnPane(paneId)) {
        remaining.push(drawing)
        return
      }
      const overlayId = createHorizontalLineOverlay({
        lineStyle: drawing.lineStyle,
        locked: drawing.locked,
        manualVisible: drawing.manualVisible,
        objectId: drawing.objectId || createHorizontalLineObjectId(),
        paneId,
        points: [{ value: drawing.value }],
        selected: false,
        showPriceLabel: drawing.showPriceLabel,
        textStyle: drawing.textStyle,
      })
      if (typeof overlayId === 'string') horizontalLineOverlayIds.add(overlayId)
    })
    pendingHorizontalLineDrawings = remaining
  }

  const restorePendingStoredTrendLines = () => {
    if (!getTrendLinePersistenceEnabled() || pendingTrendLineDrawings.length === 0) return
    const remaining: StoredTrendLineDrawing[] = []
    pendingTrendLineDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || fallbackPaneId
      if (!canCreateOverlayOnPane(paneId)) {
        remaining.push(drawing)
        return
      }
      const overlayId = createTrendLineOverlay({
        lineStyle: drawing.lineStyle,
        locked: drawing.locked,
        manualVisible: drawing.manualVisible,
        objectId: drawing.objectId || createTrendLineObjectId(),
        paneId,
        points: drawing.points.slice(0, 2),
        selected: false,
        showPriceLabel: drawing.showPriceLabel,
        textStyle: drawing.textStyle,
        trendLineStyle: drawing.trendLineStyle,
      })
      if (typeof overlayId === 'string') trendLineOverlayIds.add(overlayId)
    })
    pendingTrendLineDrawings = remaining
  }

  return {
    persistCurrentHorizontalLines,
    persistCurrentTrendLines,
    restorePendingStoredHorizontalLines,
    restorePendingStoredTrendLines,
  }
}
