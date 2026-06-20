import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import {
  createIndicatorPageKey,
  createIndicatorSettingsHash,
  createIndicatorSnapshotRows,
  readIndicatorPageSnapshot,
  writeIndicatorPageSnapshot,
} from './indicatorPageSnapshotStore'
import { futurePlaceholderFlag } from './chartFuturePlaceholders'

describe('indicatorPageSnapshotStore', () => {
  const rows = [
    { timestamp: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5 },
    { timestamp: 1_700_000_300_000, open: 2, high: 3, low: 1.5, close: 2.5 },
    { timestamp: 1_700_000_600_000, open: 0, high: 0, low: 0, close: 0, [futurePlaceholderFlag]: true },
  ] as KLineData[]

  it('builds page snapshots from real bars only and indexes by barKey', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 1, period: 'M5', realtime: true, rows, symbol: 'XAUUSDm' })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'MMF_V3', period: 'M5' })
    const snapshotRows = createIndicatorSnapshotRows({
      mmfV3Rows: [{ highMarker: 2 }, { lowMarker: 1.5 }],
      period: 'M5',
      rows,
      symbol: 'XAUUSDm',
    })
    const snapshot = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: snapshotRows,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(snapshot.rows).toHaveLength(2)
    expect(snapshot.rows[0].barKey).toBe('XAUUSDm|M5|1700000000')
    expect(snapshot.rows[1].mmfV3?.lowMarker).toBe(1.5)
    expect(readIndicatorPageSnapshot(pageKey)?.byBarKey['XAUUSDm|M5|1700000000']?.mmfV3?.highMarker).toBe(2)
  })

  it('merges morgan range snapshots without dropping existing MMF rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 2, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'MMF_V3', period: 'M5' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        mmfV3Rows: [{ highMarker: 2 }, { lowMarker: 1.5 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash,
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      morganRange: {
        mode: 'H4_M5',
        segments: [{
          atr7: 1,
          center: 10,
          endIndex: 1,
          index: 1,
          levels: [],
          lower: 9,
          range: 1,
          startIndex: 0,
          startTimestamp: 1_700_000_000_000,
          trueRange: 0.5,
          upper: 11,
        }],
      },
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({ period: 'M5', rows, symbol: 'XAUUSDm' }),
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(merged.morganRange?.segments).toHaveLength(1)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.mmfV3?.highMarker).toBe(2)
  })

  it('merges MA rows without dropping existing MMF rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 3, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'MMF_V3', period: 'M5' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        mmfV3Rows: [{ highMarker: 2 }, { lowMarker: 1.5 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash,
      settingsHashKey: 'MMF_V3',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        maRows: [{ ma: 10, maColorIndex: 1 }, { ma: 11, maColorIndex: 2 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'MA', period: 'M5' }),
      settingsHashKey: 'MA',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.mmfV3?.highMarker).toBe(2)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.ma?.ma).toBe(10)
    expect(merged.settingsHashes?.MA).toBeTruthy()
    expect(merged.settingsHashes?.MMF_V3).toBe(settingsHash)
  })

  it('merges VWAP rows without dropping existing MA and MMF rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 4, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    const settingsHash = createIndicatorSettingsHash({ indicator: 'MMF_V3', period: 'M5' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        maRows: [{ ma: 10 }],
        mmfV3Rows: [{ highMarker: 2 }, { lowMarker: 1.5 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash,
      settingsHashes: { MA: 'ma-hash', MMF_V3: settingsHash },
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        vwapRows: [{ lowerBand1: 9, upperBand1: 11, vwap: 10 }],
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'VWAP', period: 'M5' }),
      settingsHashKey: 'VWAP',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.mmfV3?.highMarker).toBe(2)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.ma?.ma).toBe(10)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vwap?.vwap).toBe(10)
    expect(merged.settingsHashes?.MA).toBe('ma-hash')
    expect(merged.settingsHashes?.VWAP).toBeTruthy()
  })

  it('merges Stoch rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 5, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        maRows: [{ ma: 10 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        vwapRows: [{ lowerBand1: 9, upperBand1: 11, vwap: 10 }],
      }),
      settingsHash: 'ma-vwap',
      settingsHashes: { MA: 'ma-hash', VWAP: 'vwap-hash' },
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        stochRows: [{ k: 80, d: 70 }],
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'Stoch', period: 'M5' }),
      settingsHashKey: 'Stoch',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.ma?.ma).toBe(10)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vwap?.vwap).toBe(10)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.stoch?.k).toBe(80)
    expect(merged.settingsHashes?.Stoch).toBeTruthy()
  })

  it('merges VDO rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 6, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        stochRows: [{ k: 80, d: 70 }],
        symbol: 'XAUUSDm',
      }),
      settingsHash: 'stoch-hash',
      settingsHashKey: 'Stoch',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        vdoRows: [{ vdo: 0.5, vdoMa: 0.4, vdoMa2: 0.3 }],
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'VDO', period: 'M5' }),
      settingsHashKey: 'VDO',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.stoch?.k).toBe(80)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vdo?.vdo).toBe(0.5)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vdo?.vdoMa2).toBe(0.3)
    expect(merged.settingsHashes?.Stoch).toBe('stoch-hash')
    expect(merged.settingsHashes?.VDO).toBeTruthy()
  })

  it('merges VMI rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 7, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        vdoRows: [{ vdo: 0.5, vdoMa: 0.4 }],
      }),
      settingsHash: 'vdo-hash',
      settingsHashKey: 'VDO',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        vmiRows: [{ histogram: 0.12 }],
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'VMI', period: 'M5' }),
      settingsHashKey: 'VMI',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vdo?.vdo).toBe(0.5)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vmi?.histogram).toBe(0.12)
    expect(merged.settingsHashes?.VDO).toBe('vdo-hash')
    expect(merged.settingsHashes?.VMI).toBeTruthy()
  })

  it('merges TSI rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 8, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        vmiRows: [{ histogram: 0.12 }],
      }),
      settingsHash: 'vmi-hash',
      settingsHashKey: 'VMI',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        tsiRows: [{ signal: 18, tsi: 20 }],
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'TSI', period: 'M5' }),
      settingsHashKey: 'TSI',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vmi?.histogram).toBe(0.12)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.tsi?.tsi).toBe(20)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.tsi?.signal).toBe(18)
    expect(merged.settingsHashes?.VMI).toBe('vmi-hash')
    expect(merged.settingsHashes?.TSI).toBeTruthy()
  })

  it('merges AO rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 9, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        tsiRows: [{ signal: 18, tsi: 20 }],
      }),
      settingsHash: 'tsi-hash',
      settingsHashKey: 'TSI',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        aoRows: [{ histogram: 0.25 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'AO', period: 'M5' }),
      settingsHashKey: 'AO',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.tsi?.tsi).toBe(20)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.ao?.histogram).toBe(0.25)
    expect(merged.settingsHashes?.TSI).toBe('tsi-hash')
    expect(merged.settingsHashes?.AO).toBeTruthy()
  })

  it('merges VI rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 10, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        aoRows: [{ histogram: 0.25 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: 'ao-hash',
      settingsHashKey: 'AO',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        viRows: [{ minus: 0.8, plus: 1.2 }],
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'VI', period: 'M5' }),
      settingsHashKey: 'VI',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.ao?.histogram).toBe(0.25)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vi?.plus).toBe(1.2)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vi?.minus).toBe(0.8)
    expect(merged.settingsHashes?.AO).toBe('ao-hash')
    expect(merged.settingsHashes?.VI).toBeTruthy()
  })

  it('merges RSI rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 11, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        viRows: [{ minus: 0.8, plus: 1.2 }],
      }),
      settingsHash: 'vi-hash',
      settingsHashKey: 'VI',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        rsiRows: [{ rsi: 65, rsiMa: 60 }],
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'RSI', period: 'M5' }),
      settingsHashKey: 'RSI',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vi?.plus).toBe(1.2)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.rsi?.rsi).toBe(65)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.rsi?.rsiMa).toBe(60)
    expect(merged.settingsHashes?.VI).toBe('vi-hash')
    expect(merged.settingsHashes?.RSI).toBeTruthy()
  })

  it('merges MACD rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 12, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        rsiRows: [{ rsi: 65, rsiMa: 60 }],
        symbol: 'XAUUSDm',
      }),
      settingsHash: 'rsi-hash',
      settingsHashKey: 'RSI',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        macdRows: [{ histogram: 0.1, macd: 0.3, signal: 0.2 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'MACD', period: 'M5' }),
      settingsHashKey: 'MACD',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.rsi?.rsi).toBe(65)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.macd?.macd).toBe(0.3)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.macd?.histogram).toBe(0.1)
    expect(merged.settingsHashes?.RSI).toBe('rsi-hash')
    expect(merged.settingsHashes?.MACD).toBeTruthy()
  })

  it('merges DPO rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 13, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        macdRows: [{ histogram: 0.1, macd: 0.3, signal: 0.2 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: 'macd-hash',
      settingsHashKey: 'MACD',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        dpoRows: [{ dpo: 1.5 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'DPO', period: 'M5' }),
      settingsHashKey: 'DPO',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.macd?.macd).toBe(0.3)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.dpo?.dpo).toBe(1.5)
    expect(merged.settingsHashes?.MACD).toBe('macd-hash')
    expect(merged.settingsHashes?.DPO).toBeTruthy()
  })

  it('merges SQZMOM rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 14, period: 'M5', realtime: false, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        dpoRows: [{ dpo: 1.5 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: 'dpo-hash',
      settingsHashKey: 'DPO',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        sqzmomRows: [{ momentum: 2.5, squeezeState: 'on' }],
        symbol: 'XAUUSDm',
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'SQZMOM', period: 'M5' }),
      settingsHashKey: 'SQZMOM',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.dpo?.dpo).toBe(1.5)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.sqzmom?.momentum).toBe(2.5)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.sqzmom?.squeezeState).toBe('on')
    expect(merged.settingsHashes?.DPO).toBe('dpo-hash')
    expect(merged.settingsHashes?.SQZMOM).toBeTruthy()
  })

  it('merges VOL rows without dropping existing snapshot rows', () => {
    const pageKey = createIndicatorPageKey({ pageIndex: 15, period: 'M5', realtime: true, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        maRows: [{ ma: 10, maColorIndex: 1 }],
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
      }),
      settingsHash: 'ma-hash',
      settingsHashKey: 'MA',
      symbol: 'XAUUSDm',
    })

    const merged = writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        volRows: [{ volume: 123, volumeColorIndex: 1, volumeMa: 100 }],
      }),
      settingsHash: createIndicatorSettingsHash({ indicator: 'VOL', period: 'M5' }),
      settingsHashKey: 'VOL',
      symbol: 'XAUUSDm',
    })

    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.ma?.ma).toBe(10)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vol?.volume).toBe(123)
    expect(merged.byBarKey['XAUUSDm|M5|1700000000']?.vol?.volumeColorIndex).toBe(1)
    expect(merged.settingsHashes?.MA).toBe('ma-hash')
    expect(merged.settingsHashes?.VOL).toBeTruthy()
  })
})
