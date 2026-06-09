import { ActionType, DomPosition } from 'klinecharts'
import type { Chart, Coordinate, KLineData } from 'klinecharts'
import { chartManualYAxisRangeChangeEvent } from '../chartAxisInteraction'
import { resolvePeriodSeconds } from '../chartTimeFormatting'
import { lastRealKLine } from '../chartFuturePlaceholders'
import { readCandleBarStyle, resolveCandleValueColor } from '../chartStyleReaders'
import { readCurrentCandleCountdownActive } from '../currentCandleCountdownVisibility'
import { formatGlobalPrice } from '../globalPricePrecision'
import { clampPriceMarkerTop } from '../priceMarkerPosition'
import { formatCountdown, resolveCountdownEndTimestamp } from '../useCurrentCandleCountdown'
import { settingsSymbolChangedEvent } from '../../settingsSymbolState'
import { marketStatusTitleChangedEvent } from '../../mt5DataCenter/marketStatusTitleState'
import { realtimeEnabledChangedEvent } from '../../mt5DataCenter/storeV6Persistence'
import {
  isKLineChartHorizontalDragInProgressV2,
  kLineChartHorizontalDragEndEventV2,
} from './klineChartInteractionStateV2'

const candlePaneId = 'candle_pane'

type AxisLabelLayerContext = {
  period: string
  symbol: string
}

function isCoordinate(value: Partial<Coordinate> | Partial<Coordinate>[]): value is Partial<Coordinate> {
  return !Array.isArray(value)
}

function readLatestRealKLine(chart: Chart) {
  return lastRealKLine(chart.getDataList() as KLineData[])
}

function readCoordinateY(chart: Chart, row: KLineData) {
  const close = Number(row.close)
  const timestamp = Number(row.timestamp)
  if (!Number.isFinite(close) || !Number.isFinite(timestamp)) return null
  const pixel = chart.convertToPixel({ timestamp, value: close }, { paneId: candlePaneId })
  const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
  const y = Number(coordinate?.y)
  return Number.isFinite(y) ? y : null
}

function setHidden(node: HTMLElement) {
  node.style.display = 'none'
}

function setVisible(node: HTMLElement) {
  node.style.display = 'flex'
}

export function installKLineChartAxisLabelLayerV2(
  chart: Chart,
  container: HTMLElement,
  getContext: () => AxisLabelLayerContext,
) {
  const root = document.createElement('div')
  root.className = 'ff-kline-chart-axis-label-layer-v2'

  const label = document.createElement('div')
  label.className = 'ff-chart-current-candle-countdown ff-kline-chart-axis-label-layer-v2__current-candle-countdown'

  const price = document.createElement('span')
  const countdown = document.createElement('span')
  label.append(price, countdown)
  root.appendChild(label)
  container.appendChild(root)

  let destroyed = false
  let frameId = 0
  let countdownTimer = 0

  const render = () => {
    frameId = 0
    if (destroyed) return

    const { period, symbol } = getContext()
    if (!period || !symbol || !readCurrentCandleCountdownActive(symbol)) {
      setHidden(label)
      return
    }

    const latest = readLatestRealKLine(chart)
    const periodSeconds = resolvePeriodSeconds(period)
    if (!latest || !Number.isFinite(periodSeconds) || periodSeconds <= 0) {
      setHidden(label)
      return
    }

    const y = readCoordinateY(chart, latest)
    const close = Number(latest.close)
    const timestamp = Number(latest.timestamp)
    const axisDom = chart.getDom(candlePaneId, DomPosition.YAxis)
    const axisWidth = axisDom?.getBoundingClientRect().width ?? Number.NaN
    if (y == null || !Number.isFinite(close) || !Number.isFinite(timestamp) || !Number.isFinite(axisWidth)) {
      setHidden(label)
      return
    }

    const periodMs = periodSeconds * 1000
    const endTimestamp = resolveCountdownEndTimestamp(timestamp, periodMs)
    const barStyle = readCandleBarStyle()
    label.style.setProperty('--ff-current-candle-y-axis-width', `${Math.max(1, axisWidth)}px`)
    label.style.backgroundColor = resolveCandleValueColor(latest, barStyle)
    label.style.top = `${clampPriceMarkerTop(chart, y)}px`
    price.textContent = formatGlobalPrice(close, '', { symbol })
    countdown.textContent = formatCountdown(endTimestamp - Date.now())
    setVisible(label)
  }

  const scheduleRender = () => {
    if (isKLineChartHorizontalDragInProgressV2()) return
    if (destroyed || frameId !== 0) return
    frameId = window.requestAnimationFrame(render)
  }

  const actions = [
    ActionType.OnDataReady,
    ActionType.OnScroll,
    ActionType.OnVisibleRangeChange,
    ActionType.OnZoom,
  ]
  actions.forEach((action) => chart.subscribeAction(action, scheduleRender))
  window.addEventListener(chartManualYAxisRangeChangeEvent, scheduleRender)
  window.addEventListener(settingsSymbolChangedEvent, scheduleRender)
  window.addEventListener(marketStatusTitleChangedEvent, scheduleRender)
  window.addEventListener(realtimeEnabledChangedEvent, scheduleRender)
  window.addEventListener('storage', scheduleRender)
  window.addEventListener('resize', scheduleRender)
  window.addEventListener(kLineChartHorizontalDragEndEventV2, scheduleRender)
  countdownTimer = window.setInterval(scheduleRender, 1000)
  scheduleRender()

  return {
    destroy() {
      destroyed = true
      if (frameId !== 0) window.cancelAnimationFrame(frameId)
      if (countdownTimer !== 0) window.clearInterval(countdownTimer)
      actions.forEach((action) => chart.unsubscribeAction(action, scheduleRender))
      window.removeEventListener(chartManualYAxisRangeChangeEvent, scheduleRender)
      window.removeEventListener(settingsSymbolChangedEvent, scheduleRender)
      window.removeEventListener(marketStatusTitleChangedEvent, scheduleRender)
      window.removeEventListener(realtimeEnabledChangedEvent, scheduleRender)
      window.removeEventListener('storage', scheduleRender)
      window.removeEventListener('resize', scheduleRender)
      window.removeEventListener(kLineChartHorizontalDragEndEventV2, scheduleRender)
      root.remove()
    },
    scheduleRender,
    updateContext() {
      scheduleRender()
    },
  }
}
