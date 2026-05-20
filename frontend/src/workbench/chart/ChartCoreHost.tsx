import { useEffect } from 'react'
import { useChartDataLoad } from './useChartDataLoad'
import { useChartInstance } from './useChartInstance'
import { useChartRealtimeTicks } from './useChartRealtimeTicks'
import { useChartStepLoad } from './useChartStepLoad'
import './ChartCoreHost.css'

type ChartCoreHostProps = {
  displayName?: string
  jump?: { id: number; timestamp?: number } | null
  limit?: number
  onLoadStateChange?: (state: ChartLoadState) => void
  period: string
  reloadId?: number
  stepLoad?: { direction: 'left' | 'right'; id: number } | null
  symbol: string
  totalRows?: number | null
}

export type ChartLoadState = {
  error: boolean
  loading: boolean
  loadingMore: boolean
  period: string
  requestedRows: number
  rows: number
  symbol: string
  totalRows?: number | null
}

export function ChartCoreHost({ displayName, jump, limit, onLoadStateChange, period, reloadId, stepLoad, symbol, totalRows }: ChartCoreHostProps) {
  const { chartInstanceRef, chartRef } = useChartInstance({ displayName, period, symbol })
  const { loadState, setLoadState } = useChartDataLoad({ chartInstanceRef, jump, limit, period, reloadId, symbol, totalRows })

  useEffect(() => {
    onLoadStateChange?.({ ...loadState, period, symbol, totalRows })
  }, [loadState, onLoadStateChange, period, symbol, totalRows])

  useChartRealtimeTicks({ chartInstanceRef, period, symbol, totalRows })
  useChartStepLoad({ chartInstanceRef, period, setLoadState, stepLoad: stepLoad ?? null, symbol, totalRows })

  return (
    <section className="ff-chart-core-host" aria-label={`${symbol} ${period} chart`}>
      <div ref={chartRef} className="ff-chart-core-host__canvas" />
    </section>
  )
}
