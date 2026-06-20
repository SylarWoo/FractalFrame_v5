import type { ChartCursorMode } from '../../chart/chartCursorMode'
import { CursorToolPanel } from '../CursorToolPanel'

export function CursorToolSettingsPanel({
  cursorMode,
  onCursorModeChange,
}: {
  cursorMode: ChartCursorMode
  onCursorModeChange: (mode: ChartCursorMode) => void
}) {
  return <CursorToolPanel cursorMode={cursorMode} onCursorModeChange={onCursorModeChange} />
}
