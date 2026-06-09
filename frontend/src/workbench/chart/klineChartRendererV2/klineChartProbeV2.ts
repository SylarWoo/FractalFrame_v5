import type { KLineChartRenderFrameV2 } from '../klineChartRenderFrameV2'

type KLineChartProbeEventV2 = {
  at: number
  frameKey: string
  lastClose: number | null
  mainRows: number
  pageIndex: number
  renderWindowKey: string
  realtimeRows: number
  reason?: string
  sameRenderWindow: boolean
  type: 'full-frame' | 'tail-update' | 'pane-only' | 'skipped'
}

type KLineChartProbeSummaryV2 = {
  events: KLineChartProbeEventV2[]
  fullFrame: number
  paneOnly: number
  skipped: number
  tailUpdate: number
}

declare global {
  interface Window {
    __ffKLineChartV2Probe?: KLineChartProbeSummaryV2
  }
}

const maxProbeEvents = 240

function readLastClose(frame: KLineChartRenderFrameV2) {
  const close = frame.mainRows[frame.mainRows.length - 1]?.close
  return typeof close === 'number' && Number.isFinite(close) ? close : null
}

function ensureProbe(): KLineChartProbeSummaryV2 | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  if (!window.__ffKLineChartV2Probe) {
    window.__ffKLineChartV2Probe = {
      events: [],
      fullFrame: 0,
      paneOnly: 0,
      skipped: 0,
      tailUpdate: 0,
    }
  }
  return window.__ffKLineChartV2Probe
}

export function recordKLineChartProbeEventV2(options: {
  frame: KLineChartRenderFrameV2
  reason?: string
  renderWindowKey: string
  sameRenderWindow: boolean
  type: KLineChartProbeEventV2['type']
}) {
  const probe = ensureProbe()
  if (!probe) return
  if (options.type === 'full-frame') probe.fullFrame += 1
  if (options.type === 'tail-update') probe.tailUpdate += 1
  if (options.type === 'pane-only') probe.paneOnly += 1
  if (options.type === 'skipped') probe.skipped += 1
  probe.events.push({
    at: Date.now(),
    frameKey: options.frame.key,
    lastClose: readLastClose(options.frame),
    mainRows: options.frame.mainRows.length,
    pageIndex: options.frame.pageIndex,
    reason: options.reason,
    realtimeRows: options.frame.segments.realtime?.rows ?? 0,
    renderWindowKey: options.renderWindowKey,
    sameRenderWindow: options.sameRenderWindow,
    type: options.type,
  })
  if (probe.events.length > maxProbeEvents) {
    probe.events.splice(0, probe.events.length - maxProbeEvents)
  }
}

export function resetKLineChartProbeV2() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return
  window.__ffKLineChartV2Probe = {
    events: [],
    fullFrame: 0,
    paneOnly: 0,
    skipped: 0,
    tailUpdate: 0,
  }
}
