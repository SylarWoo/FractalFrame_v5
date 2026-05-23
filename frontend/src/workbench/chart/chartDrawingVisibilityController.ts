import type { Chart } from 'klinecharts'
import {
  horizontalLineObjectVisibilityRangeKey,
  horizontalLineVisibilityRangeKey,
  isDrawingVisibilityRangeKey,
  rulerObjectVisibilityRangeKey,
  rulerVisibilityRangeKey,
  trendLineObjectVisibilityRangeKey,
  trendLineVisibilityRangeKey,
} from '../drawing/drawingOverlayModel'
import {
  isStoredVisibilityRangePeriodVisible,
  restoreVisibilityRangeCurrentPeriod,
} from '../visibilityRange/visibilityRangeModel'
import type { HorizontalLineExtendData, RulerExtendData, TrendLineExtendData } from './chartDrawingTypes'

export type DrawingVisibilityState = {
  manualVisible: boolean
  periodVisible: boolean
  visible: boolean
}

export function createChartDrawingVisibilityController({
  chart,
  getPeriod,
  getSelectedOverlayId,
  getSelectedRulerOverlayId,
  getSelectedTrendLineOverlayId,
  horizontalLineOverlayIds,
  publishHorizontalLineState,
  publishObjectTreeState,
  rulerOverlayIds,
  selectedHorizontalLineOverlayIds,
  selectedRulerOverlayIds,
  trendLineOverlayIds,
  updateOverlayState,
}: {
  chart: Chart
  getPeriod: () => string
  getSelectedOverlayId: () => string | null
  getSelectedRulerOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  horizontalLineOverlayIds: Set<string>
  publishHorizontalLineState: (state?: Partial<{ selected: boolean }>) => void
  publishObjectTreeState: () => void
  rulerOverlayIds: Set<string>
  selectedHorizontalLineOverlayIds: Set<string>
  selectedRulerOverlayIds: Set<string>
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

  const isRulerVisibleInCurrentPeriod = (objectId?: string) => (
    isStoredVisibilityRangePeriodVisible(rulerObjectVisibilityRangeKey(objectId), getPeriod())
  )

  const restoreCurrentPeriodVisibility = (key: string | undefined) => {
    restoreVisibilityRangeCurrentPeriod(key, getPeriod())
  }

  const restoreObjectCurrentPeriodVisibility = (kind: 'horizontalLine' | 'trendLine' | 'ruler', objectId?: string) => {
    restoreCurrentPeriodVisibility(kind === 'horizontalLine'
      ? horizontalLineObjectVisibilityRangeKey(objectId)
      : kind === 'trendLine'
        ? trendLineObjectVisibilityRangeKey(objectId)
        : rulerObjectVisibilityRangeKey(objectId))
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

  const resolveRulerVisibility = (extendData: RulerExtendData | undefined): DrawingVisibilityState => {
    const manualVisible = extendData?.manualVisible !== false
    const periodVisible = isRulerVisibleInCurrentPeriod(extendData?.objectId)
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

  const applyRulerVisibility = () => {
    rulerOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as RulerExtendData | undefined
      const { manualVisible, periodVisible, visible } = resolveRulerVisibility(extendData)
      const selected = selectedRulerOverlayIds.has(id) || getSelectedRulerOverlayId() === id || extendData?.selected === true
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
    applyRulerVisibility()
  }

  const handleVisibilityRangeChanged = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as { key?: string } : {}
    if (detail.key && !isDrawingVisibilityRangeKey(detail.key)) return
    applyDrawingVisibility()
  }

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || (!event.key.includes(horizontalLineVisibilityRangeKey) && !event.key.includes(trendLineVisibilityRangeKey) && !event.key.includes(rulerVisibilityRangeKey))) return
    applyDrawingVisibility()
  }

  return {
    applyDrawingVisibility,
    applyHorizontalLineVisibility,
    applyRulerVisibility,
    applyTrendLineVisibility,
    getHorizontalLineVisible: () => horizontalLineVisible,
    handleStorage,
    handleVisibilityRangeChanged,
    isHorizontalLineVisibleInCurrentPeriod,
    isRulerVisibleInCurrentPeriod,
    isTrendLineVisibleInCurrentPeriod,
    resolveHorizontalLineVisibility,
    resolveRulerVisibility,
    resolveTrendLineVisibility,
    restoreCurrentPeriodVisibility,
    restoreObjectCurrentPeriodVisibility,
  }
}
