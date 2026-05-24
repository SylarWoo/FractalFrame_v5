import { readString, writeString } from '../persistence/jsonStorage'

export type ChartCursorMode = 'cursor' | 'crosshair'

export const chartCursorModeChangedEvent = 'fractalframe:chart-cursor-mode-changed'
const chartCursorModeStorageKey = 'fractalframe.drawingsDrawer.cursorMode'

export function readChartCursorMode(): ChartCursorMode {
  return readString(chartCursorModeStorageKey, 'cursor') === 'crosshair' ? 'crosshair' : 'cursor'
}

export function writeChartCursorMode(mode: ChartCursorMode) {
  writeString(chartCursorModeStorageKey, mode)
  window.dispatchEvent(new CustomEvent(chartCursorModeChangedEvent, { detail: { mode } }))
}
