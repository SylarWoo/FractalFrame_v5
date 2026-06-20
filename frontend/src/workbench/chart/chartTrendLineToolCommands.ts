import type { Chart } from 'klinecharts'
import { normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { clearStoredTrendLineDrawings } from '../rightDrawer/drawingObjectPersistence'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingToolCommand } from '../rightDrawer/drawingToolCommands'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeDrawingCrossPeriodTargets } from '../drawing/drawingCrossPeriodModel'
import { normalizeLineStyle, trendOverlayStylesFromLine } from './chartDrawingStyle'
import type { TrendLineExtendData } from './chartDrawingTypes'
import { publishTrendLineDeselectedState, publishTrendLineSelectedState, publishTrendLineStartedState } from './trendLineToolState'

export type PendingTrendLineOptions = {
  crossPeriod?: boolean
  crossPeriodTargets?: string[]
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  sourcePeriod?: string
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
}

export function createTrendLineToolCommandHandler({
  applyTrendLineVisibility,
  chart,
  createTrendLineOverlay,
  getPeriod,
  getLastPointerPaneId,
  getPendingTrendLineOptions,
  getPendingTrendLineOverlayId,
  getSelectedTrendLineOverlayId,
  getTrendLinePersistenceEnabled,
  hidePendingTrendStartHandle,
  persistCurrentTrendLines,
  resolveDeletableTrendLineOverlayId,
  resolveSelectedTrendLineOverlayId,
  resolveTrendPointPrices,
  setActiveObjectTreeOverlayId,
  setLastSelectedTrendLineOverlayId,
  setPendingTrendLineOptions,
  setPendingTrendLineOverlayId,
  setSelectedTrendLineOverlayId,
  setTrendLinePersistenceEnabled,
  trendLineOverlayIds,
}: {
  applyTrendLineVisibility: () => void
  chart: Chart
  createTrendLineOverlay: (options: PendingTrendLineOptions & { paneId?: string; selected: boolean }) => unknown
  getPeriod: () => string
  getLastPointerPaneId: () => string
  getPendingTrendLineOptions: () => PendingTrendLineOptions | null
  getPendingTrendLineOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  getTrendLinePersistenceEnabled: () => boolean
  hidePendingTrendStartHandle: () => void
  persistCurrentTrendLines: () => void
  resolveDeletableTrendLineOverlayId: () => string | null
  resolveSelectedTrendLineOverlayId: () => string | null
  resolveTrendPointPrices: (overlay: { points?: Array<{ value?: number }> } | null | undefined) => [number | undefined, number | undefined]
  setActiveObjectTreeOverlayId: (id: string | null) => void
  setLastSelectedTrendLineOverlayId: (id: string | null) => void
  setPendingTrendLineOptions: (options: PendingTrendLineOptions | null) => void
  setPendingTrendLineOverlayId: (id: string | null) => void
  setSelectedTrendLineOverlayId: (id: string | null) => void
  setTrendLinePersistenceEnabled: (enabled: boolean) => void
  trendLineOverlayIds: Set<string>
}) {
  const publishDeselectedState = () => {
    publishTrendLineDeselectedState(getPendingTrendLineOverlayId() != null)
  }

  const markSelectedTrendLine = (id: string) => {
    setSelectedTrendLineOverlayId(id)
    setLastSelectedTrendLineOverlayId(id)
    setActiveObjectTreeOverlayId(id)
  }

  return function handleTrendLineCommand(command: DrawingToolCommand) {
    if (command.tool !== 'trendLine') return

    if (command.action === 'release') {
      const pendingTrendLineOverlayId = getPendingTrendLineOverlayId()
      if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
      hidePendingTrendStartHandle()
      setPendingTrendLineOverlayId(null)
      setPendingTrendLineOptions(null)
      publishTrendLineDeselectedState(false)
      return
    }

    if (command.action === 'updateSelectedTrendLineStyle') {
      const pendingTrendLineOptions = getPendingTrendLineOptions()
      setPendingTrendLineOptions(pendingTrendLineOptions && command.trendLineStyle
        ? { ...pendingTrendLineOptions, trendLineStyle: normalizeDrawingTrendLineStyle(command.trendLineStyle) }
        : pendingTrendLineOptions)
      const pendingTrendLineOverlayId = getPendingTrendLineOverlayId()
      if (pendingTrendLineOverlayId && command.trendLineStyle) {
        const overlay = chart.getOverlayById(pendingTrendLineOverlayId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        chart.overrideOverlay({
          id: pendingTrendLineOverlayId,
          extendData: {
            ...extendData,
            trendLineStyle: normalizeDrawingTrendLineStyle(command.trendLineStyle),
          },
        })
      }
      const selectedTrendLineOverlayId = getSelectedTrendLineOverlayId()
      if (selectedTrendLineOverlayId && command.trendLineStyle) {
        const overlay = chart.getOverlayById(selectedTrendLineOverlayId)
        const extendData = overlay?.extendData as TrendLineExtendData | undefined
        chart.overrideOverlay({
          id: selectedTrendLineOverlayId,
          extendData: {
            ...extendData,
            trendLineStyle: normalizeDrawingTrendLineStyle(command.trendLineStyle),
          },
        })
        persistCurrentTrendLines()
      }
      return
    }

    if (command.action === 'toggleSelectedLock') {
      const selectedTrendLineOverlayId = getSelectedTrendLineOverlayId()
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
      publishTrendLineSelectedState({
        armed: false,
        locked,
        overlay,
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      persistCurrentTrendLines()
      return
    }

    if (command.action === 'deleteSelected') {
      const deleteTargetTrendLineId = resolveDeletableTrendLineOverlayId()
      if (deleteTargetTrendLineId) {
        chart.removeOverlay({ id: deleteTargetTrendLineId })
        setSelectedTrendLineOverlayId(null)
        setLastSelectedTrendLineOverlayId(null)
        persistCurrentTrendLines()
      }
      publishDeselectedState()
      return
    }

    if (command.action === 'refreshSelectedState') {
      const selectedTrendLineId = resolveSelectedTrendLineOverlayId()
      if (!selectedTrendLineId) {
        publishDeselectedState()
        return
      }
      const overlay = chart.getOverlayById(selectedTrendLineId)
      if (!overlay) {
        publishDeselectedState()
        return
      }
      setSelectedTrendLineOverlayId(selectedTrendLineId)
      setActiveObjectTreeOverlayId(selectedTrendLineId)
      publishTrendLineSelectedState({
        armed: getPendingTrendLineOverlayId() != null,
        overlay,
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      return
    }

    if (command.action === 'updatePersistence') {
      setTrendLinePersistenceEnabled(command.persisted !== false)
      if (getTrendLinePersistenceEnabled()) persistCurrentTrendLines()
      else clearStoredTrendLineDrawings()
      return
    }

    if (command.action === 'updateSelectedLineStyle') {
      const pendingTrendLineOptions = getPendingTrendLineOptions()
      setPendingTrendLineOptions(pendingTrendLineOptions && command.lineStyle
        ? { ...pendingTrendLineOptions, lineStyle: normalizeLineStyle(command.lineStyle) }
        : pendingTrendLineOptions)
      const pendingTrendLineOverlayId = getPendingTrendLineOverlayId()
      if (pendingTrendLineOverlayId && command.lineStyle) {
        const lineStyle = normalizeLineStyle(command.lineStyle)
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
      const selectedTrendLineOverlayId = getSelectedTrendLineOverlayId()
      if (selectedTrendLineOverlayId && command.lineStyle) {
        const lineStyle = normalizeLineStyle(command.lineStyle)
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

    if (command.action === 'updateSelectedCrossPeriod') {
      const pendingTrendLineOptions = getPendingTrendLineOptions()
      const sourcePeriod = pendingTrendLineOptions?.sourcePeriod || getPeriod().trim().toUpperCase()
      const pendingCrossPeriodTargets = normalizeDrawingCrossPeriodTargets(command.crossPeriodTargets ?? pendingTrendLineOptions?.crossPeriodTargets)
      setPendingTrendLineOptions(pendingTrendLineOptions
        ? { ...pendingTrendLineOptions, crossPeriod: command.crossPeriod === true, crossPeriodTargets: pendingCrossPeriodTargets, sourcePeriod }
        : pendingTrendLineOptions)
      const editableTrendLineId = resolveSelectedTrendLineOverlayId()
      if (!editableTrendLineId) return
      const overlay = chart.getOverlayById(editableTrendLineId)
      const extendData = overlay?.extendData as TrendLineExtendData | undefined
      if (!overlay) return
      const crossPeriodTargets = normalizeDrawingCrossPeriodTargets(command.crossPeriodTargets ?? extendData?.crossPeriodTargets)
      chart.overrideOverlay({
        id: editableTrendLineId,
        extendData: {
          ...extendData,
          crossPeriod: command.crossPeriod === true,
          crossPeriodTargets,
          selected: true,
          sourcePeriod: extendData?.sourcePeriod || getPeriod().trim().toUpperCase(),
        },
      })
      markSelectedTrendLine(editableTrendLineId)
      persistCurrentTrendLines()
      applyTrendLineVisibility()
      publishTrendLineSelectedState({
        armed: getPendingTrendLineOverlayId() != null,
        overlay: chart.getOverlayById(editableTrendLineId) ?? overlay,
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      return
    }

    if (command.action === 'updateSelectedTextStyle') {
      if (!command.textStyle) return
      const textStyle = normalizeDrawingTextStyle(command.textStyle)
      const pendingTrendLineOptions = getPendingTrendLineOptions()
      setPendingTrendLineOptions(pendingTrendLineOptions
        ? { ...pendingTrendLineOptions, textStyle }
        : pendingTrendLineOptions)
      const pendingTrendLineOverlayId = getPendingTrendLineOverlayId()
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
      markSelectedTrendLine(editableTrendLineId)
      persistCurrentTrendLines()
      publishTrendLineSelectedState({
        armed: getPendingTrendLineOverlayId() != null,
        overlay,
        textStyle,
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      return
    }

    if (command.action === 'updateSelectedPriceLabel') {
      const showPriceLabel = command.showPriceLabel !== false
      const pendingTrendLineOptions = getPendingTrendLineOptions()
      setPendingTrendLineOptions(pendingTrendLineOptions
        ? { ...pendingTrendLineOptions, showPriceLabel }
        : pendingTrendLineOptions)
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
      markSelectedTrendLine(editableTrendLineId)
      persistCurrentTrendLines()
      publishTrendLineSelectedState({
        armed: getPendingTrendLineOverlayId() != null,
        overlay,
        showPriceLabel,
        trendPointPrices: resolveTrendPointPrices(overlay),
      })
      return
    }

    if (command.action === 'updateSelectedTrendLinePointPrice') {
      const editableTrendLineId = resolveSelectedTrendLineOverlayId()
      const pointIndex = Number(command.pointIndex)
      const price = Number(command.price)
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
      markSelectedTrendLine(editableTrendLineId)
      persistCurrentTrendLines()
      publishTrendLineSelectedState({
        armed: false,
        locked: false,
        overlay: { ...overlay, points },
        trendPointPrices: resolveTrendPointPrices({ points }),
      })
      return
    }

    if (command.action !== 'start') return
    const lineStyle = command.lineStyle
    if (!lineStyle) return
    const pendingTrendLineOverlayId = getPendingTrendLineOverlayId()
    if (pendingTrendLineOverlayId) chart.removeOverlay({ id: pendingTrendLineOverlayId })
    hidePendingTrendStartHandle()
    const pendingTrendLineOptions: PendingTrendLineOptions = {
      crossPeriod: command.crossPeriod === true,
      crossPeriodTargets: normalizeDrawingCrossPeriodTargets(command.crossPeriodTargets),
      lineStyle,
      locked: command.locked === true,
      sourcePeriod: getPeriod().trim().toUpperCase(),
      showPriceLabel: command.showPriceLabel !== false,
      textStyle: command.textStyle,
      trendLineStyle: normalizeDrawingTrendLineStyle(command.trendLineStyle),
    }
    setPendingTrendLineOptions(pendingTrendLineOptions)
    const overlayId = createTrendLineOverlay({
      ...pendingTrendLineOptions,
      paneId: getLastPointerPaneId(),
      selected: false,
    })
    setPendingTrendLineOverlayId(typeof overlayId === 'string' ? overlayId : null)
    if (typeof overlayId === 'string') trendLineOverlayIds.add(overlayId)
    publishTrendLineStartedState({
      armed: typeof overlayId === 'string',
      crossPeriod: pendingTrendLineOptions.crossPeriod,
      crossPeriodTargets: pendingTrendLineOptions.crossPeriodTargets,
      lineStyle,
      locked: pendingTrendLineOptions.locked,
      showPriceLabel: pendingTrendLineOptions.showPriceLabel,
      sourcePeriod: pendingTrendLineOptions.sourcePeriod,
      textStyle: pendingTrendLineOptions.textStyle,
      trendLineStyle: pendingTrendLineOptions.trendLineStyle,
    })
  }
}
