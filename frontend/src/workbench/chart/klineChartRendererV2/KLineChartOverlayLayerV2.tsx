import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

type KLineChartOverlayLayerV2Props = {
  frame: KLineChartRenderFrameV2 | null
}

export function KLineChartOverlayLayerV2({ frame }: KLineChartOverlayLayerV2Props) {
  return (
    <div
      className="ff-kline-chart-host-v2__overlay-layer"
      data-frame-key={frame?.key ?? ''}
      aria-hidden="true"
    />
  )
}
