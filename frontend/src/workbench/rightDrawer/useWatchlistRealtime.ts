import { useEffect, useRef, useState } from 'react'
import {
  fetchStoreV5Status,
  repairStoreV5M1Gaps,
  startStoreV5AggregateJob,
  startStoreV5PullJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5RealtimeTick, StoreV5CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import { periodFromStoreTableKey, resolveLocalM1Rows } from '../mt5DataCenter/storeV5StatusFormat'
import {
  readPersistedRealtimeSnapshot,
  readSharedSelection,
  readWatchlistRealtimeEnabled,
  savePersistedRealtimeSnapshot,
  savePersistedStoreV5Status,
  saveWatchlistRealtimeEnabled,
} from '../mt5DataCenter/storeV5Persistence'
import { resolveStoreV5AggregateTargets } from './rightDrawerStoreTables'
import { useForegroundTickStream } from './useForegroundTickStream'
import { useWatchlistRealtimeLog } from './useWatchlistRealtimeLog'
import {
  waitForWatchlistAggregateJob,
  waitForWatchlistPullJob,
} from './watchlistRealtimeJobWaiters'

const storeV5M1RepairLookbackMinutes = 720
const storeV5M1RepairMaxGapMinutes = 720

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
  selectedRowSymbol,
  selectedStoreTableKey,
  storePanelPersistenceEnabled,
  setLocalStoreStatus,
  onOpenChart,
}: UseWatchlistRealtimeOptions) {
  const [watchlistRealtimeEnabled, setWatchlistRealtimeEnabled] = useState(readWatchlistRealtimeEnabled)
  const [watchlistRealtimeReady, setWatchlistRealtimeReady] = useState(false)
  const [watchlistRealtimeStatus, setWatchlistRealtimeStatus] = useState('')
  const {
    clearWatchlistRealtimeLog,
    pushWatchlistRealtimeLog,
    watchlistRealtimeLog,
  } = useWatchlistRealtimeLog(readPersistedRealtimeSnapshot().log ?? [])
  const [watchlistTicks, setWatchlistTicks] = useState<Record<string, Mt5RealtimeTick>>(() => readPersistedRealtimeSnapshot().ticks ?? {})
  const [watchlistLastTickAt, setWatchlistLastTickAt] = useState(() => readPersistedRealtimeSnapshot().lastTickAt ?? '')
  const watchlistRealtimeRunRef = useRef(0)

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
      watchlistRealtimeRunRef.current += 1
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

    const runId = watchlistRealtimeRunRef.current + 1
    watchlistRealtimeRunRef.current = runId

    const runRealtimeSync = async () => {
      setWatchlistRealtimeReady(false)
      setWatchlistRealtimeStatus('Syncing')
      clearWatchlistRealtimeLog()
      pushWatchlistRealtimeLog(`Realtime requested for foreground symbol ${foregroundRealtimeSymbol}`)

      try {
        for (const symbol of [foregroundRealtimeSymbol]) {
          if (watchlistRealtimeRunRef.current !== runId) return

          setWatchlistRealtimeStatus(`${symbol} checking store`)
          pushWatchlistRealtimeLog(`${symbol} checking local StoreV5 status`)
          const statusPayload = await fetchStoreV5Status(symbol)
          const hasLocalM1 = typeof resolveLocalM1Rows(statusPayload) === 'number'
            && Number(resolveLocalM1Rows(statusPayload)) > 0

          setWatchlistRealtimeStatus(`${symbol} pulling missing M1`)
          pushWatchlistRealtimeLog(`${symbol} ${hasLocalM1 ? 'incremental M1 gap fill started' : 'full M1 download started'}`)
          const pullJob = await startStoreV5PullJob(symbol, hasLocalM1 ? 'incremental' : 'refresh')
          await waitForWatchlistPullJob(pullJob.jobId, symbol, {
            isActive: () => watchlistRealtimeRunRef.current === runId,
            pushLog: pushWatchlistRealtimeLog,
            setStatus: setWatchlistRealtimeStatus,
          })
          if (watchlistRealtimeRunRef.current !== runId) return

          setWatchlistRealtimeStatus(`${symbol} repairing M1 gaps`)
          pushWatchlistRealtimeLog(`${symbol} scanning and repairing recent M1 window`)
          const gapRepair = await repairStoreV5M1Gaps(symbol, {
            lookbackMinutes: storeV5M1RepairLookbackMinutes,
            maxGapMinutes: storeV5M1RepairMaxGapMinutes,
          })
          if ((gapRepair.gapsDetected ?? 0) > 0) {
            pushWatchlistRealtimeLog(
              `${symbol} gap repair: ${gapRepair.gapsDetected ?? 0} gaps, ${gapRepair.rowsWritten ?? 0} rows written`,
            )
          } else {
            pushWatchlistRealtimeLog(`${symbol} M1 recent window repaired, ${gapRepair.rowsWritten ?? 0} rows written`)
          }

          const statusAfterPull = await fetchStoreV5Status(symbol)
          const aggregateTargets = resolveStoreV5AggregateTargets(statusAfterPull)

          if (aggregateTargets.length) {
            setWatchlistRealtimeStatus(`${symbol} aggregating periods`)
            pushWatchlistRealtimeLog(`${symbol} aggregating ${aggregateTargets.join(', ')}`)
            const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets)
            await waitForWatchlistAggregateJob(aggregateJob.jobId, symbol, {
              isActive: () => watchlistRealtimeRunRef.current === runId,
              pushLog: pushWatchlistRealtimeLog,
              setStatus: setWatchlistRealtimeStatus,
            })
          } else {
            pushWatchlistRealtimeLog(`${symbol} no aggregate periods to rebuild`)
          }

          const statusAfterSync = await fetchStoreV5Status(symbol)
          if (symbol === selectedRowSymbol) {
            setLocalStoreStatus(statusAfterSync)
            savePersistedStoreV5Status(symbol, statusAfterSync, new Date().toISOString(), storePanelPersistenceEnabled)
          }
        }

        if (watchlistRealtimeRunRef.current !== runId) return
        setWatchlistRealtimeReady(true)
        setWatchlistRealtimeStatus('Starting realtime')
        const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
        const latestStatus = await fetchStoreV5Status(foregroundRealtimeSymbol)
        const rowsForPeriod = period === 'M1'
          ? resolveLocalM1Rows(latestStatus)
          : latestStatus.aggregated.find((cell) => String(cell.timeframe || '').toUpperCase() === period)?.rowsCount
        onOpenChart?.({
          symbol: foregroundRealtimeSymbol,
          period: period === 'M1' ? '1m' : period,
          totalRows: typeof rowsForPeriod === 'number' && Number.isFinite(rowsForPeriod) ? rowsForPeriod : null,
          reloadId: Date.now(),
        })
        pushWatchlistRealtimeLog('Gap fill and aggregation completed, starting tick realtime')
      } catch (error) {
        if (watchlistRealtimeRunRef.current !== runId) return
        setWatchlistRealtimeReady(false)
        setWatchlistRealtimeEnabled(false)
        setWatchlistRealtimeStatus(error instanceof Error ? error.message : 'Sync failed')
        pushWatchlistRealtimeLog(error instanceof Error ? `Realtime failed: ${error.message}` : 'Realtime failed')
      }
      return
    }

    void runRealtimeSync()

    return () => {
      if (watchlistRealtimeRunRef.current === runId) {
        watchlistRealtimeRunRef.current += 1
      }
    }
  }, [clearWatchlistRealtimeLog, foregroundRealtimeSymbol, onOpenChart, pushWatchlistRealtimeLog, selectedRowSymbol, selectedStoreTableKey, setLocalStoreStatus, storePanelPersistenceEnabled, watchlistRealtimeEnabled])

  useForegroundTickStream({
    enabled: watchlistRealtimeEnabled,
    foregroundRealtimeSymbol,
    pushLog: pushWatchlistRealtimeLog,
    ready: watchlistRealtimeReady,
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
