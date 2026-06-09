import { describe, expect, it } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import { storeV6MaIndicatorDefinitionV2 } from './maIndicatorV2'
import {
  storeV6MmfV3IndicatorDefinitionV2,
  storeV6MmfV3IndicatorIdV2,
  storeV6MmfV3PaneIdV2,
} from './mmfV3IndicatorV2'
import { storeV6StochIndicatorDefinitionV2 } from './stochIndicatorV2'
import { storeV6TsiIndicatorDefinitionV2 } from './tsiIndicatorV2'
import { storeV6VdoIndicatorDefinitionV2 } from './vdoIndicatorV2'
import { storeV6VmiIndicatorDefinitionV2 } from './vmiIndicatorV2'
import { storeV6VwapIndicatorDefinitionV2 } from './vwapIndicatorV2'
import { calculateMmfV3FrontendRowsForDisplayPageV2 } from './mmfV3FrontendEngineV2'

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

function createRegistry() {
  const registry = createStoreV6IndicatorRegistryV2()
  registry.register(storeV6MaIndicatorDefinitionV2)
  registry.register(storeV6MmfV3IndicatorDefinitionV2)
  registry.register(storeV6StochIndicatorDefinitionV2)
  registry.register(storeV6TsiIndicatorDefinitionV2)
  registry.register(storeV6VdoIndicatorDefinitionV2)
  registry.register(storeV6VmiIndicatorDefinitionV2)
  registry.register(storeV6VwapIndicatorDefinitionV2)
  return registry
}

describe('storeV6MmfV3IndicatorDefinitionV2', () => {
  it('plans enough warmup rows for the frontend MMF_V3 feature frame', () => {
    expect(planIndicatorWarmupV2({
      availableRows: 0,
      definition: storeV6MmfV3IndicatorDefinitionV2,
      request: {
        id: storeV6MmfV3IndicatorIdV2,
        params: {
          stochSettings: { dSmoothing: 6, kSmoothing: 6, length: 28 },
          vdoSettings: { emaSmoothing: 0, length: 120, vdoMaLength: 14, vdoMa2Length: 34 },
        },
      },
      windowKind: 'history',
    })).toMatchObject({
      mode: 'fixedRows',
      requiredRows: 600,
    })
  })

  it('computes history MMF_V3 synchronously with the frontend engine', async () => {
    const registry = createRegistry()
    const displayRows = [kline(500, 5), kline(600, 6), kline(700, 4)]
    const calculationRows = [
      kline(100, 1),
      kline(200, 2),
      kline(300, 3),
      kline(400, 4),
      ...displayRows,
    ]

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 500,
        actualTimeFrom: 500,
        actualTimeTo: 700,
        actualToGlobalIndex: 700,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 500,
        requestedTimeTo: 700,
        requestedToGlobalIndex: null,
      },
      calculationRows,
      displayOffset: 4,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{
        id: storeV6MmfV3IndicatorIdV2,
        params: {
          settings: {
            showBearMarketPoint: true,
            showBullMarketPoint: true,
            showOverboughtPoint: true,
            showOversoldPoint: true,
          },
          stochSettings: { dSmoothing: 2, kSmoothing: 2, length: 3 },
          vdoSettings: { length: 3, upLineValue: 0.01, downLineValue: -0.01 },
        },
      }],
      symbol: 'XAUUSDm',
      warmupRows: calculationRows.slice(0, 4),
    })

    const mmf = indicators[storeV6MmfV3IndicatorIdV2]
    expect(mmf).toMatchObject({
      calculationMode: 'computed',
      id: 'MMF_V3',
      paneId: storeV6MmfV3PaneIdV2,
      paneRole: 'main',
      renderRole: 'main-overlay',
      source: 'store-v6-mmf-v3-frontend-engine-v2',
    })
    expect(mmf.rows).toHaveLength(3)
    expect(mmf.displayRows).toEqual(mmf.rows)
    expect(Object.keys(indicators)).toEqual([storeV6MmfV3IndicatorIdV2])
  })

  it('computes realtime MMF_V3 with the frontend engine', async () => {
    const registry = createRegistry()
    const historyRows = [kline(100, 1), kline(200, 2), kline(300, 3), kline(400, 4)]
    const activeRows = [kline(500, 5), kline(600, 6)]

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      historyRows,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MmfV3IndicatorIdV2, params: { settings: { showLow: true } } }],
      sessionTimeFrom: 500,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(indicators[storeV6MmfV3IndicatorIdV2]).toMatchObject({
      id: 'MMF_V3',
      paneId: storeV6MmfV3PaneIdV2,
      source: 'store-v6-mmf-v3-frontend-engine-v2',
    })
    expect(indicators[storeV6MmfV3IndicatorIdV2]?.rows).toHaveLength(activeRows.length)
  })

  it('keeps MMF_V3 marker coordinates stable when display rows are a subset of calculation rows', () => {
    const calculationRows = Array.from({ length: 90 }, (_, index) => {
      const close = 20 + Math.sin(index / 3) * 8 + Math.cos(index / 7) * 4
      return kline(100 + index * 100, close)
    })
    const displayRows = calculationRows.slice(30, 70)
    const inputContext = {
      period: 'M5',
      settings: {
        showBearMarketPoint: true,
        showBullMarketPoint: true,
        showHigh: true,
        showLow: true,
        showOverboughtPoint: true,
        showOversoldPoint: true,
        showTsiDeadCrossPoint: true,
        showTsiGoldenCrossPoint: true,
      },
      stochSettings: { dSmoothing: 2, kSmoothing: 2, length: 5 },
      symbol: 'XAUUSDm',
      tsiSettings: { longLength: 8, shortLength: 4, signalLength: 3 },
      vdoSettings: { length: 6, upLineValue: 0.02, downLineValue: -0.02, vdoMaLength: 4, vdoMa2Length: 6 },
      vmiSettings: { fastLength: 3, slowLength: 8 },
    }

    const fullRows = calculateMmfV3FrontendRowsForDisplayPageV2({
      calculationRows,
      displayRows: calculationRows,
      inputContext,
    })
    const subsetRows = calculateMmfV3FrontendRowsForDisplayPageV2({
      calculationRows,
      displayRows,
      inputContext,
    })

    expect(subsetRows).toEqual(fullRows.slice(30, 70))
  })
})
