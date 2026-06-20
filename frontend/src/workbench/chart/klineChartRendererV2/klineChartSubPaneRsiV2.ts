import type { Chart } from 'klinecharts'
import { storeV6RsiIndicatorIdV2, storeV6RsiPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewRsiIndicator } from '../tradingViewRsiIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneRsiV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['rsi'],
    ensureIndicator: ensureTradingViewRsiIndicator,
    heightStorageKey: 'fractalframe.chart.rsiPaneHeight',
    indicatorId: storeV6RsiIndicatorIdV2,
    paneId: storeV6RsiPaneIdV2,
    snapshotRowsKey: 'rsiRows',
  })
}
