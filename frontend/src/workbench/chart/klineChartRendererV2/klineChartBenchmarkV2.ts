import type { Chart } from 'klinecharts'
import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

type IndicatorPerfDebugV2 = {
  entries?: Array<{
    cacheHit?: boolean
    id: string
    ms: number
    source: 'history' | 'realtime'
  }>
  totals?: Record<string, {
    cacheHits?: number
    count: number
    maxMs: number
    totalMs: number
  }>
}

declare global {
  interface Window {
    __ffRunChartV2Benchmark?: () => Promise<Record<string, unknown>>
  }
}

function sumRows(frame: KLineChartRenderFrameV2) {
  const start = performance.now()
  let checksum = 0
  for (const row of frame.mainRows) {
    checksum += Number(row.close ?? 0)
    checksum += Number(row.volume ?? 0)
  }
  return {
    checksum: Number(checksum.toFixed(3)),
    ms: Number((performance.now() - start).toFixed(3)),
    rows: frame.mainRows.length,
  }
}

function summarizeIndicatorPerf() {
  const perf = (window as unknown as { __ffIndicatorV2Perf?: IndicatorPerfDebugV2 }).__ffIndicatorV2Perf
  if (!perf?.totals) return null
  return Object.fromEntries(Object.entries(perf.totals).map(([id, total]) => [id, {
    averageMs: total.count > 0 ? Number((total.totalMs / total.count).toFixed(3)) : 0,
    cacheHits: total.cacheHits ?? 0,
    count: total.count,
    maxMs: total.maxMs,
  }]))
}

export function installKLineChartBenchmarkV2(chart: Chart, getFrame: () => KLineChartRenderFrameV2 | null) {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return { destroy() {} }
  }
  const previous = window.__ffRunChartV2Benchmark
  const benchmark = async () => {
    const frame = getFrame()
    if (!frame) return { ok: false, reason: 'missing-frame' }
    const start = performance.now()
    const visibleRange = chart.getVisibleRange?.() ?? null
    const offsetRightDistance = chart.getOffsetRightDistance?.() ?? null
    const rowScan = sumRows(frame)
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    return {
      frame: {
        key: frame.key,
        mainRows: frame.mainRows.length,
        pageIndex: frame.pageIndex,
        period: frame.period,
        realtimeRows: frame.segments.realtime?.rows ?? 0,
        symbol: frame.symbol,
      },
      indicatorPerf: summarizeIndicatorPerf(),
      offsetRightDistance,
      ok: true,
      rowScan,
      totalMs: Number((performance.now() - start).toFixed(3)),
      visibleRange,
    }
  }
  window.__ffRunChartV2Benchmark = benchmark
  return {
    destroy() {
      if (window.__ffRunChartV2Benchmark !== benchmark) return
      if (previous) {
        window.__ffRunChartV2Benchmark = previous
      } else {
        delete window.__ffRunChartV2Benchmark
      }
    },
  }
}
