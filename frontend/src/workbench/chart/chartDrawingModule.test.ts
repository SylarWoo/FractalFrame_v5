import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Chart } from 'klinecharts'

const cleanupDrawingTools = vi.fn()
const installChartDrawingTools = vi.fn(() => cleanupDrawingTools)

vi.mock('./chartDrawingTools', () => ({
  chartDrawingVisibilityRefreshEvent: 'fractalframe:chartDrawingVisibilityRefresh',
  installChartDrawingTools,
}))

describe('installChartDrawingModule', () => {
  afterEach(() => {
    cleanupDrawingTools.mockClear()
    installChartDrawingTools.mockClear()
    vi.restoreAllMocks()
  })

  it('installs drawing tools with a period context and cleans them up', async () => {
    const dispatchEvent = vi.fn()
    vi.stubGlobal('window', {
      dispatchEvent,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })
    const { installChartDrawingModule } = await import('./chartDrawingModule')
    const module = installChartDrawingModule({
      chart: {} as Chart,
      initialContext: { period: 'M5', symbol: 'XAUUSDm', viewportScope: 'scope-a' },
    })

    const getPeriod = (installChartDrawingTools.mock.calls[0] as unknown[] | undefined)?.[1] as (() => string) | undefined
    expect(getPeriod?.()).toBe('M5')

    module.updateContext({ period: 'M30', symbol: 'XAUUSDm', viewportScope: 'scope-a' })
    expect(getPeriod?.()).toBe('M30')
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'fractalframe:chartDrawingVisibilityRefresh' }))

    module.destroy()
    expect(cleanupDrawingTools).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
