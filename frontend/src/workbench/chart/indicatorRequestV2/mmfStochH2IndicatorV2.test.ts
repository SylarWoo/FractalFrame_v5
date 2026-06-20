import { describe, expect, it } from 'vitest'
import { defaultMmfStochH2IndicatorSettings, defaultStochIndicatorSettings } from '../../rightDrawer/indicatorPersistence'
import type { StoreV6WindowKLine } from '../pageSliceV2'
import { calculateMmfStochH2Rows } from './mmfStochH2IndicatorV2'

function row(index: number, close: number, period = 'H2', seconds = 7200): StoreV6WindowKLine {
  const time = index * seconds
  return {
    barKey: `XAUUSDm:${period}:${index}`,
    close,
    closeTime: time + seconds,
    globalIndex: index,
    high: 100,
    low: 0,
    open: close,
    period,
    sessionId: 's',
    source: 'store-v6-page-slice-v2',
    symbol: 'XAUUSDm',
    time,
    timestamp: time * 1000,
    tradingDay: '2026-06-01',
    volume: 1,
  }
}

const enabledSettings = {
  ...defaultMmfStochH2IndicatorSettings,
  showCloseOverbought: true,
  showCloseOversold: true,
  showEnterOverbought: true,
  showEnterOversold: true,
}

const fastStochSettings = {
  ...defaultStochIndicatorSettings,
  dSmoothing: 1,
  kSmoothing: 1,
  length: 2,
}

describe('calculateMmfStochH2Rows', () => {
  it('marks simultaneous stochastic crossings on H2 closed candles', () => {
    const rows = [
      row(0, 50),
      row(1, 50),
      row(2, 100),
      row(3, 50),
      row(4, 0),
      row(5, 50),
    ]
    const result = calculateMmfStochH2Rows(rows, {
      period: 'H2',
      settings: enabledSettings,
      stochSettings: fastStochSettings,
    })

    expect(result[2].enterOverboughtMarker).toBe(rows[2].high)
    expect(result[3].closeOverboughtMarker).toBe(rows[3].high)
    expect(result[4].enterOversoldMarker).toBe(rows[4].low)
    expect(result[5].closeOversoldMarker).toBe(rows[5].low)
  })

  it('skips unselected passthrough periods and skips the realtime tail row', () => {
    const rows = [row(0, 50), row(1, 50), row(2, 100)]

    expect(calculateMmfStochH2Rows(rows, {
      period: 'M30',
      settings: { ...enabledSettings, passthroughPeriods: ['H2'] },
      stochSettings: fastStochSettings,
    })[2].enterOverboughtMarker).toBeUndefined()

    expect(calculateMmfStochH2Rows(rows, {
      period: 'H2',
      settings: enabledSettings,
      skipLast: true,
      stochSettings: fastStochSettings,
    })[2].enterOverboughtMarker).toBeUndefined()
  })

  it('does not emit close signals before the matching entry signal', () => {
    const rows = [
      row(0, 100),
      row(1, 100),
      row(2, 50),
      row(3, 100),
      row(4, 50),
      row(5, 0),
      row(6, 50),
    ]
    const result = calculateMmfStochH2Rows(rows, {
      period: 'H2',
      settings: enabledSettings,
      stochSettings: fastStochSettings,
    })

    expect(result[2].closeOverboughtMarker).toBe(rows[2].high)
    expect(result[3].enterOverboughtMarker).toBe(rows[3].high)
    expect(result[4].closeOverboughtMarker).toBe(rows[4].high)
    expect(result[5].enterOversoldMarker).toBe(rows[5].low)
    expect(result[6].closeOversoldMarker).toBe(rows[6].low)

    const initialOversoldRows = [
      row(0, 0),
      row(1, 0),
      row(2, 50),
    ]
    const initialOversoldResult = calculateMmfStochH2Rows(initialOversoldRows, {
      period: 'H2',
      settings: enabledSettings,
      stochSettings: fastStochSettings,
    })
    expect(initialOversoldResult[2].closeOversoldMarker).toBe(initialOversoldRows[2].low)
  })

  it('continues an active H2 overbought state from warmup rows before emitting a close event', () => {
    const rows = [
      row(0, 100),
      row(1, 100),
      row(2, 50),
    ]
    const result = calculateMmfStochH2Rows(rows, {
      period: 'H2',
      settings: enabledSettings,
      stochSettings: fastStochSettings,
    })

    expect(result[2].closeOverboughtMarker).toBe(rows[2].high)
  })

  it('maps H2 stochastic signal events to matching M5 timestamps', () => {
    const h2Closes = [50, 50, 100, 50, 50]
    const rows = h2Closes.flatMap((close, bucketIndex) => (
      Array.from({ length: 24 }, (_, offset) => {
        const index = bucketIndex * 24 + offset
        return row(index, close, 'M5', 300)
      })
    ))
    const result = calculateMmfStochH2Rows(rows, {
      period: 'M5',
      settings: { ...enabledSettings, passthroughPeriods: ['M5', 'H2'] },
      stochSettings: fastStochSettings,
      targetPeriod: 'M5',
    })

    expect(result[71].enterOverboughtMarker).toBe(rows[71].high)
    expect(result[95].closeOverboughtMarker).toBe(rows[95].high)
    expect(result[72].enterOverboughtMarker).toBeUndefined()
    expect(result[96].closeOverboughtMarker).toBeUndefined()
    expect(result[48].enterOverboughtMarker).toBeUndefined()
  })

  it('ignores incomplete M5 buckets when building passthrough H2 source rows', () => {
    const h2Closes = [50, 50, 100, 50]
    const fullRows = h2Closes.flatMap((close, bucketIndex) => (
      Array.from({ length: 24 }, (_, offset) => row(bucketIndex * 24 + offset, close, 'M5', 300))
    ))
    const rowsMissingBucketOpen = fullRows.slice(1)
    const result = calculateMmfStochH2Rows(rowsMissingBucketOpen, {
      period: 'M5',
      settings: { ...enabledSettings, passthroughPeriods: ['M5'] },
      stochSettings: fastStochSettings,
      targetPeriod: 'M5',
    })

    expect(result.some((item) => item.enterOverboughtMarker != null)).toBe(false)
  })
})
