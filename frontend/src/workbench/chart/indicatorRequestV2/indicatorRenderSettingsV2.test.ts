import { describe, expect, it } from 'vitest'
import type { StoreV6HistoryPageWindow } from '../historyPageWindowV2'
import {
  applyStoreV6IndicatorRenderSettingsToHistoryWindowV2,
  createStoreV6CalculationIndicatorRequestsV2,
  createStoreV6IndicatorRenderSettingsSignatureV2,
} from './indicatorRenderSettingsV2'
import { createStoreV6IndicatorRequestSignatureV2 } from './indicatorRequestSignatureV2'

function historyWindow(): StoreV6HistoryPageWindow {
  return {
    boundary: {
      actualFromGlobalIndex: null,
      actualTimeFrom: 1,
      actualTimeTo: 2,
      actualToGlobalIndex: null,
      requestedFromGlobalIndex: null,
      requestedTimeFrom: 1,
      requestedTimeTo: 2,
      requestedToGlobalIndex: null,
    },
    calculationRows: [],
    displayOffset: 0,
    historyRows: [],
    indicators: {
      VWAP: {
        id: 'VWAP',
        key: 'vwap:rows:v1',
        rows: [{ vwap: 1 }],
        settings: { source: 'hlc3', vwapOpacity: 1 },
        source: 'test',
      },
    },
    key: 'history-window',
    page: {
      fromGlobalIndex: null,
      index: 1,
      limit: 10,
      pageType: 'history',
      realtime: false,
      rows: null,
      toGlobalIndex: null,
    },
    pageIndex: 1,
    period: 'M5',
    renderData: {
      indicators: {},
      klineRows: [],
    },
    source: 'store-v6-history-page-window-v2',
    status: 'ready',
    symbol: 'XAUUSDm',
    warmupRows: [],
  }
}

describe('indicatorRenderSettingsV2', () => {
  it('keeps style-only setting changes out of the calculation request signature', () => {
    const base = createStoreV6CalculationIndicatorRequestsV2([{
      id: 'VWAP',
      params: {
        anchorPeriod: 'session',
        band1FillOpacity: 0.2,
        source: 'hlc3',
        vwapOpacity: 1,
      },
    }])
    const changedStyle = createStoreV6CalculationIndicatorRequestsV2([{
      id: 'VWAP',
      params: {
        anchorPeriod: 'session',
        band1FillOpacity: 0.8,
        source: 'hlc3',
        vwapOpacity: 0.3,
      },
    }])
    const changedCalculation = createStoreV6CalculationIndicatorRequestsV2([{
      id: 'VWAP',
      params: {
        anchorPeriod: 'week',
        band1FillOpacity: 0.8,
        source: 'hlc3',
        vwapOpacity: 0.3,
      },
    }])

    expect(createStoreV6IndicatorRequestSignatureV2(base)).toBe(createStoreV6IndicatorRequestSignatureV2(changedStyle))
    expect(createStoreV6IndicatorRequestSignatureV2(base)).not.toBe(createStoreV6IndicatorRequestSignatureV2(changedCalculation))
  })

  it('applies render settings to an existing indicator window without changing rows', () => {
    const window = historyWindow()
    const requests = [{
      id: 'VWAP',
      params: {
        anchorPeriod: 'session',
        band1FillOpacity: 0.35,
        source: 'hlc3',
        vwapOpacity: 0.4,
      },
    }]
    const next = applyStoreV6IndicatorRenderSettingsToHistoryWindowV2(
      window,
      requests,
      createStoreV6IndicatorRenderSettingsSignatureV2(requests),
    )

    expect(next).not.toBe(window)
    expect(next?.indicators.VWAP.rows).toBe(window.indicators.VWAP.rows)
    expect(next?.indicators.VWAP.settings).toEqual(requests[0].params)
    expect(next?.key).toContain('render-settings')
  })
})
