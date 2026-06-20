import type { PointerEventHandler } from 'react'
import type { DrawingTool, DrawingToolKey } from './drawingTypes'
import type { DrawingToolSettingsContentProps } from '../drawings'

export type DrawingsDrawerViewModel = {
  handleSplitPointerDown: PointerEventHandler<HTMLElement>
  selectTool: (tool: DrawingToolKey) => void
  selectedKey: DrawingToolKey
  selectedObjectId: string
  selectedTool: DrawingTool
  toolSettingsProps: DrawingToolSettingsContentProps
  tools: readonly DrawingTool[]
  topHeight: number
}

export function createDrawingsDrawerViewModel({
  handleSplitPointerDown,
  selectTool,
  selectedKey,
  selectedObjectId,
  selectedTool,
  toolSettingsProps,
  tools,
  topHeight,
}: DrawingsDrawerViewModel): DrawingsDrawerViewModel {
  return {
    handleSplitPointerDown,
    selectTool,
    selectedKey,
    selectedObjectId,
    selectedTool,
    toolSettingsProps,
    tools,
    topHeight,
  }
}
