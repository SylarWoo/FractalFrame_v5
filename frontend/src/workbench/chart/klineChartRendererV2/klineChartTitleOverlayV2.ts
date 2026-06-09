import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { chartManualYAxisRangeChangeEvent } from '../chartAxisInteraction'
import { chartNumberFontFamily } from '../chartStyleReaders'
import {
  createPaneTitleLines,
  readCrosshairDataIndex,
  titlePaneSpecs,
} from '../paneTitleOverlayContent'
import type { PaneTitleContext, PaneTitleLine, PaneTitlePart, PaneTitlePart as PaneTitlePartType } from '../paneTitleOverlayContent'
import {
  isKLineChartHorizontalDragInProgressV2,
  kLineChartHorizontalDragEndEventV2,
} from './klineChartInteractionStateV2'
import './klineChartTitleOverlayV2.css'

function renderPart(part: PaneTitlePartType) {
  const span = document.createElement('span')
  span.className = 'ff-kline-chart-title-overlay-v2__part'
  part.chunks.forEach((chunk) => {
    const chunkSpan = document.createElement('span')
    chunkSpan.className = 'ff-kline-chart-title-overlay-v2__chunk'
    chunkSpan.textContent = chunk.text
    if (chunk.alignSelf) chunkSpan.style.alignSelf = chunk.alignSelf
    if (chunk.backgroundColor) chunkSpan.style.backgroundColor = chunk.backgroundColor
    if (chunk.borderRadius) chunkSpan.style.borderRadius = chunk.borderRadius
    if (chunk.color) chunkSpan.style.color = chunk.color
    if (chunk.fontSize) chunkSpan.style.fontSize = chunk.fontSize
    if (chunk.gapBefore != null) chunkSpan.style.marginLeft = `${chunk.gapBefore}px`
    if (chunk.height) chunkSpan.style.height = chunk.height
    if (chunk.paddingLeft) chunkSpan.style.paddingLeft = chunk.paddingLeft
    if (chunk.paddingRight) chunkSpan.style.paddingRight = chunk.paddingRight
    if (chunk.position) chunkSpan.style.position = chunk.position
    if (chunk.width) chunkSpan.style.width = chunk.width
    if (chunk.width || chunk.height) {
      chunkSpan.style.boxSizing = 'border-box'
      chunkSpan.style.flex = '0 0 auto'
      chunkSpan.style.lineHeight = '0'
      chunkSpan.style.verticalAlign = 'middle'
    }
    if (chunk.translateY) {
      chunkSpan.style.display = 'inline-block'
      chunkSpan.style.transform = `translate(${chunk.translateX ?? '0'}, ${chunk.translateY})`
    } else if (chunk.translateX) {
      chunkSpan.style.display = 'inline-block'
      chunkSpan.style.transform = `translateX(${chunk.translateX})`
    }
    span.appendChild(chunkSpan)
  })
  return span
}

function renderLine(parts: PaneTitlePart[]) {
  const row = document.createElement('div')
  row.className = 'ff-kline-chart-title-overlay-v2__row'
  parts.forEach((part) => row.appendChild(renderPart(part)))
  return row
}

export function installKLineChartTitleOverlayV2(chart: Chart, container: HTMLElement, context: PaneTitleContext) {
  let currentContext = context
  let crosshairIndex: number | null = null
  let frameId = 0
  let lastRenderSignature = ''

  const root = document.createElement('div')
  root.className = 'ff-kline-chart-title-overlay-v2'
  root.style.fontFamily = chartNumberFontFamily
  container.appendChild(root)

  function renderPane(left: number, top: number, width: number, lines: PaneTitleLine[]) {
    const title = document.createElement('div')
    title.className = 'ff-kline-chart-title-overlay-v2__pane'
    title.style.left = `${left}px`
    title.style.top = `${top}px`
    title.style.width = `${width}px`
    lines.forEach((line) => title.appendChild(renderLine(line)))
    root.appendChild(title)
  }

  function render() {
    const containerRect = container.getBoundingClientRect()
    const entries = titlePaneSpecs.flatMap((spec) => {
      const lines = createPaneTitleLines(chart, spec, currentContext, crosshairIndex)
      if (lines.length === 0) return []
      const paneDom = chart.getDom(spec.paneId, DomPosition.Main)
      if (!paneDom) return []
      const paneRect = paneDom.getBoundingClientRect()
      if (paneRect.width <= 0 || paneRect.height <= 0) return []
      return [{
        left: Math.round(paneRect.left - containerRect.left + 10),
        lines,
        paneId: spec.paneId,
        top: Math.round(paneRect.top - containerRect.top + 4),
        width: Math.max(0, Math.round(paneRect.width - 20)),
      }]
    })
    const renderSignature = JSON.stringify(entries)
    if (renderSignature === lastRenderSignature) return
    lastRenderSignature = renderSignature
    root.replaceChildren()
    entries.forEach((entry) => renderPane(entry.left, entry.top, entry.width, entry.lines))
  }

  function scheduleRender() {
    if (frameId !== 0) return
    frameId = window.requestAnimationFrame(() => {
      frameId = 0
      render()
    })
  }

  function scheduleRenderAfterHorizontalDrag() {
    if (isKLineChartHorizontalDragInProgressV2()) return
    scheduleRender()
  }

  const handleCrosshairChange = (payload: unknown) => {
    const nextIndex = readCrosshairDataIndex(payload)
    if (nextIndex === crosshairIndex) return
    crosshairIndex = nextIndex
    scheduleRender()
  }
  const handleChartChange = () => scheduleRender()

  chart.subscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
  chart.subscribeAction(ActionType.OnDataReady, handleChartChange)
  chart.subscribeAction(ActionType.OnPaneDrag, scheduleRenderAfterHorizontalDrag)
  chart.subscribeAction(ActionType.OnZoom, handleChartChange)
  window.addEventListener(kLineChartHorizontalDragEndEventV2, handleChartChange)
  window.addEventListener('resize', handleChartChange)
  window.addEventListener(chartManualYAxisRangeChangeEvent, handleChartChange)
  scheduleRender()

  return {
    destroy() {
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      chart.unsubscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
      chart.unsubscribeAction(ActionType.OnDataReady, handleChartChange)
      chart.unsubscribeAction(ActionType.OnPaneDrag, scheduleRenderAfterHorizontalDrag)
      chart.unsubscribeAction(ActionType.OnZoom, handleChartChange)
      window.removeEventListener(kLineChartHorizontalDragEndEventV2, handleChartChange)
      window.removeEventListener('resize', handleChartChange)
      window.removeEventListener(chartManualYAxisRangeChangeEvent, handleChartChange)
      root.remove()
    },
    updateContext(nextContext: PaneTitleContext) {
      currentContext = nextContext
      lastRenderSignature = ''
      scheduleRender()
    },
    update() {
      lastRenderSignature = ''
      scheduleRender()
    },
  }
}
