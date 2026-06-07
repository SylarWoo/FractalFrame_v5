import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ChartPageTarget } from '../chart/ChartCoreHost'
import {
  buildStoreV6PagePartition,
  type StoreV6PagePartition,
} from '../chart/pagePartition/pagePartitionBuilder'
import { writeRealtimePageBuffer } from '../chart/realtimePageBuffer'
import { loadStoreV6KLineData } from '../../datafeed/storeV6KLineDatafeed'
import { writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { workbenchEvents } from '../persistence/workbenchEvents'
import { periodFromStoreTableKey } from './storeV6StatusFormat'
import type { StoreTableRow } from './storeV6StatusFormat'
import { fetchStoreV6DailyMaintenanceEvents } from '../../services/mt5/mt5SymbolsApi'
import type { StoreV6CheckPayload } from '../../services/mt5/mt5SymbolsApi'
import {
  applyLiveRowsFromBuffer,
  defaultPageTableHeight,
  deletePageIndexCache,
  enrichPageTimeRanges,
  formatMaintenanceSummary,
  formatPageRange,
  formatPageRows,
  formatResetInfoSummary,
  hasPageRangeTime,
  historicalPageSize,
  isCurrentCache,
  latestUpdateSummary,
  maxPageTableHeight,
  minPageTableHeight,
  pageCacheKey,
  parseRowsCount,
  readLastResetCache,
  readPageIndexCache,
  readPageTableHeight,
  readRealtimeBufferDetail,
  readRolloverDetail,
  realtimePageSize,
  resolveRowsFromStoreStatus,
  writeLastResetCache,
  writePageIndexCache,
  type PersistedPageResetInfo,
  type RealtimePageRow,
  type UpdateSummary,
} from './pagePartitionManagerHelpers'

type PagePartitionManagerProps = {
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; limit?: number; reloadId?: number; page?: ChartPageTarget | null }) => void
  onPreparePagePartition?: () => Promise<StoreV6CheckPayload | null>
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
  const enrichmentSeqRef = useRef(0)
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
  const cacheKey = selectedSymbol && selectedPeriod ? pageCacheKey(selectedSymbol, selectedPeriod) : ''

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
      partitionMode: partition.partitionMode,
      period: selectedPeriod,
      profileVersion: partition.profileVersion,
      symbol: selectedSymbol,
      totalRows: totalRowsOverride,
    })
  }

  const enrichAdjacentPageRangesIfNeeded = (page: RealtimePageRow, sourcePages = pages) => {
    const period = selectedPeriod
    if (!period || !selectedSymbol) return
    const targetIndexes = new Set([page.index, page.index + 1])
    const targetPages = sourcePages.filter((item) => targetIndexes.has(item.index) && !hasPageRangeTime(item))
    if (!targetPages.length) return
    const seq = enrichmentSeqRef.current + 1
    enrichmentSeqRef.current = seq
    void enrichPageTimeRanges({
      pages: targetPages,
      period,
      symbol: selectedSymbol,
    }).then((pagesWithTime) => {
      if (!pagesWithTime.length || enrichmentSeqRef.current !== seq) return
      const pagesWithTimeByIndex = new Map(pagesWithTime.map((item) => [item.index, item]))
      setPages((current) => {
        const next = current.map((item) => pagesWithTimeByIndex.get(item.index) ?? item)
        persistPages(next)
        return next
      })
    })
  }

  const openPage = (page: RealtimePageRow, sourcePages = pages) => {
    const period = selectedPeriod
    if (!period) return
    reloadIdRef.current += 1
    setSelectedPage(page.index)
    onOpenChart?.({
      symbol: selectedSymbol,
      period,
      totalRows,
      limit: page.limit,
      reloadId: reloadIdRef.current,
      page: {
        fromGlobalIndex: page.fromGlobalIndex,
        identity: page.identity,
        index: page.index,
        limit: page.limit,
        realtime: page.realtime,
        rows: page.rows,
        timeFrom: page.timeFrom,
        timeTo: page.timeTo,
        toGlobalIndex: page.toGlobalIndex,
      },
    })
    enrichAdjacentPageRangesIfNeeded(page, sourcePages)
  }

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
        ? currentPartition.partitionMode === 'm5-time'
          ? cached.pages
          : applyLiveRowsFromBuffer(cached.pages, { period: selectedPeriod, symbol: selectedSymbol })
        : [])
      if (cacheCurrent) {
        setPageTotalRows(cached.totalRows)
        setPartitionStatus(`已缓存 ${cached.pages.length.toLocaleString('en-US')} 页，点击更新可按当前 StoreV6 重新定位分页符。`)
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

  useEffect(() => {
    const handleRealtimeBufferChanged = (event: Event) => {
      const detail = readRealtimeBufferDetail(event)
      if (!detail) return
      if (detail.symbol && selectedSymbol && detail.symbol !== selectedSymbol) return
      if (detail.period && selectedPeriod && detail.period.toUpperCase() !== selectedPeriod.toUpperCase()) return
      if (buildCurrentPartition().partitionMode !== 'rows') return
      setPages((current) => current.map((page) => {
        if (!page.realtime || page.index !== 1) return page
        return {
          ...page,
          rows: typeof detail.rows === 'number' && Number.isFinite(detail.rows) ? detail.rows : page.rows,
          timeFrom: typeof detail.timeFrom === 'number' ? detail.timeFrom : page.timeFrom,
          timeTo: typeof detail.timeTo === 'number' ? detail.timeTo : page.timeTo,
        }
      }))
    }
    window.addEventListener(workbenchEvents.realtimePageBufferChanged, handleRealtimeBufferChanged)
    return () => {
      window.removeEventListener(workbenchEvents.realtimePageBufferChanged, handleRealtimeBufferChanged)
    }
  }, [selectedPeriod, selectedSymbol])

  useEffect(() => {
    const handleRealtimePageRollover = (event: Event) => {
      const detail = readRolloverDetail(event)
      if (!detail) return
      if (detail.symbol && selectedSymbol && detail.symbol !== selectedSymbol) return
      if (detail.period && selectedPeriod && detail.period.toUpperCase() !== selectedPeriod.toUpperCase()) return
      if (buildCurrentPartition().partitionMode !== 'rows') return
      setPartitionStatus(`实时页已增长到 ${formatPageRows(detail.rows)} 根，达到 ${formatPageRows(detail.thresholdRows)} 根整理边界；正在自动整理并重建分页。`)
      if (!building) buildPages('auto')
    }
    window.addEventListener(workbenchEvents.realtimePageRolloverRequested, handleRealtimePageRollover)
    return () => {
      window.removeEventListener(workbenchEvents.realtimePageRolloverRequested, handleRealtimePageRollover)
    }
  }, [building, selectedPeriod, selectedSymbol])

  function buildPages(reason: 'auto' | 'manual' = 'manual') {
    const period = selectedPeriod
    if (!selectedSymbol || !period || !cacheKey || building) return
    setBuilding(true)
    void (async () => {
      let rebuiltLiveRows = 0
      let latestTime: number | null = null
      let nextTotalRows = pageTotalRows
      if (onPreparePagePartition) {
        setPartitionStatus('正在执行完整整理链：拉取 -> 聚合 -> audit/repair...')
        const preparedStatus = await onPreparePagePartition()
        nextTotalRows = resolveRowsFromStoreStatus(preparedStatus, period) ?? nextTotalRows
        setPageTotalRows(nextTotalRows)
      }
      const planningPartition = buildCurrentPartition(null, nextTotalRows)
      const realtimeBufferEnabled = planningPartition.partitionMode === 'rows'
      try {
        const latestRows = await loadStoreV6KLineData({
          limit: realtimeBufferEnabled ? realtimePageSize : 1,
          period,
          symbol: selectedSymbol,
        })
        if (latestRows.length) {
          const latestRow = latestRows[latestRows.length - 1]
          latestTime = typeof latestRow?.timestamp === 'number' ? Math.floor(latestRow.timestamp / 1000) : null
          rebuiltLiveRows = realtimeBufferEnabled ? writeRealtimePageBuffer(selectedSymbol, period, latestRows).length : 0
        }
      } catch {
        rebuiltLiveRows = 0
      }
      const partition = buildCurrentPartition(latestTime, nextTotalRows)
      const pagesForUi = partition.partitionMode === 'rows'
        ? applyLiveRowsFromBuffer(partition.pages, { period, symbol: selectedSymbol })
        : partition.pages
      enrichmentSeqRef.current += 1
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
        rows: rebuiltLiveRows || livePage?.rows || 0,
        symbol: selectedSymbol,
      }
      writeLastResetCache(cacheKey, resetInfo)
      setLastResetInfo(resetInfo)
      if (rebuiltLiveRows > 0) {
        setPartitionStatus(`${partition.statusText} 实时活动页已按最新 StoreV6 重建 ${formatPageRows(rebuiltLiveRows)} 根。`)
      }
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
  const currentPartition = buildCurrentPartition()

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
            {pages.length ? (
              pages.map((page) => (
                <tr
                  data-selected={selectedPage === page.index}
                  key={page.index}
                  onClick={() => openPage(page)}
                  tabIndex={0}
                >
                  <td>第 {page.index} 页</td>
                  <td>{formatPageRows(page.rows)}</td>
                  <td>{formatPageRange(page)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3}>{selectedSymbol} {selectedPeriod || ''} 暂无分页缓存，点击更新生成。</td>
              </tr>
            )}
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
        {currentPartition.partitionMode === 'm5-time'
          ? `M5 使用交易日时间分页，行数按点击页面后的 timeFrom/timeTo 查询；当前总数 ${formatPageRows(pageTotalRows)}。`
          : `第 1 页使用实时页 ${formatPageRows(realtimePageSize)} 根，后续每页 ${formatPageRows(historicalPageSize)} 根；当前总数 ${formatPageRows(pageTotalRows)}。`}
      </div>
    </div>
  )
}
