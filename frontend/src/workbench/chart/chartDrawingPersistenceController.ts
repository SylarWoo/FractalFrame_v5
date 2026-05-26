import type { Chart } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import {
  readDrawingObjectPersistence,
  readStoredFibRetracementDrawings,
  readStoredHorizontalLineDrawings,
  readStoredRulerDrawings,
  readStoredTrendLineDrawings,
  writeStoredFibRetracementDrawings,
  writeStoredHorizontalLineDrawings,
  writeStoredRulerDrawings,
  writeStoredTrendLineDrawings,
} from '../rightDrawer/drawingObjectPersistence'
import type {
  StoredFibRetracementDrawing,
  StoredHorizontalLineDrawing,
  StoredRulerDrawing,
  StoredTrendLineDrawing,
} from '../rightDrawer/drawingObjectPersistence'
import { readStoredEmojiStickerDrawings, writeStoredEmojiStickerDrawings } from '../rightDrawer/stickerDrawingPersistence'
import type { StoredEmojiStickerDrawing } from '../rightDrawer/stickerDrawingPersistence'
import type {
  DrawingTextStyle,
  DrawingTrendLineStyle,
} from '../rightDrawer/drawingPersistence'
import type { DrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import {
  createHorizontalLineObjectId,
  createEmojiStickerObjectId,
  createFibRetracementObjectId,
  createRulerObjectId,
  createTrendLineObjectId,
  syncFibRetracementObjectIdSeed,
  syncEmojiStickerObjectIdSeed,
  syncHorizontalLineObjectIdSeed,
  syncRulerObjectIdSeed,
  syncTrendLineObjectIdSeed,
} from './chartDrawingObjectIds'
import { storedFibRetracementFromOverlay, storedHorizontalLineFromOverlay, storedRulerFromOverlay, storedTrendLineFromOverlay } from './chartDrawingSerialization'
import { storedEmojiStickerFromOverlay } from './stickerDrawingSerialization'

export type InitialStoredDrawingState = {
  fibRetracementPersistenceEnabled: boolean
  emojiStickerPersistenceEnabled: boolean
  pendingEmojiStickerDrawings: StoredEmojiStickerDrawing[]
  horizontalLinePersistenceEnabled: boolean
  pendingFibRetracementDrawings: StoredFibRetracementDrawing[]
  pendingHorizontalLineDrawings: StoredHorizontalLineDrawing[]
  pendingRulerDrawings: StoredRulerDrawing[]
  pendingTrendLineDrawings: StoredTrendLineDrawing[]
  rulerPersistenceEnabled: boolean
  trendLinePersistenceEnabled: boolean
}

export function readInitialStoredDrawingState(): InitialStoredDrawingState {
  const horizontalLinePersistenceEnabled = readDrawingObjectPersistence('horizontalLine')
  const fibRetracementPersistenceEnabled = readDrawingObjectPersistence('fibRetracement')
  const emojiStickerPersistenceEnabled = readDrawingObjectPersistence('emojiSticker')
  const rulerPersistenceEnabled = readDrawingObjectPersistence('ruler')
  const trendLinePersistenceEnabled = readDrawingObjectPersistence('trendLine')
  const pendingFibRetracementDrawings = fibRetracementPersistenceEnabled ? readStoredFibRetracementDrawings() : []
  const pendingEmojiStickerDrawings = emojiStickerPersistenceEnabled ? readStoredEmojiStickerDrawings() : []
  const pendingHorizontalLineDrawings = horizontalLinePersistenceEnabled ? readStoredHorizontalLineDrawings() : []
  const pendingRulerDrawings = rulerPersistenceEnabled ? readStoredRulerDrawings() : []
  const pendingTrendLineDrawings = trendLinePersistenceEnabled ? readStoredTrendLineDrawings() : []
  syncFibRetracementObjectIdSeed(pendingFibRetracementDrawings)
  syncEmojiStickerObjectIdSeed(pendingEmojiStickerDrawings)
  syncHorizontalLineObjectIdSeed(pendingHorizontalLineDrawings)
  syncRulerObjectIdSeed(pendingRulerDrawings)
  syncTrendLineObjectIdSeed(pendingTrendLineDrawings)
  return {
    fibRetracementPersistenceEnabled,
    emojiStickerPersistenceEnabled,
    horizontalLinePersistenceEnabled,
    pendingFibRetracementDrawings,
    pendingEmojiStickerDrawings,
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
  createFibRetracementOverlay,
  createRulerOverlay,
  createTrendLineOverlay,
  createEmojiStickerOverlay,
  fallbackPaneId,
  getDestroyed,
  getHorizontalLinePersistenceEnabled,
  getFibRetracementPersistenceEnabled,
  getEmojiStickerPersistenceEnabled,
  getPendingRulerOverlayId,
  getPendingFibRetracementOverlayId,
  getPendingTrendLineOverlayId,
  getRulerPersistenceEnabled,
  getTrendLinePersistenceEnabled,
  horizontalLineOverlayIds,
  fibRetracementOverlayIds,
  emojiStickerOverlayIds,
  initialHorizontalLineDrawings,
  initialFibRetracementDrawings,
  initialEmojiStickerDrawings,
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
  createFibRetracementOverlay: (options: {
    fibBackgroundOpacity?: number
    fibBackgroundVisible?: boolean
    fibHorizontalLineStyle?: SettingsLineSwatchValue
    fibLabelAlign?: string
    fibLabelFontSize?: string
    fibLabelVAlign?: string
    fibLevelDisplay?: string
    fibLevelVisible?: boolean
    fibLevels?: Array<{ color?: string; enabled?: boolean; opacity?: number; value?: string }>
    fibPriceVisible?: boolean
    fibQuarterLineStyles?: SettingsLineSwatchValue[]
    fibQuarterSplitVisible?: boolean
    fibReverse?: boolean
    fibTrendLineStyle?: SettingsLineSwatchValue
    fibTrendLineVisible?: boolean
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
  createEmojiStickerOverlay: (options: {
    bold: boolean
    color: string
    fontFamily: string
    italic: boolean
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    point: { dataIndex?: number; timestamp?: number; value?: number }
    size: number
    symbol: string
    textStyle?: DrawingTextStyle
  }) => unknown
  fallbackPaneId: string
  getDestroyed: () => boolean
  getHorizontalLinePersistenceEnabled: () => boolean
  getFibRetracementPersistenceEnabled: () => boolean
  getEmojiStickerPersistenceEnabled: () => boolean
  getPendingFibRetracementOverlayId: () => string | null
  getPendingRulerOverlayId: () => string | null
  getPendingTrendLineOverlayId: () => string | null
  getRulerPersistenceEnabled: () => boolean
  getTrendLinePersistenceEnabled: () => boolean
  horizontalLineOverlayIds: Set<string>
  fibRetracementOverlayIds: Set<string>
  emojiStickerOverlayIds: Set<string>
  initialFibRetracementDrawings: StoredFibRetracementDrawing[]
  initialEmojiStickerDrawings: StoredEmojiStickerDrawing[]
  initialHorizontalLineDrawings: StoredHorizontalLineDrawing[]
  initialRulerDrawings: StoredRulerDrawing[]
  initialTrendLineDrawings: StoredTrendLineDrawing[]
  rulerOverlayIds: Set<string>
  trendLineOverlayIds: Set<string>
}) {
  let pendingFibRetracementDrawings = initialFibRetracementDrawings
  let pendingEmojiStickerDrawings = initialEmojiStickerDrawings
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

  const persistCurrentFibRetracements = () => {
    if (getDestroyed()) return
    if (!getFibRetracementPersistenceEnabled()) return
    const drawings: StoredFibRetracementDrawing[] = []
    fibRetracementOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        fibRetracementOverlayIds.delete(id)
        return
      }
      if (overlay.id === getPendingFibRetracementOverlayId() || overlay.points.length < 2) return
      const drawing = storedFibRetracementFromOverlay(overlay, createFibRetracementObjectId, fallbackPaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredFibRetracementDrawings(drawings)
  }

  const persistCurrentEmojiStickers = () => {
    if (getDestroyed()) return
    if (!getEmojiStickerPersistenceEnabled()) return
    const drawings: StoredEmojiStickerDrawing[] = []
    emojiStickerOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        emojiStickerOverlayIds.delete(id)
        return
      }
      const drawing = storedEmojiStickerFromOverlay(overlay, createEmojiStickerObjectId, fallbackPaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredEmojiStickerDrawings(drawings)
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

  const restorePendingStoredFibRetracements = () => {
    if (!getFibRetracementPersistenceEnabled() || pendingFibRetracementDrawings.length === 0) return
    const remaining: StoredFibRetracementDrawing[] = []
    pendingFibRetracementDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || fallbackPaneId
      if (!canCreateOverlayOnPane(paneId)) {
        remaining.push(drawing)
        return
      }
      const overlayId = createFibRetracementOverlay({
        fibBackgroundOpacity: drawing.fibBackgroundOpacity,
        fibBackgroundVisible: drawing.fibBackgroundVisible,
        fibHorizontalLineStyle: drawing.fibHorizontalLineStyle,
        fibLabelAlign: drawing.fibLabelAlign,
        fibLabelFontSize: drawing.fibLabelFontSize,
        fibLabelVAlign: drawing.fibLabelVAlign,
        fibLevelDisplay: drawing.fibLevelDisplay,
        fibLevelVisible: drawing.fibLevelVisible,
        fibLevels: drawing.fibLevels,
        fibPriceVisible: drawing.fibPriceVisible,
        fibQuarterLineStyles: drawing.fibQuarterLineStyles,
        fibQuarterSplitVisible: drawing.fibQuarterSplitVisible,
        fibReverse: drawing.fibReverse,
        fibTrendLineStyle: drawing.fibTrendLineStyle,
        fibTrendLineVisible: drawing.fibTrendLineVisible,
        lineStyle: drawing.lineStyle,
        locked: drawing.locked,
        manualVisible: drawing.manualVisible,
        objectId: drawing.objectId || createFibRetracementObjectId(),
        paneId,
        points: drawing.points.slice(0, 2),
        rulerStyle: drawing.rulerStyle,
        selected: false,
        showPriceLabel: drawing.showPriceLabel,
        textStyle: drawing.textStyle,
      })
      if (typeof overlayId === 'string') fibRetracementOverlayIds.add(overlayId)
    })
    pendingFibRetracementDrawings = remaining
  }

  const restorePendingStoredEmojiStickers = () => {
    if (!getEmojiStickerPersistenceEnabled() || pendingEmojiStickerDrawings.length === 0) return
    const remaining: StoredEmojiStickerDrawing[] = []
    pendingEmojiStickerDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || fallbackPaneId
      if (!canCreateOverlayOnPane(paneId)) {
        remaining.push(drawing)
        return
      }
      const overlayId = createEmojiStickerOverlay({
        bold: drawing.bold,
        color: drawing.color,
        fontFamily: drawing.fontFamily,
        italic: drawing.italic,
        locked: drawing.locked,
        manualVisible: drawing.manualVisible,
        objectId: drawing.objectId || createEmojiStickerObjectId(),
        paneId,
        point: drawing.point,
        size: drawing.size,
        symbol: drawing.symbol,
        textStyle: drawing.textStyle,
      })
      if (typeof overlayId === 'string') emojiStickerOverlayIds.add(overlayId)
    })
    pendingEmojiStickerDrawings = remaining
  }

  return {
    persistCurrentFibRetracements,
    persistCurrentEmojiStickers,
    persistCurrentHorizontalLines,
    persistCurrentRulers,
    persistCurrentTrendLines,
    restorePendingStoredFibRetracements,
    restorePendingStoredEmojiStickers,
    restorePendingStoredHorizontalLines,
    restorePendingStoredRulers,
    restorePendingStoredTrendLines,
  }
}
