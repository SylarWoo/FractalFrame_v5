import type { ChartPageNavigation } from '../chartRuntimeTypes'
import { kLineChartConfigV2 } from './klineChartConfigV2'

export type KLineChartRealtimePageLabelNodesV2 = {
  end: PageLabelNode
  realtime: PageLabelNode
  root: HTMLElement
  start: PageLabelNode
}

type PageLabelNode = {
  button: HTMLButtonElement
  node: HTMLDivElement
  text: HTMLSpanElement
}

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  weekday: 'short',
})
const boundaryLabelFormatter = new Intl.DateTimeFormat('zh-CN', {
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
})
const boundaryLabelCache = new Map<string, string>()

function formatBoundaryLabel(seconds: number | null | undefined, suffix: '开盘' | '停盘') {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return ''
  const cacheKey = `${seconds}:${suffix}`
  const cached = boundaryLabelCache.get(cacheKey)
  if (cached != null) return cached
  const date = new Date(seconds * 1000)
  const weekday = weekdayFormatter.format(date)
  const parts = boundaryLabelFormatter.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes, fallback: string) => parts.find((part) => part.type === type)?.value ?? fallback
  const hour = get('hour', '00')
  const label = `${weekday}${suffix} ${get('year', '1970')}/${get('month', '01')}/${get('day', '01')} ${hour === '24' ? '00' : hour}:${get('minute', '00')}`
  boundaryLabelCache.set(cacheKey, label)
  if (boundaryLabelCache.size > 120) {
    const firstKey = boundaryLabelCache.keys().next().value
    if (firstKey) boundaryLabelCache.delete(firstKey)
  }
  return label
}

function normalizeTimestampSeconds(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value > 10_000_000_000 ? Math.floor(value / 1000) : value
}

function createLabelNode(className: string): PageLabelNode {
  const node = document.createElement('div')
  node.className = `ff-kline-chart-realtime-pane-v2__page-label ${className}`
  const inner = document.createElement('div')
  inner.className = 'ff-kline-chart-realtime-pane-v2__page-label-inner'
  const button = document.createElement('button')
  button.className = 'ff-kline-chart-realtime-pane-v2__page-arrow'
  button.type = 'button'
  const text = document.createElement('span')
  inner.append(button, text)
  node.appendChild(inner)
  return { button, node, text }
}

function hideLabel(label: PageLabelNode) {
  label.node.style.display = 'none'
  label.node.onclick = null
  label.button.onclick = null
}

function updateLabel(options: {
  arrow?: '<' | '>'
  label: PageLabelNode
  left: number
  onClick?: () => void
  text: string
  width: number
}) {
  const { button, node, text } = options.label
  node.style.left = `${Math.round(options.left)}px`
  node.style.width = `${Math.max(0, Math.round(options.width))}px`
  node.style.display = options.width < kLineChartConfigV2.overlays.pageBoundaryLabels.labelMinVisibleWidth || !options.text
    ? 'none'
    : 'flex'
  if (options.arrow) {
    button.style.display = 'block'
    button.textContent = options.arrow
    if (options.onClick) {
      node.onclick = options.onClick
      button.onclick = (event) => {
        event.stopPropagation()
        options.onClick?.()
      }
      button.disabled = false
    } else {
      node.onclick = null
      button.onclick = null
      button.disabled = true
    }
  } else {
    button.style.display = 'none'
    node.onclick = null
    button.onclick = null
    button.disabled = true
  }
  if (text.textContent !== options.text) text.textContent = options.text
}

export function createKLineChartRealtimePageLabelsV2(): KLineChartRealtimePageLabelNodesV2 {
  const labelRoot = document.createElement('div')
  labelRoot.className = 'ff-kline-chart-realtime-pane-v2__page-label-root'
  const labels = {
    end: createLabelNode('ff-kline-chart-realtime-pane-v2__page-label--end'),
    realtime: createLabelNode('ff-kline-chart-realtime-pane-v2__page-label--realtime'),
    root: labelRoot,
    start: createLabelNode('ff-kline-chart-realtime-pane-v2__page-label--start'),
  }
  labelRoot.append(labels.start.node, labels.end.node, labels.realtime.node)
  return labels
}

export function updateKLineChartRealtimePageLabelsV2(labels: KLineChartRealtimePageLabelNodesV2, options: {
  boundaryRawX: number
  boundaryX: number | null
  navigation: ChartPageNavigation | null | undefined
  realtimeVisible: boolean
  realtimeActualStart?: number | null
  width: number
}) {
  const navigation = options.navigation
  if (!navigation) {
    labels.root.style.display = 'none'
    hideLabel(labels.start)
    hideLabel(labels.end)
    hideLabel(labels.realtime)
    return
  }
  labels.root.style.display = 'block'

  const historyRightX = options.boundaryRawX > options.width ? options.width : options.boundaryRawX
  const historyWidth = Math.max(0, historyRightX)
  const slotWidth = Math.max(0, (historyWidth - 12) / 2)
  const startLabelInset = kLineChartConfigV2.overlays.pageBoundaryLabels.startLabelInset
  const stopLabelGap = kLineChartConfigV2.overlays.pageBoundaryLabels.stopLabelGap
  updateLabel({
    arrow: '<',
    label: labels.start,
    left: startLabelInset,
    onClick: navigation.older && navigation.onSelectPage ? () => navigation.onSelectPage?.(navigation.older!.index) : undefined,
    text: navigation.current.labelFrom ?? formatBoundaryLabel(navigation.current.timeFrom, '开盘'),
    width: Math.max(0, slotWidth - startLabelInset),
  })
  updateLabel({
    arrow: navigation.newer ? '>' : undefined,
    label: labels.end,
    left: historyRightX - stopLabelGap - slotWidth,
    onClick: navigation.newer && navigation.onSelectPage ? () => navigation.onSelectPage?.(navigation.newer!.index) : undefined,
    text: navigation.current.labelTo ?? formatBoundaryLabel(navigation.current.timeTo, '停盘'),
    width: slotWidth,
  })
  const realtimeLabelGap = kLineChartConfigV2.overlays.pageBoundaryLabels.realtimeLabelGap
  const realtimeLeft = options.boundaryX != null
    ? options.boundaryX + realtimeLabelGap
    : options.boundaryRawX < 0
    ? realtimeLabelGap
    : null
  if (options.realtimeVisible && realtimeLeft != null) {
    updateLabel({
      label: labels.realtime,
      left: realtimeLeft,
      text: typeof options.realtimeActualStart === 'number'
        ? formatBoundaryLabel(normalizeTimestampSeconds(options.realtimeActualStart), '开盘')
        : navigation.realtimeStartLabel ?? formatBoundaryLabel(navigation.realtimeStart, '开盘'),
      width: Math.max(0, options.width - realtimeLeft - 10),
    })
  } else {
    hideLabel(labels.realtime)
  }
}
