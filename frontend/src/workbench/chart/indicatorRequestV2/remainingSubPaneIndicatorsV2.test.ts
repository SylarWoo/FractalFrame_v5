import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewAoRows } from '../tradingViewAoIndicator'
import { calculateTradingViewDpoRows } from '../tradingViewDpoIndicator'
import { calculateTradingViewMacdRows } from '../tradingViewMacdIndicator'
import { calculateTradingViewRsiRows } from '../tradingViewRsiIndicator'
import { calculateTradingViewSqzmomRows } from '../tradingViewSqzmomIndicator'
import { calculateTradingViewViRows } from '../tradingViewViIndicator'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import {
  storeV6AoIndicatorDefinitionV2,
  storeV6AoIndicatorIdV2,
  storeV6DpoIndicatorDefinitionV2,
  storeV6DpoIndicatorIdV2,
  storeV6MacdIndicatorDefinitionV2,
  storeV6MacdIndicatorIdV2,
  storeV6RsiIndicatorDefinitionV2,
  storeV6RsiIndicatorIdV2,
  storeV6SqzmomIndicatorDefinitionV2,
  storeV6SqzmomIndicatorIdV2,
  storeV6ViIndicatorDefinitionV2,
  storeV6ViIndicatorIdV2,
  type StoreV6IndicatorDefinitionV2,
} from './index'

function kline(time: number, close: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close,
    globalIndex: time,
    high: close + 1,
    low: close - 1,
    open: close - 0.5,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    tradingDay: '2026-06-09',
    volume: close * 10,
  }
}

function toKLineData(row: StoreV6WindowKLine) {
  return {
    close: row.close,
    high: row.high,
    low: row.low,
    open: row.open,
    timestamp: row.timestamp,
    volume: row.volume,
  }
}

const cases = [
  {
    calculateRows: calculateTradingViewRsiRows,
    definition: storeV6RsiIndicatorDefinitionV2,
    id: storeV6RsiIndicatorIdV2,
    params: { length: 3, smoothingLength: 2 },
  },
  {
    calculateRows: calculateTradingViewMacdRows,
    definition: storeV6MacdIndicatorDefinitionV2,
    id: storeV6MacdIndicatorIdV2,
    params: { fastLength: 2, slowLength: 4, signalLength: 2 },
  },
  {
    calculateRows: calculateTradingViewDpoRows,
    definition: storeV6DpoIndicatorDefinitionV2,
    id: storeV6DpoIndicatorIdV2,
    params: { length: 4 },
  },
  {
    calculateRows: calculateTradingViewAoRows,
    definition: storeV6AoIndicatorDefinitionV2,
    id: storeV6AoIndicatorIdV2,
    params: { fastLength: 2, slowLength: 4 },
  },
  {
    calculateRows: calculateTradingViewSqzmomRows,
    definition: storeV6SqzmomIndicatorDefinitionV2,
    id: storeV6SqzmomIndicatorIdV2,
    params: { bbLength: 3, kcLength: 3 },
  },
  {
    calculateRows: calculateTradingViewViRows,
    definition: storeV6ViIndicatorDefinitionV2,
    id: storeV6ViIndicatorIdV2,
    params: { length: 3 },
  },
] satisfies Array<{
  calculateRows: (rows: ReturnType<typeof toKLineData>[], settings: any) => object[]
  definition: StoreV6IndicatorDefinitionV2<any>
  id: string
  params: Record<string, unknown>
}>

describe('remaining store v6 sub-pane indicator definitions', () => {
  it.each(cases)('calculates history $id from warmup rows and displays only page rows', async (testCase) => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(testCase.definition)
    const displayRows = [kline(700, 7), kline(800, 8)]
    const calculationRows = [kline(100, 1), kline(200, 2), kline(300, 3), kline(400, 4), kline(500, 5), kline(600, 6), ...displayRows]

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 700,
        actualTimeFrom: 700,
        actualTimeTo: 800,
        actualToGlobalIndex: 800,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 700,
        requestedTimeTo: 800,
        requestedToGlobalIndex: null,
      },
      calculationRows,
      displayOffset: 6,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ id: testCase.id, params: testCase.params }],
      symbol: 'XAUUSDm',
      warmupRows: calculationRows.slice(0, 6),
    })

    const expected = testCase.calculateRows(calculationRows.map(toKLineData), testCase.params).slice(-2)
    expect(indicators[testCase.id]).toMatchObject({
      id: testCase.id,
      paneRole: 'sub',
      renderRole: 'sub-pane',
    })
    expect(indicators[testCase.id].displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|700', ...expected[0] }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|800', ...expected[1] }),
    ])
  })

  it.each(cases)('calculates realtime $id from history context and displays only active rows', async (testCase) => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(testCase.definition)
    const historyRows = [kline(100, 1), kline(200, 2), kline(300, 3), kline(400, 4), kline(500, 5), kline(600, 6)]
    const activeRows = [kline(700, 7), kline(800, 8)]

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: testCase.id, params: testCase.params }],
      sessionTimeFrom: 700,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const expected = testCase.calculateRows([...historyRows, ...activeRows].map(toKLineData), testCase.params).slice(-2)
    expect(indicators[testCase.id].displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|700', ...expected[0] }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|800', ...expected[1] }),
    ])
  })
})
