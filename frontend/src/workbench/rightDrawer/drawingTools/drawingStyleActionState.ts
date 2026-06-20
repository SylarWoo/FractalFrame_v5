import type { DrawingTextStyle } from '../drawingPersistence'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'

type LineStyleCommandTool = 'horizontalLine' | 'trendLine' | 'ruler'
type TextStyleCommandTool = LineStyleCommandTool
type PriceLabelCommandTool = LineStyleCommandTool | 'fibRetracement'

export function applySelectedDrawingPatch(
  current: SelectedDrawingState | null,
  tool: DrawingToolKey,
  patch: Partial<SelectedDrawingState>,
): SelectedDrawingState | null {
  return current?.tool === tool ? { ...current, ...patch } : current
}

export function isLineStyleCommandTool(tool: DrawingToolKey): tool is LineStyleCommandTool {
  return tool === 'horizontalLine' || tool === 'trendLine' || tool === 'ruler'
}

export function isTextStyleCommandTool(tool: DrawingToolKey): tool is TextStyleCommandTool {
  return isLineStyleCommandTool(tool)
}

function isPriceLabelCommandTool(tool: DrawingToolKey): tool is PriceLabelCommandTool {
  return isLineStyleCommandTool(tool) || tool === 'fibRetracement'
}

export function shouldPublishPriceLabelCommand(
  tool: DrawingToolKey,
  selectedDrawing: SelectedDrawingState | null,
): tool is PriceLabelCommandTool {
  if (!isPriceLabelCommandTool(tool)) return false
  return selectedDrawing?.tool === tool || tool === 'trendLine' || tool === 'ruler'
}

export function createStickerStyleUpdateFromTextStyle(
  textStyle: DrawingTextStyle,
  selectedEmoji: string,
) {
  return {
    bold: textStyle.bold,
    color: textStyle.textColor,
    fontFamily: textStyle.fontFamily,
    italic: textStyle.italic,
    size: textStyle.fontSize,
    symbol: textStyle.body.trim() ? textStyle.body : selectedEmoji,
    textStyle,
  }
}
