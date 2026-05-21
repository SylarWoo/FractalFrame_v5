import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mt5RealtimeTick, StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import {
  readPersistedRealtimeSnapshot,
  readWatchlistRealtimeEnabled,
  savePersistedRealtimeSnapshot,
  saveWatchlistRealtimeEnabled,
} from '../mt5DataCenter/storeV5Persistence'
import { useWatchlistRealtimeLog } from './useWatchlistRealtimeLog'
import { useForegroundTickStream } from './useForegroundTickStream'

type UseWatchlistRealtimeOptions = {
  foregroundRealtimeSymbol: string
  selectedRowSymbol: string
  selectedStoreTableKey: string
  storePanelPersistenceEnabled: boolean
  watchlistSymbols: string[]
  setLocalStoreStatus: (payload: StoreV5CheckPayload | null) => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}

export function useWatchlistRealtime({
  foregroundRealtimeSymbol,
  watchlistSymbols,
}: UseWatchlistRealtimeOptions) {
  const initialRealtimeSnapshot = useRef(readPersistedRealtimeSnapshot()).current
  const initialRealtimeEnabled = useRef(readWatchlistRealtimeEnabled()).current
  const [watchlistRealtimeEnabled, setWatchlistRealtimeEnabled] = useState(initialRealtimeEnabled)
  const [watchlistRealtimeReady, setWatchlistRealtimeReady] = useState(false)
  const [watchlistRealtimeStatus, setWatchlistRealtimeStatus] = useState('')
  const {
    pushWatchlistRealtimeLog,
    watchlistRealtimeLog,
  } = useWatchlistRealtimeLog(initialRealtimeSnapshot.log ?? [])
  const [watchlistTicks, setWatchlistTicks] = useState<Record<string, Mt5RealtimeTick>>(() => initialRealtimeSnapshot.ticks ?? {})
  const [watchlistLastTickAt, setWatchlistLastTickAt] = useState(() => initialRealtimeSnapshot.lastTickAt ?? '')
  const restoredRealtimeLoggedRef = useRef(false)
  const realtimeSymbols = useMemo(() => {
    return [...new Set([...watchlistSymbols, foregroundRealtimeSymbol].filter(Boolean))]
  }, [foregroundRealtimeSymbol, watchlistSymbols])
  const realtimeSymbolsKey = realtimeSymbols.join(',')

  useEffect(() => {
    saveWatchlistRealtimeEnabled(watchlistRealtimeEnabled)
  }, [watchlistRealtimeEnabled])

  useEffect(() => {
    savePersistedRealtimeSnapshot({
      lastTickAt: watchlistLastTickAt,
      log: watchlistRealtimeLog,
      ticks: watchlistTicks,
    })
  }, [watchlistLastTickAt, watchlistRealtimeLog, watchlistTicks])

  useEffect(() => {
    if (!watchlistRealtimeEnabled) {
      const timer = window.setTimeout(() => {
        setWatchlistRealtimeReady(false)
        setWatchlistRealtimeStatus('')
        pushWatchlistRealtimeLog('Realtime stopped')
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (!realtimeSymbols.length) {
      const timer = window.setTimeout(() => {
        setWatchlistRealtimeReady(false)
        setWatchlistRealtimeStatus('No symbols')
        pushWatchlistRealtimeLog('No watchlist symbols, realtime not started')
      }, 0)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      setWatchlistRealtimeReady(true)
      setWatchlistRealtimeStatus('Live')
      if (initialRealtimeEnabled && !restoredRealtimeLoggedRef.current) {
        restoredRealtimeLoggedRef.current = true
        pushWatchlistRealtimeLog(`Realtime restored for ${realtimeSymbols.length} symbol${realtimeSymbols.length === 1 ? '' : 's'}`)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialRealtimeEnabled, pushWatchlistRealtimeLog, realtimeSymbols.length, realtimeSymbolsKey, watchlistRealtimeEnabled])

  useForegroundTickStream({
    enabled: watchlistRealtimeEnabled,
    pushLog: pushWatchlistRealtimeLog,
    ready: watchlistRealtimeReady,
    realtimeSymbols,
    setLastTickAt: setWatchlistLastTickAt,
    setStatus: setWatchlistRealtimeStatus,
    setTicks: setWatchlistTicks,
  })

  return {
    setWatchlistRealtimeEnabled,
    watchlistLastTickAt,
    watchlistRealtimeEnabled,
    watchlistRealtimeLog,
    watchlistRealtimeReady,
    watchlistRealtimeStatus,
    watchlistTicks,
  }
}
