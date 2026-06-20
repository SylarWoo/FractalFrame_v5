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

export type KLineChartSubPaneAxisConfigV2 = {
  paneIds: string[]
  restoreYAxisOnRefresh: boolean
}

export const kLineChartSubPaneAxisConfigV2: KLineChartSubPaneAxisConfigV2 = {
  paneIds: [
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
  ],
  restoreYAxisOnRefresh: true,
}
