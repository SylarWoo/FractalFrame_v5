import { DomPosition, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingMainPaneId } from '../drawing/drawingPaneModel'
import {
  fibRetracementOverlayName,
  horizontalLineOverlayName,
  rulerOverlayName,
  trendLineOverlayName,
} from '../drawing/drawingOverlayModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { clearStoredFibRetracementDrawings } from '../rightDrawer/drawingObjectPersistence'
import { isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
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
import { createHorizontalLineToolCommandHandler } from './chartHorizontalLineToolCommands'
import { createTrendLineToolCommandHandler } from './chartTrendLineToolCommands'
import { createTrendLineSelectionController } from './trendLineSelectionController'
import { createHorizontalLineSelectionStateController } from './horizontalLineSelectionStateController'
import {
  getSelectedHorizontalLineIds as getSelectedHorizontalLineIdsFromState,
  getSelectedTrendLineIds as getSelectedTrendLineIdsFromState,
} from './chartDrawingSelectionQueries'
import {
  ensureHorizontalLineTextFigure,
  ensureRulerCenterTextFigure,
  ensureTrendLineHitFigure,
  ensureTrendLineStatsBoxFigure,
  ensureTrendLineTextFigure,
} from './chartDrawingFigures'
import type {
  HorizontalLineExtendData,
  MixedDrawingMoveState,
  RulerExtendData,
  TrendLineExtendData,
} from './chartDrawingTypes'
import { normalizeLineStyle } from './chartDrawingStyle'
import { createHorizontalLinePointFigures, createHorizontalLineYAxisFigures } from './horizontalLineOverlayFigures'
import { createHorizontalLineOverlayFactory } from './horizontalLineOverlayController'
import { createTrendLineOverlayFactory } from './trendLineOverlayController'
import { createTrendLinePointFigures, createTrendLineYAxisFigures } from './trendLineOverlayFigures'
import { createRulerOverlayFactory, type PendingRulerOptions } from './rulerOverlayController'
import { createRulerPointFigures, createRulerYAxisFigures } from './rulerOverlayFigures'
import { createFibRetracementPointFigures, createFibRetracementYAxisFigures } from './fibRetracementOverlayFigures'
import { createRulerToolCommandHandler } from './chartRulerToolCommands'
import { createQuickMeasureController, ensureQuickMeasureOverlay } from './quickMeasureOverlay'
import { createChartDrawingHitTester } from './chartDrawingHitTesting'
import { createTrendLinePendingStartHandleController } from './trendLinePendingStartHandle'
import { installChartDrawingLifecycle } from './chartDrawingLifecycle'
import { chartDrawingVisibilityRefreshEvent } from './chartDrawingVisibilityEvents'

let horizontalLineOverlayRegistered = false
let trendLineOverlayRegistered = false
let rulerOverlayRegistered = false
let fibRetracementOverlayRegistered = false
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

function ensureRulerOverlay() {
  if (rulerOverlayRegistered) return
  ensureQuickMeasureOverlay()
  ensureRulerCenterTextFigure()
  ensureTrendLineHitFigure()
  ensureTrendLineStatsBoxFigure()
  rulerOverlayRegistered = true
  registerOverlay({
    name: rulerOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createRulerPointFigures,
    createYAxisFigures: createRulerYAxisFigures,
  })
}

function ensureFibRetracementOverlay() {
  if (fibRetracementOverlayRegistered) return
  ensureTrendLineHitFigure()
  fibRetracementOverlayRegistered = true
  registerOverlay({
    name: fibRetracementOverlayName,
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createFibRetracementPointFigures,
    createYAxisFigures: createFibRetracementYAxisFigures,
  })
}

export function installChartDrawingTools(chart: Chart, getPeriod: () => string = () => '') {
  ensureHorizontalLineOverlay()
  ensureTrendLineOverlay()
  ensureRulerOverlay()
  ensureFibRetracementOverlay()
  let pendingOverlayId: string | null = null
  let pendingTrendLineOverlayId: string | null = null
  let pendingRulerOverlayId: string | null = null
  let pendingFibOverlayId: string | null = null
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
  let pendingRulerOptions: PendingRulerOptions | null = null
  let pendingFibOptions: PendingRulerOptions | null = null
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
  let fibRetracementPersistenceEnabled = initialStoredDrawings.fibRetracementPersistenceEnabled
  let persistenceEnabled = initialStoredDrawings.horizontalLinePersistenceEnabled
  let rulerPersistenceEnabled = initialStoredDrawings.rulerPersistenceEnabled
  let trendLinePersistenceEnabled = initialStoredDrawings.trendLinePersistenceEnabled
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
  const persistCurrentFibRetracements = () => drawingPersistenceController?.persistCurrentFibRetracements()
  const persistCurrentHorizontalLines = () => drawingPersistenceController?.persistCurrentHorizontalLines()
  const persistCurrentRulers = () => drawingPersistenceController?.persistCurrentRulers()
  const persistCurrentTrendLines = () => drawingPersistenceController?.persistCurrentTrendLines()
  const restorePendingStoredFibRetracements = () => drawingPersistenceController?.restorePendingStoredFibRetracements()
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
  const restoreObjectCurrentPeriodVisibility = (kind: 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement', objectId?: string) => {
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

  const getSelectedTrendLineIds = () => getSelectedTrendLineIdsFromState({ chart, pendingTrendLineOverlayId, selectedTrendLineOverlayIds, trendLineOverlayIds })

  const publishObjectTreeState = () => {
    const state = collectDrawingObjectTreeState({
      activeObjectTreeOverlayId,
      chart,
      fibOverlayIds,
      fallbackPaneId: candlePaneId,
      horizontalLineOverlayIds,
      pendingTrendLineOverlayId,
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
    getPendingFibOverlayId: () => pendingFibOverlayId,
    getPendingRulerOverlayId: () => pendingRulerOverlayId,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
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
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
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
      armed: pendingRulerOverlayId != null,
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
      armed: pendingFibOverlayId != null,
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
      selectedTrendLineOverlayIds.delete(id)
    },
    getLastSelectedTrendLineAt: () => lastSelectedTrendLineAt,
    getLastSelectedTrendLineOverlayId: () => lastSelectedTrendLineOverlayId,
    getMixedDrawingMoveState: () => mixedDrawingMoveState,
    getPendingTrendLineEndpointPress: () => pendingTrendLineEndpointPress,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
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
      pendingRulerOverlayId = id
    },
    setPendingRulerOptionsCleared: () => {
      pendingRulerOptions = null
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
      pendingFibOverlayId = id
    },
    setPendingRulerOptionsCleared: () => {
      pendingFibOptions = null
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

  drawingPersistenceController = createChartDrawingPersistenceController({
    canCreateOverlayOnPane,
    chart,
    createFibRetracementOverlay: createFibOverlay,
    createHorizontalLineOverlay,
    createRulerOverlay,
    createTrendLineOverlay,
    fallbackPaneId: candlePaneId,
    getDestroyed: () => destroyed,
    getFibRetracementPersistenceEnabled: () => fibRetracementPersistenceEnabled,
    getHorizontalLinePersistenceEnabled: () => persistenceEnabled,
    getPendingFibRetracementOverlayId: () => pendingFibOverlayId,
    getPendingRulerOverlayId: () => pendingRulerOverlayId,
    getPendingTrendLineOverlayId: () => pendingTrendLineOverlayId,
    getRulerPersistenceEnabled: () => rulerPersistenceEnabled,
    getTrendLinePersistenceEnabled: () => trendLinePersistenceEnabled,
    fibRetracementOverlayIds: fibOverlayIds,
    horizontalLineOverlayIds,
    initialFibRetracementDrawings: initialStoredDrawings.pendingFibRetracementDrawings,
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
    getPendingOverlayId: () => pendingOverlayId,
    getPendingOverlayOptions: () => pendingOverlayOptions,
    publishHorizontalLineState: publishState,
    setPendingOverlayId: (id) => { pendingOverlayId = id },
  })
  quickMeasureController = createQuickMeasureController({
    chart,
    fallbackPaneId: candlePaneId,
  })
  quickMeasureController.setEnabled(readQuickMeasureEnabled())

  ensurePaneInteractionListeners()

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

  const handleRulerCommand = createRulerToolCommandHandler({
    chart,
    createRulerOverlay,
    getLastPointerPaneId,
    getPendingRulerOptions: () => pendingRulerOptions,
    getPendingRulerOverlayId: () => pendingRulerOverlayId,
    getRulerPersistenceEnabled: () => rulerPersistenceEnabled,
    getSelectedRulerOverlayId: () => selectedRulerOverlayId,
    persistCurrentRulers,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setPendingRulerOptions: (options) => { pendingRulerOptions = options },
    setPendingRulerOverlayId: (id) => { pendingRulerOverlayId = id },
    setRulerPersistenceEnabled: (enabled) => { rulerPersistenceEnabled = enabled },
    setSelectedRulerOverlayId: (id) => { selectedRulerOverlayId = id },
    rulerOverlayIds,
  })

  const handleFibCommand = createRulerToolCommandHandler({
    chart,
    createRulerOverlay: createFibOverlay,
    getLastPointerPaneId,
    getPendingRulerOptions: () => pendingFibOptions,
    getPendingRulerOverlayId: () => pendingFibOverlayId,
    getRulerPersistenceEnabled: () => fibRetracementPersistenceEnabled,
    getSelectedRulerOverlayId: () => selectedFibOverlayId,
    persistCurrentRulers: persistCurrentFibRetracements,
    resolveTrendPointPrices,
    setActiveObjectTreeOverlayId: (id) => { activeObjectTreeOverlayId = id },
    setPendingRulerOptions: (options) => { pendingFibOptions = options },
    setPendingRulerOverlayId: (id) => { pendingFibOverlayId = id },
    setRulerPersistenceEnabled: (enabled) => { fibRetracementPersistenceEnabled = enabled },
    setSelectedRulerOverlayId: (id) => { selectedFibOverlayId = id },
    rulerOverlayIds: fibOverlayIds,
    clearStoredDrawings: clearStoredFibRetracementDrawings,
    tool: 'fibRetracement',
  })

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return
    if (event.detail.tool === 'ruler' && event.detail.action === 'updateQuickMeasureEnabled') {
      quickMeasureController?.setEnabled(event.detail.enabled === true)
      return
    }
    if (event.detail.tool === 'trendLine') handleTrendLineCommand(event.detail)
    else if (event.detail.tool === 'ruler') handleRulerCommand(event.detail)
    else if (event.detail.tool === 'fibRetracement') handleFibCommand(event.detail)
    else handleHorizontalLineCommand(event.detail)
  }
  const handleObjectTreeDrawingCommand = createDrawingObjectTreeCommandHandler({
    chart,
    clearFibSelection,
    clearHorizontalLineSelection,
    clearTrendLineSelection,
    fibOverlayIds,
    getActiveObjectTreeOverlayId: () => activeObjectTreeOverlayId,
    getSelectedOverlayId: () => selectedOverlayId,
    getSelectedRulerOverlayId: () => selectedRulerOverlayId,
    getSelectedTrendLineOverlayId: () => selectedTrendLineOverlayId,
    horizontalLineOverlayIds,
    isHorizontalLineVisibleInCurrentPeriod,
    isFibRetracementVisibleInCurrentPeriod,
    isRulerVisibleInCurrentPeriod,
    isTrendLineVisibleInCurrentPeriod,
    persistCurrentFibRetracements,
    persistCurrentHorizontalLines,
    persistCurrentRulers,
    persistCurrentTrendLines,
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
    refreshRulerStatsDataList()
    applyDrawingVisibility()
  }

  const handleVisibilityRefresh = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredFibRetracements()
    restorePendingStoredRulers()
    restorePendingStoredTrendLines()
    refreshRulerStatsDataList()
    applyDrawingVisibility()
  }

  const handleObjectTreeDrawingsRequest = () => {
    ensurePaneInteractionListeners()
    restorePendingStoredHorizontalLines()
    restorePendingStoredFibRetracements()
    restorePendingStoredRulers()
    restorePendingStoredTrendLines()
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
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
    if (pendingRulerOverlayId) chart.removeOverlay({ id: pendingRulerOverlayId })
    if (pendingFibOverlayId) chart.removeOverlay({ id: pendingFibOverlayId })
    hidePendingTrendStartHandle()
    cleanupLifecycle()
    paneInteractionController?.cleanup()
    quickMeasureController?.cleanup()
  }
}
