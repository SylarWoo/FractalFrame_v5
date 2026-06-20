import { describe, expect, it } from 'vitest'
import { clampRightDrawerSplitHeight } from './useRightDrawerVerticalSplit'

describe('clampRightDrawerSplitHeight', () => {
  it('rounds and clamps split height inside the drawer bounds', () => {
    expect(clampRightDrawerSplitHeight(180.6, 96, 420)).toBe(181)
    expect(clampRightDrawerSplitHeight(40, 96, 420)).toBe(96)
    expect(clampRightDrawerSplitHeight(800, 96, 420)).toBe(420)
  })
})
