import { SettingsLineSwatch, type SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import { CrossPeriodTargetSelect } from './CrossPeriodTargetSelect'

type CommonLineToolKey = 'horizontalLine' | 'trendLine' | 'morganRange' | 'emojiSticker' | 'cursor'

export function DrawingCommonLineStyleSection({
  crossPeriodTargets,
  crossPeriodVisible,
  lineStyle,
  onCrossPeriodChange,
  onCrossPeriodTargetsChange,
  onLineStyleChange,
  onPriceLabelChange,
  priceLabelVisible,
  toolKey,
}: {
  crossPeriodTargets: DrawingCrossPeriodTarget[]
  crossPeriodVisible: boolean
  lineStyle: SettingsLineSwatchValue
  onCrossPeriodChange: (enabled: boolean) => void
  onCrossPeriodTargetsChange: (targets: DrawingCrossPeriodTarget[]) => void
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  priceLabelVisible: boolean
  toolKey: CommonLineToolKey
}) {
  return (
    <>
      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">{'\u7ebf\u5f62\u56fe'}</span>
        <div className="ff-drawing-tline-tv-line-control-v1">
          <SettingsLineSwatch
            color={lineStyle.hex}
            lineStyle={lineStyle.lineStyle}
            onChange={onLineStyleChange}
            thickness={lineStyle.thickness}
            value={lineStyle}
          />
        </div>
      </div>
      {toolKey === 'trendLine' ? null : (
        <div className="ff-drawing-tline-tv-row-v1">
          <span className="ff-drawing-tline-tv-label-v1">{'\u4ef7\u683c\u6807\u7b7e'}</span>
          <label className="ff-drawing-tline-tv-check-row-v1">
            <input checked={priceLabelVisible} onChange={(event) => onPriceLabelChange(event.target.checked)} type="checkbox" />
            <span className="ff-drawing-tline-tv-check-box-v1" />
          </label>
        </div>
      )}
      {toolKey === 'horizontalLine' || toolKey === 'trendLine' ? (
        <>
          <div className="ff-drawing-tline-tv-check-line-v1">
            <label className="ff-drawing-tline-tv-check-row-v1">
              <input checked={crossPeriodVisible} onChange={(event) => onCrossPeriodChange(event.target.checked)} type="checkbox" />
              <span className="ff-drawing-tline-tv-check-box-v1" />
            </label>
            <span>{'\u8de8\u5468\u671f\u6807\u8bb0'}</span>
          </div>
          <div className="ff-drawing-tline-tv-row-v1">
            <span className="ff-drawing-tline-tv-label-v1">{'\u5468\u671f'}</span>
            <CrossPeriodTargetSelect onChange={onCrossPeriodTargetsChange} value={crossPeriodTargets} />
          </div>
        </>
      ) : null}
    </>
  )
}
