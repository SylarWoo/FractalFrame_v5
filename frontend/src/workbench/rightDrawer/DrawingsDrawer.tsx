import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { formatGlobalPrice } from '../chart/globalPricePrecision'
import { readString, writeString } from '../persistence/jsonStorage'
import { SettingsColorSwatch, SettingsLineSwatch } from '../settings/SettingsSwatches'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import {
  createDefaultDrawingLineStyle,
  createDefaultDrawingTextStyle,
  normalizeDrawingTextStyle,
  normalizeDrawingTrendLineStyle,
  readDrawingLineStyle,
  readDrawingPersistence,
  readDrawingPriceLabel,
  readDrawingTextStyle,
  readDrawingTrendLineStyle,
  writeDrawingLineStyle,
  writeDrawingPersistence,
  writeDrawingPriceLabel,
  writeDrawingTextStyle,
  writeDrawingTrendLineStyle,
} from './drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStatsData, DrawingTrendLineStyle } from './drawingPersistence'
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
  const [selectedDrawing, setSelectedDrawing] = useState<{ lineStyle?: SettingsLineSwatchValue; locked: boolean; objectId?: string; price?: number; showPriceLabel: boolean; textStyle?: DrawingTextStyle; tool: DrawingToolKey; trendPointPrices?: [number | undefined, number | undefined] } | null>(null)
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
  const [trendLineStyle, setTrendLineStyle] = useState<DrawingTrendLineStyle>(readDrawingTrendLineStyle)
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
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine') return
    publishDrawingToolCommand({
      action: 'updatePersistence',
      persisted: enabled,
      tool: selectedKey,
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
      if (event.detail.selected) {
        setSelectedKey(event.detail.tool)
        writeString(selectedToolStorageKey, event.detail.tool)
      }
      setSelectedDrawing((current) => {
        if (!event.detail.selected) {
          return current?.tool === event.detail.tool ? null : current
        }
        return {
          lineStyle: event.detail.lineStyle,
          locked: event.detail.locked,
          objectId: event.detail.objectId,
          price: event.detail.price,
          showPriceLabel: event.detail.showPriceLabel,
          textStyle: event.detail.textStyle,
          tool: event.detail.tool,
          trendPointPrices: event.detail.trendPointPrices,
        }
      })
    }
    window.addEventListener(drawingToolStateEvent, handleState)
    return () => {
      window.removeEventListener(drawingToolStateEvent, handleState)
    }
  }, [])

  useEffect(() => {
    if ((selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine') || visibleTab !== 'coords') return
    publishDrawingToolCommand({
      action: 'refreshSelectedState',
      tool: selectedKey,
    })
  }, [selectedKey, visibleTab])

  function armSelectedTool() {
    setArmedKey(selectedKey)
    if (selectedKey === 'trendLine') {
      publishDrawingToolCommand({
        action: 'start',
        lineStyle: lineStyles.trendLine ?? createDefaultDrawingLineStyle('#2962ff'),
        locked: selectedLocked,
        showPriceLabel: selectedPriceLabel,
        textStyle: selectedTextStyle,
        tool: 'trendLine',
        trendLineStyle,
      })
      return
    }
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
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine') return
    publishDrawingToolCommand({
      action: 'release',
      tool: selectedKey,
    })
  }

  function toggleSelectedLock() {
    if (selectedDrawing?.tool === selectedKey) {
      publishDrawingToolCommand({
        action: 'toggleSelectedLock',
        tool: selectedKey === 'trendLine' ? 'trendLine' : 'horizontalLine',
      })
      return
    }
    setLockedTools((current) => ({ ...current, [selectedKey]: !selectedLocked }))
  }

  function deleteSelectedDrawing() {
    const targetTool = selectedDrawing?.tool === 'horizontalLine' || selectedDrawing?.tool === 'trendLine'
      ? selectedDrawing.tool
      : selectedKey
    if (targetTool !== 'horizontalLine' && targetTool !== 'trendLine') return
    publishDrawingToolCommand({
      action: 'deleteSelected',
      tool: targetTool,
    })
  }

  function setSelectedPriceLabel(enabled: boolean) {
    setPriceLabelTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeDrawingPriceLabel(selectedKey, enabled)
    if (selectedDrawing?.tool === selectedKey) {
      setSelectedDrawing((current) => current?.tool === selectedKey
        ? { ...current, showPriceLabel: enabled }
        : current)
    }
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine') return
    if (selectedDrawing?.tool !== selectedKey && selectedKey !== 'trendLine') return
    publishDrawingToolCommand({
      action: 'updateSelectedPriceLabel',
      showPriceLabel: enabled,
      tool: selectedKey,
    })
  }

  function setSelectedLineStyle(value: SettingsLineSwatchValue) {
    setLineStyles((current) => ({ ...current, [selectedTool.key]: value }))
    writeDrawingLineStyle(selectedTool.key, value)
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine') return
    publishDrawingToolCommand({
      action: 'updateSelectedLineStyle',
      lineStyle: value,
      tool: selectedKey,
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

  function setSelectedTrendLineStyle(value: DrawingTrendLineStyle) {
    const normalized = normalizeDrawingTrendLineStyle(value)
    setTrendLineStyle(normalized)
    writeDrawingTrendLineStyle(normalized)
    publishDrawingToolCommand({
      action: 'updateSelectedTrendLineStyle',
      tool: 'trendLine',
      trendLineStyle: normalized,
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

  function setSelectedTrendPointPrice(pointIndex: number, price: number) {
    if (selectedKey !== 'trendLine') return
    setSelectedDrawing((current) => current?.tool === 'trendLine'
      ? {
          ...current,
          trendPointPrices: pointIndex === 0
            ? [price, current.trendPointPrices?.[1]]
            : [current.trendPointPrices?.[0], price],
        }
      : current)
    publishDrawingToolCommand({
      action: 'updateSelectedTrendLinePointPrice',
      pointIndex,
      price,
      tool: 'trendLine',
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
                  { active: selectedDrawing?.tool === selectedKey, label: '\u9009\u4e2d', statusOnly: true },
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
                        onTrendLineStyleChange={setSelectedTrendLineStyle}
                        priceLabelVisible={selectedPriceLabel}
                        selectedDrawing={selectedDrawing}
                        onPriceChange={setSelectedPrice}
                        onTrendPointPriceChange={setSelectedTrendPointPrice}
                        tab={tab}
                        textStyle={selectedTextStyle}
                        trendLineStyle={trendLineStyle}
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
  items: Array<{ active: boolean; label: string; onClick?: () => void; statusOnly?: boolean }>
}) {
  return (
    <div className={`ff-indicators-style-persistence-v1 ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          className="ff-indicators-style-persistence-v1__button"
          data-active={item.active ? 'true' : undefined}
          data-status-only={item.statusOnly ? 'true' : undefined}
          key={item.label}
          onClick={item.statusOnly ? undefined : item.onClick}
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
  onTrendPointPriceChange,
  onTrendLineStyleChange,
  priceLabelVisible,
  selectedDrawing,
  tab,
  textStyle,
  trendLineStyle,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  onPriceChange: (price: number) => void
  onTextStyleChange: (value: DrawingTextStyle) => void
  onTrendPointPriceChange: (pointIndex: number, price: number) => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  priceLabelVisible: boolean
  selectedDrawing: { locked: boolean; objectId?: string; price?: number; tool: DrawingToolKey; trendPointPrices?: [number | undefined, number | undefined] } | null
  tab: DrawingTab
  textStyle: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
  tool: DrawingTool
}) {
  if (tab === 'style') {
    return (
      <DrawingStylePanel
        lineStyle={lineStyle}
        onLineStyleChange={onLineStyleChange}
        onPriceLabelChange={onPriceLabelChange}
        onTrendLineStyleChange={onTrendLineStyleChange}
        priceLabelVisible={priceLabelVisible}
        trendLineStyle={trendLineStyle}
        tool={tool}
      />
    )
  }
  if (tab === 'text') return <DrawingTextPanel onTextStyleChange={onTextStyleChange} textStyle={textStyle} />
  return <DrawingCoordsPanel onPriceChange={onPriceChange} onTrendPointPriceChange={onTrendPointPriceChange} selectedDrawing={selectedDrawing} tool={tool} />
}

function DrawingStylePanel({
  lineStyle,
  onLineStyleChange,
  onPriceLabelChange,
  onTrendLineStyleChange,
  priceLabelVisible,
  trendLineStyle,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  priceLabelVisible: boolean
  trendLineStyle: DrawingTrendLineStyle
  tool: DrawingTool
}) {
  const updateTrendLineStyle = (patch: Partial<DrawingTrendLineStyle>) => {
    onTrendLineStyleChange(normalizeDrawingTrendLineStyle({ ...trendLineStyle, ...patch }))
  }

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
      {tool.key === 'trendLine' ? null : (
        <div className="ff-drawing-tline-tv-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">{'\u4ef7\u683c\u6807\u7b7e'}</span>
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={priceLabelVisible} onChange={(event) => onPriceLabelChange(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        </div>
      )}
      {tool.key === 'trendLine' ? (
        <TrendLineV4StyleOptions
          onChange={updateTrendLineStyle}
          onPriceLabelChange={onPriceLabelChange}
          priceLabelVisible={priceLabelVisible}
          settings={trendLineStyle}
        />
      ) : tool.key === 'fibRetracement' ? (
        <DrawingOpenableSelectRow
          label={'\u5ef6\u4f38'}
          onChange={() => undefined}
          options={drawingExtendModeOptions}
          value="none"
        />
      ) : null}
    </div>
  )
}

const drawingExtendModeOptions = [
  { label: '\u65e0', value: 'none' },
  { label: '\u5411\u5de6', value: 'left' },
  { label: '\u5411\u53f3', value: 'right' },
  { label: '\u53cc\u5411', value: 'both' },
]

const drawingMarkerOptions = [
  { label: '\u666e\u901a', value: 'normal' },
  { label: '\u7bad\u5934', value: 'arrow' },
]

const drawingStatsDataOptions = [
  { label: '\u4ef7\u683c\u8303\u56f4', value: 'price-range' },
  { label: '\u6da8\u8dcc\u5e45', value: 'percent-change' },
  { label: '\u70b9\u6570\u53d8\u5316', value: 'point-change' },
  { label: 'K \u7ebf\u6570', value: 'bar-range' },
  { label: '\u65e5\u671f/\u65f6\u95f4\u8303\u56f4', value: 'date-time-range' },
  { label: '\u8ddd\u79bb', value: 'distance' },
  { label: '\u89d2\u5ea6', value: 'angle' },
]

const drawingStatsPositionOptions = [
  { label: '\u5de6', value: 'left' },
  { label: '\u4e2d', value: 'center' },
  { label: '\u53f3', value: 'right' },
]

function DrawingOpenableSelectRow({
  className = '',
  label,
  onChange,
  options,
  value,
}: {
  className?: string
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="ff-drawing-tline-tv-row-v1">
      <span className="ff-drawing-tline-tv-label-v1">{label}</span>
      <OpenableSelect
        ariaLabel={label}
        className={`ff-drawing-tline-tv-openable-select-v1 ${className}`.trim()}
        onChange={onChange}
        options={options}
        value={value}
      />
    </div>
  )
}

function TrendStatsDataSelect({
  onChange,
  value,
}: {
  onChange: (value: DrawingTrendLineStatsData[]) => void
  value: DrawingTrendLineStatsData[]
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const selected = new Set(value)
  const selectedLabels = drawingStatsDataOptions
    .filter((option) => selected.has(option.value as DrawingTrendLineStatsData))
    .map((option) => option.label)
  const display = selectedLabels.length > 0 ? selectedLabels.join(', ') : '\u9690\u85cf'

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [open])

  const toggle = (key: DrawingTrendLineStatsData) => {
    const next = selected.has(key)
      ? value.filter((item) => item !== key)
      : [...value, key]
    onChange(next)
  }

  return (
    <div className="ff-openable-select ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-stats-select-v1" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="\u7edf\u8ba1\u6570\u636e"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-drawing-tline-tv-stats-select-v1__value">{display}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{'\u2304'}</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu ff-drawing-tline-tv-stats-select-v1__menu" role="listbox">
          {drawingStatsDataOptions.map((option) => {
            const key = option.value as DrawingTrendLineStatsData
            return (
              <button
                className="ff-drawing-tline-tv-stats-select-v1__option"
                data-active={selected.has(key) ? 'true' : undefined}
                key={option.value}
                onClick={() => toggle(key)}
                role="option"
                type="button"
              >
                <span className="ff-drawing-tline-tv-stats-select-v1__box" data-checked={selected.has(key) ? 'true' : undefined} />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TrendExtendModeSelect({
  onChange,
  value,
}: {
  onChange: (value: DrawingTrendLineStyle['extendMode']) => void
  value: DrawingTrendLineStyle['extendMode']
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const leftChecked = value === 'left' || value === 'both'
  const rightChecked = value === 'right' || value === 'both'
  const display = leftChecked && rightChecked
    ? '\u53cc\u5411'
    : leftChecked
      ? '\u5411\u5de6'
      : rightChecked
        ? '\u5411\u53f3'
        : '\u4e0d\u8981\u6269\u5927'

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', close, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [open])

  const commit = (nextLeft: boolean, nextRight: boolean) => {
    onChange(nextLeft && nextRight ? 'both' : nextLeft ? 'left' : nextRight ? 'right' : 'none')
  }

  return (
    <div className="ff-openable-select ff-drawing-tline-tv-openable-select-v1 ff-drawing-tline-tv-check-select-v1" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-label="\u5ef6\u4f38"
        className="ff-openable-select__button ff-openable-control"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="ff-drawing-tline-tv-check-select-v1__value">{display}</span>
        <span aria-hidden="true" className="ff-openable-select__chevron">{'\u2304'}</span>
      </button>
      {open && (
        <div className="ff-openable-select__menu ff-drawing-tline-tv-check-select-v1__menu" role="listbox">
          <button
            className="ff-drawing-tline-tv-check-select-v1__option"
            data-active={leftChecked ? 'true' : undefined}
            onClick={() => commit(!leftChecked, rightChecked)}
            role="option"
            type="button"
          >
            <span className="ff-drawing-tline-tv-check-select-v1__box" data-checked={leftChecked ? 'true' : undefined} />
            <span>{'\u5411\u5de6\u6269\u5927'}</span>
          </button>
          <button
            className="ff-drawing-tline-tv-check-select-v1__option"
            data-active={rightChecked ? 'true' : undefined}
            onClick={() => commit(leftChecked, !rightChecked)}
            role="option"
            type="button"
          >
            <span className="ff-drawing-tline-tv-check-select-v1__box" data-checked={rightChecked ? 'true' : undefined} />
            <span>{'\u5411\u53f3\u6269\u5927'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

function TrendLineV4StyleOptions({
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
      <DrawingOpenableSelectRow className="ff-drawing-tline-tv-openable-select-v1--stats-position" label={'\u7edf\u8ba1\u4f4d\u7f6e'} onChange={(value) => onChange({ statsPosition: value as DrawingTrendLineStyle['statsPosition'] })} options={drawingStatsPositionOptions} value={settings.statsPosition} />
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
  onTrendPointPriceChange,
  selectedDrawing,
  tool,
}: {
  onPriceChange: (price: number) => void
  onTrendPointPriceChange: (pointIndex: number, price: number) => void
  selectedDrawing: { locked: boolean; price?: number; tool: DrawingToolKey; trendPointPrices?: [number | undefined, number | undefined] } | null
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
  if (tool.key === 'trendLine') {
    return (
      <TrendLineCoordsPanel
        locked={selectedDrawing?.tool === 'trendLine' && selectedDrawing.locked}
        onPointPriceChange={onTrendPointPriceChange}
        pointPrices={selectedDrawing?.tool === 'trendLine' ? selectedDrawing.trendPointPrices : undefined}
        selected={selectedDrawing?.tool === 'trendLine'}
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
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (editing) return
    setDraft(Number.isFinite(price) ? formatGlobalPrice(price, '') : '')
  }, [editing, price])

  if (!selected) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{'\u672a\u9009\u4e2d\u6c34\u5e73\u7ebf\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u6761\u6c34\u5e73\u7ebf\uff0c\u518d\u5728\u6b64\u4fee\u6539\u4ef7\u683c\u5750\u6807\u3002'}</p>
  }

  if (locked) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{'\u5f53\u524d\u9009\u4e2d\u7684\u6c34\u5e73\u7ebf\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}</p>
  }

  const commit = () => {
    const nextPrice = Number(draft.trim().replace(/,/g, ''))
    if (!Number.isFinite(nextPrice)) {
      setDraft(Number.isFinite(price) ? formatGlobalPrice(price, '') : '')
      setEditing(false)
      return
    }
    onPriceChange(nextPrice)
    setDraft(formatGlobalPrice(nextPrice, ''))
    setEditing(false)
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
          onFocus={() => {
            setEditing(true)
            setDraft(Number.isFinite(price) ? formatGlobalPrice(price, '') : '')
          }}
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

function TrendLineCoordsPanel({
  locked,
  onPointPriceChange,
  pointPrices,
  selected,
}: {
  locked: boolean
  onPointPriceChange: (pointIndex: number, price: number) => void
  pointPrices?: [number | undefined, number | undefined]
  selected: boolean
}) {
  if (!selected) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{'未选中趋势线：请先在图上选中一条趋势线。'}</p>
  }
  if (locked) {
    return <p className="ff-drawing-hline-coords-tab-v1__hint">{'当前选中的趋势线已锁定，无法修改坐标。请先解锁。'}</p>
  }
  return (
    <div className="ff-drawing-tline-price-coords-v1">
      <TrendLinePriceCoordinateRow index={0} onChange={onPointPriceChange} price={pointPrices?.[0]} />
      <TrendLinePriceCoordinateRow index={1} onChange={onPointPriceChange} price={pointPrices?.[1]} />
    </div>
  )
}

function TrendLinePriceCoordinateRow({ index, onChange, price }: { index: number; onChange: (pointIndex: number, price: number) => void; price?: number }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (editing) return
    setDraft(Number.isFinite(price) ? formatGlobalPrice(price, '') : '')
  }, [editing, price])

  const commit = () => {
    const nextPrice = Number(draft.trim().replace(/,/g, ''))
    if (!Number.isFinite(nextPrice)) {
      setDraft(Number.isFinite(price) ? formatGlobalPrice(price, '') : '')
      setEditing(false)
      return
    }
    onChange(index, nextPrice)
    setDraft(formatGlobalPrice(nextPrice, ''))
    setEditing(false)
  }

  return (
    <div className="ff-drawing-tline-price-coords-v1__row">
      <label className="ff-drawing-tline-price-coords-v1__label" htmlFor={`ff-drawing-tline-price-${index + 1}-v1`}>
        {`#${index + 1}（价格）`}
      </label>
      <input
        autoComplete="off"
        className="ff-drawing-tline-price-coords-v1__input"
        id={`ff-drawing-tline-price-${index + 1}-v1`}
        inputMode="decimal"
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => {
          setEditing(true)
          setDraft(Number.isFinite(price) ? formatGlobalPrice(price, '') : '')
        }}
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
  )
}
