import type { Chart } from 'klinecharts'
import { storeV6MacdIndicatorIdV2, storeV6MacdPaneIdV2 } from '../indicatorRequestV2'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { ensureTradingViewMacdIndicator } from '../tradingViewMacdIndicator'
import { installKLineChartSubPaneIndicatorV2 } from './klineChartSubPaneIndicatorV2'

export function installKLineChartSubPaneMacdV2(chart: Chart, frame: KLineChartRenderFrameV2) {
  return installKLineChartSubPaneIndicatorV2(chart, frame, {
    aliases: ['macd'],
    ensureIndicator: ensureTradingViewMacdIndicator,
    heightStorageKey: 'fractalframe.chart.macdPaneHeight',
    indicatorId: storeV6MacdIndicatorIdV2,
    paneId: storeV6MacdPaneIdV2,
    snapshotRowsKey: 'macdRows',
  })
}
