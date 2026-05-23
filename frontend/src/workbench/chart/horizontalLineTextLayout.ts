import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'

const textTopLineGap = 1
const textBottomLineGap = 5
const textMiddleYOffset = 1
export const horizontalLineTextMiddleLineGap = 5

export function resolveHorizontalLineTextLayout(textStyle: DrawingTextStyle | undefined, y: number, left: number, right: number, measure: (value: string, font: string) => number) {
  const text = normalizeDrawingTextStyle(textStyle)
  if (!text.body.trim()) return null
  const fontStyle = text.italic ? 'italic ' : ''
  const fontWeight = text.bold ? '700 ' : '400 '
  const font = `${fontStyle}${fontWeight}${text.fontSize}px Arial, Tahoma, sans-serif`
  const rows = text.body.split(/\r?\n/)
  const width = rows.reduce((max, row) => Math.max(max, measure(row, font)), 0)
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
    font,
    lineHeight: Math.round(text.fontSize * 1.25),
    rows,
    width,
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
