import { OpenableSelect } from '../../controls/OpenableSelect'
import type { DrawingTrendLineStyle } from '../drawingPersistence'
import { DrawingOpenableSelectRow } from './DrawingOpenableSelectRow'
import { TrendExtendModeSelect } from './TrendExtendModeSelect'
import { TrendStatsDataSelect } from './TrendStatsDataSelect'

const drawingMarkerOptions = [
  { label: '\u666e\u901a', value: 'normal' },
  { label: '\u7bad\u5934', value: 'arrow' },
]

const drawingStatsPositionOptions = [
  { label: '\u5de6', value: 'left' },
  { label: '\u4e2d', value: 'center' },
  { label: '\u53f3', value: 'right' },
]

export function TrendLineV4StyleOptions({
  onChange,
  onPriceLabelChange,
  priceLabelVisible,
  settings,
}: {
  onChange: (patch: Partial<DrawingTrendLineStyle>) => void
  onPriceLabelChange: (enabled: boolean) => void
  priceLabelVisible: boolean
  settings: DrawingTrendLineStyle
}) {
  return (
    <>
      <div className="ff-drawing-tline-tv-endpoints-v1">
        <span className="ff-drawing-tline-tv-label-v1 ff-drawing-tline-tv-endpoints-v1__label">{'\u7aef\u70b9'}</span>
        <div className="ff-drawing-tline-tv-endpoints-v1__controls">
          <div className="ff-drawing-tline-tv-endpoints-v1__row">
            <OpenableSelect
              ariaLabel="\u8d77\u70b9"
              className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-openable-select-v1--endpoint"
              onChange={(value) => onChange({ startMarker: value as DrawingTrendLineStyle['startMarker'] })}
              options={drawingMarkerOptions}
              value={settings.startMarker}
            />
            <span className="ff-drawing-tline-tv-endpoints-v1__side">{'\u8d77\u70b9'}</span>
          </div>
          <div className="ff-drawing-tline-tv-endpoints-v1__row">
            <OpenableSelect
              ariaLabel="\u7ec8\u70b9"
              className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-openable-select-v1--endpoint"
              onChange={(value) => onChange({ endMarker: value as DrawingTrendLineStyle['endMarker'] })}
              options={drawingMarkerOptions}
              value={settings.endMarker}
            />
            <span className="ff-drawing-tline-tv-endpoints-v1__side">{'\u7ec8\u70b9'}</span>
          </div>
        </div>
      </div>
      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">{'\u5ef6\u4f38'}</span>
        <TrendExtendModeSelect onChange={(value) => onChange({ extendMode: value })} value={settings.extendMode} />
      </div>
      <div className="ff-drawing-tline-tv-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={settings.middleVisible} onChange={(event) => onChange({ middleVisible: event.target.checked })} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span>{'\u4e2d\u70b9'}</span>
      </div>
      <div className="ff-drawing-tline-tv-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={priceLabelVisible} onChange={(event) => onPriceLabelChange(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span>{'\u4ef7\u683c\u6807\u7b7e'}</span>
      </div>
      <h3 className="ff-drawing-tline-tv-subhead-v1">{'\u4fe1\u606f'}</h3>
      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">{'\u7edf\u8ba1\u6570\u636e'}</span>
        <TrendStatsDataSelect onChange={(value) => onChange({ statsData: value })} value={settings.statsData} />
      </div>
      <DrawingOpenableSelectRow
        className="ff-drawing-tline-tv-openable-select-v1--stats-position"
        label={'\u7edf\u8ba1\u4f4d\u7f6e'}
        onChange={(value) => onChange({ statsPosition: value as DrawingTrendLineStyle['statsPosition'] })}
        options={drawingStatsPositionOptions}
        value={settings.statsPosition}
      />
      <div className="ff-drawing-tline-tv-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={settings.statsAlwaysVisible} onChange={(event) => onChange({ statsAlwaysVisible: event.target.checked })} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span>{'\u59cb\u7ec8\u663e\u793a\u7edf\u8ba1\u4fe1\u606f'}</span>
      </div>
      <div className="ff-drawing-tline-tv-divider-v1" />
      <OpenableSelect
        ariaLabel="\u6a21\u677f"
        className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-openable-select-v1--template"
        onChange={() => undefined}
        options={[{ label: '\u6a21\u677f', value: 'template' }]}
        value="template"
      />
    </>
  )
}
