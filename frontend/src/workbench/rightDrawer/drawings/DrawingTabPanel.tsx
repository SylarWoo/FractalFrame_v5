import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import { DrawingTextPanel } from '../DrawingTextPanel'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../drawingPersistence'
import type { DrawingTab, SelectedDrawingState } from '../drawingTools/drawingTypes'
import type { FibLevelState } from '../FibRetracementStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import { DrawingCoordsPanel } from './DrawingCoordsPanel'
import { DrawingStylePanel, type DrawingStyleTool } from './DrawingStylePanel'

export type DrawingTabKey = DrawingTab

type DrawingTabSelection = Pick<SelectedDrawingState, 'locked' | 'objectId' | 'price' | 'tool' | 'trendPointPrices'>

export function DrawingTabPanel({
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
  crossPeriodVisible,
  crossPeriodTargets,
  onFibTrendLineChange,
  onCrossPeriodChange,
  onCrossPeriodTargetsChange,
  onFibRetracementStyleChange,
  onLineStyleChange,
  onPriceLabelChange,
  onPriceChange,
  onQuickMeasureChange,
  onRulerStyleChange,
  onTextStyleChange,
  onTrendPointPriceChange,
  onTrendLineStyleChange,
  priceLabelVisible,
  quickMeasureEnabled,
  rulerStyle,
  selectedDrawing,
  storagePeriod,
  tab,
  textStyle,
  trendLineStyle,
  tool,
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
  lineStyle: SettingsLineSwatchValue
  crossPeriodVisible: boolean
  crossPeriodTargets: DrawingCrossPeriodTarget[]
  onFibTrendLineChange: (visible: boolean, style?: SettingsLineSwatchValue) => void
  onCrossPeriodChange: (enabled: boolean) => void
  onCrossPeriodTargetsChange: (targets: DrawingCrossPeriodTarget[]) => void
  onFibRetracementStyleChange: (levels: FibLevelState[], horizontalLineStyle: SettingsLineSwatchValue, backgroundVisible: boolean, backgroundOpacity: number, reverse: boolean, priceVisible: boolean, labelAlign: string, labelVAlign: string, labelFontSize: string, levelVisible: boolean, levelDisplay: string, quarterSplitVisible: boolean, quarterLineStyles: SettingsLineSwatchValue[]) => void
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onPriceLabelChange: (enabled: boolean) => void
  onPriceChange: (price: number) => void
  onQuickMeasureChange: (enabled: boolean) => void
  onRulerStyleChange: (value: DrawingRulerStyle) => void
  onTextStyleChange: (value: DrawingTextStyle) => void
  onTrendPointPriceChange: (pointIndex: number, price: number) => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  priceLabelVisible: boolean
  quickMeasureEnabled: boolean
  rulerStyle: DrawingRulerStyle
  selectedDrawing: DrawingTabSelection | null
  storagePeriod: string
  tab: DrawingTabKey
  textStyle: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
  tool: DrawingStyleTool
}) {
  if (tab === 'style') {
    return (
      <DrawingStylePanel
        fibHorizontalLineStyle={fibHorizontalLineStyle}
        fibBackgroundOpacity={fibBackgroundOpacity}
        fibBackgroundVisible={fibBackgroundVisible}
        fibLevels={fibLevels}
        fibLabelAlign={fibLabelAlign}
        fibLabelFontSize={fibLabelFontSize}
        fibLabelVAlign={fibLabelVAlign}
        fibLevelDisplay={fibLevelDisplay}
        fibLevelVisible={fibLevelVisible}
        fibPriceVisible={fibPriceVisible}
        fibQuarterLineStyles={fibQuarterLineStyles}
        fibQuarterSplitVisible={fibQuarterSplitVisible}
        fibReverse={fibReverse}
        lineStyle={lineStyle}
        crossPeriodVisible={crossPeriodVisible}
        crossPeriodTargets={crossPeriodTargets}
        fibTrendLineStyle={fibTrendLineStyle}
        fibTrendLineVisible={fibTrendLineVisible}
        onFibTrendLineChange={onFibTrendLineChange}
        onFibRetracementStyleChange={onFibRetracementStyleChange}
        onLineStyleChange={onLineStyleChange}
        onCrossPeriodChange={onCrossPeriodChange}
        onCrossPeriodTargetsChange={onCrossPeriodTargetsChange}
        onPriceLabelChange={onPriceLabelChange}
        onQuickMeasureChange={onQuickMeasureChange}
        onRulerStyleChange={onRulerStyleChange}
        onTrendLineStyleChange={onTrendLineStyleChange}
        priceLabelVisible={priceLabelVisible}
        quickMeasureEnabled={quickMeasureEnabled}
        rulerStyle={rulerStyle}
        storagePeriod={storagePeriod}
        trendLineStyle={trendLineStyle}
        tool={tool}
      />
    )
  }
  if (tab === 'text') {
    return <DrawingTextPanel alignmentVisible={tool.key !== 'ruler'} onTextStyleChange={onTextStyleChange} textStyle={textStyle} />
  }
  return <DrawingCoordsPanel onPriceChange={onPriceChange} onTrendPointPriceChange={onTrendPointPriceChange} selectedDrawing={selectedDrawing} tool={tool} />
}
