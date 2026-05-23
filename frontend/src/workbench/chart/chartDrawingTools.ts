import { DomPosition, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingMainPaneId } from '../drawing/drawingPaneModel'
import {
  horizontalLineOverlayName,
  trendLineOverlayName,
} from '../drawing/drawingOverlayModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { isObjectTreeDrawingCommandEvent, publishObjectTreeDrawings } from '../rightDrawer/objectTree/objectTreeModel'
import {
  normalizeDrawingTextStyle,
} from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { collectDrawingObjectTreeState } from './chartDrawingObjectTreeState'
import { createDrawingObjectTreeCommandHandler } from './chartDrawingObjectTreeCommands'
import { createChartDrawingMoveController, type PressedHorizontalLineMoveState } from './chartDrawingMoveController'
import { createHorizontalLineSelectionController } from './chartDrawingSelectionController'
import {
  createHorizontalLineObjectId,
  createTrendLineObjectId,
} from './chartDrawingObjectIds'
import { createChartDrawingPersistenceController, readInitialStoredDrawingState } from './chartDrawingPersistenceController'
import { createChartDrawingVisibilityController } from './chartDrawingVisibilityController'
import { createChartDrawingPaneInteractionController } from './chartDrawingPaneInteractionController'
import { createHorizontalLineToolCommandHandler } from './chartHorizontalLineToolCommands'
import { createTrendLineToolCommandHandler } from './chartTrendLineToolCommands'
import { createTrendLineSelectionController } from './trendLineSelectionController'
import { createHorizontalLineSelectionStateController } from './horizontalLineSelectionStateController'
import {
  getSelectedDrawingCount as getSelectedDrawingCountFromState,
  getSelectedHorizontalLineIds as getSelectedHorizontalLineIdsFromState,
  getSelectedTrendLineIds as getSelectedTrendLineIdsFromState,
} from './chartDrawingSelectionQueries'
import {
  ensureHorizontalLineTextFigure,
  ensureTrendLineHitFigure,
  ensureTrendLineStatsBoxFigure,
  ensureTrendLineTextFigure,
} from './chartDrawingFigures'
import type {
  HorizontalLineExtendData,
  MixedDrawingMoveState,
  TrendLineExtendData,
} from './chartDrawingTypes'
import { normalizeLineStyle } from './chartDrawingStyle'
import { createHorizontalLinePointFigures, createHorizontalLineYAxisFigures } from './horizontalLineOverlayFigures'
import { createHorizontalLineOverlayFactory } from './horizontalLineOverlayController'
import { createTrendLineOverlayFactory } from './trendLineOverlayController'
import { createTrendLinePointFigures, createTrendLineYAxisFigures } from './trendLineOverlayFigures'
import { createChartDrawingHitTester } from './chartDrawingHitTesting'
import { createTrendLinePendingStartHandleController } from './trendLinePendingStartHandle'
import { createChartDrawingModifierKeys } from './chartDrawingModifierKeys'
import { installChartDrawingLifecycle } from './chartDrawingLifecycle'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingVisibilityEvents'

let horizontalLineOverlayRegistered = false
let trendLineOverlayRegistered = false
const candlePaneId = drawingMainPaneId
const trendLineOverlayZLevel = -1
export { chartDrawingVisibilityRefreshEvent }
const horizontalLineHandleDragThreshold = 3
const trendLineEndpointDragThreshold = 3

function ensureHorizontalLineOverlay() {
  if (horizontalLineOverlayRegistered) return
  ensureHorizontalLineTextFigure()
  horizontalLineOverlayRegistered = true
  registerOverlay({
    name: horizontalLineOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createHorizontalLinePointFigures,
    createYAxisFigures: createHorizontalLineYAxisFigures,
  })
}

function ensureTrendLineOverlay() {
  if (trendLineOverlayRegistered) return
  ensureTrendLineHitFigure()
  ensureTrendLineTextFigure()
  ensureTrendLineStatsBoxFigure()
  trendLineOverlayRegistered = true
  registerOverlay({
    name: trendLineOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createTrendLinePointFigures,
    createYAxisFigures: createTrendLineYAxisFigures,
  })
}

export function installChartDrawingTools(chart: Chart, getPeriod: () => string = () => '') {
  ensureHorizontalLineOverlay()
  ensureTrendLineOverlay()
  let pendingOverlayId: string | null = null
  let pendingTrendLineOverlayId: string | null = null
  let pendingOverlayOptions: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  } | null = null
  let pendingTrendLineOptions: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
    trendLineStyle: DrawingTrendLineStyle
  } | null = null
  let selectedOverlayId: string | null = null
  let selectedTrendLineOverlayId: string | null = null
  let activeObjectTreeOverlayId: string | null = null
  let lastSelectedOverlayId: string | null = null
  let lastSelectedTrendLineOverlayId: string | null = null
  let lastSelectedTrendLineAt = 0
  const horizontalLineOverlayIds = new Set<string>()
  const trendLineOverlayIds = new Set<string>()
  const initialStoredDrawings = readInitialStoredDrawingState()
  let persistenceEnabled = initialStoredDrawings.horizontalLinePersistenceEnabled
  let trendLinePersistenceEnabled = initialStoredDrawings.trendLinePersistenceEnabled
  const modifierKeys = createChartDrawingModifierKeys()
  let pressedMoveState: PressedHorizontalLineMoveState | null = null
  let mixedDrawingMoveState: MixedDrawingMoveState | null = null
  let pendingHorizontalLineHandlePress: { overlayId: string; x: number; y: number } | null = null
  let pendingTrendLineEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  const selectedHorizontalLineOverlayIds = new Set<string>()
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
      armed: pendingOverlayId != null,
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
  const persistCurrentHorizontalLines = () => drawingPersistenceController?.persistCurrentHorizontalLines()
  const persistCurrentTrendLines = () => drawingPersistenceController?.persistCurrentTrendLines()
  const restorePendingStoredHorizontalLines = () => drawingPersistenceController?.restorePendingStoredHorizontalLines()
  const restorePendingStoredTrendLines = () => drawingPersistenceController?.restorePendingStoredTrendLines()

  let drawingVisibilityController: ReturnType<typeof createChartDrawingVisibilityController> | null = null
  let paneInteractionController: ReturnType<typeof createChartDrawingPaneInteractionController> | null = null
  const applyDrawingVisibility = () => drawingVisibilityController?.applyDrawingVisibility()
  const applyHorizontalLineVisibility = () => drawingVisibilityController?.applyHorizontalLineVisibility()
  const isHorizontalLineVisibleInCurrentPeriod = (objectId?: string) => drawingVisibilityController?.isHorizontalLineVisibleInCurrentPeriod(objectId) ?? true
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
  const restoreObjectCurrentPeriodVisibility = (kind: 'horizontalLine' | 'trendLine', objectId?: string) => {
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

  const getSelectedTrendLineIds = () => getSelectedTrendLineIdsFromState({ chart, pendingTrendLineOverlayId, trendLineOverlayIds })

  const getSelectedDrawingCount = () => getSelectedDrawingCountFromState({
    chart,
    horizontalLineOverlayIds,
    pendingTrendLineOverlayId,
    selectedHorizontalLineOverlayIds,
    trendLineOverlayIds,
  })

  const publishObjectTreeState = () => {
    const state = collectDrawingObjectTreeState({
      activeObjectTreeOverlayId,
      chart,
      fallbackPaneId: candlePaneId,
      horizontalLineOverlayIds,
      pendingTrendLineOverlayId,
      resolveHorizontalLineVisibility,
      resolveTrendLineVisibility,
      selectedHorizontalLineOverlayIds,
      selectedTrendLineOverlayId,
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
    eventHitsHorizontalLine,
    eventHitsTrendLine,
    resolveOverlayPointPixel,
  } = createChartDrawingHitTester({
    chart,
    fallbackPaneId: candlePaneId,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    horizontalLineOverlayIds,
    resolveHorizontalLineVisibility,
    resolveTrendLineVisibility,
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
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    publishObjectTreeState,
    setActiveTrendLine: (id) => {
      selectedTrendLineOverlayId = id
      lastSelectedTrendLineOverlayId = id
      lastSelectedTrendLineAt = Date.now()
      activeObjectTreeOverlayId = id
    },
    setLastSelectedTrendLineOverlayId: (id) => { lastSelectedTrendLineOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selectedTrendLineOverlayId = id },
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
    getAdditiveSelectionActive: modifierKeys.getAdditiveSelectionActive,
    getHorizontalLineVisible,
    getMixedDrawingMoveState: () => mixedDrawingMoveState,
    getPendingHorizontalLineHandlePress: () => pendingHorizontalLineHandlePress,
    getPressedMoveState: () => pressedMoveState,
    getSelectedDrawingCount,
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
      pendingOverlayId = null
      pendingOverlayOptions = null
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
    },
    getAdditiveSelectionActive: modifierKeys.getAdditiveSelectionActive,
    getLastSelectedTrendLineAt: () => lastSelectedTrendLineAt,
    getLastSelectedTrendLineOverlayId: () => lastSelectedTrendLineOverlayId,
    getMixedDrawingMoveState: () => mixedDrawingMoveState,
    getPendingTrendLineEndpointPress: () => pendingTrendLineEndpointPress,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getSelectedDrawingCount,
    getSelectedTrendLineIds,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    hidePendingTrendStartHandle,
    moveMixedDrawings,
    persistCurrentHorizontalLines,
    persistCurrentTrendLines,
    publishObjectTreeState,
    resolveTrendPointPrices,
    selectTrendLineForInteraction,
    setActiveTrendLine: (id) => {
      selectedTrendLineOverlayId = id
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
      pendingTrendLineOverlayId = id
    },
    setPendingTrendLineOptionsCleared: () => {
      pendingTrendLineOptions = null
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

  const canCreateOverlayOnPane = (paneId: string) => paneId === candlePaneId || chart.getDom(paneId, DomPosition.Main) != null

  drawingVisibilityController = createChartDrawingVisibilityController({
    chart,
    getPeriod,
    getSelectedOverlayId: () => selectedOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    horizontalLineOverlayIds,
    publishHorizontalLineState: publishState,
    publishObjectTreeState,
    selectedHorizontalLineOverlayIds,
    trendLineOverlayIds,
    updateOverlayState,
  })

  drawingPersistenceController = createChartDrawingPersistenceController({
    canCreateOverlayOnPane,
    chart,
    createHorizontalLineOverlay,
    createTrendLineOverlay,
    fallbackPaneId: candlePaneId,
    getDestroyed: () => destroyed,
    getHorizontalLinePersistenceEnabled: () => persistenceEnabled,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getTrendLinePersistenceEnabled: () => trendLinePersistenceEnabled,
    horizontalLineOverlayIds,
    initialHorizontalLineDrawings: initialStoredDrawings.pendingHorizontalLineDrawings,
    initialTrendLineDrawings: initialStoredDrawings.pendingTrendLineDrawings,
    trendLineOverlayIds,
  })

  restorePendingStoredHorizontalLines()
  restorePendingStoredTrendLines()
  applyDrawingVisibility()
  publishObjectTreeState()

  paneInteractionController = createChartDrawingPaneInteractionController({
    chart,
    clearHorizontalLineSelection,
    clearTrendLineSelection,
    createHorizontalLineOverlay,
    eventHitsHorizontalLine,
    eventHitsTrendLine,
    fallbackPaneId: candlePaneId,
    getDestroyed: () => destroyed,
    getPendingOverlayId: () => pendingOverlayId,
    getPendingOverlayOptions: () => pendingOverlayOptions,
    publishHorizontalLineState: publishState,
    setPendingOverlayId: (id) => { pendingOverlayId = id },
  })

  ensurePaneInteractionListeners()
  modifierKeys.install()

  const handleHorizontalLineCommand = createHorizontalLineToolCommandHandler({
    applyHorizontalLineVisibility,
    chart,
    createHorizontalLineOverlay,
    getLastPointerPaneId,
    getLastSelectedOverlayId: () => lastSelectedOverlayId,
    getPendingOverlayId: () => pendingOverlayId,
    getPersistenceEnabled: () => persistenceEnabled,
    getSelectedOverlayId: () => selectedOverlayId,
    persistCurrentHorizontalLines,
    publishObjectTreeState,
    publishState,
    resolveDeleteTargetOverlayId,
    resolveEditableOverlayId,
    setLastSelectedOverlayId: (id) => { lastSelectedOverlayId = id },
    setPendingOverlayId: (id) => { pendingOverlayId = id },
    setPendingOverlayOptions: (options) => { pendingOverlayOptions = options },
    setPersistenceEnabled: (enabled) => { persistenceEnabled = enabled },
    setSelectedHorizontalLine,
    setSelectedOverlayId: (id) => { selectedOverlayId = id },
    updateOverlayState,
  })

  const handleTrendLineCommand = createTrendLineToolCommandHandler({
    chart,
    createTrendLineOverlay,
    getLastPointerPaneId,
    getPendingTrendLineOptions: () => pendingTrendLineOptions,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    getTrendLinePersistenceEnabled: () => trendLinePersistenceEnabled,
    hidePendingTrendStartHandle,
    persistCurrentTrendLines,
    resolveDeletableTrendLineOverlayId,
    resolveSelectedTrendLineOverlayId,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setLastSelectedTrendLineOverlayId: (id) => {
      lastSelectedTrendLineOverlayId = id
      if (id) lastSelectedTrendLineAt = Date.now()
    },
    setPendingTrendLineOptions: (options) => { pendingTrendLineOptions = options },
    setPendingTrendLineOverlayId: (id) => { pendingTrendLineOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selectedTrendLineOverlayId = id },
    setTrendLinePersistenceEnabled: (enabled) => { trendLinePersistenceEnabled = enabled },
    trendLineOverlayIds,
  })

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return
    if (event.detail.tool === 'trendLine') handleTrendLineCommand(event.detail)
    else handleHorizontalLineCommand(event.detail)
  }
  const handleObjectTreeDrawingCommand = createDrawingObjectTreeCommandHandler({
    chart,
    clearHorizontalLineSelection,
    clearTrendLineSelection,
    getActiveObjectTreeOverlayId: () => activeObjectTreeOverlayId,
    getSelectedOverlayId: () => selectedOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    horizontalLineOverlayIds,
    isHorizontalLineVisibleInCurrentPeriod,
    isTrendLineVisibleInCurrentPeriod,
    persistCurrentHorizontalLines,
    persistCurrentTrendLines,
    publishHorizontalLineState: publishState,
    publishObjectTreeState,
    resolveTrendPointPrices,
    restoreObjectCurrentPeriodVisibility,
    selectedHorizontalLineOverlayIds,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setLastSelectedTrendLine: (id) => {
      lastSelectedTrendLineOverlayId = id
      lastSelectedTrendLineAt = Date.now()
    },
    setSelectedHorizontalLine,
    setSelectedOverlayId: (id) => { selectedOverlayId = id },
    setSelectedTrendLineOverlayId: (id) => { selectedTrendLineOverlayId = id },
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
    restorePendingStoredTrendLines()
    applyDrawingVisibility()
  }

  const handleVisibilityRefresh = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredTrendLines()
    applyDrawingVisibility()
  }

  const handleObjectTreeDrawingsRequest = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredTrendLines()
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
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
    hidePendingTrendStartHandle()
    cleanupLifecycle()
    modifierKeys.cleanup()
    paneInteractionController?.cleanup()
  }
}
