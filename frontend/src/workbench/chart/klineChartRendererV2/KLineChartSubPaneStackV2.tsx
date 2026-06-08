import type { KLineChartPaneFrame } from '../historyPageKLineChartFrameV2'

type KLineChartSubPaneStackV2Props = {
  panes: Record<string, KLineChartPaneFrame>
}

export function KLineChartSubPaneStackV2({ panes }: KLineChartSubPaneStackV2Props) {
  const paneCount = Object.values(panes).filter((pane) => pane.renderRole !== 'main-overlay').length
  return (
    <div
      className="ff-kline-chart-host-v2__sub-pane-stack"
      data-pane-count={paneCount}
      aria-hidden="true"
    />
  )
}
