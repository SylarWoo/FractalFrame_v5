import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { createBarKey } from './barIdentity'
import { createMmfV2RowsFromMarkers } from './tradingViewMmfV2Indicator'
import type { MmfV2IndicatorMarker } from '../../services/mt5/mmfV2IndicatorApi'

function createRow(index: number, close: number): KLineData {
  const timestamp = 1_700_000_000_000 + index * 5 * 60 * 1000
  return {
    close,
    high: close + 2,
    low: close - 2,
    open: close,
    timestamp,
    volume: 1,
  }
}

function barKey(index: number) {
  return createBarKey('XAUUSDm', 'M5', 1_700_000_000 + index * 5 * 60)
}

describe('tradingViewMmfV2Indicator row mapping', () => {
  it('maps backend event, anchor, and entry coordinates to the exact frontend rows', () => {
    const rows = [100, 101, 105, 103, 99, 98, 102, 104].map((close, index) => createRow(index, close))
    rows.forEach((row, index) => {
      ;(row as KLineData & { barKey?: string }).barKey = barKey(index)
    })

    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 5,
        confirmBarKey: barKey(5),
        confirmTime: 1_700_000_000 + 5 * 300,
        entryIndex: 5,
        entryBarKey: barKey(5),
        entryPrice: 98,
        entryTime: 1_700_000_000 + 5 * 300,
        eventIndex: 2,
        eventBarKey: barKey(2),
        eventTime: 1_700_000_000 + 2 * 300,
        index: 3,
        markerIndex: 3,
        markerBarKey: barKey(3),
        pointDistance: 7,
        price: 105,
        reason: [],
        time: 1_700_000_000 + 3 * 300,
        type: 'MMF_V2_HIGH',
        windowEndIndex: 2,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 7,
        confirmBarKey: barKey(7),
        confirmTime: 1_700_000_000 + 7 * 300,
        entryIndex: 7,
        entryBarKey: barKey(7),
        entryPrice: 104,
        entryTime: 1_700_000_000 + 7 * 300,
        eventIndex: 4,
        eventBarKey: barKey(4),
        eventTime: 1_700_000_000 + 4 * 300,
        index: 5,
        markerIndex: 5,
        markerBarKey: barKey(5),
        pointDistance: 6,
        price: 98,
        reason: [],
        time: 1_700_000_000 + 5 * 300,
        type: 'MMF_V2_LOW',
        windowEndIndex: 4,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[2]?.deadCrossMarker).toBe(rows[2].high)
    expect(mappedRows[3]?.highMarker).toBe(105)
    expect(mappedRows[5]?.highConfirmPointMarker).toBe(rows[5].high)
    expect(mappedRows[5]?.highConfirmPointMarkerPrice).toBe(98)
    expect(mappedRows[5]?.highConfirmPointDistance).toBe(7)

    expect(mappedRows[4]?.goldenCrossMarker).toBe(rows[4].low)
    expect(mappedRows[5]?.lowMarker).toBe(98)
    expect(mappedRows[7]?.lowConfirmPointMarker).toBe(rows[7].low)
    expect(mappedRows[7]?.lowConfirmPointMarkerPrice).toBe(104)
    expect(mappedRows[7]?.lowConfirmPointDistance).toBe(6)
  })

  it('falls back to backend indexes when bar keys and times are unavailable', () => {
    const rows = [100, 101, 105, 103, 99, 98].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [{
      confirmIndex: 4,
      entryIndex: 4,
      entryPrice: 99,
      eventIndex: 1,
      index: 3,
      markerIndex: 3,
      pointDistance: 4,
      price: 103,
      reason: [],
      time: Number.NaN,
      type: 'MMF_V2_HIGH',
      windowEndIndex: 1,
      windowStartIndex: 0,
    }]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[1]?.deadCrossMarker).toBe(rows[1].high)
    expect(mappedRows[3]?.highMarker).toBe(103)
    expect(mappedRows[4]?.highConfirmPointMarker).toBe(rows[4].high)
  })
})

