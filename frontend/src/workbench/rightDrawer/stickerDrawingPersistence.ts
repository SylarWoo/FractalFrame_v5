import { readJson, removeStorageItem, writeJson } from '../persistence/jsonStorage'
import type { DrawingTextStyle } from './drawingPersistence'
import { normalizeDrawingTextStyle } from './drawingPersistence'

export type StoredEmojiStickerDrawing = {
  bold: boolean
  color: string
  fontFamily: string
  italic: boolean
  locked: boolean
  manualVisible: boolean
  objectId: string
  paneId: string
  point: {
    dataIndex?: number
    timestamp?: number
    value?: number
  }
  size: number
  symbol: string
  textStyle: DrawingTextStyle
}

export const emojiStickerDrawingsStorageKey = 'fractalframe.drawings.emojiSticker.items'

function normalizeStickerSize(value: unknown) {
  const size = Number(value)
  return Number.isFinite(size) ? Math.max(12, Math.min(Math.round(size), 96)) : 28
}

function normalizeStickerPoint(point: StoredEmojiStickerDrawing['point']) {
  const dataIndex = Number(point?.dataIndex)
  const timestamp = Number(point?.timestamp)
  const value = Number(point?.value)
  return {
    ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
    ...(Number.isFinite(value) ? { value } : {}),
  }
}

export function readStoredEmojiStickerDrawings() {
  const stored = readJson<StoredEmojiStickerDrawing[]>(emojiStickerDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      bold: drawing.bold === true,
      color: typeof drawing.color === 'string' && drawing.color.trim() ? drawing.color.trim() : '#111827',
      fontFamily: typeof drawing.fontFamily === 'string' && drawing.fontFamily.trim() ? drawing.fontFamily.trim() : 'Arial',
      italic: drawing.italic === true,
      locked: drawing.locked === true,
      manualVisible: drawing.manualVisible !== false,
      objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
      paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
      point: normalizeStickerPoint(drawing.point),
      size: normalizeStickerSize(drawing.size),
      symbol: typeof drawing.symbol === 'string' && drawing.symbol ? drawing.symbol : '\u25c6',
      textStyle: normalizeDrawingTextStyle(drawing.textStyle),
    }))
    .filter((drawing) => typeof drawing.point.value === 'number')
}

export function writeStoredEmojiStickerDrawings(drawings: StoredEmojiStickerDrawing[]) {
  return writeJson(emojiStickerDrawingsStorageKey, drawings.map((drawing) => ({
    bold: drawing.bold === true,
    color: typeof drawing.color === 'string' && drawing.color.trim() ? drawing.color.trim() : '#111827',
    fontFamily: typeof drawing.fontFamily === 'string' && drawing.fontFamily.trim() ? drawing.fontFamily.trim() : 'Arial',
    italic: drawing.italic === true,
    locked: drawing.locked === true,
    manualVisible: drawing.manualVisible !== false,
    objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
    paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
    point: normalizeStickerPoint(drawing.point),
    size: normalizeStickerSize(drawing.size),
    symbol: typeof drawing.symbol === 'string' && drawing.symbol ? drawing.symbol : '\u25c6',
    textStyle: normalizeDrawingTextStyle(drawing.textStyle),
  })))
}

export function clearStoredEmojiStickerDrawings() {
  return removeStorageItem(emojiStickerDrawingsStorageKey)
}
