import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ActionType, DomPosition } from 'klinecharts'
import type { Chart, Coordinate, KLineData } from 'klinecharts'
import { workbenchEvents } from '../persistence/workbenchEvents'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'
import { readCandleBarStyle, readSymbolLabelVisibleParts, resolveCandleValueColor } from './chartStyleReaders'
import { formatGlobalPrice } from './globalPricePrecision'
import { readRealtimePageBuffer } from './chartRealtimeBridge'
import { formatCountdown, resolveCountdownEndTimestamp } from './useCurrentCandleCountdown'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { readCurrentCandleCountdownActive } from './currentCandleCountdownVisibility'
import { clampPriceMarkerTop } from './priceMarkerPosition'

type UseRealtimePriceMarkerOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  enabled?: boolean
  period: string
  symbol: string
}

const tailSilenceGraceMs = 90_000

export type RealtimePriceMarkerState = {
  axisWidth: number
  color: string
  labelVisible: boolean
  lineVisible: boolean
  lineWidth: number
  price: string
  text: string
  top: number
  visible: boolean
}

function isCoordinate(value: Partial<Coordinate> | Partial<Coordinate>[]): value is Partial<Coordinate> {
  return !Array.isArray(value)
}

function lastRow(rows: KLineData[]) {
  return rows[rows.length - 1] ?? null
}

export function useRealtimePriceMarker({ chartInstanceRef, enabled = true, period, symbol }: UseRealtimePriceMarkerOptions) {
  const [state, setState] = useState<RealtimePriceMarkerState>({ axisWidth: 70, color: '#2563eb', labelVisible: false, lineVisible: false, lineWidth: 0, price: '', text: '', top: 0, visible: false })

  useEffect(() => {
    if (!enabled) {
      setState((current) => current.visible ? { ...current, visible: false } : current)
      return
    }

    const update = () => {
      const selectedParts = readSymbolLabelVisibleParts()
      const valueVisible = selectedParts.includes('value')
      const historyLabelVisible = selectedParts.includes('history-label')
      const labelVisible = historyLabelVisible && valueVisible
      const lineVisible = historyLabelVisible && selectedParts.includes('line')
      if (!labelVisible && !lineVisible) {
        setState((current) => current.visible ? { ...current, labelVisible: false, lineVisible: false, visible: false } : current)
        return
      }

      const chart = chartInstanceRef.current
      if (!chart) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const latest = lastRow(readRealtimePageBuffer(symbol, period))
      const close = Number(latest?.close)
      const timestamp = Number(latest?.timestamp)
      const periodSeconds = resolvePeriodSeconds(period)
      if (!latest || !Number.isFinite(close)) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const pixel = chart.convertToPixel({ value: close }, { paneId: 'candle_pane' })
      const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
      const y = Number(coordinate?.y)
      const axisDom = chart.getDom('candle_pane', DomPosition.YAxis)
      const axisWidth = axisDom?.getBoundingClientRect().width ?? Number.NaN
      const mainDom = chart.getDom('candle_pane', DomPosition.Main)
      const lineWidth = mainDom?.getBoundingClientRect().width ?? Number.NaN
      if (!Number.isFinite(y) || !Number.isFinite(axisWidth)) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const barStyle = readCandleBarStyle()
      const countdownVisible = readCurrentCandleCountdownActive(symbol)
      const nextState = {
        axisWidth: Math.max(1, axisWidth),
        color: resolveCandleValueColor(latest, barStyle),
        labelVisible,
        lineVisible,
        lineWidth: Number.isFinite(lineWidth) ? Math.max(0, lineWidth) : 0,
        price: formatGlobalPrice(close, '', { symbol }),
        text: countdownVisible &&
          Number.isFinite(timestamp) &&
          Number.isFinite(periodSeconds) &&
          periodSeconds > 0 &&
          Date.now() <= timestamp + periodSeconds * 1000 + tailSilenceGraceMs
          ? formatCountdown(resolveCountdownEndTimestamp(timestamp, periodSeconds * 1000) - Date.now())
          : '',
        top: clampPriceMarkerTop(chart, y),
        visible: true,
      }
      setState((current) => {
        if (
          current.visible === nextState.visible &&
          Math.abs(current.axisWidth - nextState.axisWidth) < 0.25 &&
          current.color === nextState.color &&
          current.labelVisible === nextState.labelVisible &&
          current.lineVisible === nextState.lineVisible &&
          Math.abs(current.lineWidth - nextState.lineWidth) < 0.25 &&
          current.price === nextState.price &&
          current.text === nextState.text &&
          Math.abs(current.top - nextState.top) < 0.25
        ) {
          return current
        }
        return nextState
      })
    }

    update()
    let animationFrameId = 0
    const scheduleUpdate = () => {
      if (animationFrameId !== 0) return
      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = 0
        update()
      })
    }
    const actions = [
      ActionType.OnDataReady,
      ActionType.OnScroll,
      ActionType.OnVisibleRangeChange,
      ActionType.OnZoom,
    ]
    const chart = chartInstanceRef.current
    actions.forEach((action) => chart?.subscribeAction(action, scheduleUpdate))
    const intervalId = window.setInterval(update, 250)
    window.addEventListener(workbenchEvents.realtimePageBufferChanged, scheduleUpdate)
    window.addEventListener(settingsSymbolChangedEvent, scheduleUpdate)
    window.addEventListener('storage', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      if (animationFrameId !== 0) window.cancelAnimationFrame(animationFrameId)
      window.clearInterval(intervalId)
      actions.forEach((action) => chart?.unsubscribeAction(action, scheduleUpdate))
      window.removeEventListener(workbenchEvents.realtimePageBufferChanged, scheduleUpdate)
      window.removeEventListener(settingsSymbolChangedEvent, scheduleUpdate)
      window.removeEventListener('storage', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [chartInstanceRef, enabled, period, symbol])

  return enabled ? state : { ...state, visible: false }
}
