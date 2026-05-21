import { IndicatorSeries, LineType, registerIndicator } from 'klinecharts'
import type { KLineData } from 'klinecharts'
import { defaultMaIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { MaIndicatorSettings } from '../rightDrawer/indicatorPersistence'

type MaShiftRow = {
  ma?: number
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
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 4)) : fallback
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${clampOpacity(alpha)})`
}

function lineDashForStyle(style: MaIndicatorSettings['maLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: MaIndicatorSettings['maLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

export function calculateTradingViewMaShiftRows(dataList: KLineData[], inputSettings: Partial<MaIndicatorSettings> | number = defaultMaIndicatorSettings): MaShiftRow[] {
  const settings = normalizeMaSettings(inputSettings)
  const period = clampPeriod(settings.length, defaultMaIndicatorSettings.length)
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

  return maValues.map((ma) => Number.isFinite(ma) ? { ma } : {})
}

export function ensureTradingViewMaShiftIndicator() {
  if (registered) return
  registered = true

  registerIndicator<MaShiftRow>({
    name: 'MA',
    shortName: 'MA',
    calcParams: [defaultMaIndicatorSettings],
    series: IndicatorSeries.Price,
    figures: [
      {
        key: 'ma',
        title: 'MA: ',
        type: 'line',
        styles: (_data, indicator) => {
          const settings = normalizeMaSettings(indicator.calcParams[0])
          return {
            color: settings.maLineVisible ? colorWithAlpha(settings.maLineColor, settings.maLineOpacity) : 'rgba(0,0,0,0)',
            dashedValue: lineDashForStyle(settings.maLineStyle),
            size: clampLineWidth(settings.maLineWidth),
            smooth: false,
            style: klineLineTypeForStyle(settings.maLineStyle),
          } as any
        },
      },
    ],
    regenerateFigures: () => [
      {
        key: 'ma',
        title: 'MA: ',
        type: 'line',
        styles: (_data, indicator) => {
          const settings = normalizeMaSettings(indicator.calcParams[0])
          return {
            color: settings.maLineVisible ? colorWithAlpha(settings.maLineColor, settings.maLineOpacity) : 'rgba(0,0,0,0)',
            dashedValue: lineDashForStyle(settings.maLineStyle),
            size: clampLineWidth(settings.maLineWidth),
            smooth: false,
            style: klineLineTypeForStyle(settings.maLineStyle),
          } as any
        },
      },
    ],
    createTooltipDataSource: ({ indicator }) => {
      const settings = normalizeMaSettings(indicator.calcParams[0])
      return {
        name: 'MA',
        calcParamsText: `(${settings.length})`,
        icons: [],
        values: [],
      }
    },
    calc: (dataList, indicator) => calculateTradingViewMaShiftRows(dataList, indicator.calcParams[0]),
  })
}
