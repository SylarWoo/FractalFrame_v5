import type { Dispatch, SetStateAction } from 'react'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'
import { useDrawingCoordinateActions } from './useDrawingCoordinateActions'
import { useDrawingStyleActions } from './useDrawingStyleActions'
import type { useDrawingToolAuxiliaryState } from './useDrawingToolAuxiliaryState'
import { useDrawingToolActions } from './useDrawingToolActions'
import type { useDrawingToolStateController } from './useDrawingToolStateController'

export function useDrawingToolCommandActions({
  auxiliary,
  selectedDrawing,
  setArmedKey,
  setSelectedDrawing,
  state,
  storagePeriod,
}: {
  auxiliary: ReturnType<typeof useDrawingToolAuxiliaryState>
  selectedDrawing: SelectedDrawingState | null
  setArmedKey: Dispatch<SetStateAction<DrawingToolKey | null>>
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  state: ReturnType<typeof useDrawingToolStateController>
  storagePeriod: string
}) {
  const styleActions = useDrawingStyleActions({
    selectedDrawing,
    selectedEmoji: auxiliary.selectedEmoji,
    selectedKey: state.selectedKey,
    selectedTool: state.selectedTool,
    setLineStyles: state.setLineStyles,
    setPriceLabelTools: state.setPriceLabelTools,
    setQuickMeasureEnabled: state.setQuickMeasureEnabled,
    setRulerStyle: state.setRulerStyle,
    setSelectedDrawing,
    setTextStyles: state.setTextStyles,
    setTrendLineStyle: state.setTrendLineStyle,
    storagePeriod,
    updateSelectedStickerStyle: auxiliary.updateSelectedStickerStyle,
  })
  const coordinateActions = useDrawingCoordinateActions({
    selectedKey: state.selectedKey,
    setSelectedDrawing,
  })
  const toolActions = useDrawingToolActions({
    fibBackgroundOpacity: state.fibBackgroundOpacity,
    fibBackgroundVisible: state.fibBackgroundVisible,
    fibHorizontalLineStyle: state.fibHorizontalLineStyle,
    fibLabelAlign: state.fibLabelAlign,
    fibLabelFontSize: state.fibLabelFontSize,
    fibLabelVAlign: state.fibLabelVAlign,
    fibLevelDisplay: state.fibLevelDisplay,
    fibLevelVisible: state.fibLevelVisible,
    fibLevels: state.fibLevels,
    fibPriceVisible: state.fibPriceVisible,
    fibQuarterLineStyles: state.fibQuarterLineStyles,
    fibQuarterSplitVisible: state.fibQuarterSplitVisible,
    fibReverse: state.fibReverse,
    fibTrendLineStyle: state.fibTrendLineStyle,
    fibTrendLineVisible: state.fibTrendLineVisible,
    lineStyles: state.lineStyles,
    rulerStyle: state.rulerStyle,
    selectedCrossPeriod: auxiliary.selectedCrossPeriod,
    selectedCrossPeriodTargets: auxiliary.selectedCrossPeriodTargets,
    selectedDrawing,
    selectedEmoji: auxiliary.selectedEmoji,
    selectedKey: state.selectedKey,
    selectedLocked: state.selectedLocked,
    selectedPriceLabel: state.selectedPriceLabel,
    selectedTextStyle: state.selectedTextStyle,
    setArmedKey,
    setLockedTools: state.setLockedTools,
    setPersistedTools: state.setPersistedTools,
    stickerColor: auxiliary.stickerColor,
    stickerSize: auxiliary.stickerSize,
    textStyles: state.textStyles,
    trendLineStyle: state.trendLineStyle,
  })

  return {
    ...styleActions,
    ...coordinateActions,
    ...toolActions,
  }
}
