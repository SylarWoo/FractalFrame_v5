import { readBooleanFlag, readJson, removeStorageItem, writeBooleanFlag, writeJson } from '../persistence/jsonStorage'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import type { DrawingTextStyle, DrawingTrendLineStyle } from './drawingPersistence'
import { normalizeDrawingLineStyle, normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from './drawingPersistence'
import type { DrawingRulerStyle } from './rulerDrawingStyle'
import { normalizeDrawingRulerStyle } from './rulerDrawingStyle'

export type PersistableDrawingToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement'

export type StoredHorizontalLineDrawing = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  manualVisible: boolean
  objectId: string
  paneId: string
  showPriceLabel: boolean
  textStyle: DrawingTextStyle
  value: number
}

export type StoredTrendLineDrawing = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  manualVisible: boolean
  objectId: string
  paneId: string
  points: Array<{
    dataIndex?: number
    timestamp?: number
    value?: number
  }>
  showPriceLabel: boolean
  textStyle: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
}

export type StoredRulerDrawing = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  manualVisible: boolean
  objectId: string
  paneId: string
  points: Array<{
    dataIndex?: number
    timestamp?: number
    value?: number
  }>
  rulerStyle: DrawingRulerStyle
  showPriceLabel: boolean
  textStyle: DrawingTextStyle
}

export const drawingObjectPersistenceStoragePrefix = 'fractalframe.drawingsDrawer.persist'
export const horizontalLineDrawingsStorageKey = 'fractalframe.drawings.horizontalLine.items'
export const trendLineDrawingsStorageKey = 'fractalframe.drawings.trendLine.items'
export const rulerDrawingsStorageKey = 'fractalframe.drawings.ruler.items'
export const fibRetracementDrawingsStorageKey = 'fractalframe.drawings.fibRetracement.items'

export function readDrawingObjectPersistence(tool: PersistableDrawingToolKey) {
  return readBooleanFlag(`${drawingObjectPersistenceStoragePrefix}.${tool}`, true)
}

export function writeDrawingObjectPersistence(tool: PersistableDrawingToolKey, enabled: boolean) {
  return writeBooleanFlag(`${drawingObjectPersistenceStoragePrefix}.${tool}`, enabled)
}

export function readStoredHorizontalLineDrawings() {
  const stored = readJson<StoredHorizontalLineDrawing[]>(horizontalLineDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#0f766e'),
      locked: drawing.locked === true,
      manualVisible: drawing.manualVisible !== false,
      objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
      paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
      showPriceLabel: drawing.showPriceLabel !== false,
      textStyle: normalizeDrawingTextStyle(drawing.textStyle),
      value: Number(drawing.value),
    }))
    .filter((drawing) => Number.isFinite(drawing.value))
}

export function writeStoredHorizontalLineDrawings(drawings: StoredHorizontalLineDrawing[]) {
  return writeJson(horizontalLineDrawingsStorageKey, drawings.map((drawing) => ({
    lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#0f766e'),
    locked: drawing.locked === true,
    manualVisible: drawing.manualVisible !== false,
    objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
    paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
    showPriceLabel: drawing.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(drawing.textStyle),
    value: drawing.value,
  })))
}

export function clearStoredHorizontalLineDrawings() {
  return removeStorageItem(horizontalLineDrawingsStorageKey)
}

function normalizeTrendLinePoint(point: StoredTrendLineDrawing['points'][number]) {
  const dataIndex = Number(point?.dataIndex)
  const timestamp = Number(point?.timestamp)
  const value = Number(point?.value)
  return {
    ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
    ...(Number.isFinite(value) ? { value } : {}),
  }
}

export function readStoredTrendLineDrawings() {
  const stored = readJson<StoredTrendLineDrawing[]>(trendLineDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#2962ff'),
      locked: drawing.locked === true,
      manualVisible: drawing.manualVisible !== false,
      objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
      paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
      points: Array.isArray(drawing.points) ? drawing.points.map(normalizeTrendLinePoint) : [],
      showPriceLabel: drawing.showPriceLabel !== false,
      textStyle: normalizeDrawingTextStyle(drawing.textStyle),
      trendLineStyle: normalizeDrawingTrendLineStyle(drawing.trendLineStyle),
    }))
    .filter((drawing) => drawing.points.length >= 2 && drawing.points.slice(0, 2).every((point) => typeof point.value === 'number'))
}

export function writeStoredTrendLineDrawings(drawings: StoredTrendLineDrawing[]) {
  return writeJson(trendLineDrawingsStorageKey, drawings.map((drawing) => ({
    lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#2962ff'),
    locked: drawing.locked === true,
    manualVisible: drawing.manualVisible !== false,
    objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
    paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
    points: drawing.points.slice(0, 2).map(normalizeTrendLinePoint),
    showPriceLabel: drawing.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(drawing.textStyle),
    trendLineStyle: normalizeDrawingTrendLineStyle(drawing.trendLineStyle),
  })))
}

export function clearStoredTrendLineDrawings() {
  return removeStorageItem(trendLineDrawingsStorageKey)
}

export function readStoredRulerDrawings() {
  const stored = readJson<StoredRulerDrawing[]>(rulerDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#2962ff'),
      locked: drawing.locked === true,
      manualVisible: drawing.manualVisible !== false,
      objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
      paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
      points: Array.isArray(drawing.points) ? drawing.points.map(normalizeTrendLinePoint) : [],
      rulerStyle: normalizeDrawingRulerStyle(drawing.rulerStyle),
      showPriceLabel: drawing.showPriceLabel !== false,
      textStyle: normalizeDrawingTextStyle(drawing.textStyle),
    }))
    .filter((drawing) => drawing.points.length >= 2 && drawing.points.slice(0, 2).every((point) => typeof point.value === 'number'))
}

export function writeStoredRulerDrawings(drawings: StoredRulerDrawing[]) {
  return writeJson(rulerDrawingsStorageKey, drawings.map((drawing) => ({
    lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#2962ff'),
    locked: drawing.locked === true,
    manualVisible: drawing.manualVisible !== false,
    objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
    paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
    points: drawing.points.slice(0, 2).map(normalizeTrendLinePoint),
    rulerStyle: normalizeDrawingRulerStyle(drawing.rulerStyle),
    showPriceLabel: drawing.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(drawing.textStyle),
  })))
}

export function clearStoredRulerDrawings() {
  return removeStorageItem(rulerDrawingsStorageKey)
}

export function readStoredFibRetracementDrawings() {
  const stored = readJson<StoredRulerDrawing[]>(fibRetracementDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#787b86'),
      locked: drawing.locked === true,
      manualVisible: drawing.manualVisible !== false,
      objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
      paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
      points: Array.isArray(drawing.points) ? drawing.points.map(normalizeTrendLinePoint) : [],
      rulerStyle: normalizeDrawingRulerStyle(drawing.rulerStyle),
      showPriceLabel: drawing.showPriceLabel !== false,
      textStyle: normalizeDrawingTextStyle(drawing.textStyle),
    }))
    .filter((drawing) => drawing.points.length >= 2 && drawing.points.slice(0, 2).every((point) => typeof point.value === 'number'))
}

export function writeStoredFibRetracementDrawings(drawings: StoredRulerDrawing[]) {
  return writeJson(fibRetracementDrawingsStorageKey, drawings.map((drawing) => ({
    lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#787b86'),
    locked: drawing.locked === true,
    manualVisible: drawing.manualVisible !== false,
    objectId: typeof drawing.objectId === 'string' && drawing.objectId.trim() ? drawing.objectId.trim() : '',
    paneId: typeof drawing.paneId === 'string' && drawing.paneId.trim() ? drawing.paneId.trim() : 'candle_pane',
    points: drawing.points.slice(0, 2).map(normalizeTrendLinePoint),
    rulerStyle: normalizeDrawingRulerStyle(drawing.rulerStyle),
    showPriceLabel: drawing.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(drawing.textStyle),
  })))
}

export function clearStoredFibRetracementDrawings() {
  return removeStorageItem(fibRetracementDrawingsStorageKey)
}
