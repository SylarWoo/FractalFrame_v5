export const realtimeStablePageRebuildRequestedEvent = 'fractalframe:chartRealtimeStablePageRebuildRequested'
export const realtimeStablePageRebuildCompletedEvent = 'fractalframe:chartRealtimeStablePageRebuildCompleted'

export type RealtimeStablePageRebuildRequestDetail = {
  period?: string | null
  reason: 'realtime-stable-page-rebuild'
  symbol?: string | null
}

export type RealtimeStablePageRebuildCompletedDetail = {
  period: string
  rows: number
  stableRows: number
  symbol: string
  tailTime: number | null
}

export function dispatchRealtimeStablePageRebuildRequested(options: {
  period?: string | null
  symbol?: string | null
}) {
  window.dispatchEvent(new CustomEvent<RealtimeStablePageRebuildRequestDetail>(realtimeStablePageRebuildRequestedEvent, {
    detail: {
      period: options.period ?? null,
      reason: 'realtime-stable-page-rebuild',
      symbol: options.symbol ?? null,
    },
  }))
}

export function dispatchRealtimeStablePageRebuildCompleted(detail: RealtimeStablePageRebuildCompletedDetail) {
  window.dispatchEvent(new CustomEvent<RealtimeStablePageRebuildCompletedDetail>(realtimeStablePageRebuildCompletedEvent, {
    detail,
  }))
}
