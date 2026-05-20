import { useCallback, useState } from 'react'
import { appendWatchlistRealtimeLog } from './watchlistRealtimeUtils'

export function useWatchlistRealtimeLog(initialLog: string[] = []) {
  const [watchlistRealtimeLog, setWatchlistRealtimeLog] = useState<string[]>(initialLog)

  const pushWatchlistRealtimeLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setWatchlistRealtimeLog((current) => appendWatchlistRealtimeLog(current, message, timestamp))
  }, [])

  const clearWatchlistRealtimeLog = useCallback(() => {
    setWatchlistRealtimeLog([])
  }, [])

  return {
    clearWatchlistRealtimeLog,
    pushWatchlistRealtimeLog,
    watchlistRealtimeLog,
  }
}
