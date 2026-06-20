import type { DrawingToolSettingsContentProps } from '../drawings'

export type DrawingToolSettingsBaseProps = Pick<
  DrawingToolSettingsContentProps,
  'armedKey' | 'cursorMode' | 'quickMeasureEnabled' | 'storagePeriod' | 'tabs' | 'trendLineStyle'
>

export type DrawingToolSettingsFibProps = Pick<
  DrawingToolSettingsContentProps,
  | 'fibBackgroundOpacity'
  | 'fibBackgroundVisible'
  | 'fibHorizontalLineStyle'
  | 'fibLabelAlign'
  | 'fibLabelFontSize'
  | 'fibLabelVAlign'
  | 'fibLevelDisplay'
  | 'fibLevelVisible'
  | 'fibLevels'
  | 'fibPriceVisible'
  | 'fibQuarterLineStyles'
  | 'fibQuarterSplitVisible'
  | 'fibReverse'
  | 'fibTrendLineStyle'
  | 'fibTrendLineVisible'
>

export type DrawingToolSettingsSelectedProps = Pick<
  DrawingToolSettingsContentProps,
  | 'lineStyle'
  | 'priceLabelVisible'
  | 'rulerStyle'
  | 'selected'
  | 'selectedDrawing'
  | 'selectedKey'
  | 'selectedLocked'
  | 'selectedPersisted'
  | 'selectedTool'
  | 'textStyle'
  | 'visibleTab'
>

export type DrawingToolSettingsStickerProps = Pick<
  DrawingToolSettingsContentProps,
  | 'activeIconCategory'
  | 'selectedStickerColor'
  | 'selectedStickerSize'
  | 'selectedStickerSymbol'
>

export type DrawingToolSettingsCrossPeriodProps = Pick<
  DrawingToolSettingsContentProps,
  'selectedCrossPeriod' | 'selectedCrossPeriodTargets'
>

export type DrawingToolSettingsActionProps = Pick<
  DrawingToolSettingsContentProps,
  | 'onActiveTabChange'
  | 'onArm'
  | 'onCrossPeriodChange'
  | 'onCrossPeriodTargetsChange'
  | 'onCursorModeChange'
  | 'onDelete'
  | 'onFibRetracementStyleChange'
  | 'onFibTrendLineChange'
  | 'onLineStyleChange'
  | 'onPersistenceChange'
  | 'onPriceChange'
  | 'onPriceLabelChange'
  | 'onQuickMeasureChange'
  | 'onRelease'
  | 'onRulerStyleChange'
  | 'onStickerColorChange'
  | 'onStickerIconCategoryChange'
  | 'onStickerSizeChange'
  | 'onStickerSymbolSelect'
  | 'onTextStyleChange'
  | 'onToggleLock'
  | 'onTrendLineStyleChange'
  | 'onTrendPointPriceChange'
>

export function createDrawingToolSettingsProps({
  actions,
  base,
  crossPeriod,
  fib,
  selected,
  sticker,
}: {
  actions: DrawingToolSettingsActionProps
  base: DrawingToolSettingsBaseProps
  crossPeriod: DrawingToolSettingsCrossPeriodProps
  fib: DrawingToolSettingsFibProps
  selected: DrawingToolSettingsSelectedProps
  sticker: DrawingToolSettingsStickerProps
}): DrawingToolSettingsContentProps {
  return {
    ...base,
    ...fib,
    ...selected,
    ...sticker,
    ...crossPeriod,
    ...actions,
  }
}
