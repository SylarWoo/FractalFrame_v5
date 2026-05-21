import { ActionType, DomPosition } from 'klinecharts'
import type { Chart, KLineData } from 'klinecharts'
import {
  defaultMacdIndicatorSettings,
  defaultMaIndicatorSettings,
  defaultRsiIndicatorSettings,
  defaultStochIndicatorSettings,
  defaultTsiIndicatorSettings,
  defaultViIndicatorSettings,
  defaultVolIndicatorSettings,
  defaultVwapIndicatorSettings,
} from '../rightDrawer/indicatorPersistence'
import { readSettingsBooleanValue, readSettingsSymbolState, settingsSymbolChangedEvent } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { chartNumberFontFamily, readCandleBarStyle, resolveCandleValueColor, resolveStatusTitle } from './chartStyleReaders'
import { mainVolumeIndicatorName } from './mainVolumeIndicator'
import './paneTitleOverlay.css'

type PaneTitleContext = {
  displayName?: string
  period: string
  symbol: string
}

type PaneTitleChunk = {
  color?: string
  gapBefore?: number
  text: string
}

type PaneTitlePart = {
  chunks: PaneTitleChunk[]
}

type PaneTitleLine = PaneTitlePart[]

type IndicatorLike = {
  calcParams?: unknown[]
  result?: Array<Record<string, unknown>>
}

const titlePaneSpecs = [
  { paneId: 'candle_pane', name: 'candle' },
  { paneId: 'macd_pane', name: 'MACD' },
  { paneId: 'rsi_pane', name: 'RSI' },
  { paneId: 'stoch_pane', name: 'Stoch' },
  { paneId: 'tsi_pane', name: 'TSI' },
  { paneId: 'vi_pane', name: 'VI' },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object'
}

function indicatorFromChart(chart: Chart, paneId: string, name: string): IndicatorLike | null {
  const indicator = chart.getIndicatorByPaneId(paneId, name)
  return isRecord(indicator) ? indicator as IndicatorLike : null
}

function numberValue(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function opacityValue(value: unknown, fallback: number) {
  const opacity = numberValue(value)
  return opacity == null ? fallback : Math.max(0, Math.min(opacity, 1))
}

function colorWithAlpha(hex: string, alpha = 1) {
  const normalized = hex.trim().replace('#', '')
  if (!/^[\da-f]{6}$/i.test(normalized)) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(alpha, 1))})`
}

function titlePart(text: string, color?: string): PaneTitlePart {
  return { chunks: [{ color, text }] }
}

function titleGroup(chunks: PaneTitleChunk[]): PaneTitlePart {
  return { chunks }
}

function precisionDigits(value: unknown, fallback: number) {
  if (value === 'system') return fallback
  const digits = numberValue(value)
  return digits == null ? fallback : Math.max(0, Math.min(Math.round(digits), 8))
}

function formatNumber(value: unknown, precision: unknown, fallbackDigits: number) {
  const number = numberValue(value)
  if (number == null) return '--'
  return number.toFixed(precisionDigits(precision, fallbackDigits)).replace(/\.?0+$/, '')
}

function formatPrice(value: unknown) {
  const number = numberValue(value)
  if (number == null) return '--'
  return number.toFixed(3)
}

function readTooltipIndex(chart: Chart, crosshairIndex: number | null, resultLength: number) {
  if (resultLength <= 0) return 0
  if (crosshairIndex != null && crosshairIndex >= 0) return Math.min(crosshairIndex, resultLength - 1)
  const visibleRange = chart.getVisibleRange()
  return Math.max(0, Math.min(Math.floor(visibleRange.realTo), resultLength - 1))
}

function readIndicatorRow(chart: Chart, indicator: IndicatorLike, crosshairIndex: number | null) {
  const result = indicator.result ?? []
  return result[readTooltipIndex(chart, crosshairIndex, result.length)] ?? {}
}

function mergeSettings<T extends Record<string, unknown>>(fallback: T, input: unknown): T {
  return { ...fallback, ...(isRecord(input) ? input : {}) }
}

function readStatusInputsVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorInputsVisible, chartSettingDefaults.statusIndicatorInputsVisible)
}

function readStatusValuesVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorValuesVisible, chartSettingDefaults.statusIndicatorValuesVisible)
}

function readIndicatorTitleVisible() {
  return readSettingsBooleanValue(chartSettingKeys.statusIndicatorTooltipVisible, chartSettingDefaults.statusIndicatorTooltipVisible)
}

function createCandleParts(chart: Chart, context: PaneTitleContext, crosshairIndex: number | null): PaneTitlePart[] {
  const dataList = chart.getDataList()
  const index = readTooltipIndex(chart, crosshairIndex, dataList.length)
  const current = dataList[index] as KLineData | undefined
  const settings = readSettingsSymbolState()
  const valuesVisible = settings[chartSettingKeys.statusChartValuesVisible] !== false
  const changeVisible = settings[chartSettingKeys.statusCandleChangeVisible] !== false
  const volumeVisible = settings[chartSettingKeys.statusCandleVolumeVisible] !== false
  const timeVisible = settings[chartSettingKeys.statusCandleTimeVisible] !== false
  const barStyle = readCandleBarStyle()
  const valueColor = current ? resolveCandleValueColor(current, barStyle) : '#787b86'
  const statusTitle = resolveStatusTitle(context.symbol, context.displayName)
  const parts: PaneTitlePart[] = statusTitle ? [titlePart(`${statusTitle} ${context.period}`)] : []

  if (valuesVisible && current) {
    parts.push(titleGroup([
      { text: 'O:' },
      { color: valueColor, text: formatPrice(current.open) },
      { gapBefore: 10, text: 'H:' },
      { color: valueColor, text: formatPrice(current.high) },
      { gapBefore: 10, text: 'L:' },
      { color: valueColor, text: formatPrice(current.low) },
      { gapBefore: 10, text: 'C:' },
      { color: valueColor, text: formatPrice(current.close) },
    ]))
  }

  if (changeVisible && current) {
    const open = numberValue(current.open)
    const close = numberValue(current.close)
    const change = open != null && close != null && open !== 0 ? ((close - open) / open) * 100 : undefined
    const changeColor = change != null && change < 0 ? barStyle.downColor : barStyle.upColor
    parts.push(titleGroup([
      { text: 'Chg:' },
      { color: changeColor, text: change == null ? '--' : `${change.toFixed(2)}%` },
    ]))
  }

  if (current && (volumeVisible || timeVisible)) {
    parts.push(titleGroup([
      ...(volumeVisible ? [
        { text: 'Volume:' },
        { text: formatNumber(current.volume, 0, 0) },
      ] : []),
      ...(timeVisible ? [
        { gapBefore: volumeVisible ? 12 : 0, text: 'Time:' },
        { text: new Date(Number(current.timestamp)).toLocaleString('zh-CN', { hour12: false }) },
      ] : []),
    ]))
  }
  return parts
}

function createCandleLines(chart: Chart, context: PaneTitleContext, crosshairIndex: number | null): PaneTitleLine[] {
  return [
    createCandleParts(chart, context, crosshairIndex),
    ...createCandleIndicatorLines(chart, crosshairIndex),
  ].filter((line) => line.length > 0)
}

function createMacdParts(chart: Chart, indicator: IndicatorLike, crosshairIndex: number | null): PaneTitlePart[] {
  const settings = mergeSettings(defaultMacdIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts: PaneTitlePart[] = [titlePart(`MACD${booleanValue(settings.inputStatusLineVisible, true) && readStatusInputsVisible() ? ` ${settings.fastLength} ${settings.slowLength} ${settings.signalLength}` : ''}`)]
  if (booleanValue(settings.statusLineValuesVisible, true) && readStatusValuesVisible()) {
    if (booleanValue(settings.macdVisible, true)) parts.push(titlePart(`MACD ${formatNumber(row.macd, settings.precision, 4)}`, colorWithAlpha(stringValue(settings.macdColor, '#2962ff'), opacityValue(settings.macdOpacity, 1))))
    if (booleanValue(settings.signalVisible, true)) parts.push(titlePart(`Signal ${formatNumber(row.signal, settings.precision, 4)}`, colorWithAlpha(stringValue(settings.signalColor, '#ff6d00'), opacityValue(settings.signalOpacity, 1))))
    if (booleanValue(settings.histogramVisible, true)) parts.push(titlePart(`Histogram ${formatNumber(row.histogram, settings.precision, 4)}`, colorWithAlpha(stringValue(settings.histogramColor0, '#26a69a'), opacityValue(settings.histogramColor0Opacity, 1))))
  }
  return parts
}

function createRsiParts(chart: Chart, indicator: IndicatorLike, crosshairIndex: number | null): PaneTitlePart[] {
  const settings = mergeSettings(defaultRsiIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts: PaneTitlePart[] = [titlePart(`RSI${readStatusInputsVisible() ? ` ${settings.length} ${settings.smoothingLength}` : ''}`)]
  if (readStatusValuesVisible()) {
    if (booleanValue(settings.rsiVisible, true)) parts.push(titlePart(`RSI ${formatNumber(row.rsi, settings.precision, 2)}`, colorWithAlpha(stringValue(settings.rsiColor, '#2962ff'), opacityValue(settings.rsiOpacity, 1))))
    if (booleanValue(settings.rsiMaVisible, true)) parts.push(titlePart(`MA ${formatNumber(row.rsiMa, settings.precision, 2)}`, colorWithAlpha(stringValue(settings.rsiMaColor, '#ff6d00'), opacityValue(settings.rsiMaOpacity, 1))))
  }
  return parts
}

function createStochParts(chart: Chart, indicator: IndicatorLike, crosshairIndex: number | null): PaneTitlePart[] {
  const settings = mergeSettings(defaultStochIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts: PaneTitlePart[] = [titlePart(`Stoch${booleanValue(settings.inputStatusLineVisible, true) && readStatusInputsVisible() ? ` ${settings.length} ${settings.kSmoothing} ${settings.dSmoothing}` : ''}`)]
  if (booleanValue(settings.statusLineValuesVisible, true) && readStatusValuesVisible()) {
    if (booleanValue(settings.kVisible, true)) parts.push(titlePart(`%K ${formatNumber(row.k, settings.precision, 2)}`, colorWithAlpha(stringValue(settings.kColor, '#2962ff'), opacityValue(settings.kOpacity, 1))))
    if (booleanValue(settings.dVisible, true)) parts.push(titlePart(`%D ${formatNumber(row.d, settings.precision, 2)}`, colorWithAlpha(stringValue(settings.dColor, '#ff6d00'), opacityValue(settings.dOpacity, 1))))
  }
  return parts
}

function createTsiParts(chart: Chart, indicator: IndicatorLike, crosshairIndex: number | null): PaneTitlePart[] {
  const settings = mergeSettings(defaultTsiIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts: PaneTitlePart[] = [titlePart(`TSI${booleanValue(settings.inputStatusLineVisible, true) && readStatusInputsVisible() ? ` ${settings.longLength} ${settings.shortLength} ${settings.signalLength}` : ''}`)]
  if (booleanValue(settings.statusLineValuesVisible, true) && readStatusValuesVisible()) {
    if (booleanValue(settings.tsiVisible, true)) parts.push(titlePart(`TSI ${formatNumber(row.tsi, settings.precision, 2)}`, colorWithAlpha(stringValue(settings.tsiColor, '#2962ff'), opacityValue(settings.tsiOpacity, 1))))
    if (booleanValue(settings.signalVisible, true)) parts.push(titlePart(`Signal ${formatNumber(row.signal, settings.precision, 2)}`, colorWithAlpha(stringValue(settings.signalColor, '#ff6d00'), opacityValue(settings.signalOpacity, 1))))
  }
  return parts
}

function createViParts(chart: Chart, indicator: IndicatorLike, crosshairIndex: number | null): PaneTitlePart[] {
  const settings = mergeSettings(defaultViIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts: PaneTitlePart[] = [titlePart(`VI${booleanValue(settings.inputStatusLineVisible, true) && readStatusInputsVisible() ? ` ${settings.length}` : ''}`)]
  if (booleanValue(settings.statusLineValuesVisible, true) && readStatusValuesVisible()) {
    if (booleanValue(settings.plusVisible, true)) parts.push(titlePart(`VI + ${formatNumber(row.plus, settings.precision, 4)}`, colorWithAlpha(stringValue(settings.plusColor, '#2962ff'), opacityValue(settings.plusOpacity, 1))))
    if (booleanValue(settings.minusVisible, true)) parts.push(titlePart(`VI - ${formatNumber(row.minus, settings.precision, 4)}`, colorWithAlpha(stringValue(settings.minusColor, '#ff1744'), opacityValue(settings.minusOpacity, 1))))
  }
  return parts
}

function createCandleMaParts(chart: Chart, crosshairIndex: number | null) {
  const indicator = indicatorFromChart(chart, 'candle_pane', 'MA')
  if (!indicator) return []
  const settings = mergeSettings(defaultMaIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts = [titlePart(`MA${booleanValue(settings.inputStatusLineVisible, true) && readStatusInputsVisible() ? ` ${settings.length}` : ''}`)]
  if (booleanValue(settings.statusLineValuesVisible, true) && readStatusValuesVisible()) {
    const colorIndex = Math.max(0, Math.round(numberValue(row.maColorIndex) ?? 0))
    const colors = Array.isArray(settings.colors) ? settings.colors : defaultMaIndicatorSettings.colors
    parts.push(titlePart(formatNumber(row.ma, settings.precision, 3), colorWithAlpha(stringValue(colors[colorIndex], stringValue(settings.maLineColor, '#131722')), opacityValue(settings.maLineOpacity, 1))))
  }
  return parts
}

function createCandleVwapParts(chart: Chart, crosshairIndex: number | null) {
  const indicator = indicatorFromChart(chart, 'candle_pane', 'VWAP')
  if (!indicator) return []
  const settings = mergeSettings(defaultVwapIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts = [titlePart(`VWAP${booleanValue(settings.inputsInStatusLine, true) && readStatusInputsVisible() ? ` ${settings.anchorPeriod} ${settings.source}` : ''}`)]
  if (booleanValue(settings.statusLineValuesVisible, true) && readStatusValuesVisible() && booleanValue(settings.vwapVisible, true)) {
    parts.push(titlePart(formatNumber(row.vwap, settings.precision, 3), colorWithAlpha(stringValue(settings.vwapColor, '#2962ff'), opacityValue(settings.vwapOpacity, 1))))
  }
  return parts
}

function createCandleVolParts(chart: Chart, crosshairIndex: number | null) {
  const indicator = indicatorFromChart(chart, 'candle_pane', mainVolumeIndicatorName)
  if (!indicator) return []
  const settings = mergeSettings(defaultVolIndicatorSettings, indicator.calcParams?.[0])
  const row = readIndicatorRow(chart, indicator, crosshairIndex)
  const parts = [titlePart(`Vol${booleanValue(settings.inputsInStatusLine, true) && readStatusInputsVisible() ? ` ${settings.maLength}` : ''}`)]
  if (booleanValue(settings.valuesInStatusLine, true) && readStatusValuesVisible()) {
    const isUp = numberValue(row.volumeColorIndex) === 0
    const volumeColor = isUp
      ? colorWithAlpha(stringValue(settings.volumeUpColor, '#26a69a'), opacityValue(settings.volumeUpOpacity, 1))
      : colorWithAlpha(stringValue(settings.volumeDownColor, '#ef5350'), opacityValue(settings.volumeDownOpacity, 1))
    parts.push(titlePart(formatNumber(row.volume, settings.precision, 0), volumeColor))
    if (booleanValue(settings.maChecked, false)) {
      parts.push(titlePart(`MA ${formatNumber(row.volumeMa, settings.precision, 0)}`, colorWithAlpha(stringValue(settings.maColor, '#91a7ff'), opacityValue(settings.maOpacity, 1))))
    }
  }
  return parts
}

function createCandleIndicatorLines(chart: Chart, crosshairIndex: number | null): PaneTitleLine[] {
  if (!readIndicatorTitleVisible()) return []
  return [
    createCandleVolParts(chart, crosshairIndex),
    createCandleMaParts(chart, crosshairIndex),
    createCandleVwapParts(chart, crosshairIndex),
  ].filter((line) => line.length > 0)
}

function createIndicatorParts(chart: Chart, paneId: string, name: string, crosshairIndex: number | null) {
  if (!readIndicatorTitleVisible()) return []
  const indicator = indicatorFromChart(chart, paneId, name)
  if (!indicator) return []
  if (name === 'MACD') return createMacdParts(chart, indicator, crosshairIndex)
  if (name === 'RSI') return createRsiParts(chart, indicator, crosshairIndex)
  if (name === 'Stoch') return createStochParts(chart, indicator, crosshairIndex)
  if (name === 'TSI') return createTsiParts(chart, indicator, crosshairIndex)
  if (name === 'VI') return createViParts(chart, indicator, crosshairIndex)
  return []
}

function readCrosshairDataIndex(payload: unknown) {
  if (!isRecord(payload)) return null
  const direct = numberValue(payload.dataIndex)
  if (direct != null) return Math.round(direct)
  const crosshair = payload.crosshair
  if (!isRecord(crosshair)) return null
  const nested = numberValue(crosshair.dataIndex)
  return nested == null ? null : Math.round(nested)
}

export function installPaneTitleOverlay(chart: Chart, container: HTMLElement, context: PaneTitleContext) {
  let currentContext = context
  let crosshairIndex: number | null = null
  let frameId = 0

  const root = document.createElement('div')
  root.className = 'ff-pane-title-overlay-root'
  root.style.fontFamily = chartNumberFontFamily
  container.appendChild(root)

  const resizeObserver = new ResizeObserver(() => scheduleRender())
  resizeObserver.observe(container)

  const mutationObserver = new MutationObserver(() => scheduleRender())
  mutationObserver.observe(container, { childList: true, subtree: true })

  function scheduleRender() {
    if (frameId !== 0) return
    frameId = window.requestAnimationFrame(() => {
      frameId = 0
      render()
    })
  }

  function renderPart(part: PaneTitlePart) {
    const span = document.createElement('span')
    span.className = 'ff-pane-title-overlay__part'
    part.chunks.forEach((chunk) => {
      const chunkSpan = document.createElement('span')
      chunkSpan.className = 'ff-pane-title-overlay__chunk'
      chunkSpan.textContent = chunk.text
      if (chunk.color) chunkSpan.style.color = chunk.color
      if (chunk.gapBefore != null) chunkSpan.style.marginLeft = `${chunk.gapBefore}px`
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
    titlePaneSpecs.forEach(({ name, paneId }) => {
      const lines = name === 'candle'
        ? createCandleLines(chart, currentContext, crosshairIndex)
        : [createIndicatorParts(chart, paneId, name, crosshairIndex)]
      renderPane(paneId, lines)
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
  window.addEventListener('storage', handleSettingsChange)
  window.addEventListener(settingsSymbolChangedEvent, handleSettingsChange)
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
      window.removeEventListener('storage', handleSettingsChange)
      window.removeEventListener(settingsSymbolChangedEvent, handleSettingsChange)
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
