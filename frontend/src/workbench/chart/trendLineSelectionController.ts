import type { Chart } from 'klinecharts'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import type { TrendLineExtendData } from './chartDrawingTypes'

export function createTrendLineSelectionController({
  chart,
  clearHorizontalLineSelection,
  getLastSelectedTrendLineAt,
  getLastSelectedTrendLineOverlayId,
  getPendingTrendLineOverlayId,
  getSelectedTrendLineOverlayId,
  publishObjectTreeState,
  setActiveTrendLine,
  setLastSelectedTrendLineOverlayId,
  setSelectedTrendLineOverlayId,
  trendLineOverlayIds,
}: {
  chart: Chart
  clearHorizontalLineSelection: () => void
  getLastSelectedTrendLineAt: () => number
  getLastSelectedTrendLineOverlayId: () => string | null
  getPendingTrendLineOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  publishObjectTreeState: () => void
  setActiveTrendLine: (id: string) => void
  setLastSelectedTrendLineOverlayId: (id: string | null) => void
  setSelectedTrendLineOverlayId: (id: string | null) => void
  trendLineOverlayIds: Set<string>
}) {
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
    if (!changed && !getSelectedTrendLineOverlayId()) return
    setSelectedTrendLineOverlayId(null)
    publishDrawingToolState({
      armed: getPendingTrendLineOverlayId() != null,
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
    setActiveTrendLine(overlay.id)
    chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
    return extendData
  }

  const resolveSelectedTrendLineOverlayId = () => {
    const selectedTrendLineOverlayId = getSelectedTrendLineOverlayId()
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
    const lastSelectedTrendLineOverlayId = getLastSelectedTrendLineOverlayId()
    if (lastSelectedTrendLineOverlayId && Date.now() - getLastSelectedTrendLineAt() < 800 && chart.getOverlayById(lastSelectedTrendLineOverlayId)) {
      return lastSelectedTrendLineOverlayId
    }
    return null
  }

  const clearLastSelectedTrendLine = () => {
    setLastSelectedTrendLineOverlayId(null)
  }

  return {
    clearLastSelectedTrendLine,
    clearOtherTrendLineSelections,
    clearTrendLineSelection,
    resolveDeletableTrendLineOverlayId,
    resolveSelectedTrendLineOverlayId,
    selectTrendLineForInteraction,
  }
}
