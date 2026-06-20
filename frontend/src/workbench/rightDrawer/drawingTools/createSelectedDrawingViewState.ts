import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import {
  createDefaultDrawingLineStyle,
  createDefaultDrawingTextStyle,
  normalizeDrawingTextStyle,
  type DrawingTextStyle,
} from '../drawingPersistence'
import { normalizeFibQuarterLineStyles, type FibLevelState } from '../FibRetracementStylePanel'
import { shortObjectTreeId } from '../objectTree/objectTreeVisibility'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import type { DrawingTab, DrawingTool, DrawingToolKey, SelectedDrawingState } from './drawingTypes'

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

export function createSelectedDrawingViewState({
  activeTab,
  drawingTools,
  fibBackgroundOpacity,
  fibBackgroundVisible,
  fibHorizontalLineStyle,
  fibLabelAlign,
  fibLabelFontSize,
  fibLabelVAlign,
  fibLevelDisplay,
  fibLevelVisible,
  fibLevels,
  fibPriceVisible,
  fibQuarterLineStyles,
  fibQuarterSplitVisible,
  fibReverse,
  fibTrendLineStyle,
  fibTrendLineVisible,
  lineStyles,
  lockedTools,
  persistedTools,
  priceLabelTools,
  rulerStyle,
  selectedDrawing,
  selectedKey,
  textStyles,
}: {
  activeTab: DrawingTab
  drawingTools: readonly DrawingTool[]
  fibBackgroundOpacity: number
  fibBackgroundVisible: boolean
  fibHorizontalLineStyle: SettingsLineSwatchValue
  fibLabelAlign: string
  fibLabelFontSize: string
  fibLabelVAlign: string
  fibLevelDisplay: string
  fibLevelVisible: boolean
  fibLevels: FibLevelState[]
  fibPriceVisible: boolean
  fibQuarterLineStyles: SettingsLineSwatchValue[]
  fibQuarterSplitVisible: boolean
  fibReverse: boolean
  fibTrendLineStyle: SettingsLineSwatchValue
  fibTrendLineVisible: boolean
  lineStyles: Record<string, SettingsLineSwatchValue>
  lockedTools: Record<string, boolean>
  persistedTools: Record<string, boolean>
  priceLabelTools: Record<string, boolean>
  rulerStyle: DrawingRulerStyle
  selectedDrawing: SelectedDrawingState | null
  selectedKey: DrawingToolKey
  textStyles: Record<string, DrawingTextStyle>
}) {
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
  const selectedTextStyle = normalizeDrawingTextStyle(selectedKey === 'emojiSticker'
    ? textStyles.emojiSticker
    : (selectedKey === 'horizontalLine' || selectedKey === 'trendLine') && !selectedDrawingHasObject
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
  const selectedFibTrendLineVisible = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibTrendLineVisible === 'boolean'
    ? selectedDrawing.fibTrendLineVisible
    : fibTrendLineVisible
  const selectedFibTrendLineStyle = selectedDrawing?.tool === 'fibRetracement' && selectedDrawing.fibTrendLineStyle
    ? selectedDrawing.fibTrendLineStyle
    : fibTrendLineStyle
  const selectedFibLevels = selectedDrawing?.tool === 'fibRetracement' && selectedDrawing.fibLevels
    ? selectedDrawing.fibLevels
    : fibLevels
  const selectedFibHorizontalLineStyle = selectedDrawing?.tool === 'fibRetracement' && selectedDrawing.fibHorizontalLineStyle
    ? selectedDrawing.fibHorizontalLineStyle
    : fibHorizontalLineStyle
  const selectedFibBackgroundVisible = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibBackgroundVisible === 'boolean'
    ? selectedDrawing.fibBackgroundVisible
    : fibBackgroundVisible
  const selectedFibBackgroundOpacity = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibBackgroundOpacity === 'number'
    ? selectedDrawing.fibBackgroundOpacity
    : fibBackgroundOpacity
  const selectedFibReverse = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibReverse === 'boolean'
    ? selectedDrawing.fibReverse
    : fibReverse
  const selectedFibPriceVisible = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibPriceVisible === 'boolean'
    ? selectedDrawing.fibPriceVisible
    : fibPriceVisible
  const selectedFibLabelAlign = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibLabelAlign === 'string'
    ? selectedDrawing.fibLabelAlign
    : fibLabelAlign
  const selectedFibLabelVAlign = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibLabelVAlign === 'string'
    ? selectedDrawing.fibLabelVAlign
    : fibLabelVAlign
  const selectedFibLabelFontSize = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibLabelFontSize === 'string'
    ? selectedDrawing.fibLabelFontSize
    : fibLabelFontSize
  const selectedFibLevelVisible = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibLevelVisible === 'boolean'
    ? selectedDrawing.fibLevelVisible
    : fibLevelVisible
  const selectedFibLevelDisplay = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibLevelDisplay === 'string'
    ? selectedDrawing.fibLevelDisplay
    : fibLevelDisplay
  const selectedFibQuarterSplitVisible = selectedDrawing?.tool === 'fibRetracement' && typeof selectedDrawing.fibQuarterSplitVisible === 'boolean'
    ? selectedDrawing.fibQuarterSplitVisible
    : fibQuarterSplitVisible
  const selectedFibQuarterLineStyles = normalizeFibQuarterLineStyles(selectedDrawing?.tool === 'fibRetracement' && Array.isArray(selectedDrawing.fibQuarterLineStyles)
    ? selectedDrawing.fibQuarterLineStyles
    : fibQuarterLineStyles)
  const selectedRulerStyle = selectedDrawing?.tool === 'ruler' && selectedDrawing.rulerStyle
    ? selectedDrawing.rulerStyle
    : rulerStyle

  return {
    selectedFibBackgroundOpacity,
    selectedFibBackgroundVisible,
    selectedFibHorizontalLineStyle,
    selectedFibLabelAlign,
    selectedFibLabelFontSize,
    selectedFibLabelVAlign,
    selectedFibLevelDisplay,
    selectedFibLevelVisible,
    selectedFibLevels,
    selectedFibPriceVisible,
    selectedFibQuarterLineStyles,
    selectedFibQuarterSplitVisible,
    selectedFibReverse,
    selectedFibTrendLineStyle,
    selectedFibTrendLineVisible,
    selectedLineStyle,
    selectedLocked,
    selectedObjectId,
    selectedPersisted,
    selectedPriceLabel,
    selectedRulerStyle,
    selectedTextStyle,
    selectedTool,
    tabs,
    visibleTab,
  }
}
