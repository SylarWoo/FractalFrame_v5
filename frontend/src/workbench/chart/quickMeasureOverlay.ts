import { DomPosition, registerOverlay } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { knownDrawingPaneIds } from '../drawing/drawingPaneModel'
import type { RulerExtendData } from './chartDrawingTypes'
import { createRulerPointFigures, createRulerYAxisFigures } from './rulerOverlayFigures'

const quickMeasureOverlayName = 'ffQuickMeasure'
const quickMeasureZLevel = 9
const quickMeasureUpColor = '#2962ff'
const quickMeasureDownColor = '#f23645'
let quickMeasureOverlayRegistered = false

type QuickMeasurePoint = { dataIndex?: number; timestamp?: number; value?: number }

export function ensureQuickMeasureOverlay() {
  if (quickMeasureOverlayRegistered) return
  quickMeasureOverlayRegistered = true
  registerOverlay({
    name: quickMeasureOverlayName,
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: createQuickMeasurePointFigures,
    createYAxisFigures: createQuickMeasureYAxisFigures,
  })
}

export function createQuickMeasureController({
  chart,
  fallbackPaneId,
}: {
  chart: Chart
  fallbackPaneId: string
}) {
  const cleanups: Array<() => void> = []
  const registeredPanes = new Map<string, { cleanup: () => void; element: HTMLElement }>()
  let enabled = false
  let overlayId: string | null = null
  let startPoint: QuickMeasurePoint | null = null
  let startPaneId = fallbackPaneId

  const destroyOverlay = () => {
    if (overlayId) chart.removeOverlay({ id: overlayId })
    overlayId = null
    startPoint = null
  }

  const resolveEventPoint = (event: MouseEvent, paneId: string): QuickMeasurePoint | null => {
    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return null
    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    const point = chart.convertFromPixel([{ x, y }], { paneId })
    const coordinate = Array.isArray(point) ? point[0] : point
    const dataIndex = Number(coordinate?.dataIndex)
    const timestamp = Number(coordinate?.timestamp)
    const value = Number(coordinate?.value)
    if (!Number.isFinite(value)) return null
    return {
      ...(Number.isFinite(dataIndex) ? { dataIndex } : {}),
      ...(Number.isFinite(timestamp) ? { timestamp } : {}),
      value,
    }
  }

  const createOrUpdateOverlay = (endPoint: QuickMeasurePoint) => {
    if (!startPoint) return
    const points = [startPoint, endPoint]
    if (!overlayId) {
      const createdId = chart.createOverlay({
        name: quickMeasureOverlayName,
        extendData: createQuickMeasureExtendData(points, readQuickMeasureDataList()),
        lock: true,
        points,
        styles: {},
        visible: true,
        zLevel: quickMeasureZLevel,
      })
      overlayId = typeof createdId === 'string' ? createdId : null
      return
    }
    chart.overrideOverlay({
      id: overlayId,
      extendData: createQuickMeasureExtendData(points, readQuickMeasureDataList()),
      points,
    })
  }

  const handleClick = (event: MouseEvent, paneId: string) => {
    if (!enabled) return
    const point = resolveEventPoint(event, paneId)
    if (startPoint) {
      if (!point) return
      event.preventDefault()
      createOrUpdateOverlay(point)
      startPoint = null
      return
    }
    if (!event.shiftKey) {
      destroyOverlay()
      return
    }
    if (!point) return
    event.preventDefault()
    destroyOverlay()
    startPoint = point
    startPaneId = paneId
    createOrUpdateOverlay(point)
  }

  const handleMouseMove = (event: MouseEvent, paneId: string) => {
    if (!enabled || !startPoint || startPaneId !== paneId) return
    const point = resolveEventPoint(event, paneId)
    if (!point) return
    createOrUpdateOverlay(point)
  }

  const ensureListeners = () => {
    knownDrawingPaneIds.forEach((paneId) => {
      const paneMain = chart.getDom(paneId, DomPosition.Main)
      if (!paneMain) return
      const registered = registeredPanes.get(paneId)
      if (registered?.element === paneMain) return
      registered?.cleanup()
      const onClick = (event: MouseEvent) => handleClick(event, paneId)
      const onMove = (event: MouseEvent) => handleMouseMove(event, paneId)
      paneMain.addEventListener('click', onClick, true)
      paneMain.addEventListener('mousemove', onMove)
      const cleanup = () => {
        paneMain.removeEventListener('click', onClick, true)
        paneMain.removeEventListener('mousemove', onMove)
      }
      cleanups.push(cleanup)
      registeredPanes.set(paneId, { cleanup, element: paneMain })
    })
  }

  const cleanup = () => {
    destroyOverlay()
    cleanups.forEach((removeListener) => removeListener())
    cleanups.length = 0
    registeredPanes.clear()
    enabled = false
  }

  return {
    cleanup,
    ensureListeners,
    setEnabled: (nextEnabled: boolean) => {
      enabled = nextEnabled
      if (enabled) ensureListeners()
      else destroyOverlay()
    },
  }

  function readQuickMeasureDataList() {
    return chart.getDataList().map((row) => ({
      real_volume: Number((row as { real_volume?: number }).real_volume),
      tick_volume: Number((row as { tick_volume?: number }).tick_volume),
      timestamp: Number(row.timestamp),
      volume: Number(row.volume),
    }))
  }
}

function createQuickMeasureExtendData(points: QuickMeasurePoint[], dataList: RulerExtendData['dataList'] = []): RulerExtendData {
  const start = Number(points[0]?.value)
  const end = Number(points[1]?.value)
  const upward = Number.isFinite(start) && Number.isFinite(end) ? end >= start : true
  const color = upward ? quickMeasureUpColor : quickMeasureDownColor
  return {
    dataList,
    drawing: false,
    hovered: false,
    lineStyle: {
      hex: color,
      lineStyle: 'solid',
      opacity: 1,
      thickness: 1,
    },
    locked: true,
    manualVisible: true,
    periodVisible: true,
    pressed: false,
    rulerStyle: {
      background: { hex: color, opacity: 0.16 },
      backgroundVisible: true,
      borderLineStyle: {
        hex: color,
        lineStyle: 'solid',
        opacity: 1,
        thickness: 1,
      },
      borderVisible: false,
      labelBackground: { hex: color, opacity: 1 },
      labelBackgroundVisible: true,
      labelColor: { hex: '#ffffff', opacity: 1 },
      labelFontSize: 12,
      statsAlwaysVisible: true,
      statsData: ['price-range', 'percent-change', 'point-change', 'bars-range', 'date-time-range'],
    },
    selected: false,
    showPriceLabel: true,
  }
}

function createQuickMeasurePointFigures(params: Parameters<typeof createRulerPointFigures>[0]) {
  return createRulerPointFigures({
    ...params,
    overlay: {
      ...params.overlay,
      currentStep: 0,
      extendData: createQuickMeasureExtendData(params.overlay.points ?? [], (params.overlay.extendData as RulerExtendData | undefined)?.dataList),
      visible: true,
    },
  })
}

function createQuickMeasureYAxisFigures(params: Parameters<typeof createRulerYAxisFigures>[0]) {
  return createRulerYAxisFigures({
    ...params,
    overlay: {
      ...params.overlay,
      extendData: {
        ...createQuickMeasureExtendData(params.overlay.points ?? [], (params.overlay.extendData as RulerExtendData | undefined)?.dataList),
        selected: true,
      },
      visible: true,
    },
  })
}
