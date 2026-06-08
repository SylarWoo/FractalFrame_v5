import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { requestHistoryWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import { storeV6VolIndicatorDefinitionV2, storeV6VolIndicatorIdV2, storeV6VolPaneIdV2 } from './volIndicatorV2'

function kline(time: number, close: number, volume: number): StoreV6WindowKLine {
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
    volume,
  }
}

describe('storeV6VolIndicatorDefinitionV2', () => {
  it('routes Vol through the v2 indicator controller as a main chart overlay', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VolIndicatorDefinitionV2)
    const displayRows = [kline(200, 2, 20), kline(300, 3, 30)]

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 200,
        actualTimeFrom: 200,
        actualTimeTo: 300,
        actualToGlobalIndex: 300,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 200,
        requestedTimeTo: 300,
        requestedToGlobalIndex: null,
      },
      calculationRows: [kline(100, 1, 10), ...displayRows],
      displayOffset: 1,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{
        id: 'Vol',
        params: {
          maChecked: true,
          maLength: 2,
        },
      }],
      symbol: 'XAUUSDm',
      warmupRows: [kline(100, 1, 10)],
    })

    const vol = indicators[storeV6VolIndicatorIdV2]
    expect(vol).toMatchObject({
      id: storeV6VolIndicatorIdV2,
      paneId: storeV6VolPaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
      source: 'store-v6-vol-indicator-v2',
    })
    expect(vol.displayRows?.map((row) => (row as { volume: number }).volume)).toEqual([20, 30])
    expect(vol.rows.map((row) => (row as { volumeMa?: number }).volumeMa)).toEqual([undefined, 15, 25])
  })
})
