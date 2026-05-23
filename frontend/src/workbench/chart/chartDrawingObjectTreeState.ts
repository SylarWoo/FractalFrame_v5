import type { Chart } from 'klinecharts'
import type { ObjectTreeDrawingItem } from '../rightDrawer/objectTree/objectTreeTypes'
import type { HorizontalLineExtendData, TrendLineExtendData } from './chartDrawingTypes'

type DrawingVisibility = {
  manualVisible: boolean
  periodVisible: boolean
  visible: boolean
}

export function collectDrawingObjectTreeState({
  activeObjectTreeOverlayId,
  chart,
  fallbackPaneId,
  horizontalLineOverlayIds,
  pendingTrendLineOverlayId,
  resolveHorizontalLineVisibility,
  resolveTrendLineVisibility,
  selectedHorizontalLineOverlayIds,
  selectedTrendLineOverlayId,
  trendLineOverlayIds,
}: {
  activeObjectTreeOverlayId: string | null
  chart: Chart
  fallbackPaneId: string
  horizontalLineOverlayIds: Set<string>
  pendingTrendLineOverlayId: string | null
  resolveHorizontalLineVisibility: (extendData: HorizontalLineExtendData | undefined) => DrawingVisibility
  resolveTrendLineVisibility: (extendData: TrendLineExtendData | undefined) => DrawingVisibility
  selectedHorizontalLineOverlayIds: Set<string>
  selectedTrendLineOverlayId: string | null
  trendLineOverlayIds: Set<string>
}) {
  const horizontalItems = Array.from(horizontalLineOverlayIds)
    .map((id): ObjectTreeDrawingItem | null => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return null
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      const visibility = resolveHorizontalLineVisibility(extendData)
      return {
        id: extendData?.objectId || id,
        kind: 'horizontalLine',
        label: '\u6c34\u5e73\u7ebf',
        locked: extendData?.locked === true || overlay.lock === true,
        manualVisible: visibility.manualVisible,
        overlayId: id,
        paneId: overlay.paneId || fallbackPaneId,
        periodVisible: visibility.periodVisible,
        selected: selectedHorizontalLineOverlayIds.has(id),
        visible: visibility.visible,
      }
    })
    .filter((item): item is ObjectTreeDrawingItem => item != null)
  const trendItems = Array.from(trendLineOverlayIds)
    .map((id): ObjectTreeDrawingItem | null => {
      if (id === pendingTrendLineOverlayId) return null
      const overlay = chart.getOverlayById(id)
      if (!overlay) return null
      if (overlay.points.length < 2) return null
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      const visibility = resolveTrendLineVisibility(extendData)
      return {
        id: extendData?.objectId || id,
        kind: 'trendLine',
        label: '\u8d8b\u52bf\u7ebf',
        locked: extendData?.locked === true || overlay.lock === true,
        manualVisible: visibility.manualVisible,
        overlayId: id,
        paneId: overlay.paneId || fallbackPaneId,
        periodVisible: visibility.periodVisible,
        selected: selectedTrendLineOverlayId === id || extendData?.selected === true || extendData?.pressed === true,
        visible: visibility.visible,
      }
    })
    .filter((item): item is ObjectTreeDrawingItem => item != null)
  const items = [...horizontalItems, ...trendItems]
  const activeItem = activeObjectTreeOverlayId
    ? items.find((item) => item.overlayId === activeObjectTreeOverlayId && item.selected)
    : undefined
  return { activeId: activeItem?.id, items }
}

export type DrawingObjectTreeTarget = { id: string; kind: 'horizontalLine' | 'trendLine' }

export function resolveDrawingObjectTreeTarget({
  chart,
  horizontalLineOverlayIds,
  treeId,
  trendLineOverlayIds,
}: {
  chart: Chart
  horizontalLineOverlayIds: Set<string>
  treeId: string
  trendLineOverlayIds: Set<string>
}): DrawingObjectTreeTarget | null {
  if (horizontalLineOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'horizontalLine' }
  for (const overlayId of horizontalLineOverlayIds) {
    const treeOverlay = chart.getOverlayById(overlayId)
    const extendData = treeOverlay?.extendData as HorizontalLineExtendData | undefined
    if (extendData?.objectId === treeId) return { id: overlayId, kind: 'horizontalLine' }
  }
  if (trendLineOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'trendLine' }
  for (const overlayId of trendLineOverlayIds) {
    const treeOverlay = chart.getOverlayById(overlayId)
    const extendData = treeOverlay?.extendData as TrendLineExtendData | undefined
    if (extendData?.objectId === treeId) return { id: overlayId, kind: 'trendLine' }
  }
  return null
}
