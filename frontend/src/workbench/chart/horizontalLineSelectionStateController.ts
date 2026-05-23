import type { Chart } from 'klinecharts'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import type { HorizontalLineExtendData } from './chartDrawingTypes'

export function createHorizontalLineSelectionStateController({
  chart,
  getLastSelectedOverlayId,
  getSelectedOverlayId,
  horizontalLineOverlayIds,
  publishObjectTreeState,
  publishState,
  selectedHorizontalLineOverlayIds,
  setSelectedOverlayId,
  updateOverlayState,
}: {
  chart: Chart
  getLastSelectedOverlayId: () => string | null
  getSelectedOverlayId: () => string | null
  horizontalLineOverlayIds: Set<string>
  publishObjectTreeState: () => void
  publishState: (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => void
  selectedHorizontalLineOverlayIds: Set<string>
  setSelectedOverlayId: (id: string | null) => void
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  const resolveDeleteTargetOverlayId = () => {
    const selectedOverlayId = getSelectedOverlayId()
    if (selectedOverlayId && chart.getOverlayById(selectedOverlayId)) return selectedOverlayId
    const lastSelectedOverlayId = getLastSelectedOverlayId()
    if (lastSelectedOverlayId && chart.getOverlayById(lastSelectedOverlayId)) return lastSelectedOverlayId
    return null
  }

  const resolveSelectedOverlayId = () => {
    const selectedOverlayId = getSelectedOverlayId()
    if (selectedOverlayId) {
      if (selectedHorizontalLineOverlayIds.has(selectedOverlayId)) return selectedOverlayId
    }
    const lastSelectedOverlayId = getLastSelectedOverlayId()
    if (!lastSelectedOverlayId) return null
    if (selectedHorizontalLineOverlayIds.has(lastSelectedOverlayId)) return lastSelectedOverlayId
    return selectedHorizontalLineOverlayIds.values().next().value ?? null
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
    if (!changed && !getSelectedOverlayId()) return
    setSelectedOverlayId(null)
    selectedHorizontalLineOverlayIds.clear()
    publishState({ selected: false })
    publishObjectTreeState()
  }

  return {
    clearHorizontalLineSelection,
    resolveDeleteTargetOverlayId,
    resolveEditableOverlayId: resolveSelectedOverlayId,
    resolveSelectedOverlayId,
  }
}
