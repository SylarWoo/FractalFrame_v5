import { afterEach, describe, expect, it, vi } from 'vitest'
import { installYAxisDragOptimization } from './chartAxisInteraction'

describe('chartAxisInteraction legacy guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not install legacy y-axis drag handlers inside KLineChart v2 hosts', () => {
    const root = {
      addEventListener: vi.fn(),
      closest: vi.fn(() => ({})),
      removeEventListener: vi.fn(),
    }
    const chart = {
      getDom: vi.fn(() => root),
    }

    const cleanup = installYAxisDragOptimization(chart as never)
    cleanup()

    expect(root.addEventListener).not.toHaveBeenCalled()
    expect(root.removeEventListener).not.toHaveBeenCalled()
  })

  it('keeps installing legacy y-axis drag handlers outside KLineChart v2 hosts', () => {
    vi.stubGlobal('window', {
      removeEventListener: vi.fn(),
    })
    const root = {
      addEventListener: vi.fn(),
      closest: vi.fn(() => null),
      ownerDocument: {
        documentElement: {
          removeEventListener: vi.fn(),
        },
      },
      removeEventListener: vi.fn(),
    }
    const chart = {
      getDom: vi.fn(() => root),
    }

    const cleanup = installYAxisDragOptimization(chart as never)
    cleanup()

    expect(root.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function), true)
  })
})
