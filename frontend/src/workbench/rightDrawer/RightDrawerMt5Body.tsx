import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { loadStoreV5KLineData } from '../../datafeed/storeV5KLineDatafeed'
import type { SymbolTableColumnKey } from '../mt5DataCenter/SymbolTable'
import type { WatchlistTableColumnKey } from '../mt5DataCenter/WatchlistTable'
import { SymbolTable } from '../mt5DataCenter/SymbolTable'
import { StoreV5Panel } from '../mt5DataCenter/StoreV5Panel'
import { WatchlistTable } from '../mt5DataCenter/WatchlistTable'
import type { Mt5RealtimeTick, Mt5SymbolRow, StoreV5CheckPayload, Mt5M1CheckJobPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import type { SelectedPanelTab } from '../mt5DataCenter/storeV5Persistence'
import { millisecondsUntilNextMarketSessionCheck, readMarketStatusTitleSnapshot, saveMarketStatusTitleSnapshotFromSymbolSession } from '../mt5DataCenter/marketStatusTitleState'
import { formatDetailValue, periodFromStoreTableKey, selectedDetailRows } from '../mt5DataCenter/storeV5StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV5StatusFormat'
import { readJson, readString, writeJson, writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { workbenchEvents } from '../persistence/workbenchEvents'
import type { ChartPageTarget } from '../chart/ChartCoreHost'

type ColumnWidths = Record<SymbolTableColumnKey, number>
type WatchlistColumnWidths = Record<WatchlistTableColumnKey, number>
type Progress = { hasEstimate: boolean; width: number }
type SymbolDisplay = { chineseName: string; assetType: string; description: string }

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '详情' },
  { key: 'store', label: '仓库' },
  { key: 'watchlist', label: '自选列表' },
  { key: 'settings', label: '历史分页' },
]

type RightDrawerMt5BodyProps = {
  canAggregateStoreV5: boolean
  columnWidths: ColumnWidths
  error: string
  loading: boolean
  localStoreStatus: StoreV5CheckPayload | null
  m1CheckJob: Mt5M1CheckJobPayload | null
  mt5M1LastCheckedAt: string
  onAggregateStore: () => void
  onCancelMt5M1Check: () => void
  onCancelPullStore: () => void
  onCheckMt5M1Staged: () => void
  onCleanLocalM1: () => void
  onColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: SymbolTableColumnKey) => void
  onWatchlistColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: WatchlistTableColumnKey) => void
  onDeleteLocalStore: () => void
  onDeleteSelectedAggregates: () => void
  onLoadSymbols: (refresh: boolean) => void
  onOpenStoreTableRow: (row: StoreTableRow) => void
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
  onOpenWatchlistPeriod: (row: StoreTableRow) => void
  onPullStore: () => void
  onRefreshStoreStatus: () => void
  onRepairM1Gaps: () => void
  onResetColumnWidth: (column: SymbolTableColumnKey) => void
  onResetWatchlistColumnWidth: (column: WatchlistTableColumnKey) => void
  onResetTopPaneHeight: () => void
  onResetWatchlistHeight: () => void
  onResizeWatchlistPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onSelectSymbol: (symbol: string) => void
  onSetQuery: (value: string) => void
  onSetSelectedPanelTab: (tab: SelectedPanelTab) => void
  onSetShortcutMenuLoaded: (loaded: boolean) => void
  onSetSelectedWatchlistLoaded: (loaded: boolean) => void
  onSplitPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onToggleAggregatePeriod: (period: string) => void
  onToggleAllAggregatePeriods: () => void
  onToggleRealtime: () => void
  onToggleStorePanelPersistence: (enabled: boolean) => void
  pullProgress: StoreV5PullJobPayload | null
  query: string
  selectedAggregatePeriods: string[]
  selectedDisplay: SymbolDisplay | null
  selectedIsInWatchlist: boolean
  selectedPanelTab: SelectedPanelTab
  selectedRow: Mt5SymbolRow | null
  selectedStoreTableKey: string
  selectedStoreTableKeyIsVisible: boolean
  selectedSymbol: string
  shortcutMenuEnabled: boolean
  status: string
  storeCheck: StoreV5CheckPayload | null
  storeCheckError: string
  storeCheckLoading: boolean
  storeOperationLine: string
  storeOperationProgress: Progress | null
  storePanelPersistenceEnabled: boolean
  storeTableAggregatePeriods: string[]
  tableWrapRef: RefObject<HTMLDivElement | null>
  visibleStoreTableRows: StoreTableRow[]
  visibleSymbols: Mt5SymbolRow[]
  watchlistAggregatedPeriods: StoreTableRow[]
  watchlistDirectPeriods: StoreTableRow[]
  watchlistRealtimeEnabled: boolean
  watchlistRealtimeLog: string[]
  watchlistRealtimeReady: boolean
  watchlistRows: Mt5SymbolRow[]
  watchlistColumnWidths: WatchlistColumnWidths
  watchlistTableHeight: number
  watchlistTableWrapRef: RefObject<HTMLDivElement | null>
  watchlistTicks: Record<string, Mt5RealtimeTick>
}

export function RightDrawerMt5Body(props: RightDrawerMt5BodyProps) {
  const {
    canAggregateStoreV5, columnWidths, error, loading,
    localStoreStatus, m1CheckJob, mt5M1LastCheckedAt, pullProgress, query, selectedAggregatePeriods,
    selectedDisplay, selectedIsInWatchlist, selectedPanelTab, selectedRow, selectedStoreTableKey,
    selectedStoreTableKeyIsVisible, selectedSymbol, shortcutMenuEnabled, status, storeCheck, storeCheckError,
    storeCheckLoading, storeOperationLine, storeOperationProgress, storePanelPersistenceEnabled,
    storeTableAggregatePeriods, tableWrapRef, visibleStoreTableRows, visibleSymbols, watchlistAggregatedPeriods,
    watchlistDirectPeriods, watchlistRealtimeEnabled, watchlistRealtimeLog,
    watchlistRealtimeReady, watchlistRows, watchlistColumnWidths, watchlistTableHeight,
    watchlistTableWrapRef, watchlistTicks,
  } = props
  const selectedMarketStatus = useSelectedMarketStatus(selectedRow)

  return (
    <div className="ff-right-drawer__body">
      <section className="ff-mt5-pane ff-mt5-pane--top">
        <form className="ff-import-toolbar" onSubmit={props.onSearch}>
          <input onChange={(event) => props.onSetQuery(event.target.value)} placeholder="Search..." value={query} />
          <button className="ff-import-toolbar__search" type="submit">Search</button>
          <button disabled={loading} onClick={() => props.onLoadSymbols(true)} type="button">
            {loading ? 'Scanning...' : 'Scan MT5'}
          </button>
        </form>
        <div className="ff-import-note" data-error={Boolean(error)}>{status}</div>
        <SymbolTable
          columnWidths={columnWidths}
          loading={loading}
          onColumnResizePointerDown={props.onColumnResizePointerDown}
          onResetColumnWidth={props.onResetColumnWidth}
          onSelectSymbol={props.onSelectSymbol}
          selectedSymbol={selectedSymbol}
          tableWrapRef={tableWrapRef}
          visibleSymbols={visibleSymbols}
        />
      </section>
      <div className="ff-mt5-pane-splitter" onDoubleClick={props.onResetTopPaneHeight} onPointerDown={props.onSplitPointerDown} role="separator" aria-orientation="horizontal" aria-label="Resize MT5 panel split" tabIndex={0} />
      <section className="ff-mt5-pane ff-mt5-pane--bottom" aria-label="MT5 lower workspace">
        {selectedRow && selectedDisplay && (
          <section className="ff-import-selected" aria-label="Selected MT5 symbol">
            <div className="ff-import-selected-head">
              <div className="ff-import-selected-head__text">
                <h3>{selectedRow.symbol} · {selectedDisplay.chineseName}</h3>
                <p>{selectedDisplay.assetType}</p>
                {selectedMarketStatus && <MarketStatusLine status={selectedMarketStatus} />}
              </div>
              <div className="ff-import-selected-head__actions">
                <LoadRow label="添加自选列表：" loaded={selectedIsInWatchlist} onSetLoaded={props.onSetSelectedWatchlistLoaded} />
                <LoadRow label="添加快捷菜单：" loaded={shortcutMenuEnabled} onSetLoaded={props.onSetShortcutMenuLoaded} />
              </div>
            </div>
            {(watchlistDirectPeriods.length > 0 || watchlistAggregatedPeriods.length > 0) && (
              <SelectedSymbolPeriodSelector
                aggregatedPeriods={watchlistAggregatedPeriods}
                directPeriods={watchlistDirectPeriods}
                onOpenPeriod={props.onOpenWatchlistPeriod}
                selectedStoreTableKey={selectedStoreTableKey}
              />
            )}
            <div className="ff-import-selected-tabs" role="tablist" aria-label="MT5 symbol panels">
              {selectedPanelTabs.map((tab) => (
                <button aria-selected={selectedPanelTab === tab.key} className="ff-import-selected-tabs__item" data-active={selectedPanelTab === tab.key} key={tab.key} onClick={() => props.onSetSelectedPanelTab(tab.key)} role="tab" type="button">{tab.label}</button>
              ))}
            </div>
            {selectedPanelTab === 'details' && <SelectedDetails selectedRow={selectedRow} />}
            {selectedPanelTab === 'store' && (
              <StoreV5Panel
                canAggregateStoreV5={canAggregateStoreV5}
                localStoreStatus={localStoreStatus}
                m1CheckJob={m1CheckJob}
                mt5M1LastCheckedAt={mt5M1LastCheckedAt}
                onAggregateStore={props.onAggregateStore}
                onCancelMt5M1Check={props.onCancelMt5M1Check}
                onCancelPullStore={props.onCancelPullStore}
                onCheckMt5M1Staged={props.onCheckMt5M1Staged}
                onCleanLocalM1={props.onCleanLocalM1}
                onDeleteLocalStore={props.onDeleteLocalStore}
                onDeleteSelectedAggregates={props.onDeleteSelectedAggregates}
                onOpenStoreTableRow={props.onOpenStoreTableRow}
                onPullStore={props.onPullStore}
                onRefreshStoreStatus={props.onRefreshStoreStatus}
                onRepairM1Gaps={props.onRepairM1Gaps}
                onToggleAggregatePeriod={props.onToggleAggregatePeriod}
                onToggleAllAggregatePeriods={props.onToggleAllAggregatePeriods}
                onToggleStorePanelPersistence={props.onToggleStorePanelPersistence}
                pullProgress={pullProgress}
                selectedAggregatePeriods={selectedAggregatePeriods}
                selectedStoreTableKey={selectedStoreTableKey}
                selectedStoreTableKeyIsVisible={selectedStoreTableKeyIsVisible}
                storeCheck={storeCheck}
                storeCheckError={storeCheckError}
                storeCheckLoading={storeCheckLoading}
                storeOperationLine={storeOperationLine}
                storeOperationProgress={storeOperationProgress}
                storePanelPersistenceEnabled={storePanelPersistenceEnabled}
                storeTableAggregatePeriods={storeTableAggregatePeriods}
                visibleStoreTableRows={visibleStoreTableRows}
              />
            )}
            {selectedPanelTab === 'watchlist' && (
              <WatchlistTable
                columnWidths={watchlistColumnWidths}
                onColumnResizePointerDown={props.onWatchlistColumnResizePointerDown}
                onResizePointerDown={props.onResizeWatchlistPointerDown}
                onResetColumnWidth={props.onResetWatchlistColumnWidth}
                onResetHeight={props.onResetWatchlistHeight}
                onSelectSymbol={props.onSelectSymbol}
                onToggleRealtime={props.onToggleRealtime}
                selectedSymbol={selectedSymbol}
                watchlistRealtimeEnabled={watchlistRealtimeEnabled}
                watchlistRealtimeLog={watchlistRealtimeLog}
                watchlistRealtimeReady={watchlistRealtimeReady}
                watchlistRows={watchlistRows}
                watchlistTableHeight={watchlistTableHeight}
                watchlistTableWrapRef={watchlistTableWrapRef}
                watchlistTicks={watchlistTicks}
              />
            )}
            {selectedPanelTab === 'settings' && (
              <SelectedSymbolRealtimePages
                onOpenChart={props.onOpenChart}
                selectedStoreTableKey={selectedStoreTableKey}
                selectedSymbol={selectedSymbol}
                storeRows={[...watchlistDirectPeriods, ...watchlistAggregatedPeriods, ...visibleStoreTableRows]}
              />
            )}
          </section>
        )}
      </section>
    </div>
  )
}

function useSelectedMarketStatus(selectedRow: Mt5SymbolRow | null) {
  const [status, setStatus] = useState(() => (
    selectedRow?.symbol ? readMarketStatusTitleSnapshot(selectedRow.symbol)?.status ?? null : null
  ))

  useEffect(() => {
    if (!selectedRow?.symbol) {
      setStatus(null)
      return
    }

    let timer = 0
    const sync = () => {
      const snapshot = saveMarketStatusTitleSnapshotFromSymbolSession(selectedRow)
      setStatus(snapshot?.status ?? null)
      const delay = millisecondsUntilNextMarketSessionCheck(selectedRow)
      if (delay != null) timer = window.setTimeout(sync, delay)
    }

    sync()
    return () => {
      if (timer !== 0) window.clearTimeout(timer)
    }
  }, [selectedRow])

  return status
}

function MarketStatusLine({ status }: { status: { label: string; status: 'open' | 'closed' } }) {
  return (
    <div className="ff-import-market-status" data-status={status.status}>
      <span className={status.status === 'open' ? 'ff-import-market-status__dot' : 'ff-import-market-status__bar'} />
      <span className="ff-import-market-status__label">{status.label}</span>
    </div>
  )
}

function SelectedSymbolPeriodSelector({
  aggregatedPeriods,
  directPeriods,
  onOpenPeriod,
  selectedStoreTableKey,
}: {
  aggregatedPeriods: StoreTableRow[]
  directPeriods: StoreTableRow[]
  onOpenPeriod: (row: StoreTableRow) => void
  selectedStoreTableKey: string
}) {
  return (
    <div className="ff-watchlist-periods ff-import-selected-periods" aria-label="Selected symbol available periods">
      {directPeriods.length > 0 && (
        <section className="ff-watchlist-periods__group">
          <h4>Direct source</h4>
          <div className="ff-watchlist-periods__buttons">
            {directPeriods.map((row) => (
              <button
                data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                key={`${row.kind}-${row.period}`}
                onClick={() => onOpenPeriod(row)}
                title={`${row.period} · ${row.count} rows · ${row.updated}`}
                type="button"
              >
                {row.period}
              </button>
            ))}
          </div>
        </section>
      )}
      {aggregatedPeriods.length > 0 && (
        <section className="ff-watchlist-periods__group">
          <h4>Aggregated source</h4>
          <div className="ff-watchlist-periods__buttons">
            {aggregatedPeriods.map((row) => (
              <button
                data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                key={`${row.kind}-${row.period}`}
                onClick={() => onOpenPeriod(row)}
                title={`${row.period} · ${row.count} rows · ${row.updated}`}
                type="button"
              >
                {row.period}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

type RealtimePageSnapshot = {
  builtAt?: string
  localRows?: number
  mt5Rows?: number
  page?: number
  pageSize?: number
  period?: string
  rows?: number
  symbol?: string
  timeFrom?: number | null
  timeTo?: number | null
  type?: string
}

type RealtimePageRow = {
  index: number
  limit: number
  realtime: boolean
  rows: number
  timeFrom?: number | null
  timeTo?: number | null
}

function readRealtimePageSnapshot() {
  return readJson<RealtimePageSnapshot | null>(storageKeys.realtimePageSnapshot, null)
}

function formatPageDateTime(seconds: number | null | undefined) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(seconds * 1000))
}

function formatPageRows(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '-'
}

function parseRowsCount(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(String(value ?? '').replace(/[^\d]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const historicalPageSize = 30000
const realtimePageSize = 25000
const defaultPageTableHeight = 220
const minPageTableHeight = 120
const maxPageTableHeight = 520

type PersistedPageIndex = {
  builtAt: string
  pageSize: number
  pages: RealtimePageRow[]
  period: string
  symbol: string
  totalRows: number | null
}

function pageCacheKey(symbol: string, period: string) {
  return `${symbol.trim().toUpperCase()}:${period.trim().toUpperCase()}`
}

function readPageIndexCache() {
  return readJson<Record<string, PersistedPageIndex>>(storageKeys.realtimePageIndexCache, {})
}

function writePageIndexCache(key: string, value: PersistedPageIndex) {
  writeJson(storageKeys.realtimePageIndexCache, {
    ...readPageIndexCache(),
    [key]: value,
  })
}

function readPageTableHeight() {
  const parsed = Number(readString(storageKeys.realtimePageTableHeightPx))
  return Number.isFinite(parsed)
    ? Math.max(minPageTableHeight, Math.min(Math.round(parsed), maxPageTableHeight))
    : defaultPageTableHeight
}

function SelectedSymbolRealtimePages({
  onOpenChart,
  selectedStoreTableKey,
  selectedSymbol,
  storeRows,
}: {
  onOpenChart?: (options: { symbol: string; period: string; totalRows?: number | null; reloadId?: number; page?: ChartPageTarget | null }) => void
  selectedStoreTableKey: string
  selectedSymbol: string
  storeRows: StoreTableRow[]
}) {
  const [snapshot, setSnapshot] = useState(readRealtimePageSnapshot)
  const [selectedPage, setSelectedPage] = useState(1)
  const [pages, setPages] = useState<RealtimePageRow[]>([])
  const [building, setBuilding] = useState(false)
  const [pageTableHeight, setPageTableHeight] = useState(readPageTableHeight)
  const selectedPeriod = periodFromStoreTableKey(selectedStoreTableKey)
  const selectedStoreRow = storeRows.find((row) => `${row.kind}-${row.period}` === selectedStoreTableKey)
    ?? storeRows.find((row) => row.period.toUpperCase() === selectedPeriod)
  const totalRows = parseRowsCount(selectedStoreRow?.rowsCount ?? selectedStoreRow?.count)
  const cacheKey = selectedSymbol && selectedPeriod ? pageCacheKey(selectedSymbol, selectedPeriod) : ''
  const visibleSnapshot = snapshot
    && snapshot.symbol === selectedSymbol
    && (!selectedPeriod || snapshot.period?.toUpperCase() === selectedPeriod)
    ? snapshot
    : null

  useEffect(() => {
    const sync = () => setSnapshot(readRealtimePageSnapshot())
    window.addEventListener(workbenchEvents.realtimePageSnapshotChanged, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(workbenchEvents.realtimePageSnapshotChanged, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    setSelectedPage(1)
    if (!cacheKey) {
      setPages([])
      return
    }
    setPages(readPageIndexCache()[cacheKey]?.pages ?? [])
  }, [cacheKey])

  const buildPages = async () => {
    const period = visibleSnapshot?.period || selectedPeriod
    if (!selectedSymbol || !period || !cacheKey || building) return
    setBuilding(true)
    try {
      const nextPages: RealtimePageRow[] = []
      let anchorTimeTo: number | null = null

      if (visibleSnapshot && typeof visibleSnapshot.timeFrom === 'number') {
        nextPages.push({
          index: 1,
          limit: visibleSnapshot.pageSize ?? realtimePageSize,
          realtime: true,
          rows: visibleSnapshot.rows ?? Math.min(totalRows ?? realtimePageSize, realtimePageSize),
          timeFrom: visibleSnapshot.timeFrom,
          timeTo: visibleSnapshot.timeTo,
        })
        anchorTimeTo = visibleSnapshot.timeFrom - 1
      } else {
        const page1Limit = Math.min(totalRows ?? realtimePageSize, realtimePageSize)
        const rows = await loadStoreV5KLineData({ symbol: selectedSymbol, period, limit: page1Limit })
        const first = rows[0]
        const last = rows[rows.length - 1]
        nextPages.push({
          index: 1,
          limit: page1Limit,
          realtime: true,
          rows: rows.length,
          timeFrom: typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) : null,
          timeTo: typeof last?.timestamp === 'number' ? Math.floor(last.timestamp / 1000) : null,
        })
        anchorTimeTo = typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) - 1 : null
      }

      if (anchorTimeTo != null) {
        const historyRows = totalRows != null
          ? Math.max(0, totalRows - (nextPages[0]?.rows ?? 0))
          : historicalPageSize
        const historyPageCount = totalRows != null
          ? Math.ceil(historyRows / historicalPageSize)
          : 1

        for (let index = 0; index < historyPageCount; index += 1) {
          const remaining = totalRows != null
            ? historyRows - index * historicalPageSize
            : historicalPageSize
          const limit = Math.min(historicalPageSize, remaining)
          if (limit <= 0) break
          const rows = await loadStoreV5KLineData({ symbol: selectedSymbol, period, limit, timeTo: anchorTimeTo })
          if (!rows.length) break
          const first = rows[0]
          const last = rows[rows.length - 1]
          nextPages.push({
            index: nextPages.length + 1,
            limit,
            realtime: false,
            rows: rows.length,
            timeFrom: typeof first?.timestamp === 'number' ? Math.floor(first.timestamp / 1000) : null,
            timeTo: typeof last?.timestamp === 'number' ? Math.floor(last.timestamp / 1000) : anchorTimeTo,
          })
          if (typeof first?.timestamp !== 'number' || rows.length < limit) break
          anchorTimeTo = Math.floor(first.timestamp / 1000) - 1
        }
      }

      writePageIndexCache(cacheKey, {
        builtAt: new Date().toISOString(),
        pageSize: historicalPageSize,
        pages: nextPages,
        period,
        symbol: selectedSymbol,
        totalRows,
      })
      setSelectedPage(1)
      setPages(nextPages)
    } finally {
      setBuilding(false)
    }
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
        // Ignore if the pointer capture was already released.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  const openPage = (page: RealtimePageRow) => {
    const period = visibleSnapshot?.period || selectedPeriod
    if (!period) return
    setSelectedPage(page.index)
    onOpenChart?.({
      symbol: selectedSymbol,
      period,
      totalRows: page.rows,
      reloadId: Date.now(),
      page: {
        index: page.index,
        limit: page.limit,
        realtime: page.realtime,
        timeTo: page.timeTo,
      },
    })
  }

  return (
    <div className="ff-import-selected-settings" role="tabpanel">
      <div className="ff-import-selected-settings__head">
        <div className="ff-import-selected-settings__title">历史分页</div>
        <button disabled={building || !selectedPeriod} onClick={buildPages} type="button">
          {building ? '更新中' : '更新'}
        </button>
      </div>
      <div className="ff-import-page-table-wrap" style={{ height: `${pageTableHeight}px` }}>
        <table className="ff-import-page-table">
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
                >
                  <td>第 {page.index} 页</td>
                  <td>{formatPageRows(page.rows)}</td>
                  <td>{formatPageDateTime(page.timeFrom)} ~ {page.realtime ? '当前' : formatPageDateTime(page.timeTo)}</td>
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
        第 1 页使用实时页，后续每页 {formatPageRows(historicalPageSize)} 根；当前总数 {formatPageRows(totalRows)}。
      </div>
    </div>
  )
}

function LoadRow({ label, loaded, onSetLoaded }: { label: string; loaded: boolean; onSetLoaded: (loaded: boolean) => void }) {
  return (
    <div className="ff-import-load-row">
      <span>{label}</span>
      <div className="ff-import-load-switch" aria-label={label}>
        <button data-active={loaded} onClick={() => onSetLoaded(true)} type="button">Load</button>
        <button data-active={!loaded} onClick={() => onSetLoaded(false)} type="button">Unload</button>
      </div>
    </div>
  )
}

function SelectedDetails({ selectedRow }: { selectedRow: Mt5SymbolRow }) {
  return (
    <div className="ff-import-selected-detail" role="tabpanel">
      {selectedDetailRows(selectedRow).map(([leftLabel, leftValue, rightLabel, rightValue]) => (
        <div className="ff-import-selected-detail__row" data-wide={rightLabel == null} key={`${leftLabel}-${rightLabel ?? 'wide'}`}>
          <span>{leftLabel}</span>
          {rightLabel == null ? (
            <strong className="ff-import-selected-detail__wide-value" title={formatDetailValue(leftValue)}>{formatDetailValue(leftValue)}</strong>
          ) : (
            <>
              <strong title={formatDetailValue(leftValue)}>{formatDetailValue(leftValue)}</strong>
              <span>{rightLabel}</span>
              <strong title={formatDetailValue(rightValue)}>{formatDetailValue(rightValue)}</strong>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

