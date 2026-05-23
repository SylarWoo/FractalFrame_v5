import type { Chart } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import {
  readDrawingObjectPersistence,
  readStoredHorizontalLineDrawings,
  readStoredRulerDrawings,
  readStoredTrendLineDrawings,
  writeStoredHorizontalLineDrawings,
  writeStoredRulerDrawings,
  writeStoredTrendLineDrawings,
} from '../rightDrawer/drawingObjectPersistence'
import type {
  StoredHorizontalLineDrawing,
  StoredRulerDrawing,
  StoredTrendLineDrawing,
} from '../rightDrawer/drawingObjectPersistence'
import type {
  DrawingTextStyle,
  DrawingTrendLineStyle,
} from '../rightDrawer/drawingPersistence'
import type { DrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import {
  createHorizontalLineObjectId,
  createRulerObjectId,
  createTrendLineObjectId,
  syncHorizontalLineObjectIdSeed,
  syncRulerObjectIdSeed,
  syncTrendLineObjectIdSeed,
} from './chartDrawingObjectIds'
import { storedHorizontalLineFromOverlay, storedRulerFromOverlay, storedTrendLineFromOverlay } from './chartDrawingSerialization'

export type InitialStoredDrawingState = {
  horizontalLinePersistenceEnabled: boolean
  pendingHorizontalLineDrawings: StoredHorizontalLineDrawing[]
  pendingRulerDrawings: StoredRulerDrawing[]
  pendingTrendLineDrawings: StoredTrendLineDrawing[]
  rulerPersistenceEnabled: boolean
  trendLinePersistenceEnabled: boolean
}

export function readInitialStoredDrawingState(): InitialStoredDrawingState {
  const horizontalLinePersistenceEnabled = readDrawingObjectPersistence('horizontalLine')
  const rulerPersistenceEnabled = readDrawingObjectPersistence('ruler')
  const trendLinePersistenceEnabled = readDrawingObjectPersistence('trendLine')
  const pendingHorizontalLineDrawings = horizontalLinePersistenceEnabled ? readStoredHorizontalLineDrawings() : []
  const pendingRulerDrawings = rulerPersistenceEnabled ? readStoredRulerDrawings() : []
  const pendingTrendLineDrawings = trendLinePersistenceEnabled ? readStoredTrendLineDrawings() : []
  syncHorizontalLineObjectIdSeed(pendingHorizontalLineDrawings)
  syncRulerObjectIdSeed(pendingRulerDrawings)
  syncTrendLineObjectIdSeed(pendingTrendLineDrawings)
  return {
    horizontalLinePersistenceEnabled,
    pendingHorizontalLineDrawings,
    pendingRulerDrawings,
    pendingTrendLineDrawings,
    rulerPersistenceEnabled,
    trendLinePersistenceEnabled,
  }
}

export function createChartDrawingPersistenceController({
  canCreateOverlayOnPane,
  chart,
  createHorizontalLineOverlay,
  createRulerOverlay,
  createTrendLineOverlay,
  fallbackPaneId,
  getDestroyed,
  getHorizontalLinePersistenceEnabled,
  getPendingRulerOverlayId,
  getPendingTrendLineOverlayId,
  getRulerPersistenceEnabled,
  getTrendLinePersistenceEnabled,
  horizontalLineOverlayIds,
  initialHorizontalLineDrawings,
  initialRulerDrawings,
  initialTrendLineDrawings,
  rulerOverlayIds,
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
  createRulerOverlay: (options: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    rulerStyle: DrawingRulerStyle
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => unknown
  fallbackPaneId: string
  getDestroyed: () => boolean
  getHorizontalLinePersistenceEnabled: () => boolean
  getPendingRulerOverlayId: () => string | null
  getPendingTrendLineOverlayId: () => string | null
  getRulerPersistenceEnabled: () => boolean
  getTrendLinePersistenceEnabled: () => boolean
  horizontalLineOverlayIds: Set<string>
  initialHorizontalLineDrawings: StoredHorizontalLineDrawing[]
  initialRulerDrawings: StoredRulerDrawing[]
  initialTrendLineDrawings: StoredTrendLineDrawing[]
  rulerOverlayIds: Set<string>
  trendLineOverlayIds: Set<string>
}) {
  let pendingHorizontalLineDrawings = initialHorizontalLineDrawings
  let pendingRulerDrawings = initialRulerDrawings
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

  const persistCurrentRulers = () => {
    if (getDestroyed()) return
    if (!getRulerPersistenceEnabled()) return
    const drawings: StoredRulerDrawing[] = []
    rulerOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        rulerOverlayIds.delete(id)
        return
      }
      if (overlay.id === getPendingRulerOverlayId() || overlay.points.length < 2) return
      const drawing = storedRulerFromOverlay(overlay, createRulerObjectId, fallbackPaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredRulerDrawings(drawings)
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

  const restorePendingStoredRulers = () => {
    if (!getRulerPersistenceEnabled() || pendingRulerDrawings.length === 0) return
    const remaining: StoredRulerDrawing[] = []
    pendingRulerDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || fallbackPaneId
      if (!canCreateOverlayOnPane(paneId)) {
        remaining.push(drawing)
        return
      }
      const overlayId = createRulerOverlay({
        lineStyle: drawing.lineStyle,
        locked: drawing.locked,
        manualVisible: drawing.manualVisible,
        objectId: drawing.objectId || createRulerObjectId(),
        paneId,
        points: drawing.points.slice(0, 2),
        rulerStyle: drawing.rulerStyle,
        selected: false,
        showPriceLabel: drawing.showPriceLabel,
        textStyle: drawing.textStyle,
      })
      if (typeof overlayId === 'string') rulerOverlayIds.add(overlayId)
    })
    pendingRulerDrawings = remaining
  }

  return {
    persistCurrentHorizontalLines,
    persistCurrentRulers,
    persistCurrentTrendLines,
    restorePendingStoredHorizontalLines,
    restorePendingStoredRulers,
    restorePendingStoredTrendLines,
  }
}
