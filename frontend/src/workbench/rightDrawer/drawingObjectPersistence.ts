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

export type StoredFibRetracementDrawing = {
  fibBackgroundOpacity: number
  fibBackgroundVisible: boolean
  fibHorizontalLineStyle: SettingsLineSwatchValue
  fibLabelAlign: string
  fibLabelFontSize: string
  fibLabelVAlign: string
  fibLevelDisplay: string
  fibLevelVisible: boolean
  fibLevels: Array<{ color?: string; enabled?: boolean; opacity?: number; value?: string }>
  fibPriceVisible: boolean
  fibQuarterLineStyles: SettingsLineSwatchValue[]
  fibQuarterSplitVisible: boolean
  fibReverse: boolean
  fibTrendLineStyle: SettingsLineSwatchValue
  fibTrendLineVisible: boolean
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

function normalizeFibTrendLineStyle(lineStyle: SettingsLineSwatchValue | undefined) {
  return normalizeDrawingLineStyle(lineStyle ?? {
    hex: '#b6bac4',
    lineStyle: 'dashed',
    opacity: 1,
    thickness: 1,
  }, '#b6bac4')
}

function normalizeUnitOpacity(value: unknown, fallback: number) {
  const opacity = Number(value)
  return Number.isFinite(opacity) ? Math.max(0, Math.min(opacity, 1)) : fallback
}

function normalizeFibLabelAlign(value: unknown) {
  return value === 'left' || value === 'right' ? value : 'center'
}

function normalizeFibLabelVAlign(value: unknown) {
  return value === 'middle' || value === 'bottom' ? value : 'top'
}

function normalizeFibLabelFontSize(value: unknown) {
  const normalized = String(value)
  return ['10', '12', '14', '16', '18', '20'].includes(normalized) ? normalized : '12'
}

function normalizeFibLevelDisplay(value: unknown) {
  return value === 'percent' ? 'percent' : 'value'
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
  const stored = readJson<StoredFibRetracementDrawing[]>(fibRetracementDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      fibTrendLineStyle: normalizeFibTrendLineStyle(drawing.fibTrendLineStyle),
      fibTrendLineVisible: drawing.fibTrendLineVisible === true,
      fibBackgroundOpacity: normalizeUnitOpacity(drawing.fibBackgroundOpacity, 0.25),
      fibBackgroundVisible: drawing.fibBackgroundVisible !== false,
      fibHorizontalLineStyle: normalizeDrawingLineStyle(drawing.fibHorizontalLineStyle, '#787b86'),
      fibLabelAlign: normalizeFibLabelAlign(drawing.fibLabelAlign),
      fibLabelFontSize: normalizeFibLabelFontSize(drawing.fibLabelFontSize),
      fibLabelVAlign: normalizeFibLabelVAlign(drawing.fibLabelVAlign),
      fibLevelDisplay: normalizeFibLevelDisplay(drawing.fibLevelDisplay),
      fibLevelVisible: drawing.fibLevelVisible !== false,
      fibLevels: Array.isArray(drawing.fibLevels) ? drawing.fibLevels : [],
      fibPriceVisible: drawing.fibPriceVisible !== false,
      fibQuarterLineStyles: Array.isArray(drawing.fibQuarterLineStyles) ? drawing.fibQuarterLineStyles.map((style) => normalizeDrawingLineStyle(style, '#787b86')).slice(0, 3) : [],
      fibQuarterSplitVisible: drawing.fibQuarterSplitVisible === true,
      fibReverse: drawing.fibReverse === true,
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

export function writeStoredFibRetracementDrawings(drawings: StoredFibRetracementDrawing[]) {
  return writeJson(fibRetracementDrawingsStorageKey, drawings.map((drawing) => ({
    fibTrendLineStyle: normalizeFibTrendLineStyle(drawing.fibTrendLineStyle),
    fibTrendLineVisible: drawing.fibTrendLineVisible === true,
    fibBackgroundOpacity: normalizeUnitOpacity(drawing.fibBackgroundOpacity, 0.25),
    fibBackgroundVisible: drawing.fibBackgroundVisible !== false,
    fibHorizontalLineStyle: normalizeDrawingLineStyle(drawing.fibHorizontalLineStyle, '#787b86'),
    fibLabelAlign: normalizeFibLabelAlign(drawing.fibLabelAlign),
    fibLabelFontSize: normalizeFibLabelFontSize(drawing.fibLabelFontSize),
    fibLabelVAlign: normalizeFibLabelVAlign(drawing.fibLabelVAlign),
    fibLevelDisplay: normalizeFibLevelDisplay(drawing.fibLevelDisplay),
    fibLevelVisible: drawing.fibLevelVisible !== false,
    fibLevels: Array.isArray(drawing.fibLevels) ? drawing.fibLevels : [],
    fibPriceVisible: drawing.fibPriceVisible !== false,
    fibQuarterLineStyles: Array.isArray(drawing.fibQuarterLineStyles) ? drawing.fibQuarterLineStyles.map((style) => normalizeDrawingLineStyle(style, '#787b86')).slice(0, 3) : [],
    fibQuarterSplitVisible: drawing.fibQuarterSplitVisible === true,
    fibReverse: drawing.fibReverse === true,
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
