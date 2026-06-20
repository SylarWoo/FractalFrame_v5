import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearStoredHorizontalLineDrawings,
  clearStoredTrendLineDrawings,
  drawingObjectPersistenceChangedEvent,
  horizontalLineDrawingsStorageKey,
  trendLineDrawingsStorageKey,
  writeStoredHorizontalLineDrawings,
  writeStoredTrendLineDrawings,
} from './drawingObjectPersistence'
import { createDefaultDrawingLineStyle, createDefaultDrawingTextStyle, createDefaultDrawingTrendLineStyle } from './drawingPersistence'

describe('drawingObjectPersistence', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('broadcasts local changes for shared horizontal line drawings', () => {
    const dispatchEvent = vi.fn()
    vi.stubGlobal('window', {
      dispatchEvent,
      localStorage: {
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    })

    writeStoredHorizontalLineDrawings([{
      crossPeriod: true,
      crossPeriodTargets: ['M5', 'H2'],
      lineStyle: createDefaultDrawingLineStyle('#0f766e'),
      locked: false,
      manualVisible: true,
      objectId: 'h-1',
      paneId: 'candle_pane',
      showPriceLabel: true,
      sourcePeriod: 'M5',
      textStyle: createDefaultDrawingTextStyle(),
      value: 4210,
    }])
    clearStoredHorizontalLineDrawings()

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      detail: { key: horizontalLineDrawingsStorageKey },
      type: drawingObjectPersistenceChangedEvent,
    }))
    expect(dispatchEvent).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it('broadcasts local changes for shared trend line drawings', () => {
    const dispatchEvent = vi.fn()
    vi.stubGlobal('window', {
      dispatchEvent,
      localStorage: {
        removeItem: vi.fn(),
        setItem: vi.fn(),
      },
    })

    writeStoredTrendLineDrawings([{
      crossPeriod: true,
      crossPeriodTargets: ['M30'],
      lineStyle: createDefaultDrawingLineStyle('#2962ff'),
      locked: false,
      manualVisible: true,
      objectId: 't-1',
      paneId: 'candle_pane',
      points: [
        { timestamp: 1000, value: 4200 },
        { timestamp: 1300, value: 4210 },
      ],
      showPriceLabel: true,
      sourcePeriod: 'M5',
      textStyle: createDefaultDrawingTextStyle(),
      trendLineStyle: createDefaultDrawingTrendLineStyle(),
    }])
    clearStoredTrendLineDrawings()

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      detail: { key: trendLineDrawingsStorageKey },
      type: drawingObjectPersistenceChangedEvent,
    }))
    expect(dispatchEvent).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })
})
