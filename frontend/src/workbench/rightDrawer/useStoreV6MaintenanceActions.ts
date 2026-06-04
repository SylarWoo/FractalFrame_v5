import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  cleanStoreV6DirectM1,
  deleteStoreV6AggregatedTimeframes,
  deleteStoreV6Symbol,
  fetchStoreV6Status,
  repairStoreV6M1Gaps,
  startStoreV6AggregateJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, StoreV6AggregateJobPayload, StoreV6CheckPayload, StoreV6PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import { savePersistedStoreV6Status } from '../mt5DataCenter/storeV6Persistence'
import { resolveStoreV6AggregateTargets } from './rightDrawerStoreTables'
import { storeV6M1RepairOptions, clearAggregateJobRefs, waitStoreV6AggregateJobWithFallback } from './storeV6JobUtils'

type MaintenanceActionsOptions = {
  activeAggregateJobRef: MutableRefObject<string>
  aggregateEventSourceRef: MutableRefObject<EventSource | null>
  openChartForStatus: (symbol: string, payload: StoreV6CheckPayload) => void
  selectedAggregatePeriods: string[]
  selectedRowSymbol: string
  setAggregateProgress: Dispatch<SetStateAction<StoreV6AggregateJobPayload | null>>
  setLocalStoreStatus: Dispatch<SetStateAction<StoreV6CheckPayload | null>>
  setM1CheckJob: Dispatch<SetStateAction<Mt5M1CheckJobPayload | null>>
  setPullProgress: Dispatch<SetStateAction<StoreV6PullJobPayload | null>>
  setStoreActionStatus: Dispatch<SetStateAction<string>>
  setStoreCheckError: Dispatch<SetStateAction<string>>
  setStoreCheckLoading: Dispatch<SetStateAction<boolean>>
  storePanelPersistenceEnabled: boolean
}

export function useStoreV6MaintenanceActions({
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
    const payload = await fetchStoreV6Status(symbol)
    setLocalStoreStatus(payload)
    savePersistedStoreV6Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
    setStoreActionStatus(status)
  }

  async function handleRefreshStoreStatus() {
    const symbol = selectedRowSymbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Reading StoreV6 status...')
    try {
      setStoreActionStatus('Scanning and repairing M1 gaps...')
      const gapRepair = await repairStoreV6M1Gaps(symbol, storeV6M1RepairOptions)
      setStoreActionStatus((gapRepair.gapsDetected ?? 0) > 0
        ? `M1 gap repair complete: found ${gapRepair.gapsDetected ?? 0} gaps, wrote ${gapRepair.rowsWritten ?? 0} rows.`
        : 'M1 gap check complete: no recent middle gaps.')
      let payload = await fetchStoreV6Status(symbol)
      const aggregateTargets = resolveStoreV6AggregateTargets(payload)
      if ((gapRepair.rowsWritten ?? 0) > 0 && aggregateTargets.length) {
        setStoreActionStatus(`Rebuilding periods after M1 repair: ${aggregateTargets.join(', ')}...`)
        const aggregateJob = await startStoreV6AggregateJob(symbol, aggregateTargets, { rebuild: true })
        activeAggregateJobRef.current = aggregateJob.jobId
        setAggregateProgress(aggregateJob)
        await waitStoreV6AggregateJobWithFallback(aggregateJob.jobId, { activeAggregateJobRef, aggregateEventSourceRef, setAggregateProgress })
        payload = await fetchStoreV6Status(symbol)
      }
      setLocalStoreStatus(payload)
      savePersistedStoreV6Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      openChartForStatus(symbol, payload)
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus((current) => (current.includes('refresh') ? '' : current))
      }, 1600)
      setStoreActionStatus('StoreV6 status refreshed.')
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
    if (!symbol || !window.confirm(`Delete local StoreV6 data for ${symbol}? This clears local M1 and aggregated periods.`)) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setStoreActionStatus('Deleting local StoreV6 data...')
    try {
      await deleteStoreV6Symbol(symbol)
      await refreshAfterSimpleAction(symbol, 'Local StoreV6 data deleted.')
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
      await deleteStoreV6AggregatedTimeframes(symbol, periods)
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
      await cleanStoreV6DirectM1(symbol)
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
