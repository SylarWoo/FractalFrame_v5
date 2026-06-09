import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import {
  storeV6MorganRangeM5IndicatorDefinitionV2,
  storeV6MorganRangeM5IndicatorIdV2,
  storeV6MorganRangeM5PaneIdV2,
  storeV6MorganRangeM5RequestIdV2,
} from './morganRangeIndicatorV2'

const fiveMinutes = 5 * 60

function shanghaiSeconds(year: number, month: number, day: number, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, hour - 8, minute) / 1000
}

function kline(time: number, index: number): StoreV6WindowKLine {
  const wave = Math.sin(index / 7) * 2
  const base = 4300 + index * 0.05 + wave
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: base + 0.2,
    globalIndex: index,
    high: base + 1.5,
    low: base - 1.2,
    open: base,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 100 + index,
  }
}

function rows(count: number) {
  const start = 1_780_000_000
  return Array.from({ length: count }, (_, index) => kline(start + index * fiveMinutes, index))
}

function rowsBetween(from: number, to: number) {
  const rows: StoreV6WindowKLine[] = []
  for (let time = from, index = 0; time <= to; time += fiveMinutes, index += 1) {
    rows.push(kline(time, index))
  }
  return rows
}

describe('storeV6MorganRangeM5IndicatorDefinitionV2', () => {
  it('calculates MR-M5 history segments from warmed calculation rows and exposes a main overlay pane', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const calculationRows = rows(10 * 48)
    const displayRows = calculationRows.slice(-96)

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: displayRows[0].globalIndex,
        actualTimeFrom: displayRows[0].time,
        actualTimeTo: displayRows[displayRows.length - 1].time,
        actualToGlobalIndex: displayRows[displayRows.length - 1].globalIndex,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: displayRows[0].time,
        requestedTimeTo: displayRows[displayRows.length - 1].time,
        requestedToGlobalIndex: null,
      },
      calculationRows,
      displayOffset: calculationRows.length - displayRows.length,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      symbol: 'XAUUSDm',
      warmupRows: calculationRows.slice(0, calculationRows.length - displayRows.length),
    })

    const pane = indicators[storeV6MorganRangeM5IndicatorIdV2]
    expect(pane).toMatchObject({
      id: storeV6MorganRangeM5RequestIdV2,
      paneId: storeV6MorganRangeM5PaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
    })
    const segmentRows = pane.displayRows ?? []
    expect(segmentRows.length).toBeGreaterThan(0)
    expect(segmentRows[0]).toEqual(expect.objectContaining({
      center: expect.any(Number),
      endIndex: expect.any(Number),
      startIndex: expect.any(Number),
      startTimestamp: expect.any(Number),
    }))
  })

  it('calculates MR-M5 realtime segments against historical context without creating per-candle rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const allRows = rows(10 * 48)
    const historyRows = allRows.slice(0, -48)
    const activeRows = allRows.slice(-48)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      sessionTimeFrom: activeRows[0].time,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const pane = indicators[storeV6MorganRangeM5IndicatorIdV2]
    const segmentRows = pane.displayRows ?? []
    expect(segmentRows.length).toBeGreaterThan(0)
    expect(segmentRows.length).toBeLessThan(activeRows.length)
    expect(segmentRows[0]).toEqual(expect.objectContaining({
      levels: expect.any(Array),
      upper: expect.any(Number),
      lower: expect.any(Number),
    }))
  })

  it('extends the current realtime H4 segment across the next four hours once the new bucket opens', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 8, 2, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 9, 10, 0)
    const allRows = rowsBetween(from, realtimeStart)
    const historyRows = allRows.slice(0, -1)
    const activeRows = allRows.slice(-1)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      sessionTimeFrom: realtimeStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const segmentRows = indicators[storeV6MorganRangeM5IndicatorIdV2].displayRows ?? []
    expect(segmentRows[0]).toEqual(expect.objectContaining({
      startIndex: 0,
      startTimestamp: realtimeStart * 1000,
    }))
    expect((segmentRows[0] as { endIndex: number }).endIndex).toBeGreaterThanOrEqual(47)
  })

  it('does not let the previous realtime H4 segment bleed into the next MR segment', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 8, 2, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const nextBucketStart = shanghaiSeconds(2026, 6, 9, 10, 0)
    const allRows = rowsBetween(from, nextBucketStart)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      sessionTimeFrom: realtimeStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const segmentRows = indicators[storeV6MorganRangeM5IndicatorIdV2].displayRows ?? []
    const previous = segmentRows.find((segment) => Number((segment as { startTimestamp?: number }).startTimestamp) === realtimeStart * 1000) as { endIndex: number; startIndex: number } | undefined
    const next = segmentRows.find((segment) => Number((segment as { startTimestamp?: number }).startTimestamp) === nextBucketStart * 1000) as { startIndex: number } | undefined

    expect(previous).toEqual(expect.objectContaining({ endIndex: 47, startIndex: 0 }))
    expect(next).toEqual(expect.objectContaining({ startIndex: 48 }))
    expect(previous!.endIndex).toBeLessThan(next!.startIndex)
  })

  it('does not create the next realtime MR segment while the closing M5 bar is still the tail row', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 8, 2, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const closingTail = shanghaiSeconds(2026, 6, 9, 9, 55)
    const nextBucketStart = shanghaiSeconds(2026, 6, 9, 10, 0)
    const allRows = rowsBetween(from, closingTail)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      sessionTimeFrom: realtimeStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const segmentRows = indicators[storeV6MorganRangeM5IndicatorIdV2].displayRows ?? []
    expect(segmentRows.some((segment) => Number((segment as { startTimestamp?: number }).startTimestamp) === nextBucketStart * 1000)).toBe(false)
  })

  it('does not create a fake MR segment from a single non-boundary realtime tail row', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 8, 2, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const closingTail = shanghaiSeconds(2026, 6, 9, 9, 55)
    const allRows = rowsBetween(from, closingTail)
    const historyRows = allRows.filter((row) => row.time < closingTail)
    const activeRows = allRows.filter((row) => row.time === closingTail)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      sessionTimeFrom: realtimeStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(indicators[storeV6MorganRangeM5IndicatorIdV2].displayRows ?? []).toEqual([])
  })

  it('creates the next realtime MR segment only after the closing M5 bar has moved into closed rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MorganRangeM5IndicatorDefinitionV2)
    const from = shanghaiSeconds(2026, 6, 8, 2, 0)
    const realtimeStart = shanghaiSeconds(2026, 6, 9, 6, 0)
    const nextBucketStart = shanghaiSeconds(2026, 6, 9, 10, 0)
    const allRows = rowsBetween(from, nextBucketStart)
    const historyRows = allRows.filter((row) => row.time < realtimeStart)
    const activeRows = allRows.filter((row) => row.time >= realtimeStart)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MorganRangeM5RequestIdV2 }],
      sessionTimeFrom: realtimeStart,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const segmentRows = indicators[storeV6MorganRangeM5IndicatorIdV2].displayRows ?? []
    expect(segmentRows.some((segment) => Number((segment as { startTimestamp?: number }).startTimestamp) === nextBucketStart * 1000)).toBe(true)
  })
})
