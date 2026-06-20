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
import { kLineChartSubPaneAxisConfigV2 } from './klineChartSubPaneAxisConfigV2'

describe('kLineChartSubPaneAxisConfigV2', () => {
  it('includes every V2 KLineChart sub-pane indicator pane', () => {
    expect(kLineChartSubPaneAxisConfigV2.paneIds).toEqual(expect.arrayContaining([
      storeV6RsiPaneIdV2,
      storeV6SqzmomPaneIdV2,
      storeV6MacdPaneIdV2,
      storeV6DpoPaneIdV2,
      storeV6StochPaneIdV2,
      storeV6TsiPaneIdV2,
      storeV6AoPaneIdV2,
      storeV6VdoPaneIdV2,
      storeV6VmiPaneIdV2,
      storeV6ViPaneIdV2,
    ]))
  })
})
