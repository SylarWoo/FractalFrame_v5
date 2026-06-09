import {
  storeV6StochPaneIdV2,
  storeV6TsiPaneIdV2,
  storeV6VdoPaneIdV2,
  storeV6VmiPaneIdV2,
} from '../indicatorRequestV2'

export type KLineChartSubPaneAxisConfigV2 = {
  paneIds: string[]
  restoreYAxisOnRefresh: boolean
}

export const kLineChartSubPaneAxisConfigV2: KLineChartSubPaneAxisConfigV2 = {
  paneIds: [
    storeV6StochPaneIdV2,
    storeV6TsiPaneIdV2,
    storeV6VdoPaneIdV2,
    storeV6VmiPaneIdV2,
  ],
  restoreYAxisOnRefresh: true,
}
