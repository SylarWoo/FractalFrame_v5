import type { Chart } from 'klinecharts'
import { trendLineOverlayName } from '../drawing/drawingOverlayModel'
import { normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle, trendOverlayStylesFromLine } from './chartDrawingStyle'
import type { MixedDrawingMoveState, TrendLineExtendData } from './chartDrawingTypes'
import { isTwoPointEndpointFigureKey, resolveTwoPointEndpointPressStart, shouldActivateTwoPointEndpointDrag } from './twoPointDrawingInteraction'

export type CreateTrendLineOverlayOptions = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  manualVisible?: boolean
  objectId: string
  paneId: string
  points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
  selected: boolean
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
}

export function createTrendLineOverlayFactory({
  beginMixedDrawingMove,
  chart,
  getMixedDrawingMoveState,
  getPendingTrendLineEndpointPress,
  getPendingTrendLineOverlayId,
  getSelectedTrendLineOverlayId,
  getLastSelectedTrendLineAt,
  getLastSelectedTrendLineOverlayId,
  hidePendingTrendStartHandle,
  moveMixedDrawings,
  persistCurrentHorizontalLines,
  persistCurrentTrendLines,
  publishObjectTreeState,
  resolveTrendPointPrices,
  selectedTrendLineOverlayIds,
  selectTrendLineForInteraction,
  setActiveTrendLine,
  clearRemovedTrendLine,
  setMixedDrawingMoveState,
  setPendingTrendFirstPointPlaced,
  setPendingTrendLineEndpointPress,
  setPendingTrendLineOverlayId,
  setPendingTrendLineOptionsCleared,
  setSelectedTrendLineOverlayId,
  trendLineEndpointDragThreshold,
  trendLineOverlayIds,
  trendLineOverlayZLevel,
  updatePendingTrendStartHandle,
}: {
  beginMixedDrawingMove: (activeId: string, paneId: string, event: { x?: number; y?: number }) => void
  chart: Chart
  getMixedDrawingMoveState: () => MixedDrawingMoveState | null
  getPendingTrendLineEndpointPress: () => { overlayId: string; pointIndex: number; x: number; y: number } | null
  getPendingTrendLineOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  getLastSelectedTrendLineAt: () => number
  getLastSelectedTrendLineOverlayId: () => string | null
  hidePendingTrendStartHandle: () => void
  moveMixedDrawings: (event: { x?: number; y?: number }, activeId: string) => boolean
  persistCurrentHorizontalLines: () => void
  persistCurrentTrendLines: () => void
  publishObjectTreeState: () => void
  resolveTrendPointPrices: (overlay: { points?: Array<{ value?: number }> } | null | undefined) => [number | undefined, number | undefined]
  selectedTrendLineOverlayIds: Set<string>
  selectTrendLineForInteraction: (overlay: { id: string; extendData?: unknown }, additive: boolean, preserveSelection?: boolean) => TrendLineExtendData | undefined
  setActiveTrendLine: (id: string) => void
  clearRemovedTrendLine: (id: string) => void
  setMixedDrawingMoveState: (state: MixedDrawingMoveState | null) => void
  setPendingTrendFirstPointPlaced: (placed: boolean) => void
  setPendingTrendLineEndpointPress: (state: { overlayId: string; pointIndex: number; x: number; y: number } | null) => void
  setPendingTrendLineOverlayId: (id: string | null) => void
  setPendingTrendLineOptionsCleared: () => void
  setSelectedTrendLineOverlayId: (id: string | null) => void
  trendLineEndpointDragThreshold: number
  trendLineOverlayIds: Set<string>
  trendLineOverlayZLevel: number
  updatePendingTrendStartHandle: (overlay: { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> }) => void
}) {
  return function createTrendLineOverlay({
    lineStyle,
    locked,
    manualVisible = true,
    objectId,
    paneId,
    points,
    selected,
    showPriceLabel,
    textStyle,
    trendLineStyle,
  }: CreateTrendLineOverlayOptions) {
    return chart.createOverlay({
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
        if (getPendingTrendLineOverlayId() === overlay.id && currentStep > 1 && Number.isFinite(Number(startPoint?.value))) {
          setPendingTrendFirstPointPlaced(true)
          updatePendingTrendStartHandle(overlay as { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> })
        }
        return false
      },
      onDrawEnd: ({ overlay }) => {
        hidePendingTrendStartHandle()
        setPendingTrendFirstPointPlaced(false)
        setPendingTrendLineOverlayId(null)
        setPendingTrendLineOptionsCleared()
        setActiveTrendLine(overlay.id)
        trendLineOverlayIds.add(overlay.id)
        selectedTrendLineOverlayIds.add(overlay.id)
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
        if (getPendingTrendLineOverlayId() === overlay.id) hidePendingTrendStartHandle()
        if (getPendingTrendLineOverlayId() === overlay.id) setPendingTrendFirstPointPlaced(false)
        if (getPendingTrendLineOverlayId() === overlay.id) setPendingTrendLineOverlayId(null)
        clearRemovedTrendLine(overlay.id)
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
        setActiveTrendLine(overlay.id)
        selectedTrendLineOverlayIds.add(overlay.id)
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined, selected: true } })
        getMixedDrawingMoveState()?.horizontalEntries.forEach((entry) => {
          const horizontalOverlay = chart.getOverlayById(entry.id)
          const horizontalExtendData = horizontalOverlay?.extendData as Record<string, unknown> | undefined
          if (horizontalOverlay) chart.overrideOverlay({ id: entry.id, extendData: { ...horizontalExtendData, handlePressed: false, pressed: false } })
        })
        getMixedDrawingMoveState()?.trendEntries.forEach((entry) => {
          if (entry.id === overlay.id) return
          const trendOverlay = chart.getOverlayById(entry.id)
          const trendExtendData = trendOverlay?.extendData as TrendLineExtendData | undefined
          if (trendOverlay) chart.overrideOverlay({ id: entry.id, extendData: { ...trendExtendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined } })
        })
        setMixedDrawingMoveState(null)
        setPendingTrendLineEndpointPress(null)
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
        const endpointPressed = isTwoPointEndpointFigureKey(event.figureKey)
        const extendData = selectTrendLineForInteraction(overlay, false)
        setPendingTrendLineEndpointPress(resolveTwoPointEndpointPressStart(event))
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
        if (!endpointPressed) beginMixedDrawingMove(overlay.id, overlay.paneId || paneId, event as { x?: number; y?: number })
        publishObjectTreeState()
        return false
      },
      onPressedMoving: (event) => {
        const { overlay } = event
        if (overlay.lock === true || (overlay.extendData as { locked?: boolean } | null)?.locked === true) return true
        const pending = getPendingTrendLineEndpointPress()
        if (shouldActivateTwoPointEndpointDrag({ event, pending, threshold: trendLineEndpointDragThreshold })) {
          const extendData = overlay.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: overlay.id,
            extendData: {
              ...extendData,
              endpointPressed: true,
              pressed: true,
              pressedPointIndex: pending?.pointIndex,
              selected: true,
            },
          })
          setPendingTrendLineEndpointPress(null)
        }
        if (!getMixedDrawingMoveState()) return false
        return moveMixedDrawings(event as { x?: number; y?: number }, overlay.id)
      },
      onSelected: ({ overlay }) => {
        const currentStep = Number((overlay as { currentStep?: number }).currentStep)
        if (getPendingTrendLineOverlayId() === overlay.id && currentStep > 1 && Number.isFinite(Number(overlay.points[0]?.value))) {
          setPendingTrendFirstPointPlaced(true)
          updatePendingTrendStartHandle(overlay as { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> })
          return false
        }
        const extendData = selectTrendLineForInteraction(overlay, false)
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
          getSelectedTrendLineOverlayId() === overlay.id &&
          getLastSelectedTrendLineOverlayId() === overlay.id &&
          Date.now() - getLastSelectedTrendLineAt() < 160
        ) {
          chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
          return false
        }
        if (getSelectedTrendLineOverlayId() === overlay.id) setSelectedTrendLineOverlayId(null)
        selectedTrendLineOverlayIds.delete(overlay.id)
        chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
        publishDrawingToolState({
          armed: getPendingTrendLineOverlayId() != null,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'trendLine',
        })
        publishObjectTreeState()
        return false
      },
    }, paneId)
  }
}
