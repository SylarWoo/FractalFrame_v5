import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useState } from 'react'
import { readChartCursorMode, writeChartCursorMode, type ChartCursorMode } from '../../chart/chartCursorMode'
import { readString, writeString } from '../../persistence/jsonStorage'
import type { DrawingSelection, DrawingTab, DrawingTool, DrawingToolKey } from './drawingTypes'
import {
  drawingSelectedToolStorageKey,
  readDrawingSelectedTool,
  writeDrawingSelectedTool,
} from '../drawingPersistence'
import { publishDrawingToolCommand } from '../drawingToolCommands'
import { publishObjectTreeDrawingCommand } from '../objectTree/objectTreeModel'

type CursorMode = ChartCursorMode

function normalizeToolKey(value: string, drawingTools: readonly DrawingTool[]): DrawingToolKey {
  return drawingTools.some((tool) => tool.key === value) ? value as DrawingToolKey : 'horizontalLine'
}

function readInitialSelectedTool(period: string, drawingTools: readonly DrawingTool[]) {
  return normalizeToolKey(readDrawingSelectedTool(period) ?? readString(drawingSelectedToolStorageKey, 'horizontalLine'), drawingTools)
}

export function useDrawingToolSelection<TSelection extends DrawingSelection>({
  drawingTools,
  setSelectedDrawing,
  storagePeriod,
}: {
  drawingTools: readonly DrawingTool[]
  setSelectedDrawing: Dispatch<SetStateAction<TSelection | null>>
  storagePeriod: string
}) {
  const [selectedKey, setSelectedKey] = useState<DrawingToolKey>(() => readInitialSelectedTool(storagePeriod, drawingTools))
  const [activeTab, setActiveTab] = useState<DrawingTab>('style')
  const [cursorMode, setCursorMode] = useState<CursorMode>(readChartCursorMode)

  function selectTool(key: DrawingToolKey) {
    if (selectedKey !== key) {
      publishObjectTreeDrawingCommand({ action: 'deselectAll' })
      setSelectedDrawing(null)
    }
    setSelectedKey(key)
    writeDrawingSelectedTool(key, storagePeriod)
    writeString(drawingSelectedToolStorageKey, key)
    if (!drawingTools.find((tool) => tool.key === key)?.tabs?.includes(activeTab)) setActiveTab('style')
  }

  function setCursor(next: CursorMode) {
    setCursorMode(next)
    writeChartCursorMode(next)
  }

  return {
    activeTab,
    cursorMode,
    selectedKey,
    selectTool,
    setActiveTab,
    setCursor,
    setSelectedKey,
  }
}

export function useDrawingToolSelectionEffects({
  quickMeasureEnabled,
  selectedKey,
  visibleTab,
}: {
  quickMeasureEnabled: boolean
  selectedKey: DrawingToolKey
  visibleTab: DrawingTab
}) {
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
  }, [quickMeasureEnabled])
}
