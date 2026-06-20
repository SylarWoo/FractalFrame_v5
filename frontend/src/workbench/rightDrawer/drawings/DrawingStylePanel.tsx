import type { DrawingCrossPeriodTarget } from '../../drawing/drawingCrossPeriodModel'
import type { SettingsLineSwatchValue } from '../../settings/SettingsSwatches'
import {
  normalizeDrawingTrendLineStyle,
  type DrawingTextStyle,
  type DrawingTrendLineStyle,
} from '../drawingPersistence'
import {
  FibRetracementStylePanel,
  type FibLevelState,
} from '../FibRetracementStylePanel'
import { RulerStylePanel } from '../RulerStylePanel'
import type { DrawingRulerStyle } from '../rulerDrawingStyle'
import type { DrawingToolKey } from '../drawingTools/drawingTypes'
import { DrawingCommonLineStyleSection } from './DrawingCommonLineStyleSection'
import { TrendLineV4StyleOptions } from './TrendLineV4StyleOptions'

export type DrawingStyleToolKey = DrawingToolKey

export type DrawingStyleTool = {
  key: DrawingStyleToolKey
}

export function DrawingStylePanel({
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
  onFibRetracementStyleChange,
  onLineStyleChange,
  onCrossPeriodChange,
  onCrossPeriodTargetsChange,
  onPriceLabelChange,
  onQuickMeasureChange,
  onRulerStyleChange,
  onTrendLineStyleChange,
  priceLabelVisible,
  quickMeasureEnabled,
  rulerStyle,
  storagePeriod,
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
  onFibRetracementStyleChange: (levels: FibLevelState[], horizontalLineStyle: SettingsLineSwatchValue, backgroundVisible: boolean, backgroundOpacity: number, reverse: boolean, priceVisible: boolean, labelAlign: string, labelVAlign: string, labelFontSize: string, levelVisible: boolean, levelDisplay: string, quarterSplitVisible: boolean, quarterLineStyles: SettingsLineSwatchValue[]) => void
  onLineStyleChange: (value: SettingsLineSwatchValue) => void
  onCrossPeriodChange: (enabled: boolean) => void
  onCrossPeriodTargetsChange: (targets: DrawingCrossPeriodTarget[]) => void
  onPriceLabelChange: (enabled: boolean) => void
  onQuickMeasureChange: (enabled: boolean) => void
  onRulerStyleChange: (value: DrawingRulerStyle) => void
  onTrendLineStyleChange: (value: DrawingTrendLineStyle) => void
  priceLabelVisible: boolean
  quickMeasureEnabled: boolean
  rulerStyle: DrawingRulerStyle
  storagePeriod: string
  textStyle?: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
  tool: DrawingStyleTool
}) {
  const updateTrendLineStyle = (patch: Partial<DrawingTrendLineStyle>) => {
    onTrendLineStyleChange(normalizeDrawingTrendLineStyle({ ...trendLineStyle, ...patch }))
  }

  if (tool.key === 'ruler') {
    return (
      <RulerStylePanel
        lineStyle={lineStyle}
        onLineStyleChange={onLineStyleChange}
        onPriceLabelChange={onPriceLabelChange}
        onQuickMeasureChange={onQuickMeasureChange}
        onRulerStyleChange={onRulerStyleChange}
        priceLabelVisible={priceLabelVisible}
        quickMeasureEnabled={quickMeasureEnabled}
        rulerStyle={rulerStyle}
      />
    )
  }

  if (tool.key === 'fibRetracement') {
    return (
      <div className="ff-drawing-tline-tv-style-v1">
        <FibRetracementStylePanel
          backgroundOpacityValue={fibBackgroundOpacity}
          backgroundVisibleValue={fibBackgroundVisible}
          reverseValue={fibReverse}
          horizontalLineStyleValue={fibHorizontalLineStyle}
          labelAlignValue={fibLabelAlign}
          labelFontSizeValue={fibLabelFontSize}
          labelVAlignValue={fibLabelVAlign}
          levelDisplayValue={fibLevelDisplay}
          levelVisibleValue={fibLevelVisible}
          levelsValue={fibLevels}
          priceVisibleValue={fibPriceVisible}
          quarterLineStylesValue={fibQuarterLineStyles}
          quarterSplitVisibleValue={fibQuarterSplitVisible}
          storagePeriod={storagePeriod}
          onFibRetracementStyleChange={onFibRetracementStyleChange}
          onTrendLineChange={onFibTrendLineChange}
          trendLineStyle={fibTrendLineStyle}
          trendLineVisible={fibTrendLineVisible}
        />
      </div>
    )
  }

  return (
    <div className="ff-drawing-tline-tv-style-v1">
      <DrawingCommonLineStyleSection
        crossPeriodTargets={crossPeriodTargets}
        crossPeriodVisible={crossPeriodVisible}
        lineStyle={lineStyle}
        onCrossPeriodChange={onCrossPeriodChange}
        onCrossPeriodTargetsChange={onCrossPeriodTargetsChange}
        onLineStyleChange={onLineStyleChange}
        onPriceLabelChange={onPriceLabelChange}
        priceLabelVisible={priceLabelVisible}
        toolKey={tool.key}
      />
      {tool.key === 'trendLine' ? (
        <TrendLineV4StyleOptions
          onChange={updateTrendLineStyle}
          onPriceLabelChange={onPriceLabelChange}
          priceLabelVisible={priceLabelVisible}
          settings={trendLineStyle}
        />
      ) : null}
    </div>
  )
}
