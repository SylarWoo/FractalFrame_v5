import { describe, expect, it } from 'vitest'
import { defaultVdoIndicatorSettings } from '../../rightDrawer/indicatorSettingsSchema'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateTradingViewVmiRows } from '../tradingViewVmiIndicator'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import {
  storeV6VmiIndicatorDefinitionV2,
  storeV6VmiIndicatorIdV2,
  storeV6VmiPaneIdV2,
} from './vmiIndicatorV2'

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

describe('storeV6VmiIndicatorDefinitionV2', () => {
  it('requests warmup rows from VMI input parameters and VDO source needs', () => {
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6VmiIndicatorDefinitionV2,
      request: {
        id: storeV6VmiIndicatorIdV2,
        params: {
          fastLength: 5,
          slowLength: 8,
        },
      },
      windowKind: 'history',
    })).toMatchObject({
      mode: 'fixedRows',
      requiredRows: defaultVdoIndicatorSettings.length + defaultVdoIndicatorSettings.emaSmoothing + 8,
    })
  })

  it('calculates history VMI from warmup rows and displays only the page rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VmiIndicatorDefinitionV2)
    const displayRows = [kline(700, 7), kline(800, 8)]
    const calculationRows = [
      kline(100, 1),
      kline(200, 3),
      kline(300, 2),
      kline(400, 5),
      kline(500, 4),
      kline(600, 6),
      ...displayRows,
    ]
    const settings = { fastLength: 2, slowLength: 3 }

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
      requests: [{ id: storeV6VmiIndicatorIdV2, params: settings }],
      symbol: 'XAUUSDm',
      warmupRows: calculationRows.slice(0, 6),
    })

    const expected = calculateTradingViewVmiRows(calculationRows.map(toKLineData), settings).slice(-2)
    const vmi = indicators[storeV6VmiIndicatorIdV2]
    expect(vmi).toMatchObject({
      id: 'VMI',
      paneId: storeV6VmiPaneIdV2,
      paneRole: 'sub',
      renderRole: 'sub-pane',
      source: 'store-v6-vmi-indicator-v2',
    })
    expect(vmi.displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|700', ...expected[0] }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|800', ...expected[1] }),
    ])
  })

  it('calculates realtime VMI from stable history context and displays only active rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register(storeV6VmiIndicatorDefinitionV2)
    const historyRows = [kline(100, 1), kline(200, 3), kline(300, 2), kline(400, 5), kline(500, 4), kline(600, 6)]
    const activeRows = [kline(700, 7), kline(800, 8)]
    const settings = { fastLength: 2, slowLength: 3 }

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6VmiIndicatorIdV2, params: settings }],
      sessionTimeFrom: 700,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    const expected = calculateTradingViewVmiRows([...historyRows, ...activeRows].map(toKLineData), settings).slice(-2)
    expect(indicators[storeV6VmiIndicatorIdV2].displayRows).toEqual([
      expect.objectContaining({ barKey: 'XAUUSDm|M5|700', ...expected[0] }),
      expect.objectContaining({ barKey: 'XAUUSDm|M5|800', ...expected[1] }),
    ])
  })
})
