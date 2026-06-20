import { normalizeDrawingTextStyle, type DrawingTextStyle } from '../drawingPersistence'
import type { DrawingToolState } from '../drawingToolCommands'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { ObjectTreeDrawingItem } from '../objectTree/objectTreeTypes'
import type { DrawingToolKey, SelectedDrawingState } from './drawingTypes'

export function drawingToolKeyFromObjectTreeItem(item: ObjectTreeDrawingItem): DrawingToolKey {
  if (item.kind === 'trendLine') return 'trendLine'
  if (item.kind === 'ruler') return 'ruler'
  if (item.kind === 'fibRetracement') return 'fibRetracement'
  if (item.kind === 'emojiSticker') return 'emojiSticker'
  return 'horizontalLine'
}

export function createSelectedDrawingFromToolState(
  current: SelectedDrawingState | null,
  state: DrawingToolState,
): SelectedDrawingState | null {
  if (!state.selected) {
    return current?.tool === state.tool ? null : current
  }
  return {
    crossPeriod: state.crossPeriod,
    crossPeriodTargets: state.crossPeriodTargets,
    fibBackgroundOpacity: state.fibBackgroundOpacity,
    fibBackgroundVisible: state.fibBackgroundVisible,
    fibHorizontalLineStyle: state.fibHorizontalLineStyle,
    fibLabelAlign: state.fibLabelAlign,
    fibLabelFontSize: state.fibLabelFontSize,
    fibLabelVAlign: state.fibLabelVAlign,
    fibLevelDisplay: state.fibLevelDisplay,
    fibLevelVisible: state.fibLevelVisible,
    fibLevels: state.fibLevels as FibLevelState[] | undefined,
    fibPriceVisible: state.fibPriceVisible,
    fibQuarterLineStyles: state.fibQuarterLineStyles,
    fibQuarterSplitVisible: state.fibQuarterSplitVisible,
    fibReverse: state.fibReverse,
    fibTrendLineStyle: state.fibTrendLineStyle,
    fibTrendLineVisible: state.fibTrendLineVisible,
    lineStyle: state.lineStyle,
    locked: state.locked,
    objectId: state.objectId,
    price: state.price,
    rulerStyle: state.rulerStyle,
    showPriceLabel: state.showPriceLabel,
    sourcePeriod: state.sourcePeriod,
    stickerColor: state.stickerColor,
    stickerSize: state.stickerSize,
    stickerSymbol: state.stickerSymbol,
    textStyle: state.textStyle,
    tool: state.tool,
    trendPointPrices: state.trendPointPrices,
  }
}

export function createEmojiStickerTextStylesFromToolState(
  current: Record<string, DrawingTextStyle>,
  state: DrawingToolState,
): Record<string, DrawingTextStyle> {
  const incomingTextStyle = normalizeDrawingTextStyle(state.textStyle)
  return {
    ...current,
    emojiSticker: normalizeDrawingTextStyle({
      ...current.emojiSticker,
      bold: typeof state.stickerBold === 'boolean' ? state.stickerBold : current.emojiSticker?.bold,
      body: incomingTextStyle.body,
      fontFamily: typeof state.stickerFontFamily === 'string' ? state.stickerFontFamily : current.emojiSticker?.fontFamily,
      fontSize: typeof state.stickerSize === 'number' ? state.stickerSize : current.emojiSticker?.fontSize,
      italic: typeof state.stickerItalic === 'boolean' ? state.stickerItalic : current.emojiSticker?.italic,
      textColor: typeof state.stickerColor === 'string' ? state.stickerColor : current.emojiSticker?.textColor,
    }),
  }
}

export function createSelectedDrawingFromObjectTreeItem(
  current: SelectedDrawingState | null,
  item: ObjectTreeDrawingItem,
  tool: DrawingToolKey,
): SelectedDrawingState {
  if (current?.objectId === item.id) {
    return {
      ...current,
      locked: item.locked,
      objectId: item.id,
      tool,
    }
  }
  return {
    crossPeriod: current?.crossPeriod,
    crossPeriodTargets: current?.crossPeriodTargets,
    locked: item.locked,
    objectId: item.id,
    showPriceLabel: true,
    sourcePeriod: current?.sourcePeriod,
    tool,
  }
}
