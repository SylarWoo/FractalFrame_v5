import type { Dispatch, SetStateAction } from 'react'
import type { DrawingTool, SelectedDrawingState } from './drawingTypes'
import { useDrawingFibStyleState } from './useDrawingFibStyleState'
import { useDrawingSelectedState } from './useDrawingSelectedState'
import { useDrawingToolSelection, useDrawingToolSelectionEffects } from './useDrawingToolSelection'
import { useDrawingToolSettingsState } from './useDrawingToolSettingsState'

export function useDrawingToolStateController({
  drawingTools,
  selectedDrawing,
  setSelectedDrawing,
  storagePeriod,
}: {
  drawingTools: readonly DrawingTool[]
  selectedDrawing: SelectedDrawingState | null
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  storagePeriod: string
}) {
  const settingsState = useDrawingToolSettingsState({
    drawingTools,
    storagePeriod,
  })
  const fibState = useDrawingFibStyleState({
    setSelectedDrawing,
    storagePeriod,
  })
  const selectionState = useDrawingToolSelection({
    drawingTools,
    setSelectedDrawing,
    storagePeriod,
  })
  const selectedState = useDrawingSelectedState({
    activeTab: selectionState.activeTab,
    drawingTools,
    fibBackgroundOpacity: fibState.fibBackgroundOpacity,
    fibBackgroundVisible: fibState.fibBackgroundVisible,
    fibHorizontalLineStyle: fibState.fibHorizontalLineStyle,
    fibLabelAlign: fibState.fibLabelAlign,
    fibLabelFontSize: fibState.fibLabelFontSize,
    fibLabelVAlign: fibState.fibLabelVAlign,
    fibLevelDisplay: fibState.fibLevelDisplay,
    fibLevelVisible: fibState.fibLevelVisible,
    fibLevels: fibState.fibLevels,
    fibPriceVisible: fibState.fibPriceVisible,
    fibQuarterLineStyles: fibState.fibQuarterLineStyles,
    fibQuarterSplitVisible: fibState.fibQuarterSplitVisible,
    fibReverse: fibState.fibReverse,
    fibTrendLineStyle: fibState.fibTrendLineStyle,
    fibTrendLineVisible: fibState.fibTrendLineVisible,
    lineStyles: settingsState.lineStyles,
    lockedTools: settingsState.lockedTools,
    persistedTools: settingsState.persistedTools,
    priceLabelTools: settingsState.priceLabelTools,
    rulerStyle: settingsState.rulerStyle,
    selectedDrawing,
    selectedKey: selectionState.selectedKey,
    textStyles: settingsState.textStyles,
  })

  useDrawingToolSelectionEffects({
    quickMeasureEnabled: settingsState.quickMeasureEnabled,
    selectedKey: selectionState.selectedKey,
    visibleTab: selectedState.visibleTab,
  })

  return {
    ...settingsState,
    ...fibState,
    ...selectionState,
    ...selectedState,
  }
}
