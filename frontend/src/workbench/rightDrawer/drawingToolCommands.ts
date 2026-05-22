import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'

export type DrawingToolCommand = {
  action: 'release' | 'start'
  id: number
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  tool: 'horizontalLine'
}

export const drawingToolCommandEvent = 'fractalframe:drawing-tool-command'

export function publishDrawingToolCommand(command: Omit<DrawingToolCommand, 'id'>) {
  window.dispatchEvent(new CustomEvent<DrawingToolCommand>(drawingToolCommandEvent, {
    detail: {
      ...command,
      id: Date.now(),
    },
  }))
}

export function isDrawingToolCommandEvent(event: Event): event is CustomEvent<DrawingToolCommand> {
  return event instanceof CustomEvent && event.type === drawingToolCommandEvent && event.detail?.tool === 'horizontalLine'
}
