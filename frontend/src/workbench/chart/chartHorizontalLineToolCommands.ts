import type { Chart } from 'klinecharts'
import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { clearStoredHorizontalLineDrawings } from '../rightDrawer/drawingObjectPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingToolCommand } from '../rightDrawer/drawingToolCommands'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle, overlayStylesFromLine } from './chartDrawingStyle'
import type { HorizontalLineExtendData } from './chartDrawingTypes'

export type PendingHorizontalLineOptions = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
}

export function createHorizontalLineToolCommandHandler({
  applyHorizontalLineVisibility,
  chart,
  createHorizontalLineOverlay,
  getLastPointerPaneId,
  getPendingOverlayId,
  getPersistenceEnabled,
  getLastSelectedOverlayId,
  getSelectedOverlayId,
  persistCurrentHorizontalLines,
  publishObjectTreeState,
  publishState,
  resolveDeleteTargetOverlayId,
  resolveEditableOverlayId,
  setLastSelectedOverlayId,
  setPendingOverlayId,
  setPendingOverlayOptions,
  setPersistenceEnabled,
  setSelectedHorizontalLine,
  setSelectedOverlayId,
  updateOverlayState,
}: {
  applyHorizontalLineVisibility: () => void
  chart: Chart
  createHorizontalLineOverlay: (options: PendingHorizontalLineOptions & { paneId?: string; selected: boolean }) => unknown
  getLastPointerPaneId: () => string
  getPendingOverlayId: () => string | null
  getPersistenceEnabled: () => boolean
  getLastSelectedOverlayId: () => string | null
  getSelectedOverlayId: () => string | null
  persistCurrentHorizontalLines: () => void
  publishObjectTreeState: () => void
  publishState: (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => void
  resolveDeleteTargetOverlayId: () => string | null
  resolveEditableOverlayId: () => string | null
  setLastSelectedOverlayId: (id: string | null) => void
  setPendingOverlayId: (id: string | null) => void
  setPendingOverlayOptions: (options: PendingHorizontalLineOptions | null) => void
  setPersistenceEnabled: (enabled: boolean) => void
  setSelectedHorizontalLine: (id: string, additive: boolean) => void
  setSelectedOverlayId: (id: string | null) => void
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  return function handleHorizontalLineCommand(command: DrawingToolCommand) {
    if (command.tool !== 'horizontalLine') return

    if (command.action === 'release') {
      const pendingOverlayId = getPendingOverlayId()
      if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
      setPendingOverlayId(null)
      setPendingOverlayOptions(null)
      publishState({ armed: false })
      return
    }

    if (command.action === 'refreshSelectedState') {
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

    if (command.action === 'deleteSelected') {
      const deleteTargetOverlayId = resolveDeleteTargetOverlayId()
      if (deleteTargetOverlayId) chart.removeOverlay({ id: deleteTargetOverlayId })
      if (getSelectedOverlayId() === deleteTargetOverlayId) setSelectedOverlayId(null)
      if (getLastSelectedOverlayId() === deleteTargetOverlayId) setLastSelectedOverlayId(null)
      persistCurrentHorizontalLines()
      publishState({ selected: false })
      return
    }

    if (command.action === 'toggleSelectedLock') {
      const selectedOverlayId = getSelectedOverlayId()
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

    if (command.action === 'updatePersistence') {
      setPersistenceEnabled(command.persisted !== false)
      if (getPersistenceEnabled()) persistCurrentHorizontalLines()
      else clearStoredHorizontalLineDrawings()
      return
    }

    if (command.action === 'updateSelectedLineStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !command.lineStyle) return
      const lineStyle = normalizeLineStyle(command.lineStyle)
      updateOverlayState(editableOverlayId, { lineStyle })
      chart.overrideOverlay({
        id: editableOverlayId,
        styles: overlayStylesFromLine(lineStyle),
      })
      setSelectedOverlayId(editableOverlayId)
      setLastSelectedOverlayId(editableOverlayId)
      persistCurrentHorizontalLines()
      publishState({ lineStyle, selected: true })
      return
    }

    if (command.action === 'updateSelectedPriceLabel') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId) return
      const showPriceLabel = command.showPriceLabel !== false
      updateOverlayState(editableOverlayId, { showPriceLabel })
      setSelectedOverlayId(editableOverlayId)
      setLastSelectedOverlayId(editableOverlayId)
      persistCurrentHorizontalLines()
      publishState({ selected: true, showPriceLabel })
      return
    }

    if (command.action === 'updateSelectedPrice') {
      const editableOverlayId = resolveEditableOverlayId()
      const price = Number(command.price)
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
      setSelectedOverlayId(editableOverlayId)
      setLastSelectedOverlayId(editableOverlayId)
      persistCurrentHorizontalLines()
      publishState({ price, selected: true })
      return
    }

    if (command.action === 'updateSelectedTextStyle') {
      const editableOverlayId = resolveEditableOverlayId()
      if (!editableOverlayId || !command.textStyle) return
      const textStyle = normalizeDrawingTextStyle(command.textStyle)
      updateOverlayState(editableOverlayId, { textStyle })
      setSelectedOverlayId(editableOverlayId)
      setLastSelectedOverlayId(editableOverlayId)
      persistCurrentHorizontalLines()
      publishState({ selected: true, textStyle })
      return
    }

    const lineStyle = command.lineStyle
    if (!lineStyle) return

    const pendingOverlayId = getPendingOverlayId()
    if (pendingOverlayId) chart.removeOverlay({ id: pendingOverlayId })
    const pendingOverlayOptions: PendingHorizontalLineOptions = {
      lineStyle,
      locked: command.locked === true,
      showPriceLabel: command.showPriceLabel !== false,
      textStyle: command.textStyle,
    }
    setPendingOverlayOptions(pendingOverlayOptions)
    const overlayId = createHorizontalLineOverlay({
      ...pendingOverlayOptions,
      paneId: getLastPointerPaneId(),
      selected: false,
    })
    setPendingOverlayId(typeof overlayId === 'string' ? overlayId : null)
    applyHorizontalLineVisibility()
    publishState({ armed: typeof overlayId === 'string', selected: getSelectedOverlayId() != null })
    publishObjectTreeState()
  }
}
