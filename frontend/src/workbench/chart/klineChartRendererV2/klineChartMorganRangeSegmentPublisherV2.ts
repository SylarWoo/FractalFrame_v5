import { ActionType } from 'klinecharts'
import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { readCurrentMorganRangeDataFromFrameV2 } from '../morganRangeRuntimeV2'
import type { MorganRangeSegment } from '../morganRangeModel'
import { readCrosshairDataIndex } from '../paneTitleOverlayContent'

type MorganRangeSegmentPublisherOptionsV2 = {
  chart: Chart
  frame: KLineChartRenderFrameV2
  onSegmentChange?: (segment: MorganRangeSegment | null) => void
}

function createSegmentSignature(index: number, segment: MorganRangeSegment | null) {
  if (!segment) return 'null'
  return [
    index,
    segment.startIndex,
    segment.endIndex,
    segment.center,
    segment.upper,
    segment.lower,
  ].join('|')
}

export function installKLineChartMorganRangeSegmentPublisherV2(options: MorganRangeSegmentPublisherOptionsV2) {
  let frame = options.frame
  let crosshairIndex: number | null = null
  let publishedSignature = ''
  let onSegmentChange = options.onSegmentChange

  const publish = () => {
    const data = readCurrentMorganRangeDataFromFrameV2(frame, { dataIndex: crosshairIndex })
    if (!data) {
      if (publishedSignature !== 'null') {
        publishedSignature = 'null'
        onSegmentChange?.(null)
      }
      return
    }
    const signature = createSegmentSignature(data.dataIndex, data.segment)
    if (signature === publishedSignature) return
    publishedSignature = signature
    onSegmentChange?.(data.segment)
  }

  const handleCrosshairChange = (payload: unknown) => {
    crosshairIndex = readCrosshairDataIndex(payload)
    publish()
  }

  options.chart.subscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
  publish()

  return {
    destroy() {
      options.chart.unsubscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
      onSegmentChange?.(null)
      publishedSignature = ''
    },
    updateFrame(nextFrame: KLineChartRenderFrameV2) {
      frame = nextFrame
      publish()
    },
    updateHandler(nextHandler?: (segment: MorganRangeSegment | null) => void) {
      onSegmentChange = nextHandler
      publish()
    },
  }
}
