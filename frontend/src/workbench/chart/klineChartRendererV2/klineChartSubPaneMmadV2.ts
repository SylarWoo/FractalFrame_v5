import type { Chart } from 'klinecharts'
import { storeV6MmadIndicatorIdV2, storeV6MmadPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewMmadIndicator } from '../tradingViewMmadIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneMmadV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['mmad'],
    ensureIndicator: ensureTradingViewMmadIndicator,
    heightStorageKey: 'fractalframe.chart.mmadPaneHeight',
    indicatorId: storeV6MmadIndicatorIdV2,
    paneId: storeV6MmadPaneIdV2,
    snapshotRowsKey: 'mmadRows',
  })
}
