import { describe, expect, it } from 'vitest'
import type { KLineData } from 'klinecharts'
import type { ChartIndicatorCommand } from './chartRuntimeTypes'
import {
  applyRealtimeIndicatorCommandToState,
  createInitialRealtimeIndicatorRuntimeState,
  createRealtimeIndicatorPageKey,
} from './realtimeIndicatorRuntime'

function row(timestamp: number, close = 10): KLineData {
  return { close, high: close + 1, low: close - 1, open: close, timestamp, volume: 1 }
}

function loadCommand(id: number, settings: Record<string, unknown>): ChartIndicatorCommand {
  return {
    action: 'load',
    id,
    name: 'MA',
    settings,
  } as ChartIndicatorCommand
}

describe('realtimeIndicatorRuntime', () => {
  it('builds realtime page keys from bar identity range', () => {
    const pageKey = createRealtimeIndicatorPageKey({
      bars: [
        row(1_700_000_000_000),
        row(1_700_000_300_000),
      ],
      period: '5M',
      symbol: 'XAUUSDm',
    })

    expect(pageKey).toBe('XAUUSDm|M5|realtime|XAUUSDm|M5|1700000000|XAUUSDm|M5|1700000300|2')
  })

  it('records load, settings change, and unload events', () => {
    const bars = [
      row(1_700_000_000_000),
      row(1_700_000_300_000),
    ]
    const initial = createInitialRealtimeIndicatorRuntimeState({
      bars,
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    const loaded = applyRealtimeIndicatorCommandToState(initial, loadCommand(1, { period: 20 }), bars)
    expect(loaded.loaded.MA?.commandId).toBe(1)
    expect(loaded.tail.at(-1)).toMatchObject({
      barKeyFrom: 'XAUUSDm|M5|1700000000',
      barKeyTo: 'XAUUSDm|M5|1700000300',
      bars: 2,
      indicator: 'MA',
      type: 'indicator_loaded',
    })

    const changed = applyRealtimeIndicatorCommandToState(loaded, loadCommand(2, { period: 50 }), bars)
    expect(changed.loaded.MA?.commandId).toBe(2)
    expect(changed.tail.at(-1)?.type).toBe('indicator_settings_changed')

    const unloaded = applyRealtimeIndicatorCommandToState(changed, {
      action: 'unload',
      id: 3,
      name: 'MA',
    } as ChartIndicatorCommand, bars)
    expect(unloaded.loaded.MA).toBeUndefined()
    expect(unloaded.tail.at(-1)).toMatchObject({
      commandId: 3,
      indicator: 'MA',
      settingsHash: null,
      type: 'indicator_unloaded',
    })
  })
})
