import { normalizeDrawingTextStyle, normalizeDrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import { publishDrawingToolState } from '../rightDrawer/drawingToolCommands'
import { normalizeLineStyle } from './chartDrawingStyle'
import type { TrendLineExtendData } from './chartDrawingTypes'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'

export function publishTrendLineDeselectedState(armed: boolean) {
  publishDrawingToolState({
    armed,
    locked: false,
    selected: false,
    showPriceLabel: true,
    tool: 'trendLine',
  })
}

export function publishTrendLineSelectedState({
  armed,
  locked,
  overlay,
  selected = true,
  showPriceLabel,
  trendPointPrices,
  textStyle,
}: {
  armed: boolean
  locked?: boolean
  overlay: { extendData?: unknown; points?: Array<{ value?: number }> }
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: TrendLineExtendData['textStyle']
  trendPointPrices: [number | undefined, number | undefined]
}) {
  const extendData = overlay.extendData as TrendLineExtendData | undefined
  publishDrawingToolState({
    armed,
    crossPeriod: extendData?.crossPeriod === true,
    crossPeriodTargets: extendData?.crossPeriodTargets,
    lineStyle: normalizeLineStyle(extendData?.lineStyle),
    locked: locked ?? Boolean(extendData?.locked),
    objectId: extendData?.objectId,
    selected,
    showPriceLabel: showPriceLabel ?? extendData?.showPriceLabel !== false,
    sourcePeriod: extendData?.sourcePeriod,
    textStyle: textStyle ? normalizeDrawingTextStyle(textStyle) : normalizeDrawingTextStyle(extendData?.textStyle),
    tool: 'trendLine',
    trendPointPrices,
    trendLineStyle: normalizeDrawingTrendLineStyle(extendData?.trendLineStyle),
  })
}

export function publishTrendLineStartedState({
  armed,
  lineStyle,
  locked,
  crossPeriod,
  crossPeriodTargets,
  sourcePeriod,
  showPriceLabel,
  textStyle,
  trendLineStyle,
}: {
  armed: boolean
  lineStyle: SettingsLineSwatchValue
  locked: boolean
  crossPeriod?: boolean
  crossPeriodTargets?: string[]
  sourcePeriod?: string
  showPriceLabel: boolean
  textStyle?: DrawingTextStyle
  trendLineStyle: DrawingTrendLineStyle
}) {
  publishDrawingToolState({
    armed,
    crossPeriod: crossPeriod === true,
    crossPeriodTargets,
    lineStyle: normalizeLineStyle(lineStyle),
    locked,
    selected: false,
    showPriceLabel,
    sourcePeriod,
    textStyle: normalizeDrawingTextStyle(textStyle),
    tool: 'trendLine',
    trendLineStyle,
  })
}
