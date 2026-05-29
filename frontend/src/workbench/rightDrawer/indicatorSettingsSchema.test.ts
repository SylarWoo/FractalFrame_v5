import { describe, expect, it } from 'vitest'
import { defaultMrIndicatorSettings, normalizeMmfSettings, normalizeMrSettings } from './indicatorSettingsSchema'

describe('indicatorSettingsSchema', () => {
  it('normalizes MR style settings', () => {
    expect(normalizeMrSettings({
      backgroundOpacity: 2,
      lowerLineOpacity: -1,
      lowerLineStyle: 'bad' as never,
      lowerLineWidth: 99,
      upperLineOpacity: 0.4,
      upperLineStyle: 'dashed',
      upperLineWidth: 2,
    })).toMatchObject({
      backgroundOpacity: 1,
      lowerLineOpacity: 0,
      lowerLineStyle: defaultMrIndicatorSettings.lowerLineStyle,
      lowerLineWidth: 4,
      upperLineOpacity: 0.4,
      upperLineStyle: 'dashed',
      upperLineWidth: 2,
    })
  })

  it('migrates legacy MMF v2 sell and buy settings to confirm point settings', () => {
    const settings = normalizeMmfSettings({
      buyColor: '#111111',
      buySize: 18,
      buySymbol: '\u2190',
      sellColor: '#222222',
      sellSize: 20,
      sellSymbol: '\u2192',
      showBuy: false,
      showSell: false,
    } as never)

    expect(settings.highConfirmPointColor).toBe('#222222')
    expect(settings.highConfirmPointSize).toBe(20)
    expect(settings.highConfirmPointSymbol).toBe('\u2192')
    expect(settings.showHighConfirmPoint).toBe(false)
    expect(settings.lowConfirmPointColor).toBe('#111111')
    expect(settings.lowConfirmPointSize).toBe(18)
    expect(settings.lowConfirmPointSymbol).toBe('\u2190')
    expect(settings.showLowConfirmPoint).toBe(false)
  })
})
