import { useEffect, useRef } from 'react'
import { createMt5TicksEventSource } from '../../services/mt5/mt5SymbolsApi'
import type { Mt5RealtimeTick } from '../../services/mt5/mt5SymbolsApi'
import { saveMarketStatusTitleSnapshotFromRealtimeTick } from '../mt5DataCenter/marketStatusTitleState'
import { mergeWatchlistRealtimeTicks } from './watchlistRealtimeUtils'

type UseForegroundTickStreamOptions = {
  enabled: boolean
  pushLog: (message: string) => void
  ready: boolean
  realtimeSymbols: string[]
  restartKey?: string
  setLastTickAt: (updater: string) => void
  setStatus: (status: string) => void
  setTicks: (updater: (current: Record<string, Mt5RealtimeTick>) => Record<string, Mt5RealtimeTick>) => void
}

export function useForegroundTickStream({
  enabled,
  pushLog,
  ready,
  realtimeSymbols,
  restartKey,
  setLastTickAt,
  setStatus,
  setTicks,
}: UseForegroundTickStreamOptions) {
  const ticksEventSourceRef = useRef<EventSource | null>(null)
  const realtimeSymbolsKey = realtimeSymbols.join(',')

  useEffect(() => {
    ticksEventSourceRef.current?.close()
    ticksEventSourceRef.current = null

    const symbols = realtimeSymbolsKey.split(',').filter(Boolean)
    if (!enabled || !ready || !symbols.length) return

    const connectingTimer = window.setTimeout(() => setStatus('Connecting'), 0)
    const source = createMt5TicksEventSource(symbols, 200)
    ticksEventSourceRef.current = source

    source.addEventListener('ready', () => {
      setStatus('Live')
      pushLog('Realtime feed connected')
    })

    source.addEventListener('ticks', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { ticks?: Mt5RealtimeTick[] }
        const ticks = Array.isArray(payload.ticks) ? payload.ticks : []
        if (!ticks.length) return
        const updatedSymbols = ticks.map((tick) => tick.symbol).filter(Boolean)
        setTicks((current) => mergeWatchlistRealtimeTicks(current, ticks))
        ticks.forEach((tick) => {
          if (!tick.symbol) return
          saveMarketStatusTitleSnapshotFromRealtimeTick(tick)
          window.dispatchEvent(new CustomEvent('fractalframe:mt5RealtimeTick', { detail: tick }))
        })
        if (updatedSymbols.length) setLastTickAt(new Date().toLocaleTimeString())
        setStatus('Live')
      } catch {
        setStatus('Parse error')
        pushLog('Realtime tick parse error')
      }
    })

    source.addEventListener('error', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { error?: string; status?: string }
        const line = payload.error || payload.status || 'Error'
        setStatus(line)
        pushLog(`Realtime error: ${line}`)
      } catch {
        setStatus('Disconnected')
        pushLog('Realtime disconnected')
      }
    })

    source.onerror = () => {
      setStatus('Reconnecting')
      pushLog('Realtime reconnecting')
    }

    return () => {
      window.clearTimeout(connectingTimer)
      source.close()
      if (ticksEventSourceRef.current === source) {
        ticksEventSourceRef.current = null
      }
    }
  }, [enabled, pushLog, ready, realtimeSymbolsKey, restartKey, setLastTickAt, setStatus, setTicks])
}
