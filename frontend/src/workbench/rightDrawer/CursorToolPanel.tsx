import type { ChartCursorMode } from '../chart/chartCursorMode'
import { SegmentedControl } from './DrawingToolControls'

export function CursorToolPanel({
  cursorMode,
  onCursorModeChange,
}: {
  cursorMode: ChartCursorMode
  onCursorModeChange: (mode: ChartCursorMode) => void
}) {
  return (
    <div className="ff-drawing-tools-cursor-row-v1" data-ff-drawing-tools-cursor-only-v1>
      <SegmentedControl
        ariaLabel="\u4e3b\u56fe\u9f20\u6807\u6837\u5f0f"
        items={[
          { active: cursorMode === 'cursor', label: '\u7bad\u5934', onClick: () => onCursorModeChange('cursor') },
          { active: cursorMode === 'crosshair', label: '\u5341\u5b57\u661f', onClick: () => onCursorModeChange('crosshair') },
        ]}
      />
    </div>
  )
}
