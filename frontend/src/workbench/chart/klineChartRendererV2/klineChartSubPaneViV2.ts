import type { Chart } from 'klinecharts'
import { storeV6ViIndicatorIdV2, storeV6ViPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewViIndicator } from '../tradingViewViIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneViV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['vi'],
    ensureIndicator: ensureTradingViewViIndicator,
    heightStorageKey: 'fractalframe.chart.viPaneHeight',
    indicatorId: storeV6ViIndicatorIdV2,
    paneId: storeV6ViPaneIdV2,
    snapshotRowsKey: 'viRows',
  })
}
