import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import {
  createDefaultDrawingLineStyle,
  normalizeDrawingTextStyle,
  type DrawingTextStyle,
  type DrawingTrendLineStyle,
} from '../drawingPersistence'
import type { DrawingToolCommand } from '../drawingToolCommands'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import type { DrawingToolKey } from './drawingTypes'

type DrawingToolStartCommand = Omit<DrawingToolCommand, 'id'> & { action: 'start' }

export function createDrawingToolStartCommand({
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
  rulerStyle,
  selectedCrossPeriod,
  selectedCrossPeriodTargets,
  selectedEmoji,
  selectedKey,
  selectedLocked,
  selectedPriceLabel,
  selectedTextStyle,
  stickerColor,
  stickerSize,
  textStyles,
  trendLineStyle,
}: {
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
  rulerStyle: DrawingRulerStyle
  selectedCrossPeriod: boolean
  selectedCrossPeriodTargets: DrawingCrossPeriodTarget[]
  selectedEmoji: string
  selectedKey: DrawingToolKey
  selectedLocked: boolean
  selectedPriceLabel: boolean
  selectedTextStyle: DrawingTextStyle
  stickerColor: string
  stickerSize: number
  textStyles: Record<string, DrawingTextStyle>
  trendLineStyle: DrawingTrendLineStyle
}): DrawingToolStartCommand | null {
  if (selectedKey === 'trendLine') {
    return {
      action: 'start',
      crossPeriod: selectedCrossPeriod,
      crossPeriodTargets: selectedCrossPeriodTargets,
      lineStyle: lineStyles.trendLine ?? createDefaultDrawingLineStyle('#2962ff'),
      locked: selectedLocked,
      showPriceLabel: selectedPriceLabel,
      textStyle: selectedTextStyle,
      tool: 'trendLine',
      trendLineStyle,
    }
  }
  if (selectedKey === 'ruler') {
    return {
      action: 'start',
      lineStyle: lineStyles.ruler ?? createDefaultDrawingLineStyle('#2962ff'),
      locked: selectedLocked,
      rulerStyle,
      showPriceLabel: selectedPriceLabel,
      textStyle: selectedTextStyle,
      tool: 'ruler',
    }
  }
  if (selectedKey === 'fibRetracement') {
    return {
      action: 'start',
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
      lineStyle: lineStyles.fibRetracement ?? createDefaultDrawingLineStyle('#787b86'),
      locked: selectedLocked,
      rulerStyle: {
        ...rulerStyle,
        statsAlwaysVisible: false,
        statsData: [],
      },
      showPriceLabel: selectedPriceLabel,
      tool: 'fibRetracement',
    }
  }
  if (selectedKey === 'morganRange') {
    return {
      action: 'start',
      tool: 'morganRange',
    }
  }
  if (selectedKey === 'emojiSticker') {
    const stickerText = normalizeDrawingTextStyle(textStyles.emojiSticker)
    const hasTextBody = Boolean(stickerText.body.trim())
    return {
      action: 'start',
      locked: selectedLocked,
      stickerBold: stickerText.bold,
      stickerColor: hasTextBody ? stickerText.textColor : stickerColor,
      stickerFontFamily: stickerText.fontFamily,
      stickerItalic: stickerText.italic,
      stickerSize: hasTextBody ? stickerText.fontSize : stickerSize,
      stickerSymbol: hasTextBody ? stickerText.body : selectedEmoji,
      textStyle: hasTextBody ? stickerText : { ...stickerText, body: '' },
      tool: 'emojiSticker',
    }
  }
  if (selectedKey === 'horizontalLine') {
    return {
      action: 'start',
      crossPeriod: selectedCrossPeriod,
      crossPeriodTargets: selectedCrossPeriodTargets,
      lineStyle: lineStyles.horizontalLine ?? createDefaultDrawingLineStyle('#0f766e'),
      locked: selectedLocked,
      showPriceLabel: selectedPriceLabel,
      textStyle: selectedTextStyle,
      tool: 'horizontalLine',
    }
  }
  return null
}
