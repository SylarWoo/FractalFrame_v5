import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import type { SettingsLineSwatchValue, SettingsSwatchValue } from '../../settings/SettingsSwatches'
import type { ChartCursorMode } from '../../chart/chartCursorMode'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../drawingPersistence'
import type { DrawingTab, DrawingTool, DrawingToolKey, SelectedDrawingState } from '../drawingTools/drawingTypes'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import type { StickerIconCategoryKey } from '../StickerStylePanel'
import { CursorToolSettingsPanel } from './CursorToolSettingsPanel'
import { EmojiStickerToolSettingsPanel } from './EmojiStickerToolSettingsPanel'
import { MorganRangeToolSettingsPanel } from './MorganRangeToolSettingsPanel'
import { StandardDrawingToolSettingsPanel } from './StandardDrawingToolSettingsPanel'

export type DrawingToolSettingsContentProps = {
  activeIconCategory: StickerIconCategoryKey
  armedKey: DrawingToolKey | null
  cursorMode: ChartCursorMode
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
  lineStyle: SettingsLineSwatchValue
  onActiveTabChange: (tab: DrawingTab) => void
  onArm: () => void
  onCrossPeriodChange: (enabled: boolean) => void
  onCrossPeriodTargetsChange: (targets: DrawingCrossPeriodTarget[]) => void
  onCursorModeChange: (mode: ChartCursorMode) => void
  onDelete: () => void
  onFibRetracementStyleChange: (levels: FibLevelState[], horizontalLineStyle: SettingsLineSwatchValue, backgroundVisible: boolean, backgroundOpacity: number, reverse: boolean, priceVisible: boolean, labelAlign: string, labelVAlign: string, labelFontSize: string, levelVisible: boolean, levelDisplay: string, quarterSplitVisible: boolean, quarterLineStyles: SettingsLineSwatchValue[]) => void
  onFibTrendLineChange: (visible: boolean, style?: SettingsLineSwatchValue) => void
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPersistenceChange: (enabled: boolean) => void
  onPriceChange: (price: number) => void
  onPriceLabelChange: (enabled: boolean) => void
  onQuickMeasureChange: (enabled: boolean) => void
  onRelease: () => void
  onRulerStyleChange: (value: DrawingRulerStyle) => void
  onStickerColorChange: (value: SettingsSwatchValue) => void
  onStickerIconCategoryChange: (category: StickerIconCategoryKey) => void
  onStickerSizeChange: (size: number) => void
  onStickerSymbolSelect: (symbol: string) => void
  onTextStyleChange: (value: DrawingTextStyle) => void
  onToggleLock: () => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  onTrendPointPriceChange: (pointIndex: number, price: number) => void
  priceLabelVisible: boolean
  quickMeasureEnabled: boolean
  rulerStyle: DrawingRulerStyle
  selected: boolean
  selectedCrossPeriod: boolean
  selectedCrossPeriodTargets: DrawingCrossPeriodTarget[]
  selectedDrawing: SelectedDrawingState | null
  selectedKey: DrawingToolKey
  selectedLocked: boolean
  selectedPersisted: boolean
  selectedStickerColor: string
  selectedStickerSize: number
  selectedStickerSymbol: string
  selectedTool: DrawingTool
  storagePeriod: string
  tabs: DrawingTab[]
  textStyle: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
  visibleTab: DrawingTab
}

export function DrawingToolSettingsContent({
  activeIconCategory,
  armedKey,
  cursorMode,
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
  lineStyle,
  onActiveTabChange,
  onArm,
  onCrossPeriodChange,
  onCrossPeriodTargetsChange,
  onCursorModeChange,
  onDelete,
  onFibRetracementStyleChange,
  onFibTrendLineChange,
  onLineStyleChange,
  onPersistenceChange,
  onPriceChange,
  onPriceLabelChange,
  onQuickMeasureChange,
  onRelease,
  onRulerStyleChange,
  onStickerColorChange,
  onStickerIconCategoryChange,
  onStickerSizeChange,
  onStickerSymbolSelect,
  onTextStyleChange,
  onToggleLock,
  onTrendLineStyleChange,
  onTrendPointPriceChange,
  priceLabelVisible,
  quickMeasureEnabled,
  rulerStyle,
  selected,
  selectedCrossPeriod,
  selectedCrossPeriodTargets,
  selectedDrawing,
  selectedKey,
  selectedLocked,
  selectedPersisted,
  selectedStickerColor,
  selectedStickerSize,
  selectedStickerSymbol,
  selectedTool,
  storagePeriod,
  tabs,
  textStyle,
  trendLineStyle,
  visibleTab,
}: DrawingToolSettingsContentProps) {
  if (selectedKey === 'cursor') {
    return <CursorToolSettingsPanel cursorMode={cursorMode} onCursorModeChange={onCursorModeChange} />
  }

  if (selectedKey === 'morganRange') {
    return <MorganRangeToolSettingsPanel armedKey={armedKey} onArm={onArm} onRelease={onRelease} selectedKey={selectedKey} selectedTool={selectedTool} />
  }

  if (selectedKey === 'emojiSticker') {
    return (
      <EmojiStickerToolSettingsPanel
        activeIconCategory={activeIconCategory}
        armedKey={armedKey}
        onActiveTabChange={onActiveTabChange}
        onArm={onArm}
        onDelete={onDelete}
        onPersistenceChange={onPersistenceChange}
        onRelease={onRelease}
        onStickerColorChange={onStickerColorChange}
        onStickerIconCategoryChange={onStickerIconCategoryChange}
        onStickerSizeChange={onStickerSizeChange}
        onStickerSymbolSelect={onStickerSymbolSelect}
        onTextStyleChange={onTextStyleChange}
        onToggleLock={onToggleLock}
        selected={selected}
        selectedKey={selectedKey}
        selectedLocked={selectedLocked}
        selectedPersisted={selectedPersisted}
        selectedStickerColor={selectedStickerColor}
        selectedStickerSize={selectedStickerSize}
        selectedStickerSymbol={selectedStickerSymbol}
        selectedTool={selectedTool}
        tabs={tabs}
        textStyle={textStyle}
        visibleTab={visibleTab}
      />
    )
  }

  return (
    <StandardDrawingToolSettingsPanel
      armedKey={armedKey}
      fibBackgroundOpacity={fibBackgroundOpacity}
      fibBackgroundVisible={fibBackgroundVisible}
      fibHorizontalLineStyle={fibHorizontalLineStyle}
      fibLabelAlign={fibLabelAlign}
      fibLabelFontSize={fibLabelFontSize}
      fibLabelVAlign={fibLabelVAlign}
      fibLevelDisplay={fibLevelDisplay}
      fibLevelVisible={fibLevelVisible}
      fibLevels={fibLevels}
      fibPriceVisible={fibPriceVisible}
      fibQuarterLineStyles={fibQuarterLineStyles}
      fibQuarterSplitVisible={fibQuarterSplitVisible}
      fibReverse={fibReverse}
      fibTrendLineStyle={fibTrendLineStyle}
      fibTrendLineVisible={fibTrendLineVisible}
      lineStyle={lineStyle}
      onActiveTabChange={onActiveTabChange}
      onArm={onArm}
      onCrossPeriodChange={onCrossPeriodChange}
      onCrossPeriodTargetsChange={onCrossPeriodTargetsChange}
      onDelete={onDelete}
      onFibRetracementStyleChange={onFibRetracementStyleChange}
      onFibTrendLineChange={onFibTrendLineChange}
      onLineStyleChange={onLineStyleChange}
      onPersistenceChange={onPersistenceChange}
      onPriceChange={onPriceChange}
      onPriceLabelChange={onPriceLabelChange}
      onQuickMeasureChange={onQuickMeasureChange}
      onRelease={onRelease}
      onRulerStyleChange={onRulerStyleChange}
      onTextStyleChange={onTextStyleChange}
      onToggleLock={onToggleLock}
      onTrendLineStyleChange={onTrendLineStyleChange}
      onTrendPointPriceChange={onTrendPointPriceChange}
      priceLabelVisible={priceLabelVisible}
      quickMeasureEnabled={quickMeasureEnabled}
      rulerStyle={rulerStyle}
      selected={selected}
      selectedCrossPeriod={selectedCrossPeriod}
      selectedCrossPeriodTargets={selectedCrossPeriodTargets}
      selectedDrawing={selectedDrawing}
      selectedKey={selectedKey}
      selectedLocked={selectedLocked}
      selectedPersisted={selectedPersisted}
      selectedTool={selectedTool}
      storagePeriod={storagePeriod}
      tabs={tabs}
      textStyle={textStyle}
      trendLineStyle={trendLineStyle}
      visibleTab={visibleTab}
    />
  )
}
