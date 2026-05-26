import type { Chart } from 'klinecharts'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import type { ObjectTreeDrawingCommand } from '../rightDrawer/objectTree/objectTreeTypes'
import { normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { normalizeDrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { normalizeLineStyle } from './chartDrawingStyle'
import { resolveDrawingObjectTreeTarget } from './chartDrawingObjectTreeState'
import type { DrawingObjectTreeTarget } from './chartDrawingObjectTreeState'
import type { HorizontalLineExtendData, RulerExtendData, TrendLineExtendData } from './chartDrawingTypes'

type DrawingOverlay = NonNullable<ReturnType<Chart['getOverlayById']>>
type DrawingObjectTreeCommandAdapter = {
  deselect: (target: DrawingObjectTreeTarget, overlay: DrawingOverlay) => void
  isVisibleInCurrentPeriod: (objectId?: string) => boolean
  kind: DrawingObjectTreeTarget['kind']
  persist: () => void
  selectedForVisible: (id: string, extendData: HorizontalLineExtendData | RulerExtendData | TrendLineExtendData | Record<string, unknown> | undefined) => boolean
  select: (command: Extract<ObjectTreeDrawingCommand, { action: 'select' }>, target: DrawingObjectTreeTarget, overlay: DrawingOverlay) => void
  updateHiddenState: (id: string, overlay: DrawingOverlay, manualVisible: boolean, periodVisible: boolean) => void
}

export function createDrawingObjectTreeCommandHandler({
  chart,
  clearFibSelection = () => undefined,
  clearStickerSelection = () => undefined,
  clearHorizontalLineSelection,
  clearTrendLineSelection,
  emojiStickerOverlayIds = new Set<string>(),
  fibOverlayIds = new Set<string>(),
  getActiveObjectTreeOverlayId,
  getSelectedOverlayId,
  getSelectedRulerOverlayId,
  getSelectedTrendLineOverlayId,
  getSelectedStickerOverlayId = () => null,
  getSelectedStickerOverlayIds = () => new Set<string>(),
  horizontalLineOverlayIds,
  isHorizontalLineVisibleInCurrentPeriod,
  isRulerVisibleInCurrentPeriod,
  isFibRetracementVisibleInCurrentPeriod = isRulerVisibleInCurrentPeriod,
  isTrendLineVisibleInCurrentPeriod,
  persistCurrentHorizontalLines,
  persistCurrentFibRetracements = () => undefined,
  persistCurrentRulers,
  persistCurrentTrendLines,
  persistCurrentEmojiStickers = () => undefined,
  publishHorizontalLineState,
  publishObjectTreeState,
  resolveTrendPointPrices,
  restoreObjectCurrentPeriodVisibility,
  rulerOverlayIds,
  selectedHorizontalLineOverlayIds,
  selectedFibOverlayIds = new Set<string>(),
  selectedRulerOverlayIds,
  selectedTrendLineOverlayIds,
  setActiveObjectTreeOverlayId,
  setLastSelectedTrendLine,
  setSelectedOverlayId,
  setSelectedRulerOverlayId,
  setSelectedFibOverlayId = () => undefined,
  setSelectedTrendLineOverlayId,
  setSelectedStickerOverlayId = () => undefined,
  setSelectedHorizontalLine,
  toggleSelectedHorizontalLine,
  trendLineOverlayIds,
  updateOverlayState,
}: {
  chart: Chart
  clearFibSelection?: () => void
  clearStickerSelection?: () => void
  clearHorizontalLineSelection: () => void
  clearTrendLineSelection: () => void
  emojiStickerOverlayIds?: Set<string>
  fibOverlayIds?: Set<string>
  getActiveObjectTreeOverlayId: () => string | null
  getSelectedOverlayId: () => string | null
  getSelectedRulerOverlayId: () => string | null
  getSelectedTrendLineOverlayId: () => string | null
  getSelectedStickerOverlayId?: () => string | null
  getSelectedStickerOverlayIds?: () => Set<string>
  horizontalLineOverlayIds: Set<string>
  isHorizontalLineVisibleInCurrentPeriod: (objectId?: string) => boolean
  isRulerVisibleInCurrentPeriod: (objectId?: string) => boolean
  isFibRetracementVisibleInCurrentPeriod?: (objectId?: string) => boolean
  isTrendLineVisibleInCurrentPeriod: (objectId?: string) => boolean
  persistCurrentHorizontalLines: () => void
  persistCurrentFibRetracements?: () => void
  persistCurrentRulers: () => void
  persistCurrentTrendLines: () => void
  persistCurrentEmojiStickers?: () => void
  publishHorizontalLineState: (state?: Partial<{ armed: boolean; lineStyle: SettingsLineSwatchValue; locked: boolean; objectId: string; price: number; selected: boolean; showPriceLabel: boolean; textStyle: DrawingTextStyle }>) => void
  publishObjectTreeState: () => void
  resolveTrendPointPrices: (overlay: { points?: Array<{ value?: number }> } | null | undefined) => [number | undefined, number | undefined]
  restoreObjectCurrentPeriodVisibility: (kind: DrawingObjectTreeTarget['kind'], objectId?: string) => void
  rulerOverlayIds: Set<string>
  selectedHorizontalLineOverlayIds: Set<string>
  selectedFibOverlayIds?: Set<string>
  selectedRulerOverlayIds: Set<string>
  selectedTrendLineOverlayIds: Set<string>
  setActiveObjectTreeOverlayId: (id: string | null) => void
  setLastSelectedTrendLine: (id: string) => void
  setSelectedOverlayId: (id: string | null) => void
  setSelectedHorizontalLine: (id: string, additive: boolean) => void
  setSelectedRulerOverlayId: (id: string | null) => void
  setSelectedFibOverlayId?: (id: string | null) => void
  setSelectedTrendLineOverlayId: (id: string | null) => void
  setSelectedStickerOverlayId?: (id: string | null, additive?: boolean) => void
  toggleSelectedHorizontalLine: (id: string) => void
  trendLineOverlayIds: Set<string>
  updateOverlayState: (id: string | undefined, patch: Record<string, unknown>) => void
}) {
  const clearRulerSelection = () => {
    rulerOverlayIds.forEach((id) => {
      const overlay = chart.getOverlayById(id)
      if (!overlay) {
        rulerOverlayIds.delete(id)
        return
      }
      const extendData = overlay.extendData as RulerExtendData | undefined
      if (!selectedRulerOverlayIds.has(id) && extendData?.selected !== true && extendData?.pressed !== true && extendData?.hovered !== true) return
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
    setSelectedRulerOverlayId(null)
  }

  const adapters: DrawingObjectTreeCommandAdapter[] = [
    {
      deselect: (target, overlay) => {
        const extendData = overlay.extendData as Record<string, unknown> | undefined
        if (getSelectedStickerOverlayIds().has(target.id) || extendData?.selected === true) setSelectedStickerOverlayId(target.id, true)
        else chart.overrideOverlay({ id: target.id, extendData: { ...extendData, selected: false } })
        if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId() ?? getSelectedTrendLineOverlayId() ?? getSelectedRulerOverlayId())
        publishDrawingToolState({
          armed: false,
          locked: false,
          selected: false,
          showPriceLabel: false,
          tool: 'emojiSticker',
        })
      },
      isVisibleInCurrentPeriod: () => true,
      kind: 'emojiSticker',
      persist: persistCurrentEmojiStickers,
      selectedForVisible: (id, extendData) => getSelectedStickerOverlayIds().has(id) || getSelectedStickerOverlayId() === id || (extendData as { selected?: boolean } | undefined)?.selected === true,
      select: (command, target, overlay) => {
        if (command.additive !== true) {
          clearHorizontalLineSelection()
          clearTrendLineSelection()
          clearRulerSelection()
          clearFibSelection()
        }
        const targetExtendData = overlay.extendData as {
          bold?: boolean
          color?: string
          fontFamily?: string
          italic?: boolean
          locked?: boolean
          objectId?: string
          selected?: boolean
          size?: number
          symbol?: string
          textStyle?: DrawingTextStyle
        } | undefined
        const nextSelected = command.additive === true && (getSelectedStickerOverlayIds().has(target.id) || getSelectedStickerOverlayId() === target.id || targetExtendData?.selected === true) ? false : true
        setSelectedStickerOverlayId(target.id, command.additive === true)
        if (nextSelected) setActiveObjectTreeOverlayId(target.id)
        else if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId() ?? getSelectedTrendLineOverlayId() ?? getSelectedRulerOverlayId())
        publishDrawingToolState({
          armed: false,
          locked: targetExtendData?.locked === true,
          objectId: targetExtendData?.objectId,
          selected: nextSelected,
          showPriceLabel: false,
          stickerBold: targetExtendData?.bold,
          stickerColor: targetExtendData?.color,
          stickerFontFamily: targetExtendData?.fontFamily,
          stickerItalic: targetExtendData?.italic,
          stickerSize: targetExtendData?.size,
          stickerSymbol: targetExtendData?.symbol,
          textStyle: normalizeDrawingTextStyle(targetExtendData?.textStyle),
          tool: 'emojiSticker',
        })
      },
      updateHiddenState: (id, overlay, manualVisible) => {
        if (getSelectedStickerOverlayIds().has(id) || getSelectedStickerOverlayId() === id) setSelectedStickerOverlayId(id, true)
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            manualVisible,
            selected: false,
          },
        })
        if (getSelectedStickerOverlayId() === id) setSelectedStickerOverlayId(null)
      },
    },
    {
      deselect: (target) => {
        updateOverlayState(target.id, { handlePressed: false, hovered: false, pressed: false, selected: false })
        if (getSelectedOverlayId() === target.id) setSelectedOverlayId(null)
        if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedTrendLineOverlayId())
        publishHorizontalLineState({ selected: false })
      },
      isVisibleInCurrentPeriod: isHorizontalLineVisibleInCurrentPeriod,
      kind: 'horizontalLine',
      persist: persistCurrentHorizontalLines,
      selectedForVisible: (id) => selectedHorizontalLineOverlayIds.has(id),
      select: (command, target) => {
        if (command.additive === true) {
          toggleSelectedHorizontalLine(target.id)
        } else {
          clearTrendLineSelection()
          clearRulerSelection()
          clearFibSelection()
          clearStickerSelection()
          setSelectedHorizontalLine(target.id, false)
        }
        publishHorizontalLineState({ selected: true })
      },
      updateHiddenState: (id) => {
        updateOverlayState(id, { handlePressed: false, hovered: false, pressed: false })
      },
    },
    {
      deselect: (target, overlay) => {
        const extendData = overlay.extendData as TrendLineExtendData | undefined
        chart.overrideOverlay({ id: target.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
        selectedTrendLineOverlayIds.delete(target.id)
        if (getSelectedTrendLineOverlayId() === target.id) setSelectedTrendLineOverlayId(null)
        if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId())
      },
      isVisibleInCurrentPeriod: isTrendLineVisibleInCurrentPeriod,
      kind: 'trendLine',
      persist: persistCurrentTrendLines,
      selectedForVisible: (id, extendData) => selectedTrendLineOverlayIds.has(id) || getSelectedTrendLineOverlayId() === id || (extendData as TrendLineExtendData | undefined)?.selected === true,
      select: (command, target, overlay) => {
        if (command.additive !== true) {
          clearHorizontalLineSelection()
          clearRulerSelection()
          clearFibSelection()
          clearStickerSelection()
        }
        if (command.additive !== true) {
          trendLineOverlayIds.forEach((overlayId) => {
            if (overlayId === target.id) return
            const rowOverlay = chart.getOverlayById(overlayId)
            const rowExtendData = rowOverlay?.extendData as TrendLineExtendData | undefined
            if (!rowOverlay || rowExtendData?.selected !== true) return
            chart.overrideOverlay({ id: overlayId, extendData: { ...rowExtendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
            selectedTrendLineOverlayIds.delete(overlayId)
          })
        }
        const targetExtendData = overlay.extendData as TrendLineExtendData | undefined
        const nextSelected = command.additive === true && (selectedTrendLineOverlayIds.has(target.id) || targetExtendData?.selected === true) ? false : true
        if (nextSelected) selectedTrendLineOverlayIds.add(target.id)
        else selectedTrendLineOverlayIds.delete(target.id)
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
      },
      updateHiddenState: (id, overlay, manualVisible, periodVisible) => {
        const extendData = overlay.extendData as TrendLineExtendData | undefined
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            endpointPressed: false,
            hovered: false,
            manualVisible,
            periodVisible,
            pressed: false,
            pressedPointIndex: undefined,
            selected: getSelectedTrendLineOverlayId() === id || extendData?.selected === true,
          },
        })
      },
    },
    {
      deselect: (target, overlay) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        chart.overrideOverlay({ id: target.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
        selectedRulerOverlayIds.delete(target.id)
        if (getSelectedRulerOverlayId() === target.id) setSelectedRulerOverlayId(null)
        if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId() ?? getSelectedTrendLineOverlayId())
      },
      isVisibleInCurrentPeriod: isFibRetracementVisibleInCurrentPeriod,
      kind: 'ruler',
      persist: persistCurrentRulers,
      selectedForVisible: (id, extendData) => selectedRulerOverlayIds.has(id) || getSelectedRulerOverlayId() === id || (extendData as RulerExtendData | undefined)?.selected === true,
      select: (command, target, overlay) => {
        if (command.additive !== true) {
          clearHorizontalLineSelection()
          clearTrendLineSelection()
          clearFibSelection()
          clearStickerSelection()
          rulerOverlayIds.forEach((overlayId) => {
            if (overlayId === target.id) return
            const rowOverlay = chart.getOverlayById(overlayId)
            const rowExtendData = rowOverlay?.extendData as RulerExtendData | undefined
            if (!rowOverlay || rowExtendData?.selected !== true) return
            chart.overrideOverlay({ id: overlayId, extendData: { ...rowExtendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
            selectedRulerOverlayIds.delete(overlayId)
          })
        }
        const targetExtendData = overlay.extendData as RulerExtendData | undefined
        const nextSelected = command.additive === true && (selectedRulerOverlayIds.has(target.id) || targetExtendData?.selected === true) ? false : true
        if (nextSelected) selectedRulerOverlayIds.add(target.id)
        else selectedRulerOverlayIds.delete(target.id)
        setSelectedRulerOverlayId(nextSelected ? target.id : null)
        if (nextSelected) setActiveObjectTreeOverlayId(target.id)
        else if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId() ?? getSelectedTrendLineOverlayId())
        chart.overrideOverlay({
          id: target.id,
          extendData: {
            ...targetExtendData,
            selected: nextSelected,
          },
        })
        publishDrawingToolState({
          armed: false,
          fibBackgroundOpacity: targetExtendData?.fibBackgroundOpacity,
          fibBackgroundVisible: targetExtendData?.fibBackgroundVisible,
          fibHorizontalLineStyle: targetExtendData?.fibHorizontalLineStyle,
          fibLabelAlign: targetExtendData?.fibLabelAlign,
          fibLabelFontSize: targetExtendData?.fibLabelFontSize,
          fibLabelVAlign: targetExtendData?.fibLabelVAlign,
          fibLevelDisplay: targetExtendData?.fibLevelDisplay,
          fibLevelVisible: targetExtendData?.fibLevelVisible,
          fibLevels: targetExtendData?.fibLevels,
          fibPriceVisible: targetExtendData?.fibPriceVisible,
          fibQuarterLineStyles: targetExtendData?.fibQuarterLineStyles,
          fibQuarterSplitVisible: targetExtendData?.fibQuarterSplitVisible,
          fibReverse: targetExtendData?.fibReverse,
          fibTrendLineStyle: targetExtendData?.fibTrendLineStyle,
          fibTrendLineVisible: targetExtendData?.fibTrendLineVisible,
          lineStyle: normalizeLineStyle(targetExtendData?.lineStyle),
          locked: targetExtendData?.locked === true,
          objectId: targetExtendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(targetExtendData?.rulerStyle),
          selected: nextSelected,
          showPriceLabel: targetExtendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(targetExtendData?.textStyle),
          tool: 'ruler',
          trendPointPrices: resolveTrendPointPrices(overlay),
        })
      },
      updateHiddenState: (id, overlay, manualVisible, periodVisible) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            endpointPressed: false,
            hovered: false,
            manualVisible,
            periodVisible,
            pressed: false,
            pressedPointIndex: undefined,
            selected: selectedRulerOverlayIds.has(id) || getSelectedRulerOverlayId() === id || extendData?.selected === true,
          },
        })
      },
    },
    {
      deselect: (target, overlay) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        chart.overrideOverlay({ id: target.id, extendData: { ...extendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
        selectedFibOverlayIds.delete(target.id)
        setSelectedFibOverlayId(null)
        if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId() ?? getSelectedTrendLineOverlayId() ?? getSelectedRulerOverlayId())
      },
      isVisibleInCurrentPeriod: isRulerVisibleInCurrentPeriod,
      kind: 'fibRetracement',
      persist: persistCurrentFibRetracements,
      selectedForVisible: (id, extendData) => selectedFibOverlayIds.has(id) || (extendData as RulerExtendData | undefined)?.selected === true,
      select: (command, target, overlay) => {
        if (command.additive !== true) {
          clearHorizontalLineSelection()
          clearTrendLineSelection()
          clearRulerSelection()
          clearStickerSelection()
          fibOverlayIds.forEach((overlayId) => {
            if (overlayId === target.id) return
            const rowOverlay = chart.getOverlayById(overlayId)
            const rowExtendData = rowOverlay?.extendData as RulerExtendData | undefined
            if (!rowOverlay || rowExtendData?.selected !== true) return
            chart.overrideOverlay({ id: overlayId, extendData: { ...rowExtendData, endpointPressed: false, selected: false, pressed: false, pressedPointIndex: undefined } })
            selectedFibOverlayIds.delete(overlayId)
          })
        }
        const targetExtendData = overlay.extendData as RulerExtendData | undefined
        const nextSelected = command.additive === true && (selectedFibOverlayIds.has(target.id) || targetExtendData?.selected === true) ? false : true
        if (nextSelected) selectedFibOverlayIds.add(target.id)
        else selectedFibOverlayIds.delete(target.id)
        setSelectedFibOverlayId(nextSelected ? target.id : null)
        if (nextSelected) setActiveObjectTreeOverlayId(target.id)
        else if (getActiveObjectTreeOverlayId() === target.id) setActiveObjectTreeOverlayId(getSelectedOverlayId() ?? getSelectedTrendLineOverlayId() ?? getSelectedRulerOverlayId())
        chart.overrideOverlay({
          id: target.id,
          extendData: {
            ...targetExtendData,
            selected: nextSelected,
          },
        })
        publishDrawingToolState({
          armed: false,
          fibBackgroundOpacity: targetExtendData?.fibBackgroundOpacity,
          fibBackgroundVisible: targetExtendData?.fibBackgroundVisible,
          fibHorizontalLineStyle: targetExtendData?.fibHorizontalLineStyle,
          fibLabelAlign: targetExtendData?.fibLabelAlign,
          fibLabelFontSize: targetExtendData?.fibLabelFontSize,
          fibLabelVAlign: targetExtendData?.fibLabelVAlign,
          fibLevelDisplay: targetExtendData?.fibLevelDisplay,
          fibLevelVisible: targetExtendData?.fibLevelVisible,
          fibLevels: targetExtendData?.fibLevels,
          fibPriceVisible: targetExtendData?.fibPriceVisible,
          fibQuarterLineStyles: targetExtendData?.fibQuarterLineStyles,
          fibQuarterSplitVisible: targetExtendData?.fibQuarterSplitVisible,
          fibReverse: targetExtendData?.fibReverse,
          fibTrendLineStyle: targetExtendData?.fibTrendLineStyle,
          fibTrendLineVisible: targetExtendData?.fibTrendLineVisible,
          lineStyle: normalizeLineStyle(targetExtendData?.lineStyle),
          locked: targetExtendData?.locked === true,
          objectId: targetExtendData?.objectId,
          rulerStyle: normalizeDrawingRulerStyle(targetExtendData?.rulerStyle),
          selected: nextSelected,
          showPriceLabel: targetExtendData?.showPriceLabel !== false,
          textStyle: normalizeDrawingTextStyle(targetExtendData?.textStyle),
          tool: 'fibRetracement',
          trendPointPrices: resolveTrendPointPrices(overlay),
        })
      },
      updateHiddenState: (id, overlay, manualVisible, periodVisible) => {
        const extendData = overlay.extendData as RulerExtendData | undefined
        chart.overrideOverlay({
          id,
          extendData: {
            ...(overlay.extendData ?? {}),
            endpointPressed: false,
            hovered: false,
            manualVisible,
            periodVisible,
            pressed: false,
            pressedPointIndex: undefined,
            selected: selectedFibOverlayIds.has(id) || extendData?.selected === true,
          },
        })
      },
    },
  ]
  const adapterFor = (kind: DrawingObjectTreeTarget['kind']) => adapters.find((adapter) => adapter.kind === kind)
  const resolveTarget = (treeId: string) => resolveDrawingObjectTreeTarget({
    chart,
    emojiStickerOverlayIds,
    fibOverlayIds,
    horizontalLineOverlayIds,
    rulerOverlayIds,
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
      clearRulerSelection()
      clearFibSelection()
      clearStickerSelection()
      return
    }
    const target = resolveTarget(command.id)
    if (!target) return
    const overlay = chart.getOverlayById(target.id)
    if (!overlay) return

    if (command.action === 'delete') {
      const rows = resolveTargets(command)
      rows.forEach((row) => {
        if (row.kind === 'emojiSticker' && getSelectedStickerOverlayIds().has(row.id)) setSelectedStickerOverlayId(row.id, true)
        chart.removeOverlay({ id: row.id })
      })
      persistTargets(rows)
      publishObjectTreeState()
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
      const adapter = adapterFor(row.kind)
      if (!adapter) return
      const targetOverlay = chart.getOverlayById(row.id)
      if (!targetOverlay) return
      const targetExtendData = targetOverlay.extendData as HorizontalLineExtendData | RulerExtendData | TrendLineExtendData | undefined
      let periodVisible = adapter.isVisibleInCurrentPeriod(targetExtendData?.objectId)
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
          selected: adapter.selectedForVisible(row.id, targetExtendData),
        },
        visible: manualVisible,
      })
      if (!visible) adapter.updateHiddenState(row.id, targetOverlay, manualVisible, periodVisible)
    })
    persistTargets(targets)
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
    persistTargets(targets)
    publishObjectTreeState()
  }

  function handleSelect(command: Extract<ObjectTreeDrawingCommand, { action: 'select' }>, target: DrawingObjectTreeTarget, overlay: DrawingOverlay) {
    adapterFor(target.kind)?.select(command, target, overlay)
    publishObjectTreeState()
  }

  function handleDeselect(target: DrawingObjectTreeTarget, overlay: DrawingOverlay) {
    adapterFor(target.kind)?.deselect(target, overlay)
    publishObjectTreeState()
  }

  function persistTargets(targets: DrawingObjectTreeTarget[]) {
    const kinds = new Set(targets.map((target) => target.kind))
    adapters.forEach((adapter) => {
      if (kinds.has(adapter.kind)) adapter.persist()
    })
  }
}
