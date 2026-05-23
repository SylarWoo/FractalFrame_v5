import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'
import { resolveDrawingTextBoxMetrics } from './drawingTextBoxCore'

const textTopLineGap = 1
const textBottomLineGap = 5
const textMiddleYOffset = 1
export const horizontalLineTextMiddleLineGap = 5

export function resolveHorizontalLineTextLayout(textStyle: DrawingTextStyle | undefined, y: number, left: number, right: number, measure: (value: string, font: string) => number) {
  const metrics = resolveDrawingTextBoxMetrics({ measure, textStyle })
  if (!metrics) return null
  const { text } = metrics
  const x = text.alignH === 'left'
    ? left + 8
    : text.alignH === 'center'
      ? (left + right) / 2
      : right - 8
  const textY = text.alignV === 'top'
    ? y - textTopLineGap
    : text.alignV === 'bottom'
      ? y + textBottomLineGap
      : y + textMiddleYOffset
  return {
    ...text,
    ...metrics,
    x,
    y: textY,
  }
}

export function horizontalLineTextLayoutBounds(layout: ReturnType<typeof resolveHorizontalLineTextLayout>) {
  if (!layout) return null
  const left = layout.alignH === 'left'
    ? layout.x
    : layout.alignH === 'center'
      ? layout.x - layout.width / 2
      : layout.x - layout.width
  return { left, right: left + layout.width }
}
