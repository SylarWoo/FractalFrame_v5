import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { ActionType, DomPosition } from 'klinecharts'
import type { Chart, Coordinate } from 'klinecharts'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'
import { realtimeEnabledChangedEvent } from '../mt5DataCenter/storeV5Persistence'
import { readCandleBarStyle, resolveCandleValueColor } from './chartStyleReaders'
import { formatGlobalPrice } from './globalPricePrecision'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import { lastRealKLine } from './chartFuturePlaceholders'
import { readCurrentCandleCountdownActive } from './currentCandleCountdownVisibility'

type UseCurrentCandleCountdownOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  dataReady?: boolean
  period: string
  symbol: string
}

export type CurrentCandleCountdownState = {
  axisWidth: number
  color: string
  price: string
  text: string
  top: number
  visible: boolean
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

function isCoordinate(value: Partial<Coordinate> | Partial<Coordinate>[]): value is Partial<Coordinate> {
  return !Array.isArray(value)
}

export function resolveCountdownEndTimestamp(latestTimestamp: number, periodMs: number, nowMs = Date.now()) {
  const latestEndTimestamp = latestTimestamp + periodMs
  if (latestEndTimestamp > nowMs) return latestEndTimestamp
  return Math.floor(nowMs / periodMs) * periodMs + periodMs
}

export function useCurrentCandleCountdown({ chartInstanceRef, dataReady = true, period, symbol }: UseCurrentCandleCountdownOptions) {
  const [settingVisible, setSettingVisible] = useState(() => readCurrentCandleCountdownActive(symbol))
  const [state, setState] = useState<CurrentCandleCountdownState>({ axisWidth: 70, color: '#26a69a', price: '', text: '', top: 0, visible: false })

  useEffect(() => {
    const syncVisible = () => setSettingVisible(readCurrentCandleCountdownActive(symbol))
    window.addEventListener(settingsSymbolChangedEvent, syncVisible)
    window.addEventListener(realtimeEnabledChangedEvent, syncVisible)
    window.addEventListener('storage', syncVisible)
    syncVisible()
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, syncVisible)
      window.removeEventListener(realtimeEnabledChangedEvent, syncVisible)
      window.removeEventListener('storage', syncVisible)
    }
  }, [symbol])

  useEffect(() => {
    if (!settingVisible || !dataReady) {
      setState((current) => current.visible ? { ...current, visible: false } : current)
      return
    }

    const update = () => {
      const chart = chartInstanceRef.current
      if (!chart) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const dataList = chart.getDataList()
      const latest = lastRealKLine(dataList)
      const periodSeconds = resolvePeriodSeconds(period)
      if (!latest || !Number.isFinite(periodSeconds) || periodSeconds <= 0) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const close = Number(latest.close)
      const timestamp = Number(latest.timestamp)
      if (!Number.isFinite(close) || !Number.isFinite(timestamp)) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const pixel = chart.convertToPixel({ timestamp, value: close }, { paneId: 'candle_pane' })
      const coordinate = isCoordinate(pixel) ? pixel : pixel[0]
      const y = Number(coordinate?.y)
      const hostTopOffset = 8
      const axisDom = chart.getDom('candle_pane', DomPosition.YAxis)
      const axisRect = axisDom?.getBoundingClientRect()
      const axisWidth = axisRect?.width ?? Number.NaN
      const periodMs = periodSeconds * 1000
      const endTimestamp = resolveCountdownEndTimestamp(timestamp, periodMs)
      if (!Number.isFinite(y) || !Number.isFinite(axisWidth)) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const barStyle = readCandleBarStyle()
      const nextState = {
        axisWidth: Math.max(1, axisWidth),
        color: resolveCandleValueColor(latest, barStyle),
        price: formatGlobalPrice(close, '', { symbol }),
        text: formatCountdown(endTimestamp - Date.now()),
        top: Math.max(hostTopOffset, y + hostTopOffset),
        visible: true,
      }
      setState((current) => {
        if (
          current.visible === nextState.visible &&
          Math.abs(current.axisWidth - nextState.axisWidth) < 0.25 &&
          current.color === nextState.color &&
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
    const intervalId = window.setInterval(update, 250)
    const actions = [
      ActionType.OnDataReady,
      ActionType.OnScroll,
      ActionType.OnVisibleRangeChange,
      ActionType.OnZoom,
    ]
    const chart = chartInstanceRef.current
    actions.forEach((action) => chart?.subscribeAction(action, scheduleUpdate))
    const rootDom = chart?.getDom()
    const resizeObserver = rootDom && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleUpdate)
      : null
    resizeObserver?.observe(rootDom as Element)
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      if (animationFrameId !== 0) window.cancelAnimationFrame(animationFrameId)
      window.clearInterval(intervalId)
      actions.forEach((action) => chart?.unsubscribeAction(action, scheduleUpdate))
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [chartInstanceRef, dataReady, period, settingVisible, symbol])

  return state
}
