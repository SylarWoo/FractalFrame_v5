import { describe, expect, it } from 'vitest'
import { shouldWaitForVisualRealtimeFrameV2 } from './ChartWorkspaceV2'

describe('shouldWaitForVisualRealtimeFrameV2', () => {
  it('waits for a visual realtime window before publishing an indicator frame', () => {
    expect(shouldWaitForVisualRealtimeFrameV2({
      indicatorRequests: [{ id: 'MA' }],
      realtimeEnabled: true,
      realtimeMode: 'visual',
      realtimeIndicatorsReady: false,
    })).toBe(true)
  })

  it('allows the frame when realtime indicators are ready', () => {
    expect(shouldWaitForVisualRealtimeFrameV2({
      indicatorRequests: [{ id: 'MA' }],
      realtimeEnabled: true,
      realtimeMode: 'visual',
      realtimeIndicatorsReady: true,
    })).toBe(false)
  })

  it('does not wait for background realtime pages or charts without indicators', () => {
    expect(shouldWaitForVisualRealtimeFrameV2({
      indicatorRequests: [{ id: 'MA' }],
      realtimeEnabled: true,
      realtimeMode: 'background',
      realtimeIndicatorsReady: false,
    })).toBe(false)
    expect(shouldWaitForVisualRealtimeFrameV2({
      indicatorRequests: [],
      realtimeEnabled: true,
      realtimeMode: 'visual',
      realtimeIndicatorsReady: false,
    })).toBe(false)
  })
})
