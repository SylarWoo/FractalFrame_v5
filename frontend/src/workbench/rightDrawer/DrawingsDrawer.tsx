import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readString, writeString } from '../persistence/jsonStorage'
import { SettingsColorSwatch, SettingsLineSwatch } from '../settings/SettingsSwatches'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import {
  createDefaultDrawingLineStyle,
  createDefaultDrawingTextStyle,
  normalizeDrawingTextStyle,
  readDrawingLineStyle,
  readDrawingPersistence,
  readDrawingPriceLabel,
  readDrawingTextStyle,
  writeDrawingLineStyle,
  writeDrawingPersistence,
  writeDrawingPriceLabel,
  writeDrawingTextStyle,
} from './drawingPersistence'
import type { DrawingTextStyle } from './drawingPersistence'
import { drawingToolStateEvent, isDrawingToolStateEvent, publishDrawingToolCommand } from './drawingToolCommands'
import './DrawingsDrawer.css'

type DrawingToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'cursor'
type DrawingTab = 'style' | 'text' | 'coords'
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
  { key: 'horizontalLine', label: '\u6c34\u5e73\u7ebf', tabs: ['style', 'text', 'coords'] },
  { key: 'trendLine', label: '\u8d8b\u52bf\u7ebf', tabs: ['style', 'text', 'coords'] },
  { key: 'ruler', label: '\u6807\u5c3a', tabs: ['style', 'text', 'coords'] },
  { key: 'fibRetracement', label: '\u6590\u6ce2\u90a3\u5951\u56de\u64a4', tabs: ['style', 'coords'] },
  { key: 'cursor', label: '\u5149\u6807' },
]

const tabLabels: Record<DrawingTab, string> = {
  coords: '\u5750\u6807',
  style: '\u6837\u5f0f',
  text: '\u6587\u672c',
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

export function DrawingsDrawer() {
  const [selectedKey, setSelectedKey] = useState<DrawingToolKey>(readInitialSelectedTool)
  const [armedKey, setArmedKey] = useState<DrawingToolKey | null>(null)
  const [activeTab, setActiveTab] = useState<DrawingTab>('style')
  const [persistedTools, setPersistedTools] = useState<Record<string, boolean>>(() => Object.fromEntries(
    drawingTools.map((tool) => [tool.key, readDrawingPersistence(tool.key)]),
  ))
  const [lockedTools, setLockedTools] = useState<Record<string, boolean>>({})
  const [priceLabelTools, setPriceLabelTools] = useState<Record<string, boolean>>(() => Object.fromEntries(
    drawingTools.map((tool) => [tool.key, readDrawingPriceLabel(tool.key)]),
  ))
  const [selectedDrawing, setSelectedDrawing] = useState<{ lineStyle?: SettingsLineSwatchValue; locked: boolean; objectId?: string; price?: number; showPriceLabel: boolean; textStyle?: DrawingTextStyle; tool: DrawingToolKey } | null>(null)
  const [lineStyles, setLineStyles] = useState<Record<string, SettingsLineSwatchValue>>(() => ({
    fibRetracement: readDrawingLineStyle('fibRetracement', createDefaultDrawingLineStyle('#787b86')),
    horizontalLine: readDrawingLineStyle('horizontalLine', createDefaultDrawingLineStyle('#0f766e')),
    ruler: readDrawingLineStyle('ruler', createDefaultDrawingLineStyle('#2962ff')),
    trendLine: readDrawingLineStyle('trendLine', createDefaultDrawingLineStyle('#2962ff')),
  }))
  const [textStyles, setTextStyles] = useState<Record<string, DrawingTextStyle>>(() => ({
    fibRetracement: createDefaultDrawingTextStyle(),
    horizontalLine: readDrawingTextStyle('horizontalLine'),
    ruler: createDefaultDrawingTextStyle(),
    trendLine: createDefaultDrawingTextStyle(),
  }))
  const [cursorMode, setCursorMode] = useState<CursorMode>(readCursorMode)
  const [topHeight, setTopHeight] = useState(defaultTopHeight)
  const selectedTool = drawingTools.find((tool) => tool.key === selectedKey) ?? drawingTools[0]
  const selectedPersisted = persistedTools[selectedKey] !== false
  const selectedLocked = selectedDrawing?.tool === selectedKey ? selectedDrawing.locked : lockedTools[selectedKey] === true
  const selectedPriceLabel = selectedDrawing?.tool === selectedKey ? selectedDrawing.showPriceLabel : priceLabelTools[selectedKey] !== false
  const selectedLineStyle = selectedDrawing?.tool === selectedKey && selectedDrawing.lineStyle
    ? selectedDrawing.lineStyle
    : lineStyles[selectedTool.key] ?? createDefaultDrawingLineStyle()
  const selectedTextStyle = normalizeDrawingTextStyle(selectedDrawing?.tool === selectedKey && selectedDrawing.textStyle
    ? selectedDrawing.textStyle
    : textStyles[selectedTool.key] ?? createDefaultDrawingTextStyle())
  const tabs = selectedTool.tabs ?? []
  const visibleTab = tabs.includes(activeTab) ? activeTab : tabs[0] ?? 'style'

  function selectTool(key: DrawingToolKey) {
    setSelectedKey(key)
    writeString(selectedToolStorageKey, key)
    if (!drawingTools.find((tool) => tool.key === key)?.tabs?.includes(activeTab)) setActiveTab('style')
  }

  function setPersistence(enabled: boolean) {
    setPersistedTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeDrawingPersistence(selectedKey, enabled)
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'updatePersistence',
      persisted: enabled,
      tool: 'horizontalLine',
    })
  }

  function setCursor(next: CursorMode) {
    setCursorMode(next)
    writeString(cursorModeStorageKey, next)
  }

  useEffect(() => {
    const handleState = (event: Event) => {
      if (!isDrawingToolStateEvent(event)) return
      if (!event.detail.armed) setArmedKey((current) => current === event.detail.tool ? null : current)
      setSelectedDrawing(event.detail.selected ? {
        lineStyle: event.detail.lineStyle,
        locked: event.detail.locked,
        objectId: event.detail.objectId,
        price: event.detail.price,
        showPriceLabel: event.detail.showPriceLabel,
        textStyle: event.detail.textStyle,
        tool: event.detail.tool,
      } : null)
    }
    window.addEventListener(drawingToolStateEvent, handleState)
    return () => {
      window.removeEventListener(drawingToolStateEvent, handleState)
    }
  }, [])

  useEffect(() => {
    if (selectedKey !== 'horizontalLine' || visibleTab !== 'coords') return
    publishDrawingToolCommand({
      action: 'refreshSelectedState',
      tool: 'horizontalLine',
    })
  }, [selectedKey, visibleTab])

  function armSelectedTool() {
    setArmedKey(selectedKey)
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'start',
      lineStyle: lineStyles.horizontalLine ?? createDefaultDrawingLineStyle('#0f766e'),
      locked: selectedLocked,
      showPriceLabel: selectedPriceLabel,
      textStyle: selectedTextStyle,
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

  function toggleSelectedLock() {
    if (selectedDrawing?.tool === selectedKey) {
      publishDrawingToolCommand({
        action: 'toggleSelectedLock',
        tool: 'horizontalLine',
      })
      return
    }
    setLockedTools((current) => ({ ...current, [selectedKey]: !selectedLocked }))
  }

  function deleteSelectedDrawing() {
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'deleteSelected',
      tool: 'horizontalLine',
    })
  }

  function setSelectedPriceLabel(enabled: boolean) {
    setPriceLabelTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeDrawingPriceLabel(selectedKey, enabled)
    if (selectedDrawing?.tool !== selectedKey || selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'updateSelectedPriceLabel',
      showPriceLabel: enabled,
      tool: 'horizontalLine',
    })
  }

  function setSelectedLineStyle(value: SettingsLineSwatchValue) {
    setLineStyles((current) => ({ ...current, [selectedTool.key]: value }))
    writeDrawingLineStyle(selectedTool.key, value)
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'updateSelectedLineStyle',
      lineStyle: value,
      tool: 'horizontalLine',
    })
  }

  function setSelectedTextStyle(value: DrawingTextStyle) {
    const normalized = normalizeDrawingTextStyle(value)
    setTextStyles((current) => ({ ...current, [selectedTool.key]: normalized }))
    writeDrawingTextStyle(selectedTool.key, normalized)
    if (selectedKey !== 'horizontalLine') return
    publishDrawingToolCommand({
      action: 'updateSelectedTextStyle',
      textStyle: normalized,
      tool: 'horizontalLine',
    })
  }

  function setSelectedPrice(price: number) {
    if (selectedKey !== 'horizontalLine') return
    setSelectedDrawing((current) => current?.tool === 'horizontalLine'
      ? { ...current, price }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedPrice',
      price,
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
                  { active: selectedDrawing?.tool === selectedKey, label: '\u9009\u4e2d', onClick: () => undefined },
                  { active: selectedLocked, label: '\u9501\u5b9a', onClick: toggleSelectedLock },
                  { active: false, label: '\u5220\u9664', onClick: deleteSelectedDrawing },
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
                        lineStyle={selectedLineStyle}
                        onLineStyleChange={setSelectedLineStyle}
                        onPriceLabelChange={setSelectedPriceLabel}
                        onTextStyleChange={setSelectedTextStyle}
                        priceLabelVisible={selectedPriceLabel}
                        selectedDrawing={selectedDrawing}
                        onPriceChange={setSelectedPrice}
                        tab={tab}
                        textStyle={selectedTextStyle}
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
  onPriceLabelChange,
  onPriceChange,
  onTextStyleChange,
  priceLabelVisible,
  selectedDrawing,
  tab,
  textStyle,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  onPriceChange: (price: number) => void
  onTextStyleChange: (value: DrawingTextStyle) => void
  priceLabelVisible: boolean
  selectedDrawing: { locked: boolean; objectId?: string; price?: number; tool: DrawingToolKey } | null
  tab: DrawingTab
  textStyle: DrawingTextStyle
  tool: DrawingTool
}) {
  if (tab === 'style') {
    return (
      <DrawingStylePanel
        lineStyle={lineStyle}
        onLineStyleChange={onLineStyleChange}
        onPriceLabelChange={onPriceLabelChange}
        priceLabelVisible={priceLabelVisible}
        tool={tool}
      />
    )
  }
  if (tab === 'text') return <DrawingTextPanel onTextStyleChange={onTextStyleChange} textStyle={textStyle} />
  return <DrawingCoordsPanel onPriceChange={onPriceChange} selectedDrawing={selectedDrawing} tool={tool} />
}

function DrawingStylePanel({
  lineStyle,
  onLineStyleChange,
  onPriceLabelChange,
  priceLabelVisible,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  priceLabelVisible: boolean
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
          <input checked={priceLabelVisible} onChange={(event) => onPriceLabelChange(event.target.checked)} type="checkbox" />
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

function DrawingTextPanel({
  onTextStyleChange,
  textStyle,
}: {
  onTextStyleChange: (value: DrawingTextStyle) => void
  textStyle: DrawingTextStyle
}) {
  const displayTextStyle = normalizeDrawingTextStyle(textStyle)
  useEffect(() => {
    if (displayTextStyle.body === textStyle.body) return
    onTextStyleChange(displayTextStyle)
  }, [displayTextStyle, onTextStyleChange, textStyle.body])

  const update = (patch: Partial<DrawingTextStyle>) => {
    onTextStyleChange(normalizeDrawingTextStyle({ ...displayTextStyle, ...patch }))
  }

  return (
    <div className="ff-drawing-hline-text-tab-v1">
      <p className="ff-drawing-hline-text-tab-v1__hint">{'\u672a\u9009\u4e2d\u6c34\u5e73\u7ebf\uff1a\u6b64\u5904\u7f16\u8f91\u7684\u662f\u65b0\u753b\u7ebf\u7684\u9ed8\u8ba4\u6587\u5b57\u3002'}</p>
      <div className="ff-drawing-hline-text-tab-v1__toolbar">
        <SettingsColorSwatch
          color={displayTextStyle.textColor}
          onChange={(value) => update({ textColor: value.hex })}
          value={{ hex: displayTextStyle.textColor, opacity: 1 }}
        />
        <OpenableSelect
          ariaLabel="Font size"
          className="ff-drawing-hline-text-tab-v1__font-size"
          onChange={(value) => update({ fontSize: Number(value) })}
          options={[
            { label: '10', value: '10' },
            { label: '12', value: '12' },
            { label: '14', value: '14' },
            { label: '16', value: '16' },
            { label: '18', value: '18' },
            { label: '20', value: '20' },
            { label: '24', value: '24' },
          ]}
          value={String(displayTextStyle.fontSize)}
        />
        <button
          aria-pressed={displayTextStyle.bold}
          className="ff-drawing-hline-text-tab-v1__toggle"
          data-active={displayTextStyle.bold ? 'true' : undefined}
          onClick={() => update({ bold: !displayTextStyle.bold })}
          type="button"
        >
          B
        </button>
        <button
          aria-pressed={displayTextStyle.italic}
          className="ff-drawing-hline-text-tab-v1__toggle"
          data-active={displayTextStyle.italic ? 'true' : undefined}
          onClick={() => update({ italic: !displayTextStyle.italic })}
          type="button"
        >
          I
        </button>
      </div>
      <textarea
        className="ff-drawing-hline-text-tab-v1__textarea"
        onChange={(event) => update({ body: event.target.value })}
        placeholder="添加文字"
        rows={4}
        spellCheck={false}
        value={displayTextStyle.body}
      />
      <div className="ff-drawing-hline-text-tab-v1__align-row">
        <span className="ff-drawing-hline-text-tab-v1__align-label">{'\u5bf9\u9f50'}</span>
        <OpenableSelect
          ariaLabel="\u5782\u76f4\u5bf9\u9f50"
          className="ff-drawing-hline-text-tab-v1__align-select"
          options={[
            { label: '\u9876\u90e8', value: 'top' },
            { label: '\u4e2d\u95f4', value: 'middle' },
            { label: '\u5e95\u90e8', value: 'bottom' },
          ]}
          onChange={(value) => update({ alignV: value as DrawingTextStyle['alignV'] })}
          value={displayTextStyle.alignV}
        />
        <OpenableSelect
          ariaLabel="\u6c34\u5e73\u5bf9\u9f50"
          className="ff-drawing-hline-text-tab-v1__align-select"
          options={[
            { label: '\u5de6', value: 'left' },
            { label: '\u4e2d', value: 'center' },
            { label: '\u53f3', value: 'right' },
          ]}
          onChange={(value) => update({ alignH: value as DrawingTextStyle['alignH'] })}
          value={displayTextStyle.alignH}
        />
      </div>
    </div>
  )
}

function DrawingCoordsPanel({
  onPriceChange,
  selectedDrawing,
  tool,
}: {
  onPriceChange: (price: number) => void
  selectedDrawing: { locked: boolean; price?: number; tool: DrawingToolKey } | null
  tool: DrawingTool
}) {
  if (tool.key === 'horizontalLine') {
    return (
      <HorizontalLineCoordsPanel
        locked={selectedDrawing?.tool === 'horizontalLine' && selectedDrawing.locked}
        onPriceChange={onPriceChange}
        price={selectedDrawing?.tool === 'horizontalLine' ? selectedDrawing.price : undefined}
        selected={selectedDrawing?.tool === 'horizontalLine'}
      />
    )
  }
  const twoPoint = true
  return (
    <div className="ff-drawing-tline-coords-v1">
      <CoordinateRow label={twoPoint ? '1' : '\u4ef7\u683c'} />
      {twoPoint ? <CoordinateRow label="2" /> : null}
    </div>
  )
}

function HorizontalLineCoordsPanel({
  locked,
  onPriceChange,
  price,
  selected,
}: {
  locked: boolean
  onPriceChange: (price: number) => void
  price?: number
  selected: boolean
}) {
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft(Number.isFinite(price) ? String(Number(price)) : '')
  }, [price])

  if (!selected) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{'\u672a\u9009\u4e2d\u6c34\u5e73\u7ebf\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u6761\u6c34\u5e73\u7ebf\uff0c\u518d\u5728\u6b64\u4fee\u6539\u4ef7\u683c\u5750\u6807\u3002'}</p>
  }

  if (locked) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{'\u5f53\u524d\u9009\u4e2d\u7684\u6c34\u5e73\u7ebf\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}</p>
  }

  const commit = () => {
    const nextPrice = Number(draft.trim().replace(/,/g, ''))
    if (!Number.isFinite(nextPrice)) return
    onPriceChange(nextPrice)
  }

  return (
    <div className="ff-drawing-hline-coords-tab-v1">
      <div className="ff-drawing-hline-coords-tab-v1__row">
        <label className="ff-drawing-hline-coords-tab-v1__label" htmlFor="ff-drawing-hline-coords-price-v1">
          {'#1\uff08\u4ef7\u683c\uff09'}
        </label>
        <input
          autoComplete="off"
          className="ff-drawing-hline-coords-tab-v1__input"
          id="ff-drawing-hline-coords-price-v1"
          inputMode="decimal"
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
          }}
          step="any"
          type="number"
          value={draft}
        />
      </div>
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
