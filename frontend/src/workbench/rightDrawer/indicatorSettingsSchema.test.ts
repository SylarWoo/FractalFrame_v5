import { describe, expect, it } from 'vitest'
import { defaultMrIndicatorSettings, normalizeMmfSettings, normalizeMrSettings, normalizeVdoSettings } from './indicatorSettingsSchema'

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

  it('normalizes MMF v2 VDO momentum strategy settings', () => {
    const settings = normalizeMmfSettings({
      vdoMomentumDownAverage: -8,
      vdoMomentumDownLookback: 1000000,
      vdoMomentumExceedPercent: 1200,
      vdoMomentumUpAverage: 34.5,
      vdoMomentumUpLookback: -9,
    })

    expect(settings.vdoMomentumDownAverage).toBe(0)
    expect(settings.vdoMomentumDownLookback).toBe(100000)
    expect(settings.vdoMomentumExceedPercent).toBe(1000)
    expect(settings.vdoMomentumUpAverage).toBe(34.5)
    expect(settings.vdoMomentumUpLookback).toBe(0)
  })

  it('normalizes VDO third band and second background settings', () => {
    const settings = normalizeVdoSettings({
      backgroundLower2Opacity: -1,
      backgroundUpper2Opacity: 2,
      downLine3Opacity: -4,
      downLine3Style: 'bad' as never,
      downLine3Value: -0.2,
      downLine3Width: 99,
      upLine3Opacity: 0.4,
      upLine3Style: 'dotted',
      upLine3Value: 0.2,
      upLine3Width: 2,
      vdoMaLength: 999,
      vdoMa2Length: -8,
      vdoMa2LineStyle: 'dotted',
      vdoMa2LineWidth: 99,
      vdoMa2Opacity: -1,
      vdoMaLineStyle: 'dashed',
      vdoMaLineWidth: 0,
      vdoMaOpacity: 2,
    })

    expect(settings.backgroundLower2Opacity).toBe(0)
    expect(settings.backgroundUpper2Opacity).toBe(1)
    expect(settings.downLine3Opacity).toBe(0)
    expect(settings.downLine3Style).toBe('dashed')
    expect(settings.downLine3Value).toBe(-0.2)
    expect(settings.downLine3Width).toBe(4)
    expect(settings.upLine3Opacity).toBe(0.4)
    expect(settings.upLine3Style).toBe('dotted')
    expect(settings.upLine3Value).toBe(0.2)
    expect(settings.upLine3Width).toBe(2)
    expect(settings.vdoMaLength).toBe(500)
    expect(settings.vdoMa2Length).toBe(1)
    expect(settings.vdoMa2LineStyle).toBe('dotted')
    expect(settings.vdoMa2LineWidth).toBe(4)
    expect(settings.vdoMa2Opacity).toBe(0)
    expect(settings.vdoMaLineStyle).toBe('dashed')
    expect(settings.vdoMaLineWidth).toBe(1)
    expect(settings.vdoMaOpacity).toBe(1)
  })
})
