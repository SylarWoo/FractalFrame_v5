import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingTextStyle } from '../drawingPersistence'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import { createSelectedDrawingViewState } from './createSelectedDrawingViewState'
import type { DrawingTab, DrawingTool, DrawingToolKey, SelectedDrawingState } from './drawingTypes'

export function useDrawingSelectedState({
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
  return createSelectedDrawingViewState({
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
  })
}
