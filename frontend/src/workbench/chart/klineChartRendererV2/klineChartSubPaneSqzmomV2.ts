import type { Chart } from 'klinecharts'
import { storeV6SqzmomIndicatorIdV2, storeV6SqzmomPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewSqzmomIndicator } from '../tradingViewSqzmomIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneSqzmomV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['sqzmom'],
    ensureIndicator: ensureTradingViewSqzmomIndicator,
    heightStorageKey: 'fractalframe.chart.sqzmomPaneHeight',
    indicatorId: storeV6SqzmomIndicatorIdV2,
    paneId: storeV6SqzmomPaneIdV2,
    snapshotRowsKey: 'sqzmomRows',
  })
}
