import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import type { ChartPageNavigation } from '../chartRuntimeTypes'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'
import { readSettingsBooleanValue, readSettingsSymbolState, settingsSymbolChangedEvent } from '../../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../../settings/chartSettingsSchema'
import { kLineChartConfigV2 } from './klineChartConfigV2'
import './klineChartRealtimePaneV2.css'

type VisibleRangeLike = {
  realFrom?: number
  realTo?: number
}

const candlePaneId = 'candle_pane'

type SettingsLineSwatchValue = {
  hex?: string
  lineStyle?: string
  opacity?: number
  thickness?: number
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readVisibleRange(chart: Chart): { realFrom: number; realTo: number } | null {
  const range = chart.getVisibleRange() as VisibleRangeLike
  const realFrom = finiteNumber(range.realFrom)
  const realTo = finiteNumber(range.realTo)
  if (realFrom == null || realTo == null || realTo <= realFrom) return null
  return { realFrom, realTo }
}

function indexToX(index: number, realFrom: number, realTo: number, width: number) {
  return ((index - realFrom) / Math.max(1, realTo - realFrom)) * width
}

export function resolveRealtimeBoundaryIndex(frame: KLineChartRenderFrameV2, navigation?: ChartPageNavigation | null) {
  const realtime = frame.segments.realtime
  if (realtime && realtime.rows > 0) return Math.max(0, realtime.fromIndex)
  if (!navigation) return null
  const history = frame.segments.history
  if (!history || history.rows <= 0) return null
  return Math.max(0, history.toIndex)
}

function resolveSwatchColor(value: unknown, fallback: string) {
  if (!value || typeof value !== 'object' || !('hex' in value)) return fallback
  const swatch = value as SettingsLineSwatchValue
  const hex = typeof swatch.hex === 'string' ? swatch.hex : fallback
  const opacity = typeof swatch.opacity === 'number' && Number.isFinite(swatch.opacity)
    ? Math.max(0, Math.min(swatch.opacity, 1))
    : 1
  if (opacity >= 0.999) return hex
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}

function resolveLineStyle(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsLineSwatchValue : null
  if (swatch?.lineStyle === 'dashed') return 'dashed'
  if (swatch?.lineStyle === 'dotted') return 'dotted'
  return 'solid'
}

function resolveLineThickness(value: unknown) {
  const swatch = value && typeof value === 'object' ? value as SettingsLineSwatchValue : null
  const thickness = typeof swatch?.thickness === 'number' && Number.isFinite(swatch.thickness) ? swatch.thickness : 1
  return Math.max(1, Math.min(Math.round(thickness), 4))
}

function readRealtimeWindowSeparatorStyle() {
  const visible = readSettingsBooleanValue(
    chartSettingKeys.realtimeWindowSeparatorVisible,
    chartSettingDefaults.realtimeWindowSeparatorVisible,
  )
  const swatch = readSettingsSymbolState()['events.realtimeWindowSeparator.color']
  return {
    color: resolveSwatchColor(swatch, '#4984d6'),
    lineStyle: resolveLineStyle(swatch),
    thickness: resolveLineThickness(swatch),
    visible,
  }
}

function resolveRealtimeBoundaryX(options: {
  frame: KLineChartRenderFrameV2
  mainRect: DOMRect
  navigation?: ChartPageNavigation | null
  visibleRange: { realFrom: number; realTo: number }
}) {
  const boundaryIndex = resolveRealtimeBoundaryIndex(options.frame, options.navigation)
  if (boundaryIndex == null) return null
  if (options.visibleRange.realTo < boundaryIndex || options.visibleRange.realFrom > boundaryIndex) return null
  return Math.max(0, Math.min(options.mainRect.width, indexToX(
    boundaryIndex,
    options.visibleRange.realFrom,
    options.visibleRange.realTo,
    options.mainRect.width,
  )))
}

function renderMainOverlay(root: HTMLElement, boundaryX: number | null) {
  root.style.display = 'block'
  const separator = readRealtimeWindowSeparatorStyle()

  const boundary = document.createElement('div')
  boundary.className = 'ff-kline-chart-realtime-pane-v2__boundary'
  if (boundaryX == null || !separator.visible) {
    boundary.style.display = 'none'
  } else {
    boundary.style.left = `${boundaryX}px`
    boundary.style.borderLeftColor = separator.color
    boundary.style.borderLeftStyle = separator.lineStyle
    boundary.style.borderLeftWidth = `${separator.thickness}px`
  }
  root.appendChild(boundary)
}

function formatBoundaryLabel(seconds: number | null | undefined, suffix: '开盘' | '停盘') {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return ''
  const date = new Date(seconds * 1000)
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
  }).format(date)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes, fallback: string) => parts.find((part) => part.type === type)?.value ?? fallback
  const hour = get('hour', '00')
  return `${weekday}${suffix} ${get('year', '1970')}/${get('month', '01')}/${get('day', '01')} ${hour === '24' ? '00' : hour}:${get('minute', '00')}`
}

function normalizeTimestampSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value > 10_000_000_000 ? Math.floor(value / 1000) : value
}

function createLabel(options: {
  arrow?: '<' | '>'
  className: string
  left: number
  onClick?: () => void
  text: string
  width: number
}) {
  const node = document.createElement('div')
  node.className = `ff-kline-chart-realtime-pane-v2__page-label ${options.className}`
  node.style.left = `${Math.round(options.left)}px`
  node.style.width = `${Math.max(0, Math.round(options.width))}px`
  if (options.width < kLineChartConfigV2.overlays.pageBoundaryLabels.labelMinVisibleWidth || !options.text) node.style.display = 'none'
  const inner = document.createElement('div')
  inner.className = 'ff-kline-chart-realtime-pane-v2__page-label-inner'
  if (options.arrow) {
    const button = document.createElement('button')
    button.className = 'ff-kline-chart-realtime-pane-v2__page-arrow'
    button.type = 'button'
    button.textContent = options.arrow
    if (options.onClick) {
      button.onclick = options.onClick
    } else {
      button.disabled = true
    }
    inner.appendChild(button)
  }
  const text = document.createElement('span')
  text.textContent = options.text
  inner.appendChild(text)
  node.appendChild(inner)
  return node
}

function renderPageLabels(root: HTMLElement, options: {
  boundaryRawX: number
  boundaryX: number | null
  navigation: ChartPageNavigation | null | undefined
  realtimeActualStart?: number | null
  width: number
}) {
  const navigation = options.navigation
  if (!navigation) return
  const labelRoot = document.createElement('div')
  labelRoot.className = 'ff-kline-chart-realtime-pane-v2__page-label-root'

  const historyRightX = options.boundaryRawX > options.width ? options.width : options.boundaryRawX
  const historyWidth = Math.max(0, historyRightX)
  const slotWidth = Math.max(0, (historyWidth - 12) / 2)
  const startLabelInset = kLineChartConfigV2.overlays.pageBoundaryLabels.startLabelInset
  const stopLabelGap = kLineChartConfigV2.overlays.pageBoundaryLabels.stopLabelGap
  labelRoot.appendChild(createLabel({
    arrow: '<',
    className: 'ff-kline-chart-realtime-pane-v2__page-label--start',
    left: startLabelInset,
    onClick: navigation.older && navigation.onSelectPage ? () => navigation.onSelectPage?.(navigation.older!.index) : undefined,
    text: navigation.current.labelFrom ?? formatBoundaryLabel(navigation.current.timeFrom, '开盘'),
    width: Math.max(0, slotWidth - startLabelInset),
  }))
  labelRoot.appendChild(createLabel({
    arrow: navigation.newer ? '>' : undefined,
    className: 'ff-kline-chart-realtime-pane-v2__page-label--end',
    left: historyRightX - stopLabelGap - slotWidth,
    onClick: navigation.newer && navigation.onSelectPage ? () => navigation.onSelectPage?.(navigation.newer!.index) : undefined,
    text: navigation.current.labelTo ?? formatBoundaryLabel(navigation.current.timeTo, '停盘'),
    width: slotWidth,
  }))
  const realtimeLabelGap = kLineChartConfigV2.overlays.pageBoundaryLabels.realtimeLabelGap
  const realtimeLeft = options.boundaryX != null
    ? options.boundaryX + realtimeLabelGap
    : options.boundaryRawX < 0
    ? realtimeLabelGap
    : null
  if (realtimeLeft != null) {
    labelRoot.appendChild(createLabel({
      className: 'ff-kline-chart-realtime-pane-v2__page-label--realtime',
      left: realtimeLeft,
      text: typeof options.realtimeActualStart === 'number'
        ? formatBoundaryLabel(normalizeTimestampSeconds(options.realtimeActualStart), '开盘')
        : navigation.realtimeStartLabel ?? formatBoundaryLabel(navigation.realtimeStart, '开盘'),
      width: Math.max(0, options.width - realtimeLeft - 10),
    }))
  }
  root.appendChild(labelRoot)
}

export function resolveRealtimeFutureAxisGeometry() {
  return null
}

export function installKLineChartRealtimePaneV2(
  chart: Chart,
  container: HTMLElement,
  initialFrame: KLineChartRenderFrameV2,
  initialPageNavigation?: ChartPageNavigation | null,
) {
  let frame = initialFrame
  let pageNavigation = initialPageNavigation ?? null
  let frameId = 0
  let destroyed = false

  const mainRoot = document.createElement('div')
  mainRoot.className = 'ff-kline-chart-realtime-pane-v2'
  container.appendChild(mainRoot)

  function render() {
    if (destroyed) return
    frameId = 0
    const mainDom = chart.getDom(candlePaneId, DomPosition.Main)
    if (!mainDom) {
      mainRoot.replaceChildren()
      renderMainOverlay(mainRoot, null)
      return
    }
    const containerRect = container.getBoundingClientRect()
    const paneRect = mainDom.getBoundingClientRect()
    const visibleRange = readVisibleRange(chart)
    if (!visibleRange) {
      mainRoot.replaceChildren()
      renderMainOverlay(mainRoot, null)
      return
    }
    mainRoot.style.left = `${Math.round(paneRect.left - containerRect.left)}px`
    mainRoot.style.top = `${Math.round(paneRect.top - containerRect.top)}px`
    mainRoot.style.width = `${Math.round(paneRect.width)}px`
    mainRoot.style.height = `${Math.round(paneRect.height)}px`

    mainRoot.replaceChildren()
    const realtime = frame.segments.realtime
    const boundaryIndex = resolveRealtimeBoundaryIndex(frame, pageNavigation)
    const boundaryRawX = boundaryIndex != null
      ? indexToX(boundaryIndex, visibleRange.realFrom, visibleRange.realTo, paneRect.width)
      : paneRect.width + 1
    const boundaryX = resolveRealtimeBoundaryX({ frame, mainRect: paneRect, navigation: pageNavigation, visibleRange })
    renderMainOverlay(mainRoot, boundaryX)
    renderPageLabels(mainRoot, {
      boundaryRawX,
      boundaryX,
      navigation: pageNavigation,
      realtimeActualStart: realtime?.timeFrom ?? null,
      width: paneRect.width,
    })
  }

  function scheduleRender() {
    if (destroyed || frameId !== 0) return
    frameId = window.requestAnimationFrame(render)
  }

  const handleChartChange = () => scheduleRender()
  chart.subscribeAction(ActionType.OnDataReady, handleChartChange)
  chart.subscribeAction(ActionType.OnScroll, handleChartChange)
  chart.subscribeAction(ActionType.OnVisibleRangeChange, handleChartChange)
  chart.subscribeAction(ActionType.OnZoom, handleChartChange)
  window.addEventListener(settingsSymbolChangedEvent, handleChartChange)
  window.addEventListener('resize', handleChartChange)
  scheduleRender()

  return {
    destroy() {
      destroyed = true
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      chart.unsubscribeAction(ActionType.OnDataReady, handleChartChange)
      chart.unsubscribeAction(ActionType.OnScroll, handleChartChange)
      chart.unsubscribeAction(ActionType.OnVisibleRangeChange, handleChartChange)
      chart.unsubscribeAction(ActionType.OnZoom, handleChartChange)
      window.removeEventListener(settingsSymbolChangedEvent, handleChartChange)
      window.removeEventListener('resize', handleChartChange)
      mainRoot.remove()
    },
    scheduleRender,
    updateFrame(nextFrame: KLineChartRenderFrameV2) {
      frame = nextFrame
      scheduleRender()
    },
    updatePageNavigation(nextPageNavigation?: ChartPageNavigation | null) {
      pageNavigation = nextPageNavigation ?? null
      scheduleRender()
    },
  }
}
