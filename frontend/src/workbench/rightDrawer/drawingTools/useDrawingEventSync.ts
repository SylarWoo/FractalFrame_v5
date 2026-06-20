import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { writeString } from '../../persistence/jsonStorage'
import {
  drawingSelectedToolStorageKey,
  writeDrawingSelectedTool,
  type DrawingTextStyle,
} from '../drawingPersistence'
import { drawingToolStateEvent, isDrawingToolStateEvent } from '../drawingToolCommands'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'
import {
  objectTreeDrawingsChangedEvent,
  requestObjectTreeDrawings,
  type ObjectTreeDrawingsChangedDetail,
} from '../objectTree/objectTreeModel'
import {
  createEmojiStickerTextStylesFromToolState,
  createSelectedDrawingFromObjectTreeItem,
  createSelectedDrawingFromToolState,
  drawingToolKeyFromObjectTreeItem,
} from './drawingEventSyncState'

function writeSelectedTool(tool: DrawingToolKey, storagePeriod: string) {
  writeDrawingSelectedTool(tool, storagePeriod)
  writeString(drawingSelectedToolStorageKey, tool)
}

export function useDrawingEventSync({
  setArmedKey,
  setSelectedDrawing,
  setSelectedEmoji,
  setSelectedKey,
  setStickerColor,
  setStickerSize,
  setTextStyles,
  storagePeriod,
}: {
  setArmedKey: Dispatch<SetStateAction<DrawingToolKey | null>>
  setSelectedDrawing: Dispatch<SetStateAction<SelectedDrawingState | null>>
  setSelectedEmoji: Dispatch<SetStateAction<string>>
  setSelectedKey: Dispatch<SetStateAction<DrawingToolKey>>
  setStickerColor: Dispatch<SetStateAction<string>>
  setStickerSize: Dispatch<SetStateAction<number>>
  setTextStyles: Dispatch<SetStateAction<Record<string, DrawingTextStyle>>>
  storagePeriod: string
}) {
  useEffect(() => {
    const handleState = (event: Event) => {
      if (!isDrawingToolStateEvent(event)) return
      if (!event.detail.armed) setArmedKey((current) => current === event.detail.tool ? null : current)
      if (event.detail.selected) {
        setSelectedKey(event.detail.tool)
        writeSelectedTool(event.detail.tool, storagePeriod)
      }
      if (event.detail.tool === 'emojiSticker') {
        if (typeof event.detail.stickerSymbol === 'string') setSelectedEmoji(event.detail.stickerSymbol)
        if (typeof event.detail.stickerColor === 'string') setStickerColor(event.detail.stickerColor)
        if (typeof event.detail.stickerSize === 'number') setStickerSize(event.detail.stickerSize)
        setTextStyles((current) => createEmojiStickerTextStylesFromToolState(current, event.detail))
      }
      setSelectedDrawing((current) => createSelectedDrawingFromToolState(current, event.detail))
    }
    window.addEventListener(drawingToolStateEvent, handleState)
    return () => {
      window.removeEventListener(drawingToolStateEvent, handleState)
    }
  }, [setArmedKey, setSelectedDrawing, setSelectedEmoji, setSelectedKey, setStickerColor, setStickerSize, setTextStyles, storagePeriod])

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
      writeSelectedTool(tool, storagePeriod)
      setSelectedDrawing((current) => createSelectedDrawingFromObjectTreeItem(current, activeItem, tool))
    }

    window.addEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
    requestObjectTreeDrawings()
    return () => {
      window.removeEventListener(objectTreeDrawingsChangedEvent, handleDrawingsChanged)
    }
  }, [setSelectedDrawing, setSelectedKey, storagePeriod])
}
