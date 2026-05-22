import { readBooleanFlag, readJson, writeBooleanFlag, writeJson, removeStorageItem } from '../persistence/jsonStorage'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'

export type DrawingToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'cursor'

export type DrawingTextStyle = {
  alignH: 'left' | 'center' | 'right'
  alignV: 'top' | 'middle' | 'bottom'
  body: string
  bold: boolean
  fontSize: number
  italic: boolean
  textColor: string
}

export type StoredHorizontalLineDrawing = {
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  showPriceLabel: boolean
  textStyle: DrawingTextStyle
  value: number
}

export const drawingPersistenceStoragePrefix = 'fractalframe.drawingsDrawer.persist'
export const drawingPriceLabelStoragePrefix = 'fractalframe.drawingsDrawer.priceLabel'
export const drawingLineStyleStoragePrefix = 'fractalframe.drawingsDrawer.lineStyle'
export const drawingTextStyleStoragePrefix = 'fractalframe.drawingsDrawer.textStyle'
export const horizontalLineDrawingsStorageKey = 'fractalframe.drawings.horizontalLine.items'

export function createDefaultDrawingLineStyle(color = '#2962ff'): SettingsLineSwatchValue {
  return {
    hex: color,
    lineStyle: 'solid',
    opacity: 1,
    thickness: 1,
  }
}

export function normalizeDrawingLineStyle(lineStyle: SettingsLineSwatchValue | undefined, fallbackColor = '#2962ff'): SettingsLineSwatchValue {
  return {
    hex: typeof lineStyle?.hex === 'string' ? lineStyle.hex : fallbackColor,
    lineStyle: lineStyle?.lineStyle === 'dashed' || lineStyle?.lineStyle === 'dotted' ? lineStyle.lineStyle : 'solid',
    opacity: typeof lineStyle?.opacity === 'number' && Number.isFinite(lineStyle.opacity) ? Math.max(0, Math.min(lineStyle.opacity, 1)) : 1,
    thickness: typeof lineStyle?.thickness === 'number' && Number.isFinite(lineStyle.thickness) ? Math.max(1, Math.min(Math.round(lineStyle.thickness), 4)) : 1,
  }
}

export function createDefaultDrawingTextStyle(): DrawingTextStyle {
  return {
    alignH: 'right',
    alignV: 'top',
    body: '',
    bold: false,
    fontSize: 14,
    italic: false,
    textColor: '#131722',
  }
}

function normalizeTextBody(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (trimmed.includes('\\u6dfb\\u52a0\\u6587\\u5b57')) return ''
  if (/\\u[\da-f]{4}/i.test(trimmed)) return ''
  return value
}

export function normalizeDrawingTextStyle(textStyle: Partial<DrawingTextStyle> | null | undefined): DrawingTextStyle {
  const fallback = createDefaultDrawingTextStyle()
  const fontSize = Number(textStyle?.fontSize)
  const alignH = textStyle?.alignH === 'left' || textStyle?.alignH === 'center' || textStyle?.alignH === 'right'
    ? textStyle.alignH
    : fallback.alignH
  const alignV = textStyle?.alignV === 'top' || textStyle?.alignV === 'middle' || textStyle?.alignV === 'bottom'
    ? textStyle.alignV
    : fallback.alignV
  return {
    alignH,
    alignV,
    body: normalizeTextBody(textStyle?.body),
    bold: textStyle?.bold === true,
    fontSize: Number.isFinite(fontSize) ? Math.max(8, Math.min(48, Math.round(fontSize))) : fallback.fontSize,
    italic: textStyle?.italic === true,
    textColor: typeof textStyle?.textColor === 'string' && textStyle.textColor.trim() ? textStyle.textColor.trim() : fallback.textColor,
  }
}

export function readDrawingPersistence(tool: DrawingToolKey) {
  return readBooleanFlag(`${drawingPersistenceStoragePrefix}.${tool}`, true)
}

export function writeDrawingPersistence(tool: DrawingToolKey, enabled: boolean) {
  return writeBooleanFlag(`${drawingPersistenceStoragePrefix}.${tool}`, enabled)
}

export function readDrawingPriceLabel(tool: DrawingToolKey) {
  return readBooleanFlag(`${drawingPriceLabelStoragePrefix}.${tool}`, true)
}

export function writeDrawingPriceLabel(tool: DrawingToolKey, enabled: boolean) {
  return writeBooleanFlag(`${drawingPriceLabelStoragePrefix}.${tool}`, enabled)
}

export function readDrawingLineStyle(tool: DrawingToolKey, fallback: SettingsLineSwatchValue) {
  return normalizeDrawingLineStyle(readJson<SettingsLineSwatchValue | null>(`${drawingLineStyleStoragePrefix}.${tool}`, null) ?? fallback, fallback.hex)
}

export function writeDrawingLineStyle(tool: DrawingToolKey, value: SettingsLineSwatchValue) {
  return writeJson(`${drawingLineStyleStoragePrefix}.${tool}`, normalizeDrawingLineStyle(value))
}

export function readDrawingTextStyle(tool: DrawingToolKey) {
  return normalizeDrawingTextStyle(readJson<Partial<DrawingTextStyle> | null>(`${drawingTextStyleStoragePrefix}.${tool}`, null))
}

export function writeDrawingTextStyle(tool: DrawingToolKey, value: DrawingTextStyle) {
  return writeJson(`${drawingTextStyleStoragePrefix}.${tool}`, normalizeDrawingTextStyle(value))
}

export function readStoredHorizontalLineDrawings() {
  const stored = readJson<StoredHorizontalLineDrawing[]>(horizontalLineDrawingsStorageKey, [])
  return stored
    .map((drawing) => ({
      lineStyle: normalizeDrawingLineStyle(drawing.lineStyle, '#0f766e'),
      locked: drawing.locked === true,
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
    showPriceLabel: drawing.showPriceLabel !== false,
    textStyle: normalizeDrawingTextStyle(drawing.textStyle),
    value: drawing.value,
  })))
}

export function clearStoredHorizontalLineDrawings() {
  return removeStorageItem(horizontalLineDrawingsStorageKey)
}
