import type { Chart } from 'klinecharts'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import type { ObjectTreeDrawingCommand } from '../rightDrawer/objectTree/objectTreeTypes'
import { normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle } from './chartDrawingStyle'
import { resolveDrawingObjectTreeTarget } from './chartDrawingObjectTreeState'
import type { DrawingObjectTreeTarget } from './chartDrawingObjectTreeState'
import type { HorizontalLineExtendData, TrendLineExtendData } from './chartDrawingTypes'

type DrawingOverlay = NonNullable<ReturnType<Chart['getOverlayById']>>

export function createDrawingObjectTreeCommandHandler({
  chart,
  clearHorizontalLineSelection,
  clearTrendLineSelection,
  getActiveObjectTreeOverlayId,
  getSelectedOverlayId,
  getSelectedTrendLineOverlayId,
  horizontalLineOverlayIds,
  isHorizontalLineVisibleInCurrentPeriod,
  isTrendLineVisibleInCurrentPeriod,
  persistCurrentHorizontalLines,
  persistCurrentTrendLines,
  publishHorizontalLineState,
  publishObjectTreeState,
  resolveTrendPointPrices,
  restoreObjectCurrentPeriodVisibility,
  selectedHorizontalLineOverlayIds,
  setActiveObjectTreeOverlayId,
  setLastSelectedTrendLine,
  setSelectedOverlayId,
  setSelectedTrendLineOverlayId,
  setSelectedHorizontalLine,
  toggleSelectedHorizontalLine,
  trendLineOverlayIds,
  updateOverlayState,
}: {
  chart: Chart
  clearHorizontalLineSelection: () => void
  clearTrendLineSelection: () => void
  getActiveObjectTreeOverlayId: () => string | null
  getSelectedOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  horizontalLineOverlayIds: Set<string>
  isHorizontalLineVisibleInCurrentPeriod: (objectId?: string) => boolean
  isTrendLineVisibleInCurrentPeriod: (objectId?: string) => boolean
  persistCurrentHorizontalLines: () => void
  persistCurrentTrendLines: () => void
  publishHorizontalLineState: (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => void
  publishObjectTreeState: () => void
  resolveTrendPointPrices: (overlay: { points?: Array<{ value?: number }> } | null | undefined) => [number | undefined, number | undefined]
  restoreObjectCurrentPeriodVisibility: (kind: DrawingObjectTreeTarget['kind'], objectId?: string) => void
  selectedHorizontalLineOverlayIds: Set<string>
  setActiveObjectTreeOverlayId: (id: string | null) => void
  setLastSelectedTrendLine: (id: string) => void
  setSelectedOverlayId: (id: string | null) => void
  setSelectedHorizontalLine: (id: string, additive: boolean) => void
  setSelectedTrendLineOverlayId: (id: string | null) => void
  toggleSelectedHorizontalLine: (id: string) => void
  trendLineOverlayIds: Set<string>
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  const resolveTarget = (treeId: string) => resolveDrawingObjectTreeTarget({
    chart,
    horizontalLineOverlayIds,
    treeId,
    trendLineOverlayIds,
  })
  const resolveTargets = (command: ObjectTreeDrawingCommand) => {
    if (!('id' in command)) return []
    const ids = 'ids' in command && Array.isArray(command.ids) ? command.ids : [command.id]
    return ids
      .map((targetId) => resolveTarget(targetId))
      .filter((row): row is DrawingObjectTreeTarget => Boolean(row))
  }

  return function handleObjectTreeCommand(command: ObjectTreeDrawingCommand) {
    if (command.action === 'deselectAll') {
      clearHorizontalLineSelection()
      clearTrendLineSelection()
      return
    }
    const target = resolveTarget(command.id)
    if (!target) return
    const overlay = chart.getOverlayById(target.id)
    if (!overlay) return

    if (command.action === 'delete') {
      resolveTargets(command).forEach((row) => chart.removeOverlay({ id: row.id }))
      return
    }

    if (command.action === 'setVisible') {
      handleSetVisible(command, resolveTargets(command))
      return
    }

    if (command.action === 'setLocked') {
      handleSetLocked(command, resolveTargets(command))
      return
    }

    if (command.action === 'select') {
      handleSelect(command, target, overlay)
      return
    }

    if (command.action === 'deselect') {
      handleDeselect(target, overlay)
    }
  }

  function handleSetVisible(command: Extract<ObjectTreeDrawingCommand, { action: 'setVisible' }>, targets: DrawingObjectTreeTarget[]) {
    const manualVisible = command.visible
    targets.forEach((row) => {
      const targetOverlay = chart.getOverlayById(row.id)
      if (!targetOverlay) return
      const targetExtendData = targetOverlay.extendData as HorizontalLineExtendData | TrendLineExtendData | undefined
      let periodVisible = row.kind === 'horizontalLine'
        ? isHorizontalLineVisibleInCurrentPeriod(targetExtendData?.objectId)
        : isTrendLineVisibleInCurrentPeriod(targetExtendData?.objectId)
      if (manualVisible && !periodVisible) {
        restoreObjectCurrentPeriodVisibility(row.kind, targetExtendData?.objectId)
        periodVisible = true
      }
      const visible = manualVisible && periodVisible
      chart.overrideOverlay({
        id: row.id,
        extendData: {
          ...(targetOverlay.extendData ?? {}),
          manualVisible,
          periodVisible,
          selected: row.kind === 'horizontalLine'
            ? selectedHorizontalLineOverlayIds.has(row.id)
            : getSelectedTrendLineOverlayId() === row.id || (targetExtendData as TrendLineExtendData | undefined)?.selected === true,
        },
        visible: manualVisible,
      })
      if (!visible && row.kind === 'horizontalLine') updateOverlayState(row.id, { handlePressed: false, hovered: false, pressed: false })
      if (!visible && row.kind === 'trendLine') {
        chart.overrideOverlay({
          id: row.id,
          extendData: {
            ...(targetOverlay.extendData ?? {}),
            endpointPressed: false,
            hovered: false,
            manualVisible,
            periodVisible,
            pressed: false,
            pressedPointIndex: undefined,
            selected: getSelectedTrendLineOverlayId() === row.id || (targetExtendData as TrendLineExtendData | undefined)?.selected === true,
          },
        })
      }
    })
    persistCurrentHorizontalLines()
    persistCurrentTrendLines()
    publishObjectTreeState()
  }

  function handleSetLocked(command: Extract<ObjectTreeDrawingCommand, { action: 'setLocked' }>, targets: DrawingObjectTreeTarget[]) {
    targets.forEach((row) => {
      const targetOverlay = chart.getOverlayById(row.id)
      if (!targetOverlay) return
      chart.overrideOverlay({
        id: row.id,
        extendData: {
          ...(targetOverlay.extendData ?? {}),
          locked: command.locked,
        },
        lock: command.locked,
      })
    })
    persistCurrentHorizontalLines()
    persistCurrentTrendLines()
    publishObjectTreeState()
  }

  function handleSelect(command: Extract<ObjectTreeDrawingCommand, { action: 'select' }>, target: DrawingObjectTreeTarget, overlay: DrawingOverlay) {
    if (target.kind === 'horizontalLine') {
      if (command.additive === true) {
        toggleSelectedHorizontalLine(target.id)
      } else {
        clearTrendLineSelection()
        setSelectedHorizontalLine(target.id, false)
      }
      publishHorizontalLineState({ selected: true })
    } else {
      if (command.additive !== true) clearHorizontalLineSelection()
      if (command.additive !== true) {
        trendLineOverlayIds.forEach((overlayId) => {
          if (overlayId === target.id) return
          const rowOverlay = chart.getOverlayById(overlayId)
          const rowExtendData = rowOverlay?.extendData as TrendLineExtendData | undefined
          if (!rowOverlay || rowExtendData?.selected !== true) return
          chart.overrideOverlay({ id: overlayId, extendData: { ...rowExtendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
        })
      }
      const targetExtendData = overlay.extendData as TrendLineExtendData | undefined
      const nextSelected = command.additive === true && targetExtendData?.selected === true ? false : true
      setSelectedTrendLineOverlayId(nextSelected ? target.id : null)
      if (nextSelected) {
        setLastSelectedTrendLine(target.id)
        setActiveObjectTreeOverlayId(target.id)
      } else if (getActiveObjectTreeOverlayId() === target.id) {
        setActiveObjectTreeOverlayId(getSelectedOverlayId())
      }
      chart.overrideOverlay({
        id: target.id,
        extendData: {
          ...targetExtendData,
          selected: nextSelected,
        },
      })
      publishDrawingToolState({
        armed: false,
        lineStyle: normalizeLineStyle(targetExtendData?.lineStyle),
        locked: targetExtendData?.locked === true,
        objectId: targetExtendData?.objectId,
        selected: nextSelected,
        showPriceLabel: targetExtendData?.showPriceLabel !== false,
        textStyle: normalizeDrawingTextStyle(targetExtendData?.textStyle),
        tool: 'trendLine',
        trendPointPrices: resolveTrendPointPrices(overlay),
        trendLineStyle: normalizeDrawingTrendLineStyle(targetExtendData?.trendLineStyle),
      })
    }
    publishObjectTreeState()
  }

  function handleDeselect(target: DrawingObjectTreeTarget, overlay: DrawingOverlay) {
    if (target.kind === 'horizontalLine') {
      updateOverlayState(target.id, { handlePressed: false, hovered: false, pressed: false, selected: false })
      if (getSelectedOverlayId() === target.id) setSelectedOverlayId(null)
      if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedTrendLineOverlayId())
      publishHorizontalLineState({ selected: false })
    } else {
      const extendData = overlay.extendData as TrendLineExtendData | undefined
      chart.overrideOverlay({ id: target.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
      if (getSelectedTrendLineOverlayId() === target.id) setSelectedTrendLineOverlayId(null)
      if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId())
    }
    publishObjectTreeState()
  }
}
