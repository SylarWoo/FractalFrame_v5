import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'

export function createChartDrawingPaneInteractionController({
  chart,
  clearFibSelection = () => undefined,
  clearHorizontalLineSelection,
  clearRulerSelection,
  clearTrendLineSelection,
  createHorizontalLineOverlay,
  eventHitsFib = () => false,
  eventHitsHorizontalLine,
  eventHitsRuler,
  eventHitsTrendLine,
  fallbackPaneId,
  getDestroyed,
  getPendingOverlayId,
  getPendingOverlayOptions,
  publishHorizontalLineState,
  setPendingOverlayId,
}: {
  chart: Chart
  clearFibSelection?: () => void
  clearHorizontalLineSelection: () => void
  clearRulerSelection: () => void
  clearTrendLineSelection: () => void
  createHorizontalLineOverlay: (options: {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    manualVisible?: boolean
    objectId?: string
    paneId?: string
    points?: Array<{ value: number }>
    selected: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  }) => unknown
  eventHitsFib?: (event: MouseEvent, paneId: string) => boolean
  eventHitsHorizontalLine: (event: MouseEvent, paneId: string) => boolean
  eventHitsRuler: (event: MouseEvent, paneId: string) => boolean
  eventHitsTrendLine: (event: MouseEvent, paneId: string) => boolean
  fallbackPaneId: string
  getDestroyed: () => boolean
  getPendingOverlayId: () => string | null
  getPendingOverlayOptions: () => {
    lineStyle: SettingsLineSwatchValue
    locked: boolean
    showPriceLabel: boolean
    textStyle?: DrawingTextStyle
  } | null
  publishHorizontalLineState: (state?: Partial<{ armed: boolean }>) => void
  setPendingOverlayId: (id: string | null) => void
}) {
  const paneInteractionCleanups: Array<() => void> = []
  const registeredPaneInteractions = new Map<string, { cleanup: () => void; element: HTMLElement }>()
  let lastPointerPaneId = fallbackPaneId

  const handlePaneClick = (event: MouseEvent, paneId: string) => {
    window.setTimeout(() => {
      if (getDestroyed()) return
      if (eventHitsHorizontalLine(event, paneId)) return
      if (eventHitsTrendLine(event, paneId)) return
      if (eventHitsRuler(event, paneId)) return
      if (eventHitsFib(event, paneId)) return
      clearHorizontalLineSelection()
      clearTrendLineSelection()
      clearRulerSelection()
      clearFibSelection()
    }, 0)
  }

  const recreatePendingOverlayForPane = (paneId: string) => {
    const pendingOverlayId = getPendingOverlayId()
    const pendingOverlayOptions = getPendingOverlayOptions()
    if (!pendingOverlayId || !pendingOverlayOptions) return
    const overlay = chart.getOverlayById(pendingOverlayId)
    if (!overlay || (overlay.points?.length ?? 0) > 0 || (overlay.paneId || fallbackPaneId) === paneId) return
    chart.removeOverlay({ id: pendingOverlayId })
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId,
      selected: false,
    })
    setPendingOverlayId(typeof overlayId === 'string' ? overlayId : null)
    publishHorizontalLineState({ armed: typeof overlayId === 'string' })
  }

  const setPointerPane = (paneId: string) => {
    if (lastPointerPaneId === paneId) return
    lastPointerPaneId = paneId
    recreatePendingOverlayForPane(paneId)
  }

  const ensurePaneInteractionListeners = () => {
    knownDrawingPaneIds.forEach((paneId) => {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) return
      const registered = registeredPaneInteractions.get(paneId)
      if (registered?.element === paneMain) return
      registered?.cleanup()
      const handleClick = (event: MouseEvent) => handlePaneClick(event, paneId)
      const handlePointer = () => setPointerPane(paneId)
      paneMain.addEventListener('click', handleClick, true)
      paneMain.addEventListener('mouseenter', handlePointer)
      paneMain.addEventListener('pointerenter', handlePointer)
      paneMain.addEventListener('mousemove', handlePointer)
      const cleanup = () => {
        paneMain.removeEventListener('click', handleClick, true)
        paneMain.removeEventListener('mouseenter', handlePointer)
        paneMain.removeEventListener('pointerenter', handlePointer)
        paneMain.removeEventListener('mousemove', handlePointer)
      }
      paneInteractionCleanups.push(cleanup)
      registeredPaneInteractions.set(paneId, { cleanup, element: paneMain })
    })
  }

  const cleanup = () => {
    paneInteractionCleanups.forEach((removeListener) => removeListener())
    paneInteractionCleanups.length = 0
    registeredPaneInteractions.clear()
  }

  return {
    cleanup,
    ensurePaneInteractionListeners,
    getLastPointerPaneId: () => lastPointerPaneId,
  }
}
