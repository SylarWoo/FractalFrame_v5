import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { SymbolTableColumnKey } from '../mt5DataCenter/SymbolTable'
import type { WatchlistTableColumnKey } from '../mt5DataCenter/WatchlistTable'
import { SymbolTable } from '../mt5DataCenter/SymbolTable'
import { StoreV5Panel } from '../mt5DataCenter/StoreV5Panel'
import { WatchlistTable } from '../mt5DataCenter/WatchlistTable'
import type { Mt5RealtimeTick, Mt5SymbolRow, StoreV5CheckPayload, Mt5M1CheckJobPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import type { SelectedPanelTab } from '../mt5DataCenter/storeV5Persistence'
import { formatDetailValue, resolveLocalM1LastTime, selectedDetailRows } from '../mt5DataCenter/storeV5StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV5StatusFormat'
import { readChartTimezone } from '../chart/chartTimeFormatting'
import { settingsSymbolChangedEvent } from '../settingsSymbolState'

type ColumnWidths = Record<SymbolTableColumnKey, number>
type WatchlistColumnWidths = Record<WatchlistTableColumnKey, number>
type Progress = { hasEstimate: boolean; width: number }
type SymbolDisplay = { chineseName: string; assetType: string; description: string }
type SelectedMarketStatus = { isOpen: boolean; lastTime?: number | null; timezone: string }

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '详情' },
  { key: 'store', label: '仓库' },
  { key: 'watchlist', label: '自选列表' },
  { key: 'settings', label: '设置' },
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
  const selectedMarketStatus = useSelectedMarketStatus(selectedRow, localStoreStatus, watchlistTicks[selectedSymbol], watchlistRealtimeEnabled)

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
                <MarketStatusLine marketStatus={selectedMarketStatus} />
              </div>
              <div className="ff-import-selected-head__actions">
                <LoadRow label="添加自选列表：" loaded={selectedIsInWatchlist} onSetLoaded={props.onSetSelectedWatchlistLoaded} />
                <LoadRow label="添加快捷菜单：" loaded={shortcutMenuEnabled} onSetLoaded={props.onSetShortcutMenuLoaded} />
              </div>
            </div>
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
                onOpenWatchlistPeriod={props.onOpenWatchlistPeriod}
                onResizePointerDown={props.onResizeWatchlistPointerDown}
                onResetColumnWidth={props.onResetWatchlistColumnWidth}
                onResetHeight={props.onResetWatchlistHeight}
                onSelectSymbol={props.onSelectSymbol}
                onToggleRealtime={props.onToggleRealtime}
                selectedStoreTableKey={selectedStoreTableKey}
                selectedSymbol={selectedSymbol}
                watchlistAggregatedPeriods={watchlistAggregatedPeriods}
                watchlistDirectPeriods={watchlistDirectPeriods}
                watchlistRealtimeEnabled={watchlistRealtimeEnabled}
                watchlistRealtimeLog={watchlistRealtimeLog}
                watchlistRealtimeReady={watchlistRealtimeReady}
                watchlistRows={watchlistRows}
                watchlistTableHeight={watchlistTableHeight}
                watchlistTableWrapRef={watchlistTableWrapRef}
                watchlistTicks={watchlistTicks}
              />
            )}
          </section>
        )}
      </section>
    </div>
  )
}

function resolveTickTimeSeconds(tick: Mt5RealtimeTick | undefined) {
  if (!tick) return null
  if (typeof tick.timeMsc === 'number' && Number.isFinite(tick.timeMsc)) return Math.floor(tick.timeMsc / 1000)
  if (typeof tick.time === 'number' && Number.isFinite(tick.time)) return Math.floor(tick.time > 10_000_000_000 ? tick.time / 1000 : tick.time)
  const publishedAt = typeof tick.publishedAt === 'string' ? Date.parse(tick.publishedAt) : Number.NaN
  return Number.isFinite(publishedAt) ? Math.floor(publishedAt / 1000) : null
}

function isRecentRealtimeTick(tickSeconds: number | null, staleSeconds = 300) {
  if (typeof tickSeconds !== 'number') return false
  return Math.floor(Date.now() / 1000) - tickSeconds <= staleSeconds
}

function parseSessionMinute(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function isMinuteInSessionRange(range: string, currentMinute: number) {
  const [rawStart, rawEnd] = range.split('-')
  if (!rawStart || !rawEnd) return false
  const start = parseSessionMinute(rawStart)
  const end = parseSessionMinute(rawEnd)
  if (start == null || end == null) return false
  if (start === 0 && end === 0) return true
  if (start < end) return currentMinute >= start && currentMinute < end
  return currentMinute >= start || currentMinute < end
}

function resolveSessionOpen(row: Mt5SymbolRow | null, now = new Date()) {
  const tradeSessions = row?.sessions?.trade
  if (!Array.isArray(tradeSessions)) return null
  const daySessions = tradeSessions[now.getUTCDay()]
  if (!daySessions || !daySessions.trim()) return false
  const currentMinute = now.getUTCHours() * 60 + now.getUTCMinutes()
  return daySessions.split(',').some((range) => isMinuteInSessionRange(range.trim(), currentMinute))
}

function useSelectedMarketStatus(selectedRow: Mt5SymbolRow | null, localStoreStatus: StoreV5CheckPayload | null, realtimeTick: Mt5RealtimeTick | undefined, realtimeEnabled: boolean): SelectedMarketStatus {
  const sessionOpen = resolveSessionOpen(selectedRow)
  const realtimeTickSeconds = resolveTickTimeSeconds(realtimeTick)
  const realtimeOpen = realtimeEnabled && isRecentRealtimeTick(realtimeTickSeconds)
  const isOpen = sessionOpen ?? realtimeOpen
  const [marketStatus, setMarketStatus] = useState<SelectedMarketStatus>(() => ({
    isOpen,
    lastTime: sessionOpen != null ? Math.floor(Date.now() / 1000) : (realtimeOpen ? realtimeTickSeconds : resolveLocalM1LastTime(localStoreStatus)),
    timezone: readChartTimezone(),
  }))

  useEffect(() => {
    const syncTimezone = () => {
      setMarketStatus((current) => ({ ...current, timezone: readChartTimezone() }))
    }
    window.addEventListener(settingsSymbolChangedEvent, syncTimezone)
    window.addEventListener('storage', syncTimezone)
    return () => {
      window.removeEventListener(settingsSymbolChangedEvent, syncTimezone)
      window.removeEventListener('storage', syncTimezone)
    }
  }, [])

  useEffect(() => {
    setMarketStatus((current) => ({
      ...current,
      isOpen,
      lastTime: sessionOpen != null ? Math.floor(Date.now() / 1000) : (realtimeOpen ? realtimeTickSeconds : resolveLocalM1LastTime(localStoreStatus)),
    }))
  }, [isOpen, localStoreStatus, realtimeOpen, realtimeTickSeconds, sessionOpen])

  return marketStatus
}

function MarketStatusLine({ marketStatus }: { marketStatus: SelectedMarketStatus }) {
  const lastUpdated = typeof marketStatus.lastTime === 'number' ? marketStatus.lastTime * 1000 : null
  const formatted = lastUpdated ? formatMarketStatusTime(lastUpdated, marketStatus.timezone) : ''
  const timezoneText = formatMarketStatusTimezone(marketStatus.timezone)

  return (
    <div className="ff-import-market-status" data-status={marketStatus.isOpen ? 'open' : 'closed'} title={marketStatus.isOpen ? 'Realtime tick' : 'Local StoreV5 data'}>
      <span className={marketStatus.isOpen ? 'ff-import-market-status__dot' : 'ff-import-market-status__bar'} />
      <span className="ff-import-market-status__label">{marketStatus.isOpen ? '开市' : '休市'}</span>
      {formatted && (
        <span className="ff-import-market-status__muted">最后更新于{timezoneText} {formatted}</span>
      )}
    </div>
  )
}

function formatMarketStatusTime(timestamp: number, timezone: string) {
  try {
    const parts: Record<string, string> = {}
    new Intl.DateTimeFormat('zh-CN', {
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      minute: '2-digit',
      month: '2-digit',
      timeZone: timezone,
      year: 'numeric',
    }).formatToParts(new Date(timestamp)).forEach(({ type, value }) => {
      if (type === 'year') parts.year = value
      if (type === 'month') parts.month = value
      if (type === 'day') parts.day = value
      if (type === 'hour') parts.hour = value === '24' ? '00' : value
      if (type === 'minute') parts.minute = value
    })
    return `${parts.year ?? '1970'}/${parts.month ?? '01'}/${parts.day ?? '01'} ${parts.hour ?? '00'}:${parts.minute ?? '00'}`
  } catch {
    return formatMarketStatusTime(timestamp, 'UTC')
  }
}

function formatMarketStatusTimezone(timezone: string) {
  if (timezone === 'Asia/Shanghai') return 'GMT+8'
  if (timezone === 'UTC') return 'UTC'
  try {
    const part = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date()).find((item) => item.type === 'timeZoneName')
    return part?.value || timezone
  } catch {
    return timezone
  }
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
