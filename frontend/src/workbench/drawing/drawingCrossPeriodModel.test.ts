import { describe, expect, it } from 'vitest'
import { isDrawingVisibleForPeriod, isCrossPeriodDrawingPeriod, normalizeDrawingCrossPeriodTargets, normalizeDrawingPeriod } from './drawingCrossPeriodModel'

describe('drawingCrossPeriodModel', () => {
  it('normalizes drawing periods', () => {
    expect(normalizeDrawingPeriod(' m5 ')).toBe('M5')
    expect(normalizeDrawingPeriod(null)).toBe('')
  })

  it('limits cross period drawings to the main workbench periods', () => {
    expect(isCrossPeriodDrawingPeriod('M5')).toBe(true)
    expect(isCrossPeriodDrawingPeriod('M30')).toBe(true)
    expect(isCrossPeriodDrawingPeriod('H2')).toBe(true)
    expect(isCrossPeriodDrawingPeriod('H4')).toBe(false)
  })

  it('normalizes selected cross period targets', () => {
    expect(normalizeDrawingCrossPeriodTargets(['m5', 'M30', 'M5', 'H4'])).toEqual(['M5', 'M30'])
    expect(normalizeDrawingCrossPeriodTargets(undefined)).toEqual(['M5', 'M30', 'H2'])
  })

  it('keeps normal drawings on their source period', () => {
    expect(isDrawingVisibleForPeriod({ currentPeriod: 'M5', sourcePeriod: 'M5' })).toBe(true)
    expect(isDrawingVisibleForPeriod({ currentPeriod: 'M30', sourcePeriod: 'M5' })).toBe(false)
  })

  it('shows cross period drawings across M5 M30 H2 only', () => {
    expect(isDrawingVisibleForPeriod({ crossPeriod: true, currentPeriod: 'M30', sourcePeriod: 'M5' })).toBe(true)
    expect(isDrawingVisibleForPeriod({ crossPeriod: true, currentPeriod: 'H2', sourcePeriod: 'M5' })).toBe(true)
    expect(isDrawingVisibleForPeriod({ crossPeriod: true, currentPeriod: 'H4', sourcePeriod: 'M5' })).toBe(false)
  })

  it('uses selected cross period targets when provided', () => {
    expect(isDrawingVisibleForPeriod({ crossPeriod: true, crossPeriodTargets: ['M30'], currentPeriod: 'M30', sourcePeriod: 'M5' })).toBe(true)
    expect(isDrawingVisibleForPeriod({ crossPeriod: true, crossPeriodTargets: ['M30'], currentPeriod: 'H2', sourcePeriod: 'M5' })).toBe(false)
    expect(isDrawingVisibleForPeriod({ crossPeriod: true, crossPeriodTargets: [], currentPeriod: 'M5', sourcePeriod: 'M5' })).toBe(false)
  })

  it('treats selected cross period targets as a shared allow-list for every port', () => {
    const options = {
      crossPeriod: true,
      crossPeriodTargets: ['M5', 'H2'],
      sourcePeriod: 'M30',
    }

    expect(isDrawingVisibleForPeriod({ ...options, currentPeriod: 'M5' })).toBe(true)
    expect(isDrawingVisibleForPeriod({ ...options, currentPeriod: 'M30' })).toBe(false)
    expect(isDrawingVisibleForPeriod({ ...options, currentPeriod: 'H2' })).toBe(true)
  })

  it('keeps legacy drawings visible when no source period exists', () => {
    expect(isDrawingVisibleForPeriod({ currentPeriod: 'H4' })).toBe(true)
  })
})
