import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { calculateTradingViewMmadRows } from './tradingViewMmadIndicator'

function formatTradingDay(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function row(timestamp: number, close: number, volume = 10, tradingDay = formatTradingDay(timestamp)): KLineData {
  return {
    close,
    high: close + 1,
    low: close - 1,
    open: close,
    symbol: 'XAUUSDm',
    timestamp,
    tradingDay,
    volume,
  } as KLineData
}

function buildRows(count: number, startTimestamp = Date.UTC(2026, 5, 1, 22, 0), stepMs = 5 * 60 * 1000) {
  return Array.from({ length: count }, (_, index) => row(startTimestamp + index * stepMs, 4200 + (index % 5), 10))
}

describe('calculateTradingViewMmadRows', () => {
  it('maps the volume-weighted Morgan position back to a price value', () => {
    const rows = buildRows(420)
    const result = calculateTradingViewMmadRows(rows, { timeframe: '5m' })
    const firstIndex = result.findIndex((item) => Number.isFinite(item.value))
    const first = result[firstIndex]

    expect(first?.mp).toBeGreaterThan(0)
    expect(first?.weightedMp).toBeCloseTo(first?.mp ?? 0, 8)
    expect(first?.volumeSum).toBe(10)
    expect(first?.value).toBeCloseTo(Number(rows[firstIndex].close), 8)
  })

  it('uses volume to weight the Morgan position before mapping it back to price', () => {
    const rows = buildRows(430).map((item, index) => ({
      ...item,
      close: index < 421 ? item.close : 4210 + (index - 421),
      volume: index === 421 ? 1000 : 10,
    })) as KLineData[]
    const result = calculateTradingViewMmadRows(rows, { timeframe: '5m' })
    const target = result[422]

    expect(target.weightedMp).toBeDefined()
    expect(Number.isFinite(target.value)).toBe(true)
    expect(Math.abs((target.value ?? 0) - Number(rows[422].close))).toBeGreaterThan(0.001)
  })

  it('calculates a VWAP-style standard deviation band around the MMAD price line', () => {
    const rows = buildRows(430).map((item, index) => ({
      ...item,
      close: 4200 + Math.sin(index / 6) * 8,
      volume: index % 3 === 0 ? 30 : 10,
    })) as KLineData[]
    const result = calculateTradingViewMmadRows(rows, { band1Multiplier: 1, timeframe: '5m' })
    const targetIndex = result.findIndex((item) => (
      Number.isFinite(item.value) &&
      Number.isFinite(item.upperBand1) &&
      Number.isFinite(item.lowerBand1) &&
      Math.abs((item.upperBand1 ?? 0) - (item.value ?? 0)) > 0.001
    ))
    const target = result[targetIndex]

    expect(target?.upperBand1).toBeGreaterThan(target?.value ?? 0)
    expect(target?.lowerBand1).toBeLessThan(target?.value ?? 0)

    const wider = calculateTradingViewMmadRows(rows, { band1Multiplier: 2, timeframe: '5m' })
    expect((wider[targetIndex].upperBand1 ?? 0) - (wider[targetIndex].value ?? 0)).toBeGreaterThan((target?.upperBand1 ?? 0) - (target?.value ?? 0))
  })

  it('rebases the accumulated price line when the Morgan segment changes inside the same M5 session', () => {
    const rows = buildRows(650, Date.UTC(2026, 5, 12, 22, 0), 5 * 60 * 1000).map((item, index) => ({
      ...item,
      close: 4200 + Math.floor(index / 48) * 8 + Math.sin(index / 4) * 2,
      high: 4204 + Math.floor(index / 48) * 8,
      low: 4196 + Math.floor(index / 48) * 8,
      tradingDay: '2026-06-12',
      volume: 10,
    })) as KLineData[]
    const result = calculateTradingViewMmadRows(rows, { timeframe: '5m', symbol: 'XAUUSDm' })
    const segmentChangeIndex = result.findIndex((item, index) => (
      index > 0 &&
      Number.isFinite(item.value) &&
      Number.isFinite(result[index - 1]?.value) &&
      item.segmentIndex !== result[index - 1]?.segmentIndex
    ))

    expect(segmentChangeIndex).toBeGreaterThan(0)
    expect(Math.abs((result[segmentChangeIndex].value ?? 0) - (result[segmentChangeIndex - 1].value ?? 0))).toBeLessThan(3)
  })

  it('resets M5 accumulation on the StoreV6 trading day boundary without connecting the line', () => {
    const rows = buildRows(460).map((item, index) => ({
      ...item,
      tradingDay: index < 420 ? '2026-06-09' : '2026-06-10',
    })) as KLineData[]
    const result = calculateTradingViewMmadRows(rows, { timeframe: '5m' })
    const resetRow = result[420]

    expect(resetRow.breakBefore).toBe(true)
    expect(resetRow.volumeSum).toBe(10)
    expect(resetRow.value).toBeCloseTo(Number(rows[420].close), 8)
  })

  it('keeps M5 realtime rows aligned when the tail row has no trading day metadata', () => {
    const rows = buildRows(520, Date.UTC(2026, 5, 8, 22, 0), 5 * 60 * 1000)
    const baseline = calculateTradingViewMmadRows(rows, { timeframe: '5m', symbol: 'XAUUSDm' })
    const targetIndex = baseline.findIndex((item, index) => (
      index > 0 &&
      Number.isFinite(baseline[index - 1]?.value) &&
      Number.isFinite(item.value)
    ))
    const realtimeRows = rows.map((item, index) => (
      index === targetIndex ? { ...item, tradingDay: undefined } as KLineData : item
    ))
    const realtime = calculateTradingViewMmadRows(realtimeRows, { timeframe: '5m', symbol: 'XAUUSDm' })

    expect(targetIndex).toBeGreaterThan(0)
    expect(realtime[targetIndex].value).toBeCloseTo(baseline[targetIndex].value ?? 0, 8)
  })

  it('resets M30 accumulation on the weekly anchor', () => {
    const rows = buildRows(1300, Date.UTC(2026, 5, 1, 22, 0), 30 * 60 * 1000)
    const result = calculateTradingViewMmadRows(rows, { timeframe: '30m' })
    const firstValidIndex = result.findIndex((item) => Number.isFinite(item.value))
    const firstNextWeekIndex = result.findIndex((item, index) => index > firstValidIndex + 48 && item.breakBefore === true)

    expect(firstNextWeekIndex).toBeGreaterThan(firstValidIndex)
    expect(result[firstNextWeekIndex].breakBefore).toBe(true)
    expect(new Date(Number(rows[firstNextWeekIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDay()).toBe(1)
    expect(result[firstNextWeekIndex].value).toBeCloseTo(Number(rows[firstNextWeekIndex].close), 8)
  })

  it('waits for the next Monday when M30 calculation starts mid-week', () => {
    const rows = buildRows(700, Date.UTC(2026, 5, 3, 22, 0), 30 * 60 * 1000)
    const result = calculateTradingViewMmadRows(rows, { timeframe: '30m' })
    const firstValidIndex = result.findIndex((item) => Number.isFinite(item.value))

    expect(firstValidIndex).toBeGreaterThan(0)
    expect(new Date(Number(rows[firstValidIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDay()).toBe(1)
    expect(result[firstValidIndex].value).toBeCloseTo(Number(rows[firstValidIndex].close), 8)
  })

  it('uses the real M30 Monday trading-week boundary instead of shifted tradingDay metadata', () => {
    const rows = buildRows(1200, Date.UTC(2026, 3, 19, 22, 0), 30 * 60 * 1000)
      .map((item) => ({
        ...item,
        tradingDay: '2026-05-05',
      })) as KLineData[]
    const result = calculateTradingViewMmadRows(rows, { timeframe: '30m', symbol: 'XAUUSDm' })
    const mondayOpenIndex = rows.findIndex((item) => Number(item.timestamp) === Date.UTC(2026, 4, 3, 22, 0))

    expect(mondayOpenIndex).toBeGreaterThan(0)
    expect(result[mondayOpenIndex].breakBefore).toBe(true)
    expect(new Date(Number(rows[mondayOpenIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDay()).toBe(1)
    expect(result[mondayOpenIndex].value).toBeCloseTo(Number(rows[mondayOpenIndex].close), 8)
  })

  it('resets H2 accumulation on the first Monday trading-week anchor of each month', () => {
    const rows = buildRows(1300, Date.UTC(2026, 4, 1, 22, 0), 2 * 60 * 60 * 1000)
    const result = calculateTradingViewMmadRows(rows, { timeframe: '2h' })
    const firstValidIndex = result.findIndex((item) => Number.isFinite(item.value))
    const firstNextMonthIndex = result.findIndex((item, index) => index > firstValidIndex + 12 * 10 && item.breakBefore === true)

    expect(new Date(Number(rows[firstValidIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDay()).toBe(1)
    expect(new Date(Number(rows[firstValidIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDate()).toBeLessThanOrEqual(7)
    expect(firstNextMonthIndex).toBeGreaterThan(firstValidIndex)
    expect(result[firstNextMonthIndex].breakBefore).toBe(true)
    expect(new Date(Number(rows[firstNextMonthIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDay()).toBe(1)
    expect(new Date(Number(rows[firstNextMonthIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDate()).toBeLessThanOrEqual(7)
    expect(result[firstNextMonthIndex].value).toBeCloseTo(Number(rows[firstNextMonthIndex].close), 8)
  })

  it('waits for the next first Monday when H2 calculation starts mid-month', () => {
    const rows = buildRows(1300, Date.UTC(2026, 5, 10, 22, 0), 2 * 60 * 60 * 1000)
    const result = calculateTradingViewMmadRows(rows, { timeframe: '2h' })
    const firstValidIndex = result.findIndex((item) => Number.isFinite(item.value))

    expect(firstValidIndex).toBeGreaterThan(0)
    expect(new Date(Number(rows[firstValidIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDay()).toBe(1)
    expect(new Date(Number(rows[firstValidIndex].timestamp) + 2 * 60 * 60 * 1000).getUTCDate()).toBeLessThanOrEqual(7)
    expect(result[firstValidIndex].value).toBeCloseTo(Number(rows[firstValidIndex].close), 8)
  })
})
