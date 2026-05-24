import { PolygonType } from 'klinecharts'
import type { SettingsLineSwatchValue } from '../settings/SettingsSwatches'
import { createPriceAxisLabelTextStyle } from './chartPriceLabelStyles'
import { colorWithAlpha, normalizeLineStyle } from './chartDrawingStyle'
import type { HorizontalLineFigure } from './chartDrawingTypes'
import { formatOverlayPrice, resolveHorizontalLineLabelPrecision } from './drawingPriceLabelFormat'

const twoPointYAxisSelectionWidth = 80

type PriceLabelOverlayLike = {
  paneId?: string
  points: Array<{ value?: number }>
}

export function createDrawingYAxisPriceLabel({
  backgroundColor,
  labelPrecision,
  thousandsSeparator,
  value,
  y,
}: {
  backgroundColor: string
  labelPrecision: number
  thousandsSeparator: string
  value: number
  y: number
}): HorizontalLineFigure | null {
  if (!Number.isFinite(y) || !Number.isFinite(value)) return null
  return {
    type: 'text',
    attrs: {
      align: 'left',
      baseline: 'middle',
      text: formatOverlayPrice(value, labelPrecision, thousandsSeparator),
      x: 0,
      y,
    },
    ignoreEvent: true,
    styles: {
      ...createPriceAxisLabelTextStyle(),
      backgroundColor,
      color: '#ffffff',
    },
  }
}

export function createSinglePointYAxisPriceFigures({
  coordinates,
  lineStyle,
  overlay,
  precision,
  thousandsSeparator,
}: {
  coordinates: Array<{ y?: number }>
  lineStyle: SettingsLineSwatchValue | undefined
  overlay: PriceLabelOverlayLike
  precision: { price: number }
  thousandsSeparator: string
}) {
  const style = normalizeLineStyle(lineStyle)
  const label = createDrawingYAxisPriceLabel({
    backgroundColor: colorWithAlpha(style.hex, style.opacity),
    labelPrecision: resolveHorizontalLineLabelPrecision(overlay.paneId, precision.price),
    thousandsSeparator,
    value: Number(overlay.points[0]?.value),
    y: Number(coordinates[0]?.y),
  })
  return label ? [label] : []
}

export function createTwoPointYAxisPriceFigures({
  bounding,
  coordinates,
  lineStyle,
  overlay,
  precision,
  selected,
  thousandsSeparator,
}: {
  bounding: { width: number }
  coordinates: Array<{ y?: number }>
  lineStyle: SettingsLineSwatchValue | undefined
  overlay: PriceLabelOverlayLike
  precision: { price: number }
  selected: boolean
  thousandsSeparator: string
}) {
  const style = normalizeLineStyle(lineStyle)
  const labelPrecision = resolveHorizontalLineLabelPrecision(overlay.paneId, precision.price)
  const backgroundColor = colorWithAlpha(style.hex, style.opacity)
  const figures: HorizontalLineFigure[] = []
  const endpointYs = coordinates
    .slice(0, 2)
    .map((coordinate) => Number(coordinate?.y))
    .filter((y): y is number => Number.isFinite(y))

  if (selected && endpointYs.length > 1) {
    const topY = Math.min(...endpointYs)
    const bottomY = Math.max(...endpointYs)
    if (bottomY > topY) {
      figures.push({
        type: 'rect',
        attrs: { height: bottomY - topY, width: Math.min(twoPointYAxisSelectionWidth, bounding.width), x: 0, y: topY },
        ignoreEvent: true,
        styles: { borderRadius: 0, color: 'rgba(41, 98, 255, 0.25)', style: PolygonType.Fill },
      })
    }
  }

  ;[0, 1].forEach((index) => {
    const label = createDrawingYAxisPriceLabel({
      backgroundColor,
      labelPrecision,
      thousandsSeparator,
      value: Number(overlay.points[index]?.value),
      y: Number(coordinates[index]?.y),
    })
    if (label) figures.push(label)
  })

  return figures
}
