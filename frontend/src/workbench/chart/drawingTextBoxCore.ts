import { normalizeDrawingTextStyle } from '../rightDrawer/drawingPersistence'
import type { DrawingTextStyle } from '../rightDrawer/drawingPersistence'

export type DrawingTextBoxRowsMode = {
  dropBlank?: boolean
  trimEnd?: boolean
}

export type DrawingTextBoxMetrics = {
  font: string
  lineHeight: number
  rows: string[]
  text: DrawingTextStyle
  width: number
}

export function normalizeDrawingTextBoxStyle(textStyle: DrawingTextStyle | undefined, patch?: Partial<DrawingTextStyle>) {
  return normalizeDrawingTextStyle({
    ...textStyle,
    ...patch,
  })
}

function quoteFontFamily(fontFamily: string) {
  return fontFamily.includes(' ') ? `"${fontFamily.replace(/"/g, '')}"` : fontFamily
}

export function createDrawingTextBoxFont(text: Pick<DrawingTextStyle, 'bold' | 'fontFamily' | 'fontSize' | 'italic'>) {
  const fontStyle = text.italic ? 'italic ' : ''
  const fontWeight = text.bold ? '700 ' : '400 '
  return `${fontStyle}${fontWeight}${text.fontSize}px ${quoteFontFamily(text.fontFamily)}, Arial, Tahoma, sans-serif`
}

export function splitDrawingTextBoxRows(body: string, mode: DrawingTextBoxRowsMode = {}) {
  return body
    .split(/\r?\n/)
    .map((line) => mode.trimEnd ? line.trimEnd() : line)
    .filter((line) => mode.dropBlank ? Boolean(line.trim()) : true)
}

export function measureDrawingTextBoxRows({
  font,
  fontSize,
  measure,
  rows,
}: {
  font: string
  fontSize: number
  measure: (value: string, font: string) => number
  rows: string[]
}) {
  return Math.ceil(rows.reduce((max, row) => {
    const measured = Number(measure(row, font))
    return Math.max(max, Number.isFinite(measured) && measured > 0 ? measured : row.length * fontSize * 0.55)
  }, 0))
}

export function resolveDrawingTextBoxMetrics({
  measure,
  rowsMode,
  textStyle,
}: {
  measure: (value: string, font: string) => number
  rowsMode?: DrawingTextBoxRowsMode
  textStyle?: DrawingTextStyle
}): DrawingTextBoxMetrics | null {
  const text = normalizeDrawingTextBoxStyle(textStyle)
  if (!text.body.trim()) return null
  const rows = splitDrawingTextBoxRows(text.body, rowsMode)
  if (rows.length === 0) return null
  const font = createDrawingTextBoxFont(text)
  return {
    font,
    lineHeight: Math.round(text.fontSize * 1.25),
    rows,
    text,
    width: measureDrawingTextBoxRows({ font, fontSize: text.fontSize, measure, rows }),
  }
}

export function drawDrawingTextBoxRows(ctx: CanvasRenderingContext2D, {
  color,
  font,
  lineHeight,
  rows,
  textAlign,
  textBaseline,
  x,
  y,
}: {
  color: string
  font: string
  lineHeight: number
  rows: string[]
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  x: number
  y: number
}) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = textAlign
  ctx.textBaseline = textBaseline
  rows.forEach((row, index) => {
    ctx.fillText(row, x, y + index * lineHeight)
  })
}
