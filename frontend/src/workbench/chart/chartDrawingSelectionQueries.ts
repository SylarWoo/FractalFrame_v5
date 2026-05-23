import type { Chart } from 'klinecharts'
import type { TrendLineExtendData } from './chartDrawingTypes'

export function getSelectedHorizontalLineIds(horizontalLineOverlayIds: Set<string>, selectedHorizontalLineOverlayIds: Set<string>) {
  return Array.from(horizontalLineOverlayIds).filter((id) => selectedHorizontalLineOverlayIds.has(id))
}

export function getSelectedTrendLineIds({
  chart,
  pendingTrendLineOverlayId,
  trendLineOverlayIds,
}: {
  chart: Chart
  pendingTrendLineOverlayId: string | null
  trendLineOverlayIds: Set<string>
}) {
  return Array.from(trendLineOverlayIds).filter((id) => {
    const overlay = chart.getOverlayById(id)
    const extendData = overlay?.extendData as TrendLineExtendData | undefined
    return overlay != null && overlay.id !== pendingTrendLineOverlayId && (extendData?.selected === true || extendData?.pressed === true)
  })
}

export function getSelectedDrawingCount({
  chart,
  horizontalLineOverlayIds,
  pendingTrendLineOverlayId,
  selectedHorizontalLineOverlayIds,
  trendLineOverlayIds,
}: {
  chart: Chart
  horizontalLineOverlayIds: Set<string>
  pendingTrendLineOverlayId: string | null
  selectedHorizontalLineOverlayIds: Set<string>
  trendLineOverlayIds: Set<string>
}) {
  return getSelectedHorizontalLineIds(horizontalLineOverlayIds, selectedHorizontalLineOverlayIds).length +
    getSelectedTrendLineIds({ chart, pendingTrendLineOverlayId, trendLineOverlayIds }).length
}
