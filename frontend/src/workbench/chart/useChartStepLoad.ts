import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Chart } from 'klinecharts'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import { chartError, chartInfo } from './chartLogger'
import { applySessionBreakIndicator } from './sessionBreakIndicator'
import { historyPageSize, mergeKLineData, resolveHasMoreOlder } from './chartCoreDataUtils'
import { resetYAxisAutoScale } from './chartStyleAppliers'

type StepLoad = { direction: 'left' | 'right'; id: number } | null
type LoadState = {
  error: boolean
  loading: boolean
  loadingMore: boolean
  requestedRows: number
  rows: number
}

type UseChartStepLoadOptions = {
  chartInstanceRef: MutableRefObject<Chart | null>
  period: string
  setLoadState: Dispatch<SetStateAction<LoadState>>
  stepLoad: StepLoad
  symbol: string
  totalRows?: number | null
}

export function useChartStepLoad({ chartInstanceRef, period, setLoadState, stepLoad, symbol, totalRows }: UseChartStepLoadOptions) {
  useEffect(() => {
    if (!stepLoad) return

    const chart = chartInstanceRef.current
    if (!chart) return

    let disposed = false
    const currentData = chart.getDataList()
    if (!currentData.length) return

    setLoadState((current) => ({
      ...current,
      error: false,
      loadingMore: true,
    }))

    const oldest = currentData[0]
    const newest = currentData[currentData.length - 1]
    const options = stepLoad.direction === 'left'
      ? {
          limit: historyPageSize,
          period,
          symbol,
          timeTo: Math.floor(oldest.timestamp / 1000) - 1,
        }
      : {
          limit: historyPageSize,
          period,
          symbol,
          timeFrom: Math.floor(newest.timestamp / 1000) + 1,
        }

    chartInfo('[StoreV5Datafeed] request manual step start', {
      direction: stepLoad.direction,
      ...options,
    })

    loadStoreV5KLineData(options)
      .then((data) => {
        if (disposed) return

        const merged = stepLoad.direction === 'left'
          ? mergeKLineData(data, chart.getDataList())
          : mergeKLineData(chart.getDataList(), data)
        const hasMoreOlder = resolveHasMoreOlder({
          loadedRows: merged.length,
          pageSize: historyPageSize,
          receivedRows: stepLoad.direction === 'left' ? data.length : historyPageSize,
          totalRows,
        })

        chartInfo('[StoreV5Datafeed] callback manual step done', {
          direction: stepLoad.direction,
          rows: data.length,
          mergedRows: merged.length,
        })
        const targetTimestamp = stepLoad.direction === 'left'
          ? data[Math.floor(data.length / 2)]?.timestamp
          : data[Math.max(0, data.length - Math.floor(data.length / 2) - 1)]?.timestamp
        chart.applyNewData(merged, hasMoreOlder)
        window.setTimeout(() => {
          if (disposed) return
          resetYAxisAutoScale(chart)
          applySessionBreakIndicator(chart, symbol, period)
          if (typeof targetTimestamp === 'number') {
            chart.scrollToTimestamp(targetTimestamp, 0)
          }
          setLoadState((current) => ({
            ...current,
            error: false,
            loading: false,
            loadingMore: false,
            requestedRows: current.requestedRows,
            rows: chart.getDataList().length || merged.length,
          }))
        }, 0)
      })
      .catch((error: unknown) => {
        if (disposed) return

        chartError('[StoreV5Datafeed] request manual step failed', error)
        setLoadState((current) => ({
          ...current,
          error: true,
          loading: false,
          loadingMore: false,
          rows: chart.getDataList().length,
        }))
      })

    return () => {
      disposed = true
    }
  }, [chartInstanceRef, period, setLoadState, stepLoad, symbol, totalRows])
}
