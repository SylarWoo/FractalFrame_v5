import { describe, expect, it } from 'vitest'
import {
  storeV6AoPaneIdV2,
  storeV6DpoPaneIdV2,
  storeV6MacdPaneIdV2,
  storeV6RsiPaneIdV2,
  storeV6SqzmomPaneIdV2,
  storeV6StochPaneIdV2,
  storeV6TsiPaneIdV2,
  storeV6VdoPaneIdV2,
  storeV6ViPaneIdV2,
  storeV6VmiPaneIdV2,
} from '../indicatorRequestV2'
import { kLineChartSubPaneHeightStorageEntriesV2 } from './klineChartSubPaneHeightLifecycleV2'

describe('kLineChartSubPaneHeightLifecycleV2', () => {
  it('tracks height storage for every V2 KLineChart sub-pane indicator pane', () => {
    const paneIds = kLineChartSubPaneHeightStorageEntriesV2.map(([paneId]) => paneId)
    expect(paneIds).toEqual(expect.arrayContaining([
      storeV6RsiPaneIdV2,
      storeV6StochPaneIdV2,
      storeV6SqzmomPaneIdV2,
      storeV6MacdPaneIdV2,
      storeV6DpoPaneIdV2,
      storeV6TsiPaneIdV2,
      storeV6AoPaneIdV2,
      storeV6VdoPaneIdV2,
      storeV6VmiPaneIdV2,
      storeV6ViPaneIdV2,
    ]))
  })
})
