import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storageKeys } from '../persistence/storageKeys'
import { writeKLineChartRenderPageConfigV2 } from '../chart/klineChartRendererV2/klineChartRenderPageConfigV2'
import {
  pushRefreshAfterAutoPageV2,
  resolveRefreshAfterAutoPushTargetV2,
} from './refreshAfterAutoPusherV2'
import type { RealtimePageRow } from './pagePartitionManagerHelpers'

function createLocalStorage() {
  const values = new Map<string, string>()
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

function page(index: number): RealtimePageRow {
  return {
    fromGlobalIndex: null,
    index,
    limit: 2500,
    pageType: 'history',
    realtime: false,
    rows: null,
    timeFrom: 1000 - index * 100,
    timeTo: 1099 - index * 100,
    toGlobalIndex: null,
  }
}

describe('refreshAfterAutoPusherV2', () => {
  beforeEach(() => {
    const localStorage = createLocalStorage()
    vi.stubGlobal('window', {
      localStorage,
      location: { origin: 'http://127.0.0.1:5185' },
    })
    vi.stubGlobal('fetch', undefined)
    vi.stubGlobal('XMLHttpRequest', undefined)
    localStorage.removeItem(storageKeys.renderPageConfig)
  })

  it('selects the cached page from the last rendered page index', () => {
    writeKLineChartRenderPageConfigV2({
      pageIndex: 2,
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    const target = resolveRefreshAfterAutoPushTargetV2({
      pages: [page(1), page(2), page(3)],
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    expect(target?.page.index).toBe(2)
    expect(target?.source).toBe('render-page-config')
  })

  it('pushes the resolved cached page through the same action as clicking a page row', () => {
    writeKLineChartRenderPageConfigV2({
      pageIndex: 3,
      period: 'M5',
      symbol: 'XAUUSDm',
    })
    const pages = [page(1), page(2), page(3)]
    const pushPage = vi.fn()

    const target = pushRefreshAfterAutoPageV2({
      pages,
      period: 'M5',
      pushPage,
      symbol: 'XAUUSDm',
    })

    expect(target?.page.index).toBe(3)
    expect(pushPage).toHaveBeenCalledWith(pages[2], pages, 'refresh-after-auto-pusher:render-page-config')
  })

  it('can be reused after rebuilding the page cache instead of defaulting to the first page', () => {
    writeKLineChartRenderPageConfigV2({
      pageIndex: 2,
      period: 'M5',
      symbol: 'XAUUSDm',
    })
    const rebuiltPages = [page(1), page(2), page(3)]
    const pushPage = vi.fn()

    const target = pushRefreshAfterAutoPageV2({
      pages: rebuiltPages,
      period: 'M5',
      pushPage,
      symbol: 'XAUUSDm',
    })

    expect(target?.page.index).toBe(2)
    expect(target?.source).toBe('render-page-config')
    expect(pushPage).toHaveBeenCalledWith(rebuiltPages[1], rebuiltPages, 'refresh-after-auto-pusher:render-page-config')
  })


  it('falls back to the first cached page when there is no matching rendered page', () => {
    writeKLineChartRenderPageConfigV2({
      pageIndex: 9,
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    const target = resolveRefreshAfterAutoPushTargetV2({
      pages: [page(1), page(2)],
      period: 'M5',
      symbol: 'XAUUSDm',
    })

    expect(target?.page.index).toBe(1)
    expect(target?.restoredPageIndex).toBe(9)
    expect(target?.source).toBe('default-cache-page')
  })
})
