import type { Chart } from 'klinecharts'
import type { ObjectTreeDrawingItem } from '../rightDrawer/objectTree/objectTreeTypes'
import type { HorizontalLineExtendData, RulerExtendData, TrendLineExtendData } from './chartDrawingTypes'

type DrawingVisibility = {
  manualVisible: boolean
  periodVisible: boolean
  visible: boolean
}

export type DrawingObjectTreeTarget = { id: string; kind: 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'emojiSticker' }

type DrawingObjectTreeStateAdapter = {
  collectItems: () => ObjectTreeDrawingItem[]
  resolveTarget: (treeId: string) => DrawingObjectTreeTarget | null
}

export function collectDrawingObjectTreeState({
  activeObjectTreeOverlayId,
  chart,
  emojiStickerOverlayIds = new Set<string>(),
  fibOverlayIds = new Set<string>(),
  fallbackPaneId,
  horizontalLineOverlayIds,
  pendingTrendLineOverlayId,
  resolveHorizontalLineVisibility,
  resolveFibRetracementVisibility,
  resolveRulerVisibility,
  resolveTrendLineVisibility,
  rulerOverlayIds,
  selectedHorizontalLineOverlayIds,
  selectedRulerOverlayIds,
  selectedFibOverlayIds = new Set<string>(),
  selectedTrendLineOverlayIds,
  selectedTrendLineOverlayId,
  selectedStickerOverlayId,
  trendLineOverlayIds,
}: {
  activeObjectTreeOverlayId: string | null
  chart: Chart
  emojiStickerOverlayIds?: Set<string>
  fibOverlayIds?: Set<string>
  fallbackPaneId: string
  horizontalLineOverlayIds: Set<string>
  pendingTrendLineOverlayId: string | null
  resolveHorizontalLineVisibility: (extendData: HorizontalLineExtendData | undefined) => DrawingVisibility
  resolveFibRetracementVisibility: (extendData: RulerExtendData | undefined) => DrawingVisibility
  resolveRulerVisibility: (extendData: RulerExtendData | undefined) => DrawingVisibility
  resolveTrendLineVisibility: (extendData: TrendLineExtendData | undefined) => DrawingVisibility
  rulerOverlayIds: Set<string>
  selectedHorizontalLineOverlayIds: Set<string>
  selectedRulerOverlayIds: Set<string>
  selectedFibOverlayIds?: Set<string>
  selectedTrendLineOverlayIds: Set<string>
  selectedTrendLineOverlayId: string | null
  selectedStickerOverlayId?: string | null
  trendLineOverlayIds: Set<string>
}) {
  const items = createDrawingObjectTreeStateAdapters({
    chart,
    emojiStickerOverlayIds,
    fibOverlayIds,
    fallbackPaneId,
    horizontalLineOverlayIds,
    pendingTrendLineOverlayId,
    resolveHorizontalLineVisibility,
    resolveFibRetracementVisibility,
    resolveRulerVisibility,
    resolveTrendLineVisibility,
    rulerOverlayIds,
    selectedHorizontalLineOverlayIds,
    selectedRulerOverlayIds,
    selectedFibOverlayIds,
    selectedTrendLineOverlayIds,
    selectedTrendLineOverlayId,
    selectedStickerOverlayId: selectedStickerOverlayId ?? null,
    trendLineOverlayIds,
  }).flatMap((adapter) => adapter.collectItems())
  const activeItem = activeObjectTreeOverlayId
    ? items.find((item) => item.overlayId === activeObjectTreeOverlayId && item.selected)
    : undefined
  return { activeId: activeItem?.id, items }
}

export function resolveDrawingObjectTreeTarget({
  chart,
  horizontalLineOverlayIds,
  fibOverlayIds = new Set(),
  emojiStickerOverlayIds = new Set(),
  treeId,
  trendLineOverlayIds,
  rulerOverlayIds = new Set(),
}: {
  chart: Chart
  emojiStickerOverlayIds?: Set<string>
  horizontalLineOverlayIds: Set<string>
  fibOverlayIds?: Set<string>
  rulerOverlayIds?: Set<string>
  treeId: string
  trendLineOverlayIds: Set<string>
}): DrawingObjectTreeTarget | null {
  return createDrawingObjectTreeStateAdapters({
    chart,
    fibOverlayIds,
    emojiStickerOverlayIds,
    fallbackPaneId: '',
    horizontalLineOverlayIds,
    pendingTrendLineOverlayId: null,
    resolveHorizontalLineVisibility: () => ({ manualVisible: true, periodVisible: true, visible: true }),
    resolveFibRetracementVisibility: () => ({ manualVisible: true, periodVisible: true, visible: true }),
    resolveRulerVisibility: () => ({ manualVisible: true, periodVisible: true, visible: true }),
    resolveTrendLineVisibility: () => ({ manualVisible: true, periodVisible: true, visible: true }),
    rulerOverlayIds,
    selectedHorizontalLineOverlayIds: new Set(),
    selectedRulerOverlayIds: new Set(),
    selectedFibOverlayIds: new Set(),
    selectedTrendLineOverlayIds: new Set(),
    selectedTrendLineOverlayId: null,
    selectedStickerOverlayId: null,
    trendLineOverlayIds,
  }).map((adapter) => adapter.resolveTarget(treeId)).find((target) => target != null) ?? null
}

function createDrawingObjectTreeStateAdapters({
  chart,
  emojiStickerOverlayIds,
  fibOverlayIds,
  fallbackPaneId,
  horizontalLineOverlayIds,
  pendingTrendLineOverlayId,
  resolveHorizontalLineVisibility,
  resolveFibRetracementVisibility,
  resolveRulerVisibility,
  resolveTrendLineVisibility,
  rulerOverlayIds,
  selectedHorizontalLineOverlayIds,
  selectedRulerOverlayIds,
  selectedFibOverlayIds,
  selectedTrendLineOverlayIds,
  selectedTrendLineOverlayId,
  selectedStickerOverlayId,
  trendLineOverlayIds,
}: {
  chart: Chart
  emojiStickerOverlayIds: Set<string>
  fibOverlayIds: Set<string>
  fallbackPaneId: string
  horizontalLineOverlayIds: Set<string>
  pendingTrendLineOverlayId: string | null
  resolveHorizontalLineVisibility: (extendData: HorizontalLineExtendData | undefined) => DrawingVisibility
  resolveFibRetracementVisibility: (extendData: RulerExtendData | undefined) => DrawingVisibility
  resolveRulerVisibility: (extendData: RulerExtendData | undefined) => DrawingVisibility
  resolveTrendLineVisibility: (extendData: TrendLineExtendData | undefined) => DrawingVisibility
  rulerOverlayIds: Set<string>
  selectedHorizontalLineOverlayIds: Set<string>
  selectedRulerOverlayIds: Set<string>
  selectedFibOverlayIds: Set<string>
  selectedTrendLineOverlayIds: Set<string>
  selectedTrendLineOverlayId: string | null
  selectedStickerOverlayId: string | null
  trendLineOverlayIds: Set<string>
}): DrawingObjectTreeStateAdapter[] {
  return [
    {
      collectItems: () => Array.from(emojiStickerOverlayIds)
        .map((id): ObjectTreeDrawingItem | null => {
          const overlay = chart.getOverlayById(id)
          if (!overlay) return null
          const extendData = overlay.extendData as { locked?: boolean; manualVisible?: boolean; objectId?: string; selected?: boolean; symbol?: string } | undefined
          const manualVisible = extendData?.manualVisible !== false
          return {
            id: extendData?.objectId || id,
            kind: 'emojiSticker',
            label: '\u8868\u60c5\u8d34\u7eb8',
            locked: extendData?.locked === true || overlay.lock === true,
            manualVisible,
            overlayId: id,
            paneId: overlay.paneId || fallbackPaneId,
            periodVisible: true,
            selected: selectedStickerOverlayId === id || extendData?.selected === true,
            visible: manualVisible && overlay.visible !== false,
          }
        })
        .filter((item): item is ObjectTreeDrawingItem => item != null),
      resolveTarget: (treeId) => {
        if (emojiStickerOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'emojiSticker' }
        for (const overlayId of emojiStickerOverlayIds) {
          const treeOverlay = chart.getOverlayById(overlayId)
          const extendData = treeOverlay?.extendData as { objectId?: string } | undefined
          if (extendData?.objectId === treeId) return { id: overlayId, kind: 'emojiSticker' }
        }
        return null
      },
    },
    {
      collectItems: () => Array.from(horizontalLineOverlayIds)
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
        .filter((item): item is ObjectTreeDrawingItem => item != null),
      resolveTarget: (treeId) => {
        if (horizontalLineOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'horizontalLine' }
        for (const overlayId of horizontalLineOverlayIds) {
          const treeOverlay = chart.getOverlayById(overlayId)
          const extendData = treeOverlay?.extendData as HorizontalLineExtendData | undefined
          if (extendData?.objectId === treeId) return { id: overlayId, kind: 'horizontalLine' }
        }
        return null
      },
    },
    {
      collectItems: () => Array.from(trendLineOverlayIds)
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
            selected: selectedTrendLineOverlayIds.has(id) || selectedTrendLineOverlayId === id || extendData?.selected === true || extendData?.pressed === true,
            visible: visibility.visible,
          }
        })
        .filter((item): item is ObjectTreeDrawingItem => item != null),
      resolveTarget: (treeId) => {
        if (trendLineOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'trendLine' }
        for (const overlayId of trendLineOverlayIds) {
          const treeOverlay = chart.getOverlayById(overlayId)
          const extendData = treeOverlay?.extendData as TrendLineExtendData | undefined
          if (extendData?.objectId === treeId) return { id: overlayId, kind: 'trendLine' }
        }
        return null
      },
    },
    {
      collectItems: () => Array.from(rulerOverlayIds)
        .map((id): ObjectTreeDrawingItem | null => {
          const overlay = chart.getOverlayById(id)
          if (!overlay) return null
          if (overlay.points.length < 2) return null
          const extendData = overlay.extendData as RulerExtendData | undefined
          const visibility = resolveFibRetracementVisibility(extendData)
          return {
            id: extendData?.objectId || id,
            kind: 'ruler',
            label: '\u6807\u5c3a',
            locked: extendData?.locked === true || overlay.lock === true,
            manualVisible: visibility.manualVisible,
            overlayId: id,
            paneId: overlay.paneId || fallbackPaneId,
            periodVisible: visibility.periodVisible,
            selected: selectedRulerOverlayIds.has(id) || extendData?.selected === true || extendData?.pressed === true,
            visible: visibility.visible,
          }
        })
        .filter((item): item is ObjectTreeDrawingItem => item != null),
      resolveTarget: (treeId) => {
        if (rulerOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'ruler' }
        for (const overlayId of rulerOverlayIds) {
          const treeOverlay = chart.getOverlayById(overlayId)
          const extendData = treeOverlay?.extendData as RulerExtendData | undefined
          if (extendData?.objectId === treeId) return { id: overlayId, kind: 'ruler' }
        }
        return null
      },
    },
    {
      collectItems: () => Array.from(fibOverlayIds)
        .map((id): ObjectTreeDrawingItem | null => {
          const overlay = chart.getOverlayById(id)
          if (!overlay) return null
          if (overlay.points.length < 2) return null
          const extendData = overlay.extendData as RulerExtendData | undefined
          const visibility = resolveRulerVisibility(extendData)
          return {
            id: extendData?.objectId || id,
            kind: 'fibRetracement',
            label: '斐波那契回撤',
            locked: extendData?.locked === true || overlay.lock === true,
            manualVisible: visibility.manualVisible,
            overlayId: id,
            paneId: overlay.paneId || fallbackPaneId,
            periodVisible: visibility.periodVisible,
            selected: selectedFibOverlayIds.has(id) || extendData?.selected === true || extendData?.pressed === true,
            visible: visibility.visible,
          }
        })
        .filter((item): item is ObjectTreeDrawingItem => item != null),
      resolveTarget: (treeId) => {
        if (fibOverlayIds.has(treeId) && chart.getOverlayById(treeId)) return { id: treeId, kind: 'fibRetracement' }
        for (const overlayId of fibOverlayIds) {
          const treeOverlay = chart.getOverlayById(overlayId)
          const extendData = treeOverlay?.extendData as RulerExtendData | undefined
          if (extendData?.objectId === treeId) return { id: overlayId, kind: 'fibRetracement' }
        }
        return null
      },
    },
  ]
}
