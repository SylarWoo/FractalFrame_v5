import { beforeEach, describe, expect, it } from 'vitest'
import type { StoreV6RealtimePageWindow } from '../realtimePageWindowV2'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import { clearRealtimeIndicatorStableCacheV2, refreshRealtimeWindowIndicatorsWithStableCacheV2 } from './realtimeIndicatorStableCacheV2'
import {
  storeV6MorganRangeM5IndicatorDefinitionV2,
  storeV6MorganRangeM5IndicatorIdV2,
  storeV6MorganRangeM5RequestIdV2,
  storeV6MorganRangeM30IndicatorDefinitionV2,
  storeV6MorganRangeM30IndicatorIdV2,
  storeV6MorganRangeM30RequestIdV2,
  storeV6MorganRangeH2IndicatorDefinitionV2,
  storeV6MorganRangeH2IndicatorIdV2,
  storeV6MorganRangeH2RequestIdV2,
} from './morganRangeIndicatorV2'
import { storeV6MaIndicatorDefinitionV2, storeV6MaIndicatorIdV2 } from './maIndicatorV2'
import { storeV6StochIndicatorDefinitionV2, storeV6StochIndicatorIdV2 } from './stochIndicatorV2'
import { storeV6TsiIndicatorDefinitionV2, storeV6TsiIndicatorIdV2 } from './tsiIndicatorV2'
import { storeV6VdoIndicatorDefinitionV2, storeV6VdoIndicatorIdV2 } from './vdoIndicatorV2'
import { storeV6VmiIndicatorDefinitionV2, storeV6VmiIndicatorIdV2 } from './vmiIndicatorV2'

function kline(time: number, close: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close,
    globalIndex: null,
    high: close,
    low: close,
    open: close,
    period: 'M5',
    source: 'mt5-realtime-window-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: close,
  }
}

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

function m5RowsBetween(from: number, to: number) {
  return rowsBetweenStep(from, to, 5 * 60, 'M5')
}

function m30RowsBetween(from: number, to: number) {
  return rowsBetweenStep(from, to, 30 * 60, 'M30')
}

function h2RowsBetween(from: number, to: number) {
  return rowsBetweenStep(from, to, 2 * 60 * 60, 'H2')
}

function rowsBetweenStep(from: number, to: number, stepSeconds: number, period: string) {
  const rows: StoreV6WindowKLine[] = []
  for (let time = from, index = 0; time <= to; time += stepSeconds, index += 1) {
    rows.push({
      ...kline(time, 4300 + index * 0.1 + Math.sin(index / 5)),
      barKey: `XAUUSDm|${period}|${time}`,
      period,
    })
  }
  return rows
}

function windowFromRows(rows: StoreV6WindowKLine[]): StoreV6RealtimePageWindow {
  const stableRows = rows.slice(0, -1)
  const tailRow = rows[rows.length - 1] ?? null
  return {
    activeRows: rows,
    indicatorRequests: [{ id: 'TEST' }],
    indicators: {},
    key: `realtime:${rows.map((row) => `${row.time}:${row.close}`).join(',')}`,
    period: 'M5',
    renderData: {
      indicators: {},
      klineRows: rows,
    },
    sessionTimeFrom: 100,
    sessionTimeTo: null,
    source: 'store-v6-realtime-page-window-v2',
    stableRows,
    status: rows.length ? 'ready' : 'closed-empty',
    symbol: 'XAUUSDm',
    tailRow,
  }
}

describe('refreshRealtimeWindowIndicatorsWithStableCacheV2', () => {
  beforeEach(() => {
    clearRealtimeIndicatorStableCacheV2()
  })

  it('reuses stable indicator rows and recalculates only the tail row while stable rows are unchanged', async () => {
    const calls: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        calls.push(context.activeRows.length)
        return {
          TEST: {
            displayRows: context.activeRows.map((row) => ({ barKey: row.barKey, value: row.close })),
            key: `TEST:${context.activeRows.map((row) => row.time).join(',')}`,
            rows: context.activeRows.map((row) => ({ barKey: row.barKey, value: row.close })),
            source: 'test',
          },
        }
      },
      id: 'TEST',
    })

    const first = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      window: windowFromRows([kline(100, 1), kline(200, 2), kline(300, 3)]),
    })
    const second = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      window: windowFromRows([kline(100, 1), kline(200, 2), kline(300, 4)]),
    })

    expect(calls).toEqual([2, 1, 1])
    expect(first.indicators.TEST.displayRows).toEqual([
      { barKey: 'XAUUSDm|M5|100', value: 1 },
      { barKey: 'XAUUSDm|M5|200', value: 2 },
      { barKey: 'XAUUSDm|M5|300', value: 3 },
    ])
    expect(second.indicators.TEST.displayRows).toEqual([
      { barKey: 'XAUUSDm|M5|100', value: 1 },
      { barKey: 'XAUUSDm|M5|200', value: 2 },
      { barKey: 'XAUUSDm|M5|300', value: 4 },
    ])
  })

  it('recalculates Morgan Range against the full active window when the tail is a bucket boundary', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        const first = context.activeRows[0]
        if (!first) {
          return {
            MR_M5: {
              displayRows: [],
              key: 'MR_M5:empty',
              rows: [],
              source: 'test',
            },
          }
        }
        return {
          MR_M5: {
            displayRows: [{
              atr7: 1,
              center: first.close,
              endIndex: Math.max(0, context.activeRows.length - 1),
              index: 1,
              levels: [],
              lower: first.close - 1,
              range: 1,
              startIndex: 0,
              startTimestamp: first.timestamp,
              trueRange: 1,
              upper: first.close + 1,
            }],
            key: `MR_M5:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'MR-M5',
    })

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      requests: [{ id: 'MR-M5' }],
      window: windowFromRows([kline(21_000, 1), kline(21_300, 2), kline(21_600, 3)]),
    })

    expect(next.indicators.MR_M5.displayRows).toEqual([
      expect.objectContaining({ endIndex: 2, startIndex: 0, startTimestamp: 21_000_000 }),
    ])
  })

  it('does not recalculate Morgan Range tail rows when the tail is not an H4 boundary', async () => {
    const calls: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        calls.push(context.activeRows.length)
        return {
          MR_M5: {
            displayRows: context.activeRows.length > 1 ? [{
              atr7: 1,
              center: 1,
              endIndex: context.activeRows.length - 1,
              index: 1,
              levels: [],
              lower: 0,
              range: 1,
              startIndex: 0,
              startTimestamp: context.activeRows[0]?.timestamp ?? 0,
              trueRange: 1,
              upper: 2,
            }] : [],
            key: `MR_M5:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'MR-M5',
    })

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0)],
      registry,
      requests: [{ id: 'MR-M5' }],
      window: windowFromRows([kline(21_000, 1), kline(21_300, 2), kline(21_900, 3)]),
    })

    expect(calls).toEqual([2])
    expect(next.indicators.MR_M5.displayRows).toEqual([
      expect.objectContaining({ endIndex: 1, startIndex: 0, startTimestamp: 21_000_000 }),
    ])
  })

  it('passes only the requested warmup tail context into tail indicator recalculation', async () => {
    const historyLengths: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        historyLengths.push(context.historyRows.length)
        return {
          TEST: {
            displayRows: context.activeRows.map((row) => ({ barKey: row.barKey, value: row.close })),
            key: `TEST:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'TEST',
      warmup: {
        mode: 'fixedRows',
        realtimeRows: 2,
      },
    })

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [kline(0, 0), kline(300, 1), kline(600, 2)],
      registry,
      window: windowFromRows([kline(900, 3), kline(1200, 4), kline(1500, 5), kline(1800, 6)]),
    })

    expect(historyLengths).toEqual([3, 2])
  })

  it('keeps stable realtime rows as VWAP tail context even though VWAP does not request StoreV6 warmup', async () => {
    const historyLengths: number[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: (context) => {
        historyLengths.push(context.historyRows.length)
        return {
          VWAP: {
            displayRows: context.activeRows.map((row) => ({ barKey: row.barKey, historyRows: context.historyRows.length })),
            key: `VWAP:${context.activeRows.length}`,
            rows: [],
            source: 'test',
          },
        }
      },
      id: 'VWAP',
      warmup: {
        mode: 'none',
        realtimeRows: 0,
      },
    })

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows: [],
      registry,
      requests: [{ id: 'VWAP' }],
      window: windowFromRows([kline(900, 3), kline(1200, 4), kline(1500, 5)]),
    })

    expect(historyLengths).toEqual([0, 2])
  })

  it('keeps the next MR-M5 H4 segment visible after the boundary row moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 8, 2, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const nextBucketStart = shanghaiSeconds(2026, 6, 9, 10, 0)
    const tail = shanghaiSeconds(2026, 6, 9, 10, 5)
    const allRows = m5RowsBetween(from, tail)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      window: {
        ...windowFromRows(activeRows),
        indicatorRequests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
        sessionTimeFrom: realtimeStart,
      },
    })

    const segmentRows = next.indicators[storeV6MorganRangeM5IndicatorIdV2].displayRows ?? []
    const nextSegmentIndex = segmentRows.findIndex((segment) => (
      Number((segment as { startTimestamp?: number }).startTimestamp) === nextBucketStart * 1000
    ))
    expect(nextSegmentIndex).toBeGreaterThanOrEqual(0)
    const nextSegment = segmentRows[nextSegmentIndex] as { startIndex: number }
    const previous = segmentRows[nextSegmentIndex - 1] as { endIndex: number } | undefined
    expect(previous?.endIndex).toBeLessThan(nextSegment.startIndex)
  })

  it('keeps the next MR-M30 D1 segment visible after the daily boundary row moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM30IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 5, 25, 6, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 8, 6, 0)
    const nextDayStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const tail = shanghaiSeconds(2026, 6, 9, 6, 30)
    const allRows = m30RowsBetween(from, tail)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: [{ id: storeV6MorganRangeM30RequestIdV2 }],
      window: {
        ...windowFromRows(activeRows),
        indicatorRequests: [{ id: storeV6MorganRangeM30RequestIdV2 }],
        period: 'M30',
        sessionTimeFrom: realtimeStart,
      },
    })

    const segmentRows = next.indicators[storeV6MorganRangeM30IndicatorIdV2].displayRows ?? []
    const nextSegmentIndex = segmentRows.findIndex((segment) => (
      Number((segment as { startTimestamp?: number }).startTimestamp) === nextDayStart * 1000
    ))
    expect(nextSegmentIndex).toBeGreaterThanOrEqual(0)
    const nextSegment = segmentRows[nextSegmentIndex] as { startIndex: number }
    const previous = segmentRows[nextSegmentIndex - 1] as { endIndex: number } | undefined
    expect(previous?.endIndex).toBeLessThan(nextSegment.startIndex)
  })

  it('creates the current MR-M30 D1 segment when the daily boundary row is the realtime tail', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM30IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 5, 25, 6, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 8, 6, 0)
    const currentDayStart = shanghaiSeconds(2026, 6, 10, 6, 0)
    const allRows = m30RowsBetween(from, currentDayStart)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: [{ id: storeV6MorganRangeM30RequestIdV2 }],
      window: {
        ...windowFromRows(activeRows),
        indicatorRequests: [{ id: storeV6MorganRangeM30RequestIdV2 }],
        period: 'M30',
        sessionTimeFrom: realtimeStart,
      },
    })

    const segmentRows = next.indicators[storeV6MorganRangeM30IndicatorIdV2].displayRows ?? []
    const currentSegmentIndex = segmentRows.findIndex((segment) => (
      Number((segment as { startTimestamp?: number }).startTimestamp) === currentDayStart * 1000
    ))
    expect(currentSegmentIndex).toBeGreaterThanOrEqual(0)
    const currentSegment = segmentRows[currentSegmentIndex] as { startIndex: number }
    const previous = segmentRows[currentSegmentIndex - 1] as { endIndex: number } | undefined
    expect(previous?.endIndex).toBeLessThan(currentSegment.startIndex)
  })

  it('creates the current MR-H2 D5 weekly segment when the weekly boundary row is the realtime tail', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeH2IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 1, 6, 0)
    const realtimeStart = shanghaiSeconds(2026, 7, 13, 6, 0)
    const currentD5Start = shanghaiSeconds(2026, 7, 20, 6, 0)
    const allRows = h2RowsBetween(from, currentD5Start)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const next = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: [{ id: storeV6MorganRangeH2RequestIdV2 }],
      window: {
        ...windowFromRows(activeRows),
        indicatorRequests: [{ id: storeV6MorganRangeH2RequestIdV2 }],
        period: 'H2',
        sessionTimeFrom: realtimeStart,
      },
    })

    const segmentRows = next.indicators[storeV6MorganRangeH2IndicatorIdV2].displayRows ?? []
    const currentSegmentIndex = segmentRows.findIndex((segment) => (
      Number((segment as { startTimestamp?: number }).startTimestamp) === currentD5Start * 1000
    ))
    expect(currentSegmentIndex).toBeGreaterThanOrEqual(0)
    const currentSegment = segmentRows[currentSegmentIndex] as { endIndex: number; startIndex: number }
    expect(currentSegment).toEqual(expect.objectContaining({
      endIndex: 143,
      startIndex: 84,
    }))
  })

  it('matches direct realtime VDO results after the closing tail moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VdoIndicatorDefinitionV2)
    const settings = { emaSmoothing: 3, length: 5, vdoMa2Length: 4, vdoMaLength: 3 }
    const historyRows = Array.from({ length: 12 }, (_, index) => kline((index + 1) * 300, 100 + index))
    const firstActiveRows = [
      kline(3_900, 113),
      kline(4_200, 114),
      kline(4_500, 115),
    ]
    const secondActiveRows = [
      kline(3_900, 113),
      kline(4_200, 114),
      kline(4_500, 115),
      kline(4_800, 116),
    ]
    const firstWindow = {
      ...windowFromRows(firstActiveRows),
      indicatorRequests: [{ id: 'VDO', params: settings }],
      sessionTimeFrom: firstActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow
    const secondWindow = {
      ...windowFromRows(secondActiveRows),
      indicatorRequests: [{ id: 'VDO', params: settings }],
      sessionTimeFrom: secondActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: firstWindow.indicatorRequests,
      window: firstWindow,
    })
    const settled = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: secondWindow.indicatorRequests,
      window: secondWindow,
    })
    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: secondActiveRows,
      historyRows,
      period: 'M5',
      registry,
      requests: secondWindow.indicatorRequests,
      sessionTimeFrom: secondWindow.sessionTimeFrom,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(settled.indicators[storeV6VdoIndicatorIdV2].displayRows).toEqual(direct[storeV6VdoIndicatorIdV2].displayRows)
  })

  it('matches direct realtime VMI results after the closing tail moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VmiIndicatorDefinitionV2)
    const settings = { fastLength: 5, slowLength: 8 }
    const historyRows = Array.from({ length: 16 }, (_, index) => kline((index + 1) * 300, 120 + Math.sin(index)))
    const firstActiveRows = [
      kline(5_100, 131),
      kline(5_400, 132),
      kline(5_700, 130),
    ]
    const secondActiveRows = [
      kline(5_100, 131),
      kline(5_400, 132),
      kline(5_700, 130),
      kline(6_000, 133),
    ]
    const firstWindow = {
      ...windowFromRows(firstActiveRows),
      indicatorRequests: [{ id: 'VMI', params: settings }],
      sessionTimeFrom: firstActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow
    const secondWindow = {
      ...windowFromRows(secondActiveRows),
      indicatorRequests: [{ id: 'VMI', params: settings }],
      sessionTimeFrom: secondActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: firstWindow.indicatorRequests,
      window: firstWindow,
    })
    const settled = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: secondWindow.indicatorRequests,
      window: secondWindow,
    })
    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: secondActiveRows,
      historyRows,
      period: 'M5',
      registry,
      requests: secondWindow.indicatorRequests,
      sessionTimeFrom: secondWindow.sessionTimeFrom,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(settled.indicators[storeV6VmiIndicatorIdV2].displayRows).toEqual(direct[storeV6VmiIndicatorIdV2].displayRows)
  })

  it('matches direct realtime MA results after the closing tail moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MaIndicatorDefinitionV2)
    const settings = { length: 5, shiftLength: 2, type: 'sma' }
    const historyRows = Array.from({ length: 12 }, (_, index) => kline((index + 1) * 300, 100 + index))
    const firstActiveRows = [
      kline(3_900, 113),
      kline(4_200, 114),
      kline(4_500, 115),
    ]
    const secondActiveRows = [
      kline(3_900, 113),
      kline(4_200, 114),
      kline(4_500, 115),
      kline(4_800, 116),
    ]
    const firstWindow = {
      ...windowFromRows(firstActiveRows),
      indicatorRequests: [{ id: 'MA', params: settings }],
      sessionTimeFrom: firstActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow
    const secondWindow = {
      ...windowFromRows(secondActiveRows),
      indicatorRequests: [{ id: 'MA', params: settings }],
      sessionTimeFrom: secondActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: firstWindow.indicatorRequests,
      window: firstWindow,
    })
    const settled = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: secondWindow.indicatorRequests,
      window: secondWindow,
    })
    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: secondActiveRows,
      historyRows,
      period: 'M5',
      registry,
      requests: secondWindow.indicatorRequests,
      sessionTimeFrom: secondWindow.sessionTimeFrom,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(settled.indicators[storeV6MaIndicatorIdV2].displayRows).toEqual(direct[storeV6MaIndicatorIdV2].displayRows)
  })

  it('matches direct realtime TSI results after the closing tail moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6TsiIndicatorDefinitionV2)
    const settings = { longLength: 5, shortLength: 3, signalLength: 2 }
    const historyRows = Array.from({ length: 12 }, (_, index) => kline((index + 1) * 300, 110 + index))
    const firstActiveRows = [
      kline(3_900, 123),
      kline(4_200, 124),
      kline(4_500, 125),
    ]
    const secondActiveRows = [
      kline(3_900, 123),
      kline(4_200, 124),
      kline(4_500, 125),
      kline(4_800, 126),
    ]
    const firstWindow = {
      ...windowFromRows(firstActiveRows),
      indicatorRequests: [{ id: 'TSI', params: settings }],
      sessionTimeFrom: firstActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow
    const secondWindow = {
      ...windowFromRows(secondActiveRows),
      indicatorRequests: [{ id: 'TSI', params: settings }],
      sessionTimeFrom: secondActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: firstWindow.indicatorRequests,
      window: firstWindow,
    })
    const settled = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: secondWindow.indicatorRequests,
      window: secondWindow,
    })
    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: secondActiveRows,
      historyRows,
      period: 'M5',
      registry,
      requests: secondWindow.indicatorRequests,
      sessionTimeFrom: secondWindow.sessionTimeFrom,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(settled.indicators[storeV6TsiIndicatorIdV2].displayRows).toEqual(direct[storeV6TsiIndicatorIdV2].displayRows)
  })

  it('matches direct realtime STOCH results after the closing tail moves into stable realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6StochIndicatorDefinitionV2)
    const settings = { dSmoothing: 3, kSmoothing: 2, length: 5 }
    const historyRows = Array.from({ length: 12 }, (_, index) => kline((index + 1) * 300, 130 + index))
    const firstActiveRows = [
      kline(3_900, 143),
      kline(4_200, 144),
      kline(4_500, 145),
    ]
    const secondActiveRows = [
      kline(3_900, 143),
      kline(4_200, 144),
      kline(4_500, 145),
      kline(4_800, 146),
    ]
    const firstWindow = {
      ...windowFromRows(firstActiveRows),
      indicatorRequests: [{ id: 'STOCH', params: settings }],
      sessionTimeFrom: firstActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow
    const secondWindow = {
      ...windowFromRows(secondActiveRows),
      indicatorRequests: [{ id: 'STOCH', params: settings }],
      sessionTimeFrom: secondActiveRows[0].time,
    } satisfies StoreV6RealtimePageWindow

    await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: firstWindow.indicatorRequests,
      window: firstWindow,
    })
    const settled = await refreshRealtimeWindowIndicatorsWithStableCacheV2({
      historyRows,
      registry,
      requests: secondWindow.indicatorRequests,
      window: secondWindow,
    })
    const direct = await requestRealtimeWindowIndicatorsV2({
      activeRows: secondActiveRows,
      historyRows,
      period: 'M5',
      registry,
      requests: secondWindow.indicatorRequests,
      sessionTimeFrom: secondWindow.sessionTimeFrom,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(settled.indicators[storeV6StochIndicatorIdV2].displayRows).toEqual(direct[storeV6StochIndicatorIdV2].displayRows)
  })
})
