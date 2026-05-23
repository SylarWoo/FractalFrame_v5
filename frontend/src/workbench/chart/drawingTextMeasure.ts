let textMeasureContext: CanvasRenderingContext2D | null = null
const textMeasureCache = new Map<string, number>()
const textMeasureCacheLimit = 600

export function measureCanvasText(value: string, font: string) {
  if (!textMeasureContext) {
    textMeasureContext = document.createElement('canvas').getContext('2d')
  }
  const ctx = textMeasureContext
  if (!ctx) return value.length * 8
  const key = `${font}\n${value}`
  const cached = textMeasureCache.get(key)
  if (cached != null) return cached
  ctx.font = font
  const width = Number(ctx.measureText(value).width) || value.length * 8
  if (textMeasureCache.size >= textMeasureCacheLimit) textMeasureCache.clear()
  textMeasureCache.set(key, width)
  return width
}
