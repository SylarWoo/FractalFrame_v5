import { normalizeDrawingLineStyle, normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { StoredFibRetracementDrawing, StoredHorizontalLineDrawing, StoredRulerDrawing, StoredTrendLineDrawing } from '../rightDrawer/drawingObjectPersistence'
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

export function storedFibRetracementFromOverlay(overlay: DrawingOverlayLike, ensureObjectId: () => string, fallbackPaneId: string): StoredFibRetracementDrawing | null {
  if (overlay.points.length < 2) return null
  const points = overlay.points.slice(0, 2).map(normalizeStoredTrendLinePoint)
  if (points.length < 2 || points.some((point) => typeof point.value !== 'number')) return null
  const extendData = overlay.extendData as RulerExtendData | undefined
  return {
    fibBackgroundOpacity: typeof extendData?.fibBackgroundOpacity === 'number' ? Math.max(0, Math.min(extendData.fibBackgroundOpacity, 1)) : 0.25,
    fibBackgroundVisible: extendData?.fibBackgroundVisible !== false,
    fibHorizontalLineStyle: normalizeDrawingLineStyle(extendData?.fibHorizontalLineStyle, '#787b86'),
    fibLabelAlign: typeof extendData?.fibLabelAlign === 'string' ? extendData.fibLabelAlign : 'center',
    fibLabelFontSize: typeof extendData?.fibLabelFontSize === 'string' ? extendData.fibLabelFontSize : '12',
    fibLabelVAlign: typeof extendData?.fibLabelVAlign === 'string' ? extendData.fibLabelVAlign : 'top',
    fibLevelDisplay: extendData?.fibLevelDisplay === 'percent' ? 'percent' : 'value',
    fibLevelVisible: extendData?.fibLevelVisible !== false,
    fibLevels: Array.isArray(extendData?.fibLevels) ? extendData.fibLevels : [],
    fibPriceVisible: extendData?.fibPriceVisible !== false,
    fibQuarterLineStyles: Array.isArray(extendData?.fibQuarterLineStyles) ? extendData.fibQuarterLineStyles : [],
    fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible === true,
    fibReverse: extendData?.fibReverse === true,
    fibTrendLineStyle: normalizeDrawingLineStyle(extendData?.fibTrendLineStyle, '#b6bac4'),
    fibTrendLineVisible: extendData?.fibTrendLineVisible === true,
    lineStyle: normalizeDrawingLineStyle(extendData?.lineStyle, '#787b86'),
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
