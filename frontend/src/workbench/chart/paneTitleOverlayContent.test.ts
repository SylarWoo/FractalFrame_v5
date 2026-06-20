import { describe, expect, it } from 'vitest'
import { createPaneTitleLines, readCrosshairDataIndex } from './paneTitleOverlayContent'

function flattenTitleText(lines: ReturnType<typeof createPaneTitleLines>) {
  return lines.flatMap((line) => line.flatMap((part) => part.chunks.map((chunk) => chunk.text)))
}

function chartWithMmad(options: {
  lineVisible?: boolean
  statusLineValuesVisible?: boolean
  timeframe?: string
  value?: number
}) {
  return {
    getDataList: () => [{
      close: 4000,
      high: 4002,
      low: 3998,
      open: 3999,
      timestamp: Date.UTC(2026, 5, 12, 6, 0),
      volume: 10,
    }],
    getIndicatorByPaneId: (_paneId: string, name: string) => name === 'MMAD'
      ? {
        calcParams: [{
          lineColor: '#123456',
          lineOpacity: 1,
          lineVisible: options.lineVisible ?? true,
          precision: 2,
          statusLineValuesVisible: options.statusLineValuesVisible ?? true,
          timeframe: options.timeframe ?? '5m',
        }],
        result: [{ value: options.value ?? 4212.3456 }],
      }
      : null,
    getVisibleRange: () => ({ realTo: 0 }),
  }
}

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

describe('createPaneTitleLines', () => {
  it('shows MMAD title and value on the main pane status line', () => {
    const lines = createPaneTitleLines(
      chartWithMmad({ timeframe: '30m', value: 4212.3456 }) as never,
      { paneId: 'candle_pane', name: 'candle' } as never,
      { period: 'M5', symbol: 'XAUUSDm' },
      null,
    )
    const text = flattenTitleText(lines)

    expect(text).toContain('MMAD 30m')
    expect(text).toContain('4212.35')
  })

  it('keeps the MMAD title but hides the value when the MMAD line is hidden', () => {
    const lines = createPaneTitleLines(
      chartWithMmad({ lineVisible: false, timeframe: '5m', value: 4212.3456 }) as never,
      { paneId: 'candle_pane', name: 'candle' } as never,
      { period: 'M5', symbol: 'XAUUSDm' },
      null,
    )
    const text = flattenTitleText(lines)

    expect(text).toContain('MMAD 5m')
    expect(text).not.toContain('4212.35')
  })
})
