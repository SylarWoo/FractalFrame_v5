import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { readBooleanFlag, readString, writeBooleanFlag, writeString } from '../persistence/jsonStorage'
import { SettingsLineSwatch } from '../settings/SettingsSwatches'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { VisibilityRangePanel } from '../visibilityRange/VisibilityRangePanel'
import { publishDrawingToolCommand } from './drawingToolCommands'
import './DrawingsDrawer.css'

type DrawingToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'cursor'
type DrawingTab = 'style' | 'text' | 'coords' | 'visibility'
type CursorMode = 'cursor' | 'crosshair'

type DrawingTool = {
  key: DrawingToolKey
  label: string
  tabs?: DrawingTab[]
}

const selectedToolStorageKey = 'fractalframe.drawingsDrawer.selectedTool'
const cursorModeStorageKey = 'fractalframe.drawingsDrawer.cursorMode'
const defaultTopHeight = 254
const minTopHeight = 96
const maxTopHeight = 420

const drawingTools: DrawingTool[] = [
  { key: 'horizontalLine', label: '\u6c34\u5e73\u7ebf', tabs: ['style', 'text', 'coords', 'visibility'] },
  { key: 'trendLine', label: '\u8d8b\u52bf\u7ebf', tabs: ['style', 'text', 'coords', 'visibility'] },
  { key: 'ruler', label: '\u6807\u5c3a', tabs: ['style', 'text', 'coords', 'visibility'] },
  { key: 'fibRetracement', label: '\u6590\u6ce2\u90a3\u5951\u56de\u64a4', tabs: ['style', 'coords', 'visibility'] },
  { key: 'cursor', label: '\u5149\u6807' },
]

const tabLabels: Record<DrawingTab, string> = {
  coords: '\u5750\u6807',
  style: '\u6837\u5f0f',
  text: '\u6587\u672c',
  visibility: '\u53ef\u89c1\u8303\u56f4',
}

function normalizeToolKey(value: string): DrawingToolKey {
  return drawingTools.some((tool) => tool.key === value) ? value as DrawingToolKey : 'horizontalLine'
}

function readInitialSelectedTool() {
  return normalizeToolKey(readString(selectedToolStorageKey, 'horizontalLine'))
}

function readCursorMode() {
  return readString(cursorModeStorageKey, 'cursor') === 'crosshair' ? 'crosshair' : 'cursor'
}

function createDefaultDrawingLineStyle(color = '#2962ff'): SettingsLineSwatchValue {
  return {
    hex: color,
    lineStyle: 'solid',
    opacity: 1,
    thickness: 1,
  }
}

export function DrawingsDrawer() {
  const [selectedKey, setSelectedKey] = useState<DrawingToolKey>(readInitialSelectedTool)
  const [armedKey, setArmedKey] = useState<DrawingToolKey | null>(null)
  const [activeTab, setActiveTab] = useState<DrawingTab>('style')
  const [persistedTools, setPersistedTools] = useState<Record<string, boolean>>(() => Object.fromEntries(
    drawingTools.map((tool) => [tool.key, readBooleanFlag(`fractalframe.drawingsDrawer.persist.${tool.key}`, true)]),
  ))
  const [lockedTools, setLockedTools] = useState<Record<string, boolean>>({})
  const [lineStyles, setLineStyles] = useState<Record<string, SettingsLineSwatchValue>>(() => ({
    fibRetracement: createDefaultDrawingLineStyle('#787b86'),
    horizontalLine: createDefaultDrawingLineStyle('#0f766e'),
    ruler: createDefaultDrawingLineStyle('#2962ff'),
    trendLine: createDefaultDrawingLineStyle('#2962ff'),
  }))
  const [cursorMode, setCursorMode] = useState<CursorMode>(readCursorMode)
  const [topHeight, setTopHeight] = useState(defaultTopHeight)
  const selectedTool = drawingTools.find((tool) => tool.key === selectedKey) ?? drawingTools[0]
  const selectedPersisted = persistedTools[selectedKey] !== false
  const selectedLocked = lockedTools[selectedKey] === true
  const tabs = selectedTool.tabs ?? []
  const visibleTab = tabs.includes(activeTab) ? activeTab : tabs[0] ?? 'style'

  function selectTool(key: DrawingToolKey) {
    setSelectedKey(key)
    writeString(selectedToolStorageKey, key)
    if (!drawingTools.find((tool) => tool.key === key)?.tabs?.includes(activeTab)) setActiveTab('style')
  }

  function setPersistence(enabled: boolean) {
    setPersistedTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeBooleanFlag(`fractalframe.drawingsDrawer.persist.${selectedKey}`, enabled)
  }

  function setCursor(next: CursorMode) {
    setCursorMode(next)
    writeString(cursorModeStorageKey, next)
  }

  function armSelectedTool() {
    setArmedKey(selectedKey)
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'start',
      lineStyle: lineStyles.horizontalLine ?? createDefaultDrawingLineStyle('#0f766e'),
      locked: selectedLocked,
      tool: 'horizontalLine',
    })
  }

  function releaseSelectedTool() {
    setArmedKey(null)
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'release',
      tool: 'horizontalLine',
    })
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeDrawingsSplitting = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(Math.max(minTopHeight, Math.min(maxTopHeight, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-drawings-splitting')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture can already be released.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <section className="ff-drawings-drawer" data-right-widget-panel="drawings" data-testid="ff-drawing-drawer-panel">
      <div className="ff-indicators-split-v1 ff-drawings-split-v1" data-ff-drawing-tools-split-v1 style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}>
        <div className="ff-indicators-split-v1__top" data-ff-drawing-tools-split-top-v1>
          <table className="right-widget-drawer__table ff-indicators-table-v1 ff-drawing-tools-table-v1" aria-label="Drawing tools">
            <colgroup>
              <col style={{ width: '100%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{'\u5de5\u5177'}</th>
              </tr>
            </thead>
            <tbody>
              {drawingTools.map((tool) => (
                <tr
                  aria-selected={selectedKey === tool.key}
                  data-ff-drawing-tool-row-v1={tool.key}
                  data-selected={selectedKey === tool.key ? 'true' : 'false'}
                  key={tool.key}
                  onClick={() => selectTool(tool.key)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    selectTool(tool.key)
                  }}
                  tabIndex={0}
                >
                  <td>{tool.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          aria-label="Resize drawing tools drawer split"
          className="ff-indicators-split-v1__handle"
          data-ff-drawing-tools-split-handle-v1="true"
          onPointerDown={handleSplitPointerDown}
          title="\u4e0a\u4e0b\u62d6\u52a8\u8c03\u6574\u7a97\u53e3\u5927\u5c0f"
          type="button"
        />
        <div className="ff-indicators-split-v1__bottom" data-ff-drawing-tools-split-bottom-v1>
          <div className="ff-indicators-detail-v1 ff-indicator-settings-panel-v1__row" data-modifier="detail">
            <span className="ff-indicators-detail-v1__title ff-indicator-settings-panel-v1__row-label" data-ff-drawing-tools-detail-title-v1>
              {selectedTool.label}
            </span>
          </div>

          {selectedKey === 'cursor' ? (
            <CursorToolPanel cursorMode={cursorMode} onCursorModeChange={setCursor} />
          ) : (
            <>
              <div className="ff-drawing-hline-top-actions-v1">
                <SegmentedControl
                  ariaLabel={`${selectedTool.label} draw mode`}
                  items={[
                    { active: armedKey === selectedKey, label: '\u753b\u7ebf', onClick: armSelectedTool },
                    { active: armedKey !== selectedKey, label: '\u91ca\u653e', onClick: releaseSelectedTool },
                  ]}
                />
                <SegmentedControl
                  ariaLabel={`${selectedTool.label} persistence`}
                  className="ff-drawing-hline-top-actions-v1__persist"
                  items={[
                    { active: selectedPersisted, label: 'Save', onClick: () => setPersistence(true) },
                    { active: !selectedPersisted, label: 'Unsave', onClick: () => setPersistence(false) },
                  ]}
                />
              </div>
              <SegmentedControl
                ariaLabel={`${selectedTool.label} actions`}
                className="ff-drawing-hline-actions-v1--segmented"
                items={[
                  { active: false, label: '\u9009\u4e2d', onClick: () => undefined },
                  { active: selectedLocked, label: '\u9501\u5b9a', onClick: () => setLockedTools((current) => ({ ...current, [selectedKey]: !selectedLocked })) },
                  { active: false, label: '\u5220\u9664', onClick: () => undefined },
                ]}
              />
              <div className="ff-drawing-hline-settings-v1">
                <div className="ff-indicators-input-panel-v1__tabs" role="tablist" aria-label={`${selectedTool.label} settings`}>
                  {tabs.map((tab) => (
                    <button
                      aria-selected={visibleTab === tab}
                      className="ff-indicators-input-panel-v1__tab"
                      data-active={visibleTab === tab ? 'true' : 'false'}
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      role="tab"
                      type="button"
                    >
                      {tabLabels[tab]}
                    </button>
                  ))}
                </div>
                <div className="ff-indicators-input-panel-v1__tab-panels">
                  {tabs.map((tab) => (
                    <div
                      className="ff-indicators-input-panel-v1__tab-panel"
                      data-active={visibleTab === tab ? 'true' : 'false'}
                      hidden={visibleTab !== tab}
                      key={tab}
                      role="tabpanel"
                    >
                      <DrawingTabPanel
                        lineStyle={lineStyles[selectedTool.key] ?? createDefaultDrawingLineStyle()}
                        onLineStyleChange={(value) => setLineStyles((current) => ({ ...current, [selectedTool.key]: value }))}
                        tab={tab}
                        tool={selectedTool}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function SegmentedControl({
  ariaLabel,
  className = '',
  items,
}: {
  ariaLabel: string
  className?: string
  items: Array<{ active: boolean; label: string; onClick: () => void }>
}) {
  return (
    <div className={`ff-indicators-style-persistence-v1 ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          className="ff-indicators-style-persistence-v1__button"
          data-active={item.active ? 'true' : undefined}
          key={item.label}
          onClick={item.onClick}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function CursorToolPanel({
  cursorMode,
  onCursorModeChange,
}: {
  cursorMode: CursorMode
  onCursorModeChange: (mode: CursorMode) => void
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

function DrawingTabPanel({
  lineStyle,
  onLineStyleChange,
  tab,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  tab: DrawingTab
  tool: DrawingTool
}) {
  if (tab === 'visibility') {
    return <VisibilityRangePanel storageKey={`drawing:${tool.key}`} />
  }
  if (tab === 'style') return <DrawingStylePanel lineStyle={lineStyle} onLineStyleChange={onLineStyleChange} tool={tool} />
  if (tab === 'text') return <DrawingTextPanel />
  return <DrawingCoordsPanel tool={tool} />
}

function DrawingStylePanel({
  lineStyle,
  onLineStyleChange,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  tool: DrawingTool
}) {
  return (
    <div className="ff-drawing-tline-tv-style-v1">
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
      <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">{'\u4ef7\u683c\u6807\u7b7e'}</span>
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input defaultChecked type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
      </div>
      {tool.key === 'trendLine' || tool.key === 'fibRetracement' ? (
        <div className="ff-drawing-tline-tv-row-v1">
          <span className="ff-drawing-tline-tv-label-v1">{'\u5ef6\u4f38'}</span>
          <select className="ff-drawing-tline-tv-select-v1" defaultValue="none" aria-label="Extend">
            <option value="none">{'\u65e0'}</option>
            <option value="left">{'\u5411\u5de6'}</option>
            <option value="right">{'\u5411\u53f3'}</option>
            <option value="both">{'\u53cc\u5411'}</option>
          </select>
        </div>
      ) : null}
    </div>
  )
}

function DrawingTextPanel() {
  return (
    <div className="ff-drawing-hline-text-tab-v1">
      <div className="ff-drawing-hline-text-tab-v1__toolbar">
        <select className="ff-drawing-hline-text-tab-v1__font-size" defaultValue="12" aria-label="Font size">
          <option value="10">10</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
        </select>
        <button className="ff-drawing-hline-text-tab-v1__toggle" type="button">B</button>
        <button className="ff-drawing-hline-text-tab-v1__toggle" type="button">I</button>
      </div>
      <textarea className="ff-drawing-hline-text-tab-v1__textarea" rows={4} />
      <div className="ff-drawing-hline-text-tab-v1__align-row">
        <span className="ff-drawing-hline-text-tab-v1__align-label">{'\u5bf9\u9f50'}</span>
        <select className="ff-drawing-hline-text-tab-v1__align-select" defaultValue="center" aria-label="Text align">
          <option value="left">{'\u5de6'}</option>
          <option value="center">{'\u4e2d'}</option>
          <option value="right">{'\u53f3'}</option>
        </select>
      </div>
    </div>
  )
}

function DrawingCoordsPanel({ tool }: { tool: DrawingTool }) {
  const twoPoint = tool.key !== 'horizontalLine'
  return (
    <div className="ff-drawing-tline-coords-v1">
      <CoordinateRow label={twoPoint ? '1' : '\u4ef7\u683c'} />
      {twoPoint ? <CoordinateRow label="2" /> : null}
    </div>
  )
}

function CoordinateRow({ label }: { label: string }) {
  return (
    <div className="ff-drawing-tline-coords-v1__row">
      <span className="ff-drawing-tline-coords-v1__label">{label}</span>
      <input className="ff-drawing-tline-coords-v1__input" type="text" />
      <input className="ff-drawing-tline-coords-v1__input" type="text" />
    </div>
  )
}
