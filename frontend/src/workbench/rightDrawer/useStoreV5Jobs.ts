import { useMemo, useRef, useState } from 'react'
import type { ChartPageTarget } from '../chart/ChartCoreHost'
import {
  cancelStoreV5PullJob,
  cleanStoreV5DirectM1,
  fetchStoreV5Status,
  repairStoreV5M1Gaps,
  startStoreV5AggregateJob,
  startStoreV5PullJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, StoreV5AggregateJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import { formatStoreOperationLine, periodFromStoreTableKey, resolveStoreOperationProgress } from '../mt5DataCenter/storeV5StatusFormat'
import {
  readPersistedM1CheckResult,
  readPersistedStoreV5Status,
  readSharedSelection,
  savePersistedStoreV5Status,
} from '../mt5DataCenter/storeV5Persistence'
import { resolveStoreV5AggregateTargets, storeTableAggregatePeriods } from './rightDrawerStoreTables'
import { useStoreV5M1CheckJobs } from './useStoreV5M1CheckJobs'
import { useStoreV5MaintenanceActions } from './useStoreV5MaintenanceActions'
import {
  clearAggregateJobRefs,
  clearPullJobRefs,
  createCompletedAggregateProgress,
  createPendingAggregateProgress,
  resolveStoreV5PullMode,
  rowsForStorePeriod,
  storeV5M1RepairOptions,
  waitStoreV5AggregateJobWithFallback,
  waitStoreV5PullJobWithFallback,
} from './storeV5JobUtils'

type UseStoreV5JobsOptions = {
  selectedSymbol: string
  selectedRowSymbol: string
  selectedStoreTableKey: string
  storePanelPersistenceEnabled: boolean
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
}

export function useStoreV5Jobs({
  selectedSymbol,
  selectedRowSymbol,
  selectedStoreTableKey,
  storePanelPersistenceEnabled,
  onOpenChart,
}: UseStoreV5JobsOptions) {
  const initialPersistedM1Check = useMemo(
    () => readPersistedM1CheckResult(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const initialPersistedStoreV5Status = useMemo(
    () => readPersistedStoreV5Status(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const [storeCheck, setStoreCheck] = useState<StoreV5CheckPayload | null>(() => initialPersistedM1Check?.payload ?? null)
  const [mt5M1LastCheckedAt, setMt5M1LastCheckedAt] = useState(() => initialPersistedM1Check?.checkedAt ?? '')
  const [localStoreStatus, setLocalStoreStatus] = useState<StoreV5CheckPayload | null>(() => initialPersistedStoreV5Status?.payload ?? null)
  const [selectedAggregatePeriods, setSelectedAggregatePeriods] = useState<string[]>([])
  const [storeCheckLoading, setStoreCheckLoading] = useState(false)
  const [storeCheckError, setStoreCheckError] = useState('')
  const [storeActionStatus, setStoreActionStatus] = useState('')
  const [m1CheckJob, setM1CheckJob] = useState<Mt5M1CheckJobPayload | null>(null)
  const [pullProgress, setPullProgress] = useState<StoreV5PullJobPayload | null>(null)
  const [aggregateProgress, setAggregateProgress] = useState<StoreV5AggregateJobPayload | null>(null)
  const activePullJobRef = useRef('')
  const activeAggregateJobRef = useRef('')
  const pullEventSourceRef = useRef<EventSource | null>(null)
  const aggregateEventSourceRef = useRef<EventSource | null>(null)

  const storeOperationLine = useMemo(
    () => formatStoreOperationLine(pullProgress, m1CheckJob, aggregateProgress, storeActionStatus),
    [aggregateProgress, m1CheckJob, pullProgress, storeActionStatus],
  )
  const storeOperationProgress = useMemo(
    () => resolveStoreOperationProgress(pullProgress, m1CheckJob, aggregateProgress),
    [aggregateProgress, m1CheckJob, pullProgress],
  )
  const canAggregateStoreV5 = localStoreStatus?.directM1?.status !== 'raw_m1_ready_clean_pending'
    && localStoreStatus?.directM1?.datasetKey?.includes(':direct:M1') === true
  const {
    handleCancelMt5M1Check,
    handleCheckMt5M1,
    handleCheckMt5M1Staged,
  } = useStoreV5M1CheckJobs({
    selectedRowSymbol,
    storeCheck,
    storePanelPersistenceEnabled,
    m1CheckJob,
    setM1CheckJob,
    setMt5M1LastCheckedAt,
    setPullProgress,
    setStoreActionStatus,
    setStoreCheck,
    setStoreCheckError,
    setStoreCheckLoading,
  })

  function openChartForStatus(symbol: string, payload: StoreV5CheckPayload) {
    const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
    const count = rowsForStorePeriod(payload, period)
    onOpenChart?.({
      symbol,
      period,
      totalRows: typeof count === 'number' && Number.isFinite(count) ? count : null,
      reloadId: Date.now(),
    })
  }

  const {
    handleCleanLocalM1,
    handleDeleteLocalStore,
    handleDeleteSelectedAggregates,
    handleRefreshStoreStatus,
  } = useStoreV5MaintenanceActions({
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
  })

  async function handleCancelPullStore() {
    const jobId = pullProgress?.jobId
    if (!jobId) return
    clearPullJobRefs({ activePullJobRef, pullEventSourceRef })
    setPullProgress(null)
    setStoreCheckLoading(false)
    setStoreActionStatus('已取消')
    try {
      await cancelStoreV5PullJob(jobId)
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handlePullStore() {
    const symbol = selectedRowSymbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setM1CheckJob(null)
    setPullProgress(null)
    setStoreActionStatus('Pulling MT5 M1 into StoreV5...')
    try {
      let currentStore: StoreV5CheckPayload | null = null
      try {
        currentStore = await fetchStoreV5Status(symbol)
      } catch {
        currentStore = null
      }
      const pullMode = resolveStoreV5PullMode(currentStore)
      setStoreActionStatus(pullMode === 'incremental' ? 'Incremental MT5 M1 pull into StoreV5...' : 'Initial MT5 M1 pull into StoreV5...')
      const started = await startStoreV5PullJob(symbol, pullMode)
      activePullJobRef.current = started.jobId
      setPullProgress(started)
      await waitStoreV5PullJobWithFallback(started.jobId, { activePullJobRef, pullEventSourceRef, setPullProgress })
      setStoreActionStatus('Scanning and repairing recent M1 window...')
      const gapRepair = await repairStoreV5M1Gaps(symbol, storeV5M1RepairOptions)
      const repairedStatus = await fetchStoreV5Status(symbol)
      const aggregateTargets = resolveStoreV5AggregateTargets(repairedStatus)
      if (aggregateTargets.length) {
        const rebuildAggregates = (gapRepair.rowsWritten ?? 0) > 0
        setStoreActionStatus(`${rebuildAggregates ? 'Rebuilding' : 'Aggregating'} periods: ${aggregateTargets.join(', ')}...`)
        const aggregateJob = await startStoreV5AggregateJob(symbol, aggregateTargets, { rebuild: rebuildAggregates })
        activeAggregateJobRef.current = aggregateJob.jobId
        setAggregateProgress(aggregateJob)
        await waitStoreV5AggregateJobWithFallback(aggregateJob.jobId, { activeAggregateJobRef, aggregateEventSourceRef, setAggregateProgress })
      }
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      openChartForStatus(symbol, payload)
      setStoreActionStatus('Pull complete. Store status refreshed.')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      clearPullJobRefs({ activePullJobRef, pullEventSourceRef })
      clearAggregateJobRefs({ activeAggregateJobRef, aggregateEventSourceRef })
      setPullProgress(null)
      setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
      setStoreCheckLoading(false)
    }
  }

  function toggleAggregatePeriod(period: string) {
    setSelectedAggregatePeriods((current) => current.includes(period) ? current.filter((item) => item !== period) : [...current, period])
  }

  function toggleAllAggregatePeriods() {
    setSelectedAggregatePeriods((current) => current.length === storeTableAggregatePeriods.length ? [] : [...storeTableAggregatePeriods])
  }

  async function handleAggregateStore() {
    const symbol = selectedRowSymbol
    const periods = [...selectedAggregatePeriods]
    if (!symbol) return
    if (!selectedAggregatePeriods.length) {
      setStoreCheckError('Select at least one aggregated period.')
      return
    }
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(createPendingAggregateProgress(symbol, periods))
    setStoreActionStatus('正在从 M1 重建聚合周期...')
    try {
      if (!canAggregateStoreV5) {
        setStoreActionStatus('正在先清理无效 M1，生成 direct M1...')
        await cleanStoreV5DirectM1(symbol)
        const cleanedStatus = await fetchStoreV5Status(symbol)
        setLocalStoreStatus(cleanedStatus)
        savePersistedStoreV5Status(symbol, cleanedStatus, new Date().toISOString(), storePanelPersistenceEnabled)
        setStoreActionStatus('direct M1 已生成，开始聚合...')
      }
      const started = await startStoreV5AggregateJob(symbol, periods)
      activeAggregateJobRef.current = started.jobId
      setAggregateProgress(started)
      await waitStoreV5AggregateJobWithFallback(started.jobId, { activeAggregateJobRef, aggregateEventSourceRef, setAggregateProgress })
      setAggregateProgress(createCompletedAggregateProgress(activeAggregateJobRef.current, symbol, periods))
      const payload = await fetchStoreV5Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV5Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus('')
      }, 1600)
      setStoreActionStatus('Aggregation complete. Store status refreshed.')
    } catch (err) {
      setAggregateProgress((current) => current ? { ...current, phase: 'failed' } : null)
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  return {
    aggregateProgress,
    canAggregateStoreV5,
    handleAggregateStore,
    handleCancelMt5M1Check,
    handleCancelPullStore,
    handleCheckMt5M1,
    handleCheckMt5M1Staged,
    handleCleanLocalM1,
    handleDeleteLocalStore,
    handleDeleteSelectedAggregates,
    handlePullStore,
    handleRefreshStoreStatus,
    localStoreStatus,
    m1CheckJob,
    mt5M1LastCheckedAt,
    pullProgress,
    selectedAggregatePeriods,
    setLocalStoreStatus,
    setMt5M1LastCheckedAt,
    setStoreActionStatus,
    setStoreCheck,
    setStoreCheckError,
    storeActionStatus,
    storeCheck,
    storeCheckError,
    storeCheckLoading,
    storeOperationLine,
    storeOperationProgress,
    toggleAggregatePeriod,
    toggleAllAggregatePeriods,
  }
}
