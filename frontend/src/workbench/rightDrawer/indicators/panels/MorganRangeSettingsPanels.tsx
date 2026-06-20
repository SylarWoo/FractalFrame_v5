import type { MorganRangeSegment } from '../../../chart/morganRangeModel'
import type { MrIndicatorSettings } from '../../indicatorPersistence'

export function MrInputPanel() {
  return (
    <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">默认</div>
  )
}

export function MrStylePanel() {
  return (
    <div className="ff-indicators-input-panel-v1__tab-panel" role="tabpanel">默认</div>
  )
}

export function MrInputPanelV3(props: {
  onSettingsChange: (settings: MrIndicatorSettings) => void
  segment?: MorganRangeSegment | null
  settings: MrIndicatorSettings
}) {
  const { segment } = props
  return (
    <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mr-panel-v1" role="tabpanel">
      {segment ? (
        <div className="ff-indicators-mr-level-table-v1">
          <div className="ff-indicators-mr-level-table-v1__meta">
            <span>Center {formatMorganRangePrice(segment.center)}</span>
            <span>Range {formatMorganRangePrice(segment.range)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ratio</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {segment.levels.map((level) => (
                <tr key={level.ratio}>
                  <td>{formatMorganRangeRatio(level.ratio)}</td>
                  <td>{formatMorganRangePrice(level.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ff-indicators-mr-level-table-v1__empty">No Morgan range data</div>
      )}
    </div>
  )
}

function formatMorganRangeRatio(value: number) {
  if (value === 0) return '0'
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function formatMorganRangePrice(value: number) {
  return Number.isFinite(value) ? value.toFixed(3) : '--'
}

export function MrStylePanelV3(props: {
  onSettingsChange: (settings: MrIndicatorSettings) => void
  settings: MrIndicatorSettings
}) {
  void props
  return <div className="ff-indicators-input-panel-v1__tab-panel ff-indicators-compact-input-panel-v1 ff-indicators-mr-panel-v1" role="tabpanel" />
}
