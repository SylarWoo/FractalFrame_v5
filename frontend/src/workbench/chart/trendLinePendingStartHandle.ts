import { DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { trendHandleColor, trendHandleLineWidth } from './trendLineFigures'

type OverlayPoint = {
  dataIndex?: number
  timestamp?: number
  value?: number
}

type ScreenPoint = {
  x: number
  y: number
}

export function createTrendLinePendingStartHandleController({
  chart,
  fallbackPaneId,
  resolveOverlayPointPixel,
}: {
  chart: Chart
  fallbackPaneId: string
  resolveOverlayPointPixel: (point: OverlayPoint, paneId: string) => ScreenPoint | null
}) {
  let handle: HTMLDivElement | null = null

  const hide = () => {
    handle?.remove()
    handle = null
  }

  const update = (overlay: { paneId?: string; points: OverlayPoint[] }) => {
    const paneId = overlay.paneId || fallbackPaneId
    const point = resolveOverlayPointPixel(overlay.points[0] ?? {}, paneId)
    const paneMain = chart.getDom(paneId, DomPosition.Main)
    if (!point || !paneMain) {
      hide()
      return
    }
    const rect = paneMain.getBoundingClientRect()
    if (!handle) {
      handle = document.createElement('div')
      handle.style.position = 'fixed'
      handle.style.width = '13px'
      handle.style.height = '13px'
      handle.style.border = `${trendHandleLineWidth}px solid ${trendHandleColor}`
      handle.style.borderRadius = '50%'
      handle.style.background = '#ffffff'
      handle.style.boxSizing = 'border-box'
      handle.style.pointerEvents = 'none'
      handle.style.zIndex = '2147483647'
      document.body.appendChild(handle)
    }
    handle.style.left = `${rect.left + point.x - 6.5}px`
    handle.style.top = `${rect.top + point.y - 6.5}px`
  }

  return {
    hide,
    update,
  }
}
