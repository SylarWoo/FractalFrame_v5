import { describe, expect, it } from 'vitest'
import { buildRealtimePageMonitorSnapshotV2 } from './realtimePageMonitorV2'

function row(seconds: number) {
  return {
    close: 1,
    high: 1,
    low: 1,
    open: 1,
    timestamp: seconds * 1000,
    volume: 1,
  }
}

describe('realtimePageMonitorV2', () => {
  it('counts only completed realtime candles and excludes the ticking tail candle', () => {
    const sessionTimeFrom = 1_780_956_000
    const rows = Array.from({ length: 8 }, (_, index) => row(sessionTimeFrom + index * 300))

    expect(buildRealtimePageMonitorSnapshotV2({
      rows,
      sessionTimeFrom,
    })).toEqual({
      rangeTimeFrom: sessionTimeFrom,
      rangeTimeTo: sessionTimeFrom + 6 * 300,
      rows: 7,
      sessionTimeFrom,
      tailTime: sessionTimeFrom + 7 * 300,
    })
  })

  it('keeps the realtime page empty before the first candle closes', () => {
    const sessionTimeFrom = 1_780_956_000
    expect(buildRealtimePageMonitorSnapshotV2({
      rows: [row(sessionTimeFrom)],
      sessionTimeFrom,
    })).toEqual({
      rangeTimeFrom: sessionTimeFrom,
      rangeTimeTo: null,
      rows: 0,
      sessionTimeFrom,
      tailTime: sessionTimeFrom,
    })
  })

  it('uses stable realtime rows directly without dropping another candle', () => {
    const sessionTimeFrom = 1_780_956_000
    const stableRows = Array.from({ length: 7 }, (_, index) => row(sessionTimeFrom + index * 300))

    expect(buildRealtimePageMonitorSnapshotV2({
      rows: stableRows,
      rowsAreStable: true,
      sessionTimeFrom,
      tailTime: sessionTimeFrom + 7 * 300,
    })).toEqual({
      rangeTimeFrom: sessionTimeFrom,
      rangeTimeTo: sessionTimeFrom + 6 * 300,
      rows: 7,
      sessionTimeFrom,
      tailTime: sessionTimeFrom + 7 * 300,
    })
  })
})
