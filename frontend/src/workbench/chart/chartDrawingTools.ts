import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingMainPaneId } from '../drawing/drawingPaneModel'
import {
  fibRetracementOverlayName,
} from '../drawing/drawingOverlayModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { publishDrawingToolState, type DrawingToolCommand } from '../rightDrawer/drawingToolCommands'
import { isObjectTreeDrawingCommandEvent, publishObjectTreeDrawings } from '../rightDrawer/objectTree/objectTreeModel'
import {
  normalizeDrawingTextStyle,
} from '../rightDrawer/drawingPersistence'
import { readQuickMeasureEnabled } from '../rightDrawer/quickMeasurePersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { collectDrawingObjectTreeState } from './chartDrawingObjectTreeState'
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
  let selectedOverlayId: string | null = null
  let selectedTrendLineOverlayId: string | null = null
  let selectedRulerOverlayId: string | null = null
  let selectedFibOverlayId: string | null = null
  let activeObjectTreeOverlayId: string | null = null
  let lastSelectedOverlayId: string | null = null
  let lastSelectedTrendLineOverlayId: string | null = null
  let lastSelectedTrendLineAt = 0
  const horizontalLineOverlayIds = new Set<string>()
  const trendLineOverlayIds = new Set<string>()
  const rulerOverlayIds = new Set<string>()
  const fibOverlayIds = new Set<string>()
  const initialStoredDrawings = readInitialStoredDrawingState()
  let pressedMoveState: PressedHorizontalLineMoveState | null = null
  let mixedDrawingMoveState: MixedDrawingMoveState | null = null
  let pendingHorizontalLineHandlePress: { overlayId: string; x: number; y: number } | null = null
  let pendingTrendLineEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  const selectedHorizontalLineOverlayIds = new Set<string>()
  const selectedRulerOverlayIds = new Set<string>()
  const selectedFibOverlayIds = new Set<string>()
  const selectedTrendLineOverlayIds = new Set<string>()
  let destroyed = false

  const publishState = (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => {
    const stateSelected = state?.selected
    const fallbackOverlayId = stateSelected !== false ? resolveSelectedOverlayId() : null
    const primaryOverlay = selectedOverlayId ? chart.getOverlayById(selectedOverlayId) : null
    const fallbackOverlay = fallbackOverlayId ? chart.getOverlayById(fallbackOverlayId) : null
    const selectedOverlay = primaryOverlay ?? fallbackOverlay
    if (selectedOverlay) selectedOverlayId = selectedOverlay.id
    const selectedExtendData = selectedOverlay?.extendData as HorizontalLineExtendData | null
    const selectedPrice = Number(selectedOverlay?.points[0]?.value)
    publishDrawingToolState({
      armed: horizontalLineTool?.getPendingOverlayId() != null,
      lineStyle: selectedExtendData?.lineStyle ? normalizeLineStyle(selectedExtendData.lineStyle) : undefined,
      locked: Boolean(selectedExtendData?.locked),
      objectId: selectedExtendData?.objectId,
      price: Number.isFinite(selectedPrice) ? selectedPrice : undefined,
      selected: selectedOverlay != null,
      showPriceLabel: selectedExtendData?.showPriceLabel !== false,
      textStyle: selectedExtendData?.textStyle ? normalizeDrawingTextStyle(selectedExtendData.textStyle) : undefined,
      tool: 'horizontalLine',
      ...state,
    })
  }

  let drawingPersistenceController: ReturnType<typeof createChartDrawingPersistenceController> | null = null
  const persistCurrentFibRetracements = () => drawingPersistenceController?.persistCurrentFibRetracements()
  const persistCurrentEmojiStickers = () => drawingPersistenceController?.persistCurrentEmojiStickers()
  const persistCurrentHorizontalLines = () => drawingPersistenceController?.persistCurrentHorizontalLines()
  const persistCurrentRulers = () => drawingPersistenceController?.persistCurrentRulers()
  const persistCurrentTrendLines = () => drawingPersistenceController?.persistCurrentTrendLines()
  const restorePendingStoredFibRetracements = () => drawingPersistenceController?.restorePendingStoredFibRetracements()
  const restorePendingStoredEmojiStickers = () => drawingPersistenceController?.restorePendingStoredEmojiStickers()
  const restorePendingStoredHorizontalLines = () => drawingPersistenceController?.restorePendingStoredHorizontalLines()
  const restorePendingStoredRulers = () => drawingPersistenceController?.restorePendingStoredRulers()
  const restorePendingStoredTrendLines = () => drawingPersistenceController?.restorePendingStoredTrendLines()
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
  const ensurePaneInteractionListeners = () => paneInteractionController?.ensurePaneInteractionListeners()
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
      if (patch.selected) selectedHorizontalLineOverlayIds.add(id)
      else selectedHorizontalLineOverlayIds.delete(id)
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

  const getSelectedHorizontalLineIds = () => getSelectedHorizontalLineIdsFromState(horizontalLineOverlayIds, selectedHorizontalLineOverlayIds)

  const getSelectedTrendLineIds = () => getSelectedTrendLineIdsFromState({
    chart,
    pendingTrendLineOverlayId: trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    selectedTrendLineOverlayIds,
    trendLineOverlayIds,
  })

  const publishObjectTreeState = () => {
    const state = collectDrawingObjectTreeState({
      activeObjectTreeOverlayId,
      chart,
      emojiStickerOverlayIds: stickerTool?.getOverlayIds() ?? new Set(),
      fibOverlayIds,
      fallbackPaneId: candlePaneId,
      horizontalLineOverlayIds,
      pendingTrendLineOverlayId: trendLineTool?.getPendingTrendLineOverlayId() ?? null,
      resolveHorizontalLineVisibility,
      resolveFibRetracementVisibility,
      resolveRulerVisibility,
      resolveTrendLineVisibility,
      rulerOverlayIds,
      selectedHorizontalLineOverlayIds,
      selectedFibOverlayIds,
      selectedRulerOverlayIds,
      selectedTrendLineOverlayIds,
      selectedTrendLineOverlayId,
      selectedStickerOverlayId: stickerTool?.getSelectedId() ?? null,
      trendLineOverlayIds,
    })
    publishObjectTreeDrawings(state.items, state.activeId)
  }

  const {
    clearHorizontalLineSelection,
    resolveDeleteTargetOverlayId,
    resolveEditableOverlayId,
    resolveSelectedOverlayId,
  } = createHorizontalLineSelectionStateController({
    chart,
    getLastSelectedOverlayId: () => lastSelectedOverlayId,
    getSelectedOverlayId: () => selectedOverlayId,
    horizontalLineOverlayIds,
    publishObjectTreeState,
    publishState,
    selectedHorizontalLineOverlayIds,
    setSelectedOverlayId: (id) => { selectedOverlayId = id },
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
    getLastSelectedTrendLineAt: () => lastSelectedTrendLineAt,
    getLastSelectedTrendLineOverlayId: () => lastSelectedTrendLineOverlayId,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    publishObjectTreeState,
    setActiveTrendLine: (id) => {
      selectedTrendLineOverlayId = id
      selectedTrendLineOverlayIds.add(id)
      lastSelectedTrendLineOverlayId = id
      lastSelectedTrendLineAt = Date.now()
      activeObjectTreeOverlayId = id
    },
    setLastSelectedTrendLineOverlayId: (id) => { lastSelectedTrendLineOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selectedTrendLineOverlayId = id },
    selectedTrendLineOverlayIds,
    trendLineOverlayIds,
  })

  const {
    setSelectedHorizontalLine,
    toggleSelectedHorizontalLine,
  } = createHorizontalLineSelectionController({
    clearTrendLineSelection,
    horizontalLineOverlayIds,
    resolveSelectedOverlayId,
    selectedHorizontalLineOverlayIds,
    setActiveHorizontalLine: (id) => {
      selectedOverlayId = id
      lastSelectedOverlayId = id
      activeObjectTreeOverlayId = id
    },
    updateOverlayState,
  })

  const clearRulerSelection = () => {
    let changed = false
    rulerOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        rulerOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as RulerExtendData | undefined
      if (!selectedRulerOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      selectedRulerOverlayIds.delete(id)
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
    if (!changed && !selectedRulerOverlayId) return
    selectedRulerOverlayIds.clear()
    selectedRulerOverlayId = null
    if (activeObjectTreeOverlayId && rulerOverlayIds.has(activeObjectTreeOverlayId)) activeObjectTreeOverlayId = selectedOverlayId ?? selectedTrendLineOverlayId
    publishDrawingToolState({
      armed: rulerTool?.getPendingOverlayId() != null,
      locked: false,
      selected: false,
      showPriceLabel: true,
      tool: 'ruler',
    })
    publishObjectTreeState()
  }

  const clearFibSelection = () => {
    let changed = false
    fibOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        fibOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as RulerExtendData | undefined
      if (!selectedFibOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      selectedFibOverlayIds.delete(id)
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
    if (!changed && !selectedFibOverlayId) return
    selectedFibOverlayIds.clear()
    selectedFibOverlayId = null
    if (activeObjectTreeOverlayId && fibOverlayIds.has(activeObjectTreeOverlayId)) activeObjectTreeOverlayId = selectedOverlayId ?? selectedTrendLineOverlayId ?? selectedRulerOverlayId
    publishDrawingToolState({
      armed: fibTool?.getPendingOverlayId() != null,
      locked: false,
      selected: false,
      showPriceLabel: true,
      tool: 'fibRetracement',
    })
    publishObjectTreeState()
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
      selectedOverlayId = id
      lastSelectedOverlayId = id
      activeObjectTreeOverlayId = id
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
      if (selectedOverlayId === id) selectedOverlayId = null
    },
    clearRemovedHorizontalLine: (id) => {
      if (selectedOverlayId === id) selectedOverlayId = null
      if (lastSelectedOverlayId === id) lastSelectedOverlayId = null
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
    selectedHorizontalLineOverlayIds,
    setActiveHorizontalLine: (id) => {
      selectedOverlayId = id
      lastSelectedOverlayId = id
      activeObjectTreeOverlayId = id
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
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => createHorizontalLineOverlayBase({
    ...options,
    objectId: options.objectId ?? createHorizontalLineObjectId(),
    paneId: options.paneId ?? candlePaneId,
  })

  const createTrendLineOverlayBase = createTrendLineOverlayFactory({
    beginMixedDrawingMove,
    chart,
    clearRemovedTrendLine: (id) => {
      if (selectedTrendLineOverlayId === id) selectedTrendLineOverlayId = null
      if (lastSelectedTrendLineOverlayId === id) lastSelectedTrendLineOverlayId = null
      selectedTrendLineOverlayIds.delete(id)
    },
    getLastSelectedTrendLineAt: () => lastSelectedTrendLineAt,
    getLastSelectedTrendLineOverlayId: () => lastSelectedTrendLineOverlayId,
    getMixedDrawingMoveState: () => mixedDrawingMoveState,
    getPendingTrendLineEndpointPress: () => pendingTrendLineEndpointPress,
    getPendingTrendLineOverlayId: () => trendLineTool?.getPendingTrendLineOverlayId() ?? null,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    hidePendingTrendStartHandle,
    moveMixedDrawings,
    persistCurrentHorizontalLines,
    persistCurrentTrendLines,
    publishObjectTreeState,
    resolveTrendPointPrices,
    selectedTrendLineOverlayIds,
    selectTrendLineForInteraction,
    setActiveTrendLine: (id) => {
      selectedTrendLineOverlayId = id
      selectedTrendLineOverlayIds.add(id)
      lastSelectedTrendLineOverlayId = id
      lastSelectedTrendLineAt = Date.now()
      activeObjectTreeOverlayId = id
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
      selectedTrendLineOverlayId = id
    },
    trendLineEndpointDragThreshold,
    trendLineOverlayIds,
    trendLineOverlayZLevel,
    updatePendingTrendStartHandle,
  })

  const createTrendLineOverlay = (options: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ dataIndex?: number; timestamp?: number; value?: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  }) => createTrendLineOverlayBase({
    ...options,
    objectId: options.objectId ?? createTrendLineObjectId(),
    paneId: options.paneId ?? candlePaneId,
  })

  const createRulerOverlayBase = createRulerOverlayFactory({
    chart,
    clearDeselectedRuler: (id) => {
      if (selectedRulerOverlayId === id) selectedRulerOverlayId = null
      if (activeObjectTreeOverlayId === id) activeObjectTreeOverlayId = selectedOverlayId ?? selectedTrendLineOverlayId
    },
    clearRemovedRuler: (id) => {
      if (selectedRulerOverlayId === id) selectedRulerOverlayId = null
      selectedRulerOverlayIds.delete(id)
    },
    persistCurrentRulers,
    publishObjectTreeState,
    selectedRulerOverlayIds,
    setActiveRuler: (id) => {
      selectedRulerOverlayId = id
      selectedRulerOverlayIds.clear()
      selectedRulerOverlayIds.add(id)
      activeObjectTreeOverlayId = id
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
      if (selectedFibOverlayId === id) selectedFibOverlayId = null
      if (activeObjectTreeOverlayId === id) activeObjectTreeOverlayId = selectedOverlayId ?? selectedTrendLineOverlayId ?? selectedRulerOverlayId
    },
    clearRemovedRuler: (id) => {
      if (selectedFibOverlayId === id) selectedFibOverlayId = null
      selectedFibOverlayIds.delete(id)
    },
    overlayName: fibRetracementOverlayName,
    persistCurrentRulers: persistCurrentFibRetracements,
    publishObjectTreeState,
    selectedRulerOverlayIds: selectedFibOverlayIds,
    setActiveRuler: (id) => {
      selectedFibOverlayId = id
      selectedFibOverlayIds.clear()
      selectedFibOverlayIds.add(id)
      activeObjectTreeOverlayId = id
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
    getSelectedFibOverlayId: () => selectedFibOverlayId,
    getSelectedOverlayId: () => selectedOverlayId,
    getSelectedRulerOverlayId: () => selectedRulerOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    horizontalLineOverlayIds,
    publishHorizontalLineState: publishState,
    publishObjectTreeState,
    rulerOverlayIds,
    selectedFibOverlayIds,
    selectedHorizontalLineOverlayIds,
    selectedRulerOverlayIds,
    trendLineOverlayIds,
    updateOverlayState,
  })

  horizontalLineTool = installHorizontalLineDrawingTool({
    applyHorizontalLineVisibility,
    chart,
    createHorizontalLineOverlay,
    getLastPointerPaneId,
    getLastSelectedOverlayId: () => lastSelectedOverlayId,
    getSelectedOverlayId: () => selectedOverlayId,
    initialPersistenceEnabled: initialStoredDrawings.horizontalLinePersistenceEnabled,
    persistCurrentHorizontalLines,
    publishObjectTreeState,
    publishState,
    resolveDeleteTargetOverlayId,
    resolveEditableOverlayId,
    setLastSelectedOverlayId: (id) => { lastSelectedOverlayId = id },
    setSelectedHorizontalLine,
    setSelectedOverlayId: (id) => { selectedOverlayId = id },
    updateOverlayState,
  })

  trendLineTool = installTrendLineDrawingTool({
    chart,
    createTrendLineOverlay,
    getLastPointerPaneId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    hidePendingTrendStartHandle,
    initialPersistenceEnabled: initialStoredDrawings.trendLinePersistenceEnabled,
    persistCurrentTrendLines,
    resolveDeletableTrendLineOverlayId,
    resolveSelectedTrendLineOverlayId,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setLastSelectedTrendLineOverlayId: (id) => {
      lastSelectedTrendLineOverlayId = id
      if (id) lastSelectedTrendLineAt = Date.now()
    },
    setSelectedTrendLineOverlayId: (id) => { selectedTrendLineOverlayId = id },
    trendLineOverlayIds,
  })

  rulerTool = installRulerDrawingTool({
    chart,
    createRulerOverlay,
    getLastPointerPaneId,
    getSelectedRulerOverlayId: () => selectedRulerOverlayId,
    initialPersistenceEnabled: initialStoredDrawings.rulerPersistenceEnabled,
    persistCurrentRulers,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setSelectedRulerOverlayId: (id) => { selectedRulerOverlayId = id },
    rulerOverlayIds,
  })

  fibTool = installFibRetracementDrawingTool({
    chart,
    createRulerOverlay: createFibOverlay,
    getLastPointerPaneId,
    getSelectedRulerOverlayId: () => selectedFibOverlayId,
    initialPersistenceEnabled: initialStoredDrawings.fibRetracementPersistenceEnabled,
    persistCurrentRulers: persistCurrentFibRetracements,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setSelectedRulerOverlayId: (id) => { selectedFibOverlayId = id },
    rulerOverlayIds: fibOverlayIds,
  })

  stickerTool = installStickerDrawingTool({
    chart,
    fallbackPaneId: candlePaneId,
    initialPersistenceEnabled: initialStoredDrawings.emojiStickerPersistenceEnabled,
    persist: persistCurrentEmojiStickers,
    publishObjectTreeState,
  })

  drawingPersistenceController = createChartDrawingPersistenceController({
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
  })

  restorePendingStoredHorizontalLines()
  restorePendingStoredFibRetracements()
  restorePendingStoredRulers()
  restorePendingStoredTrendLines()
  restorePendingStoredEmojiStickers()
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
  quickMeasureController.setEnabled(readQuickMeasureEnabled())
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
    getActiveObjectTreeOverlayId: () => activeObjectTreeOverlayId,
    getSelectedOverlayId: () => selectedOverlayId,
    getSelectedRulerOverlayId: () => selectedRulerOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
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
    selectedHorizontalLineOverlayIds,
    selectedFibOverlayIds,
    selectedRulerOverlayIds,
    selectedTrendLineOverlayIds,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setLastSelectedTrendLine: (id) => {
      lastSelectedTrendLineOverlayId = id
      lastSelectedTrendLineAt = Date.now()
    },
    setSelectedHorizontalLine,
    setSelectedFibOverlayId: (id) => { selectedFibOverlayId = id },
    setSelectedOverlayId: (id) => { selectedOverlayId = id },
    setSelectedRulerOverlayId: (id) => { selectedRulerOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selectedTrendLineOverlayId = id },
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
    drawingVisibilityController?.handleStorage(event)
  }

  const handleDataReady = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredFibRetracements()
    restorePendingStoredRulers()
    restorePendingStoredTrendLines()
    restorePendingStoredEmojiStickers()
    refreshRulerStatsDataList()
    applyDrawingVisibility()
  }

  const handleVisibilityRefresh = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredFibRetracements()
    restorePendingStoredRulers()
    restorePendingStoredTrendLines()
    restorePendingStoredEmojiStickers()
    refreshRulerStatsDataList()
    applyDrawingVisibility()
  }

  const handleObjectTreeDrawingsRequest = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredFibRetracements()
    restorePendingStoredRulers()
    restorePendingStoredTrendLines()
    restorePendingStoredEmojiStickers()
    refreshRulerStatsDataList()
    publishObjectTreeState()
  }

  const cleanupLifecycle = installChartDrawingLifecycle({
    chart,
    handleCommand,
    handleDataReady,
    handleObjectTreeCommand,
    handleObjectTreeDrawingsRequest,
    handleStorage,
    handleVisibilityRangeChanged,
    handleVisibilityRefresh,
  })
  return () => {
    destroyed = true
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
