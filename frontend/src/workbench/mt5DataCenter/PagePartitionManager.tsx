import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ChartPageNavigation, ChartPageNavigationTarget, ChartPageTarget } from '../chart/chartRuntimeTypes'
import { requestStoreV6HistoryPage } from '../chart/historyPageRequestV2'
import { buildStoreV6HistoryPageWindow, type StoreV6HistoryPageWindow } from '../chart/historyPageWindowV2'
import {
  buildStoreV6PagePartition,
  type StoreV6PagePartition,
} from '../chart/pagePartition/pagePartitionBuilder'
import { writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { periodFromStoreTableKey } from './storeV6StatusFormat'
import type { StoreTableRow } from './storeV6StatusFormat'
import { fetchStoreV6DailyMaintenanceEvents } from '../../services/mt5/mt5SymbolsApi'
import type { StoreV6CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import {
  defaultPageTableHeight,
  deletePageIndexCache,
  formatMaintenanceSummary,
  formatPageTradingDateTime,
  formatPageRange,
  formatPageRows,
  formatResetInfoSummary,
  historicalPageSize,
  isCurrentCache,
  latestUpdateSummary,
  materializeTimePageIndexRanges,
  maxPageTableHeight,
  minPageTableHeight,
  pageCacheKey,
  parseRowsCount,
  readLastResetCache,
  readPageIndexCache,
  readPageTableHeight,
  realtimePageSize,
  resolveLastTimeFromStoreStatus,
  resolvePartitionCacheKind,
  resolveRowsFromStoreStatus,
  writeLastResetCache,
  writePageIndexCache,
  type PersistedPageResetInfo,
  type RealtimePageRow,
  type UpdateSummary,
} from './pagePartitionManagerHelpers'

type PagePartitionManagerProps = {
  onOpenChart?: (options: { historyPageWindow?: StoreV6HistoryPageWindow | null; pageNavigation?: ChartPageNavigation | null; realtimeEnabled?: boolean; symbol: string; period: string; totalRows?: number | null; limit?: number; reloadId?: number; page?: ChartPageTarget | null }) => void
  onPreparePagePartition?: (period?: string) => Promise<StoreV6CheckPayload | null>
  onToggleRealtime: () => void
  selectedStoreTableKey: string
  selectedSymbol: string
  storeRows: StoreTableRow[]
  watchlistRealtimeEnabled: boolean
  watchlistRealtimeReady: boolean
}

export function PagePartitionManager({
  onOpenChart,
  onPreparePagePartition,
  onToggleRealtime,
  selectedStoreTableKey,
  selectedSymbol,
  storeRows,
  watchlistRealtimeEnabled,
  watchlistRealtimeReady,
}: PagePartitionManagerProps) {
  const reloadIdRef = useRef(0)
  const [selectedPage, setSelectedPage] = useState(1)
  const [pages, setPages] = useState<RealtimePageRow[]>([])
  const [building, setBuilding] = useState(false)
  const [partitionStatus, setPartitionStatus] = useState('')
  const [maintenanceSummary, setMaintenanceSummary] = useState<UpdateSummary | null>(null)
  const [lastResetInfo, setLastResetInfo] = useState<PersistedPageResetInfo | null>(null)
  const [pageTableHeight, setPageTableHeight] = useState(readPageTableHeight)
  const selectedPeriod = periodFromStoreTableKey(selectedStoreTableKey)
  const selectedStoreRow = storeRows.find((row) => `${row.kind}-${row.period}` === selectedStoreTableKey)
    ?? storeRows.find((row) => row.period.toUpperCase() === selectedPeriod)
  const totalRows = parseRowsCount(selectedStoreRow?.rowsCount ?? selectedStoreRow?.count)
  const [pageTotalRows, setPageTotalRows] = useState<number | null>(totalRows)
  const partitionForCacheKey = buildStoreV6PagePartition({
    historyPageSize: historicalPageSize,
    livePageSize: realtimePageSize,
    period: selectedPeriod,
    symbol: selectedSymbol,
    totalRows,
  })
  const cacheKind = resolvePartitionCacheKind(partitionForCacheKey)
  const cacheKey = selectedSymbol && selectedPeriod
    ? pageCacheKey(selectedSymbol, selectedPeriod, cacheKind)
    : ''

  useEffect(() => {
    setPageTotalRows(totalRows)
  }, [cacheKey, totalRows])

  const buildCurrentPartition = (latestTime?: number | null, totalRowsOverride = pageTotalRows) => buildStoreV6PagePartition({
    historyPageSize: historicalPageSize,
    latestTime,
    livePageSize: realtimePageSize,
    period: selectedPeriod,
    symbol: selectedSymbol,
    totalRows: totalRowsOverride,
  })

  const toPageNavigationTarget = (page: RealtimePageRow | null | undefined): ChartPageNavigationTarget | null => page
    ? {
      index: page.index,
      labelFrom: typeof page.timeFrom === 'number' ? formatPageTradingDateTime(page.timeFrom, '开盘') : null,
      labelTo: typeof page.timeTo === 'number' ? formatPageTradingDateTime(page.timeTo, '停盘') : null,
      timeFrom: page.timeFrom ?? null,
      timeTo: page.timeTo ?? null,
    }
    : null

  const resolveRealtimeStartFromPage = (page: RealtimePageRow) => {
    if (typeof page.timeTo !== 'number' || !Number.isFinite(page.timeTo)) return null
    const date = new Date(page.timeTo * 1000)
    const parts = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).formatToParts(date)
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
    const year = Number(get('year'))
    const month = Number(get('month'))
    const day = Number(get('day'))
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
    return Math.floor(Date.UTC(year, month - 1, day - 1, 22, 0, 0) / 1000)
  }

  const buildPageNavigation = (
    page: RealtimePageRow,
    sourcePages: RealtimePageRow[],
    historyPageWindow: StoreV6HistoryPageWindow,
  ): ChartPageNavigation => {
    const actualTimeFrom = historyPageWindow.boundary.actualTimeFrom ?? page.timeFrom ?? null
    const actualTimeTo = historyPageWindow.boundary.actualTimeTo ?? page.timeTo ?? null
    const realtimeStart = resolveRealtimeStartFromPage(page)
    const older = toPageNavigationTarget(sourcePages.find((item) => item.index === page.index + 1))
    const newer = page.index > 1
      ? toPageNavigationTarget(sourcePages.find((item) => item.index === page.index - 1))
      : null
    return {
      current: {
        index: page.index,
        labelFrom: typeof page.timeFrom === 'number' ? formatPageTradingDateTime(page.timeFrom, '开盘') : null,
        labelTo: typeof page.timeTo === 'number' ? formatPageTradingDateTime(page.timeTo, '停盘') : null,
        timeFrom: actualTimeFrom,
        timeTo: actualTimeTo,
      },
      newer,
      onSelectPage: (pageIndex: number) => {
        const nextPage = sourcePages.find((item) => item.index === pageIndex)
        if (nextPage) openPage(nextPage, sourcePages)
      },
      older,
      realtimeStart,
      realtimeStartLabel: typeof realtimeStart === 'number' ? formatPageTradingDateTime(realtimeStart, '开盘') : null,
    }
  }

  const persistPages = (
    nextPages: RealtimePageRow[],
    totalRowsOverride = pageTotalRows,
    partition: StoreV6PagePartition = buildCurrentPartition(null, totalRowsOverride),
  ) => {
    if (!cacheKey || !selectedSymbol || !selectedPeriod) return
    writePageIndexCache(cacheKey, {
      builtAt: new Date().toISOString(),
      livePageSize: realtimePageSize,
      pageSize: historicalPageSize,
      pages: nextPages,
      partitionKind: resolvePartitionCacheKind(partition),
      partitionMode: partition.partitionMode,
      period: selectedPeriod,
      profileVersion: partition.profileVersion,
      symbol: selectedSymbol,
      totalRows: totalRowsOverride,
    })
  }

  const openPage = (page: RealtimePageRow, sourcePages = pages) => {
    const period = selectedPeriod
    if (!period) return
    const currentPartition = buildCurrentPartition()
    if (resolvePartitionCacheKind(currentPartition) !== 'time') {
      setPartitionStatus('旧 rows 分页/加载链路已移除；该周期需要接入新的时间分页器后才能打开页面。')
      return
    }
    setSelectedPage(page.index)
    const reloadId = reloadIdRef.current + 1
    reloadIdRef.current = reloadId
    setPartitionStatus(`正在请求第 ${page.index} 页历史窗口...`)
    void requestStoreV6HistoryPage({
      pageIndex: page.index,
      pages: sourcePages,
      period,
      symbol: selectedSymbol,
    })
      .then((historyPage) => buildStoreV6HistoryPageWindow({ historyPage }))
      .then((historyPageWindow) => {
        if (reloadIdRef.current !== reloadId) return
        onOpenChart?.({
          historyPageWindow,
          pageNavigation: buildPageNavigation(page, sourcePages, historyPageWindow),
          realtimeEnabled: watchlistRealtimeEnabled,
          symbol: selectedSymbol,
          period,
          totalRows,
          limit: historyPageWindow.historyRows.length,
          reloadId,
          page: {
            fromGlobalIndex: historyPageWindow.boundary.actualFromGlobalIndex,
            index: page.index,
            limit: historyPageWindow.historyRows.length,
            realtime: false,
            rows: historyPageWindow.historyRows.length,
            timeFrom: historyPageWindow.boundary.actualTimeFrom ?? page.timeFrom,
            timeTo: historyPageWindow.boundary.actualTimeTo ?? page.timeTo,
            toGlobalIndex: historyPageWindow.boundary.actualToGlobalIndex,
          },
        })
        setPartitionStatus(`第 ${page.index} 页历史窗口已加载 ${formatPageRows(historyPageWindow.historyRows.length)} 根。`)
      })
      .catch((err) => {
        if (reloadIdRef.current !== reloadId) return
        setPartitionStatus(`第 ${page.index} 页历史窗口加载失败：${err instanceof Error ? err.message : String(err)}`)
      })
  }

  useEffect(() => {
    if (!pages.length || building) return
    const page = pages.find((item) => item.index === selectedPage) ?? pages[0]
    if (!page) return
    openPage(page, pages)
  }, [watchlistRealtimeEnabled])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setSelectedPage(1)
      setPartitionStatus('')
      if (!cacheKey) {
        setPages([])
        setLastResetInfo(null)
        return
      }
      const cached = readPageIndexCache()[cacheKey]
      const currentPartition = buildCurrentPartition()
      const cacheCurrent = isCurrentCache(cached, currentPartition)
      if (cached && !cacheCurrent) deletePageIndexCache(cacheKey)
      setLastResetInfo(readLastResetCache()[cacheKey] ?? null)
      setPages(cacheCurrent && selectedPeriod
        ? resolvePartitionCacheKind(currentPartition) === 'time'
          ? cached.pages
          : []
        : [])
      if (cacheCurrent) {
        setPageTotalRows(cached.totalRows)
        setPartitionStatus(`已缓存 ${cached.pages.length.toLocaleString('en-US')} 页，点击更新可按当前 StoreV6 重新定位分页符。`)
        if (resolvePartitionCacheKind(currentPartition) === 'time' && cached.pages[0]) {
          openPage(cached.pages[0], cached.pages)
        }
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [cacheKey])

  useEffect(() => {
    let cancelled = false
    if (!selectedSymbol) {
      setMaintenanceSummary(null)
      return
    }
    const loadEvents = () => {
      fetchStoreV6DailyMaintenanceEvents(selectedSymbol, 12)
        .then((payload) => {
          if (!cancelled) setMaintenanceSummary(formatMaintenanceSummary(payload.events))
        })
        .catch(() => {
          if (!cancelled) setMaintenanceSummary(null)
        })
    }
    loadEvents()
    const timer = window.setInterval(loadEvents, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [selectedSymbol])

  function buildPages(reason: 'auto' | 'manual' = 'manual') {
    const period = selectedPeriod
    if (!selectedSymbol || !period || !cacheKey || building) return
    setBuilding(true)
    void (async () => {
      let latestTime: number | null = null
      let nextTotalRows = pageTotalRows
      let preparedStatus: StoreV6CheckPayload | null = null
      if (onPreparePagePartition) {
        setPartitionStatus('正在执行分页前置链：拉取 -> 聚合...')
        preparedStatus = await onPreparePagePartition(period)
        nextTotalRows = resolveRowsFromStoreStatus(preparedStatus, period) ?? nextTotalRows
        setPageTotalRows(nextTotalRows)
      }
      const planningPartition = buildCurrentPartition(null, nextTotalRows)
      const partitionKind = resolvePartitionCacheKind(planningPartition)
      if (partitionKind === 'time') {
        latestTime = resolveLastTimeFromStoreStatus(preparedStatus, period)
      } else {
        setPages([])
        setPartitionStatus('旧 rows 分页/加载链路已移除；该周期需要接入新的时间分页器后才能生成页面。')
        return
      }
      const partition = buildCurrentPartition(latestTime, nextTotalRows)
      const pagesForUi = await materializeTimePageIndexRanges({ pages: partition.pages, period, symbol: selectedSymbol })
      persistPages(pagesForUi, nextTotalRows, partition)
      setSelectedPage(1)
      setPages(pagesForUi)
      setPartitionStatus(partition.statusText)
      const livePage = pagesForUi[0]
      if (livePage) openPage(livePage, pagesForUi)
      const resetInfo: PersistedPageResetInfo = {
        period,
        reason,
        resetAt: new Date().toISOString(),
        rows: livePage?.rows || 0,
        symbol: selectedSymbol,
      }
      writeLastResetCache(cacheKey, resetInfo)
      setLastResetInfo(resetInfo)
    })().catch((err) => {
      setPartitionStatus(`完整整理链失败：${err instanceof Error ? err.message : String(err)}`)
    }).finally(() => {
      setBuilding(false)
    })
  }

  const startResizePageTable = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = pageTableHeight
    let latestHeight = startHeight
    const pointerId = event.pointerId
    const target = event.currentTarget
    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeHistoryPageResizing = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = Math.max(minPageTableHeight, Math.min(startHeight + (moveEvent.clientY - startY), maxPageTableHeight))
      latestHeight = Math.round(nextHeight)
      setPageTableHeight(latestHeight)
    }

    const handlePointerUp = () => {
      delete document.body.dataset.fractalframeHistoryPageResizing
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      writeString(storageKeys.realtimePageTableHeightPx, String(latestHeight))
      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  const updateSummary = latestUpdateSummary(formatResetInfoSummary(lastResetInfo), maintenanceSummary)
  const pageRowsForUi = useMemo(() => pages.map((page) => ({
    page,
    rangeText: formatPageRange(page),
    rowsText: formatPageRows(page.rows),
  })), [pages])
  const pageTotalRowsText = useMemo(() => formatPageRows(pageTotalRows), [pageTotalRows])
  const pageTableBody = useMemo(() => pageRowsForUi.length ? pageRowsForUi.map(({ page, rangeText, rowsText }) => (
    <tr
      data-selected={selectedPage === page.index}
      key={page.index}
      onClick={() => openPage(page)}
      tabIndex={0}
    >
      <td>第 {page.index} 页</td>
      <td>{rowsText}</td>
      <td>{rangeText}</td>
    </tr>
  )) : (
    <tr>
      <td colSpan={3}>{selectedSymbol} {selectedPeriod || ''} 暂无分页缓存，点击更新生成。</td>
    </tr>
  ), [pageRowsForUi, selectedPage, selectedPeriod, selectedSymbol])

  return (
    <div className="ff-import-selected-settings" role="tabpanel">
      <div className="ff-import-selected-settings__head">
        <div className="ff-import-selected-settings__title">历史分页</div>
        <button disabled={building || !selectedPeriod} onClick={() => buildPages('manual')} type="button">
          {building ? '更新中' : '更新'}
        </button>
      </div>
      <div className="ff-page-loader-row">
        <div className="ff-import-selected-settings__status">
          {partitionStatus || '点击更新后，将按 StoreV6 全局索引重新定位分页符。'}
          {updateSummary ? (
            <span className="ff-import-selected-settings__reset-time">
              {updateSummary.text}
            </span>
          ) : null}
        </div>
        <div className="ff-page-loader-realtime">
          <button
            className="ff-watchlist-realtime-toggle"
            data-active={watchlistRealtimeEnabled}
            data-ready={watchlistRealtimeReady}
            onClick={onToggleRealtime}
            type="button"
            aria-pressed={watchlistRealtimeEnabled}
            aria-label={watchlistRealtimeEnabled ? (watchlistRealtimeReady ? '实时已开启' : '实时同步中') : '实时已关闭'}
          >
            <i aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="ff-import-page-list" style={{ height: `${pageTableHeight}px` }}>
        <table className="right-widget-drawer__table ff-indicators-table-v1 ff-import-page-table">
          <thead>
            <tr>
              <th>页</th>
              <th>行数</th>
              <th>范围</th>
            </tr>
          </thead>
          <tbody>
            {pageTableBody}
          </tbody>
        </table>
      </div>
      <div
        className="ff-import-page-table-splitter"
        onDoubleClick={() => {
          setPageTableHeight(defaultPageTableHeight)
          writeString(storageKeys.realtimePageTableHeightPx, String(defaultPageTableHeight))
        }}
        onPointerDown={startResizePageTable}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize history page list"
        tabIndex={0}
      />
      <div className="ff-import-selected-settings__meta">
        {cacheKind === 'time'
          ? `M5 使用独立时间分页，日期边界已解析为 StoreV6 globalIndex；当前总数 ${pageTotalRowsText}。`
          : `旧 rows 分页/加载链路已移除；该周期需要接入新的时间分页器后才能生成页面。当前总数 ${pageTotalRowsText}。`}
      </div>
    </div>
  )
}
