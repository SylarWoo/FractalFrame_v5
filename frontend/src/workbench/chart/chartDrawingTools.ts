import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingMainPaneId } from '../drawing/drawingPaneModel'
import {
  fibRetracementOverlayName,
} from '../drawing/drawingOverlayModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { publishDrawingToolState, type DrawingToolCommand } from '../rightDrawer/drawingToolCommands'
import { isObjectTreeDrawingCommandEvent } from '../rightDrawer/objectTree/objectTreeModel'
import {
  normalizeDrawingTextStyle,
} from '../rightDrawer/drawingPersistence'
import { readQuickMeasureEnabled } from '../rightDrawer/quickMeasurePersistence'
import { horizontalLineDrawingsStorageKey, trendLineDrawingsStorageKey } from '../rightDrawer/drawingObjectPersistence'
import { ensurePersistentStateChangeListener, invalidateJsonState, persistentStateChangedEvent } from '../persistence/jsonStorage'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { createDrawingObjectTreeCommandHandler } from './chartDrawingObjectTreeCommands'
import { createChartDrawingMoveController, type PressedHorizontalLineMoveState } from './chartDrawingMoveController'
import { createHorizontalLineSelectionController } from './chartDrawingSelectionController'
import {
  createHorizontalLineObjectId,
  createFibRetracementObjectId,
  createRulerObjectId,
  createTrendLineObjectId,
} from './chartDrawingObjectIds'
import { createChartDrawingPersistenceController, readInitialStoredDrawingState } from './chartDrawingPersistenceController'
import { createChartDrawingPersistenceBridge } from './chartDrawingPersistenceBridge'
import { createChartDrawingObjectTreePublisher } from './chartDrawingObjectTreeBridge'
import { clearTwoPointDrawingSelection, createChartDrawingSelectionRegistry } from './chartDrawingSelectionRegistry'
import { createChartDrawingVisibilityController } from './chartDrawingVisibilityController'
import { createChartDrawingPaneInteractionController } from './chartDrawingPaneInteractionController'
import { createTrendLineSelectionController } from './trendLineSelectionController'
import { createHorizontalLineSelectionStateController } from './horizontalLineSelectionStateController'
import {
  getSelectedHorizontalLineIds as getSelectedHorizontalLineIdsFromState,
  getSelectedTrendLineIds as getSelectedTrendLineIdsFromState,
} from './chartDrawingSelectionQueries'
import type {
  HorizontalLineExtendData,
  MixedDrawingMoveState,
  RulerExtendData,
  TrendLineExtendData,
} from './chartDrawingTypes'
import { normalizeLineStyle } from './chartDrawingStyle'
import { createHorizontalLineOverlayFactory } from './horizontalLineOverlayController'
import { createTrendLineOverlayFactory } from './trendLineOverlayController'
import { createRulerOverlayFactory, type PendingRulerOptions } from './rulerOverlayController'
import { createQuickMeasureController } from './quickMeasureOverlay'
import { createMorganRangeController } from './morganRangeOverlay'
import { createChartSymbolMarkerController } from './chartSymbolMarkerOverlay'
import { createChartDrawingHitTester } from './chartDrawingHitTesting'
import { createTrendLinePendingStartHandleController } from './trendLinePendingStartHandle'
import { installChartDrawingLifecycle } from './chartDrawingLifecycle'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingVisibilityEvents'
import { ensureChartDrawingOverlays } from './chartDrawingOverlayRegistry'
import { routeChartDrawingCommand } from './chartDrawingCommandRouter'
import { installHorizontalLineDrawingTool } from './chartDrawingHorizontalInstaller'
import { installTrendLineDrawingTool } from './chartDrawingTrendInstaller'
import { installRulerDrawingTool } from './chartDrawingRulerInstaller'
import { installFibRetracementDrawingTool } from './chartDrawingFibInstaller'
import { installStickerDrawingTool } from './chartDrawingStickerInstaller'

const candlePaneId = drawingMainPaneId
const trendLineOverlayZLevel = -1
export { chartDrawingVisibilityRefreshEvent }
const horizontalLineHandleDragThreshold = 3
const trendLineEndpointDragThreshold = 3

export function installChartDrawingTools(chart: Chart, getPeriod: () => string = () => '') {
  ensureChartDrawingOverlays()
  const selection = createChartDrawingSelectionRegistry()
  const horizontalLineOverlayIds = new Set<string>()
  const trendLineOverlayIds = new Set<string>()
  const rulerOverlayIds = new Set<string>()
  const fibOverlayIds = new Set<string>()
  const initialStoredDrawings = readInitialStoredDrawingState()
  let pressedMoveState: PressedHorizontalLineMoveState | null = null
  let mixedDrawingMoveState: MixedDrawingMoveState | null = null
  let pendingHorizontalLineHandlePress: { overlayId: string; x: number; y: number } | null = null
  let pendingTrendLineEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  let destroyed = false

  const publishState = (state?: Partial<{ armed: boolean; crossPeriod: boolean; crossPeriodTargets: string[]; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; sourcePeriod: string; textStyle: DrawingTextStyle }>) => {
    const stateSelected = state?.selected
    const fallbackOverlayId = stateSelected !== false ? resolveSelectedOverlayId() : null
    const primaryOverlay = selection.selectedOverlayId ? chart.getOverlayById(selection.selectedOverlayId) : null
    const fallbackOverlay = fallbackOverlayId ? chart.getOverlayById(fallbackOverlayId) : null
    const selectedOverlay = primaryOverlay ?? fallbackOverlay
    if (selectedOverlay) selection.selectedOverlayId = selectedOverlay.id
    const selectedExtendData = selectedOverlay?.extendData as HorizontalLineExtendData | null
    const selectedPrice = Number(selectedOverlay?.points[0]?.value)
    publishDrawingToolState({
      armed: horizontalLineTool?.getPendingOverlayId() != null,
      crossPeriod: selectedExtendData?.crossPeriod === true,
      crossPeriodTargets: selectedExtendData?.crossPeriodTargets,
      lineStyle: selectedExtendData?.lineStyle ? normalizeLineStyle(selectedExtendData.lineStyle) : undefined,
      locked: Boolean(selectedExtendData?.locked),
      objectId: selectedExtendData?.objectId,
      price: Number.isFinite(selectedPrice) ? selectedPrice : undefined,
      selected: selectedOverlay != null,
      showPriceLabel: selectedExtendData?.showPriceLabel !== false,
      sourcePeriod: selectedExtendData?.sourcePeriod,
      textStyle: selectedExtendData?.textStyle ? normalizeDrawingTextStyle(selectedExtendData.textStyle) : undefined,
      tool: 'horizontalLine',
      ...state,
    })
  }

  const drawingPersistenceBridge = createChartDrawingPersistenceBridge()
  const {
    persistCurrentEmojiStickers,
    persistCurrentFibRetracements,
    persistCurrentHorizontalLines,
    persistCurrentRulers,
    persistCurrentTrendLines,
    restoreAllPendingStoredDrawings,
    syncSharedStoredDrawings,
  } = drawingPersistenceBridge
  const createRulerStatsDataListSnapshot = () => chart.getDataList().map((row) => ({
    real_volume: Number((row as { real_volume?: number }).real_volume),
    tick_volume: Number((row as { tick_volume?: number }).tick_volume),
    timestamp: Number(row.timestamp),
    volume: Number(row.volume),
  }))
  const refreshRulerStatsDataList = () => {
    const dataList = createRulerStatsDataListSnapshot()
    if (dataList.length === 0) return
    rulerOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        rulerOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as RulerExtendData | undefined
      chart.overrideOverlay({
        id,
        extendData: {
          ...extendData,
          dataList,
        },
        visible: overlay.visible,
      })
    })
  }

  let drawingVisibilityController: ReturnType<typeof createChartDrawingVisibilityController> | null = null
  let paneInteractionController: ReturnType<typeof createChartDrawingPaneInteractionController> | null = null
  let quickMeasureController: ReturnType<typeof createQuickMeasureController> | null = null
  let morganRangeController: ReturnType<typeof createMorganRangeController> | null = null
  let horizontalLineTool: ReturnType<typeof installHorizontalLineDrawingTool> | null = null
  let trendLineTool: ReturnType<typeof installTrendLineDrawingTool> | null = null
  let rulerTool: ReturnType<typeof installRulerDrawingTool> | null = null
  let fibTool: ReturnType<typeof installFibRetracementDrawingTool> | null = null
  let stickerTool: ReturnType<typeof installStickerDrawingTool> | null = null
  let symbolMarkerController: ReturnType<typeof createChartSymbolMarkerController> | null = null
  const applyDrawingVisibility = () => drawingVisibilityController?.applyDrawingVisibility()
  const applyHorizontalLineVisibility = () => drawingVisibilityController?.applyHorizontalLineVisibility()
  const applyTrendLineVisibility = () => drawingVisibilityController?.applyTrendLineVisibility()
  const invalidateSharedDrawingState = () => invalidateJsonState([horizontalLineDrawingsStorageKey, trendLineDrawingsStorageKey])
  const refreshSharedStoredDrawings = () => {
    invalidateSharedDrawingState()
    syncSharedStoredDrawings()
    applyDrawingVisibility()
  }
  let pendingSharedDrawingRefresh = 0
  const scheduleSharedStoredDrawingsRefresh = () => {
    if (pendingSharedDrawingRefresh) return
    pendingSharedDrawingRefresh = window.requestAnimationFrame(() => {
      pendingSharedDrawingRefresh = 0
      refreshSharedStoredDrawings()
    })
  }
  const isHorizontalLineVisibleInCurrentPeriod = (objectId?: string) => drawingVisibilityController?.isHorizontalLineVisibleInCurrentPeriod(objectId) ?? true
  const isFibRetracementVisibleInCurrentPeriod = (objectId?: string) => drawingVisibilityController?.isFibRetracementVisibleInCurrentPeriod(objectId) ?? true
  const isRulerVisibleInCurrentPeriod = (objectId?: string) => drawingVisibilityController?.isRulerVisibleInCurrentPeriod(objectId) ?? true
  const isTrendLineVisibleInCurrentPeriod = (objectId?: string) => drawingVisibilityController?.isTrendLineVisibleInCurrentPeriod(objectId) ?? true
  const resolveHorizontalLineVisibility = (extendData: HorizontalLineExtendData | undefined) => drawingVisibilityController?.resolveHorizontalLineVisibility(extendData) ?? {
    manualVisible: extendData?.manualVisible !== false,
    periodVisible: true,
    visible: extendData?.manualVisible !== false,
  }
  const resolveTrendLineVisibility = (extendData: TrendLineExtendData | undefined) => drawingVisibilityController?.resolveTrendLineVisibility(extendData) ?? {
    manualVisible: extendData?.manualVisible !== false,
    periodVisible: true,
    visible: extendData?.manualVisible !== false,
  }
  const resolveRulerVisibility = (extendData: RulerExtendData | undefined) => drawingVisibilityController?.resolveRulerVisibility(extendData) ?? {
    manualVisible: extendData?.manualVisible !== false,
    periodVisible: true,
    visible: extendData?.manualVisible !== false,
  }
  const resolveFibRetracementVisibility = (extendData: RulerExtendData | undefined) => drawingVisibilityController?.resolveFibRetracementVisibility(extendData) ?? {
    manualVisible: extendData?.manualVisible !== false,
    periodVisible: true,
    visible: extendData?.manualVisible !== false,
  }
  const restoreObjectCurrentPeriodVisibility = (kind: 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'emojiSticker', objectId?: string) => {
    if (kind === 'emojiSticker') return
    drawingVisibilityController?.restoreObjectCurrentPeriodVisibility(kind, objectId)
  }
  const getHorizontalLineVisible = () => drawingVisibilityController?.getHorizontalLineVisible() ?? true
  const ensurePaneInteractionListeners = () => {
    paneInteractionController?.ensurePaneInteractionListeners()
    quickMeasureController?.ensureListeners()
  }
  const getLastPointerPaneId = () => paneInteractionController?.getLastPointerPaneId() ?? candlePaneId

  const resolveTrendPointPrices = (overlay: { points?: Array<{ value?: number }> } | null | undefined): [number | undefined, number | undefined] => {
    const first = Number(overlay?.points?.[0]?.value)
    const second = Number(overlay?.points?.[1]?.value)
    return [
      Number.isFinite(first) ? first : undefined,
      Number.isFinite(second) ? second : undefined,
    ]
  }

  const updateOverlayState = (id: string | undefined, patch: Record<string, unknown>) => {
    if (!id) return
    const overlay = chart.getOverlayById(id)
    if (!overlay) return
    if (typeof patch.selected === 'boolean') {
      if (patch.selected) selection.selectedHorizontalLineOverlayIds.add(id)
      else selection.selectedHorizontalLineOverlayIds.delete(id)
    }
    const visualStateOnly = Object.keys(patch).every((key) => key === 'handlePressed' || key === 'hovered' || key === 'pressed' || key === 'selected')
    if (overlay.visible === false && visualStateOnly) return
    chart.overrideOverlay({
      id,
      extendData: {
        ...(overlay.extendData ?? {}),
        ...patch,
      },
      visible: overlay.visible,
    })
  }

  const getSelectedHorizontalLineIds = () => getSelectedHorizontalLineIdsFromState(horizontalLineOverlayIds, selection.selectedHorizontalLineOverlayIds)

  const getSelectedTrendLineIds = () => getSelectedTrendLineIdsFromState({
    chart,
    pendingTrendLineOverlayId: trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    selectedTrendLineOverlayIds: selection.selectedTrendLineOverlayIds,
    trendLineOverlayIds,
  })

  const publishObjectTreeState = createChartDrawingObjectTreePublisher({
    chart,
    emojiStickerOverlayIds: () => stickerTool?.getOverlayIds() ?? new Set(),
    fallbackPaneId: candlePaneId,
    fibOverlayIds,
    getActiveObjectTreeOverlayId: () => selection.activeObjectTreeOverlayId,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    getSelectedStickerOverlayId: () => stickerTool?.getSelectedId() ?? null,
    getSelectedTrendLineOverlayId: () => selection.selectedTrendLineOverlayId,
    horizontalLineOverlayIds,
    resolveFibRetracementVisibility,
    resolveHorizontalLineVisibility,
    resolveRulerVisibility,
    resolveTrendLineVisibility,
    rulerOverlayIds,
    selectedFibOverlayIds: selection.selectedFibOverlayIds,
    selectedHorizontalLineOverlayIds: selection.selectedHorizontalLineOverlayIds,
    selectedRulerOverlayIds: selection.selectedRulerOverlayIds,
    selectedTrendLineOverlayIds: selection.selectedTrendLineOverlayIds,
    trendLineOverlayIds,
  })

  const {
    clearHorizontalLineSelection,
    resolveDeleteTargetOverlayId,
    resolveEditableOverlayId,
    resolveSelectedOverlayId,
  } = createHorizontalLineSelectionStateController({
    chart,
    getLastSelectedOverlayId: () => selection.lastSelectedOverlayId,
    getSelectedOverlayId: () => selection.selectedOverlayId,
    horizontalLineOverlayIds,
    publishObjectTreeState,
    publishState,
    selectedHorizontalLineOverlayIds: selection.selectedHorizontalLineOverlayIds,
    setSelectedOverlayId: (id) => { selection.selectedOverlayId = id },
    updateOverlayState,
  })

  const {
    eventHitsFib,
    eventHitsHorizontalLine,
    eventHitsRuler,
    eventHitsTrendLine,
    resolveOverlayPointPixel,
  } = createChartDrawingHitTester({
    chart,
    fallbackPaneId: candlePaneId,
    fibOverlayIds,
    getPendingFibOverlayId: () => fibTool?.getPendingOverlayId() ?? null,
    getPendingRulerOverlayId: () => rulerTool?.getPendingOverlayId() ?? null,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    horizontalLineOverlayIds,
    resolveHorizontalLineVisibility,
    resolveFibRetracementVisibility,
    resolveRulerVisibility,
    resolveTrendLineVisibility,
    rulerOverlayIds,
    trendLineOverlayIds,
  })

  const pendingTrendStartHandle = createTrendLinePendingStartHandleController({
    chart,
    fallbackPaneId: candlePaneId,
    resolveOverlayPointPixel,
  })
  const hidePendingTrendStartHandle = pendingTrendStartHandle.hide
  const updatePendingTrendStartHandle = pendingTrendStartHandle.update

  const {
    clearTrendLineSelection,
    resolveDeletableTrendLineOverlayId,
    resolveSelectedTrendLineOverlayId,
    selectTrendLineForInteraction,
  } = createTrendLineSelectionController({
    chart,
    clearHorizontalLineSelection,
    getLastSelectedTrendLineAt: () => selection.lastSelectedTrendLineAt,
    getLastSelectedTrendLineOverlayId: () => selection.lastSelectedTrendLineOverlayId,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    getSelectedTrendLineOverlayId: () => selection.selectedTrendLineOverlayId,
    publishObjectTreeState,
    setActiveTrendLine: (id) => {
      selection.selectedTrendLineOverlayId = id
      selection.selectedTrendLineOverlayIds.add(id)
      selection.lastSelectedTrendLineOverlayId = id
      selection.lastSelectedTrendLineAt = Date.now()
      selection.activeObjectTreeOverlayId = id
    },
    setLastSelectedTrendLineOverlayId: (id) => { selection.lastSelectedTrendLineOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selection.selectedTrendLineOverlayId = id },
    selectedTrendLineOverlayIds: selection.selectedTrendLineOverlayIds,
    trendLineOverlayIds,
  })

  const {
    setSelectedHorizontalLine,
    toggleSelectedHorizontalLine,
  } = createHorizontalLineSelectionController({
    clearTrendLineSelection,
    horizontalLineOverlayIds,
    resolveSelectedOverlayId,
    selectedHorizontalLineOverlayIds: selection.selectedHorizontalLineOverlayIds,
    setActiveHorizontalLine: (id) => {
      selection.selectedOverlayId = id
      selection.lastSelectedOverlayId = id
      selection.activeObjectTreeOverlayId = id
    },
    updateOverlayState,
  })

  const clearRulerSelection = () => {
    clearTwoPointDrawingSelection({
      chart,
      getActiveObjectTreeOverlayId: () => selection.activeObjectTreeOverlayId,
      getFallbackActiveObjectTreeOverlayId: () => selection.selectedOverlayId ?? selection.selectedTrendLineOverlayId,
      getPendingOverlayId: () => rulerTool?.getPendingOverlayId() ?? null,
      getSelectedOverlayId: () => selection.selectedRulerOverlayId,
      overlayIds: rulerOverlayIds,
      publishObjectTreeState,
      publishToolState: publishDrawingToolState,
      selectedOverlayIds: selection.selectedRulerOverlayIds,
      setActiveObjectTreeOverlayId: (id) => { selection.activeObjectTreeOverlayId = id },
      setSelectedOverlayId: (id) => { selection.selectedRulerOverlayId = id },
      tool: 'ruler',
    })
  }

  const clearFibSelection = () => {
    clearTwoPointDrawingSelection({
      chart,
      getActiveObjectTreeOverlayId: () => selection.activeObjectTreeOverlayId,
      getFallbackActiveObjectTreeOverlayId: () => selection.selectedOverlayId ?? selection.selectedTrendLineOverlayId ?? selection.selectedRulerOverlayId,
      getPendingOverlayId: () => fibTool?.getPendingOverlayId() ?? null,
      getSelectedOverlayId: () => selection.selectedFibOverlayId,
      overlayIds: fibOverlayIds,
      publishObjectTreeState,
      publishToolState: publishDrawingToolState,
      selectedOverlayIds: selection.selectedFibOverlayIds,
      setActiveObjectTreeOverlayId: (id) => { selection.activeObjectTreeOverlayId = id },
      setSelectedOverlayId: (id) => { selection.selectedFibOverlayId = id },
      tool: 'fibRetracement',
    })
  }

  const {
    beginMixedDrawingMove,
    beginPressedMove,
    moveMixedDrawings,
    moveSelectedHorizontalLines,
  } = createChartDrawingMoveController({
    chart,
    fallbackPaneId: candlePaneId,
    getMixedMoveState: () => mixedDrawingMoveState,
    getPressedMoveState: () => pressedMoveState,
    getSelectedHorizontalLineIds,
    getSelectedTrendLineIds,
    markActiveHorizontalLine: (id) => {
      selection.selectedOverlayId = id
      selection.lastSelectedOverlayId = id
      selection.activeObjectTreeOverlayId = id
    },
    resolveOverlayPointPixel,
    setMixedMoveState: (state) => {
      mixedDrawingMoveState = state
    },
    setPressedMoveState: (state) => {
      pressedMoveState = state
    },
    setSelectedHorizontalLine,
  })

  const createHorizontalLineOverlayBase = createHorizontalLineOverlayFactory({
    beginPressedMove,
    chart,
    clearDeselectedHorizontalLine: (id) => {
      if (selection.selectedOverlayId === id) selection.selectedOverlayId = null
    },
    clearRemovedHorizontalLine: (id) => {
      if (selection.selectedOverlayId === id) selection.selectedOverlayId = null
      if (selection.lastSelectedOverlayId === id) selection.lastSelectedOverlayId = null
    },
    getHorizontalLineVisible,
    getMixedDrawingMoveState: () => mixedDrawingMoveState,
    getPendingHorizontalLineHandlePress: () => pendingHorizontalLineHandlePress,
    getPressedMoveState: () => pressedMoveState,
    horizontalLineHandleDragThreshold,
    horizontalLineOverlayIds,
    moveMixedDrawings,
    moveSelectedHorizontalLines,
    persistCurrentHorizontalLines,
    persistCurrentTrendLines,
    publishObjectTreeState,
    publishState,
    selectedHorizontalLineOverlayIds: selection.selectedHorizontalLineOverlayIds,
    setActiveHorizontalLine: (id) => {
      selection.selectedOverlayId = id
      selection.lastSelectedOverlayId = id
      selection.activeObjectTreeOverlayId = id
    },
    setMixedDrawingMoveState: (state) => {
      mixedDrawingMoveState = state
    },
    setPendingHorizontalLineHandlePress: (state) => {
      pendingHorizontalLineHandlePress = state
    },
    setPendingOverlayCleared: () => {
      horizontalLineTool?.clearPending()
    },
    setPressedMoveState: (state) => {
      pressedMoveState = state
    },
    setSelectedHorizontalLine,
    updateOverlayState,
  })

  const createHorizontalLineOverlay = (options: {
    crossPeriod?: boolean
    crossPeriodTargets?: string[]
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    sourcePeriod?: string
    textStyle?: DrawingTextStyle
  }) => createHorizontalLineOverlayBase({
    ...options,
    objectId: options.objectId ?? createHorizontalLineObjectId(),
    paneId: options.paneId ?? candlePaneId,
    sourcePeriod: options.sourcePeriod ?? getPeriod().trim().toUpperCase(),
  })

  const createTrendLineOverlayBase = createTrendLineOverlayFactory({
    beginMixedDrawingMove,
    chart,
    clearRemovedTrendLine: (id) => {
      if (selection.selectedTrendLineOverlayId === id) selection.selectedTrendLineOverlayId = null
      if (selection.lastSelectedTrendLineOverlayId === id) selection.lastSelectedTrendLineOverlayId = null
      selection.selectedTrendLineOverlayIds.delete(id)
    },
    getLastSelectedTrendLineAt: () => selection.lastSelectedTrendLineAt,
    getLastSelectedTrendLineOverlayId: () => selection.lastSelectedTrendLineOverlayId,
    getMixedDrawingMoveState: () => mixedDrawingMoveState,
    getPendingTrendLineEndpointPress: () => pendingTrendLineEndpointPress,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    getSelectedTrendLineOverlayId: () => selection.selectedTrendLineOverlayId,
    hidePendingTrendStartHandle,
    moveMixedDrawings,
    persistCurrentHorizontalLines,
    persistCurrentTrendLines,
    publishObjectTreeState,
    resolveTrendPointPrices,
    selectedTrendLineOverlayIds: selection.selectedTrendLineOverlayIds,
    selectTrendLineForInteraction,
    setActiveTrendLine: (id) => {
      selection.selectedTrendLineOverlayId = id
      selection.selectedTrendLineOverlayIds.add(id)
      selection.lastSelectedTrendLineOverlayId = id
      selection.lastSelectedTrendLineAt = Date.now()
      selection.activeObjectTreeOverlayId = id
    },
    setMixedDrawingMoveState: (state) => {
      mixedDrawingMoveState = state
    },
    setPendingTrendFirstPointPlaced: () => undefined,
    setPendingTrendLineEndpointPress: (state) => {
      pendingTrendLineEndpointPress = state
    },
    setPendingTrendLineOverlayId: (id) => {
      trendLineTool?.setPendingTrendLineOverlayId(id)
    },
    setPendingTrendLineOptionsCleared: () => {
      trendLineTool?.clearPendingOptions()
    },
    setSelectedTrendLineOverlayId: (id) => {
      selection.selectedTrendLineOverlayId = id
    },
    trendLineEndpointDragThreshold,
    trendLineOverlayIds,
    trendLineOverlayZLevel,
    updatePendingTrendStartHandle,
  })

  const createTrendLineOverlay = (options: {
    crossPeriod?: boolean
    crossPeriodTargets?: string[]
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
    showPriceLabel: boolean
    sourcePeriod?: string
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  }) => createTrendLineOverlayBase({
    ...options,
    objectId: options.objectId ?? createTrendLineObjectId(),
    paneId: options.paneId ?? candlePaneId,
    sourcePeriod: options.sourcePeriod ?? getPeriod().trim().toUpperCase(),
  })

  const createRulerOverlayBase = createRulerOverlayFactory({
    chart,
    clearDeselectedRuler: (id) => {
      if (selection.selectedRulerOverlayId === id) selection.selectedRulerOverlayId = null
      if (selection.activeObjectTreeOverlayId === id) selection.activeObjectTreeOverlayId = selection.selectedOverlayId ?? selection.selectedTrendLineOverlayId
    },
    clearRemovedRuler: (id) => {
      if (selection.selectedRulerOverlayId === id) selection.selectedRulerOverlayId = null
      selection.selectedRulerOverlayIds.delete(id)
    },
    persistCurrentRulers,
    publishObjectTreeState,
    selectedRulerOverlayIds: selection.selectedRulerOverlayIds,
    setActiveRuler: (id) => {
      selection.selectedRulerOverlayId = id
      selection.selectedRulerOverlayIds.clear()
      selection.selectedRulerOverlayIds.add(id)
      selection.activeObjectTreeOverlayId = id
    },
    setPendingRulerOverlayId: (id) => {
      rulerTool?.setPendingOverlayId(id)
    },
    setPendingRulerOptionsCleared: () => {
      rulerTool?.clearPendingOptions()
    },
    rulerOverlayIds,
    rulerOverlayZLevel: trendLineOverlayZLevel,
  })

  const createRulerOverlay = (options: PendingRulerOptions & {
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
  }) => createRulerOverlayBase({
    ...options,
    objectId: options.objectId ?? createRulerObjectId(),
    paneId: options.paneId ?? candlePaneId,
  })

  const createFibOverlayBase = createRulerOverlayFactory({
    chart,
    clearDeselectedRuler: (id) => {
      if (selection.selectedFibOverlayId === id) selection.selectedFibOverlayId = null
      if (selection.activeObjectTreeOverlayId === id) selection.activeObjectTreeOverlayId = selection.selectedOverlayId ?? selection.selectedTrendLineOverlayId ?? selection.selectedRulerOverlayId
    },
    clearRemovedRuler: (id) => {
      if (selection.selectedFibOverlayId === id) selection.selectedFibOverlayId = null
      selection.selectedFibOverlayIds.delete(id)
    },
    overlayName: fibRetracementOverlayName,
    persistCurrentRulers: persistCurrentFibRetracements,
    publishObjectTreeState,
    selectedRulerOverlayIds: selection.selectedFibOverlayIds,
    setActiveRuler: (id) => {
      selection.selectedFibOverlayId = id
      selection.selectedFibOverlayIds.clear()
      selection.selectedFibOverlayIds.add(id)
      selection.activeObjectTreeOverlayId = id
    },
    setPendingRulerOverlayId: (id) => {
      fibTool?.setPendingOverlayId(id)
    },
    setPendingRulerOptionsCleared: () => {
      fibTool?.clearPendingOptions()
    },
    rulerOverlayIds: fibOverlayIds,
    rulerOverlayZLevel: trendLineOverlayZLevel,
    tool: 'fibRetracement',
  })

  const createFibOverlay = (options: PendingRulerOptions & {
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
  }) => createFibOverlayBase({
    ...options,
    objectId: options.objectId ?? createFibRetracementObjectId(),
    paneId: options.paneId ?? candlePaneId,
  })

  const canCreateOverlayOnPane = (paneId: string) => paneId === candlePaneId || chart.getDom(paneId, DomPosition.Main) != null

  drawingVisibilityController = createChartDrawingVisibilityController({
    chart,
    fibOverlayIds,
    getPeriod,
    getSelectedFibOverlayId: () => selection.selectedFibOverlayId,
    getSelectedOverlayId: () => selection.selectedOverlayId,
    getSelectedRulerOverlayId: () => selection.selectedRulerOverlayId,
    getSelectedTrendLineOverlayId: () => selection.selectedTrendLineOverlayId,
    horizontalLineOverlayIds,
    publishHorizontalLineState: publishState,
    publishObjectTreeState,
    rulerOverlayIds,
    selectedFibOverlayIds: selection.selectedFibOverlayIds,
    selectedHorizontalLineOverlayIds: selection.selectedHorizontalLineOverlayIds,
    selectedRulerOverlayIds: selection.selectedRulerOverlayIds,
    trendLineOverlayIds,
    updateOverlayState,
  })

  horizontalLineTool = installHorizontalLineDrawingTool({
    applyHorizontalLineVisibility,
    chart,
    createHorizontalLineOverlay,
    getPeriod,
    getLastPointerPaneId,
    getLastSelectedOverlayId: () => selection.lastSelectedOverlayId,
    getSelectedOverlayId: () => selection.selectedOverlayId,
    initialPersistenceEnabled: initialStoredDrawings.horizontalLinePersistenceEnabled,
    persistCurrentHorizontalLines,
    publishObjectTreeState,
    publishState,
    resolveDeleteTargetOverlayId,
    resolveEditableOverlayId,
    setLastSelectedOverlayId: (id) => { selection.lastSelectedOverlayId = id },
    setSelectedHorizontalLine,
    setSelectedOverlayId: (id) => { selection.selectedOverlayId = id },
    updateOverlayState,
  })

  trendLineTool = installTrendLineDrawingTool({
    applyTrendLineVisibility,
    chart,
    createTrendLineOverlay,
    getPeriod,
    getLastPointerPaneId,
    getSelectedTrendLineOverlayId: () => selection.selectedTrendLineOverlayId,
    hidePendingTrendStartHandle,
    initialPersistenceEnabled: initialStoredDrawings.trendLinePersistenceEnabled,
    persistCurrentTrendLines,
    resolveDeletableTrendLineOverlayId,
    resolveSelectedTrendLineOverlayId,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { selection.activeObjectTreeOverlayId = id },
    setLastSelectedTrendLineOverlayId: (id) => {
      selection.lastSelectedTrendLineOverlayId = id
      if (id) selection.lastSelectedTrendLineAt = Date.now()
    },
    setSelectedTrendLineOverlayId: (id) => { selection.selectedTrendLineOverlayId = id },
    trendLineOverlayIds,
  })

  rulerTool = installRulerDrawingTool({
    chart,
    createRulerOverlay,
    getLastPointerPaneId,
    getSelectedRulerOverlayId: () => selection.selectedRulerOverlayId,
    initialPersistenceEnabled: initialStoredDrawings.rulerPersistenceEnabled,
    persistCurrentRulers,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { selection.activeObjectTreeOverlayId = id },
    setSelectedRulerOverlayId: (id) => { selection.selectedRulerOverlayId = id },
    rulerOverlayIds,
  })

  fibTool = installFibRetracementDrawingTool({
    chart,
    createRulerOverlay: createFibOverlay,
    getLastPointerPaneId,
    getSelectedRulerOverlayId: () => selection.selectedFibOverlayId,
    initialPersistenceEnabled: initialStoredDrawings.fibRetracementPersistenceEnabled,
    persistCurrentRulers: persistCurrentFibRetracements,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { selection.activeObjectTreeOverlayId = id },
    setSelectedRulerOverlayId: (id) => { selection.selectedFibOverlayId = id },
    rulerOverlayIds: fibOverlayIds,
  })

  stickerTool = installStickerDrawingTool({
    chart,
    fallbackPaneId: candlePaneId,
    initialPersistenceEnabled: initialStoredDrawings.emojiStickerPersistenceEnabled,
    persist: persistCurrentEmojiStickers,
    publishObjectTreeState,
  })

  drawingPersistenceBridge.setController(createChartDrawingPersistenceController({
    canCreateOverlayOnPane,
    chart,
    createFibRetracementOverlay: createFibOverlay,
    createHorizontalLineOverlay,
    createEmojiStickerOverlay: (options) => stickerTool?.createOverlayFromStored(options.paneId, options.point, {
      bold: options.bold,
      color: options.color,
      fontFamily: options.fontFamily,
      italic: options.italic,
      locked: options.locked,
      manualVisible: options.manualVisible,
      objectId: options.objectId,
      size: options.size,
      symbol: options.symbol,
      textStyle: options.textStyle,
    }),
    createRulerOverlay,
    createTrendLineOverlay,
    fallbackPaneId: candlePaneId,
    getDestroyed: () => destroyed,
    getEmojiStickerPersistenceEnabled: () => stickerTool?.getPersistenceEnabled() ?? false,
    getFibRetracementPersistenceEnabled: () => fibTool?.getPersistenceEnabled() ?? false,
    getHorizontalLinePersistenceEnabled: () => horizontalLineTool?.getPersistenceEnabled() ?? false,
    getPendingFibRetracementOverlayId: () => fibTool?.getPendingOverlayId() ?? null,
    getPendingRulerOverlayId: () => rulerTool?.getPendingOverlayId() ?? null,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    getRulerPersistenceEnabled: () => rulerTool?.getPersistenceEnabled() ?? false,
    getTrendLinePersistenceEnabled: () => trendLineTool?.getPersistenceEnabled() ?? false,
    emojiStickerOverlayIds: stickerTool.getOverlayIds(),
    fibRetracementOverlayIds: fibOverlayIds,
    horizontalLineOverlayIds,
    initialFibRetracementDrawings: initialStoredDrawings.pendingFibRetracementDrawings,
    initialEmojiStickerDrawings: initialStoredDrawings.pendingEmojiStickerDrawings,
    initialHorizontalLineDrawings: initialStoredDrawings.pendingHorizontalLineDrawings,
    initialRulerDrawings: initialStoredDrawings.pendingRulerDrawings,
    initialTrendLineDrawings: initialStoredDrawings.pendingTrendLineDrawings,
    rulerOverlayIds,
    trendLineOverlayIds,
  }))

  restoreAllPendingStoredDrawings()
  refreshRulerStatsDataList()
  applyDrawingVisibility()
  publishObjectTreeState()

  paneInteractionController = createChartDrawingPaneInteractionController({
    chart,
    clearFibSelection,
    clearHorizontalLineSelection,
    clearRulerSelection,
    clearTrendLineSelection,
    createHorizontalLineOverlay,
    eventHitsFib,
    eventHitsHorizontalLine,
    eventHitsRuler,
    eventHitsTrendLine,
    fallbackPaneId: candlePaneId,
    getDestroyed: () => destroyed,
    getPendingOverlayId: () => horizontalLineTool?.getPendingOverlayId() ?? null,
    getPendingOverlayOptions: () => horizontalLineTool?.getPendingOverlayOptions() ?? null,
    publishHorizontalLineState: publishState,
    setPendingOverlayId: (id) => { horizontalLineTool?.setPendingOverlayId(id) },
  })
  quickMeasureController = createQuickMeasureController({
    chart,
    fallbackPaneId: candlePaneId,
  })
  symbolMarkerController = createChartSymbolMarkerController({
    chart,
    fallbackPaneId: candlePaneId,
  })
  window.fractalFrameSymbolMarkers = symbolMarkerController
  quickMeasureController.setEnabled(readQuickMeasureEnabled(getPeriod()))
  morganRangeController = createMorganRangeController({
    chart,
    fallbackPaneId: candlePaneId,
    onCompleted: () => {
      publishDrawingToolState({
        armed: false,
        locked: true,
        selected: false,
        showPriceLabel: false,
        tool: 'morganRange',
      })
    },
  })
  ensurePaneInteractionListeners()

  const handleHorizontalLineCommand = (command: DrawingToolCommand) => {
    horizontalLineTool?.handleCommand(command)
  }

  const handleTrendLineCommand = (command: DrawingToolCommand) => {
    trendLineTool?.handleCommand(command)
  }

  const handleRulerCommand = (command: DrawingToolCommand) => {
    rulerTool?.handleCommand(command)
  }

  const handleFibCommand = (command: DrawingToolCommand) => {
    fibTool?.handleCommand(command)
  }

  const handleStickerCommand = (command: DrawingToolCommand) => {
    stickerTool?.handleCommand(command)
  }

  const handleCommand = (event: Event) => {
    routeChartDrawingCommand(event, {
      handleFibCommand,
      handleHorizontalLineCommand,
      handleRulerCommand,
      handleStickerCommand,
      handleTrendLineCommand,
      releaseMorganRange: () => morganRangeController?.release(),
      setQuickMeasureEnabled: (enabled) => quickMeasureController?.setEnabled(enabled),
      startMorganRange: () => morganRangeController?.start(),
    })
  }
  const handleObjectTreeDrawingCommand = createDrawingObjectTreeCommandHandler({
    chart,
    clearFibSelection,
    clearHorizontalLineSelection,
    clearStickerSelection: () => stickerTool?.select(null),
    clearTrendLineSelection,
    emojiStickerOverlayIds: stickerTool?.getOverlayIds(),
    fibOverlayIds,
    getActiveObjectTreeOverlayId: () => selection.activeObjectTreeOverlayId,
    getSelectedOverlayId: () => selection.selectedOverlayId,
    getSelectedRulerOverlayId: () => selection.selectedRulerOverlayId,
    getSelectedTrendLineOverlayId: () => selection.selectedTrendLineOverlayId,
    getSelectedStickerOverlayId: () => stickerTool?.getSelectedId() ?? null,
    getSelectedStickerOverlayIds: () => stickerTool?.getSelectedIds() ?? new Set(),
    horizontalLineOverlayIds,
    isHorizontalLineVisibleInCurrentPeriod,
    isFibRetracementVisibleInCurrentPeriod,
    isRulerVisibleInCurrentPeriod,
    isTrendLineVisibleInCurrentPeriod,
    persistCurrentFibRetracements,
    persistCurrentHorizontalLines,
    persistCurrentRulers,
    persistCurrentTrendLines,
    persistCurrentEmojiStickers,
    publishHorizontalLineState: publishState,
    publishObjectTreeState,
    resolveTrendPointPrices,
    restoreObjectCurrentPeriodVisibility,
    rulerOverlayIds,
    selectedHorizontalLineOverlayIds: selection.selectedHorizontalLineOverlayIds,
    selectedFibOverlayIds: selection.selectedFibOverlayIds,
    selectedRulerOverlayIds: selection.selectedRulerOverlayIds,
    selectedTrendLineOverlayIds: selection.selectedTrendLineOverlayIds,
    setActiveObjectTreeOverlayId: (id) => { selection.activeObjectTreeOverlayId = id },
    setLastSelectedTrendLine: (id) => {
      selection.lastSelectedTrendLineOverlayId = id
      selection.lastSelectedTrendLineAt = Date.now()
    },
    setSelectedHorizontalLine,
    setSelectedFibOverlayId: (id) => { selection.selectedFibOverlayId = id },
    setSelectedOverlayId: (id) => { selection.selectedOverlayId = id },
    setSelectedRulerOverlayId: (id) => { selection.selectedRulerOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selection.selectedTrendLineOverlayId = id },
    setSelectedStickerOverlayId: (id, additive) => stickerTool?.select(id, additive),
    toggleSelectedHorizontalLine,
    trendLineOverlayIds,
    updateOverlayState,
  })

  const handleObjectTreeCommand = (event: Event) => {
    if (!isObjectTreeDrawingCommandEvent(event)) return
    handleObjectTreeDrawingCommand(event.detail)
  }

  const handleVisibilityRangeChanged = (event: Event) => {
    drawingVisibilityController?.handleVisibilityRangeChanged(event)
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key?.includes('fractalframe.drawings.horizontalLine.items') || event.key?.includes('fractalframe.drawings.trendLine.items')) {
      refreshSharedStoredDrawings()
      return
    }
    drawingVisibilityController?.handleStorage(event)
  }

  const handleDataReady = () => {
    ensurePaneInteractionListeners()
    syncSharedStoredDrawings()
    restoreAllPendingStoredDrawings()
    refreshRulerStatsDataList()
    applyDrawingVisibility()
  }

  const handleVisibilityRefresh = () => {
    ensurePaneInteractionListeners()
    refreshSharedStoredDrawings()
    restoreAllPendingStoredDrawings()
    refreshRulerStatsDataList()
  }

  const handleObjectTreeDrawingsRequest = () => {
    ensurePaneInteractionListeners()
    refreshSharedStoredDrawings()
    restoreAllPendingStoredDrawings()
    refreshRulerStatsDataList()
    publishObjectTreeState()
  }

  const handlePersistentStateChanged = (event: Event) => {
    const key = event instanceof CustomEvent ? event.detail?.key : undefined
    if (key !== horizontalLineDrawingsStorageKey && key !== trendLineDrawingsStorageKey) return
    scheduleSharedStoredDrawingsRefresh()
  }
  ensurePersistentStateChangeListener()
  window.addEventListener(persistentStateChangedEvent, handlePersistentStateChanged)

  const cleanupLifecycle = installChartDrawingLifecycle({
    chart,
    handleCommand,
    handleDataReady,
    handleObjectTreeCommand,
    handleObjectTreeDrawingsRequest,
    handleSharedDrawingPersistenceChanged: handlePersistentStateChanged,
    handleStorage,
    handleVisibilityRangeChanged,
    handleVisibilityRefresh,
  })
  return () => {
    destroyed = true
    if (pendingSharedDrawingRefresh) window.cancelAnimationFrame(pendingSharedDrawingRefresh)
    window.removeEventListener(persistentStateChangedEvent, handlePersistentStateChanged)
    horizontalLineTool?.cleanup()
    trendLineTool?.cleanup()
    rulerTool?.cleanup()
    fibTool?.cleanup()
    morganRangeController?.cleanup()
    stickerTool?.cleanup()
    symbolMarkerController?.clearAll()
    if (window.fractalFrameSymbolMarkers === symbolMarkerController) delete window.fractalFrameSymbolMarkers
    cleanupLifecycle()
    paneInteractionController?.cleanup()
    quickMeasureController?.cleanup()
  }
}
