import { useState } from 'react'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'
import { createDrawingsDrawerViewModel } from './createDrawingsDrawerViewModel'
import { drawingTools, drawingsDrawerSplitConfig } from './drawingToolList'
import { useDrawingToolAuxiliaryState } from './useDrawingToolAuxiliaryState'
import { useDrawingToolCommandActions } from './useDrawingToolCommandActions'
import { useDrawingToolSettingsPropsController } from './useDrawingToolSettingsPropsController'
import { useDrawingToolStateController } from './useDrawingToolStateController'
import { useRightDrawerVerticalSplit } from '../useRightDrawerVerticalSplit'

export function useDrawingsDrawerController(chartPeriod: string) {
  const storagePeriod = chartPeriod.trim().toUpperCase() || 'M5'
  const [armedKey, setArmedKey] = useState<DrawingToolKey | null>(null)
  const [selectedDrawing, setSelectedDrawing] = useState<SelectedDrawingState | null>(null)
  const drawingState = useDrawingToolStateController({
    drawingTools,
    selectedDrawing,
    setSelectedDrawing,
    storagePeriod,
  })
  const {
    setTextStyles,
    textStyles,
    selectedKey,
    selectTool,
    setSelectedKey,
    selectedLocked,
    selectedObjectId,
    selectedTool,
  } = drawingState
  const { handleSplitPointerDown, topHeight } = useRightDrawerVerticalSplit({
    bodyDatasetKey: 'fractalframeDrawingsSplitting',
    defaultHeight: drawingsDrawerSplitConfig.defaultHeight,
    maxHeight: drawingsDrawerSplitConfig.maxHeight,
    minHeight: drawingsDrawerSplitConfig.minHeight,
  })
  const auxiliaryState = useDrawingToolAuxiliaryState({
    selectedDrawing,
    selectedKey,
    selectedLocked,
    setArmedKey,
    setSelectedDrawing,
    setSelectedKey,
    setTextStyles,
    storagePeriod,
    textStyles,
  })
  const commandActions = useDrawingToolCommandActions({
    auxiliary: auxiliaryState,
    selectedDrawing,
    setArmedKey,
    setSelectedDrawing,
    state: drawingState,
    storagePeriod,
  })
  const toolSettingsProps = useDrawingToolSettingsPropsController({
    armedKey,
    auxiliary: auxiliaryState,
    commandActions,
    selectedDrawing,
    state: drawingState,
    storagePeriod,
  })

  return createDrawingsDrawerViewModel({
    handleSplitPointerDown,
    selectTool,
    selectedKey,
    selectedObjectId,
    selectedTool,
    toolSettingsProps,
    tools: drawingTools,
    topHeight,
  })
}
