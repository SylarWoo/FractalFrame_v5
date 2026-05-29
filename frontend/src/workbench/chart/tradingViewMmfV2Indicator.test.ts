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

  it('maps VDO threshold break markers to the break candle high or low', () => {
    const rows = [100, 101, 102, 103].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_SUPPORT_DOWN_BREAK',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_SUPPORT_UP_BREAK',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 2,
        eventIndex: 2,
        index: 2,
        markerIndex: 2,
        price: rows[2].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_RESISTANCE_UP_BREAK',
        windowEndIndex: 2,
        windowStartIndex: 2,
      },
      {
        confirmIndex: 3,
        eventIndex: 3,
        index: 3,
        markerIndex: 3,
        price: rows[3].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_RESISTANCE_DOWN_BREAK',
        windowEndIndex: 3,
        windowStartIndex: 3,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.supportDownBreakMarker).toBe(rows[0].high)
    expect(mappedRows[1]?.supportUpBreakMarker).toBe(rows[1].low)
    expect(mappedRows[2]?.resistanceUpBreakMarker).toBe(rows[2].low)
    expect(mappedRows[3]?.resistanceDownBreakMarker).toBe(rows[3].high)
  })

  it('lets VDO break markers replace stochastic high and low markers on the same candle side', () => {
    const rows = [100, 101].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_HIGH',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_SUPPORT_DOWN_BREAK',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_LOW',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_RESISTANCE_UP_BREAK',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.supportDownBreakMarker).toBe(rows[0].high)
    expect(mappedRows[0]?.highMarker).toBeUndefined()
    expect(mappedRows[1]?.resistanceUpBreakMarker).toBe(rows[1].low)
    expect(mappedRows[1]?.lowMarker).toBeUndefined()
  })

  it('keeps stochastic high and low markers when support and resistance classifications are present', () => {
    const rows = [100, 101].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_RESISTANCE',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_SUPPORT',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.highMarker).toBe(rows[0].high)
    expect(mappedRows[0]?.resistanceMarker).toBe(rows[0].high)
    expect(mappedRows[1]?.lowMarker).toBe(rows[1].low)
    expect(mappedRows[1]?.supportMarker).toBe(rows[1].low)
  })

  it('lets expected support and resistance markers replace stochastic high and low markers on the same candle', () => {
    const rows = [100, 101].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_HIGH',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_EXPECTED_RESISTANCE',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_LOW',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_EXPECTED_SUPPORT',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.expectedResistanceMarker).toBe(rows[0].high)
    expect(mappedRows[0]?.highMarker).toBeUndefined()
    expect(mappedRows[1]?.expectedSupportMarker).toBe(rows[1].low)
    expect(mappedRows[1]?.lowMarker).toBeUndefined()
  })

  it('lets trend rebound and pullback markers replace stochastic high and low markers on the same candle', () => {
    const rows = [100, 101].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_HIGH',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_DOWN_REBOUND',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_LOW',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_UP_PULLBACK',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.trendDownReboundMarker).toBe(rows[0].high)
    expect(mappedRows[0]?.highMarker).toBeUndefined()
    expect(mappedRows[1]?.trendUpPullbackMarker).toBe(rows[1].low)
    expect(mappedRows[1]?.lowMarker).toBeUndefined()
  })

  it('lets trend return markers replace rebound and pullback markers on the same candle', () => {
    const rows = [100, 101].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_HIGH',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_DOWN_REBOUND',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_DOWN_RETURN',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_LOW',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_UP_PULLBACK',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_UP_RETURN',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.trendDownReturnMarker).toBe(rows[0].high)
    expect(mappedRows[0]?.trendDownReboundMarker).toBeUndefined()
    expect(mappedRows[0]?.highMarker).toBeUndefined()
    expect(mappedRows[1]?.trendUpReturnMarker).toBe(rows[1].low)
    expect(mappedRows[1]?.trendUpPullbackMarker).toBeUndefined()
    expect(mappedRows[1]?.lowMarker).toBeUndefined()
  })

  it('lets trend divergence markers replace stochastic high and low while keeping support and resistance outside', () => {
    const rows = [100, 101].map((close, index) => createRow(index, close))
    const markers: MmfV2IndicatorMarker[] = [
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_SUPPORT',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 0,
        eventIndex: 0,
        index: 0,
        markerIndex: 0,
        price: rows[0].low,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_DOWN_DIVERGENCE',
        windowEndIndex: 0,
        windowStartIndex: 0,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_RESISTANCE',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
      {
        confirmIndex: 1,
        eventIndex: 1,
        index: 1,
        markerIndex: 1,
        price: rows[1].high,
        reason: [],
        time: Number.NaN,
        type: 'MMF_V2_TREND_UP_DIVERGENCE',
        windowEndIndex: 1,
        windowStartIndex: 1,
      },
    ]

    const mappedRows = createMmfV2RowsFromMarkers(rows, markers)

    expect(mappedRows[0]?.trendDownDivergenceMarker).toBe(rows[0].low)
    expect(mappedRows[0]?.lowMarker).toBeUndefined()
    expect(mappedRows[0]?.supportMarker).toBe(rows[0].low)
    expect(mappedRows[1]?.trendUpDivergenceMarker).toBe(rows[1].high)
    expect(mappedRows[1]?.highMarker).toBeUndefined()
    expect(mappedRows[1]?.resistanceMarker).toBe(rows[1].high)
  })
})

