import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { OpenableSelect } from '../controls/OpenableSelect'
import { readString, writeString } from '../persistence/jsonStorage'
import { SettingsColorSwatch, SettingsLineSwatch } from '../settings/SettingsSwatches'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import {
  createDefaultDrawingLineStyle,
  createDefaultDrawingTextStyle,
  normalizeDrawingTextStyle,
  normalizeDrawingTrendLineStyle,
  readDrawingLineStyle,
  readDrawingPriceLabel,
  readDrawingTextStyle,
  readDrawingTrendLineStyle,
  writeDrawingLineStyle,
  writeDrawingPriceLabel,
  writeDrawingTextStyle,
  writeDrawingTrendLineStyle,
} from './drawingPersistence'
import type { DrawingTextStyle, DrawingTrendLineStatsData, DrawingTrendLineStyle } from './drawingPersistence'
import { readDrawingObjectPersistence, writeDrawingObjectPersistence } from './drawingObjectPersistence'
import { drawingToolStateEvent, isDrawingToolStateEvent, publishDrawingToolCommand } from './drawingToolCommands'
import { objectTreeDrawingsChangedEvent, publishObjectTreeDrawingCommand, requestObjectTreeDrawings, type ObjectTreeDrawingsChangedDetail } from './objectTree/objectTreeModel'
import type { ObjectTreeDrawingItem } from './objectTree/objectTreeTypes'
import { shortObjectTreeId } from './objectTree/objectTreeVisibility'
import { DrawingPriceCoordsPanel } from './DrawingCoordsPanel'
import { DrawingTextPanel } from './DrawingTextPanel'
import { DrawingToolActionControls, DrawingToolHeader, DrawingToolPersistenceControls, DrawingToolTabs, SegmentedControl } from './DrawingToolControls'
import { RulerStylePanel } from './RulerStylePanel'
import type { DrawingRulerStyle } from './rulerDrawingStyle'
import { normalizeDrawingRulerStyle, readDrawingRulerStyle, writeDrawingRulerStyle } from './rulerDrawingStyle'
import { readQuickMeasureEnabled, writeQuickMeasureEnabled } from './quickMeasurePersistence'
import './DrawingsDrawer.css'

type DrawingToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'cursor'
type DrawingTab = 'style' | 'text' | 'coords'
type CursorMode = 'cursor' | 'crosshair'

type DrawingTool = {
  key: DrawingToolKey
  label: string
  tabs?: DrawingTab[]
}

type SelectedDrawingState = {
  lineStyle?: SettingsLineSwatchValue
  locked: boolean
  objectId?: string
  price?: number
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
  tool: DrawingToolKey
  trendPointPrices?: [number | undefined, number | undefined]
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

function createDefaultTrendLineTextStyle(): DrawingTextStyle {
  return {
    ...createDefaultDrawingTextStyle(),
    alignH: 'center',
  }
}

function createEmptyTrendLineTextStyle(): DrawingTextStyle {
  return {
    ...createDefaultTrendLineTextStyle(),
    body: '',
  }
}

function drawingToolKeyFromObjectTreeItem(item: ObjectTreeDrawingItem): DrawingToolKey {
  if (item.kind === 'trendLine') return 'trendLine'
  if (item.kind === 'ruler') return 'ruler'
  if (item.kind === 'fibRetracement') return 'fibRetracement'
  return 'horizontalLine'
}

export function DrawingsDrawer() {
  const [selectedKey, setSelectedKey] = useState<DrawingToolKey>(readInitialSelectedTool)
  const [armedKey, setArmedKey] = useState<DrawingToolKey | null>(null)
  const [activeTab, setActiveTab] = useState<DrawingTab>('style')
  const [persistedTools, setPersistedTools] = useState<Record<string, boolean>>(() => Object.fromEntries(
    drawingTools.map((tool) => [tool.key, tool.key === 'horizontalLine' || tool.key === 'trendLine' || tool.key === 'ruler' || tool.key === 'fibRetracement' ? readDrawingObjectPersistence(tool.key) : false]),
  ))
  const [lockedTools, setLockedTools] = useState<Record<string, boolean>>({})
  const [priceLabelTools, setPriceLabelTools] = useState<Record<string, boolean>>(() => Object.fromEntries(
    drawingTools.map((tool) => [tool.key, readDrawingPriceLabel(tool.key)]),
  ))
  const [selectedDrawing, setSelectedDrawing] = useState<SelectedDrawingState | null>(null)
  const [lineStyles, setLineStyles] = useState<Record<string, SettingsLineSwatchValue>>(() => ({
    fibRetracement: readDrawingLineStyle('fibRetracement', createDefaultDrawingLineStyle('#787b86')),
    horizontalLine: readDrawingLineStyle('horizontalLine', createDefaultDrawingLineStyle('#0f766e')),
    ruler: readDrawingLineStyle('ruler', createDefaultDrawingLineStyle('#2962ff')),
    trendLine: readDrawingLineStyle('trendLine', createDefaultDrawingLineStyle('#2962ff')),
  }))
  const [textStyles, setTextStyles] = useState<Record<string, DrawingTextStyle>>(() => ({
    fibRetracement: createDefaultDrawingTextStyle(),
    horizontalLine: readDrawingTextStyle('horizontalLine'),
    ruler: readDrawingTextStyle('ruler'),
    trendLine: readDrawingTextStyle('trendLine').body ? readDrawingTextStyle('trendLine') : createDefaultTrendLineTextStyle(),
  }))
  const [trendLineStyle, setTrendLineStyle] = useState<DrawingTrendLineStyle>(readDrawingTrendLineStyle)
  const [rulerStyle, setRulerStyle] = useState<DrawingRulerStyle>(readDrawingRulerStyle)
  const [quickMeasureEnabled, setQuickMeasureEnabled] = useState(readQuickMeasureEnabled)
  const [cursorMode, setCursorMode] = useState<CursorMode>(readCursorMode)
  const [topHeight, setTopHeight] = useState(defaultTopHeight)
  const selectedTool = drawingTools.find((tool) => tool.key === selectedKey) ?? drawingTools[0]
  const selectedPersisted = persistedTools[selectedKey] !== false
  const selectedLocked = selectedDrawing?.tool === selectedKey ? selectedDrawing.locked : lockedTools[selectedKey] === true
  const selectedPriceLabel = selectedDrawing?.tool === selectedKey ? selectedDrawing.showPriceLabel : priceLabelTools[selectedKey] !== false
  const selectedLineStyle = selectedDrawing?.tool === selectedKey && selectedDrawing.lineStyle
    ? selectedDrawing.lineStyle
    : lineStyles[selectedTool.key] ?? createDefaultDrawingLineStyle()
  const selectedDrawingHasObject = (selectedKey === 'horizontalLine' || selectedKey === 'trendLine')
    && selectedDrawing?.tool === selectedKey
    && Boolean(selectedDrawing.objectId)
  const selectedTextStyle = normalizeDrawingTextStyle((selectedKey === 'horizontalLine' || selectedKey === 'trendLine') && !selectedDrawingHasObject
    ? selectedKey === 'trendLine'
      ? createEmptyTrendLineTextStyle()
      : { ...createDefaultDrawingTextStyle(), body: '' }
    : selectedDrawing?.tool === selectedKey && selectedDrawing.textStyle
      ? selectedDrawing.textStyle
      : textStyles[selectedTool.key] ?? createDefaultDrawingTextStyle())
  const tabs = selectedTool.tabs ?? []
  const visibleTab = tabs.includes(activeTab) ? activeTab : tabs[0] ?? 'style'
  const selectedObjectId = selectedDrawing?.tool === selectedKey && selectedDrawing.objectId
    ? shortObjectTreeId(selectedDrawing.objectId)
    : ''

  function selectTool(key: DrawingToolKey) {
    if (selectedDrawing?.tool !== key && selectedDrawing?.objectId && (key === 'horizontalLine' || key === 'trendLine' || key === 'ruler' || key === 'fibRetracement')) {
      publishObjectTreeDrawingCommand({ action: 'deselect', id: selectedDrawing.objectId })
      setSelectedDrawing(null)
    }
    setSelectedKey(key)
    writeString(selectedToolStorageKey, key)
    if (!drawingTools.find((tool) => tool.key === key)?.tabs?.includes(activeTab)) setActiveTab('style')
  }

  function setPersistence(enabled: boolean) {
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') return
    setPersistedTools((current) => ({ ...current, [selectedKey]: enabled }))
    writeDrawingObjectPersistence(selectedKey, enabled)
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
    const handleDrawingsChanged = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const detail = event.detail as ObjectTreeDrawingsChangedDetail | undefined
      const items = Array.isArray(detail?.items) ? detail.items : []
      const selectedItems = items.filter((item) => item.selected)
      const activeItem = typeof detail?.activeId === 'string'
        ? selectedItems.find((item) => item.id === detail.activeId)
        : selectedItems[selectedItems.length - 1]
      if (!activeItem) return
      const tool = drawingToolKeyFromObjectTreeItem(activeItem)
      setSelectedKey(tool)
      writeString(selectedToolStorageKey, tool)
      setSelectedDrawing((current) => {
        if (current?.objectId === activeItem.id) {
          return {
            ...current,
            locked: activeItem.locked,
            objectId: activeItem.id,
            tool,
          }
        }
        return {
          locked: activeItem.locked,
          objectId: activeItem.id,
          showPriceLabel: true,
          tool,
        }
      })
    }

    window.addEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
    requestObjectTreeDrawings()
    return () => {
      window.removeEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
    }
  }, [])

  useEffect(() => {
    if ((selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') || visibleTab !== 'coords') return
    publishDrawingToolCommand({
      action: 'refreshSelectedState',
      tool: selectedKey,
    })
  }, [selectedKey, visibleTab])

  useEffect(() => {
    publishDrawingToolCommand({
      action: 'updateQuickMeasureEnabled',
      enabled: quickMeasureEnabled,
      tool: 'ruler',
    })
  }, [])

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
    if (selectedKey === 'ruler') {
      publishDrawingToolCommand({
        action: 'start',
        lineStyle: lineStyles.ruler ?? createDefaultDrawingLineStyle('#2962ff'),
        locked: selectedLocked,
        rulerStyle,
        showPriceLabel: selectedPriceLabel,
        textStyle: selectedTextStyle,
        tool: 'ruler',
      })
      return
    }
    if (selectedKey === 'fibRetracement') {
      publishDrawingToolCommand({
        action: 'start',
        lineStyle: lineStyles.fibRetracement ?? createDefaultDrawingLineStyle('#787b86'),
        locked: selectedLocked,
        rulerStyle: {
          ...rulerStyle,
          statsAlwaysVisible: false,
          statsData: [],
        },
        showPriceLabel: selectedPriceLabel,
        tool: 'fibRetracement',
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
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') return
    publishDrawingToolCommand({
      action: 'release',
      tool: selectedKey,
    })
  }

  function toggleSelectedLock() {
    if (selectedDrawing?.tool === selectedKey) {
      if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') return
      publishDrawingToolCommand({
        action: 'toggleSelectedLock',
        tool: selectedKey,
      })
      return
    }
    setLockedTools((current) => ({ ...current, [selectedKey]: !selectedLocked }))
  }

  function deleteSelectedDrawing() {
    const targetTool = selectedDrawing?.tool === 'horizontalLine' || selectedDrawing?.tool === 'trendLine' || selectedDrawing?.tool === 'ruler' || selectedDrawing?.tool === 'fibRetracement'
      ? selectedDrawing.tool
      : selectedKey
    if (targetTool !== 'horizontalLine' && targetTool !== 'trendLine' && targetTool !== 'ruler' && targetTool !== 'fibRetracement') return
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
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') return
    if (selectedDrawing?.tool !== selectedKey && selectedKey !== 'trendLine' && selectedKey !== 'ruler') return
    publishDrawingToolCommand({
      action: 'updateSelectedPriceLabel',
      showPriceLabel: enabled,
      tool: selectedKey,
    })
  }

  function setSelectedLineStyle(value: SettingsLineSwatchValue) {
    setLineStyles((current) => ({ ...current, [selectedTool.key]: value }))
    writeDrawingLineStyle(selectedTool.key, value)
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler') return
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
    setSelectedDrawing((current) => current?.tool === selectedKey
      ? { ...current, textStyle: normalized }
      : current)
    if (selectedKey !== 'horizontalLine' && selectedKey !== 'trendLine' && selectedKey !== 'ruler') return
    publishDrawingToolCommand({
      action: 'updateSelectedTextStyle',
      textStyle: normalized,
      tool: selectedKey,
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

  function setSelectedRulerStyle(value: DrawingRulerStyle) {
    const normalized = normalizeDrawingRulerStyle(value)
    setRulerStyle(normalized)
    writeDrawingRulerStyle(normalized)
    publishDrawingToolCommand({
      action: 'updateSelectedRulerStyle',
      rulerStyle: normalized,
      tool: 'ruler',
    })
  }

  function setQuickMeasure(nextEnabled: boolean) {
    setQuickMeasureEnabled(nextEnabled)
    writeQuickMeasureEnabled(nextEnabled)
    publishDrawingToolCommand({
      action: 'updateQuickMeasureEnabled',
      enabled: nextEnabled,
      tool: 'ruler',
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
    if (selectedKey !== 'trendLine' && selectedKey !== 'ruler' && selectedKey !== 'fibRetracement') return
    setSelectedDrawing((current) => current?.tool === selectedKey
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
      tool: selectedKey,
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
          <DrawingToolHeader objectId={selectedObjectId} toolLabel={selectedTool.label} />

          {selectedKey === 'cursor' ? (
            <CursorToolPanel cursorMode={cursorMode} onCursorModeChange={setCursor} />
          ) : (
            <>
              <DrawingToolActionControls
                armed={armedKey === selectedKey}
                locked={selectedLocked}
                onArm={armSelectedTool}
                onDelete={deleteSelectedDrawing}
                onRelease={releaseSelectedTool}
                onToggleLock={toggleSelectedLock}
                persistenceControls={selectedKey === 'horizontalLine' || selectedKey === 'trendLine' || selectedKey === 'ruler' || selectedKey === 'fibRetracement' ? (
                  <DrawingToolPersistenceControls
                    onSave={() => setPersistence(true)}
                    onUnsave={() => setPersistence(false)}
                    persisted={selectedPersisted}
                    toolLabel={selectedTool.label}
                  />
                ) : undefined}
                selected={selectedDrawing?.tool === selectedKey}
                toolLabel={selectedTool.label}
              />
              <div className="ff-drawing-hline-settings-v1">
                <DrawingToolTabs
                  activeKey={visibleTab}
                  ariaLabel={`${selectedTool.label} settings`}
                  onChange={(tab) => setActiveTab(tab as DrawingTab)}
                  tabs={tabs.map((tab) => ({ key: tab, label: tabLabels[tab] }))}
                  renderPanel={(tab) => (
                    <DrawingTabPanel
                      lineStyle={selectedLineStyle}
                      onLineStyleChange={setSelectedLineStyle}
                      onPriceLabelChange={setSelectedPriceLabel}
                      onRulerStyleChange={setSelectedRulerStyle}
                      onTextStyleChange={setSelectedTextStyle}
                      onTrendLineStyleChange={setSelectedTrendLineStyle}
                      priceLabelVisible={selectedPriceLabel}
                      rulerStyle={rulerStyle}
                      selectedDrawing={selectedDrawing}
                      onPriceChange={setSelectedPrice}
                      onQuickMeasureChange={setQuickMeasure}
                      onTrendPointPriceChange={setSelectedTrendPointPrice}
                      tab={tab as DrawingTab}
                      textStyle={selectedTextStyle}
                      trendLineStyle={trendLineStyle}
                      tool={selectedTool}
                      quickMeasureEnabled={quickMeasureEnabled}
                    />
                  )}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
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
  onQuickMeasureChange,
  onRulerStyleChange,
  onTextStyleChange,
  onTrendPointPriceChange,
  onTrendLineStyleChange,
  priceLabelVisible,
  quickMeasureEnabled,
  rulerStyle,
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
  onQuickMeasureChange: (enabled: boolean) => void
  onRulerStyleChange: (value: DrawingRulerStyle) => void
  onTextStyleChange: (value: DrawingTextStyle) => void
  onTrendPointPriceChange: (pointIndex: number, price: number) => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  priceLabelVisible: boolean
  quickMeasureEnabled: boolean
  rulerStyle: DrawingRulerStyle
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
        onQuickMeasureChange={onQuickMeasureChange}
        onRulerStyleChange={onRulerStyleChange}
        onTrendLineStyleChange={onTrendLineStyleChange}
        priceLabelVisible={priceLabelVisible}
        quickMeasureEnabled={quickMeasureEnabled}
        rulerStyle={rulerStyle}
        trendLineStyle={trendLineStyle}
        tool={tool}
      />
    )
  }
  if (tab === 'text') return <DrawingTextPanel alignmentVisible={tool.key !== 'ruler'} onTextStyleChange={onTextStyleChange} textStyle={textStyle} />
  return <DrawingCoordsPanel onPriceChange={onPriceChange} onTrendPointPriceChange={onTrendPointPriceChange} selectedDrawing={selectedDrawing} tool={tool} />
}

function DrawingStylePanel({
  lineStyle,
  onLineStyleChange,
  onPriceLabelChange,
  onQuickMeasureChange,
  onRulerStyleChange,
  onTrendLineStyleChange,
  priceLabelVisible,
  quickMeasureEnabled,
  rulerStyle,
  trendLineStyle,
  tool,
}: {
  lineStyle: SettingsLineSwatchValue
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  onQuickMeasureChange: (enabled: boolean) => void
  onRulerStyleChange: (value: DrawingRulerStyle) => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  priceLabelVisible: boolean
  quickMeasureEnabled: boolean
  rulerStyle: DrawingRulerStyle
  trendLineStyle: DrawingTrendLineStyle
  tool: DrawingTool
}) {
  const updateTrendLineStyle = (patch: Partial<DrawingTrendLineStyle>) => {
    onTrendLineStyleChange(normalizeDrawingTrendLineStyle({ ...trendLineStyle, ...patch }))
  }

  if (tool.key === 'ruler') {
    return (
      <RulerStylePanel
        lineStyle={lineStyle}
        onLineStyleChange={onLineStyleChange}
        onPriceLabelChange={onPriceLabelChange}
        onQuickMeasureChange={onQuickMeasureChange}
        onRulerStyleChange={onRulerStyleChange}
        priceLabelVisible={priceLabelVisible}
        quickMeasureEnabled={quickMeasureEnabled}
        rulerStyle={rulerStyle}
      />
    )
  }

  if (tool.key === 'fibRetracement') {
    return (
      <div className="ff-drawing-tline-tv-style-v1">
        <FibRetracementStylePanel />
      </div>
    )
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
      ) : null}
    </div>
  )
}

const fibLevelDefaults = [
  { color: '#787b86', enabled: true, value: '0' },
  { color: '#f23645', enabled: true, value: '0.236' },
  { color: '#81c784', enabled: true, value: '0.382' },
  { color: '#4caf50', enabled: true, value: '0.5' },
  { color: '#009688', enabled: true, value: '0.618' },
  { color: '#64b5f6', enabled: true, value: '0.786' },
  { color: '#787b86', enabled: true, value: '1' },
  { color: '#90caf9', enabled: false, value: '1.618' },
]

function FibRetracementStylePanel() {
  const [levels, setLevels] = useState(fibLevelDefaults)
  const [trendLineVisible, setTrendLineVisible] = useState(false)
  const [trendLineStyle, setTrendLineStyle] = useState<SettingsLineSwatchValue>({
    hex: '#b6bac4',
    lineStyle: 'dashed',
    opacity: 1,
    thickness: 1,
  })
  const [backgroundEnabled, setBackgroundEnabled] = useState(true)
  const [background, setBackground] = useState({ hex: '#2962ff', opacity: 0.25 })
  const [reverse, setReverse] = useState(false)
  const [priceVisible, setPriceVisible] = useState(true)
  const [levelVisible, setLevelVisible] = useState(true)
  const [textVisible, setTextVisible] = useState(true)
  const [horizontalLineThickness, setHorizontalLineThickness] = useState(1)
  const [horizontalLineThicknessOpen, setHorizontalLineThicknessOpen] = useState(false)
  const [horizontalLineStyle, setHorizontalLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid')
  const [horizontalLineStyleOpen, setHorizontalLineStyleOpen] = useState(false)
  const [extendLeft, setExtendLeft] = useState(false)
  const [extendRight, setExtendRight] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const horizontalLineThicknessRef = useRef<HTMLDivElement | null>(null)
  const horizontalLineStyleRef = useRef<HTMLDivElement | null>(null)
  const extendRef = useRef<HTMLDivElement | null>(null)
  const [levelDisplay, setLevelDisplay] = useState('value')
  const [labelAlign, setLabelAlign] = useState('center')
  const [labelVAlign, setLabelVAlign] = useState('top')
  const [textAlign, setTextAlign] = useState('center')
  const [textVAlign, setTextVAlign] = useState('middle')
  const [fontSize, setFontSize] = useState('12')

  const updateLevel = (index: number, patch: Partial<typeof fibLevelDefaults[number]>) => {
    setLevels((current) => current.map((level, levelIndex) => levelIndex === index ? { ...level, ...patch } : level))
  }

  useEffect(() => {
    if (!horizontalLineThicknessOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (horizontalLineThicknessRef.current?.contains(event.target as Node)) return
      setHorizontalLineThicknessOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHorizontalLineThicknessOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [horizontalLineThicknessOpen])

  useEffect(() => {
    if (!horizontalLineStyleOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (horizontalLineStyleRef.current?.contains(event.target as Node)) return
      setHorizontalLineStyleOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHorizontalLineStyleOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [horizontalLineStyleOpen])

  useEffect(() => {
    if (!extendOpen) return
    const closeOnOutside = (event: MouseEvent) => {
      if (extendRef.current?.contains(event.target as Node)) return
      setExtendOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExtendOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside, true)
    document.addEventListener('keydown', closeOnEscape, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnEscape, true)
    }
  }, [extendOpen])

  const extendLabel = extendLeft && extendRight
    ? '双向'
    : extendLeft
      ? '向左'
      : extendRight
        ? '向右'
        : '不要扩大'

  return (
    <div className="ff-drawing-fib-style-v1">
      <div className="ff-drawing-fib-top-row-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={trendLineVisible} onChange={(event) => setTrendLineVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">趋势线</span>
        <SettingsLineSwatch
          color={trendLineStyle.hex}
          lineStyle={trendLineStyle.lineStyle}
          onChange={setTrendLineStyle}
          thickness={trendLineStyle.thickness}
          value={trendLineStyle}
        />
      </div>

      <div className="ff-drawing-fib-top-row-v1 ff-drawing-fib-top-row-v1--horizontal">
        <span className="ff-drawing-tline-tv-label-v1">水平线</span>
        <div className="ff-drawing-fib-horizontal-controls-v1">
          <div className="ff-drawing-fib-line-width-picker-v1" ref={horizontalLineThicknessRef}>
            <button
              aria-expanded={horizontalLineThicknessOpen}
              aria-label="水平线粗细"
              className="ff-drawing-fib-line-preview-v1"
              data-open={horizontalLineThicknessOpen ? 'true' : undefined}
              onClick={() => setHorizontalLineThicknessOpen((current) => !current)}
              style={{ '--ff-drawing-fib-line-size': `${horizontalLineThickness}px` } as CSSProperties}
              type="button"
            >
              <span />
            </button>
            {horizontalLineThicknessOpen ? (
              <div className="ff-drawing-fib-line-width-menu-v1">
                {[1, 2, 3, 4].map((size) => (
                  <button
                    className="ff-drawing-fib-line-width-option-v1"
                    data-active={horizontalLineThickness === size ? 'true' : undefined}
                    key={size}
                    onClick={() => {
                      setHorizontalLineThickness(size)
                      setHorizontalLineThicknessOpen(false)
                    }}
                    style={{ '--ff-drawing-fib-line-size': `${size}px` } as CSSProperties}
                    type="button"
                  >
                    <span />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="ff-drawing-fib-line-style-picker-v1" ref={horizontalLineStyleRef}>
            <button
              aria-expanded={horizontalLineStyleOpen}
              aria-label="水平线线型"
              className="ff-drawing-fib-line-end-v1"
              data-open={horizontalLineStyleOpen ? 'true' : undefined}
              data-line-style={horizontalLineStyle}
              onClick={() => setHorizontalLineStyleOpen((current) => !current)}
              type="button"
            >
              <span />
            </button>
            {horizontalLineStyleOpen ? (
              <div className="ff-drawing-fib-line-style-menu-v1">
                {[
                  { label: '线形图', value: 'solid' as const },
                  { label: '短虚线', value: 'dashed' as const },
                  { label: '点虚线', value: 'dotted' as const },
                ].map((option) => (
                  <button
                    className="ff-drawing-fib-line-style-option-v1"
                    data-active={horizontalLineStyle === option.value ? 'true' : undefined}
                    data-line-style={option.value}
                    key={option.value}
                    onClick={() => {
                      setHorizontalLineStyle(option.value)
                      setHorizontalLineStyleOpen(false)
                    }}
                    type="button"
                  >
                    <span className="ff-drawing-fib-line-style-option-v1__line" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ff-drawing-fib-extend-row-v1">
        <span className="ff-drawing-tline-tv-label-v1">延伸</span>
        <div className="ff-drawing-fib-extend-picker-v1" data-open={extendOpen ? 'true' : undefined} ref={extendRef}>
          <button
            aria-expanded={extendOpen}
            aria-label="延伸"
            className="ff-drawing-fib-extend-button-v1 ff-openable-control"
            onClick={() => setExtendOpen((current) => !current)}
            type="button"
          >
            <span>{extendLabel}</span>
            <span aria-hidden="true" className="ff-drawing-fib-extend-chevron-v1">{'\u2304'}</span>
          </button>
          {extendOpen ? (
            <div className="ff-drawing-fib-extend-menu-v1">
              <button className="ff-drawing-fib-extend-option-v1" onClick={() => setExtendLeft((current) => !current)} type="button">
                <span className="ff-drawing-fib-extend-box-v1" data-checked={extendLeft ? 'true' : undefined} />
                <span>左侧延长线</span>
              </button>
              <button className="ff-drawing-fib-extend-option-v1" onClick={() => setExtendRight((current) => !current)} type="button">
                <span className="ff-drawing-fib-extend-box-v1" data-checked={extendRight ? 'true' : undefined} />
                <span>右侧延长线</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="ff-drawing-fib-levels-v1">
        {levels.map((level, index) => (
          <div className="ff-drawing-fib-level-row-v1" key={index}>
            <label className="ff-drawing-tline-tv-check-row-v1">
              <input checked={level.enabled} onChange={(event) => updateLevel(index, { enabled: event.target.checked })} type="checkbox" />
              <span className="ff-drawing-tline-tv-check-box-v1" />
            </label>
            <input
              className="ff-drawing-fib-level-input-v1"
              onChange={(event) => updateLevel(index, { value: event.target.value })}
              type="number"
              value={level.value}
            />
            <SettingsColorSwatch
              color={level.color}
              onChange={(value) => updateLevel(index, { color: value.hex })}
              value={{ hex: level.color, opacity: 1 }}
            />
          </div>
        ))}
      </div>

      <div className="ff-drawing-fib-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={backgroundEnabled} onChange={(event) => setBackgroundEnabled(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">背景</span>
        <div className="ff-drawing-fib-opacity-control-v1">
          <input
            aria-label="背景透明度"
            max={100}
            min={0}
            onChange={(event) => setBackground((current) => ({ ...current, opacity: Number(event.target.value) / 100 }))}
            type="range"
            value={Math.round(background.opacity * 100)}
          />
          <span>{`${Math.round(background.opacity * 100)}%`}</span>
        </div>
      </div>

      <div className="ff-drawing-fib-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={reverse} onChange={(event) => setReverse(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">反手</span>
      </div>

      <div className="ff-drawing-fib-check-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={priceVisible} onChange={(event) => setPriceVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">价格</span>
      </div>

      <div className="ff-drawing-fib-select-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={levelVisible} onChange={(event) => setLevelVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">水平位</span>
        <OpenableSelect ariaLabel="水平位" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setLevelDisplay} options={[{ label: '数值', value: 'value' }, { label: '百分比', value: 'percent' }]} value={levelDisplay} />
      </div>

      <div className="ff-drawing-fib-select-line-v1 ff-drawing-fib-select-line-v1--plain-label">
        <span className="ff-drawing-fib-empty-check-v1" />
        <span className="ff-drawing-tline-tv-label-v1">标签</span>
        <OpenableSelect ariaLabel="标签位置" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setLabelAlign} options={[{ label: '左侧', value: 'left' }, { label: '中心', value: 'center' }, { label: '右侧', value: 'right' }]} value={labelAlign} />
        <OpenableSelect ariaLabel="标签垂直位置" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setLabelVAlign} options={[{ label: '顶部', value: 'top' }, { label: '中间', value: 'middle' }, { label: '底部', value: 'bottom' }]} value={labelVAlign} />
      </div>

      <div className="ff-drawing-fib-select-line-v1">
        <label className="ff-drawing-tline-tv-check-row-v1">
          <input checked={textVisible} onChange={(event) => setTextVisible(event.target.checked)} type="checkbox" />
          <span className="ff-drawing-tline-tv-check-box-v1" />
        </label>
        <span className="ff-drawing-tline-tv-label-v1">文本</span>
        <OpenableSelect ariaLabel="文本位置" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setTextAlign} options={[{ label: '左侧', value: 'left' }, { label: '中心', value: 'center' }, { label: '右侧', value: 'right' }]} value={textAlign} />
        <OpenableSelect ariaLabel="文本垂直位置" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setTextVAlign} options={[{ label: '顶部', value: 'top' }, { label: '中间', value: 'middle' }, { label: '底部', value: 'bottom' }]} value={textVAlign} />
      </div>

      <div className="ff-drawing-fib-select-line-v1 ff-drawing-fib-select-line-v1--plain-label">
        <span className="ff-drawing-fib-empty-check-v1" />
        <span className="ff-drawing-tline-tv-label-v1">字体大小</span>
        <OpenableSelect ariaLabel="字体大小" className="ff-drawing-tline-tv-openable-select-v1 ff-drawing-fib-small-select-v1" onChange={setFontSize} options={[{ label: '10', value: '10' }, { label: '12', value: '12' }, { label: '14', value: '14' }, { label: '16', value: '16' }, { label: '18', value: '18' }, { label: '20', value: '20' }]} value={fontSize} />
      </div>
    </div>
  )
}

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
      <TwoPointPriceCoordsPanel
        locked={selectedDrawing?.tool === 'trendLine' && selectedDrawing.locked}
        lockedMessage={'\u5f53\u524d\u9009\u4e2d\u7684\u8d8b\u52bf\u7ebf\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}
        notSelectedMessage={'\u672a\u9009\u4e2d\u8d8b\u52bf\u7ebf\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u6761\u8d8b\u52bf\u7ebf\u3002'}
        onPointPriceChange={onTrendPointPriceChange}
        pointPrices={selectedDrawing?.tool === 'trendLine' ? selectedDrawing.trendPointPrices : undefined}
        selected={selectedDrawing?.tool === 'trendLine'}
      />
    )
  }
  if (tool.key === 'ruler' || tool.key === 'fibRetracement') {
    const isFib = tool.key === 'fibRetracement'
    return (
      <TwoPointPriceCoordsPanel
        locked={selectedDrawing?.tool === tool.key && selectedDrawing.locked}
        lockedMessage={isFib ? '当前选中的斐波那契回撤已锁定，无法修改坐标。请先解锁。' : '当前选中的标尺已锁定，无法修改坐标。请先解锁。'}
        notSelectedMessage={isFib ? '未选中斐波那契回撤：请先在图上选中一个斐波那契回撤。' : '未选中标尺：请先在图上选中一个标尺。'}
        onPointPriceChange={onTrendPointPriceChange}
        pointPrices={selectedDrawing?.tool === tool.key ? selectedDrawing.trendPointPrices : undefined}
        selected={selectedDrawing?.tool === tool.key}
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
  return (
    <DrawingPriceCoordsPanel
      coordinates={[{
        id: 'ff-drawing-hline-coords-price-v1',
        label: '#1\uff08\u4ef7\u683c\uff09',
        onChange: onPriceChange,
        price,
      }]}
      locked={locked}
      lockedMessage={'\u5f53\u524d\u9009\u4e2d\u7684\u6c34\u5e73\u7ebf\u5df2\u9501\u5b9a\uff0c\u65e0\u6cd5\u4fee\u6539\u5750\u6807\u3002\u8bf7\u5148\u89e3\u9501\u3002'}
      notSelectedMessage={'\u672a\u9009\u4e2d\u6c34\u5e73\u7ebf\uff1a\u8bf7\u5148\u5728\u56fe\u4e0a\u9009\u4e2d\u4e00\u6761\u6c34\u5e73\u7ebf\uff0c\u518d\u5728\u6b64\u4fee\u6539\u4ef7\u683c\u5750\u6807\u3002'}
      selected={selected}
    />
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

function TwoPointPriceCoordsPanel({
  locked,
  lockedMessage,
  notSelectedMessage,
  onPointPriceChange,
  pointPrices,
  selected,
}: {
  locked: boolean
  lockedMessage: string
  notSelectedMessage: string
  onPointPriceChange: (pointIndex: number, price: number) => void
  pointPrices?: [number | undefined, number | undefined]
  selected: boolean
}) {
  return (
    <DrawingPriceCoordsPanel
      coordinates={[
        {
          id: 'ff-drawing-tline-price-1-v1',
          label: '#1\uff08\u4ef7\u683c\uff09',
          onChange: (price) => onPointPriceChange(0, price),
          price: pointPrices?.[0],
        },
        {
          id: 'ff-drawing-tline-price-2-v1',
          label: '#2\uff08\u4ef7\u683c\uff09',
          onChange: (price) => onPointPriceChange(1, price),
          price: pointPrices?.[1],
        },
      ]}
      locked={locked}
      lockedMessage={lockedMessage}
      notSelectedMessage={notSelectedMessage}
      selected={selected}
    />
  )
}

