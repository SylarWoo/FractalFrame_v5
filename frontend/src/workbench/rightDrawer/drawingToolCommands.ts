import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import type { DrawingTextStyle, DrawingTrendLineStyle } from './drawingPersistence'
import type { DrawingRulerStyle } from './rulerDrawingStyle'

export type DrawingCommandTool = 'horizontalLine' | 'trendLine' | 'ruler' | 'fibRetracement' | 'morganRange' | 'emojiSticker'

export type DrawingToolCommand = {
  action: 'deleteSelected' | 'release' | 'refreshSelectedState' | 'start' | 'toggleSelectedLock' | 'updatePersistence' | 'updateQuickMeasureEnabled' | 'updateSelectedFibRetracementStyle' | 'updateSelectedFibTrendLine' | 'updateSelectedLineStyle' | 'updateSelectedPrice' | 'updateSelectedPriceLabel' | 'updateSelectedRulerStyle' | 'updateSelectedStickerStyle' | 'updateSelectedTextStyle' | 'updateSelectedTrendLinePointPrice' | 'updateSelectedTrendLineStyle'
  enabled?: boolean
  fibBackgroundOpacity?: number
  fibBackgroundVisible?: boolean
  fibHorizontalLineStyle?: SettingsLineSwatchValue
  fibLabelAlign?: string
  fibLabelFontSize?: string
  fibLabelVAlign?: string
  fibLevelDisplay?: string
  fibLevelVisible?: boolean
  fibLevels?: Array<{ color?: string; enabled?: boolean; opacity?: number; value?: string }>
  fibPriceVisible?: boolean
  fibQuarterLineStyles?: SettingsLineSwatchValue[]
  fibQuarterSplitVisible?: boolean
  fibReverse?: boolean
  fibTrendLineStyle?: SettingsLineSwatchValue
  fibTrendLineVisible?: boolean
  id: number
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  persisted?: boolean
  price?: number
  pointIndex?: number
  rulerStyle?: DrawingRulerStyle
  showPriceLabel?: boolean
  stickerColor?: string
  stickerSize?: number
  stickerSymbol?: string
  textStyle?: DrawingTextStyle
  tool: DrawingCommandTool
  trendLineStyle?: DrawingTrendLineStyle
}

export type DrawingToolState = {
  armed: boolean
  fibBackgroundOpacity?: number
  fibBackgroundVisible?: boolean
  fibHorizontalLineStyle?: SettingsLineSwatchValue
  fibLabelAlign?: string
  fibLabelFontSize?: string
  fibLabelVAlign?: string
  fibLevelDisplay?: string
  fibLevelVisible?: boolean
  fibLevels?: Array<{ color?: string; enabled?: boolean; opacity?: number; value?: string }>
  fibPriceVisible?: boolean
  fibQuarterLineStyles?: SettingsLineSwatchValue[]
  fibQuarterSplitVisible?: boolean
  fibReverse?: boolean
  fibTrendLineStyle?: SettingsLineSwatchValue
  fibTrendLineVisible?: boolean
  locked: boolean
  lineStyle?: SettingsLineSwatchValue
  objectId?: string
  price?: number
  selected: boolean
  showPriceLabel: boolean
  stickerColor?: string
  stickerSize?: number
  stickerSymbol?: string
  textStyle?: DrawingTextStyle
  tool: DrawingCommandTool
  trendPointPrices?: [number | undefined, number | undefined]
  trendLineStyle?: DrawingTrendLineStyle
  rulerStyle?: DrawingRulerStyle
}

export const drawingToolCommandEvent = 'fractalframe:drawing-tool-command'
export const drawingToolStateEvent = 'fractalframe:drawing-tool-state'

export function publishDrawingToolCommand(command: Omit<DrawingToolCommand, 'id'>) {
  window.dispatchEvent(new CustomEvent<DrawingToolCommand>(drawingToolCommandEvent, {
    detail: {
      ...command,
      id: Date.now(),
    },
  }))
}

export function isDrawingToolCommandEvent(event: Event): event is CustomEvent<DrawingToolCommand> {
  return event instanceof CustomEvent
    && event.type === drawingToolCommandEvent
    && (event.detail?.tool === 'horizontalLine' || event.detail?.tool === 'trendLine' || event.detail?.tool === 'ruler' || event.detail?.tool === 'fibRetracement' || event.detail?.tool === 'morganRange' || event.detail?.tool === 'emojiSticker')
}

export function publishDrawingToolState(state: DrawingToolState) {
  window.dispatchEvent(new CustomEvent<DrawingToolState>(drawingToolStateEvent, { detail: state }))
}

export function isDrawingToolStateEvent(event: Event): event is CustomEvent<DrawingToolState> {
  return event instanceof CustomEvent
    && event.type === drawingToolStateEvent
    && (event.detail?.tool === 'horizontalLine' || event.detail?.tool === 'trendLine' || event.detail?.tool === 'ruler' || event.detail?.tool === 'fibRetracement' || event.detail?.tool === 'morganRange' || event.detail?.tool === 'emojiSticker')
}
