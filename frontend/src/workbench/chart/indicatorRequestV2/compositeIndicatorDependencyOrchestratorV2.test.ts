import { describe, expect, it } from 'vitest'
import {
  createStoreV6IndicatorComputeKeyV2,
  planCompositeIndicatorDependenciesV2,
} from './compositeIndicatorDependencyOrchestratorV2'
import { storeV6MmfV3IndicatorIdV2 } from './mmfV3IndicatorV2'
import { storeV6VdoIndicatorIdV2 } from './vdoIndicatorV2'
import { createStoreV6IndicatorRegistryV2 } from './indicatorRegistryV2'
import { requestHistoryWindowIndicatorsV2 } from './indicatorRequestControllerV2'
import type { StoreV6IndicatorDefinitionV2 } from './indicatorRequestTypes'
import type { StoreV6WindowKLine } from '../pageSliceV2'

describe('planCompositeIndicatorDependenciesV2', () => {
  it('keeps frontend MMF_V3 as a standalone compute request', () => {
    const plan = planCompositeIndicatorDependenciesV2([{
      id: storeV6MmfV3IndicatorIdV2,
      params: {
        maSettings: { length: 120 },
        stochSettings: { length: 28 },
        vdoSettings: { length: 120 },
        vmiSettings: { fastLength: 5 },
        vwapSettings: { anchorPeriod: 'session' },
      },
    }])

    const ids = plan.computeRequests.map((request) => request.id.toUpperCase())
    expect(ids).toEqual([storeV6MmfV3IndicatorIdV2])
    expect(plan.computeRequests.filter((request) => request.visible === false)).toHaveLength(0)
  })

  it('keeps a visible MMF_V3 input indicator visible without adding a duplicate', () => {
    const visibleVdo = {
      id: storeV6VdoIndicatorIdV2,
      params: { length: 120 },
    }
    const plan = planCompositeIndicatorDependenciesV2([
      {
        id: storeV6MmfV3IndicatorIdV2,
        params: {
          vdoSettings: { length: 120 },
        },
      },
      visibleVdo,
    ])

    const vdoRequests = plan.computeRequests.filter((request) => request.id.toUpperCase() === storeV6VdoIndicatorIdV2)
    expect(vdoRequests).toHaveLength(1)
    expect(vdoRequests[0]?.visible).toBe(true)
    expect(plan.visibleRequestKeys.has(createStoreV6IndicatorComputeKeyV2(visibleVdo))).toBe(true)
  })

  it('does not add hidden MMF_V3 dependencies when visible input params differ', () => {
    const plan = planCompositeIndicatorDependenciesV2([
      {
        id: storeV6MmfV3IndicatorIdV2,
        params: {
          vdoSettings: { length: 120 },
        },
      },
      {
        id: storeV6VdoIndicatorIdV2,
        params: { length: 60 },
      },
    ])

    const vdoRequests = plan.computeRequests.filter((request) => request.id.toUpperCase() === storeV6VdoIndicatorIdV2)
    expect(vdoRequests).toHaveLength(1)
    expect(vdoRequests.some((request) => request.visible === false)).toBe(false)
    expect(vdoRequests.some((request) => request.visible === true && createStoreV6IndicatorComputeKeyV2(request).includes(createStoreV6IndicatorComputeKeyV2({
      id: storeV6VdoIndicatorIdV2,
      params: { length: 60 },
    })))).toBe(true)
  })
})

function row(time: number): StoreV6WindowKLine {
  return {
    barKey: `XAUUSDm|M5|${time}`,
    close: time,
    globalIndex: time,
    high: time + 1,
    low: time - 1,
    open: time,
    period: 'M5',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    tradingDay: '2026-06-09',
    volume: 1,
  }
}

describe('requestHistoryWindowIndicatorsV2 composite frontend MMF_V3', () => {
  it('computes only the visible frontend MMF_V3 request', async () => {
    const calls: string[] = []
    const registry = createStoreV6IndicatorRegistryV2()
    const makeDefinition = (id: string): StoreV6IndicatorDefinitionV2 => ({
      calculateHistory: (context) => {
        calls.push(id)
        return {
          [id]: {
            key: `${id}:history`,
            rows: context.displayRows.map((item) => ({ barKey: item.barKey })),
            source: `${id}:test`,
          },
        }
      },
      id,
      paneRole: id === storeV6MmfV3IndicatorIdV2 ? 'main' : 'sub',
      renderRole: id === storeV6MmfV3IndicatorIdV2 ? 'main-overlay' : 'sub-pane',
    })
    registry.register(makeDefinition(storeV6MmfV3IndicatorIdV2))

    const displayRows = [row(100), row(200)]
    const indicators = await requestHistoryWindowIndicatorsV2({
      boundary: {
        actualFromGlobalIndex: 100,
        actualTimeFrom: 100,
        actualTimeTo: 200,
        actualToGlobalIndex: 200,
        requestedFromGlobalIndex: null,
        requestedTimeFrom: 100,
        requestedTimeTo: 200,
        requestedToGlobalIndex: null,
      },
      calculationRows: displayRows,
      displayOffset: 0,
      displayRows,
      pageIndex: 1,
      period: 'M5',
      registry,
      requests: [{ id: storeV6MmfV3IndicatorIdV2, params: { vdoSettings: { length: 120 } } }],
      symbol: 'XAUUSDm',
      warmupRows: [],
    })

    expect(calls).toEqual([storeV6MmfV3IndicatorIdV2])
    expect(Object.keys(indicators)).toEqual([storeV6MmfV3IndicatorIdV2])
  })
})
