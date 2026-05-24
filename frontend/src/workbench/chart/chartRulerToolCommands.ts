import type { Chart } from 'klinecharts'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { clearStoredRulerDrawings } from '../rightDrawer/drawingObjectPersistence'
import type { DrawingToolCommand } from '../rightDrawer/drawingToolCommands'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { DrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { normalizeLineStyle, trendOverlayStylesFromLine } from './chartDrawingStyle'
import type { RulerExtendData } from './chartDrawingTypes'
import type { PendingRulerOptions } from './rulerOverlayController'

export function createRulerToolCommandHandler({
  chart,
  createRulerOverlay,
  getLastPointerPaneId,
  getPendingRulerOptions,
  getPendingRulerOverlayId,
  getRulerPersistenceEnabled,
  getSelectedRulerOverlayId,
  persistCurrentRulers,
  resolveTrendPointPrices,
  setActiveObjectTreeOverlayId,
  setPendingRulerOptions,
  setPendingRulerOverlayId,
  setRulerPersistenceEnabled,
  setSelectedRulerOverlayId,
  rulerOverlayIds,
}: {
  chart: Chart
  createRulerOverlay: (options: PendingRulerOptions & { paneId?: string; selected: boolean }) => unknown
  getLastPointerPaneId: () => string
  getPendingRulerOptions: () => PendingRulerOptions | null
  getPendingRulerOverlayId: () => string | null
  getRulerPersistenceEnabled: () => boolean
  getSelectedRulerOverlayId: () => string | null
  persistCurrentRulers: () => void
  resolveTrendPointPrices: (overlay: { points?: Array<{ value?: number }> } | null | undefined) => [number | undefined, number | undefined]
  setActiveObjectTreeOverlayId: (id: string | null) => void
  setPendingRulerOptions: (options: PendingRulerOptions | null) => void
  setPendingRulerOverlayId: (id: string | null) => void
  setRulerPersistenceEnabled: (enabled: boolean) => void
  setSelectedRulerOverlayId: (id: string | null) => void
  rulerOverlayIds: Set<string>
}) {
  const updatePendingAndSelected = (patch: Partial<RulerExtendData>, style?: DrawingRulerStyle) => {
    const pendingOptions = getPendingRulerOptions()
    setPendingRulerOptions(pendingOptions
      ? {
          ...pendingOptions,
          lineStyle: patch.lineStyle ? normalizeLineStyle(patch.lineStyle) : pendingOptions.lineStyle,
          rulerStyle: style ? normalizeDrawingRulerStyle(style) : pendingOptions.rulerStyle,
          showPriceLabel: typeof patch.showPriceLabel === 'boolean' ? patch.showPriceLabel : pendingOptions.showPriceLabel,
          textStyle: patch.textStyle ? normalizeDrawingTextStyle(patch.textStyle) : pendingOptions.textStyle,
        }
      : pendingOptions)
    ;[getPendingRulerOverlayId(), getSelectedRulerOverlayId()].forEach((id) => {
      if (!id) return
      const overlay = chart.getOverlayById(id)
      const extendData = overlay?.extendData as RulerExtendData | undefined
      if (!overlay) return
      chart.overrideOverlay({
        id,
        extendData: {
          ...extendData,
          ...patch,
          rulerStyle: style ? normalizeDrawingRulerStyle(style) : patch.rulerStyle ?? extendData?.rulerStyle,
        },
        styles: patch.lineStyle ? trendOverlayStylesFromLine(normalizeLineStyle(patch.lineStyle)) : undefined,
      })
    })
    persistCurrentRulers()
  }

  return function handleRulerCommand(command: DrawingToolCommand) {
    if (command.tool !== 'ruler') return

    if (command.action === 'release') {
      const pendingId = getPendingRulerOverlayId()
      if (pendingId) chart.removeOverlay({ id: pendingId })
      setPendingRulerOverlayId(null)
      setPendingRulerOptions(null)
      return
    }

    if (command.action === 'deleteSelected') {
      const selectedId = getSelectedRulerOverlayId()
      if (!selectedId) {
        publishDrawingToolState({
          armed: getPendingRulerOverlayId() != null,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'ruler',
        })
        return
      }
      const overlay = chart.getOverlayById(selectedId)
      const extendData = overlay?.extendData as RulerExtendData | undefined
      if (overlay) {
        chart.overrideOverlay({
          id: selectedId,
          extendData: {
            ...extendData,
            endpointPressed: false,
            locked: false,
            pressed: false,
            pressedPointIndex: undefined,
            selected: false,
          },
          lock: false,
        })
      }
      chart.removeOverlay({ id: selectedId })
      setSelectedRulerOverlayId(null)
      setActiveObjectTreeOverlayId(null)
      publishDrawingToolState({
        armed: getPendingRulerOverlayId() != null,
        locked: false,
        selected: false,
        showPriceLabel: true,
        tool: 'ruler',
      })
      return
    }

    if (command.action === 'refreshSelectedState') {
      const selectedId = getSelectedRulerOverlayId()
      if (!selectedId) {
        publishDrawingToolState({
          armed: getPendingRulerOverlayId() != null,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'ruler',
        })
        return
      }
      const overlay = chart.getOverlayById(selectedId)
      const extendData = overlay?.extendData as RulerExtendData | undefined
      if (!overlay) {
        publishDrawingToolState({
          armed: getPendingRulerOverlayId() != null,
          locked: false,
          selected: false,
          showPriceLabel: true,
          tool: 'ruler',
        })
        return
      }
      setActiveObjectTreeOverlayId(selectedId)
      publishDrawingToolState({
        armed: getPendingRulerOverlayId() != null,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        objectId: extendData?.objectId,
        rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'ruler',
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      return
    }

    if (command.action === 'updatePersistence') {
      setRulerPersistenceEnabled(command.persisted !== false)
      if (getRulerPersistenceEnabled()) persistCurrentRulers()
      else clearStoredRulerDrawings()
      return
    }

    if (command.action === 'toggleSelectedLock') {
      const selectedId = getSelectedRulerOverlayId()
      if (!selectedId) return
      const overlay = chart.getOverlayById(selectedId)
      if (!overlay) return
      const extendData = overlay.extendData as RulerExtendData | undefined
      const locked = extendData?.locked !== true
      chart.overrideOverlay({
        id: selectedId,
        extendData: {
          ...extendData,
          locked,
          selected: true,
        },
        lock: locked,
      })
      setActiveObjectTreeOverlayId(selectedId)
      persistCurrentRulers()
      publishDrawingToolState({
        armed: getPendingRulerOverlayId() != null,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked,
        objectId: extendData?.objectId,
        rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'ruler',
      })
      return
    }

    if (command.action === 'updateSelectedLineStyle' && command.lineStyle) {
      updatePendingAndSelected({ lineStyle: normalizeLineStyle(command.lineStyle) })
      return
    }

    if (command.action === 'updateSelectedRulerStyle' && command.rulerStyle) {
      updatePendingAndSelected({ rulerStyle: normalizeDrawingRulerStyle(command.rulerStyle) }, command.rulerStyle)
      return
    }

    if (command.action === 'updateSelectedTextStyle' && command.textStyle) {
      updatePendingAndSelected({ textStyle: normalizeDrawingTextStyle(command.textStyle) })
      return
    }

    if (command.action === 'updateSelectedPriceLabel') {
      updatePendingAndSelected({ showPriceLabel: command.showPriceLabel !== false })
      return
    }

    if (command.action === 'updateSelectedTrendLinePointPrice') {
      const selectedId = getSelectedRulerOverlayId()
      const pointIndex = Number(command.pointIndex)
      const price = Number(command.price)
      if (!selectedId || !Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex > 1 || !Number.isFinite(price)) return
      const overlay = chart.getOverlayById(selectedId)
      const extendData = overlay?.extendData as RulerExtendData | undefined
      if (!overlay || extendData?.locked === true) return
      const points = [...overlay.points]
      points[pointIndex] = {
        ...(points[pointIndex] ?? {}),
        value: price,
      }
      chart.overrideOverlay({ id: selectedId, points })
      setActiveObjectTreeOverlayId(selectedId)
      persistCurrentRulers()
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: false,
        objectId: extendData?.objectId,
        rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool: 'ruler',
        trendPointPrices: resolveTrendPointPrices({ points }),
      })
      return
    }

    if (command.action !== 'start') return
    if (!command.lineStyle || !command.rulerStyle) return
    const pendingId = getPendingRulerOverlayId()
    if (pendingId) chart.removeOverlay({ id: pendingId })
    const options: PendingRulerOptions = {
      lineStyle: normalizeLineStyle(command.lineStyle),
      locked: command.locked === true,
      rulerStyle: normalizeDrawingRulerStyle(command.rulerStyle),
      showPriceLabel: command.showPriceLabel !== false,
      textStyle: command.textStyle,
    }
    setPendingRulerOptions(options)
    const overlayId = createRulerOverlay({
      ...options,
      paneId: getLastPointerPaneId(),
      selected: false,
    })
    setPendingRulerOverlayId(typeof overlayId === 'string' ? overlayId : null)
    if (typeof overlayId === 'string') rulerOverlayIds.add(overlayId)
  }
}
