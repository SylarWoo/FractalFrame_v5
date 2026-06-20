import { describe, expect, it, vi } from 'vitest'
import { drawingObjectPersistenceChangedEvent } from '../rightDrawer/drawingObjectPersistence'
import { installChartDrawingLifecycle } from './chartDrawingLifecycle'

vi.mock('klinecharts', () => ({
  ActionType: { OnDataReady: 'onDataReady' },
}))

describe('installChartDrawingLifecycle', () => {
  it('subscribes and cleans up shared drawing persistence events', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener,
    })
    const chart = {
      subscribeAction: vi.fn(),
      unsubscribeAction: vi.fn(),
    }
    const handleSharedDrawingPersistenceChanged = vi.fn()

    const cleanup = installChartDrawingLifecycle({
      chart: chart as never,
      handleCommand: vi.fn(),
      handleDataReady: vi.fn(),
      handleObjectTreeCommand: vi.fn(),
      handleObjectTreeDrawingsRequest: vi.fn(),
      handleSharedDrawingPersistenceChanged,
      handleStorage: vi.fn(),
      handleVisibilityRangeChanged: vi.fn(),
      handleVisibilityRefresh: vi.fn(),
    })

    expect(addEventListener).toHaveBeenCalledWith(drawingObjectPersistenceChangedEvent, handleSharedDrawingPersistenceChanged)
    expect(chart.subscribeAction).toHaveBeenCalledWith('onDataReady', expect.any(Function))

    cleanup()

    expect(removeEventListener).toHaveBeenCalledWith(drawingObjectPersistenceChangedEvent, handleSharedDrawingPersistenceChanged)
    expect(chart.unsubscribeAction).toHaveBeenCalledWith('onDataReady', expect.any(Function))
    vi.unstubAllGlobals()
  })
})
