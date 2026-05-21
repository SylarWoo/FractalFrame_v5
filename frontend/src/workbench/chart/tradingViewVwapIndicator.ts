import { IndicatorSeries, LineType, registerIndicator } from 'klinecharts'
import type { KLineData } from 'klinecharts'

type VwapIndicatorRow = {
  vwap?: number
}

let registered = false

function resolveSessionDayKey(timestampMs: number) {
  const timestampSeconds = Math.floor(timestampMs / 1000)
  return Math.floor(timestampSeconds / (24 * 60 * 60))
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

function calculateHlc3(row: KLineData) {
  const high = Number(row.high)
  const low = Number(row.low)
  const close = Number(row.close)
  return Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)
    ? (high + low + close) / 3
    : Number.NaN
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

export function calculateTradingViewVwapRows(dataList: KLineData[]): VwapIndicatorRow[] {
  const rows: VwapIndicatorRow[] = []
  let currentSessionKey: number | null = null
  let cumulativePriceVolume = 0
  let cumulativeVolume = 0

  for (const row of dataList) {
    const sessionKey = resolveSessionDayKey(resolveRealTimestampMs(row))
    if (currentSessionKey !== sessionKey) {
      currentSessionKey = sessionKey
      cumulativePriceVolume = 0
      cumulativeVolume = 0
    }

    const source = calculateHlc3(row)
    const volume = readVolume(row)
    if (Number.isFinite(source) && volume > 0) {
      cumulativePriceVolume += source * volume
      cumulativeVolume += volume
    }

    rows.push(cumulativeVolume > 0 ? { vwap: cumulativePriceVolume / cumulativeVolume } : {})
  }

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
    figures: [
      {
        key: 'vwap',
        title: 'VWAP: ',
        type: 'line',
        styles: () => ({
          color: '#ff9800',
          dashedValue: [2, 2],
          size: 1,
          smooth: false,
          style: LineType.Solid,
        }) as any,
      },
    ],
    calc: (dataList) => calculateTradingViewVwapRows(dataList),
  })
}
