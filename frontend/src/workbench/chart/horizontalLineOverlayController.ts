import type { Chart } from 'klinecharts'
import { horizontalLineOverlayName } from '../drawing/drawingOverlayModel'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle, overlayStylesFromLine } from './chartDrawingStyle'
import type { MixedDrawingMoveState, TrendLineExtendData } from './chartDrawingTypes'
import type { PressedHorizontalLineMoveState } from './chartDrawingMoveController'

export type CreateHorizontalLineOverlayOptions = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  manualVisible?: boolean
  objectId: string
  paneId: string
  points?: Array<{ value: number }>
  selected: boolean
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
}

export function createHorizontalLineOverlayFactory({
  beginPressedMove,
  chart,
  getAdditiveSelectionActive,
  getHorizontalLineVisible,
  getMixedDrawingMoveState,
  getPendingHorizontalLineHandlePress,
  getPressedMoveState,
  getSelectedDrawingCount,
  horizontalLineHandleDragThreshold,
  horizontalLineOverlayIds,
  moveMixedDrawings,
  moveSelectedHorizontalLines,
  persistCurrentHorizontalLines,
  persistCurrentTrendLines,
  publishObjectTreeState,
  publishState,
  clearDeselectedHorizontalLine,
  clearRemovedHorizontalLine,
  selectedHorizontalLineOverlayIds,
  setActiveHorizontalLine,
  setMixedDrawingMoveState,
  setPendingHorizontalLineHandlePress,
  setPendingOverlayCleared,
  setPressedMoveState,
  setSelectedHorizontalLine,
  updateOverlayState,
}: {
  beginPressedMove: (overlayId: string, event: { x?: number; y?: number }) => void
  chart: Chart
  getAdditiveSelectionActive: () => boolean
  getHorizontalLineVisible: () => boolean
  getMixedDrawingMoveState: () => MixedDrawingMoveState | null
  getPendingHorizontalLineHandlePress: () => { overlayId: string; x: number; y: number } | null
  getPressedMoveState: () => PressedHorizontalLineMoveState | null
  getSelectedDrawingCount: () => number
  horizontalLineHandleDragThreshold: number
  horizontalLineOverlayIds: Set<string>
  moveMixedDrawings: (event: { x?: number; y?: number }, activeId: string) => boolean
  moveSelectedHorizontalLines: (event: { x?: number; y?: number }, overlayId: string) => boolean
  persistCurrentHorizontalLines: () => void
  persistCurrentTrendLines: () => void
  publishObjectTreeState: () => void
  publishState: (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => void
  clearDeselectedHorizontalLine: (id: string) => void
  clearRemovedHorizontalLine: (id: string) => void
  selectedHorizontalLineOverlayIds: Set<string>
  setActiveHorizontalLine: (id: string | null) => void
  setMixedDrawingMoveState: (state: MixedDrawingMoveState | null) => void
  setPendingHorizontalLineHandlePress: (state: { overlayId: string; x: number; y: number } | null) => void
  setPendingOverlayCleared: () => void
  setPressedMoveState: (state: PressedHorizontalLineMoveState | null) => void
  setSelectedHorizontalLine: (id: string, additive: boolean) => void
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  return function createHorizontalLineOverlay({
    lineStyle,
    locked,
    manualVisible = true,
    objectId,
    paneId,
    points,
    selected,
    showPriceLabel,
    textStyle,
  }: CreateHorizontalLineOverlayOptions) {
    return chart.createOverlay({
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
      visible: getHorizontalLineVisible() && manualVisible,
      onDrawEnd: ({ overlay }) => {
        setPendingOverlayCleared()
        setActiveHorizontalLine(overlay.id)
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
        clearRemovedHorizontalLine(overlay.id)
        persistCurrentHorizontalLines()
        publishState({ selected: false })
        publishObjectTreeState()
        return false
      },
      onDeselected: ({ overlay }) => {
        if (getAdditiveSelectionActive()) return false
        if (overlay.visible === false) return false
        updateOverlayState(overlay.id, { selected: false })
        clearDeselectedHorizontalLine(overlay.id)
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
        const movedIds = getMixedDrawingMoveState()?.horizontalEntries.map((entry) => entry.id) ?? getPressedMoveState()?.entries.map((entry) => entry.id) ?? [overlay.id]
        movedIds.forEach((id) => updateOverlayState(id, { handlePressed: false, pressed: false }))
        getMixedDrawingMoveState()?.trendEntries.forEach((entry) => {
          const trendOverlay = chart.getOverlayById(entry.id)
          const trendExtendData = trendOverlay?.extendData as TrendLineExtendData | undefined
          if (trendOverlay) chart.overrideOverlay({ id: entry.id, extendData: { ...trendExtendData, endpointPressed: false, pressed: false, pressedPointIndex: undefined } })
        })
        setPressedMoveState(null)
        setMixedDrawingMoveState(null)
        setPendingHorizontalLineHandlePress(null)
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
        setPendingHorizontalLineHandlePress(handlePressed
          ? { overlayId: overlay.id, x: Number(event.x), y: Number(event.y) }
          : null)
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
        const pendingHandle = getPendingHorizontalLineHandlePress()
        if (pendingHandle?.overlayId === overlay.id) {
          const distance = Math.hypot(Number(event.x) - pendingHandle.x, Number(event.y) - pendingHandle.y)
          if (Number.isFinite(distance) && distance >= horizontalLineHandleDragThreshold) {
            updateOverlayState(overlay.id, { handlePressed: true })
            setPendingHorizontalLineHandlePress(null)
          }
        }
        if (moveMixedDrawings(event as { x?: number; y?: number }, overlay.id)) return true
        return moveSelectedHorizontalLines(event as { x?: number; y?: number }, overlay.id)
      },
      onSelected: ({ overlay }) => {
        if (selectedHorizontalLineOverlayIds.has(overlay.id) && getSelectedDrawingCount() > 1) {
          setActiveHorizontalLine(overlay.id)
        } else {
          setSelectedHorizontalLine(overlay.id, getAdditiveSelectionActive())
        }
        publishState({
          locked: Boolean((overlay.extendData as { locked?: boolean } | null)?.locked),
          selected: true,
        })
        publishObjectTreeState()
        return false
      },
    }, paneId)
  }

}
