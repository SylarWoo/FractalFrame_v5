import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewMmadRows } from '../tradingViewMmadIndicator'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'
import { requestHistoryWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import {
  storeV6MmadIndicatorDefinitionV2,
  storeV6MmadIndicatorIdV2,
  storeV6MmadPaneIdV2,
} from './mmadIndicatorV2'
import type { StoreV6MmadIndicatorRowV2 } from './mmadIndicatorV2'

function kline(time: number, close: number, index: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close,
    globalIndex: index,
    high: close + 1,
    low: close - 1,
    open: close,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    tradingDay: '2026-06-12',
    volume: index % 13 === 0 ? 100 : 10,
  }
}

function toKLineData(row: StoreV6WindowKLine) {
  return {
    barKey: row.barKey,
    close: row.close,
    high: row.high,
    low: row.low,
    open: row.open,
    period: row.period,
    sessionId: row.sessionId,
    symbol: row.symbol,
    time: row.time,
    timestamp: row.timestamp,
    tradingDay: row.tradingDay,
    volume: row.volume,
  }
}

describe('storeV6MmadIndicatorDefinitionV2', () => {
  it('requests enough warmup rows for the selected Morgan anchor window', () => {
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6MmadIndicatorDefinitionV2,
      request: { id: storeV6MmadIndicatorIdV2, params: { timeframe: '5m' } },
      windowKind: 'history',
    })).toMatchObject({
      mode: 'fixedRows',
      requiredRows: 320,
    })
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6MmadIndicatorDefinitionV2,
      request: { id: storeV6MmadIndicatorIdV2, params: { timeframe: '30m' } },
      windowKind: 'history',
    }).requiredRows).toBeGreaterThan(2000)
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6MmadIndicatorDefinitionV2,
      request: { id: storeV6MmadIndicatorIdV2, params: { timeframe: '2h' } },
      windowKind: 'history',
    }).requiredRows).toBeGreaterThan(9000)
  })

  it('calculates history MMAD from the full calculation window and displays only page rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MmadIndicatorDefinitionV2)
    const calculationRows = Array.from({ length: 430 }, (_, index) => kline(1_000 + index * 300, 4200 + (index % 17), index))
    const displayRows = calculationRows.slice(-2)

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 428,
        actualTimeFrom: displayRows[0].time,
        actualTimeTo: displayRows[1].time,
        actualToGlobalIndex: 429,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: displayRows[0].time,
        requestedTimeTo: displayRows[1].time,
        requestedToGlobalIndex: null,
      },
      calculationRows,
      displayOffset: 428,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MmadIndicatorIdV2, params: { timeframe: '5m' } }],
      symbol: 'XAUUSDm',
      warmupRows: calculationRows.slice(0, -2),
    })

    const expected = calculateTradingViewMmadRows(calculationRows.map(toKLineData), { timeframe: '5m', period: 'M5', symbol: 'XAUUSDm' }).slice(-2)
    expect(indicators[storeV6MmadIndicatorIdV2]).toMatchObject({
      id: storeV6MmadIndicatorIdV2,
      paneId: storeV6MmadPaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
    })
    expect(indicators[storeV6MmadIndicatorIdV2].displayRows).toEqual([
      expect.objectContaining({ barKey: displayRows[0].barKey, value: expected[0].value }),
      expect.objectContaining({ barKey: displayRows[1].barKey, value: expected[1].value }),
    ])
    const actualRows = indicators[storeV6MmadIndicatorIdV2].displayRows as StoreV6MmadIndicatorRowV2[] | undefined
    expect(actualRows?.[0]?.value).not.toBeCloseTo(displayRows[0].close, 8)
  })
})
