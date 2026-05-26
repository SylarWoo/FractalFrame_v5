import { describe, expect, it } from 'vitest'
import { indicatorRestoreOrder } from '../indicators/indicatorControllerModel'
import { indicatorRows, isSupportedChartIndicator, resolveInitialSelectedKey } from './indicatorDefinitions'

describe('indicatorDefinitions', () => {
  it('keeps drawer indicator rows aligned with the controller registry', () => {
    expect(indicatorRows.map((row) => row.key)).toEqual(indicatorRestoreOrder)
  })

  it('guards supported indicator keys from the row definitions', () => {
    expect(isSupportedChartIndicator('MR')).toBe(true)
    expect(isSupportedChartIndicator('Unknown')).toBe(false)
    expect(resolveInitialSelectedKey('Stoch')).toBe('Stoch')
    expect(resolveInitialSelectedKey('Unknown')).toBe('RSI')
  })
})
