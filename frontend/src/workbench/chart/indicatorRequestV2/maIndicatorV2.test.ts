import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import { storeV6MaIndicatorDefinitionV2, storeV6MaIndicatorIdV2, storeV6MaPaneIdV2 } from './maIndicatorV2'

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
    volume: close * 10,
  }
}

describe('storeV6MaIndicatorDefinitionV2', () => {
  it('calculates history MA from warmup rows and displays only the page rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MaIndicatorDefinitionV2)
    const displayRows = [kline(300, 3), kline(400, 4)]

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 300,
        actualTimeFrom: 300,
        actualTimeTo: 400,
        actualToGlobalIndex: 400,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 300,
        requestedTimeTo: 400,
        requestedToGlobalIndex: null,
      },
      calculationRows: [kline(100, 1), kline(200, 2), ...displayRows],
      displayOffset: 2,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{
        id: 'MA',
        params: {
          length: 3,
          shiftLength: 1,
          type: 'sma',
        },
      }],
      symbol: 'XAUUSDm',
      warmupRows: [kline(100, 1), kline(200, 2)],
    })

    const ma = indicators[storeV6MaIndicatorIdV2]
    expect(ma).toMatchObject({
      id: storeV6MaIndicatorIdV2,
      paneId: storeV6MaPaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
      source: 'store-v6-ma-indicator-v2',
    })
    expect(ma.rows.map((row) => (row as { ma?: number }).ma)).toEqual([undefined, undefined, 2, 3])
    expect(ma.displayRows?.map((row) => (row as { ma?: number }).ma)).toEqual([2, 3])
  })

  it('calculates realtime MA from history warmup rows and displays only realtime rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6MaIndicatorDefinitionV2)
    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows: [kline(300, 3), kline(400, 4)],
      historyRows: [kline(100, 1), kline(200, 2)],
      period: 'M5',
      registry,
      requests: [{
        id: storeV6MaIndicatorIdV2,
        params: {
          length: 3,
          shiftLength: 1,
          type: 'sma',
        },
      }],
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const ma = indicators[storeV6MaIndicatorIdV2]
    expect(ma.rows.map((row) => (row as { ma?: number }).ma)).toEqual([undefined, undefined, 2, 3])
    expect(ma.displayRows?.map((row) => (row as { ma?: number }).ma)).toEqual([2, 3])
  })
})
