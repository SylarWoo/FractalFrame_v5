import { describe, expect, it } from 'vitest'
import { defaultMrIndicatorSettings, normalizeMrSettings } from './indicatorSettingsSchema'

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
})
