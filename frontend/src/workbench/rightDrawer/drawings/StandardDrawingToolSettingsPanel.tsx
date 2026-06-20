import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../drawingPersistence'
import type { DrawingTab, DrawingTool, DrawingToolKey, SelectedDrawingState } from '../drawingTools/drawingTypes'
import { DrawingToolActionControls, DrawingToolPersistenceControls, DrawingToolTabs } from '../DrawingToolControls'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import { DrawingTabPanel } from './DrawingTabPanel'

type StandardDrawingToolSettingsPanelProps = {
  armedKey: DrawingToolKey | null
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
  selectedTool: DrawingTool
  storagePeriod: string
  tabs: DrawingTab[]
  textStyle: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
  visibleTab: DrawingTab
}

const tabLabels: Record<DrawingTab, string> = {
  coords: '\u5750\u6807',
  style: '\u6837\u5f0f',
  text: '\u6587\u672c',
}

function isPersistableTool(key: DrawingToolKey) {
  return key === 'horizontalLine' || key === 'trendLine' || key === 'ruler' || key === 'fibRetracement' || key === 'emojiSticker'
}

function DrawingToolPersistenceButtons({
  onPersistenceChange,
  selectedPersisted,
  selectedTool,
}: Pick<StandardDrawingToolSettingsPanelProps, 'onPersistenceChange' | 'selectedPersisted' | 'selectedTool'>) {
  return (
    <DrawingToolPersistenceControls
      onSave={() => onPersistenceChange(true)}
      onUnsave={() => onPersistenceChange(false)}
      persisted={selectedPersisted}
      toolLabel={selectedTool.label}
    />
  )
}

export function StandardDrawingToolSettingsPanel({
  armedKey,
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
  selectedTool,
  storagePeriod,
  tabs,
  textStyle,
  trendLineStyle,
  visibleTab,
}: StandardDrawingToolSettingsPanelProps) {
  return (
    <>
      <DrawingToolActionControls
        armed={armedKey === selectedKey}
        locked={selectedLocked}
        onArm={onArm}
        onDelete={onDelete}
        onRelease={onRelease}
        onToggleLock={onToggleLock}
        persistenceControls={isPersistableTool(selectedKey) ? <DrawingToolPersistenceButtons onPersistenceChange={onPersistenceChange} selectedPersisted={selectedPersisted} selectedTool={selectedTool} /> : undefined}
        selected={selected}
        toolLabel={selectedTool.label}
      />
      <div className="ff-drawing-hline-settings-v1">
        <DrawingToolTabs
          activeKey={visibleTab}
          ariaLabel={`${selectedTool.label} settings`}
          onChange={(tab) => onActiveTabChange(tab as DrawingTab)}
          tabs={tabs.map((tab) => ({ key: tab, label: tabLabels[tab] }))}
          renderPanel={(tab) => (
            <DrawingTabPanel
              lineStyle={lineStyle}
              onLineStyleChange={onLineStyleChange}
              onCrossPeriodChange={onCrossPeriodChange}
              onCrossPeriodTargetsChange={onCrossPeriodTargetsChange}
              onPriceLabelChange={onPriceLabelChange}
              onRulerStyleChange={onRulerStyleChange}
              onTextStyleChange={onTextStyleChange}
              onTrendLineStyleChange={onTrendLineStyleChange}
              priceLabelVisible={priceLabelVisible}
              crossPeriodVisible={selectedCrossPeriod}
              crossPeriodTargets={selectedCrossPeriodTargets}
              rulerStyle={rulerStyle}
              selectedDrawing={selectedDrawing}
              storagePeriod={storagePeriod}
              onPriceChange={onPriceChange}
              onFibTrendLineChange={onFibTrendLineChange}
              onQuickMeasureChange={onQuickMeasureChange}
              onTrendPointPriceChange={onTrendPointPriceChange}
              tab={tab as DrawingTab}
              textStyle={textStyle}
              fibTrendLineStyle={fibTrendLineStyle}
              fibTrendLineVisible={fibTrendLineVisible}
              fibHorizontalLineStyle={fibHorizontalLineStyle}
              fibLevels={fibLevels}
              fibBackgroundOpacity={fibBackgroundOpacity}
              fibBackgroundVisible={fibBackgroundVisible}
              fibLabelAlign={fibLabelAlign}
              fibLabelFontSize={fibLabelFontSize}
              fibLabelVAlign={fibLabelVAlign}
              fibLevelDisplay={fibLevelDisplay}
              fibLevelVisible={fibLevelVisible}
              fibPriceVisible={fibPriceVisible}
              fibQuarterLineStyles={fibQuarterLineStyles}
              fibQuarterSplitVisible={fibQuarterSplitVisible}
              fibReverse={fibReverse}
              onFibRetracementStyleChange={onFibRetracementStyleChange}
              trendLineStyle={trendLineStyle}
              tool={selectedTool}
              quickMeasureEnabled={quickMeasureEnabled}
            />
          )}
        />
      </div>
    </>
  )
}
