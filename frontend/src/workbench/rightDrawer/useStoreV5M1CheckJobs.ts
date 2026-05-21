import { useRef } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { cancelMt5M1CheckJob, fetchMt5M1CheckJob, fetchStoreV5Check, startMt5M1CheckJob } from '../../services/mt5/mt5SymbolsApi'
import type { Mt5M1CheckJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import { delay } from '../mt5DataCenter/storeV5StatusFormat'
import { savePersistedM1CheckResult } from '../mt5DataCenter/storeV5Persistence'

type UseStoreV5M1CheckJobsOptions = {
  selectedRowSymbol: string
  storeCheck: StoreV5CheckPayload | null
  storePanelPersistenceEnabled: boolean
  m1CheckJob: Mt5M1CheckJobPayload | null
  setM1CheckJob: Dispatch<SetStateAction<Mt5M1CheckJobPayload | null>>
  setMt5M1LastCheckedAt: Dispatch<SetStateAction<string>>
  setPullProgress: Dispatch<SetStateAction<StoreV5PullJobPayload | null>>
  setStoreActionStatus: Dispatch<SetStateAction<string>>
  setStoreCheck: Dispatch<SetStateAction<StoreV5CheckPayload | null>>
  setStoreCheckError: Dispatch<SetStateAction<string>>
  setStoreCheckLoading: Dispatch<SetStateAction<boolean>>
}

export function useStoreV5M1CheckJobs({
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
}: UseStoreV5M1CheckJobsOptions) {
  const activeM1CheckJobRef = useRef('')

  async function handleCheckMt5M1() {
    const symbol = selectedRowSymbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setStoreActionStatus('正在检查 MT5 终端 M1...')
    try {
      const payload = await fetchStoreV5Check(symbol)
      setStoreCheck(payload)
      setStoreActionStatus('MT5 终端 M1 检查完成。')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreCheck(null)
      setStoreActionStatus('')
    } finally {
      setStoreCheckLoading(false)
    }
  }

  async function handleCheckMt5M1Staged() {
    const symbol = selectedRowSymbol
    if (!symbol) return
    setStoreCheckLoading(true)
    setStoreCheckError('')
    setPullProgress(null)
    setM1CheckJob(null)
    setStoreActionStatus('')
    try {
      const previous = storeCheck?.directM1
      const canIncremental = previous?.lastTime != null && (previous.trueM1RowsCount != null || previous.rowsCount != null)
      const started = await startMt5M1CheckJob(symbol, canIncremental ? {
        chunk: 200000,
        maxCount: 10000000,
        mode: 'incremental',
        sinceTime: previous.lastTime,
        baseFirstTime: previous.firstTime,
        baseLastTime: previous.lastTime,
        baseTrueM1RowsCount: previous.trueM1RowsCount ?? previous.rowsCount,
        baseMt5RowsCount: previous.mt5RowsCount ?? previous.trueM1RowsCount ?? previous.rowsCount,
        baseGapCount: previous.gapCount,
        overlapBars: 1000,
      } : { chunk: 200000, maxCount: 10000000, mode: 'refresh' })
      activeM1CheckJobRef.current = started.jobId
      setM1CheckJob(started)
      while (activeM1CheckJobRef.current === started.jobId) {
        await delay(600)
        const current = await fetchMt5M1CheckJob(started.jobId)
        setM1CheckJob(current)
        if (current.phase === 'completed') {
          if (current.result) {
            const checkedAt = new Date().toISOString()
            setStoreCheck(current.result)
            setMt5M1LastCheckedAt(checkedAt)
            savePersistedM1CheckResult(symbol, current.result, checkedAt, storePanelPersistenceEnabled)
          }
          setM1CheckJob(null)
          break
        }
        if (current.phase === 'failed' || current.phase === 'cancelled') throw new Error(current.error || current.status || current.phase)
      }
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
      setStoreActionStatus('')
    } finally {
      activeM1CheckJobRef.current = ''
      setPullProgress(null)
      setStoreCheckLoading(false)
    }
  }

  async function handleCancelMt5M1Check() {
    const jobId = m1CheckJob?.jobId
    if (!jobId) return
    activeM1CheckJobRef.current = ''
    try {
      setM1CheckJob(await cancelMt5M1CheckJob(jobId))
      setStoreActionStatus('')
    } catch (err) {
      setStoreCheckError(err instanceof Error ? err.message : String(err))
    } finally {
      setM1CheckJob(null)
      setStoreCheckLoading(false)
    }
  }

  return {
    handleCancelMt5M1Check,
    handleCheckMt5M1,
    handleCheckMt5M1Staged,
  }
}
