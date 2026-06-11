import { describe, expect, it } from 'vitest'
import { readCrosshairDataIndex } from './paneTitleOverlayContent'

describe('readCrosshairDataIndex', () => {
  it('uses the candle crosshair index before a top-level payload index', () => {
    expect(readCrosshairDataIndex({
      dataIndex: 926,
      crosshair: { dataIndex: 922 },
    })).toBe(922)
  })

  it('falls back to the top-level data index when no crosshair index exists', () => {
    expect(readCrosshairDataIndex({ dataIndex: 926 })).toBe(926)
  })
})
