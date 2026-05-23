import { ActionType, DomPosition, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingMainPaneId, knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import {
  horizontalLineObjectVisibilityRangeKey,
  horizontalLineOverlayName,
  horizontalLineVisibilityRangeKey,
  isDrawingVisibilityRangeKey,
  trendLineObjectVisibilityRangeKey,
  trendLineOverlayName,
  trendLineVisibilityRangeKey,
} from '../drawing/drawingOverlayModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { drawingToolCommandEvent, isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { isObjectTreeDrawingCommandEvent, objectTreeDrawingCommandEvent, objectTreeDrawingsRequestEvent, publishObjectTreeDrawings } from '../rightDrawer/objectTree/objectTreeModel'
import {
  clearStoredHorizontalLineDrawings,
  clearStoredTrendLineDrawings,
  normalizeDrawingTextStyle,
  normalizeDrawingTrendLineStyle,
  readDrawingPersistence,
  readStoredHorizontalLineDrawings,
  readStoredTrendLineDrawings,
  writeStoredHorizontalLineDrawings,
  writeStoredTrendLineDrawings,
} from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle, StoredHorizontalLineDrawing, StoredTrendLineDrawing } from '../rightDrawer/drawingPersistence'
import { isStoredVisibilityRangePeriodVisible, restoreVisibilityRangeCurrentPeriod, visibilityRangeChangedEvent } from '../visibilityRange/visibilityRangeModel'
import { collectDrawingObjectTreeState, resolveDrawingObjectTreeTarget } from './chartDrawingObjectTreeState'
import {
  createHorizontalLineObjectId,
  createTrendLineObjectId,
  syncHorizontalLineObjectIdSeed,
  syncTrendLineObjectIdSeed,
} from './chartDrawingObjectIds'
import { storedHorizontalLineFromOverlay, storedTrendLineFromOverlay } from './chartDrawingSerialization'
import {
  ensureHorizontalLineTextFigure,
  ensureTrendLineHitFigure,
  ensureTrendLineStatsBoxFigure,
  ensureTrendLineTextFigure,
} from './chartDrawingFigures'
import type {
  HorizontalLineExtendData,
  HorizontalLineMoveEntry,
  MixedDrawingMoveState,
  ScreenPoint,
  TrendLineExtendData,
  TrendLineMoveEntry,
} from './chartDrawingTypes'
import { isCoordinate } from './chartDrawingTypes'
import { distanceToSegment } from './chartDrawingGeometry'
import { normalizeLineStyle, overlayStylesFromLine, trendOverlayStylesFromLine } from './chartDrawingStyle'
import { createHorizontalLinePointFigures, createHorizontalLineYAxisFigures, horizontalLineHitSlop } from './horizontalLineOverlayFigures'
import { createTrendLinePointFigures, createTrendLineYAxisFigures } from './trendLineOverlayFigures'
import { trendHandleColor, trendHandleLineWidth } from './trendLineFigures'

let horizontalLineOverlayRegistered = false
let trendLineOverlayRegistered = false
const candlePaneId = drawingMainPaneId
const trendLineOverlayZLevel = -1
export const chartDrawingVisibilityRefreshEvent = 'fractalframe:chart-drawing-visibility-refresh'
const horizontalLineHandleDragThreshold = 3
const trendLineEndpointDragThreshold = 3

function ensureHorizontalLineOverlay() {
  if (horizontalLineOverlayRegistered) return
  ensureHorizontalLineTextFigure()
  horizontalLineOverlayRegistered = true
  registerOverlay({
    name: horizontalLineOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createHorizontalLinePointFigures,
    createYAxisFigures: createHorizontalLineYAxisFigures,
  })
}

function ensureTrendLineOverlay() {
  if (trendLineOverlayRegistered) return
  ensureTrendLineHitFigure()
  ensureTrendLineTextFigure()
  ensureTrendLineStatsBoxFigure()
  trendLineOverlayRegistered = true
  registerOverlay({
    name: trendLineOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createTrendLinePointFigures,
    createYAxisFigures: createTrendLineYAxisFigures,
  })
}

export function installChartDrawingTools(chart: Chart, getPeriod: () => string = () => '') {
  ensureHorizontalLineOverlay()
  ensureTrendLineOverlay()
  let pendingOverlayId: string | null = null
  let pendingTrendLineOverlayId: string | null = null
  let pendingOverlayOptions: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  } | null = null
  let pendingTrendLineOptions: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  } | null = null
  let selectedOverlayId: string | null = null
  let selectedTrendLineOverlayId: string | null = null
  let activeObjectTreeOverlayId: string | null = null
  let lastSelectedOverlayId: string | null = null
  let lastSelectedTrendLineOverlayId: string | null = null
  let lastSelectedTrendLineAt = 0
  let pendingTrendStartHandle: HTMLDivElement | null = null
  let pendingTrendFirstPointPlaced = false
  const horizontalLineOverlayIds = new Set<string>()
  const trendLineOverlayIds = new Set<string>()
  const paneInteractionCleanups: Array<() => void> = []
  const registeredPaneInteractions = new Map<string, { cleanup: () => void; element: HTMLElement }>()
  let persistenceEnabled = readDrawingPersistence('horizontalLine')
  let trendLinePersistenceEnabled = readDrawingPersistence('trendLine')
  let pendingStoredHorizontalLineDrawings = persistenceEnabled ? readStoredHorizontalLineDrawings() : []
  let pendingStoredTrendLineDrawings = trendLinePersistenceEnabled ? readStoredTrendLineDrawings() : []
  syncHorizontalLineObjectIdSeed(pendingStoredHorizontalLineDrawings)
  syncTrendLineObjectIdSeed(pendingStoredTrendLineDrawings)
  let horizontalLineVisible = true
  let lastPointerPaneId = candlePaneId
  let additiveSelectionActive = false
  let pressedMoveState: { activeId: string; activeStartValue: number; entries: HorizontalLineMoveEntry[]; paneId: string } | null = null
  let mixedDrawingMoveState: MixedDrawingMoveState | null = null
  let pendingHorizontalLineHandlePress: { overlayId: string; x: number; y: number } | null = null
  let pendingTrendLineEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  const selectedHorizontalLineOverlayIds = new Set<string>()
  let destroyed = false

  const hidePendingTrendStartHandle = () => {
    pendingTrendStartHandle?.remove()
    pendingTrendStartHandle = null
  }

  const publishState = (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => {
    const stateSelected = state?.selected
    const fallbackOverlayId = stateSelected !== false ? resolveSelectedOverlayId() : null
    const primaryOverlay = selectedOverlayId ? chart.getOverlayById(selectedOverlayId) : null
    const fallbackOverlay = fallbackOverlayId ? chart.getOverlayById(fallbackOverlayId) : null
    const selectedOverlay = primaryOverlay ?? fallbackOverlay
    if (selectedOverlay) selectedOverlayId = selectedOverlay.id
    const selectedExtendData = selectedOverlay?.extendData as HorizontalLineExtendData | null
    const selectedPrice = Number(selectedOverlay?.points[0]?.value)
    publishDrawingToolState({
      armed: pendingOverlayId != null,
      lineStyle: selectedExtendData?.lineStyle ? normalizeLineStyle(selectedExtendData.lineStyle) : undefined,
      locked: Boolean(selectedExtendData?.locked),
      objectId: selectedExtendData?.objectId,
      price: Number.isFinite(selectedPrice) ? selectedPrice : undefined,
      selected: selectedOverlay != null,
      showPriceLabel: selectedExtendData?.showPriceLabel !== false,
      textStyle: selectedExtendData?.textStyle ? normalizeDrawingTextStyle(selectedExtendData.textStyle) : undefined,
      tool: 'horizontalLine',
      ...state,
    })
  }

  const persistCurrentHorizontalLines = () => {
    if (destroyed) return
    if (!persistenceEnabled) return
    const drawings: StoredHorizontalLineDrawing[] = []
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        horizontalLineOverlayIds.delete(id)
        return
      }
      const drawing = storedHorizontalLineFromOverlay(overlay, createHorizontalLineObjectId, candlePaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredHorizontalLineDrawings(drawings)
  }

  const persistCurrentTrendLines = () => {
    if (destroyed) return
    if (!trendLinePersistenceEnabled) return
    const drawings: StoredTrendLineDrawing[] = []
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      if (overlay.id === pendingTrendLineOverlayId || overlay.points.length < 2) return
      const drawing = storedTrendLineFromOverlay(overlay, createTrendLineObjectId, candlePaneId)
      if (drawing) drawings.push(drawing)
    })
    writeStoredTrendLineDrawings(drawings)
  }

  const resolveTrendPointPrices = (overlay: { points?: Array<{ value?: number }> } | null | undefined): [number | undefined, number | undefined] => {
    const first = Number(overlay?.points?.[0]?.value)
    const second = Number(overlay?.points?.[1]?.value)
    return [
      Number.isFinite(first) ? first : undefined,
      Number.isFinite(second) ? second : undefined,
    ]
  }

  const updateOverlayState = (id: string | undefined, patch: Record<string, unknown>) => {
    if (!id) return
    const overlay = chart.getOverlayById(id)
    if (!overlay) return
    if (typeof patch.selected === 'boolean') {
      if (patch.selected) selectedHorizontalLineOverlayIds.add(id)
      else selectedHorizontalLineOverlayIds.delete(id)
    }
    const visualStateOnly = Object.keys(patch).every((key) => key === 'handlePressed' || key === 'hovered' || key === 'pressed' || key === 'selected')
    if (overlay.visible === false && visualStateOnly) return
    chart.overrideOverlay({
      id,
      extendData: {
        ...(overlay.extendData ?? {}),
        ...patch,
      },
      visible: overlay.visible,
    })
  }

  const getSelectedHorizontalLineIds = () => Array.from(horizontalLineOverlayIds).filter((id) => {
    return selectedHorizontalLineOverlayIds.has(id)
  })

  const getSelectedTrendLineIds = () => Array.from(trendLineOverlayIds).filter((id) => {
    const overlay = chart.getOverlayById(id)
    const extendData = overlay?.extendData as TrendLineExtendData | undefined
    return overlay != null && overlay.id !== pendingTrendLineOverlayId && (extendData?.selected === true || extendData?.pressed === true)
  })

  const getSelectedDrawingCount = () => getSelectedHorizontalLineIds().length + getSelectedTrendLineIds().length

  const setSelectedHorizontalLine = (id: string, additive: boolean) => {
    if (!additive) clearTrendLineSelection()
    horizontalLineOverlayIds.forEach((overlayId) => {
      if (additive && overlayId !== id) return
      updateOverlayState(overlayId, { selected: overlayId === id })
    })
    selectedOverlayId = id
    lastSelectedOverlayId = id
    activeObjectTreeOverlayId = id
  }

  const toggleSelectedHorizontalLine = (id: string) => {
    const selected = selectedHorizontalLineOverlayIds.has(id)
    updateOverlayState(id, { selected: !selected })
    selectedOverlayId = selected ? resolveSelectedOverlayId() : id
    lastSelectedOverlayId = selected ? selectedOverlayId : id
    activeObjectTreeOverlayId = selected ? selectedOverlayId : id
  }

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
      mixedDrawingMoveState = null
      return
    }
    const horizontalEntries = getSelectedHorizontalLineIds()
      .map((id) => {
        const overlay = chart.getOverlayById(id)
        const extendData = overlay?.extendData as HorizontalLineExtendData | undefined
        const value = Number(overlay?.points[0]?.value)
        if (!overlay || (overlay.paneId || candlePaneId) !== paneId || extendData?.locked === true || overlay.lock === true || !Number.isFinite(value)) return null
        const pixel = chart.convertToPixel({ value }, { paneId })
        const y = Number(isCoordinate(pixel) ? pixel.y : undefined)
        return Number.isFinite(y) ? { id, startValue: value, startY: y } : null
      })
      .filter((entry): entry is HorizontalLineMoveEntry & { startY: number } => entry != null)
    const trendEntries = getSelectedTrendLineIds()
      .map((id) => {
        const overlay = chart.getOverlayById(id)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay || (overlay.paneId || candlePaneId) !== paneId || extendData?.locked === true || overlay.lock === true) return null
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
    mixedDrawingMoveState = entryCount > 1 ? { activeId, horizontalEntries, paneId, startX, startY, trendEntries } : null
  }

  const moveMixedDrawings = (event: { x?: number; y?: number }, activeId: string) => {
    const moveState = mixedDrawingMoveState
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
        points: [{
          ...(overlay.points[0] ?? {}),
          value,
        }],
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
      pressedMoveState = null
      mixedDrawingMoveState = null
      return
    }
    const paneId = overlay.paneId || candlePaneId
    const selectedIds = getSelectedHorizontalLineIds()
    const selectedTrendIds = getSelectedTrendLineIds()
    const activeIsAlreadySelected = selectedIds.includes(overlayId)
    if (activeIsAlreadySelected && selectedIds.length + selectedTrendIds.length > 1) {
      selectedOverlayId = overlayId
      lastSelectedOverlayId = overlayId
      activeObjectTreeOverlayId = overlayId
    } else {
      setSelectedHorizontalLine(overlayId, false)
    }

    const moveIds = getSelectedHorizontalLineIds()
    const entries = moveIds
      .map((id) => {
        const selectedOverlay = chart.getOverlayById(id)
        const extendData = selectedOverlay?.extendData as HorizontalLineExtendData | undefined
        if (!selectedOverlay || (selectedOverlay.paneId || candlePaneId) !== paneId || extendData?.locked === true || selectedOverlay.lock === true) return null
        const startValue = Number(selectedOverlay.points[0]?.value)
        return Number.isFinite(startValue) ? { id, startValue } : null
      })
      .filter((entry): entry is HorizontalLineMoveEntry => entry != null)
    const activeEntry = entries.find((entry) => entry.id === overlayId)
    pressedMoveState = activeEntry ? { activeId: overlayId, activeStartValue: activeEntry.startValue, entries, paneId } : null
    beginMixedDrawingMove(overlayId, paneId, event)
  }

  const moveSelectedHorizontalLines = (event: { x?: number; y?: number }, overlayId: string) => {
    const moveState = pressedMoveState
    if (!moveState || moveState.activeId !== overlayId || moveState.entries.length <= 1) return false
    const value = resolvePointValueFromMoveEvent(event, moveState.paneId)
    if (!Number.isFinite(value)) return false
    const delta = value - moveState.activeStartValue
    moveState.entries.forEach((entry) => {
      const overlay = chart.getOverlayById(entry.id)
      if (!overlay) return
      chart.overrideOverlay({
        id: entry.id,
        points: [{
          ...(overlay.points[0] ?? {}),
          value: entry.startValue + delta,
        }],
      })
    })
    return true
  }

  const publishObjectTreeState = () => {
    const state = collectDrawingObjectTreeState({
      activeObjectTreeOverlayId,
      chart,
      fallbackPaneId: candlePaneId,
      horizontalLineOverlayIds,
      pendingTrendLineOverlayId,
      resolveHorizontalLineVisibility,
      resolveTrendLineVisibility,
      selectedHorizontalLineOverlayIds,
      selectedTrendLineOverlayId,
      trendLineOverlayIds,
    })
    publishObjectTreeDrawings(state.items, state.activeId)
  }

  const resolveDeleteTargetOverlayId = () => {
    if (selectedOverlayId && chart.getOverlayById(selectedOverlayId)) return selectedOverlayId
    if (lastSelectedOverlayId && chart.getOverlayById(lastSelectedOverlayId)) return lastSelectedOverlayId
    return null
  }

  const resolveSelectedOverlayId = () => {
    if (selectedOverlayId) {
      if (selectedHorizontalLineOverlayIds.has(selectedOverlayId)) return selectedOverlayId
    }
    if (!lastSelectedOverlayId) return null
    if (selectedHorizontalLineOverlayIds.has(lastSelectedOverlayId)) return lastSelectedOverlayId
    return selectedHorizontalLineOverlayIds.values().next().value ?? null
  }

  const resolveEditableOverlayId = () => resolveSelectedOverlayId()

  const isHorizontalLineVisibleInCurrentPeriod = (objectId?: string) => isStoredVisibilityRangePeriodVisible(horizontalLineObjectVisibilityRangeKey(objectId), getPeriod())
  const isTrendLineVisibleInCurrentPeriod = (objectId?: string) => isStoredVisibilityRangePeriodVisible(trendLineObjectVisibilityRangeKey(objectId), getPeriod())

  const restoreCurrentPeriodVisibility = (key: string | undefined) => {
    restoreVisibilityRangeCurrentPeriod(key, getPeriod())
  }

  const resolveHorizontalLineVisibility = (extendData: HorizontalLineExtendData | undefined) => {
    const manualVisible = extendData?.manualVisible !== false
    const periodVisible = isHorizontalLineVisibleInCurrentPeriod(extendData?.objectId)
    return {
      manualVisible,
      periodVisible,
      visible: manualVisible && periodVisible,
    }
  }

  const resolveTrendLineVisibility = (extendData: TrendLineExtendData | undefined) => {
    const manualVisible = extendData?.manualVisible !== false
    const periodVisible = isTrendLineVisibleInCurrentPeriod(extendData?.objectId)
    return {
      manualVisible,
      periodVisible,
      visible: manualVisible && periodVisible,
    }
  }

  const applyHorizontalLineVisibility = () => {
    horizontalLineVisible = true
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      const { manualVisible, periodVisible, visible } = resolveHorizontalLineVisibility(extendData)
      const selected = selectedHorizontalLineOverlayIds.has(id)
      if (overlay.visible !== manualVisible || extendData?.manualVisible !== manualVisible || extendData?.periodVisible !== periodVisible || extendData?.selected !== selected) {
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            manualVisible,
            periodVisible,
            selected,
          },
          visible: manualVisible,
        })
      }
      if (!visible) updateOverlayState(id, { handlePressed: false, hovered: false, pressed: false })
    })
    if (!selectedOverlayId) publishState({ selected: false })
    publishObjectTreeState()
  }

  const applyTrendLineVisibility = () => {
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      const { manualVisible, periodVisible, visible } = resolveTrendLineVisibility(extendData)
      const selected = selectedTrendLineOverlayId === id || extendData?.selected === true
      if (overlay.visible !== manualVisible || extendData?.manualVisible !== manualVisible || extendData?.periodVisible !== periodVisible || extendData?.selected !== selected) {
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            manualVisible,
            periodVisible,
            selected,
          },
          visible: manualVisible,
        })
      }
      if (!visible) {
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            endpointPressed: false,
            hovered: false,
            pressed: false,
            pressedPointIndex: undefined,
            selected,
          },
        })
      }
    })
    publishObjectTreeState()
  }

  const eventHitsHorizontalLine = (event: MouseEvent, paneId: string, hitSlop = horizontalLineHitSlop) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventY = event.clientY - rect.top
    if (!Number.isFinite(eventY)) return false
    for (const id of horizontalLineOverlayIds) {
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || candlePaneId) !== paneId) continue
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

  const resolveOverlayPointPixel = (point: { dataIndex?: number; timestamp?: number; value?: number }, paneId: string) => {
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

  const updatePendingTrendStartHandle = (overlay: { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> }) => {
    const paneId = overlay.paneId || candlePaneId
    const point = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!point || !paneMain) {
      hidePendingTrendStartHandle()
      return
    }
    const rect = paneMain.getBoundingClientRect()
    if (!pendingTrendStartHandle) {
      pendingTrendStartHandle = document.createElement('div')
      pendingTrendStartHandle.style.position = 'fixed'
      pendingTrendStartHandle.style.width = '13px'
      pendingTrendStartHandle.style.height = '13px'
      pendingTrendStartHandle.style.border = `${trendHandleLineWidth}px solid ${trendHandleColor}`
      pendingTrendStartHandle.style.borderRadius = '50%'
      pendingTrendStartHandle.style.background = '#ffffff'
      pendingTrendStartHandle.style.boxSizing = 'border-box'
      pendingTrendStartHandle.style.pointerEvents = 'none'
      pendingTrendStartHandle.style.zIndex = '2147483647'
      document.body.appendChild(pendingTrendStartHandle)
    }
    pendingTrendStartHandle.style.left = `${rect.left + point.x - 6.5}px`
    pendingTrendStartHandle.style.top = `${rect.top + point.y - 6.5}px`
  }

  const eventHitsTrendLine = (event: MouseEvent, paneId: string, hitSlop = horizontalLineHitSlop) => {
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!paneMain) return false
    const rect = paneMain.getBoundingClientRect()
    const eventPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    if (!Number.isFinite(eventPoint.x) || !Number.isFinite(eventPoint.y)) return false
    for (const id of trendLineOverlayIds) {
      if (id === pendingTrendLineOverlayId) continue
      const overlay = chart.getOverlayById(id)
      if (!overlay || (overlay.paneId || candlePaneId) !== paneId) continue
      if (!resolveTrendLineVisibility(overlay.extendData as TrendLineExtendData | undefined).visible) continue
      const start = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
      const end = resolveOverlayPointPixel(overlay.points[1] ?? {}, paneId)
      if (!start || !end) continue
      if (distanceToSegment(eventPoint, start, end) <= hitSlop) return true
    }
    return false
  }

  const clearHorizontalLineSelection = () => {
    let changed = false
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (!selectedHorizontalLineOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      updateOverlayState(id, { handlePressed: false, hovered: false, pressed: false, selected: false })
    })
    if (!changed && !selectedOverlayId) return
    selectedOverlayId = null
    selectedHorizontalLineOverlayIds.clear()
    publishState({ selected: false })
    publishObjectTreeState()
  }

  const clearTrendLineSelection = () => {
    let changed = false
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      chart.overrideOverlay({
        id,
        extendData: {
          ...extendData,
          endpointPressed: false,
          hovered: false,
          pressed: false,
          pressedPointIndex: undefined,
          selected: false,
        },
      })
    })
    if (!changed && !selectedTrendLineOverlayId) return
    selectedTrendLineOverlayId = null
    publishDrawingToolState({
      armed: pendingTrendLineOverlayId != null,
      locked: false,
      selected: false,
      showPriceLabel: true,
      tool: 'trendLine',
    })
    publishObjectTreeState()
  }

  const clearOtherTrendLineSelections = (activeId: string) => {
    trendLineOverlayIds.forEach((id) => {
      if (id === activeId) return
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected !== true && extendData?.pressed !== true && extendData?.endpointPressed !== true) return
      chart.overrideOverlay({
        id,
        extendData: {
          ...extendData,
          endpointPressed: false,
          pressed: false,
          pressedPointIndex: undefined,
          selected: false,
        },
      })
    })
  }

  const selectTrendLineForInteraction = (overlay: { id: string; extendData?: unknown }, additive: boolean, preserveSelection = false) => {
    if (!additive && !preserveSelection) {
      clearHorizontalLineSelection()
      clearOtherTrendLineSelections(overlay.id)
    }
    const extendData = overlay.extendData as TrendLineExtendData | undefined
    selectedTrendLineOverlayId = overlay.id
    lastSelectedTrendLineOverlayId = overlay.id
    lastSelectedTrendLineAt = Date.now()
    activeObjectTreeOverlayId = overlay.id
    chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
    return extendData
  }

  const resolveSelectedTrendLineOverlayId = () => {
    if (selectedTrendLineOverlayId && chart.getOverlayById(selectedTrendLineOverlayId)) return selectedTrendLineOverlayId
    for (const id of trendLineOverlayIds) {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        continue
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected === true || extendData?.pressed === true) return id
    }
    return null
  }

  const resolveDeletableTrendLineOverlayId = () => {
    const selectedId = resolveSelectedTrendLineOverlayId()
    if (selectedId) return selectedId
    if (lastSelectedTrendLineOverlayId && Date.now() - lastSelectedTrendLineAt < 800 && chart.getOverlayById(lastSelectedTrendLineOverlayId)) {
      return lastSelectedTrendLineOverlayId
    }
    return null
  }

  const handlePaneClick = (event: MouseEvent, paneId: string) => {
    window.setTimeout(() => {
      if (destroyed) return
      if (eventHitsHorizontalLine(event, paneId)) return
      if (eventHitsTrendLine(event, paneId)) return
      clearHorizontalLineSelection()
      clearTrendLineSelection()
    }, 0)
  }

  const createHorizontalLineOverlay = ({
    lineStyle,
    locked,
    manualVisible = true,
    objectId = createHorizontalLineObjectId(),
    paneId = candlePaneId,
    points,
    selected,
    showPriceLabel,
    textStyle,
  }: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => chart.createOverlay({
    name: horizontalLineOverlayName,
    extendData: {
      drawing: true,
      hovered: false,
      lineStyle: normalizeLineStyle(lineStyle),
      locked,
      manualVisible,
      objectId,
      periodVisible: true,
      pressed: false,
      selected,
      showPriceLabel,
      textStyle: normalizeDrawingTextStyle(textStyle),
    },
    lock: locked,
    points,
    styles: overlayStylesFromLine(lineStyle),
    visible: horizontalLineVisible && manualVisible,
    onDrawEnd: ({ overlay }) => {
      pendingOverlayId = null
      pendingOverlayOptions = null
      selectedOverlayId = overlay.id
      lastSelectedOverlayId = overlay.id
      horizontalLineOverlayIds.add(overlay.id)
      setSelectedHorizontalLine(overlay.id, false)
      persistCurrentHorizontalLines()
      publishState({ armed: false, locked, selected: true })
      publishObjectTreeState()
      return false
    },
    onRemoved: ({ overlay }) => {
      horizontalLineOverlayIds.delete(overlay.id)
      selectedHorizontalLineOverlayIds.delete(overlay.id)
      if (selectedOverlayId === overlay.id) selectedOverlayId = null
      if (lastSelectedOverlayId === overlay.id) lastSelectedOverlayId = null
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      publishObjectTreeState()
      return false
    },
    onDeselected: ({ overlay }) => {
      if (additiveSelectionActive) return false
      if (overlay.visible === false) return false
      updateOverlayState(overlay.id, { selected: false })
      if (selectedOverlayId === overlay.id) selectedOverlayId = null
      publishState({ selected: false })
      publishObjectTreeState()
      return false
    },
    onMouseEnter: ({ overlay }) => {
      updateOverlayState(overlay.id, { hovered: true })
      return false
    },
    onMouseLeave: ({ overlay }) => {
      updateOverlayState(overlay.id, { hovered: false })
      return false
    },
    onPressedMoveEnd: ({ overlay }) => {
      const movedIds = mixedDrawingMoveState?.horizontalEntries.map((entry) => entry.id) ?? pressedMoveState?.entries.map((entry) => entry.id) ?? [overlay.id]
      movedIds.forEach((id) => updateOverlayState(id, { handlePressed: false, pressed: false }))
      mixedDrawingMoveState?.trendEntries.forEach((entry) => {
        const trendOverlay = chart.getOverlayById(entry.id)
        const trendExtendData = trendOverlay?.extendData as TrendLineExtendData | undefined
        if (trendOverlay) chart.overrideOverlay({ id: entry.id, extendData: { ...trendExtendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined } })
      })
      pressedMoveState = null
      mixedDrawingMoveState = null
      pendingHorizontalLineHandlePress = null
      persistCurrentHorizontalLines()
      persistCurrentTrendLines()
      publishState({ selected: true })
      publishObjectTreeState()
      return false
    },
    onPressedMoveStart: (event) => {
      const { overlay } = event
      const handlePressed = event.figureKey === 'handle'
      beginPressedMove(overlay.id, event as { x?: number; y?: number })
      pendingHorizontalLineHandlePress = handlePressed
        ? { overlayId: overlay.id, x: Number(event.x), y: Number(event.y) }
        : null
      updateOverlayState(overlay.id, { handlePressed: false, pressed: true, selected: true })
      publishState({
        locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
        selected: true,
      })
      publishObjectTreeState()
      return false
    },
    onPressedMoving: (event) => {
      const { overlay } = event
      if (overlay.lock === true || (overlay.extendData as { locked?: boolean } | null)?.locked === true) return true
      if (pendingHorizontalLineHandlePress?.overlayId === overlay.id) {
        const distance = Math.hypot(Number(event.x) - pendingHorizontalLineHandlePress.x, Number(event.y) - pendingHorizontalLineHandlePress.y)
        if (Number.isFinite(distance) && distance >= horizontalLineHandleDragThreshold) {
          updateOverlayState(overlay.id, { handlePressed: true })
          pendingHorizontalLineHandlePress = null
        }
      }
      if (moveMixedDrawings(event as { x?: number; y?: number }, overlay.id)) return true
      return moveSelectedHorizontalLines(event as { x?: number; y?: number }, overlay.id)
    },
    onSelected: ({ overlay }) => {
      if (selectedHorizontalLineOverlayIds.has(overlay.id) && getSelectedDrawingCount() > 1) {
        selectedOverlayId = overlay.id
        lastSelectedOverlayId = overlay.id
        activeObjectTreeOverlayId = overlay.id
      } else {
        setSelectedHorizontalLine(overlay.id, additiveSelectionActive)
      }
      publishState({
        locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
        selected: true,
      })
      publishObjectTreeState()
      return false
    },
  }, paneId)

  const createTrendLineOverlay = ({
    lineStyle,
    locked,
    manualVisible = true,
    objectId = createTrendLineObjectId(),
    paneId = candlePaneId,
    points,
    selected,
    showPriceLabel,
    textStyle,
    trendLineStyle,
  }: {
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
  }) => chart.createOverlay({
    name: trendLineOverlayName,
    extendData: {
      hovered: false,
      lineStyle: normalizeLineStyle(lineStyle),
      locked,
      manualVisible,
      objectId,
      periodVisible: true,
      pressed: false,
      selected,
      showPriceLabel,
      textStyle: normalizeDrawingTextStyle(textStyle),
      trendLineStyle: normalizeDrawingTrendLineStyle(trendLineStyle),
    },
    lock: locked,
    points,
    styles: trendOverlayStylesFromLine(lineStyle),
    visible: manualVisible,
    zLevel: trendLineOverlayZLevel,
    onDrawing: ({ overlay }) => {
      const startPoint = overlay.points[0]
      const currentStep = Number((overlay as { currentStep?: number }).currentStep)
      if (pendingTrendLineOverlayId === overlay.id && currentStep > 1 && Number.isFinite(Number(startPoint?.value))) {
        if (!pendingTrendFirstPointPlaced) pendingTrendFirstPointPlaced = true
        updatePendingTrendStartHandle(overlay as { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> })
      }
      return false
    },
    onDrawEnd: ({ overlay }) => {
      hidePendingTrendStartHandle()
      pendingTrendFirstPointPlaced = false
      pendingTrendLineOverlayId = null
      pendingTrendLineOptions = null
      selectedTrendLineOverlayId = overlay.id
      lastSelectedTrendLineOverlayId = overlay.id
      lastSelectedTrendLineAt = Date.now()
      activeObjectTreeOverlayId = overlay.id
      trendLineOverlayIds.add(overlay.id)
      chart.overrideOverlay({
        id: overlay.id,
        extendData: {
          ...(overlay.extendData as TrendLineExtendData | undefined),
          drawing: false,
          selected: true,
        },
      })
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(lineStyle),
        locked,
        objectId,
        selected: true,
        showPriceLabel,
        textStyle: normalizeDrawingTextStyle(textStyle),
        tool: 'trendLine',
        trendPointPrices: resolveTrendPointPrices(overlay),
        trendLineStyle: normalizeDrawingTrendLineStyle(trendLineStyle),
      })
      persistCurrentTrendLines()
      publishObjectTreeState()
      return false
    },
    onRemoved: ({ overlay }) => {
      if (pendingTrendLineOverlayId === overlay.id) hidePendingTrendStartHandle()
      if (pendingTrendLineOverlayId === overlay.id) pendingTrendFirstPointPlaced = false
      if (pendingTrendLineOverlayId === overlay.id) pendingTrendLineOverlayId = null
      if (selectedTrendLineOverlayId === overlay.id) selectedTrendLineOverlayId = null
      if (lastSelectedTrendLineOverlayId === overlay.id) lastSelectedTrendLineOverlayId = null
      trendLineOverlayIds.delete(overlay.id)
      persistCurrentTrendLines()
      publishObjectTreeState()
      return false
    },
    onMouseEnter: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, hovered: true } })
      return false
    },
    onMouseLeave: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, hovered: false } })
      return false
    },
    onPressedMoveEnd: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      selectedTrendLineOverlayId = overlay.id
      lastSelectedTrendLineOverlayId = overlay.id
      lastSelectedTrendLineAt = Date.now()
      activeObjectTreeOverlayId = overlay.id
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined, selected: true } })
      mixedDrawingMoveState?.horizontalEntries.forEach((entry) => updateOverlayState(entry.id, { handlePressed: false, pressed: false }))
      mixedDrawingMoveState?.trendEntries.forEach((entry) => {
        if (entry.id === overlay.id) return
        const trendOverlay = chart.getOverlayById(entry.id)
        const trendExtendData = trendOverlay?.extendData as TrendLineExtendData | undefined
        if (trendOverlay) chart.overrideOverlay({ id: entry.id, extendData: { ...trendExtendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined } })
      })
      mixedDrawingMoveState = null
      pendingTrendLineEndpointPress = null
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        objectId: extendData?.objectId,
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'trendLine',
        trendPointPrices: resolveTrendPointPrices(overlay),
        trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
      })
      persistCurrentHorizontalLines()
      persistCurrentTrendLines()
      publishObjectTreeState()
      return false
    },
    onPressedMoveStart: (event) => {
      const { overlay } = event
      const figureKey = typeof event.figureKey === 'string' ? event.figureKey : ''
      const endpointPressed = figureKey.includes('point_')
      const preserveSelection = !endpointPressed
        && selectedTrendLineOverlayId === overlay.id
        && getSelectedTrendLineIds().includes(overlay.id)
        && getSelectedDrawingCount() > 1
      const extendData = selectTrendLineForInteraction(overlay, additiveSelectionActive, preserveSelection)
      const pointKeyMatch = /point_(\d+)/.exec(figureKey)
      const pressedPointIndex = endpointPressed
        ? Number.isInteger(event.figureIndex)
          ? event.figureIndex
          : pointKeyMatch
            ? Number(pointKeyMatch[1])
            : undefined
        : undefined
      pendingTrendLineEndpointPress = endpointPressed && typeof pressedPointIndex === 'number' && Number.isInteger(pressedPointIndex)
        ? { overlayId: overlay.id, pointIndex: pressedPointIndex, x: Number(event.x), y: Number(event.y) }
        : null
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, pressed: true, pressedPointIndex: undefined, selected: true } })
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        objectId: extendData?.objectId,
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'trendLine',
        trendPointPrices: resolveTrendPointPrices(overlay),
        trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
      })
      if (!endpointPressed) beginMixedDrawingMove(overlay.id, overlay.paneId || candlePaneId, event as { x?: number; y?: number })
      publishObjectTreeState()
      return false
    },
    onPressedMoving: (event) => {
      const { overlay } = event
      if (overlay.lock === true || (overlay.extendData as { locked?: boolean } | null)?.locked === true) return true
      if (pendingTrendLineEndpointPress?.overlayId === overlay.id) {
        const distance = Math.hypot(Number(event.x) - pendingTrendLineEndpointPress.x, Number(event.y) - pendingTrendLineEndpointPress.y)
        if (Number.isFinite(distance) && distance >= trendLineEndpointDragThreshold) {
          const extendData = overlay.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: overlay.id,
            extendData: {
              ...extendData,
              endpointPressed: true,
              pressed: true,
              pressedPointIndex: pendingTrendLineEndpointPress.pointIndex,
              selected: true,
            },
          })
          pendingTrendLineEndpointPress = null
        }
      }
      if (!mixedDrawingMoveState) return false
      return moveMixedDrawings(event as { x?: number; y?: number }, overlay.id)
    },
    onSelected: ({ overlay }) => {
      const currentStep = Number((overlay as { currentStep?: number }).currentStep)
      if (pendingTrendLineOverlayId === overlay.id && currentStep > 1 && Number.isFinite(Number(overlay.points[0]?.value))) {
        if (!pendingTrendFirstPointPlaced) pendingTrendFirstPointPlaced = true
        updatePendingTrendStartHandle(overlay as { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> })
        return false
      }
      const preserveSelection = selectedTrendLineOverlayId === overlay.id
        && getSelectedTrendLineIds().includes(overlay.id)
        && getSelectedDrawingCount() > 1
      const extendData = selectTrendLineForInteraction(overlay, additiveSelectionActive, preserveSelection)
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        objectId: extendData?.objectId,
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'trendLine',
        trendPointPrices: resolveTrendPointPrices(overlay),
        trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
      })
      publishObjectTreeState()
      return false
    },
    onDeselected: ({ overlay }) => {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (overlay.visible === false || extendData?.manualVisible === false || extendData?.periodVisible === false) return false
      if (
        selectedTrendLineOverlayId === overlay.id &&
        lastSelectedTrendLineOverlayId === overlay.id &&
        Date.now() - lastSelectedTrendLineAt < 160
      ) {
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
        return false
      }
      if (selectedTrendLineOverlayId === overlay.id) selectedTrendLineOverlayId = null
      chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
      publishDrawingToolState({
        armed: pendingTrendLineOverlayId != null,
        locked: false,
        selected: false,
        showPriceLabel: true,
        tool: 'trendLine',
      })
      publishObjectTreeState()
      return false
    },
  }, paneId)

  const canCreateOverlayOnPane = (paneId: string) => paneId === candlePaneId || chart.getDom(paneId, DomPosition.Main) != null

  const restorePendingStoredHorizontalLines = () => {
    if (!persistenceEnabled || pendingStoredHorizontalLineDrawings.length === 0) return
    const remaining: StoredHorizontalLineDrawing[] = []
    pendingStoredHorizontalLineDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || candlePaneId
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
    pendingStoredHorizontalLineDrawings = remaining
  }

  const restorePendingStoredTrendLines = () => {
    if (!trendLinePersistenceEnabled || pendingStoredTrendLineDrawings.length === 0) return
    const remaining: StoredTrendLineDrawing[] = []
    pendingStoredTrendLineDrawings.forEach((drawing) => {
      const paneId = drawing.paneId || candlePaneId
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
    pendingStoredTrendLineDrawings = remaining
  }

  restorePendingStoredHorizontalLines()
  restorePendingStoredTrendLines()
  applyHorizontalLineVisibility()
  applyTrendLineVisibility()
  publishObjectTreeState()

  const recreatePendingOverlayForPane = (paneId: string) => {
    if (!pendingOverlayId || !pendingOverlayOptions) return
    const overlay = chart.getOverlayById(pendingOverlayId)
    if (!overlay || (overlay.points?.length ?? 0) > 0 || (overlay.paneId || candlePaneId) === paneId) return
    chart.removeOverlay({ id: pendingOverlayId })
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId,
      selected: false,
    })
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
    publishState({ armed: pendingOverlayId != null })
  }

  const setPointerPane = (paneId: string) => {
    if (lastPointerPaneId === paneId) return
    lastPointerPaneId = paneId
    recreatePendingOverlayForPane(paneId)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = false
  }

  const ensurePaneInteractionListeners = () => {
    knownDrawingPaneIds.forEach((paneId) => {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) return
      const registered = registeredPaneInteractions.get(paneId)
      if (registered?.element === paneMain) return
      registered?.cleanup()
      const handleClick = (event: MouseEvent) => handlePaneClick(event, paneId)
      const handlePointer = () => setPointerPane(paneId)
      paneMain.addEventListener('click', handleClick, true)
      paneMain.addEventListener('mouseenter', handlePointer)
      paneMain.addEventListener('pointerenter', handlePointer)
      paneMain.addEventListener('mousemove', handlePointer)
      const cleanup = () => {
        paneMain.removeEventListener('click', handleClick, true)
        paneMain.removeEventListener('mouseenter', handlePointer)
        paneMain.removeEventListener('pointerenter', handlePointer)
        paneMain.removeEventListener('mousemove', handlePointer)
      }
      paneInteractionCleanups.push(cleanup)
      registeredPaneInteractions.set(paneId, { cleanup, element: paneMain })
    })
  }

  ensurePaneInteractionListeners()
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return

    if (event.detail.tool === 'trendLine') {
      if (event.detail.action === 'release') {
        if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
        hidePendingTrendStartHandle()
        pendingTrendFirstPointPlaced = false
        pendingTrendLineOverlayId = null
        pendingTrendLineOptions = null
        publishDrawingToolState({
          armed: false,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'trendLine',
        })
        return
      }

      if (event.detail.action === 'updateSelectedTrendLineStyle') {
        pendingTrendLineOptions = pendingTrendLineOptions && event.detail.trendLineStyle
          ? { ...pendingTrendLineOptions, trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle) }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId && event.detail.trendLineStyle) {
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
            },
          })
        }
        if (selectedTrendLineOverlayId && event.detail.trendLineStyle) {
          const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: selectedTrendLineOverlayId,
            extendData: {
              ...extendData,
              trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
            },
          })
          persistCurrentTrendLines()
        }
        return
      }

      if (event.detail.action === 'toggleSelectedLock') {
        if (!selectedTrendLineOverlayId) return
        const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
        if (!overlay) return
        const extendData = overlay.extendData as TrendLineExtendData | undefined
        const locked = extendData?.locked !== true
        chart.overrideOverlay({
          id: selectedTrendLineOverlayId,
          extendData: {
            ...extendData,
            locked,
            selected: true,
          },
          lock: locked,
        })
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked,
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        persistCurrentTrendLines()
        return
      }

      if (event.detail.action === 'deleteSelected') {
        const deleteTargetTrendLineId = resolveDeletableTrendLineOverlayId()
        if (deleteTargetTrendLineId) {
          chart.removeOverlay({ id: deleteTargetTrendLineId })
          selectedTrendLineOverlayId = null
          lastSelectedTrendLineOverlayId = null
          persistCurrentTrendLines()
        }
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'trendLine',
        })
        return
      }

      if (event.detail.action === 'refreshSelectedState') {
        const selectedTrendLineId = resolveSelectedTrendLineOverlayId()
        if (!selectedTrendLineId) {
          publishDrawingToolState({
            armed: pendingTrendLineOverlayId != null,
            locked: false,
            selected: false,
            showPriceLabel: true,
            tool: 'trendLine',
          })
          return
        }
        const overlay = chart.getOverlayById(selectedTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay) {
          publishDrawingToolState({
            armed: pendingTrendLineOverlayId != null,
            locked: false,
            selected: false,
            showPriceLabel: true,
            tool: 'trendLine',
          })
          return
        }
        selectedTrendLineOverlayId = selectedTrendLineId
        activeObjectTreeOverlayId = selectedTrendLineId
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: Boolean(extendData?.locked),
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updatePersistence') {
        trendLinePersistenceEnabled = event.detail.persisted !== false
        if (trendLinePersistenceEnabled) {
          persistCurrentTrendLines()
        } else {
          clearStoredTrendLineDrawings()
        }
        return
      }

      if (event.detail.action === 'updateSelectedLineStyle') {
        pendingTrendLineOptions = pendingTrendLineOptions && event.detail.lineStyle
          ? { ...pendingTrendLineOptions, lineStyle: normalizeLineStyle(event.detail.lineStyle) }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId && event.detail.lineStyle) {
          const lineStyle = normalizeLineStyle(event.detail.lineStyle)
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              lineStyle,
            },
            styles: trendOverlayStylesFromLine(lineStyle),
          })
        }
        if (selectedTrendLineOverlayId && event.detail.lineStyle) {
          const lineStyle = normalizeLineStyle(event.detail.lineStyle)
          const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: selectedTrendLineOverlayId,
            extendData: {
              ...extendData,
              lineStyle,
            },
            styles: trendOverlayStylesFromLine(lineStyle),
          })
          persistCurrentTrendLines()
        }
        return
      }

      if (event.detail.action === 'updateSelectedTextStyle') {
        if (!event.detail.textStyle) return
        const textStyle = normalizeDrawingTextStyle(event.detail.textStyle)
        pendingTrendLineOptions = pendingTrendLineOptions
          ? { ...pendingTrendLineOptions, textStyle }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId) {
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              textStyle,
            },
          })
        }
        const editableTrendLineId = resolveSelectedTrendLineOverlayId()
        if (!editableTrendLineId) return
        const overlay = chart.getOverlayById(editableTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay) return
        chart.overrideOverlay({
          id: editableTrendLineId,
          extendData: {
            ...extendData,
            selected: true,
            textStyle,
          },
        })
        selectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineAt = Date.now()
        activeObjectTreeOverlayId = editableTrendLineId
        persistCurrentTrendLines()
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: Boolean(extendData?.locked),
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle,
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updateSelectedPriceLabel') {
        const showPriceLabel = event.detail.showPriceLabel !== false
        pendingTrendLineOptions = pendingTrendLineOptions
          ? { ...pendingTrendLineOptions, showPriceLabel }
          : pendingTrendLineOptions
        const editableTrendLineId = resolveSelectedTrendLineOverlayId()
        if (!editableTrendLineId) return
        const overlay = chart.getOverlayById(editableTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay) return
        chart.overrideOverlay({
          id: editableTrendLineId,
          extendData: {
            ...extendData,
            showPriceLabel,
            selected: true,
          },
        })
        selectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineAt = Date.now()
        activeObjectTreeOverlayId = editableTrendLineId
        persistCurrentTrendLines()
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: Boolean(extendData?.locked),
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updateSelectedTrendLinePointPrice') {
        const editableTrendLineId = resolveSelectedTrendLineOverlayId()
        const pointIndex = Number(event.detail.pointIndex)
        const price = Number(event.detail.price)
        if (!editableTrendLineId || !Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex > 1 || !Number.isFinite(price)) return
        const overlay = chart.getOverlayById(editableTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay || extendData?.locked === true) return
        const points = [...overlay.points]
        points[pointIndex] = {
          ...(points[pointIndex] ?? {}),
          value: price,
        }
        chart.overrideOverlay({ id: editableTrendLineId, points })
        selectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineAt = Date.now()
        activeObjectTreeOverlayId = editableTrendLineId
        persistCurrentTrendLines()
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: false,
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices({ points }),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action !== 'start') return
      const lineStyle = event.detail.lineStyle
      if (!lineStyle) return
      if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
      hidePendingTrendStartHandle()
      pendingTrendFirstPointPlaced = false
      pendingTrendLineOptions = {
        lineStyle,
        locked: event.detail.locked === true,
        showPriceLabel: event.detail.showPriceLabel !== false,
        textStyle: event.detail.textStyle,
        trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
      }
      const overlayId = createTrendLineOverlay({
        ...pendingTrendLineOptions,
        paneId: lastPointerPaneId,
        selected: false,
      })
      pendingTrendLineOverlayId = typeof overlayId === 'string' ? overlayId : null
      if (pendingTrendLineOverlayId) trendLineOverlayIds.add(pendingTrendLineOverlayId)
      publishDrawingToolState({
        armed: pendingTrendLineOverlayId != null,
        lineStyle: normalizeLineStyle(lineStyle),
        locked: pendingTrendLineOptions.locked,
        selected: false,
        showPriceLabel: pendingTrendLineOptions.showPriceLabel,
        textStyle: normalizeDrawingTextStyle(pendingTrendLineOptions.textStyle),
        tool: 'trendLine',
        trendLineStyle: pendingTrendLineOptions.trendLineStyle,
      })
      return
    }

    if (event.detail.action === 'release') {
      if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
      pendingOverlayId = null
      pendingOverlayOptions = null
      publishState({ armed: false })
      return
    }

    if (event.detail.action === 'refreshSelectedState') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) {
        publishState({ selected: false })
        return
      }
      setSelectedHorizontalLine(editableOverlayId, false)
      publishState()
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'deleteSelected') {
      const deleteTargetOverlayId = resolveDeleteTargetOverlayId()
      if (deleteTargetOverlayId) chart.removeOverlay({ id: deleteTargetOverlayId })
      if (selectedOverlayId === deleteTargetOverlayId) selectedOverlayId = null
      if (lastSelectedOverlayId === deleteTargetOverlayId) lastSelectedOverlayId = null
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      return
    }

    if (event.detail.action === 'toggleSelectedLock') {
      if (!selectedOverlayId) return
      const overlay = chart.getOverlayById(selectedOverlayId)
      const locked = (overlay?.extendData as { locked?: boolean } | null)?.locked !== true
      updateOverlayState(selectedOverlayId, { locked })
      chart.overrideOverlay({ id: selectedOverlayId, lock: locked })
      persistCurrentHorizontalLines()
      publishState({ locked, selected: true })
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'updatePersistence') {
      persistenceEnabled = event.detail.persisted !== false
      if (persistenceEnabled) {
        persistCurrentHorizontalLines()
      } else {
        clearStoredHorizontalLineDrawings()
      }
      return
    }

    if (event.detail.action === 'updateSelectedLineStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !event.detail.lineStyle) return
      const lineStyle = normalizeLineStyle(event.detail.lineStyle)
      updateOverlayState(editableOverlayId, { lineStyle })
      chart.overrideOverlay({
        id: editableOverlayId,
        styles: overlayStylesFromLine(lineStyle),
      })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ lineStyle, selected: true })
      return
    }

    if (event.detail.action === 'updateSelectedPriceLabel') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) return
      const showPriceLabel = event.detail.showPriceLabel !== false
      updateOverlayState(editableOverlayId, { showPriceLabel })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ selected: true, showPriceLabel } as Partial<{ armed: boolean; locked: boolean; selected: boolean; showPriceLabel: boolean }>)
      return
    }

    if (event.detail.action === 'updateSelectedPrice') {
      const editableOverlayId = resolveEditableOverlayId()
      const price = Number(event.detail.price)
      if (!editableOverlayId || !Number.isFinite(price)) return
      const overlay = chart.getOverlayById(editableOverlayId)
      if (!overlay || (overlay.extendData as HorizontalLineExtendData | undefined)?.locked === true) return
      chart.overrideOverlay({
        id: editableOverlayId,
        points: [{
          ...(overlay.points[0] ?? {}),
          value: price,
        }],
      })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ price, selected: true })
      return
    }

    if (event.detail.action === 'updateSelectedTextStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !event.detail.textStyle) return
      const textStyle = normalizeDrawingTextStyle(event.detail.textStyle)
      updateOverlayState(editableOverlayId, { textStyle })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ selected: true, textStyle } as Partial<{ armed: boolean; locked: boolean; selected: boolean; textStyle: DrawingTextStyle }>)
      return
    }

    const lineStyle = event.detail.lineStyle
    if (!lineStyle) return

    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    pendingOverlayOptions = {
      lineStyle,
      locked: event.detail.locked === true,
      showPriceLabel: event.detail.showPriceLabel !== false,
      textStyle: event.detail.textStyle,
    }
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId: lastPointerPaneId,
      selected: false,
    })
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
    applyHorizontalLineVisibility()
    publishState({ armed: pendingOverlayId != null, selected: selectedOverlayId != null })
    publishObjectTreeState()
  }

  const handleObjectTreeCommand = (event: Event) => {
    if (!isObjectTreeDrawingCommandEvent(event)) return
    if (event.detail.action === 'deselectAll') {
      clearHorizontalLineSelection()
      clearTrendLineSelection()
      return
    }
    const command = event.detail
    const resolveObjectTreeOverlayTarget = (treeId: string) => resolveDrawingObjectTreeTarget({
      chart,
      horizontalLineOverlayIds,
      treeId,
      trendLineOverlayIds,
    })
    const target = resolveObjectTreeOverlayTarget(command.id)
    if (!target) return
    const overlay = chart.getOverlayById(target.id)
    if (!overlay) return
    const resolveTargets = (ids: string[] | undefined) => (Array.isArray(ids) ? ids : [command.id])
      .map((targetId) => resolveObjectTreeOverlayTarget(targetId))
      .filter((row): row is { id: string; kind: 'horizontalLine' | 'trendLine' } => Boolean(row))

    if (event.detail.action === 'delete') {
      resolveTargets(event.detail.ids).forEach((row) => chart.removeOverlay({ id: row.id }))
      return
    }

    if (event.detail.action === 'setVisible') {
      const manualVisible = event.detail.visible
      resolveTargets(event.detail.ids).forEach((row) => {
        const targetOverlay = chart.getOverlayById(row.id)
        if (!targetOverlay) return
        const targetExtendData = targetOverlay.extendData as HorizontalLineExtendData | TrendLineExtendData | undefined
        let periodVisible = row.kind === 'horizontalLine'
          ? isHorizontalLineVisibleInCurrentPeriod(targetExtendData?.objectId)
          : isTrendLineVisibleInCurrentPeriod(targetExtendData?.objectId)
        if (manualVisible && !periodVisible) {
          restoreCurrentPeriodVisibility(row.kind === 'horizontalLine'
            ? horizontalLineObjectVisibilityRangeKey(targetExtendData?.objectId)
            : trendLineObjectVisibilityRangeKey(targetExtendData?.objectId))
          periodVisible = true
        }
        const visible = manualVisible && periodVisible
        chart.overrideOverlay({
          id: row.id,
          extendData: {
            ...(targetOverlay.extendData ?? {}),
            manualVisible,
            periodVisible,
            selected: row.kind === 'horizontalLine'
              ? selectedHorizontalLineOverlayIds.has(row.id)
              : selectedTrendLineOverlayId === row.id || (targetExtendData as TrendLineExtendData | undefined)?.selected === true,
          },
          visible: manualVisible,
        })
        if (!visible && row.kind === 'horizontalLine') updateOverlayState(row.id, { handlePressed: false, hovered: false, pressed: false })
        if (!visible && row.kind === 'trendLine') {
          chart.overrideOverlay({
            id: row.id,
            extendData: {
              ...(targetOverlay.extendData ?? {}),
              endpointPressed: false,
              hovered: false,
              manualVisible,
              periodVisible,
              pressed: false,
              pressedPointIndex: undefined,
              selected: selectedTrendLineOverlayId === row.id || (targetExtendData as TrendLineExtendData | undefined)?.selected === true,
            },
          })
        }
      })
      persistCurrentHorizontalLines()
      persistCurrentTrendLines()
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'setLocked') {
      const locked = event.detail.locked
      resolveTargets(event.detail.ids).forEach((row) => {
        const targetOverlay = chart.getOverlayById(row.id)
        if (!targetOverlay) return
        chart.overrideOverlay({
          id: row.id,
          extendData: {
            ...(targetOverlay.extendData ?? {}),
            locked,
          },
          lock: locked,
        })
      })
      persistCurrentHorizontalLines()
      persistCurrentTrendLines()
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'select') {
      if (target.kind === 'horizontalLine') {
        if (event.detail.additive === true) {
          toggleSelectedHorizontalLine(target.id)
        } else {
          clearTrendLineSelection()
          setSelectedHorizontalLine(target.id, false)
        }
        publishState({ selected: true })
      } else {
        if (event.detail.additive !== true) clearHorizontalLineSelection()
        if (event.detail.additive !== true) {
          trendLineOverlayIds.forEach((overlayId) => {
            if (overlayId === target.id) return
            const rowOverlay = chart.getOverlayById(overlayId)
            const rowExtendData = rowOverlay?.extendData as TrendLineExtendData | undefined
            if (!rowOverlay || rowExtendData?.selected !== true) return
            chart.overrideOverlay({ id: overlayId, extendData: { ...rowExtendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
          })
        }
        const targetExtendData = overlay.extendData as TrendLineExtendData | undefined
        const nextSelected = event.detail.additive === true && targetExtendData?.selected === true ? false : true
        selectedTrendLineOverlayId = nextSelected ? target.id : null
        if (nextSelected) {
          lastSelectedTrendLineOverlayId = target.id
          lastSelectedTrendLineAt = Date.now()
          activeObjectTreeOverlayId = target.id
        } else if (activeObjectTreeOverlayId === target.id) {
          activeObjectTreeOverlayId = selectedOverlayId ?? null
        }
        chart.overrideOverlay({
          id: target.id,
          extendData: {
            ...targetExtendData,
            selected: nextSelected,
          },
        })
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(targetExtendData?.lineStyle),
          locked: targetExtendData?.locked === true,
          objectId: targetExtendData?.objectId,
          selected: nextSelected,
          showPriceLabel: targetExtendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(targetExtendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(targetExtendData?.trendLineStyle),
        })
      }
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'deselect') {
      if (target.kind === 'horizontalLine') {
        updateOverlayState(target.id, { handlePressed: false, hovered: false, pressed: false, selected: false })
        if (selectedOverlayId === target.id) selectedOverlayId = null
        if (activeObjectTreeOverlayId === target.id) activeObjectTreeOverlayId = selectedTrendLineOverlayId ?? null
        publishState({ selected: false })
      } else {
        const extendData = overlay.extendData as TrendLineExtendData | undefined
        chart.overrideOverlay({ id: target.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
        if (selectedTrendLineOverlayId === target.id) selectedTrendLineOverlayId = null
        if (activeObjectTreeOverlayId === target.id) activeObjectTreeOverlayId = selectedOverlayId ?? null
      }
      publishObjectTreeState()
    }
  }

  const handleVisibilityRangeChanged = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as { key?: string } : {}
    if (detail.key && !isDrawingVisibilityRangeKey(detail.key)) return
    applyHorizontalLineVisibility()
    applyTrendLineVisibility()
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || (!event.key.includes(horizontalLineVisibilityRangeKey) && !event.key.includes(trendLineVisibilityRangeKey))) return
    applyHorizontalLineVisibility()
    applyTrendLineVisibility()
  }

  const handleDataReady = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredTrendLines()
    applyHorizontalLineVisibility()
    applyTrendLineVisibility()
  }

  const handleVisibilityRefresh = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredTrendLines()
    applyHorizontalLineVisibility()
    applyTrendLineVisibility()
  }

  const handleObjectTreeDrawingsRequest = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredTrendLines()
    publishObjectTreeState()
  }

  window.addEventListener(drawingToolCommandEvent, handleCommand)
  window.addEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
  window.addEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
  window.addEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
  window.addEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
  window.addEventListener('storage', handleStorage)
  chart.subscribeAction(ActionType.OnDataReady, handleDataReady)
  return () => {
    destroyed = true
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
    hidePendingTrendStartHandle()
    pendingTrendFirstPointPlaced = false
    window.removeEventListener(drawingToolCommandEvent, handleCommand)
    window.removeEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
    window.removeEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
    window.removeEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
    window.removeEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
    window.removeEventListener('storage', handleStorage)
    chart.unsubscribeAction(ActionType.OnDataReady, handleDataReady)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    paneInteractionCleanups.forEach((cleanup) => cleanup())
  }
}
