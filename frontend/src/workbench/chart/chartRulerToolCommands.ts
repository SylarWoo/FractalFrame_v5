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
  clearStoredDrawings = clearStoredRulerDrawings,
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
  tool = 'ruler',
}: {
  chart: Chart
  clearStoredDrawings?: () => void
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
  tool?: 'ruler' | 'fibRetracement'
}) {
  const updatePendingAndSelected = (patch: Partial<RulerExtendData>, style?: DrawingRulerStyle) => {
    const pendingOptions = getPendingRulerOptions()
    setPendingRulerOptions(pendingOptions
      ? {
          ...pendingOptions,
          fibBackgroundOpacity: typeof patch.fibBackgroundOpacity === 'number' ? patch.fibBackgroundOpacity : pendingOptions.fibBackgroundOpacity,
          fibBackgroundVisible: typeof patch.fibBackgroundVisible === 'boolean' ? patch.fibBackgroundVisible : pendingOptions.fibBackgroundVisible,
          fibHorizontalLineStyle: patch.fibHorizontalLineStyle ? normalizeLineStyle(patch.fibHorizontalLineStyle) : pendingOptions.fibHorizontalLineStyle,
          fibLabelAlign: typeof patch.fibLabelAlign === 'string' ? patch.fibLabelAlign : pendingOptions.fibLabelAlign,
          fibLabelFontSize: typeof patch.fibLabelFontSize === 'string' ? patch.fibLabelFontSize : pendingOptions.fibLabelFontSize,
          fibLabelVAlign: typeof patch.fibLabelVAlign === 'string' ? patch.fibLabelVAlign : pendingOptions.fibLabelVAlign,
          fibLevelDisplay: typeof patch.fibLevelDisplay === 'string' ? patch.fibLevelDisplay : pendingOptions.fibLevelDisplay,
          fibLevelVisible: typeof patch.fibLevelVisible === 'boolean' ? patch.fibLevelVisible : pendingOptions.fibLevelVisible,
          fibLevels: Array.isArray(patch.fibLevels) ? patch.fibLevels : pendingOptions.fibLevels,
          fibPriceVisible: typeof patch.fibPriceVisible === 'boolean' ? patch.fibPriceVisible : pendingOptions.fibPriceVisible,
          fibQuarterLineStyles: Array.isArray(patch.fibQuarterLineStyles) ? patch.fibQuarterLineStyles : pendingOptions.fibQuarterLineStyles,
          fibQuarterSplitVisible: typeof patch.fibQuarterSplitVisible === 'boolean' ? patch.fibQuarterSplitVisible : pendingOptions.fibQuarterSplitVisible,
          fibReverse: typeof patch.fibReverse === 'boolean' ? patch.fibReverse : pendingOptions.fibReverse,
          lineStyle: patch.lineStyle ? normalizeLineStyle(patch.lineStyle) : pendingOptions.lineStyle,
          fibTrendLineStyle: patch.fibTrendLineStyle ? normalizeLineStyle(patch.fibTrendLineStyle) : pendingOptions.fibTrendLineStyle,
          fibTrendLineVisible: typeof patch.fibTrendLineVisible === 'boolean' ? patch.fibTrendLineVisible : pendingOptions.fibTrendLineVisible,
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
    if (command.tool !== tool) return

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
          tool,
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
        tool,
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
          tool,
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
          tool,
        })
        return
      }
      setActiveObjectTreeOverlayId(selectedId)
      publishDrawingToolState({
        armed: getPendingRulerOverlayId() != null,
        fibBackgroundOpacity: extendData?.fibBackgroundOpacity,
        fibBackgroundVisible: extendData?.fibBackgroundVisible,
        fibHorizontalLineStyle: extendData?.fibHorizontalLineStyle,
        fibLabelAlign: extendData?.fibLabelAlign,
        fibLabelFontSize: extendData?.fibLabelFontSize,
        fibLabelVAlign: extendData?.fibLabelVAlign,
        fibLevelDisplay: extendData?.fibLevelDisplay,
        fibLevelVisible: extendData?.fibLevelVisible,
        fibLevels: extendData?.fibLevels,
        fibPriceVisible: extendData?.fibPriceVisible,
        fibQuarterLineStyles: extendData?.fibQuarterLineStyles,
        fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible,
        fibReverse: extendData?.fibReverse,
        fibTrendLineStyle: extendData?.fibTrendLineStyle ? normalizeLineStyle(extendData.fibTrendLineStyle) : undefined,
        fibTrendLineVisible: extendData?.fibTrendLineVisible,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: extendData?.locked === true,
        objectId: extendData?.objectId,
        rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool,
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      return
    }

    if (command.action === 'updatePersistence') {
      setRulerPersistenceEnabled(command.persisted !== false)
      if (getRulerPersistenceEnabled()) persistCurrentRulers()
      else clearStoredDrawings()
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
        fibBackgroundOpacity: extendData?.fibBackgroundOpacity,
        fibBackgroundVisible: extendData?.fibBackgroundVisible,
        fibHorizontalLineStyle: extendData?.fibHorizontalLineStyle,
        fibLabelAlign: extendData?.fibLabelAlign,
        fibLabelFontSize: extendData?.fibLabelFontSize,
        fibLabelVAlign: extendData?.fibLabelVAlign,
        fibLevelDisplay: extendData?.fibLevelDisplay,
        fibLevelVisible: extendData?.fibLevelVisible,
        fibLevels: extendData?.fibLevels,
        fibPriceVisible: extendData?.fibPriceVisible,
        fibQuarterLineStyles: extendData?.fibQuarterLineStyles,
        fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible,
        fibReverse: extendData?.fibReverse,
        fibTrendLineStyle: extendData?.fibTrendLineStyle ? normalizeLineStyle(extendData.fibTrendLineStyle) : undefined,
        fibTrendLineVisible: extendData?.fibTrendLineVisible,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked,
        objectId: extendData?.objectId,
        rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool,
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

    if (command.action === 'updateSelectedFibTrendLine') {
      updatePendingAndSelected({
        ...(command.fibTrendLineStyle ? { fibTrendLineStyle: normalizeLineStyle(command.fibTrendLineStyle) } : {}),
        ...(typeof command.fibTrendLineVisible === 'boolean' ? { fibTrendLineVisible: command.fibTrendLineVisible } : {}),
      })
      return
    }

    if (command.action === 'updateSelectedFibRetracementStyle') {
      updatePendingAndSelected({
        ...(typeof command.fibBackgroundOpacity === 'number' ? { fibBackgroundOpacity: command.fibBackgroundOpacity } : {}),
        ...(typeof command.fibBackgroundVisible === 'boolean' ? { fibBackgroundVisible: command.fibBackgroundVisible } : {}),
        ...(command.fibHorizontalLineStyle ? { fibHorizontalLineStyle: normalizeLineStyle(command.fibHorizontalLineStyle) } : {}),
        ...(typeof command.fibLabelAlign === 'string' ? { fibLabelAlign: command.fibLabelAlign } : {}),
        ...(typeof command.fibLabelFontSize === 'string' ? { fibLabelFontSize: command.fibLabelFontSize } : {}),
        ...(typeof command.fibLabelVAlign === 'string' ? { fibLabelVAlign: command.fibLabelVAlign } : {}),
        ...(typeof command.fibLevelDisplay === 'string' ? { fibLevelDisplay: command.fibLevelDisplay } : {}),
        ...(typeof command.fibLevelVisible === 'boolean' ? { fibLevelVisible: command.fibLevelVisible } : {}),
        ...(Array.isArray(command.fibLevels) ? { fibLevels: command.fibLevels } : {}),
        ...(typeof command.fibPriceVisible === 'boolean' ? { fibPriceVisible: command.fibPriceVisible } : {}),
        ...(Array.isArray(command.fibQuarterLineStyles) ? { fibQuarterLineStyles: command.fibQuarterLineStyles.map(normalizeLineStyle) } : {}),
        ...(typeof command.fibQuarterSplitVisible === 'boolean' ? { fibQuarterSplitVisible: command.fibQuarterSplitVisible } : {}),
        ...(typeof command.fibReverse === 'boolean' ? { fibReverse: command.fibReverse } : {}),
      })
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
        fibBackgroundOpacity: extendData?.fibBackgroundOpacity,
        fibBackgroundVisible: extendData?.fibBackgroundVisible,
        fibHorizontalLineStyle: extendData?.fibHorizontalLineStyle,
        fibLabelAlign: extendData?.fibLabelAlign,
        fibLabelFontSize: extendData?.fibLabelFontSize,
        fibLabelVAlign: extendData?.fibLabelVAlign,
        fibLevelDisplay: extendData?.fibLevelDisplay,
        fibLevelVisible: extendData?.fibLevelVisible,
        fibLevels: extendData?.fibLevels,
        fibPriceVisible: extendData?.fibPriceVisible,
        fibQuarterLineStyles: extendData?.fibQuarterLineStyles,
        fibQuarterSplitVisible: extendData?.fibQuarterSplitVisible,
        fibReverse: extendData?.fibReverse,
        fibTrendLineStyle: extendData?.fibTrendLineStyle ? normalizeLineStyle(extendData.fibTrendLineStyle) : undefined,
        fibTrendLineVisible: extendData?.fibTrendLineVisible,
        lineStyle: normalizeLineStyle(extendData?.lineStyle),
        locked: false,
        objectId: extendData?.objectId,
        rulerStyle: normalizeDrawingRulerStyle(extendData?.rulerStyle),
        selected: true,
        showPriceLabel: extendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(extendData?.textStyle),
        tool,
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
      fibBackgroundOpacity: command.fibBackgroundOpacity,
      fibBackgroundVisible: command.fibBackgroundVisible,
      fibTrendLineStyle: command.fibTrendLineStyle ? normalizeLineStyle(command.fibTrendLineStyle) : undefined,
      fibTrendLineVisible: command.fibTrendLineVisible,
      fibHorizontalLineStyle: command.fibHorizontalLineStyle ? normalizeLineStyle(command.fibHorizontalLineStyle) : undefined,
      fibLabelAlign: command.fibLabelAlign,
      fibLabelFontSize: command.fibLabelFontSize,
      fibLabelVAlign: command.fibLabelVAlign,
      fibLevelDisplay: command.fibLevelDisplay,
      fibLevelVisible: command.fibLevelVisible,
      fibLevels: command.fibLevels,
      fibPriceVisible: command.fibPriceVisible,
      fibQuarterLineStyles: Array.isArray(command.fibQuarterLineStyles) ? command.fibQuarterLineStyles.map(normalizeLineStyle) : undefined,
      fibQuarterSplitVisible: command.fibQuarterSplitVisible,
      fibReverse: command.fibReverse,
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
