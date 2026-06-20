import type { Dispatch, SetStateAction } from 'react'
import type { DrawingTextStyle } from '../drawingPersistence'
import { publishDrawingToolCommand } from '../drawingToolCommands'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'
import { useDrawingCrossPeriodSettings } from './useDrawingCrossPeriodSettings'
import { useDrawingEventSync } from './useDrawingEventSync'
import { useDrawingStickerState } from './useDrawingStickerState'

export function useDrawingToolAuxiliaryState({
  selectedDrawing,
  selectedKey,
  selectedLocked,
  setArmedKey,
  setSelectedDrawing,
  setSelectedKey,
  setTextStyles,
  storagePeriod,
  textStyles,
}: {
  selectedDrawing: SelectedDrawingState | null
  selectedKey: DrawingToolKey
  selectedLocked: boolean
  setArmedKey: Dispatch<SetStateAction<DrawingToolKey | null>>
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  setSelectedKey: Dispatch<SetStateAction<DrawingToolKey>>
  setTextStyles: Dispatch<SetStateAction<Record<string, DrawingTextStyle>>>
  storagePeriod: string
  textStyles: Record<string, DrawingTextStyle>
}) {
  const stickerState = useDrawingStickerState({
    selectedLocked,
    setSelectedDrawing,
    setTextStyles,
    textStyles,
  })
  const crossPeriodState = useDrawingCrossPeriodSettings({
    publishUpdate: (update) => publishDrawingToolCommand({
      action: 'updateSelectedCrossPeriod',
      crossPeriod: update.crossPeriod,
      crossPeriodTargets: update.crossPeriodTargets,
      tool: update.tool,
    }),
    selectedDrawing,
    selectedKey,
    setSelectedDrawing,
    storagePeriod,
  })

  useDrawingEventSync({
    setArmedKey,
    setSelectedDrawing,
    setSelectedEmoji: stickerState.setSelectedEmoji,
    setSelectedKey,
    setStickerColor: stickerState.setStickerColor,
    setStickerSize: stickerState.setStickerSize,
    setTextStyles,
    storagePeriod,
  })

  return {
    ...stickerState,
    ...crossPeriodState,
  }
}
