import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Chart } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { repairStoreV5M1Gaps } from '../../services/mt5/mt5SymbolsApi'
import { chartWarn } from './chartLogger'
import { resolvePeriodSeconds } from './chartTimeFormatting'
import {
  historyPageSize,
  mergeKLineData,
  realtimeTailRepairLookbackMinutes,
  realtimeTailRepairMaxGapMinutes,
} from './chartCoreDataUtils'

type Mt5RealtimeTickEventDetail = {
  ask?: number | null
  bid?: number | null
  last?: number | null
  symbol: string
  time?: number | null
  volume?: number | null
}

type UseChartRealtimeTicksOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  period: string
  symbol: string
  totalRows?: number | null
}

export function useChartRealtimeTicks({ chartInstanceRef, period, symbol, totalRows }: UseChartRealtimeTicksOptions) {
  const realtimeTailRefreshInFlightRef = useRef(false)
  const realtimeTailRefreshBucketRef = useRef<number | null>(null)

  useEffect(() => {
    const chart = chartInstanceRef.current
    if (!chart) return

    realtimeTailRefreshInFlightRef.current = false
    realtimeTailRefreshBucketRef.current = null

    const refreshRealtimeTail = async (bucketTimestamp: number) => {
      if (period.trim().toUpperCase() !== '1M' && period.trim().toUpperCase() !== 'M1') return
      if (realtimeTailRefreshInFlightRef.current) return

      realtimeTailRefreshInFlightRef.current = true
      try {
        await repairStoreV5M1Gaps(symbol, {
          lookbackMinutes: realtimeTailRepairLookbackMinutes,
          maxGapMinutes: realtimeTailRepairMaxGapMinutes,
        })

        const timeTo = Math.floor(bucketTimestamp / 1000) + 60
        const timeFrom = timeTo - realtimeTailRepairLookbackMinutes * 60
        const tailData = await loadStoreV5KLineData({
          symbol,
          period,
          limit: realtimeTailRepairLookbackMinutes + 5,
          timeFrom,
          timeTo,
        })
        if (!tailData.length) return

        const currentData = chart.getDataList()
        const merged = mergeKLineData(currentData, tailData)
        const hasMoreOlder = typeof totalRows === 'number' && Number.isFinite(totalRows)
          ? merged.length < totalRows
          : currentData.length >= historyPageSize
        chart.applyNewData(merged, hasMoreOlder)
      } catch (error) {
        chartWarn('[StoreV5Datafeed] realtime tail refresh failed', error)
      } finally {
        realtimeTailRefreshInFlightRef.current = false
      }
    }

    const handleRealtimeTick = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as Partial<Mt5RealtimeTickEventDetail> : null
      if (!detail || detail.symbol !== symbol) return

      const last = typeof detail.last === 'number' && Number.isFinite(detail.last)
        ? detail.last
        : typeof detail.bid === 'number' && typeof detail.ask === 'number'
          ? (detail.bid + detail.ask) / 2
          : detail.bid ?? detail.ask
      if (typeof last !== 'number' || !Number.isFinite(last)) return

      const tickSeconds = typeof detail.time === 'number' && Number.isFinite(detail.time)
        ? Math.floor(detail.time)
        : Math.floor(Date.now() / 1000)
      const periodSeconds = resolvePeriodSeconds(period)
      const bucketTimestamp = Math.floor(tickSeconds / periodSeconds) * periodSeconds * 1000
      const currentData = chart.getDataList()
      const latest = currentData[currentData.length - 1]
      const volume = typeof detail.volume === 'number' && Number.isFinite(detail.volume) ? detail.volume : 0

      if (!latest || bucketTimestamp > latest.timestamp) {
        if (realtimeTailRefreshBucketRef.current !== bucketTimestamp) {
          realtimeTailRefreshBucketRef.current = bucketTimestamp
          void refreshRealtimeTail(bucketTimestamp)
        }
        chart.updateData({
          timestamp: bucketTimestamp,
          open: latest?.close ?? last,
          high: last,
          low: last,
          close: last,
          volume,
        })
        return
      }

      if (bucketTimestamp === latest.timestamp) {
        chart.updateData({
          ...latest,
          high: Math.max(Number(latest.high), last),
          low: Math.min(Number(latest.low), last),
          close: last,
          volume: Math.max(Number(latest.volume ?? 0), volume),
        })
      }
    }

    window.addEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
    return () => window.removeEventListener('fractalframe:mt5RealtimeTick', handleRealtimeTick)
  }, [chartInstanceRef, period, symbol, totalRows])
}
