import { describe, expect, it } from 'vitest'
import {
  resolveRealtimeModeForHistoryPageV2,
  shouldDisplayRealtimeForHistoryPageV2,
} from './klineChartRenderViewportPolicyV2'

describe('klineChartRenderViewportPolicyV2', () => {
  it('shows realtime only for the first history page', () => {
    expect(shouldDisplayRealtimeForHistoryPageV2({ pageIndex: 1 } as never)).toBe(true)
    expect(shouldDisplayRealtimeForHistoryPageV2({ pageIndex: 2 } as never)).toBe(false)
  })

  it('keeps non-first history pages in background realtime mode', () => {
    expect(resolveRealtimeModeForHistoryPageV2({ pageIndex: 1 } as never)).toBe('visual')
    expect(resolveRealtimeModeForHistoryPageV2({ pageIndex: 3 } as never)).toBe('background')
  })
})
