export const kLineChartHorizontalDragEndEventV2 = 'fractalframe:klineChartHorizontalDragEnd'

declare global {
  interface Window {
    __ffKLineChartV2Interaction?: {
      horizontalDragInProgress: boolean
    }
  }
}

export function ensureKLineChartInteractionStateV2() {
  if (typeof window === 'undefined') return null
  window.__ffKLineChartV2Interaction = window.__ffKLineChartV2Interaction ?? {
    horizontalDragInProgress: false,
  }
  return window.__ffKLineChartV2Interaction
}

export function isKLineChartHorizontalDragInProgressV2() {
  return window.__ffKLineChartV2Interaction?.horizontalDragInProgress === true
}
