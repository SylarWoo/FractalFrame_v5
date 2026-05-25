import { ActionType, DomPosition } from 'klinecharts'
import type { Chart } from 'klinecharts'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'
import { marketStatusTitleChangedEvent } from '../mt5DataCenter/marketStatusTitleState'
import { chartNumberFontFamily } from './chartStyleReaders'
import {
  createPaneTitleLines,
  readCrosshairDataIndex,
  titlePaneSpecs,
} from './paneTitleOverlayContent'
import type { PaneTitleContext, PaneTitleLine, PaneTitlePart } from './paneTitleOverlayContent'
import { chartManualYAxisRangeChangeEvent } from './chartAxisInteraction'
import './paneTitleOverlay.css'

function renderPart(part: PaneTitlePart) {
  const span = document.createElement('span')
  span.className = 'ff-pane-title-overlay__part'
  part.chunks.forEach((chunk) => {
    const chunkSpan = document.createElement('span')
    chunkSpan.className = 'ff-pane-title-overlay__chunk'
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
  row.className = 'ff-pane-title-overlay__row'
  parts.forEach((part) => row.appendChild(renderPart(part)))
  return row
}

function isOverlayMutation(root: HTMLElement, mutations: MutationRecord[]) {
  return mutations.length > 0 && mutations.every((mutation) => {
    const target = mutation.target
    return target === root || root.contains(target)
  })
}

export function installPaneTitleOverlay(chart: Chart, container: HTMLElement, context: PaneTitleContext) {
  let currentContext = context
  let crosshairIndex: number | null = null
  let frameId = 0

  const root = document.createElement('div')
  root.className = 'ff-pane-title-overlay-root'
  root.style.fontFamily = chartNumberFontFamily
  container.appendChild(root)

  function scheduleRender() {
    if (frameId !== 0) return
    frameId = window.requestAnimationFrame(() => {
      frameId = 0
      render()
    })
  }

  const resizeObserver = new ResizeObserver(() => scheduleRender())
  resizeObserver.observe(container)

  const mutationObserver = new MutationObserver((mutations) => {
    if (isOverlayMutation(root, mutations)) return
    scheduleRender()
  })
  mutationObserver.observe(container, { childList: true, subtree: true })

  function renderPane(paneId: string, lines: PaneTitleLine[]) {
    const paneDom = chart.getDom(paneId, DomPosition.Main)
    if (!paneDom || lines.length === 0) return
    const paneRect = paneDom.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    if (paneRect.width <= 0 || paneRect.height <= 0) return

    const title = document.createElement('div')
    title.className = 'ff-pane-title-overlay'
    title.style.left = `${Math.round(paneRect.left - containerRect.left + 10)}px`
    title.style.top = `${Math.round(paneRect.top - containerRect.top + 4)}px`
    title.style.width = `${Math.max(0, Math.round(paneRect.width - 20))}px`
    lines.forEach((line) => title.appendChild(renderLine(line)))
    root.appendChild(title)
  }

  function render() {
    root.replaceChildren()
    titlePaneSpecs.forEach((spec) => {
      renderPane(spec.paneId, createPaneTitleLines(chart, spec, currentContext, crosshairIndex))
    })
  }

  const handleCrosshairChange = (payload: unknown) => {
    crosshairIndex = readCrosshairDataIndex(payload)
    scheduleRender()
  }
  const handleChartChange = () => scheduleRender()
  const handleSettingsChange = () => scheduleRender()

  chart.subscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
  chart.subscribeAction(ActionType.OnDataReady, handleChartChange)
  chart.subscribeAction(ActionType.OnPaneDrag, handleChartChange)
  chart.subscribeAction(ActionType.OnScroll, handleChartChange)
  chart.subscribeAction(ActionType.OnVisibleRangeChange, handleChartChange)
  chart.subscribeAction(ActionType.OnZoom, handleChartChange)
  window.addEventListener('resize', handleChartChange)
  window.addEventListener(chartManualYAxisRangeChangeEvent, handleChartChange)
  window.addEventListener('storage', handleSettingsChange)
  window.addEventListener(settingsSymbolChangedEvent, handleSettingsChange)
  window.addEventListener(marketStatusTitleChangedEvent, handleSettingsChange)
  scheduleRender()

  return {
    destroy() {
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      chart.unsubscribeAction(ActionType.OnCrosshairChange, handleCrosshairChange)
      chart.unsubscribeAction(ActionType.OnDataReady, handleChartChange)
      chart.unsubscribeAction(ActionType.OnPaneDrag, handleChartChange)
      chart.unsubscribeAction(ActionType.OnScroll, handleChartChange)
      chart.unsubscribeAction(ActionType.OnVisibleRangeChange, handleChartChange)
      chart.unsubscribeAction(ActionType.OnZoom, handleChartChange)
      window.removeEventListener('resize', handleChartChange)
      window.removeEventListener(chartManualYAxisRangeChangeEvent, handleChartChange)
      window.removeEventListener('storage', handleSettingsChange)
      window.removeEventListener(settingsSymbolChangedEvent, handleSettingsChange)
      window.removeEventListener(marketStatusTitleChangedEvent, handleSettingsChange)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      root.remove()
    },
    updateContext(nextContext: PaneTitleContext) {
      currentContext = nextContext
      scheduleRender()
    },
    update: scheduleRender,
  }
}
