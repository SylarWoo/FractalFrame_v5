import type { Chart } from 'klinecharts'
import { publishObjectTreeDrawings } from '../rightDrawer/objectTree/objectTreeModel'
import { collectDrawingObjectTreeState } from './chartDrawingObjectTreeState'
import type { HorizontalLineExtendData, RulerExtendData, TrendLineExtendData } from './chartDrawingTypes'

type DrawingVisibility = {
  manualVisible: boolean
  periodVisible: boolean
  visible: boolean
}

export function createChartDrawingObjectTreePublisher({
  chart,
  emojiStickerOverlayIds,
  fallbackPaneId,
  fibOverlayIds,
  getActiveObjectTreeOverlayId,
  getPendingTrendLineOverlayId,
  getSelectedStickerOverlayId,
  getSelectedTrendLineOverlayId,
  horizontalLineOverlayIds,
  resolveFibRetracementVisibility,
  resolveHorizontalLineVisibility,
  resolveRulerVisibility,
  resolveTrendLineVisibility,
  rulerOverlayIds,
  selectedFibOverlayIds,
  selectedHorizontalLineOverlayIds,
  selectedRulerOverlayIds,
  selectedTrendLineOverlayIds,
  trendLineOverlayIds,
}: {
  chart: Chart
  emojiStickerOverlayIds: () => Set<string>
  fallbackPaneId: string
  fibOverlayIds: Set<string>
  getActiveObjectTreeOverlayId: () => string | null
  getPendingTrendLineOverlayId: () => string | null
  getSelectedStickerOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  horizontalLineOverlayIds: Set<string>
  resolveFibRetracementVisibility: (extendData: RulerExtendData | undefined) => DrawingVisibility
  resolveHorizontalLineVisibility: (extendData: HorizontalLineExtendData | undefined) => DrawingVisibility
  resolveRulerVisibility: (extendData: RulerExtendData | undefined) => DrawingVisibility
  resolveTrendLineVisibility: (extendData: TrendLineExtendData | undefined) => DrawingVisibility
  rulerOverlayIds: Set<string>
  selectedFibOverlayIds: Set<string>
  selectedHorizontalLineOverlayIds: Set<string>
  selectedRulerOverlayIds: Set<string>
  selectedTrendLineOverlayIds: Set<string>
  trendLineOverlayIds: Set<string>
}) {
  return function publishObjectTreeState() {
    const state = collectDrawingObjectTreeState({
      activeObjectTreeOverlayId: getActiveObjectTreeOverlayId(),
      chart,
      emojiStickerOverlayIds: emojiStickerOverlayIds(),
      fallbackPaneId,
      fibOverlayIds,
      horizontalLineOverlayIds,
      pendingTrendLineOverlayId: getPendingTrendLineOverlayId(),
      resolveFibRetracementVisibility,
      resolveHorizontalLineVisibility,
      resolveRulerVisibility,
      resolveTrendLineVisibility,
      rulerOverlayIds,
      selectedFibOverlayIds,
      selectedHorizontalLineOverlayIds,
      selectedRulerOverlayIds,
      selectedStickerOverlayId: getSelectedStickerOverlayId(),
      selectedTrendLineOverlayId: getSelectedTrendLineOverlayId(),
      selectedTrendLineOverlayIds,
      trendLineOverlayIds,
    })
    publishObjectTreeDrawings(state.items, state.activeId)
  }
}
