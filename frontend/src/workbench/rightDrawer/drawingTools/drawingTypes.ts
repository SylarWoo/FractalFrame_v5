import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingTextStyle } from '../drawingPersistence'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'

export type DrawingToolKey = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'morganRange' | 'emojiSticker' | 'cursor'

export type DrawingTab = 'style' | 'text' | 'coords'

export type DrawingTool = {
  key: DrawingToolKey
  label: string
  tabs?: DrawingTab[]
}

export type SelectedDrawingState = {
  crossPeriod?: boolean
  crossPeriodTargets?: string[]
  fibBackgroundOpacity?: number
  fibBackgroundVisible?: boolean
  fibHorizontalLineStyle?: SettingsLineSwatchValue
  fibLabelAlign?: string
  fibLabelFontSize?: string
  fibLabelVAlign?: string
  fibLevelDisplay?: string
  fibLevelVisible?: boolean
  fibLevels?: FibLevelState[]
  fibPriceVisible?: boolean
  fibQuarterLineStyles?: SettingsLineSwatchValue[]
  fibQuarterSplitVisible?: boolean
  fibReverse?: boolean
  fibTrendLineStyle?: SettingsLineSwatchValue
  fibTrendLineVisible?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked: boolean
  objectId?: string
  price?: number
  rulerStyle?: DrawingRulerStyle
  showPriceLabel: boolean
  sourcePeriod?: string
  stickerColor?: string
  stickerSize?: number
  stickerSymbol?: string
  textStyle?: DrawingTextStyle
  tool: DrawingToolKey
  trendPointPrices?: [number | undefined, number | undefined]
}

export type DrawingSelection = {
  tool: DrawingToolKey
}
