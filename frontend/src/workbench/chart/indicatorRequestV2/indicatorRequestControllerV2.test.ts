import { describe, expect, it, vi } from 'vitest'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { createStoreV6IndicatorRuntimeV2 } from './indicatorRuntimeV2'
import { planIndicatorWarmupV2 } from './indicatorWarmupPlannerV2'
import { refreshRealtimeWindowIndicatorsV2 } from './indicatorRealtimeUpdateV2'
import { requestHistoryWindowIndicatorsV2, requestRealtimeWindowIndicatorsV2 } from './indicatorRequestControllerV2'

function kline(time: number, globalIndex: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: 2,
    globalIndex,
    high: 3,
    low: 1,
    open: 1.5,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    volume: 10,
  }
}

describe('indicatorRequestControllerV2', () => {
  it('returns empty indicator data when no indicator is registered', async () => {
    const registry = createStoreV6IndicatorRegistryV2()

    await expect(requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 1,
        actualTimeFrom: 100,
        actualTimeTo: 200,
        actualToGlobalIndex: 2,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 100,
        requestedTimeTo: 200,
        requestedToGlobalIndex: null,
      },
      calculationRows: [kline(100, 1), kline(200, 2)],
      displayOffset: 0,
      displayRows: [kline(100, 1), kline(200, 2)],
      pageIndex: 1,
      period: 'M5',
      registry,
      symbol: 'XAUUSDm',
      warmupRows: [],
    })).resolves.toEqual({})

    await expect(requestRealtimeWindowIndicatorsV2({
      activeRows: [kline(300, 3)],
      period: 'M5',
      registry,
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })).resolves.toEqual({})
  })

  it('routes history window kline data into a registered indicator', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    const calculateHistory = vi.fn().mockReturnValue({
      TEST: {
        key: 'TEST',
        rows: [{ time: 200, value: 9 }],
        source: 'test-indicator',
      },
    })
    registry.register({
      calculateHistory,
      calculationMode: 'mixed',
      id: 'test',
      paneId: 'pane-test',
      paneRole: 'main',
      renderRole: 'main-overlay',
      warmup: {
        historyRows: 3,
        mode: 'fixedRows',
      },
    })
    const displayRows = [kline(200, 2)]

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 2,
        actualTimeFrom: 200,
        actualTimeTo: 200,
        actualToGlobalIndex: 2,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 200,
        requestedTimeTo: 200,
        requestedToGlobalIndex: null,
      },
      calculationRows: [kline(100, 1), ...displayRows],
      displayOffset: 1,
      displayRows,
      pageIndex: 2,
      period: 'M5',
      registry,
      requests: [{ id: 'test', params: { length: 5 } }],
      symbol: 'XAUUSDm',
      warmupRows: [kline(100, 1)],
    })

    expect(indicators.TEST.rows).toEqual([{ time: 200, value: 9 }])
    expect(calculateHistory).toHaveBeenCalledWith(expect.objectContaining({
      displayOffset: 1,
      displayRows,
      pageIndex: 2,
      paneId: 'pane-test',
      paneRole: 'main',
      params: { length: 5 },
      renderRole: 'main-overlay',
      request: { id: 'TEST', params: { length: 5 } },
      warmupPlan: {
        availableRows: 1,
        missingRows: 2,
        mode: 'fixedRows',
        requiredRows: 3,
        windowKind: 'history',
      },
      windowKind: 'history',
    }))
    expect(indicators.TEST).toMatchObject({
      calculationMode: 'mixed',
      id: 'TEST',
      paneId: 'pane-test',
      paneRole: 'main',
      renderRole: 'main-overlay',
    })
  })

  it('routes realtime window kline data into a registered indicator', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    const calculateRealtime = vi.fn().mockReturnValue({
      TEST: {
        key: 'TEST',
        rows: [{ time: 300, value: 7 }],
        source: 'test-indicator',
      },
    })
    registry.register({
      calculateRealtime,
      id: 'test',
    })
    const activeRows = [kline(300, 3)]

    const indicators = await requestRealtimeWindowIndicatorsV2({
      activeRows,
      period: 'M5',
      registry,
      requests: [{ id: 'test' }],
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      symbol: 'XAUUSDm',
    })

    expect(indicators.TEST.rows).toEqual([{ time: 300, value: 7 }])
    expect(calculateRealtime).toHaveBeenCalledWith(expect.objectContaining({
      activeRows,
      historyRows: [],
      request: { id: 'TEST' },
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      windowKind: 'realtime',
    }))
  })

  it('skips disabled and unknown indicator requests', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    const calculateHistory = vi.fn().mockReturnValue({
      TEST: {
        key: 'TEST',
        rows: [],
        source: 'test-indicator',
      },
    })
    registry.register({
      calculateHistory,
      id: 'test',
    })

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: null,
        actualTimeFrom: null,
        actualTimeTo: null,
        actualToGlobalIndex: null,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: null,
        requestedTimeTo: null,
        requestedToGlobalIndex: null,
      },
      calculationRows: [],
      displayOffset: 0,
      displayRows: [],
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ enabled: false, id: 'test' }, { id: 'missing' }],
      symbol: 'XAUUSDm',
      warmupRows: [],
    })

    expect(indicators).toEqual({})
    expect(calculateHistory).not.toHaveBeenCalled()
  })

  it('treats an explicit empty request list as no mounted indicator', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    const calculateHistory = vi.fn().mockReturnValue({
      TEST: {
        key: 'TEST',
        rows: [],
        source: 'test-indicator',
      },
    })
    registry.register({
      calculateHistory,
      id: 'test',
    })

    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: null,
        actualTimeFrom: null,
        actualTimeTo: null,
        actualToGlobalIndex: null,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: null,
        requestedTimeTo: null,
        requestedToGlobalIndex: null,
      },
      calculationRows: [],
      displayOffset: 0,
      displayRows: [],
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [],
      symbol: 'XAUUSDm',
      warmupRows: [],
    })

    expect(indicators).toEqual({})
    expect(calculateHistory).not.toHaveBeenCalled()
  })

  it('uses mounted runtime requests when no explicit requests are passed', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    const runtime = createStoreV6IndicatorRuntimeV2()
    const calculateHistory = vi.fn().mockReturnValue({
      TEST: {
        key: 'TEST',
        rows: [],
        source: 'test-indicator',
      },
    })
    registry.register({
      calculateHistory,
      id: 'test',
    })
    runtime.mount({ id: 'test' })

    await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: null,
        actualTimeFrom: null,
        actualTimeTo: null,
        actualToGlobalIndex: null,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: null,
        requestedTimeTo: null,
        requestedToGlobalIndex: null,
      },
      calculationRows: [],
      displayOffset: 0,
      displayRows: [],
      pageIndex: 1,
      period: 'M5',
      registry,
      runtime,
      symbol: 'XAUUSDm',
      warmupRows: [],
    })

    expect(calculateHistory).toHaveBeenCalledTimes(1)
  })

  it('plans indicator warmup rows independently from indicator calculation', () => {
    expect(planIndicatorWarmupV2({
      availableRows: 2,
      definition: {
        id: 'test',
        warmup: {
          historyRows: 5,
          mode: 'fixedRows',
        },
      },
      request: { id: 'test' },
      windowKind: 'history',
    })).toEqual({
      availableRows: 2,
      missingRows: 3,
      mode: 'fixedRows',
      requiredRows: 5,
      windowKind: 'history',
    })
  })

  it('refreshes realtime window indicator data without replacing active rows', async () => {
    const registry = createStoreV6IndicatorRegistryV2()
    registry.register({
      calculateRealtime: () => ({
        TEST: {
          key: 'TEST',
          rows: [{ time: 300, value: 1 }],
          source: 'test-indicator',
        },
      }),
      id: 'test',
    })
    const activeRows = [kline(300, 3)]
    const window = {
      activeRows,
      indicatorRequests: [{ id: 'test' }],
      indicators: {},
      key: 'realtime',
      period: 'M5',
      renderData: {
        indicators: {},
        klineRows: activeRows,
      },
      sessionTimeFrom: 300,
      sessionTimeTo: null,
      source: 'store-v6-realtime-page-window-v2' as const,
      stableRows: [],
      status: 'ready' as const,
      symbol: 'XAUUSDm',
      tailRow: activeRows[0],
    }

    const nextWindow = await refreshRealtimeWindowIndicatorsV2({
      registry,
      window,
    })

    expect(nextWindow.activeRows).toBe(activeRows)
    expect(nextWindow.indicators.TEST.rows).toEqual([{ time: 300, value: 1 }])
    expect(nextWindow.renderData.indicators).toBe(nextWindow.indicators)
  })
})
