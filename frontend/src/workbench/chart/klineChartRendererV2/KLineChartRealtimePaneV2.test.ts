import { describe, expect, it } from 'vitest'
import { resolveRealtimeFutureAxisGeometry } from './KLineChartRealtimePaneV2'

describe('resolveRealtimeFutureAxisGeometry', () => {
  it('does not create a future pseudo coordinate geometry', () => {
    expect(resolveRealtimeFutureAxisGeometry()).toBeNull()
  })
})
