import { registerXAxis } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

type AxisTick = {
  coord: number
  text: string
  value: number | string
}

type AxisCreateTicksParams = {
  defaultTicks?: AxisTick[]
}

export const kLineChartRealtimeXAxisNameV2 = 'ff-realtime-x-axis-v2'

let registered = false

export function createFutureTicksV2() {
  return []
}

export function registerKLineChartRealtimeXAxisV2() {
  if (registered) return
  registerXAxis({
    name: kLineChartRealtimeXAxisNameV2,
    createTicks: (params: AxisCreateTicksParams) => params.defaultTicks ?? [],
  })
  registered = true
}

export function setKLineChartRealtimeXAxisFrameV2(_frame: KLineChartRenderFrameV2 | null) {}
