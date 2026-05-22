import { chartNumberFontFamily, chartNumberFontWeight } from './chartStyleReaders'

export const priceAxisLabelTextSize = 12
export const priceAxisLabelPaddingBottom = 2
export const priceAxisLabelPaddingLeft = 6
export const priceAxisLabelPaddingRight = 7
export const priceAxisLabelPaddingTop = 4

export function createPriceAxisLabelTextStyle(show = true) {
  return {
    borderRadius: 0,
    family: chartNumberFontFamily,
    show,
    paddingBottom: priceAxisLabelPaddingBottom,
    paddingLeft: priceAxisLabelPaddingLeft,
    paddingRight: priceAxisLabelPaddingRight,
    paddingTop: priceAxisLabelPaddingTop,
    size: priceAxisLabelTextSize,
    weight: chartNumberFontWeight,
  }
}
