import { IndicatorSeries, registerIndicator } from 'klinecharts'
import type { IndicatorDrawParams, KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MaIndicatorSettings } from '../rightDrawer/indicatorPersistence'

type MaShiftRow = {
  ma?: number
  maFadedColor1?: number
  maFadedColor2?: number
  maFadedColor3?: number
  maFadedColor4?: number
  maColor1?: number
  maColor2?: number
  maColor3?: number
  maColor4?: number
  maColorIndex?: number
  oscillator?: number
}

let registered = false

function clampPeriod(value: unknown, fallback: number) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(500, next)) : fallback
}

function normalizeMaSettings(input?: Partial<MaIndicatorSettings> | number): MaIndicatorSettings {
  if (typeof input === 'number') return { ...defaultMaIndicatorSettings, length: input }
  return { ...defaultMaIndicatorSettings, ...(input ?? {}) }
}

function calculateSourceValue(row: KLineData, source: MaIndicatorSettings['source']) {
  const open = Number(row.open)
  const high = Number(row.high)
  const low = Number(row.low)
  const close = Number(row.close)

  switch (source) {
    case 'open':
      return open
    case 'high':
      return high
    case 'low':
      return low
    case 'hl2':
      return Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : NaN
    case 'hlc3':
      return Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close) ? (high + low + close) / 3 : NaN
    case 'ohlc4':
      return Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
        ? (open + high + low + close) / 4
        : NaN
    default:
      return close
  }
}

function calculateSma(values: number[], period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) {
      sum = 0
      continue
    }
    sum += value
    if (index >= period) sum -= values[index - period]
    if (index >= period - 1) out[index] = sum / period
  }
  return out
}

function calculateEma(values: number[], period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  const multiplier = 2 / (period + 1)
  let sum = 0
  let ema: number | undefined
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    if (index < period) sum += value
    if (index === period - 1) {
      ema = sum / period
      out[index] = ema
    } else if (index >= period && ema != null) {
      ema = value * multiplier + ema * (1 - multiplier)
      out[index] = ema
    }
  }
  return out
}

function calculateRma(values: number[], period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  let rma: number | undefined
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    if (index < period) sum += value
    if (index === period - 1) {
      rma = sum / period
      out[index] = rma
    } else if (index >= period && rma != null) {
      rma = (rma * (period - 1) + value) / period
      out[index] = rma
    }
  }
  return out
}

function calculateWma(values: number[], period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  const denominator = (period * (period + 1)) / 2
  for (let index = period - 1; index < values.length; index += 1) {
    let numerator = 0
    let valid = true
    for (let cursor = 0; cursor < period; cursor += 1) {
      const value = values[index - period + 1 + cursor]
      if (!Number.isFinite(value)) {
        valid = false
        break
      }
      numerator += value * (cursor + 1)
    }
    if (valid) out[index] = numerator / denominator
  }
  return out
}

function calculateVwma(dataList: KLineData[], values: number[], period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  for (let index = period - 1; index < values.length; index += 1) {
    let numerator = 0
    let denominator = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor]
      const volume = Math.max(0, Number(dataList[cursor]?.volume) || 0)
      if (!Number.isFinite(value)) continue
      numerator += value * volume
      denominator += volume
    }
    out[index] = denominator > 0 ? numerator / denominator : undefined
  }
  return out
}

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function clampLineWidth(value: unknown, fallback = 1) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 6)) : fallback
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
}

function valueOrFallback(values: string[], index: number, fallback: string) {
  const value = values[index]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function getMaSegmentColor(settings: MaIndicatorSettings, colorIndex: number, opacity: number) {
  return colorWithAlpha(valueOrFallback(settings.colors, colorIndex, settings.maLineColor), opacity)
}

function calculateStandardDeviation(values: Array<number | undefined>, period: number) {
  const out: Array<number | undefined> = values.map(() => undefined)
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0
    let count = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor]
      if (!Number.isFinite(value)) continue
      sum += value as number
      count += 1
    }
    if (count !== period) continue
    const mean = sum / period
    let variance = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor] as number
      variance += (value - mean) ** 2
    }
    out[index] = Math.sqrt(variance / period)
  }
  return out
}

function getOscillatorColorIndex(current: number | undefined, previous: number | undefined) {
  if (!Number.isFinite(current)) return null
  const value = current as number
  const prior = Number.isFinite(previous) ? previous as number : value
  if (value >= 0) return value >= prior ? 0 : 1
  return value >= prior ? 2 : 3
}

function assignColoredMaSegments(rows: MaShiftRow[], maValues: Array<number | undefined>, oscillatorValues: Array<number | undefined>) {
  for (let index = 0; index < rows.length; index += 1) {
    const ma = maValues[index]
    if (!Number.isFinite(ma)) continue
    const colorIndex = getOscillatorColorIndex(oscillatorValues[index], oscillatorValues[index - 1])
    if (colorIndex == null) continue
    const key = `maColor${colorIndex + 1}` as 'maColor1' | 'maColor2' | 'maColor3' | 'maColor4'
    const fadedKey = `maFadedColor${colorIndex + 1}` as 'maFadedColor1' | 'maFadedColor2' | 'maFadedColor3' | 'maFadedColor4'
    rows[index][key] = ma
    rows[index][fadedKey] = ma
    rows[index].maColorIndex = colorIndex
    const previousMa = maValues[index - 1]
    if (Number.isFinite(previousMa)) {
      rows[index - 1][key] = previousMa
      rows[index - 1][fadedKey] = previousMa
      if (rows[index - 1].maColorIndex == null) rows[index - 1].maColorIndex = colorIndex
    }
  }
}

function createMaStrokeStyle(
  ctx: CanvasRenderingContext2D,
  settings: MaIndicatorSettings,
  fromColorIndex: number,
  toColorIndex: number,
  opacity: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  const fromColor = getMaSegmentColor(settings, fromColorIndex, opacity)
  const toColor = getMaSegmentColor(settings, toColorIndex, opacity)
  if (fromColor === toColor) return fromColor
  const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY)
  gradient.addColorStop(0, fromColor)
  gradient.addColorStop(1, toColor)
  return gradient
}

function extendSegmentEndpoints(fromX: number, fromY: number, toX: number, toY: number, overlap: number) {
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.hypot(dx, dy)
  if (!Number.isFinite(length) || length <= 0) return { fromX, fromY, toX, toY }
  const unitX = dx / length
  const unitY = dy / length
  return {
    fromX: fromX - unitX * overlap,
    fromY: fromY - unitY * overlap,
    toX: toX + unitX * overlap,
    toY: toY + unitY * overlap,
  }
}

function drawMaLayer(
  params: IndicatorDrawParams<MaShiftRow>,
  settings: MaIndicatorSettings,
  layer: 'faded' | 'main',
) {
  const visible = layer === 'faded' ? settings.maFadedVisible : settings.maLineVisible
  if (!visible) return

  const lineWidth = clampLineWidth(layer === 'faded' ? settings.maFadedLineWidth : settings.maLineWidth)
  const opacity = clampOpacity(layer === 'faded' ? settings.maFadedOpacity : settings.maLineOpacity, layer === 'faded' ? 0.1 : 1)
  if (lineWidth <= 0 || opacity <= 0) return

  const { ctx, indicator, visibleRange, xAxis, yAxis } = params
  const rows = indicator.result ?? []
  const from = Math.max(1, Math.floor(visibleRange.realFrom) - 1)
  const to = Math.min(rows.length - 1, Math.ceil(visibleRange.realTo) + 1)

  ctx.save()
  ctx.lineCap = 'square'
  ctx.lineJoin = 'round'
  ctx.lineWidth = lineWidth

  let activeColorIndex: number | null = null
  let activePathStarted = false

  const flushActivePath = () => {
    if (!activePathStarted || activeColorIndex == null) return
    ctx.strokeStyle = getMaSegmentColor(settings, activeColorIndex, opacity)
    ctx.stroke()
    activePathStarted = false
    activeColorIndex = null
  }

  for (let index = from; index <= to; index += 1) {
    const prev = rows[index - 1]
    const current = rows[index]
    if (!Number.isFinite(prev?.ma) || !Number.isFinite(current?.ma)) {
      flushActivePath()
      continue
    }
    const fromColorIndex = typeof prev.maColorIndex === 'number' ? prev.maColorIndex : current.maColorIndex
    const toColorIndex = typeof current.maColorIndex === 'number' ? current.maColorIndex : fromColorIndex
    if (typeof fromColorIndex !== 'number' || typeof toColorIndex !== 'number') {
      flushActivePath()
      continue
    }

    const fromX = xAxis.convertToPixel(index - 1)
    const toX = xAxis.convertToPixel(index)
    const fromY = yAxis.convertToPixel(prev.ma as number)
    const toY = yAxis.convertToPixel(current.ma as number)

    if (fromColorIndex === toColorIndex) {
      if (!activePathStarted || activeColorIndex !== toColorIndex) {
        flushActivePath()
        activeColorIndex = toColorIndex
        activePathStarted = true
        ctx.beginPath()
        ctx.moveTo(fromX, fromY)
      }
      ctx.lineTo(toX, toY)
      continue
    }

    flushActivePath()
    const extended = extendSegmentEndpoints(fromX, fromY, toX, toY, Math.max(1, lineWidth * 0.75))
    ctx.strokeStyle = createMaStrokeStyle(
      ctx,
      settings,
      fromColorIndex,
      toColorIndex,
      opacity,
      extended.fromX,
      extended.fromY,
      extended.toX,
      extended.toY,
    )
    ctx.beginPath()
    ctx.moveTo(extended.fromX, extended.fromY)
    ctx.lineTo(extended.toX, extended.toY)
    ctx.stroke()
  }

  flushActivePath()
  ctx.restore()
}

function drawMaShiftIndicator(params: IndicatorDrawParams<MaShiftRow>) {
  const settings = normalizeMaSettings(params.indicator.calcParams[0])
  drawMaLayer(params, settings, 'faded')
  drawMaLayer(params, settings, 'main')
  return true
}

export function calculateTradingViewMaShiftRows(dataList: KLineData[], inputSettings: Partial<MaIndicatorSettings> | number = defaultMaIndicatorSettings): MaShiftRow[] {
  const settings = normalizeMaSettings(inputSettings)
  const period = clampPeriod(settings.length, defaultMaIndicatorSettings.length)
  const shiftPeriod = clampPeriod(settings.shiftLength, defaultMaIndicatorSettings.shiftLength)
  const values = dataList.map((row) => calculateSourceValue(row, settings.source))
  const maValues = settings.type === 'ema'
    ? calculateEma(values, period)
    : settings.type === 'smma'
      ? calculateRma(values, period)
      : settings.type === 'wma'
        ? calculateWma(values, period)
        : settings.type === 'vwma'
          ? calculateVwma(dataList, values, period)
          : calculateSma(values, period)

  const deviations = maValues.map((ma, index) => Number.isFinite(ma) && Number.isFinite(values[index]) ? values[index] - (ma as number) : undefined)
  const deviationScale = calculateStandardDeviation(deviations, shiftPeriod)
  const multiplier = Math.max(0.000001, Number(settings.shiftMultiplier) || defaultMaIndicatorSettings.shiftMultiplier)
  const oscillatorValues = deviations.map((deviation, index) => {
    const scale = deviationScale[index]
    if (!Number.isFinite(deviation) || !Number.isFinite(scale) || Math.abs(scale as number) < 0.000001) return undefined
    return (deviation as number) / ((scale as number) * multiplier)
  })
  const rows = maValues.map((ma, index) => Number.isFinite(ma) ? { ma, oscillator: oscillatorValues[index] } : {})
  assignColoredMaSegments(rows, maValues, oscillatorValues)
  return rows
}

export function ensureTradingViewMaShiftIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MaShiftRow>({
    name: 'MA',
    shortName: 'MA',
    calcParams: [defaultMaIndicatorSettings],
    series: IndicatorSeries.Price,
    figures: [],
    regenerateFigures: () => [],
    createTooltipDataSource: ({ indicator }) => {
      const settings = normalizeMaSettings(indicator.calcParams[0])
      return {
        name: 'MA',
        calcParamsText: `(${settings.length})`,
        icons: [],
        values: [],
      }
    },
    draw: drawMaShiftIndicator,
    calc: (dataList, indicator) => calculateTradingViewMaShiftRows(dataList, indicator.calcParams[0]),
  })
}
