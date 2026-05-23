import { ActionType, DomPosition, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { drawingMainPaneId } from '../drawing/drawingPaneModel'
import {
  horizontalLineOverlayName,
  trendLineOverlayName,
} from '../drawing/drawingOverlayModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { drawingToolCommandEvent, isDrawingToolCommandEvent, publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { isObjectTreeDrawingCommandEvent, objectTreeDrawingCommandEvent, objectTreeDrawingsRequestEvent, publishObjectTreeDrawings } from '../rightDrawer/objectTree/objectTreeModel'
import {
  clearStoredHorizontalLineDrawings,
  clearStoredTrendLineDrawings,
  normalizeDrawingTextStyle,
  normalizeDrawingTrendLineStyle,
} from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { visibilityRangeChangedEvent } from '../visibilityRange/visibilityRangeModel'
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
import { normalizeLineStyle, overlayStylesFromLine, trendOverlayStylesFromLine } from './chartDrawingStyle'
import { createHorizontalLinePointFigures, createHorizontalLineYAxisFigures } from './horizontalLineOverlayFigures'
import { createHorizontalLineOverlayFactory } from './horizontalLineOverlayController'
import { createTrendLineOverlayFactory } from './trendLineOverlayController'
import { createTrendLinePointFigures, createTrendLineYAxisFigures } from './trendLineOverlayFigures'
import { trendHandleColor, trendHandleLineWidth } from './trendLineFigures'
import { createChartDrawingHitTester } from './chartDrawingHitTesting'

let horizontalLineOverlayRegistered = false
let trendLineOverlayRegistered = false
const candlePaneId = drawingMainPaneId
const trendLineOverlayZLevel = -1
export const chartDrawingVisibilityRefreshEvent = 'fractalframe:chart-drawing-visibility-refresh'
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
  let pendingTrendStartHandle: HTMLDivElement | null = null
  const horizontalLineOverlayIds = new Set<string>()
  const trendLineOverlayIds = new Set<string>()
  const initialStoredDrawings = readInitialStoredDrawingState()
  let persistenceEnabled = initialStoredDrawings.horizontalLinePersistenceEnabled
  let trendLinePersistenceEnabled = initialStoredDrawings.trendLinePersistenceEnabled
  let additiveSelectionActive = false
  let pressedMoveState: PressedHorizontalLineMoveState | null = null
  let mixedDrawingMoveState: MixedDrawingMoveState | null = null
  let pendingHorizontalLineHandlePress: { overlayId: string; x: number; y: number } | null = null
  let pendingTrendLineEndpointPress: { overlayId: string; pointIndex: number; x: number; y: number } | null = null
  const selectedHorizontalLineOverlayIds = new Set<string>()
  let destroyed = false

  const hidePendingTrendStartHandle = () => {
    pendingTrendStartHandle?.remove()
    pendingTrendStartHandle = null
  }

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

  const resolveDeleteTargetOverlayId = () => {
    if (selectedOverlayId && chart.getOverlayById(selectedOverlayId)) return selectedOverlayId
    if (lastSelectedOverlayId && chart.getOverlayById(lastSelectedOverlayId)) return lastSelectedOverlayId
    return null
  }

  const resolveSelectedOverlayId = () => {
    if (selectedOverlayId) {
      if (selectedHorizontalLineOverlayIds.has(selectedOverlayId)) return selectedOverlayId
    }
    if (!lastSelectedOverlayId) return null
    if (selectedHorizontalLineOverlayIds.has(lastSelectedOverlayId)) return lastSelectedOverlayId
    return selectedHorizontalLineOverlayIds.values().next().value ?? null
  }

  const resolveEditableOverlayId = () => resolveSelectedOverlayId()

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

  const updatePendingTrendStartHandle = (overlay: { paneId?: string; points: Array<{ dataIndex?: number; timestamp?: number; value?: number }> }) => {
    const paneId = overlay.paneId || candlePaneId
    const point = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!point || !paneMain) {
      hidePendingTrendStartHandle()
      return
    }
    const rect = paneMain.getBoundingClientRect()
    if (!pendingTrendStartHandle) {
      pendingTrendStartHandle = document.createElement('div')
      pendingTrendStartHandle.style.position = 'fixed'
      pendingTrendStartHandle.style.width = '13px'
      pendingTrendStartHandle.style.height = '13px'
      pendingTrendStartHandle.style.border = `${trendHandleLineWidth}px solid ${trendHandleColor}`
      pendingTrendStartHandle.style.borderRadius = '50%'
      pendingTrendStartHandle.style.background = '#ffffff'
      pendingTrendStartHandle.style.boxSizing = 'border-box'
      pendingTrendStartHandle.style.pointerEvents = 'none'
      pendingTrendStartHandle.style.zIndex = '2147483647'
      document.body.appendChild(pendingTrendStartHandle)
    }
    pendingTrendStartHandle.style.left = `${rect.left + point.x - 6.5}px`
    pendingTrendStartHandle.style.top = `${rect.top + point.y - 6.5}px`
  }

  const clearHorizontalLineSelection = () => {
    let changed = false
    horizontalLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) return
      const extendData = overlay.extendData as HorizontalLineExtendData | undefined
      if (!selectedHorizontalLineOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
      updateOverlayState(id, { handlePressed: false, hovered: false, pressed: false, selected: false })
    })
    if (!changed && !selectedOverlayId) return
    selectedOverlayId = null
    selectedHorizontalLineOverlayIds.clear()
    publishState({ selected: false })
    publishObjectTreeState()
  }

  const clearTrendLineSelection = () => {
    let changed = false
    trendLineOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
      changed = true
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
    if (!changed && !selectedTrendLineOverlayId) return
    selectedTrendLineOverlayId = null
    publishDrawingToolState({
      armed: pendingTrendLineOverlayId != null,
      locked: false,
      selected: false,
      showPriceLabel: true,
      tool: 'trendLine',
    })
    publishObjectTreeState()
  }

  const clearOtherTrendLineSelections = (activeId: string) => {
    trendLineOverlayIds.forEach((id) => {
      if (id === activeId) return
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected !== true && extendData?.pressed !== true && extendData?.endpointPressed !== true) return
      chart.overrideOverlay({
        id,
        extendData: {
          ...extendData,
          endpointPressed: false,
          pressed: false,
          pressedPointIndex: undefined,
          selected: false,
        },
      })
    })
  }

  const selectTrendLineForInteraction = (overlay: { id: string; extendData?: unknown }, additive: boolean, preserveSelection = false) => {
    if (!additive && !preserveSelection) {
      clearHorizontalLineSelection()
      clearOtherTrendLineSelections(overlay.id)
    }
    const extendData = overlay.extendData as TrendLineExtendData | undefined
    selectedTrendLineOverlayId = overlay.id
    lastSelectedTrendLineOverlayId = overlay.id
    lastSelectedTrendLineAt = Date.now()
    activeObjectTreeOverlayId = overlay.id
    chart.overrideOverlay({ id: overlay.id, extendData: { ...extendData, selected: true } })
    return extendData
  }

  const resolveSelectedTrendLineOverlayId = () => {
    if (selectedTrendLineOverlayId && chart.getOverlayById(selectedTrendLineOverlayId)) return selectedTrendLineOverlayId
    for (const id of trendLineOverlayIds) {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        trendLineOverlayIds.delete(id)
        continue
      }
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      if (extendData?.selected === true || extendData?.pressed === true) return id
    }
    return null
  }

  const resolveDeletableTrendLineOverlayId = () => {
    const selectedId = resolveSelectedTrendLineOverlayId()
    if (selectedId) return selectedId
    if (lastSelectedTrendLineOverlayId && Date.now() - lastSelectedTrendLineAt < 800 && chart.getOverlayById(lastSelectedTrendLineOverlayId)) {
      return lastSelectedTrendLineOverlayId
    }
    return null
  }

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
    getAdditiveSelectionActive: () => additiveSelectionActive,
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
    getAdditiveSelectionActive: () => additiveSelectionActive,
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

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = true
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === 'Control' || event.key === 'Meta') additiveSelectionActive = false
  }

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
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  const handleCommand = (event: Event) => {
    if (!isDrawingToolCommandEvent(event)) return

    if (event.detail.tool === 'trendLine') {
      if (event.detail.action === 'release') {
        if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
        hidePendingTrendStartHandle()
        pendingTrendLineOverlayId = null
        pendingTrendLineOptions = null
        publishDrawingToolState({
          armed: false,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'trendLine',
        })
        return
      }

      if (event.detail.action === 'updateSelectedTrendLineStyle') {
        pendingTrendLineOptions = pendingTrendLineOptions && event.detail.trendLineStyle
          ? { ...pendingTrendLineOptions, trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle) }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId && event.detail.trendLineStyle) {
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
            },
          })
        }
        if (selectedTrendLineOverlayId && event.detail.trendLineStyle) {
          const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: selectedTrendLineOverlayId,
            extendData: {
              ...extendData,
              trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
            },
          })
          persistCurrentTrendLines()
        }
        return
      }

      if (event.detail.action === 'toggleSelectedLock') {
        if (!selectedTrendLineOverlayId) return
        const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
        if (!overlay) return
        const extendData = overlay.extendData as TrendLineExtendData | undefined
        const locked = extendData?.locked !== true
        chart.overrideOverlay({
          id: selectedTrendLineOverlayId,
          extendData: {
            ...extendData,
            locked,
            selected: true,
          },
          lock: locked,
        })
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked,
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        persistCurrentTrendLines()
        return
      }

      if (event.detail.action === 'deleteSelected') {
        const deleteTargetTrendLineId = resolveDeletableTrendLineOverlayId()
        if (deleteTargetTrendLineId) {
          chart.removeOverlay({ id: deleteTargetTrendLineId })
          selectedTrendLineOverlayId = null
          lastSelectedTrendLineOverlayId = null
          persistCurrentTrendLines()
        }
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'trendLine',
        })
        return
      }

      if (event.detail.action === 'refreshSelectedState') {
        const selectedTrendLineId = resolveSelectedTrendLineOverlayId()
        if (!selectedTrendLineId) {
          publishDrawingToolState({
            armed: pendingTrendLineOverlayId != null,
            locked: false,
            selected: false,
            showPriceLabel: true,
            tool: 'trendLine',
          })
          return
        }
        const overlay = chart.getOverlayById(selectedTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay) {
          publishDrawingToolState({
            armed: pendingTrendLineOverlayId != null,
            locked: false,
            selected: false,
            showPriceLabel: true,
            tool: 'trendLine',
          })
          return
        }
        selectedTrendLineOverlayId = selectedTrendLineId
        activeObjectTreeOverlayId = selectedTrendLineId
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: Boolean(extendData?.locked),
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updatePersistence') {
        trendLinePersistenceEnabled = event.detail.persisted !== false
        if (trendLinePersistenceEnabled) {
          persistCurrentTrendLines()
        } else {
          clearStoredTrendLineDrawings()
        }
        return
      }

      if (event.detail.action === 'updateSelectedLineStyle') {
        pendingTrendLineOptions = pendingTrendLineOptions && event.detail.lineStyle
          ? { ...pendingTrendLineOptions, lineStyle: normalizeLineStyle(event.detail.lineStyle) }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId && event.detail.lineStyle) {
          const lineStyle = normalizeLineStyle(event.detail.lineStyle)
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              lineStyle,
            },
            styles: trendOverlayStylesFromLine(lineStyle),
          })
        }
        if (selectedTrendLineOverlayId && event.detail.lineStyle) {
          const lineStyle = normalizeLineStyle(event.detail.lineStyle)
          const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: selectedTrendLineOverlayId,
            extendData: {
              ...extendData,
              lineStyle,
            },
            styles: trendOverlayStylesFromLine(lineStyle),
          })
          persistCurrentTrendLines()
        }
        return
      }

      if (event.detail.action === 'updateSelectedTextStyle') {
        if (!event.detail.textStyle) return
        const textStyle = normalizeDrawingTextStyle(event.detail.textStyle)
        pendingTrendLineOptions = pendingTrendLineOptions
          ? { ...pendingTrendLineOptions, textStyle }
          : pendingTrendLineOptions
        if (pendingTrendLineOverlayId) {
          const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
          const extendData = overlay?.extendData as TrendLineExtendData | undefined
          chart.overrideOverlay({
            id: pendingTrendLineOverlayId,
            extendData: {
              ...extendData,
              textStyle,
            },
          })
        }
        const editableTrendLineId = resolveSelectedTrendLineOverlayId()
        if (!editableTrendLineId) return
        const overlay = chart.getOverlayById(editableTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay) return
        chart.overrideOverlay({
          id: editableTrendLineId,
          extendData: {
            ...extendData,
            selected: true,
            textStyle,
          },
        })
        selectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineAt = Date.now()
        activeObjectTreeOverlayId = editableTrendLineId
        persistCurrentTrendLines()
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: Boolean(extendData?.locked),
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle,
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updateSelectedPriceLabel') {
        const showPriceLabel = event.detail.showPriceLabel !== false
        pendingTrendLineOptions = pendingTrendLineOptions
          ? { ...pendingTrendLineOptions, showPriceLabel }
          : pendingTrendLineOptions
        const editableTrendLineId = resolveSelectedTrendLineOverlayId()
        if (!editableTrendLineId) return
        const overlay = chart.getOverlayById(editableTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay) return
        chart.overrideOverlay({
          id: editableTrendLineId,
          extendData: {
            ...extendData,
            showPriceLabel,
            selected: true,
          },
        })
        selectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineAt = Date.now()
        activeObjectTreeOverlayId = editableTrendLineId
        persistCurrentTrendLines()
        publishDrawingToolState({
          armed: pendingTrendLineOverlayId != null,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: Boolean(extendData?.locked),
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices(overlay),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action === 'updateSelectedTrendLinePointPrice') {
        const editableTrendLineId = resolveSelectedTrendLineOverlayId()
        const pointIndex = Number(event.detail.pointIndex)
        const price = Number(event.detail.price)
        if (!editableTrendLineId || !Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex > 1 || !Number.isFinite(price)) return
        const overlay = chart.getOverlayById(editableTrendLineId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        if (!overlay || extendData?.locked === true) return
        const points = [...overlay.points]
        points[pointIndex] = {
          ...(points[pointIndex] ?? {}),
          value: price,
        }
        chart.overrideOverlay({ id: editableTrendLineId, points })
        selectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineOverlayId = editableTrendLineId
        lastSelectedTrendLineAt = Date.now()
        activeObjectTreeOverlayId = editableTrendLineId
        persistCurrentTrendLines()
        publishDrawingToolState({
          armed: false,
          lineStyle: normalizeLineStyle(extendData?.lineStyle),
          locked: false,
          objectId: extendData?.objectId,
          selected: true,
          showPriceLabel: extendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
          tool: 'trendLine',
          trendPointPrices: resolveTrendPointPrices({ points }),
          trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
        })
        return
      }

      if (event.detail.action !== 'start') return
      const lineStyle = event.detail.lineStyle
      if (!lineStyle) return
      if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
      hidePendingTrendStartHandle()
      pendingTrendLineOptions = {
        lineStyle,
        locked: event.detail.locked === true,
        showPriceLabel: event.detail.showPriceLabel !== false,
        textStyle: event.detail.textStyle,
        trendLineStyle: normalizeDrawingTrendLineStyle(event.detail.trendLineStyle),
      }
      const overlayId = createTrendLineOverlay({
        ...pendingTrendLineOptions,
        paneId: getLastPointerPaneId(),
        selected: false,
      })
      pendingTrendLineOverlayId = typeof overlayId === 'string' ? overlayId : null
      if (pendingTrendLineOverlayId) trendLineOverlayIds.add(pendingTrendLineOverlayId)
      publishDrawingToolState({
        armed: pendingTrendLineOverlayId != null,
        lineStyle: normalizeLineStyle(lineStyle),
        locked: pendingTrendLineOptions.locked,
        selected: false,
        showPriceLabel: pendingTrendLineOptions.showPriceLabel,
        textStyle: normalizeDrawingTextStyle(pendingTrendLineOptions.textStyle),
        tool: 'trendLine',
        trendLineStyle: pendingTrendLineOptions.trendLineStyle,
      })
      return
    }

    if (event.detail.action === 'release') {
      if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
      pendingOverlayId = null
      pendingOverlayOptions = null
      publishState({ armed: false })
      return
    }

    if (event.detail.action === 'refreshSelectedState') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) {
        publishState({ selected: false })
        return
      }
      setSelectedHorizontalLine(editableOverlayId, false)
      publishState()
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'deleteSelected') {
      const deleteTargetOverlayId = resolveDeleteTargetOverlayId()
      if (deleteTargetOverlayId) chart.removeOverlay({ id: deleteTargetOverlayId })
      if (selectedOverlayId === deleteTargetOverlayId) selectedOverlayId = null
      if (lastSelectedOverlayId === deleteTargetOverlayId) lastSelectedOverlayId = null
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      return
    }

    if (event.detail.action === 'toggleSelectedLock') {
      if (!selectedOverlayId) return
      const overlay = chart.getOverlayById(selectedOverlayId)
      const locked = (overlay?.extendData as { locked?: boolean } | null)?.locked !== true
      updateOverlayState(selectedOverlayId, { locked })
      chart.overrideOverlay({ id: selectedOverlayId, lock: locked })
      persistCurrentHorizontalLines()
      publishState({ locked, selected: true })
      publishObjectTreeState()
      return
    }

    if (event.detail.action === 'updatePersistence') {
      persistenceEnabled = event.detail.persisted !== false
      if (persistenceEnabled) {
        persistCurrentHorizontalLines()
      } else {
        clearStoredHorizontalLineDrawings()
      }
      return
    }

    if (event.detail.action === 'updateSelectedLineStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !event.detail.lineStyle) return
      const lineStyle = normalizeLineStyle(event.detail.lineStyle)
      updateOverlayState(editableOverlayId, { lineStyle })
      chart.overrideOverlay({
        id: editableOverlayId,
        styles: overlayStylesFromLine(lineStyle),
      })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ lineStyle, selected: true })
      return
    }

    if (event.detail.action === 'updateSelectedPriceLabel') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) return
      const showPriceLabel = event.detail.showPriceLabel !== false
      updateOverlayState(editableOverlayId, { showPriceLabel })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ selected: true, showPriceLabel } as Partial<{ armed: boolean; locked: boolean; selected: boolean; showPriceLabel: boolean }>)
      return
    }

    if (event.detail.action === 'updateSelectedPrice') {
      const editableOverlayId = resolveEditableOverlayId()
      const price = Number(event.detail.price)
      if (!editableOverlayId || !Number.isFinite(price)) return
      const overlay = chart.getOverlayById(editableOverlayId)
      if (!overlay || (overlay.extendData as HorizontalLineExtendData | undefined)?.locked === true) return
      chart.overrideOverlay({
        id: editableOverlayId,
        points: [{
          ...(overlay.points[0] ?? {}),
          value: price,
        }],
      })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ price, selected: true })
      return
    }

    if (event.detail.action === 'updateSelectedTextStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !event.detail.textStyle) return
      const textStyle = normalizeDrawingTextStyle(event.detail.textStyle)
      updateOverlayState(editableOverlayId, { textStyle })
      selectedOverlayId = editableOverlayId
      lastSelectedOverlayId = editableOverlayId
      persistCurrentHorizontalLines()
      publishState({ selected: true, textStyle } as Partial<{ armed: boolean; locked: boolean; selected: boolean; textStyle: DrawingTextStyle }>)
      return
    }

    const lineStyle = event.detail.lineStyle
    if (!lineStyle) return

    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    pendingOverlayOptions = {
      lineStyle,
      locked: event.detail.locked === true,
      showPriceLabel: event.detail.showPriceLabel !== false,
      textStyle: event.detail.textStyle,
    }
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId: getLastPointerPaneId(),
      selected: false,
    })
    pendingOverlayId = typeof overlayId === 'string' ? overlayId : null
    applyHorizontalLineVisibility()
    publishState({ armed: pendingOverlayId != null, selected: selectedOverlayId != null })
    publishObjectTreeState()
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

  window.addEventListener(drawingToolCommandEvent, handleCommand)
  window.addEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
  window.addEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
  window.addEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
  window.addEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
  window.addEventListener('storage', handleStorage)
  chart.subscribeAction(ActionType.OnDataReady, handleDataReady)
  return () => {
    destroyed = true
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
    hidePendingTrendStartHandle()
    window.removeEventListener(drawingToolCommandEvent, handleCommand)
    window.removeEventListener(objectTreeDrawingCommandEvent, handleObjectTreeCommand)
    window.removeEventListener(objectTreeDrawingsRequestEvent, handleObjectTreeDrawingsRequest)
    window.removeEventListener(visibilityRangeChangedEvent, handleVisibilityRangeChanged)
    window.removeEventListener(chartDrawingVisibilityRefreshEvent, handleVisibilityRefresh)
    window.removeEventListener('storage', handleStorage)
    chart.unsubscribeAction(ActionType.OnDataReady, handleDataReady)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)
    paneInteractionController?.cleanup()
  }
}
