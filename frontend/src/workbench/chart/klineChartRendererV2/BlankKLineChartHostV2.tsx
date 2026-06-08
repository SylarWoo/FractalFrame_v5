import './klineChartHostV2.css'
import { KLineChartMainPaneV2 } from './KLineChartMainPaneV2'
import { KLineChartOverlayLayerV2 } from './KLineChartOverlayLayerV2'
import { KLineChartSubPaneStackV2 } from './KLineChartSubPaneStackV2'

type BlankKLineChartHostV2Props = {
  period: string
  symbol: string
}

export function BlankKLineChartHostV2({ period, symbol }: BlankKLineChartHostV2Props) {
  return (
    <section className="ff-kline-chart-host-v2" data-loading={false} aria-label={`${symbol} ${period} chart`}>
      <KLineChartMainPaneV2 />
      <KLineChartSubPaneStackV2 panes={{}} />
      <KLineChartOverlayLayerV2 frame={null} />
    </section>
  )
}
