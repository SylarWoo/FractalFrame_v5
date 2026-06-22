import { useMemo, useRef, useState } from 'react'
import type { ChartPageTarget } from '../chart/chartRuntimeTypes'
import { resolveStoreV6PagePartitionMode } from '../chart/pagePartition/pagePartitionBuilder'
import { hasStoreV6PeriodPageSystemV2 } from '../chart/pagePartition/periodPageSystemV2'
import {
  cancelStoreV6AggregateJob,
  cancelStoreV6AggregateJobsForSymbol,
  cancelStoreV6PullJob,
  auditStoreV6,
  fetchStoreV6Status,
  startStoreV6AggregateJob,
  startStoreV6PullJob,
} from '../../services/mt5/mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, StoreV6AggregateJobPayload, StoreV6CheckPayload, StoreV6PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import { formatStoreOperationLine, periodFromStoreTableKey, resolveStoreOperationProgress } from '../mt5DataCenter/storeV6StatusFormat'
import {
  readPersistedM1CheckResult,
  readPersistedStoreV6Status,
  readSharedSelection,
  savePersistedStoreV6Status,
} from '../mt5DataCenter/storeV6Persistence'
import { resolveStoreV6AggregateTargets, storeTableAggregatePeriods } from './rightDrawerStoreTables'
import { useStoreV6M1CheckJobs } from './useStoreV6M1CheckJobs'
import { useStoreV6MaintenanceActions } from './useStoreV6MaintenanceActions'
import {
  clearAggregateJobRefs,
  clearPullJobRefs,
  createCompletedAggregateProgress,
  createPendingAggregateProgress,
  resolveStoreV6PullMode,
  rowsForStorePeriod,
  waitStoreV6AggregateJobWithFallback,
  waitStoreV6PullJobWithFallback,
} from './storeV6JobUtils'

type UseStoreV6JobsOptions = {
  selectedSymbol: string
  selectedRowSymbol: string
  selectedStoreTableKey: string
  storePanelPersistenceEnabled: boolean
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
}

export function useStoreV6Jobs({
  selectedSymbol,
  selectedRowSymbol,
  selectedStoreTableKey,
  storePanelPersistenceEnabled,
  onOpenChart,
}: UseStoreV6JobsOptions) {
  const initialPersistedM1Check = useMemo(
    () => readPersistedM1CheckResult(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const initialPersistedStoreV6Status = useMemo(
    () => readPersistedStoreV6Status(selectedSymbol, storePanelPersistenceEnabled),
    [selectedSymbol, storePanelPersistenceEnabled],
  )
  const [storeCheck, setStoreCheck] = useState<StoreV6CheckPayload | null>(() => initialPersistedM1Check?.payload ?? null)
  const [mt5M1LastCheckedAt, setMt5M1LastCheckedAt] = useState(() => initialPersistedM1Check?.checkedAt ?? '')
  const [localStoreStatus, setLocalStoreStatus] = useState<StoreV6CheckPayload | null>(() => initialPersistedStoreV6Status?.payload ?? null)
  const [selectedAggregatePeriods, setSelectedAggregatePeriods] = useState<string[]>([])
  const [storeCheckLoading, setStoreCheckLoading] = useState(false)
  const [storeCheckError, setStoreCheckError] = useState('')
  const [storeActionStatus, setStoreActionStatus] = useState('')
  const [m1CheckJob, setM1CheckJob] = useState<Mt5M1CheckJobPayload | null>(null)
  const [pullProgress, setPullProgress] = useState<StoreV6PullJobPayload | null>(null)
  const [aggregateProgress, setAggregateProgress] = useState<StoreV6AggregateJobPayload | null>(null)
  const activePullJobRef = useRef('')
  const activeAggregateJobRef = useRef('')
  const pullPipelineCancelRequestedRef = useRef(false)
  const pullEventSourceRef = useRef<EventSource | null>(null)
  const aggregateEventSourceRef = useRef<EventSource | null>(null)
  const preparePagePartitionInFlightRef = useRef<{
    key: string
    promise: Promise<StoreV6CheckPayload | null>
  } | null>(null)

  const storeOperationLine = useMemo(
    () => formatStoreOperationLine(pullProgress, m1CheckJob, aggregateProgress, storeActionStatus),
    [aggregateProgress, m1CheckJob, pullProgress, storeActionStatus],
  )
  const storeOperationProgress = useMemo(
    () => resolveStoreOperationProgress(pullProgress, m1CheckJob, aggregateProgress),
    [aggregateProgress, m1CheckJob, pullProgress],
  )
  const canAggregateStoreV6 = Boolean(
    localStoreStatus?.directM1?.rowsCount
      && localStoreStatus.directM1.status !== 'missing'
      && (
        localStoreStatus.directM1.datasetKey?.includes(':clean:M1')
        || localStoreStatus.directM1.datasetKey?.includes(':direct:M1')
      ),
  )
  const {
    handleCancelMt5M1Check,
    handleCheckMt5M1,
    handleCheckMt5M1Staged,
  } = useStoreV6M1CheckJobs({
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

  function openChartForStatus(symbol: string, payload: StoreV6CheckPayload) {
    const period = periodFromStoreTableKey(selectedStoreTableKey) || readSharedSelection().period || 'M1'
    if (resolveStoreV6PagePartitionMode(period) === 'm5-time' || !hasStoreV6PeriodPageSystemV2(period)) return
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
  } = useStoreV6MaintenanceActions({
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
    const symbol = selectedRowSymbol
    pullPipelineCancelRequestedRef.current = true
    clearPullJobRefs({ activePullJobRef, pullEventSourceRef })
    clearAggregateJobRefs({ activeAggregateJobRef, aggregateEventSourceRef })
    setPullProgress(null)
    setAggregateProgress(null)
    setStoreCheckLoading(false)
    setStoreActionStatus('')
    try {
      await cancelStoreV6PullJob(jobId)
      if (symbol) await cancelStoreV6AggregateJobsForSymbol(symbol)
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCancelAggregateStore() {
    const jobId = aggregateProgress?.jobId
    const symbol = selectedRowSymbol
    if (!jobId && !symbol) return
    clearAggregateJobRefs({ activeAggregateJobRef, aggregateEventSourceRef })
    setAggregateProgress(null)
    setStoreCheckLoading(false)
    setStoreActionStatus('')
    try {
      if (jobId) await cancelStoreV6AggregateJob(jobId)
      if (symbol) await cancelStoreV6AggregateJobsForSymbol(symbol)
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
    setAggregateProgress(null)
    pullPipelineCancelRequestedRef.current = false
    setStoreActionStatus('Pulling MT5 M1 into StoreV6...')
    try {
      let currentStore: StoreV6CheckPayload | null = null
      try {
        currentStore = await fetchStoreV6Status(symbol)
      } catch {
        currentStore = null
      }
      const pullMode = resolveStoreV6PullMode(currentStore)
      setStoreActionStatus(pullMode === 'incremental' ? 'Incremental MT5 M1 pull into StoreV6...' : 'Initial MT5 M1 pull into StoreV6...')
      const started = await startStoreV6PullJob(symbol, pullMode)
      activePullJobRef.current = started.jobId
      setPullProgress(started)
      let pullResult: StoreV6PullJobPayload
      try {
        pullResult = await waitStoreV6PullJobWithFallback(started.jobId, { activePullJobRef, pullEventSourceRef, setPullProgress })
      } catch (err) {
        if (activePullJobRef.current !== started.jobId) return
        throw err
      }
      if (pullPipelineCancelRequestedRef.current || activePullJobRef.current !== started.jobId) return
      setStoreActionStatus('Refreshing StoreV6 status...')
      const rowsWritten = pullResult.rowsWritten ?? pullResult.result?.rowsWritten ?? 0
      const noNewM1 = pullResult.result?.noNewClosedM1 === true || rowsWritten <= 0
      const payload = await fetchStoreV6Status(symbol)
      if (pullPipelineCancelRequestedRef.current || activePullJobRef.current !== started.jobId) return
      setLocalStoreStatus(payload)
      savePersistedStoreV6Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      openChartForStatus(symbol, payload)
      setStoreActionStatus(noNewM1 ? '没有新的已闭合 M1，拉取已跳过。' : `拉取完成：新增 ${rowsWritten.toLocaleString('en-US')} 根 M1。需要更新高周期时，请点击“聚合”。`)
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
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(null)
    setStoreActionStatus('正在检查需要聚合的周期...')
    try {
      if (!canAggregateStoreV6) throw new Error('StoreV6 Clean M1 is not ready. Pull M1 before aggregating.')
      const latestStatus = await fetchStoreV6Status(symbol)
      setLocalStoreStatus(latestStatus)
      const neededPeriods = resolveStoreV6AggregateTargets(latestStatus)
      const periods = selectedAggregatePeriods.length
        ? selectedAggregatePeriods.filter((period) => neededPeriods.includes(period))
        : neededPeriods
      if (!periods.length) {
        savePersistedStoreV6Status(symbol, latestStatus, new Date().toISOString(), storePanelPersistenceEnabled)
        setStoreActionStatus('聚合已是最新，无需重复聚合。')
        window.setTimeout(() => setStoreActionStatus(''), 1600)
        return
      }
      setAggregateProgress(createPendingAggregateProgress(symbol, periods))
      setStoreActionStatus(`正在聚合需要更新的周期：${periods.join(', ')}...`)
      const started = await startStoreV6AggregateJob(symbol, periods)
      activeAggregateJobRef.current = started.jobId
      setAggregateProgress(started)
      await waitStoreV6AggregateJobWithFallback(started.jobId, { activeAggregateJobRef, aggregateEventSourceRef, setAggregateProgress })
      setAggregateProgress(createCompletedAggregateProgress(activeAggregateJobRef.current, symbol, periods))
      const payload = await fetchStoreV6Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV6Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
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

  async function handlePreparePagePartition(period?: string) {
    const symbol = selectedRowSymbol
    if (!symbol) throw new Error('请选择交易品种。')
    const normalizedPeriod = String(period || periodFromStoreTableKey(selectedStoreTableKey) || '').trim().toUpperCase()
    const inFlightKey = `${symbol.trim().toUpperCase()}:${normalizedPeriod}`
    const inFlight = preparePagePartitionInFlightRef.current
    if (inFlight?.key === inFlightKey) return inFlight.promise
    const promise = runPreparePagePartition(symbol, normalizedPeriod, inFlightKey)
    preparePagePartitionInFlightRef.current = { key: inFlightKey, promise }
    return promise
  }

  async function runPreparePagePartition(symbol: string, normalizedPeriod: string, inFlightKey: string) {
    const targetAggregatePeriods = normalizedPeriod === 'M5' ? ['M5'] : null
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setAggregateProgress(null)
    pullPipelineCancelRequestedRef.current = false
    setStoreActionStatus('整理分页前置链：正在拉取 StoreV6 最新 M1...')
    try {
      let currentStore: StoreV6CheckPayload | null = null
      try {
        currentStore = await fetchStoreV6Status(symbol)
      } catch {
        currentStore = null
      }

      const pullMode = resolveStoreV6PullMode(currentStore)
      const startedPull = await startStoreV6PullJob(symbol, pullMode)
      activePullJobRef.current = startedPull.jobId
      setPullProgress(startedPull)
      const pullResult = await waitStoreV6PullJobWithFallback(startedPull.jobId, { activePullJobRef, pullEventSourceRef, setPullProgress })
      if (pullPipelineCancelRequestedRef.current || activePullJobRef.current !== startedPull.jobId) throw new Error('store_v6_pull_cancelled')

      const rowsWritten = pullResult.rowsWritten ?? pullResult.result?.rowsWritten ?? 0
      setStoreActionStatus(rowsWritten > 0
        ? `整理分页前置链：拉取完成，新增 ${rowsWritten.toLocaleString('en-US')} 根 M1，正在检查聚合...`
        : '整理分页前置链：M1 已是最新，正在检查聚合...')

      clearPullJobRefs({ activePullJobRef, pullEventSourceRef })
      setPullProgress(null)

      const afterPullStatus = await fetchStoreV6Status(symbol)
      setLocalStoreStatus(afterPullStatus)
      const allPeriods = resolveStoreV6AggregateTargets(afterPullStatus)
      const periods = targetAggregatePeriods
        ? allPeriods.filter((item) => targetAggregatePeriods.includes(item))
        : allPeriods
      if (periods.length) {
        setAggregateProgress(createPendingAggregateProgress(symbol, periods))
        setStoreActionStatus(`整理分页前置链：正在聚合 ${periods.join(', ')}...`)
        const startedAggregate = await startStoreV6AggregateJob(symbol, periods)
        activeAggregateJobRef.current = startedAggregate.jobId
        setAggregateProgress(startedAggregate)
        await waitStoreV6AggregateJobWithFallback(startedAggregate.jobId, { activeAggregateJobRef, aggregateEventSourceRef, setAggregateProgress })
        if (activeAggregateJobRef.current !== startedAggregate.jobId) throw new Error('store_v6_aggregate_cancelled')
        setAggregateProgress(createCompletedAggregateProgress(startedAggregate.jobId, symbol, periods))
      } else {
        setStoreActionStatus(targetAggregatePeriods
          ? 'M5 分页前置链：M5 聚合已是最新，正在生成分页。'
          : '整理分页前置链：聚合已是最新，正在 audit/repair...')
      }

      if (!targetAggregatePeriods) {
        setStoreActionStatus('整理分页前置链：正在执行 audit/repair...')
        await auditStoreV6(symbol, { repair: true })
      }
      const payload = await fetchStoreV6Status(symbol)
      setLocalStoreStatus(payload)
      savePersistedStoreV6Status(symbol, payload, new Date().toISOString(), storePanelPersistenceEnabled)
      setStoreActionStatus(targetAggregatePeriods
        ? 'M5 分页前置链完成，正在生成时间分页。'
        : '整理分页前置链完成，正在重建实时缓存和分页。')
      window.setTimeout(() => {
        setAggregateProgress((current) => (current?.phase === 'completed' ? null : current))
        setStoreActionStatus('')
      }, 1600)
      return payload
    } catch (err) {
      setAggregateProgress((current) => current ? { ...current, phase: 'failed' } : null)
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
      throw err
    } finally {
      if (preparePagePartitionInFlightRef.current?.key === inFlightKey) {
        preparePagePartitionInFlightRef.current = null
      }
      clearPullJobRefs({ activePullJobRef, pullEventSourceRef })
      clearAggregateJobRefs({ activeAggregateJobRef, aggregateEventSourceRef })
      setPullProgress(null)
      setStoreCheckLoading(false)
    }
  }

  return {
    aggregateProgress,
    canAggregateStoreV6,
    handleAggregateStore,
    handleCancelAggregateStore,
    handleCancelMt5M1Check,
    handleCancelPullStore,
    handleCheckMt5M1,
    handleCheckMt5M1Staged,
    handleCleanLocalM1,
    handleDeleteLocalStore,
    handleDeleteSelectedAggregates,
    handlePullStore,
    handlePreparePagePartition,
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
