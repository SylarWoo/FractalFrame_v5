import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewVdoRows } from '../tradingViewVdoIndicator'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import {
  storeV6VdoIndicatorDefinitionV2,
  storeV6VdoIndicatorIdV2,
  storeV6VdoPaneIdV2,
} from './vdoIndicatorV2'

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

describe('storeV6VdoIndicatorDefinitionV2', () => {
  it('requests warmup rows from VDO input parameters', () => {
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6VdoIndicatorDefinitionV2,
      request: {
        id: storeV6VdoIndicatorIdV2,
        params: {
          emaSmoothing: 2,
          length: 5,
          vdoMa2Length: 4,
          vdoMaLength: 3,
        },
      },
      windowKind: 'history',
    })).toMatchObject({
      mode: 'fixedRows',
      requiredRows: 14,
    })
  })

  it('calculates history VDO from warmup rows and displays only the page rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VdoIndicatorDefinitionV2)
    const displayRows = [kline(500, 5), kline(600, 6)]
    const calculationRows = [kline(100, 1), kline(200, 2), kline(300, 3), kline(400, 4), ...displayRows]
    const settings = { emaSmoothing: 2, length: 3, vdoMa2Length: 3, vdoMaLength: 2 }

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 500,
        actualTimeFrom: 500,
        actualTimeTo: 600,
        actualToGlobalIndex: 600,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 500,
        requestedTimeTo: 600,
        requestedToGlobalIndex: null,
      },
      calculationRows,
      displayOffset: 4,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ id: storeV6VdoIndicatorIdV2, params: settings }],
      symbol: 'XAUUSDm',
      warmupRows: calculationRows.slice(0, 4),
    })

    const expected = calculateTradingViewVdoRows(calculationRows.map(toKLineData), settings).slice(-2)
    const vdo = indicators[storeV6VdoIndicatorIdV2]
    expect(vdo).toMatchObject({
      id: 'VDO',
      paneId: storeV6VdoPaneIdV2,
      paneRole: 'sub',
      renderRole: 'sub-pane',
      source: 'store-v6-vdo-indicator-v2',
    })
    expect(vdo.displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|500', ...expected[0] }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|600', ...expected[1] }),
    ])
  })

  it('calculates realtime VDO from stable history context and displays only active rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VdoIndicatorDefinitionV2)
    const historyRows = [kline(100, 1), kline(200, 2), kline(300, 3), kline(400, 4)]
    const activeRows = [kline(500, 5), kline(600, 6)]
    const settings = { emaSmoothing: 2, length: 3, vdoMa2Length: 3, vdoMaLength: 2 }

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6VdoIndicatorIdV2, params: settings }],
      sessionTimeFrom: 500,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const expected = calculateTradingViewVdoRows([...historyRows, ...activeRows].map(toKLineData), settings).slice(-2)
    expect(indicators[storeV6VdoIndicatorIdV2].displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|500', ...expected[0] }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|600', ...expected[1] }),
    ])
  })
})
