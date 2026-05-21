import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  cleanStoreV5DirectM1,
  deleteStoreV5AggregatedTimeframes,
  deleteStoreV5Symbol,
  fetchStoreV5Status,
  repairStoreV5M1Gaps,
  startStoreV5AggregateJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, StoreV5AggregateJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import { savePersistedStoreV5Status } from '../mt5DataCenter/storeV5Persistence'
import { resolveStoreV5AggregateTargets } from './rightDrawerStoreTables'
import { storeV5M1RepairOptions, clearAggregateJobRefs, waitStoreV5AggregateJobWithFallback } from './storeV5JobUtils'

type MaintenanceActionsOptions = {
  activeAggregateJobRef: MutableRefObject<string>
  aggregateEventSourceRef: MutableRefObject<EventSource | null>
  openChartForStatus: (symbol: string, payload: StoreV5CheckPayload) => void
  selectedAggregatePeriods: string[]
  selectedRowSymbol: string
  setAggregateProgress: Dispatch<SetStateAction<StoreV5AggregateJobPayload | null>>
  setLocalStoreStatus: Dispatch<SetStateAction<StoreV5CheckPayload | null>>
  setM1CheckJob: Dispatch<SetStateAction<Mt5M1CheckJobPayload | null>>
  setPullProgress: Dispatch<SetStateAction<StoreV5PullJobPayload | null>>
  setStoreActionStatus: Dispatch<SetStateAction<string>>
  setStoreCheckError: Dispatch<SetStateAction<string>>
  setStoreCheckLoading: Dispatch<SetStateAction<boolean>>
  storePanelPersistenceEnabled: boolean
}

export function useStoreV5MaintenanceActions({
  activeAggregateJobRef,
  aggregateEventSourceRef,
  openChartForStatus,
  selectedAggregatePeriods,
  selectedRowSymbol,
  setAggregateProgress,
  setLocalStoreStatus,
  setM1CheckJob,
  setPullProgress,
  setStoreActionStatus,
  setStoreCheckError,
  setStoreCheckLoading,
  storePanelPersistenceEnabled,
}: MaintenanceActionsOptions) {
  async function refreshAfterSimpleAction(symbol: string, status: string) {
    const payload = await fetchStoreV5Status(symbol)
    setLocalStoreStatus(payload)
    savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
    setStoreActionStatus(status)
  }

  async function handleRefreshStoreStatus() {
    const symbol = selectedRowSymbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Reading StoreV5 status...')
    try {
      setStoreActionStatus('Scanning and repairing M1 gaps...')
      const gapRepair = await repairStoreV5M1Gaps(symbol, storeV5M1RepairOptions)
      setStoreActionStatus((gapRepair.gapsDetected ?? 0) > 0
        ? `M1 gap repair complete: found ${gapRepair.gapsDetected ?? 0} gaps, wrote ${gapRepair.rowsWritten ?? 0} rows.`
        : 'M1 gap check complete: no recent middle gaps.')
      let payload = await fetchStoreV5Status(symbol)
      const aggregateTargets = resolveStoreV5AggregateTargets(payload)
      if ((gapRepair.rowsWritten ?? 0) > 0 && aggregateTargets.length) {
        setStoreActionStatus(`Rebuilding periods after M1 repair: ${aggregateTargets.join(', ')}...`)
        const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets, { rebuild: true })
        activeAggregateJobRef.current = aggregateJob.jobId
        setAggregateProgress(aggregateJob)
        await waitStoreV5AggregateJobWithFallback(aggregateJob.jobId, { activeAggregateJobRef, aggregateEventSourceRef, setAggregateProgress })
        payload = await fetchStoreV5Status(symbol)
      }
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      openChartForStatus(symbol, payload)
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus((current) => (current.includes('refresh') ? '' : current))
      }, 1600)
      setStoreActionStatus('StoreV5 status refreshed.')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      clearAggregateJobRefs({ activeAggregateJobRef, aggregateEventSourceRef })
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteLocalStore() {
    const symbol = selectedRowSymbol
    if (!symbol || !window.confirm(`Delete local StoreV5 data for ${symbol}? This clears local M1 and aggregated periods.`)) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Deleting local StoreV5 data...')
    try {
      await deleteStoreV5Symbol(symbol)
      await refreshAfterSimpleAction(symbol, 'Local StoreV5 data deleted.')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleDeleteSelectedAggregates() {
    const symbol = selectedRowSymbol
    const periods = [...selectedAggregatePeriods]
    if (!symbol) return
    if (!periods.length) {
      setStoreCheckError('Select aggregated periods to delete first.')
      return
    }
    if (!window.confirm(`Delete aggregated periods for ${symbol}: ${periods.join(', ')}? M1 will not be deleted.`)) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(null)
    setStoreActionStatus(`Deleting aggregated periods: ${periods.join(', ')}...`)
    try {
      await deleteStoreV5AggregatedTimeframes(symbol, periods)
      await refreshAfterSimpleAction(symbol, `Deleted aggregated periods: ${periods.join(', ')}.`)
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleCleanLocalM1() {
    const symbol = selectedRowSymbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Cleaning invalid 1-minute data...')
    try {
      await cleanStoreV5DirectM1(symbol)
      await refreshAfterSimpleAction(symbol, 'Local M1 cleaned and aligned with true M1 data.')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  return {
    handleCleanLocalM1,
    handleDeleteLocalStore,
    handleDeleteSelectedAggregates,
    handleRefreshStoreStatus,
    refreshAfterSimpleAction,
  }
}
