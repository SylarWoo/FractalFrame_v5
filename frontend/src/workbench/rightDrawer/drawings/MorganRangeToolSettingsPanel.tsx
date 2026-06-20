import type { DrawingTool, DrawingToolKey } from '../drawingTools/drawingTypes'
import { SegmentedControl } from '../DrawingToolControls'

export function MorganRangeToolSettingsPanel({
  armedKey,
  onArm,
  onRelease,
  selectedKey,
  selectedTool,
}: {
  armedKey: DrawingToolKey | null
  onArm: () => void
  onRelease: () => void
  selectedKey: DrawingToolKey
  selectedTool: DrawingTool
}) {
  return (
    <div className="ff-drawing-hline-settings-v1">
      <div className="ff-drawing-hline-top-actions-v1">
        <SegmentedControl
          ariaLabel={`${selectedTool.label} draw mode`}
          items={[
            { active: armedKey === selectedKey, label: '\u753b\u7ebf', onClick: onArm },
            { active: armedKey !== selectedKey, label: '\u91ca\u653e', onClick: onRelease },
          ]}
        />
      </div>
    </div>
  )
}
