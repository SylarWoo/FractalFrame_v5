import { IndicatorSeries, LineType, registerIndicator } from 'klinecharts'
import type { IndicatorCreateTooltipDataSourceParams, KLineData } from 'klinecharts'
import { defaultVwapIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VwapAnchorPeriod, VwapIndicatorSettings, VwapSource } from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { calculateWithoutFuturePlaceholders } from './chartFuturePlaceholders'

type VwapIndicatorRow = {
  lowerBand1?: number
  upperBand1?: number
  vwap?: number
}

type VwapCalcSettings = Partial<VwapIndicatorSettings> & {
  symbol?: string
}

let registered = false

function normalizeVwapSettings(input?: VwapCalcSettings): VwapIndicatorSettings {
  return { ...defaultVwapIndicatorSettings, ...(input ?? {}) }
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

function lineDashForStyle(style: VwapIndicatorSettings['vwapLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function klineLineTypeForStyle(style: VwapIndicatorSettings['vwapLineStyle']) {
  return style === 'solid' ? LineType.Solid : LineType.Dashed
}

function createLineFigureStyle(
  color: string,
  visible: boolean,
  lineStyle: VwapIndicatorSettings['vwapLineStyle'],
  lineWidth: number,
  opacity: number,
) {
  return {
    color: visible ? colorWithAlpha(color, clampOpacity(opacity)) : 'rgba(0,0,0,0)',
    dashedValue: lineDashForStyle(lineStyle),
    size: clampLineWidth(lineWidth),
    smooth: false,
    style: klineLineTypeForStyle(lineStyle),
  } as any
}

function createVwapLineFigures() {
  return [
    { key: 'vwap', title: 'VWAP: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeVwapSettings(indicator.calcParams[0] as VwapCalcSettings)
      return createLineFigureStyle(settings.vwapColor, settings.vwapVisible, settings.vwapLineStyle, settings.vwapLineWidth, settings.vwapOpacity)
    } },
    { key: 'upperBand1', title: 'Upper Band #1: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeVwapSettings(indicator.calcParams[0] as VwapCalcSettings)
      return createLineFigureStyle(settings.band1UpperColor, settings.band1Visible && settings.band1UpperVisible, settings.band1UpperLineStyle, settings.band1UpperLineWidth, settings.band1UpperOpacity)
    } },
    { key: 'lowerBand1', title: 'Lower Band #1: ', type: 'line', styles: (_data: unknown, indicator: { calcParams: unknown[] }) => {
      const settings = normalizeVwapSettings(indicator.calcParams[0] as VwapCalcSettings)
      return createLineFigureStyle(settings.band1LowerColor, settings.band1Visible && settings.band1LowerVisible, settings.band1LowerLineStyle, settings.band1LowerLineWidth, settings.band1LowerOpacity)
    } },
  ]
}

function readIndicatorInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readIndicatorValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function resolveTooltipIndex(params: IndicatorCreateTooltipDataSourceParams<VwapIndicatorRow>) {
  const crosshairIndex = Number(params.crosshair.dataIndex)
  if (Number.isFinite(crosshairIndex) && crosshairIndex >= 0) {
    return Math.min(Math.round(crosshairIndex), Math.max(0, params.indicator.result.length - 1))
  }
  return Math.max(0, Math.min(Math.floor(params.visibleRange.realTo), params.indicator.result.length - 1))
}

function formatVwapValue(value: number | undefined, precision: VwapIndicatorSettings['precision']) {
  if (!Number.isFinite(value)) return '--'
  const digits = precision === 'system' ? 3 : Number(precision)
  return (value as number).toFixed(Number.isFinite(digits) ? digits : 3).replace(/\.?0+$/, '')
}

function isCryptoSymbol(symbol: string) {
  const normalized = symbol.toUpperCase()
  return /^(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)/.test(normalized)
    || /(^|[^A-Z])(BTC|ETH|SOL|XRP|BNB|ADA|DOGE|LTC|BCH|DOT|AVAX|TRX|LINK)([^A-Z]|$)/.test(normalized)
}

function resolveSessionAnchorHourUtc(symbol?: string) {
  return symbol && isCryptoSymbol(symbol) ? 0 : 22
}

function resolveAnchorKey(timestampMs: number, anchorPeriod: VwapAnchorPeriod, symbol?: string) {
  const anchorHourUtc = anchorPeriod === 'session' ? resolveSessionAnchorHourUtc(symbol) : 0
  const anchorMs = anchorHourUtc * 60 * 60 * 1000
  const anchoredTimestampMs = timestampMs - anchorMs
  const date = new Date(anchoredTimestampMs)
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const day = Math.floor(anchoredTimestampMs / (24 * 60 * 60 * 1000))

  if (anchorPeriod === 'week') return Math.floor((day + 4) / 7)
  if (anchorPeriod === 'month') return year * 12 + month
  if (anchorPeriod === 'quarter') return year * 4 + Math.floor(month / 3)
  if (anchorPeriod === 'year') return year
  if (anchorPeriod === 'decade') return Math.floor(year / 10)
  if (anchorPeriod === 'century') return Math.floor(year / 100)
  return day
}

function resolveRealTimestampMs(data: KLineData) {
  const row = data as KLineData & {
    realTime?: number
    realTimestamp?: number
    sourceTimestamp?: number
  }
  const raw = typeof row.realTime === 'number'
    ? row.realTime
    : typeof row.realTimestamp === 'number'
      ? row.realTimestamp
      : typeof row.sourceTimestamp === 'number'
        ? row.sourceTimestamp
        : data.timestamp
  return raw < 1_000_000_000_000 ? raw * 1000 : raw
}

function calculateSourceValue(row: KLineData, source: VwapSource) {
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
    case 'close':
      return close
    case 'hl2':
      return Number.isFinite(high) && Number.isFinite(low) ? (high + low) / 2 : Number.NaN
    case 'ohlc4':
      return Number.isFinite(open) && Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
        ? (open + high + low + close) / 4
        : Number.NaN
    default:
      return Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
        ? (high + low + close) / 3
        : Number.NaN
  }
}

function readVolume(row: KLineData) {
  const source = row as KLineData & {
    realVolume?: number
    real_volume?: number
    tickVolume?: number
    tick_volume?: number
    vol?: number
    Volume?: number
  }
  const value = Number(source.volume ?? source.tick_volume ?? source.tickVolume ?? source.real_volume ?? source.realVolume ?? source.vol ?? source.Volume)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function calculateTradingViewVwapRows(dataList: KLineData[], inputSettings?: VwapCalcSettings): VwapIndicatorRow[] {
  const settings = normalizeVwapSettings(inputSettings)
  const symbol = typeof inputSettings?.symbol === 'string' ? inputSettings.symbol : undefined
  const calculatedRows: VwapIndicatorRow[] = []
  let currentSessionKey: number | null = null
  let cumulativePriceVolume = 0
  let cumulativePriceSquaredVolume = 0
  let cumulativeVolume = 0

  for (const row of dataList) {
    const sessionKey = resolveAnchorKey(resolveRealTimestampMs(row), settings.anchorPeriod, symbol)
    if (currentSessionKey !== sessionKey) {
      currentSessionKey = sessionKey
      cumulativePriceVolume = 0
      cumulativePriceSquaredVolume = 0
      cumulativeVolume = 0
    }

    const source = calculateSourceValue(row, settings.source)
    const volume = readVolume(row)
    if (Number.isFinite(source) && volume > 0) {
      cumulativePriceVolume += source * volume
      cumulativePriceSquaredVolume += source * source * volume
      cumulativeVolume += volume
    }

    if (cumulativeVolume > 0) {
      const vwap = cumulativePriceVolume / cumulativeVolume
      const variance = Math.max(0, cumulativePriceSquaredVolume / cumulativeVolume - vwap * vwap)
      const bandDistance = settings.bandCalculationMode === 'percentage'
        ? Math.abs(vwap * settings.band1Multiplier / 100)
        : Math.sqrt(variance) * settings.band1Multiplier
      calculatedRows.push({ lowerBand1: vwap - bandDistance, upperBand1: vwap + bandDistance, vwap })
    } else {
      calculatedRows.push({})
    }
  }

  if (settings.offset === 0) return calculatedRows

  const rows: VwapIndicatorRow[] = dataList.map(() => ({}))
  calculatedRows.forEach((row, index) => {
    const targetIndex = index + settings.offset
    if (targetIndex >= 0 && targetIndex < rows.length) rows[targetIndex] = row
  })
  return rows
}

export function ensureTradingViewVwapIndicator() {
  if (registered) return
  registered = true

  registerIndicator<VwapIndicatorRow>({
    name: 'VWAP',
    shortName: 'VWAP',
    series: IndicatorSeries.Price,
    precision: 2,
    figures: createVwapLineFigures(),
    regenerateFigures: createVwapLineFigures,
    createTooltipDataSource: (params) => {
      const settings = normalizeVwapSettings(params.indicator.calcParams[0] as VwapCalcSettings)
      const row = params.indicator.result[resolveTooltipIndex(params)]
      const inputsText = settings.inputsInStatusLine && readIndicatorInputsVisible()
        ? ` ${settings.anchorPeriod} ${settings.source}`
        : ''
      const values = []

      if (settings.statusLineValuesVisible && readIndicatorValuesVisible() && settings.vwapVisible) {
        values.push({
          title: { text: '', color: params.defaultStyles.tooltip.text.color },
          value: { text: formatVwapValue(row?.vwap, settings.precision), color: colorWithAlpha(settings.vwapColor, settings.vwapOpacity) },
        })
      }

      return {
        name: 'VWAP',
        calcParamsText: inputsText,
        icons: [],
        values,
      }
    },
    draw: ({ ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const settings = normalizeVwapSettings(indicator.calcParams[0] as VwapCalcSettings)
      if (!settings.band1Visible || !settings.band1FillVisible) return false

      const start = Math.max(0, Math.floor(visibleRange.from) - 1)
      const end = Math.min(indicator.result.length - 1, Math.ceil(visibleRange.to) + 1)
      let started = false

      ctx.save()
      ctx.beginPath()

      for (let index = start; index <= end; index += 1) {
        const upper = indicator.result[index]?.upperBand1
        if (!Number.isFinite(upper)) {
          started = false
          continue
        }
        const x = xAxis.convertToPixel(index)
        const y = yAxis.convertToPixel(upper as number)
        if (!started) {
          ctx.moveTo(x, y)
          started = true
        } else {
          ctx.lineTo(x, y)
        }
      }

      for (let index = end; index >= start; index -= 1) {
        const lower = indicator.result[index]?.lowerBand1
        if (!Number.isFinite(lower)) continue
        ctx.lineTo(xAxis.convertToPixel(index), yAxis.convertToPixel(lower as number))
      }

      ctx.closePath()
      ctx.fillStyle = colorWithAlpha(settings.band1FillColor, settings.band1FillOpacity)
      ctx.fill()
      ctx.restore()
      return false
    },
    calc: (dataList, indicator) => calculateWithoutFuturePlaceholders(
      dataList,
      (realRows) => calculateTradingViewVwapRows(realRows, indicator.calcParams[0] as VwapCalcSettings | undefined),
    ),
  })
}
