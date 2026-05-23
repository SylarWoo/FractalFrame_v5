import type { Chart } from 'klinecharts'
import {
  horizontalLineObjectVisibilityRangeKey,
  horizontalLineVisibilityRangeKey,
  isDrawingVisibilityRangeKey,
  trendLineObjectVisibilityRangeKey,
  trendLineVisibilityRangeKey,
} from '../drawing/drawingOverlayModel'
import {
  isStoredVisibilityRangePeriodVisible,
  restoreVisibilityRangeCurrentPeriod,
} from '../visibilityRange/visibilityRangeModel'
import type { HorizontalLineExtendData, TrendLineExtendData } from './chartDrawingTypes'

export type DrawingVisibilityState = {
  manualVisible: boolean
  periodVisible: boolean
  visible: boolean
}

export function createChartDrawingVisibilityController({
  chart,
  getPeriod,
  getSelectedOverlayId,
  getSelectedTrendLineOverlayId,
  horizontalLineOverlayIds,
  publishHorizontalLineState,
  publishObjectTreeState,
  selectedHorizontalLineOverlayIds,
  trendLineOverlayIds,
  updateOverlayState,
}: {
  chart: Chart
  getPeriod: () => string
  getSelectedOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  horizontalLineOverlayIds: Set<string>
  publishHorizontalLineState: (state?: Partial<{ selected: boolean }>) => void
  publishObjectTreeState: () => void
  selectedHorizontalLineOverlayIds: Set<string>
  trendLineOverlayIds: Set<string>
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  let horizontalLineVisible = true

  const isHorizontalLineVisibleInCurrentPeriod = (objectId?: string) => (
    isStoredVisibilityRangePeriodVisible(horizontalLineObjectVisibilityRangeKey(objectId), getPeriod())
  )

  const isTrendLineVisibleInCurrentPeriod = (objectId?: string) => (
    isStoredVisibilityRangePeriodVisible(trendLineObjectVisibilityRangeKey(objectId), getPeriod())
  )

  const restoreCurrentPeriodVisibility = (key: string | undefined) => {
    restoreVisibilityRangeCurrentPeriod(key, getPeriod())
  }

  const restoreObjectCurrentPeriodVisibility = (kind: 'horizontalLine' | 'trendLine', objectId?: string) => {
    restoreCurrentPeriodVisibility(kind === 'horizontalLine'
      ? horizontalLineObjectVisibilityRangeKey(objectId)
      : trendLineObjectVisibilityRangeKey(objectId))
  }

  const resolveHorizontalLineVisibility = (extendData: HorizontalLineExtendData | undefined): DrawingVisibilityState => {
    const manualVisible = extendData?.manualVisible !== false
    const periodVisible = isHorizontalLineVisibleInCurrentPeriod(extendData?.objectId)
    return {
      manualVisible,
      periodVisible,
      visible: manualVisible && periodVisible,
    }
  }

  const resolveTrendLineVisibility = (extendData: TrendLineExtendData | undefined): DrawingVisibilityState => {
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
    if (!getSelectedOverlayId()) publishHorizontalLineState({ selected: false })
    publishObjectTreeState()
  }

  const applyTrendLineVisibility = () => {
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      const { manualVisible, periodVisible, visible } = resolveTrendLineVisibility(extendData)
      const selected = getSelectedTrendLineOverlayId() === id || extendData?.selected === true
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

  const applyDrawingVisibility = () => {
    applyHorizontalLineVisibility()
    applyTrendLineVisibility()
  }

  const handleVisibilityRangeChanged = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as { key?: string } : {}
    if (detail.key && !isDrawingVisibilityRangeKey(detail.key)) return
    applyDrawingVisibility()
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || (!event.key.includes(horizontalLineVisibilityRangeKey) && !event.key.includes(trendLineVisibilityRangeKey))) return
    applyDrawingVisibility()
  }

  return {
    applyDrawingVisibility,
    applyHorizontalLineVisibility,
    applyTrendLineVisibility,
    getHorizontalLineVisible: () => horizontalLineVisible,
    handleStorage,
    handleVisibilityRangeChanged,
    isHorizontalLineVisibleInCurrentPeriod,
    isTrendLineVisibleInCurrentPeriod,
    resolveHorizontalLineVisibility,
    resolveTrendLineVisibility,
    restoreCurrentPeriodVisibility,
    restoreObjectCurrentPeriodVisibility,
  }
}
