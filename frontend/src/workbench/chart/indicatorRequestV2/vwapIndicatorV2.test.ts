import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import {
  storeV6VwapIndicatorDefinitionV2,
  storeV6VwapIndicatorIdV2,
  storeV6VwapPaneIdV2,
} from './vwapIndicatorV2'

function kline(time: number, close: number, volume = 1): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close,
    globalIndex: null,
    high: close,
    low: close,
    open: close,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    tradingDay: '2026-06-09',
    volume,
  }
}

describe('storeV6VwapIndicatorDefinitionV2', () => {
  it('does not request history or realtime warmup rows', () => {
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6VwapIndicatorDefinitionV2,
      request: { id: storeV6VwapIndicatorIdV2 },
      windowKind: 'history',
    })).toMatchObject({
      mode: 'none',
      requiredRows: 0,
    })
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6VwapIndicatorDefinitionV2,
      request: { id: storeV6VwapIndicatorIdV2 },
      windowKind: 'realtime',
    })).toMatchObject({
      mode: 'none',
      requiredRows: 0,
    })
  })

  it('calculates history VWAP rows as a main overlay pane without warmup rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VwapIndicatorDefinitionV2)
    const displayRows = [kline(100, 100), kline(400, 200)]

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: null,
        actualTimeFrom: 100,
        actualTimeTo: 400,
        actualToGlobalIndex: null,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 100,
        requestedTimeTo: 400,
        requestedToGlobalIndex: null,
      },
      calculationRows: displayRows,
      displayOffset: 0,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ id: storeV6VwapIndicatorIdV2, params: { anchorPeriod: 'session', source: 'close' } }],
      symbol: 'XAUUSDm',
      warmupRows: [],
    })

    expect(indicators[storeV6VwapIndicatorIdV2]).toMatchObject({
      id: storeV6VwapIndicatorIdV2,
      paneId: storeV6VwapPaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
    })
    expect(indicators[storeV6VwapIndicatorIdV2].displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|100', vwap: 100 }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|400', vwap: 150 }),
    ])
  })

  it('calculates realtime VWAP tail from stable realtime context without StoreV6 warmup rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VwapIndicatorDefinitionV2)

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows: [kline(700, 300)],
      historyRows: [kline(100, 100), kline(400, 200)],
      period: 'M5',
      registry,
      requests: [{ id: storeV6VwapIndicatorIdV2, params: { anchorPeriod: 'session', source: 'close' } }],
      sessionTimeFrom: 100,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(indicators[storeV6VwapIndicatorIdV2].displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|700', vwap: 200 }),
    ])
  })
})
