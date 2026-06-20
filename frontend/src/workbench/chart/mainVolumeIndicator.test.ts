import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import { defaultVolIndicatorSettings } from '../rightDrawer/indicatorPersistence'
import { calculateMainVolumeRowsForKLineChart } from './mainVolumeIndicator'
import {
  createIndicatorPageKey,
  createIndicatorSettingsHash,
  createIndicatorSnapshotRows,
  writeIndicatorPageSnapshot,
} from './indicatorPageSnapshotStore'

describe('mainVolumeIndicator', () => {
  const rows = [
    { timestamp: 1_700_000_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 },
    { timestamp: 1_700_000_300_000, open: 2, high: 3, low: 1.5, close: 1.8, volume: 2 },
  ] as KLineData[]

  it('uses V2 VOL snapshot rows when runtime context is present', () => {
    const settingsHash = createIndicatorSettingsHash({ indicator: 'VOL', period: 'M5' })
    const pageKey = createIndicatorPageKey({ pageIndex: 1, period: 'M5', realtime: true, rows, symbol: 'XAUUSDm' })
    writeIndicatorPageSnapshot({
      pageKey,
      period: 'M5',
      rows: createIndicatorSnapshotRows({
        period: 'M5',
        rows,
        symbol: 'XAUUSDm',
        volRows: [
          { volume: 101, volumeColorIndex: 0, volumeMa: 100 },
          { volume: 202, volumeColorIndex: 1, volumeMa: 150 },
        ],
      }),
      settingsHash,
      settingsHashKey: 'VOL',
      symbol: 'XAUUSDm',
    })

    const result = calculateMainVolumeRowsForKLineChart(rows, {
      ...defaultVolIndicatorSettings,
      pageKey,
      period: 'M5',
      runtimeOnly: true,
      settingsHash,
      symbol: 'XAUUSDm',
    })

    expect(result[0]).toMatchObject({ volume: 101, volumeColorIndex: 0, volumeMa: 100 })
    expect(result[1]).toMatchObject({ volume: 202, volumeColorIndex: 1, volumeMa: 150 })
  })

  it('does not fall back to chart data volume when runtime snapshot is missing', () => {
    const result = calculateMainVolumeRowsForKLineChart(rows, {
      ...defaultVolIndicatorSettings,
      pageKey: 'missing-page',
      period: 'M5',
      runtimeOnly: true,
      settingsHash: 'missing-hash',
      symbol: 'XAUUSDm',
    })

    expect(result).toEqual([{}, {}])
  })
})
