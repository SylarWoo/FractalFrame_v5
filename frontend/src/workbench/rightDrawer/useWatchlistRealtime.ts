import { useEffect, useRef, useState } from 'react'
import type { Mt5RealtimeTick, StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import {
  readPersistedRealtimeSnapshot,
  readWatchlistRealtimeEnabled,
  savePersistedRealtimeSnapshot,
  saveWatchlistRealtimeEnabled,
} from '../mt5DataCenter/storeV5Persistence'
import { useWatchlistRealtimeLog } from './useWatchlistRealtimeLog'

type UseWatchlistRealtimeOptions = {
  foregroundRealtimeSymbol: string
  selectedRowSymbol: string
  selectedStoreTableKey: string
  storePanelPersistenceEnabled: boolean
  setLocalStoreStatus: (payload: StoreV5CheckPayload | null) => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number }) => void
}

export function useWatchlistRealtime({
  foregroundRealtimeSymbol,
}: UseWatchlistRealtimeOptions) {
  const initialRealtimeEnabled = useRef(readWatchlistRealtimeEnabled()).current
  const [watchlistRealtimeEnabled, setWatchlistRealtimeEnabled] = useState(initialRealtimeEnabled)
  const [watchlistRealtimeReady, setWatchlistRealtimeReady] = useState(false)
  const [watchlistRealtimeStatus, setWatchlistRealtimeStatus] = useState('')
  const {
    pushWatchlistRealtimeLog,
    watchlistRealtimeLog,
  } = useWatchlistRealtimeLog(readPersistedRealtimeSnapshot().log ?? [])
  const [watchlistTicks] = useState<Record<string, Mt5RealtimeTick>>(() => readPersistedRealtimeSnapshot().ticks ?? {})
  const [watchlistLastTickAt] = useState(() => readPersistedRealtimeSnapshot().lastTickAt ?? '')
  const restoredRealtimeLoggedRef = useRef(false)

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

    if (!foregroundRealtimeSymbol) {
      const timer = window.setTimeout(() => {
        setWatchlistRealtimeReady(false)
        setWatchlistRealtimeStatus('No symbols')
        pushWatchlistRealtimeLog('No foreground symbol, realtime not started')
      }, 0)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      setWatchlistRealtimeReady(true)
      setWatchlistRealtimeStatus('Live')
      if (initialRealtimeEnabled && !restoredRealtimeLoggedRef.current) {
        restoredRealtimeLoggedRef.current = true
        pushWatchlistRealtimeLog(`Realtime restored for ${foregroundRealtimeSymbol}`)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [foregroundRealtimeSymbol, initialRealtimeEnabled, pushWatchlistRealtimeLog, watchlistRealtimeEnabled])

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
