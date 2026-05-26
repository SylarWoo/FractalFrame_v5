import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import {
  calculateCoreIndicatorRows,
  calculateDpoIndicatorRows,
  calculateMaIndicatorRows,
  calculateStochIndicatorRows,
  calculateVdoIndicatorRows,
  getCoreIndicatorRowAtIndex,
  getLatestCoreIndicatorRow,
} from './coreIndicatorData'

function createRows(count: number): KLineData[] {
  const start = Date.UTC(2026, 0, 1, 22, 0, 0)
  return Array.from({ length: count }, (_, index) => {
    const base = 2600 + Math.sin(index / 3) * 8 + index * 0.35
    return {
      close: base + Math.sin(index / 2),
      high: base + 4,
      low: base - 4,
      open: base - 1,
      timestamp: start + index * 60 * 60 * 1000,
      volume: 100 + index,
    }
  })
}

describe('coreIndicatorData', () => {
  it('calculates the five callable core indicator data sources', () => {
    const dataList = createRows(80)
    const rows = calculateCoreIndicatorRows(dataList, {
      DPO: { length: 14 },
      MA: { length: 10 },
      Stoch: { length: 14 },
      VDO: { length: 14 },
    }, { morganFutureBars: 4 })

    expect(rows.stoch).toHaveLength(dataList.length)
    expect(rows.ma).toHaveLength(dataList.length)
    expect(rows.dpo).toHaveLength(dataList.length)
    expect(rows.vdo).toHaveLength(dataList.length)
    expect(rows.mr.length).toBeGreaterThan(0)
    expect(rows.stoch.some((row) => Number.isFinite(row.k) || Number.isFinite(row.d))).toBe(true)
    expect(rows.ma.some((row) => Number.isFinite(row.ma))).toBe(true)
    expect(rows.dpo.some((row) => Number.isFinite(row.dpo))).toBe(true)
    expect(rows.vdo.some((row) => Number.isFinite(row.vdo))).toBe(true)
  })

  it('keeps single-indicator helpers aligned with the bundle', () => {
    const dataList = createRows(60)
    const rows = calculateCoreIndicatorRows(dataList)

    expect(calculateStochIndicatorRows(dataList)).toEqual(rows.stoch)
    expect(calculateMaIndicatorRows(dataList)).toEqual(rows.ma)
    expect(calculateDpoIndicatorRows(dataList)).toEqual(rows.dpo)
    expect(calculateVdoIndicatorRows(dataList)).toEqual(rows.vdo)
  })

  it('returns a stable row snapshot for aggregate indicators', () => {
    const dataList = createRows(80)
    const rows = calculateCoreIndicatorRows(dataList, {}, { morganFutureBars: 4 })
    const row = getCoreIndicatorRowAtIndex(rows, dataList, 30)
    const latest = getLatestCoreIndicatorRow(rows, dataList)

    expect(row.dataIndex).toBe(30)
    expect(row.data).toBe(dataList[30])
    expect(row.stoch).toBe(rows.stoch[30])
    expect(row.ma).toBe(rows.ma[30])
    expect(row.dpo).toBe(rows.dpo[30])
    expect(row.vdo).toBe(rows.vdo[30])
    expect(latest.dataIndex).toBe(dataList.length - 1)
  })
})
