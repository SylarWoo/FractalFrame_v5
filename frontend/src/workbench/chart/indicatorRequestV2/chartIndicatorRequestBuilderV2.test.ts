import { describe, expect, it } from 'vitest'
import { readPersistedIndicatorsState } from '../../rightDrawer/indicatorPersistence'
import type { MmfStochH2PassthroughPeriod } from '../../rightDrawer/indicatorSettingsSchema'
import { buildChartIndicatorRequestsV2 } from './chartIndicatorRequestBuilderV2'
import { storeV6MmfV3IndicatorIdV2 } from './mmfV3IndicatorV2'
import { storeV6MmfStochH2IndicatorIdV2 } from './mmfStochH2IndicatorV2'
import {
  storeV6MorganRangeH2RequestIdV2,
  storeV6MorganRangeM5RequestIdV2,
  storeV6MorganRangeM30RequestIdV2,
} from './morganRangeIndicatorV2'

describe('buildChartIndicatorRequestsV2', () => {
  it('uses the current period Morgan range request', () => {
    const settings = readPersistedIndicatorsState()

    expect(buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MR-M5'],
      period: 'M5',
      settings,
    }).map((request) => request.id)).toEqual([storeV6MorganRangeM5RequestIdV2])

    expect(buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MR-M30'],
      period: 'M30',
      settings,
    }).map((request) => request.id)).toEqual([storeV6MorganRangeM30RequestIdV2])

    expect(buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MR-H2'],
      period: 'H2',
      settings,
    }).map((request) => request.id)).toEqual([storeV6MorganRangeH2RequestIdV2])
  })

  it('keeps MMF_V3 Morgan dependency mode aligned with loaded period indicators', () => {
    const settings = readPersistedIndicatorsState()

    const m5 = buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MMF_V3', 'MR-M5'],
      period: 'M5',
      settings,
    }).find((request) => request.id === storeV6MmfV3IndicatorIdV2)
    const m30 = buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MMF_V3', 'MR-M30'],
      period: 'M30',
      settings,
    }).find((request) => request.id === storeV6MmfV3IndicatorIdV2)
    const h2 = buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MMF_V3', 'MR-H2'],
      period: 'H2',
      settings,
    }).find((request) => request.id === storeV6MmfV3IndicatorIdV2)

    expect((m5?.params as { morganRangeMode?: string }).morganRangeMode).toBe('H4_M5')
    expect((m30?.params as { morganRangeMode?: string }).morganRangeMode).toBe('D1_M30')
    expect((h2?.params as { morganRangeMode?: string }).morganRangeMode).toBe('D5_H2')
  })

  it('builds MMF_STOCH_H2 only for selected passthrough targets', () => {
    const settings = {
      ...readPersistedIndicatorsState(),
      mmfStochH2: {
        ...readPersistedIndicatorsState().mmfStochH2,
        passthroughPeriods: ['M5', 'H2'] satisfies MmfStochH2PassthroughPeriod[],
        passthroughVisible: true,
      },
    }

    expect(buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MMF_STOCH_H2'],
      period: 'M5',
      settings,
    }).map((request) => request.id)).toEqual([storeV6MmfStochH2IndicatorIdV2])

    expect(buildChartIndicatorRequestsV2({
      loadedIndicatorKeys: ['MMF_STOCH_H2'],
      period: 'M30',
      settings,
    }).map((request) => request.id)).toEqual([])
  })
})
