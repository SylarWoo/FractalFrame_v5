import { useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { DomPosition } from 'klinecharts'
import type { Chart, Coordinate } from 'klinecharts'
import { readSettingsBooleanValue, settingsSymbolChangedEvent } from '../settingsSymbolState'
import { chartSettingDefaults, chartSettingKeys } from '../settings/chartSettingsSchema'
import { readWatchlistRealtimeEnabled, realtimeEnabledChangedEvent } from '../mt5DataCenter/storeV5Persistence'
import { readCandleBarStyle, resolveCandleValueColor } from './chartStyleReaders'
import { formatGlobalPrice } from './globalPricePrecision'
import { resolvePeriodSeconds } from './chartTimeFormatting'

type UseCurrentCandleCountdownOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  dataReady?: boolean
  period: string
  symbol: string
}

export type CurrentCandleCountdownState = {
  color: string
  left: number
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

function readCountdownVisible() {
  return readSettingsBooleanValue(
    chartSettingKeys.currentCandleCountdownVisible,
    chartSettingDefaults.currentCandleCountdownVisible,
  ) && readWatchlistRealtimeEnabled()
}

function isCoordinate(value: Partial<Coordinate> | Partial<Coordinate>[]): value is Partial<Coordinate> {
  return !Array.isArray(value)
}

export function useCurrentCandleCountdown({ chartInstanceRef, dataReady = true, period, symbol }: UseCurrentCandleCountdownOptions) {
  const [settingVisible, setSettingVisible] = useState(readCountdownVisible)
  const [state, setState] = useState<CurrentCandleCountdownState>({ color: '#26a69a', left: 0, price: '', text: '', top: 0, visible: false })

  useEffect(() => {
    const syncVisible = () => setSettingVisible(readCountdownVisible())
    window.addEventListener(settingsSymbolChangedEvent, syncVisible)
    window.addEventListener(realtimeEnabledChangedEvent, syncVisible)
    window.addEventListener('storage', syncVisible)
    syncVisible()
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, syncVisible)
      window.removeEventListener(realtimeEnabledChangedEvent, syncVisible)
      window.removeEventListener('storage', syncVisible)
    }
  }, [])

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
      const latest = dataList[dataList.length - 1]
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
      const rootDom = chart.getDom()
      const axisRect = axisDom?.getBoundingClientRect()
      const rootRect = rootDom?.getBoundingClientRect()
      const axisLeft = axisRect && rootRect ? axisRect.left - rootRect.left : Number.NaN
      const endTimestamp = timestamp + periodSeconds * 1000
      if (!Number.isFinite(y) || !Number.isFinite(axisLeft)) {
        setState((current) => current.visible ? { ...current, visible: false } : current)
        return
      }

      const barStyle = readCandleBarStyle()
      const nextState = {
        color: resolveCandleValueColor(latest, barStyle),
        left: Math.max(0, axisLeft + 1),
        price: formatGlobalPrice(close, '', { symbol }),
        text: formatCountdown(endTimestamp - Date.now()),
        top: Math.max(hostTopOffset, y + hostTopOffset),
        visible: true,
      }
      setState((current) => {
        if (
          current.visible === nextState.visible &&
          current.color === nextState.color &&
          Math.abs(current.left - nextState.left) < 0.25 &&
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
      animationFrameId = window.requestAnimationFrame(() => {
        update()
        scheduleUpdate()
      })
    }
    scheduleUpdate()
    const intervalId = window.setInterval(update, 100)
    window.addEventListener('resize', update)
    return () => {
      if (animationFrameId !== 0) window.cancelAnimationFrame(animationFrameId)
      window.clearInterval(intervalId)
      window.removeEventListener('resize', update)
    }
  }, [chartInstanceRef, dataReady, period, settingVisible, symbol])

  return state
}
