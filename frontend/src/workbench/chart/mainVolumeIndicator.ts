import { ActionType, DomPosition } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import { defaultVolIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import type { VolIndicatorSettings } from '../rightDrawer/indicatorPersistence'

const candlePaneId = 'candle_pane'
const overlayClassName = 'ff-main-volume-overlay-canvas'

type MainVolumeOverlay = {
  destroy: () => void
  updateSettings: (settings?: Partial<VolIndicatorSettings>) => void
}

function clampOpacity(value: unknown, fallback = 1) {
  const next = Number(value)
  return Number.isFinite(next) ? Math.max(0, Math.min(next, 1)) : fallback
}

function clampLineWidth(value: unknown, fallback = 1) {
  const next = Math.round(Number(value))
  return Number.isFinite(next) ? Math.max(1, Math.min(next, 4)) : fallback
}

function colorWithAlpha(hex: string, opacity: number) {
  const normalized = hex.trim().replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return hex
  const value = Number.parseInt(normalized, 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${clampOpacity(opacity)})`
}

function normalizeSettings(settings?: Partial<VolIndicatorSettings>): VolIndicatorSettings {
  return { ...defaultVolIndicatorSettings, ...(settings ?? {}) }
}

function readVolume(row: KLineData) {
  const source = row as KLineData & {
    Volume?: number
    realVolume?: number
    real_volume?: number
    tickVolume?: number
    tick_volume?: number
    vol?: number
  }
  const value = Number(source.volume ?? source.tick_volume ?? source.tickVolume ?? source.real_volume ?? source.realVolume ?? source.vol ?? source.Volume)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function getVolumeColorIndex(dataList: KLineData[], index: number, settings: VolIndicatorSettings): 0 | 1 {
  const current = dataList[index]
  const previous = dataList[index - 1]
  if (settings.colorBasedOnPreviousClose && previous) {
    return Number(current.close) >= Number(previous.close) ? 0 : 1
  }
  return Number(current.close) >= Number(current.open) ? 0 : 1
}

function calculateSma(values: number[], period: number) {
  const result: Array<number | undefined> = values.map(() => undefined)
  let sum = 0
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index]
    if (index >= period) sum -= values[index - period]
    if (index >= period - 1) result[index] = sum / period
  }
  return result
}

function lineDashForStyle(style: VolIndicatorSettings['maLineStyle']) {
  if (style === 'dotted') return [1, 3]
  if (style === 'dashed') return [4, 3]
  return []
}

function resolveVisibleRange(chart: Chart, dataLength: number) {
  const range = chart.getVisibleRange()
  const from = Math.max(0, Math.floor(range.realFrom) - 1)
  const to = Math.min(dataLength - 1, Math.ceil(range.realTo) + 1)
  return { from, to }
}

function resolveVolumeMax(volumes: number[], maValues: Array<number | undefined>, from: number, to: number) {
  let max = 0
  for (let index = from; index <= to; index += 1) {
    const volume = volumes[index]
    if (Number.isFinite(volume)) max = Math.max(max, volume)
    const ma = maValues[index]
    if (Number.isFinite(ma)) max = Math.max(max, ma as number)
  }
  return max > 0 ? max : 1
}

function convertDataIndexToX(chart: Chart, dataList: KLineData[], index: number) {
  const coordinate = chart.convertToPixel({ dataIndex: index, timestamp: dataList[index]?.timestamp, value: dataList[index]?.close }, { paneId: candlePaneId })
  return Array.isArray(coordinate) ? Number.NaN : Number(coordinate.x)
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1
  const nextWidth = Math.max(1, Math.round(width * ratio))
  const nextHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== nextWidth) canvas.width = nextWidth
  if (canvas.height !== nextHeight) canvas.height = nextHeight
  canvas.style.width = `${Math.max(1, Math.round(width))}px`
  canvas.style.height = `${Math.max(1, Math.round(height))}px`
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ctx
}

function drawMainVolumeOverlay(chart: Chart, canvas: HTMLCanvasElement, settings: VolIndicatorSettings) {
  const mainSize = chart.getSize(candlePaneId, DomPosition.Main)
  if (!mainSize || mainSize.width <= 0 || mainSize.height <= 0) return

  const ctx = resizeCanvas(canvas, mainSize.width, mainSize.height)
  if (!ctx) return
  ctx.clearRect(0, 0, mainSize.width, mainSize.height)

  const dataList = chart.getDataList()
  if (dataList.length === 0 || !settings.volumeChecked) return

  const { from, to } = resolveVisibleRange(chart, dataList.length)
  if (to < from) return

  const volumes = dataList.map(readVolume)
  const maLength = Math.max(1, Math.min(Math.round(Number(settings.maLength)), 500))
  const maValues = calculateSma(volumes, maLength)
  const maxVolume = resolveVolumeMax(volumes, maValues, from, to)
  const bandHeight = Math.max(42, Math.min(112, Math.round(mainSize.height * 0.24)))
  const bottomPadding = 4
  const top = mainSize.height - bandHeight - bottomPadding
  const bottom = mainSize.height - bottomPadding
  const barWidth = Math.max(1, Math.floor(chart.getBarSpace() * 0.82))

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, top - 2, mainSize.width, bandHeight + 4)
  ctx.clip()

  for (let index = from; index <= to; index += 1) {
    const volume = volumes[index]
    if (!Number.isFinite(volume)) continue
    const xCenter = convertDataIndexToX(chart, dataList, index)
    if (!Number.isFinite(xCenter)) continue

    const height = Math.max(1, (volume / maxVolume) * (bandHeight - 8))
    const x = Math.round(xCenter - barWidth / 2)
    const y = Math.round(bottom - height)
    ctx.fillStyle = getVolumeColorIndex(dataList, index, settings) === 0
      ? colorWithAlpha(settings.volumeUpColor, settings.volumeUpOpacity)
      : colorWithAlpha(settings.volumeDownColor, settings.volumeDownOpacity)
    ctx.fillRect(x, y, barWidth, Math.round(height))
  }

  if (settings.maChecked) {
    ctx.beginPath()
    ctx.strokeStyle = colorWithAlpha(settings.maColor, settings.maOpacity)
    ctx.lineWidth = clampLineWidth(settings.maLineWidth, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash(lineDashForStyle(settings.maLineStyle))
    let started = false
    for (let index = from; index <= to; index += 1) {
      const ma = maValues[index]
      if (!Number.isFinite(ma)) {
        if (started) {
          ctx.stroke()
          ctx.beginPath()
          started = false
        }
        continue
      }
      const x = convertDataIndexToX(chart, dataList, index)
      if (!Number.isFinite(x)) continue
      const y = bottom - ((ma as number) / maxVolume) * (bandHeight - 8)
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    if (started) ctx.stroke()
  }

  ctx.restore()
}

export function installMainVolumeOverlay(chart: Chart, inputSettings?: Partial<VolIndicatorSettings>): MainVolumeOverlay | null {
  const mainDom = chart.getDom(candlePaneId, DomPosition.Main)
  if (!mainDom) return null

  const canvas = document.createElement('canvas')
  canvas.className = overlayClassName
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '3'

  if (getComputedStyle(mainDom).position === 'static') {
    mainDom.style.position = 'relative'
  }
  mainDom.appendChild(canvas)

  let settings = normalizeSettings(inputSettings)
  let frameId = 0
  const render = () => {
    frameId = 0
    drawMainVolumeOverlay(chart, canvas, settings)
  }
  const scheduleRender = () => {
    if (frameId !== 0) return
    frameId = window.requestAnimationFrame(render)
  }
  const resizeObserver = new ResizeObserver(scheduleRender)
  resizeObserver.observe(mainDom)

  const actions = [
    ActionType.OnDataReady,
    ActionType.OnScroll,
    ActionType.OnVisibleRangeChange,
    ActionType.OnZoom,
  ]
  actions.forEach((action) => chart.subscribeAction(action, scheduleRender))
  scheduleRender()

  return {
    destroy: () => {
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
      actions.forEach((action) => chart.unsubscribeAction(action, scheduleRender))
      canvas.remove()
    },
    updateSettings: (nextSettings) => {
      settings = normalizeSettings(nextSettings)
      scheduleRender()
    },
  }
}
