import type { MutableRefObject } from 'react'
import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

type KLineChartOverlayLayerV2Props = {
  chartInstanceRef?: MutableRefObject<Chart | null>
  frame: KLineChartRenderFrameV2 | null
}

export function KLineChartOverlayLayerV2({
  chartInstanceRef,
  frame,
}: KLineChartOverlayLayerV2Props) {
  void chartInstanceRef
  return (
    <div
      className="ff-kline-chart-host-v2__overlay-layer"
      data-frame-key={frame?.key ?? ''}
      aria-hidden="true"
    />
  )
}
