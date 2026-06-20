import type { Chart } from 'klinecharts'
import { storeV6AoIndicatorIdV2, storeV6AoPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewAoIndicator } from '../tradingViewAoIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneAoV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['ao'],
    ensureIndicator: ensureTradingViewAoIndicator,
    heightStorageKey: 'fractalframe.chart.aoPaneHeight',
    indicatorId: storeV6AoIndicatorIdV2,
    paneId: storeV6AoPaneIdV2,
    snapshotRowsKey: 'aoRows',
  })
}
