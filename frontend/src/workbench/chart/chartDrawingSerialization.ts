import { normalizeDrawingLineStyle, normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { StoredHorizontalLineDrawing, StoredRulerDrawing, StoredTrendLineDrawing } from '../rightDrawer/drawingObjectPersistence'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { HorizontalLineExtendData, RulerExtendData, TrendLineExtendData } from './chartDrawingTypes'

type DrawingOverlayLike = {
  extendData?: unknown
  paneId?: string
  points: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
}

export function storedHorizontalLineFromOverlay(overlay: DrawingOverlayLike, ensureObjectId: () => string, fallbackPaneId: string): StoredHorizontalLineDrawing | null {
  const value = Number(overlay.points[0]?.value)
  if (!Number.isFinite(value)) return null
  const extendData = overlay.extendData as HorizontalLineExtendData | undefined
  return {
    lineStyle: normalizeDrawingLineStyle(extendData?.lineStyle, '#0f766e'),
    locked: extendData?.locked === true,
    manualVisible: extendData?.manualVisible !== false,
    objectId: extendData?.objectId || ensureObjectId(),
    paneId: overlay.paneId || fallbackPaneId,
    showPriceLabel: extendData?.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
    value,
  }
}

export function storedTrendLineFromOverlay(overlay: DrawingOverlayLike, ensureObjectId: () => string, fallbackPaneId: string): StoredTrendLineDrawing | null {
  if (overlay.points.length < 2) return null
  const points = overlay.points.slice(0, 2).map(normalizeStoredTrendLinePoint)
  if (points.length < 2 || points.some((point) => typeof point.value !== 'number')) return null
  const extendData = overlay.extendData as TrendLineExtendData | undefined
  return {
    lineStyle: normalizeDrawingLineStyle(extendData?.lineStyle, '#0f766e'),
    locked: extendData?.locked === true,
    manualVisible: extendData?.manualVisible !== false,
    objectId: extendData?.objectId || ensureObjectId(),
    paneId: overlay.paneId || fallbackPaneId,
    points,
    showPriceLabel: extendData?.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
    trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
  }
}

export function storedRulerFromOverlay(overlay: DrawingOverlayLike, ensureObjectId: () => string, fallbackPaneId: string): StoredRulerDrawing | null {
  if (overlay.points.length < 2) return null
  const points = overlay.points.slice(0, 2).map(normalizeStoredTrendLinePoint)
  if (points.length < 2 || points.some((point) => typeof point.value !== 'number')) return null
  const extendData = overlay.extendData as RulerExtendData | undefined
  return {
    lineStyle: normalizeDrawingLineStyle(extendData?.lineStyle, '#2962ff'),
    locked: extendData?.locked === true,
    manualVisible: extendData?.manualVisible !== false,
    objectId: extendData?.objectId || ensureObjectId(),
    paneId: overlay.paneId || fallbackPaneId,
    points,
    rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
    showPriceLabel: extendData?.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
  }
}

function normalizeStoredTrendLinePoint(point: { dataIndex?: number; timestamp?: number; value?: number }) {
  const dataIndex = Number(point?.dataIndex)
  const timestamp = Number(point?.timestamp)
  const value = Number(point?.value)
  return {
    ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
    ...(Number.isFinite(value) ? { value } : {}),
  }
}
