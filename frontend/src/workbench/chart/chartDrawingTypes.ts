import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import type { DrawingTextStyle, DrawingTrendLineStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingRulerStyle } from '../rightDrawer/rulerDrawingStyle'

export type HorizontalLineExtendData = {
  handlePressed?: boolean
  hovered?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  manualVisible?: boolean
  objectId?: string
  periodVisible?: boolean
  pressed?: boolean
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: DrawingTextStyle
}

export type TrendLineExtendData = {
  drawing?: boolean
  endpointPressed?: boolean
  pressedPointIndex?: number
  hovered?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  manualVisible?: boolean
  objectId?: string
  periodVisible?: boolean
  pressed?: boolean
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: DrawingTextStyle
  trendLineStyle?: DrawingTrendLineStyle
}

export type RulerExtendData = {
  dataList?: Array<{
    real_volume?: number
    tick_volume?: number
    timestamp?: number
    volume?: number
  }>
  drawing?: boolean
  endpointPressed?: boolean
  hovered?: boolean
  lineStyle?: SettingsLineSwatchValue
  locked?: boolean
  manualVisible?: boolean
  objectId?: string
  periodVisible?: boolean
  pressed?: boolean
  pressedPointIndex?: number
  selected?: boolean
  showPriceLabel?: boolean
  textStyle?: DrawingTextStyle
  rulerStyle?: DrawingRulerStyle
}

export type HorizontalLineFigure = {
  attrs: Record<string, unknown>
  ignoreEvent?: boolean
  key?: string
  styles?: Record<string, unknown>
  type: string
}

export type ScreenPoint = { x: number; y: number }

export type HorizontalLineMoveEntry = {
  id: string
  startValue: number
}

export type TrendLineMoveEntry = {
  id: string
  points: Array<{
    point: { dataIndex?: number; timestamp?: number; value?: number }
    pixel: ScreenPoint
  }>
}

export type MixedDrawingMoveState = {
  activeId: string
  horizontalEntries: Array<HorizontalLineMoveEntry & { startY: number }>
  paneId: string
  startX: number
  startY: number
  trendEntries: TrendLineMoveEntry[]
}

export function isCoordinate(value: Partial<{ x: number; y: number }> | Array<Partial<{ x: number; y: number }>>): value is Partial<{ x: number; y: number }> {
  return !Array.isArray(value)
}
