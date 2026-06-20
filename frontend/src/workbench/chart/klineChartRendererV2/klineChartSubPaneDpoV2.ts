import type { Chart } from 'klinecharts'
import { storeV6DpoIndicatorIdV2, storeV6DpoPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewDpoIndicator } from '../tradingViewDpoIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneDpoV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['dpo'],
    ensureIndicator: ensureTradingViewDpoIndicator,
    heightStorageKey: 'fractalframe.chart.dpoPaneHeight',
    indicatorId: storeV6DpoIndicatorIdV2,
    paneId: storeV6DpoPaneIdV2,
    snapshotRowsKey: 'dpoRows',
  })
}
