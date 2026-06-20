import { createDrawingToolSettingsProps } from './createDrawingToolSettingsProps'
import type { SelectedDrawingState } from './drawingTypes'
import type { useDrawingToolAuxiliaryState } from './useDrawingToolAuxiliaryState'
import type { useDrawingToolCommandActions } from './useDrawingToolCommandActions'
import type { useDrawingToolStateController } from './useDrawingToolStateController'

export function useDrawingToolSettingsPropsController({
  armedKey,
  auxiliary,
  commandActions,
  selectedDrawing,
  state,
  storagePeriod,
}: {
  armedKey: ReturnType<typeof useDrawingToolStateController>['selectedKey'] | null
  auxiliary: ReturnType<typeof useDrawingToolAuxiliaryState>
  commandActions: ReturnType<typeof useDrawingToolCommandActions>
  selectedDrawing: SelectedDrawingState | null
  state: ReturnType<typeof useDrawingToolStateController>
  storagePeriod: string
}) {
  return createDrawingToolSettingsProps({
    actions: {
      onActiveTabChange: state.setActiveTab,
      onArm: commandActions.armSelectedTool,
      onCrossPeriodChange: auxiliary.setSelectedCrossPeriod,
      onCrossPeriodTargetsChange: auxiliary.setSelectedCrossPeriodTargets,
      onCursorModeChange: state.setCursor,
      onDelete: commandActions.deleteSelectedDrawing,
      onFibRetracementStyleChange: state.setSelectedFibRetracementStyle,
      onFibTrendLineChange: state.setSelectedFibTrendLine,
      onLineStyleChange: commandActions.setSelectedLineStyle,
      onPersistenceChange: commandActions.setPersistence,
      onPriceChange: commandActions.setSelectedPrice,
      onPriceLabelChange: commandActions.setSelectedPriceLabel,
      onQuickMeasureChange: commandActions.setQuickMeasure,
      onRelease: commandActions.releaseSelectedTool,
      onRulerStyleChange: commandActions.setSelectedRulerStyle,
      onStickerColorChange: auxiliary.setSelectedStickerColor,
      onStickerIconCategoryChange: auxiliary.setSelectedStickerIconCategory,
      onStickerSizeChange: auxiliary.setSelectedStickerSize,
      onStickerSymbolSelect: auxiliary.setSelectedStickerSymbol,
      onTextStyleChange: commandActions.setSelectedTextStyle,
      onToggleLock: commandActions.toggleSelectedLock,
      onTrendLineStyleChange: commandActions.setSelectedTrendLineStyle,
      onTrendPointPriceChange: commandActions.setSelectedTrendPointPrice,
    },
    base: {
      armedKey,
      cursorMode: state.cursorMode,
      quickMeasureEnabled: state.quickMeasureEnabled,
      storagePeriod,
      tabs: state.tabs,
      trendLineStyle: state.trendLineStyle,
    },
    crossPeriod: {
      selectedCrossPeriod: auxiliary.selectedCrossPeriod,
      selectedCrossPeriodTargets: auxiliary.selectedCrossPeriodTargets,
    },
    fib: {
      fibBackgroundOpacity: state.selectedFibBackgroundOpacity,
      fibBackgroundVisible: state.selectedFibBackgroundVisible,
      fibHorizontalLineStyle: state.selectedFibHorizontalLineStyle,
      fibLabelAlign: state.selectedFibLabelAlign,
      fibLabelFontSize: state.selectedFibLabelFontSize,
      fibLabelVAlign: state.selectedFibLabelVAlign,
      fibLevelDisplay: state.selectedFibLevelDisplay,
      fibLevelVisible: state.selectedFibLevelVisible,
      fibLevels: state.selectedFibLevels,
      fibPriceVisible: state.selectedFibPriceVisible,
      fibQuarterLineStyles: state.selectedFibQuarterLineStyles,
      fibQuarterSplitVisible: state.selectedFibQuarterSplitVisible,
      fibReverse: state.selectedFibReverse,
      fibTrendLineStyle: state.selectedFibTrendLineStyle,
      fibTrendLineVisible: state.selectedFibTrendLineVisible,
    },
    selected: {
      lineStyle: state.selectedLineStyle,
      priceLabelVisible: state.selectedPriceLabel,
      rulerStyle: state.selectedRulerStyle,
      selected: selectedDrawing?.tool === state.selectedKey,
      selectedDrawing,
      selectedKey: state.selectedKey,
      selectedLocked: state.selectedLocked,
      selectedPersisted: state.selectedPersisted,
      selectedTool: state.selectedTool,
      textStyle: state.selectedTextStyle,
      visibleTab: state.visibleTab,
    },
    sticker: {
      activeIconCategory: auxiliary.selectedStickerIconCategory,
      selectedStickerColor: auxiliary.stickerColor,
      selectedStickerSize: auxiliary.stickerSize,
      selectedStickerSymbol: auxiliary.selectedEmoji,
    },
  })
}
