import type { Chart } from 'klinecharts'
import type { RulerExtendData } from './chartDrawingTypes'

export function createChartDrawingSelectionRegistry() {
  return {
    activeObjectTreeOverlayId: null as string | null,
    lastSelectedOverlayId: null as string | null,
    lastSelectedTrendLineAt: 0,
    lastSelectedTrendLineOverlayId: null as string | null,
    selectedFibOverlayId: null as string | null,
    selectedFibOverlayIds: new Set<string>(),
    selectedHorizontalLineOverlayIds: new Set<string>(),
    selectedOverlayId: null as string | null,
    selectedRulerOverlayId: null as string | null,
    selectedRulerOverlayIds: new Set<string>(),
    selectedTrendLineOverlayId: null as string | null,
    selectedTrendLineOverlayIds: new Set<string>(),
  }
}

export function clearTwoPointDrawingSelection({
  chart,
  getActiveObjectTreeOverlayId,
  getFallbackActiveObjectTreeOverlayId,
  getPendingOverlayId,
  overlayIds,
  publishObjectTreeState,
  publishToolState,
  selectedOverlayIds,
  getSelectedOverlayId,
  setActiveObjectTreeOverlayId,
  setSelectedOverlayId,
  tool,
}: {
  chart: Chart
  getActiveObjectTreeOverlayId: () => string | null
  getFallbackActiveObjectTreeOverlayId: () => string | null
  getPendingOverlayId: () => string | null
  overlayIds: Set<string>
  publishObjectTreeState: () => void
  publishToolState: (state: { armed: boolean; locked: false; selected: false; showPriceLabel: true; tool: 'fibRetracement' | 'ruler' }) => void
  selectedOverlayIds: Set<string>
  getSelectedOverlayId: () => string | null
  setActiveObjectTreeOverlayId: (id: string | null) => void
  setSelectedOverlayId: (id: string | null) => void
  tool: 'fibRetracement' | 'ruler'
}) {
  let changed = false
  overlayIds.forEach((id) => {
    const overlay = chart.getOverlayById(id)
    if (!overlay) {
      overlayIds.delete(id)
      return
    }
    const extendData = overlay.extendData as RulerExtendData | undefined
    if (!selectedOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
    changed = true
    selectedOverlayIds.delete(id)
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
  if (!changed && !getSelectedOverlayId()) return
  selectedOverlayIds.clear()
  setSelectedOverlayId(null)
  const currentActive = getActiveObjectTreeOverlayId()
  if (currentActive && overlayIds.has(currentActive)) setActiveObjectTreeOverlayId(getFallbackActiveObjectTreeOverlayId())
  publishToolState({
    armed: getPendingOverlayId() != null,
    locked: false,
    selected: false,
    showPriceLabel: true,
    tool,
  })
  publishObjectTreeState()
}
