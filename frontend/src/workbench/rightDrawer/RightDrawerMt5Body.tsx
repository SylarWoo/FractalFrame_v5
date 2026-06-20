import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Mt5M1CheckJobPayload, Mt5RealtimeTick, Mt5SymbolRow, StoreV6AggregateJobPayload, StoreV6CheckPayload, StoreV6PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import type { ChartPageNavigation, ChartPageTarget } from '../chart/chartRuntimeTypes'
import type { StoreV6HistoryPageWindow } from '../chart/historyPageWindowV2'
import { hasStoreV6PeriodPageSystemV2 } from '../chart/pagePartition/periodPageSystemV2'
import { millisecondsUntilNextMarketSessionCheck, readMarketStatusTitleSnapshot, saveMarketStatusTitleSnapshotFromSymbolSession } from '../mt5DataCenter/marketStatusTitleState'
import { PagePartitionManager } from '../mt5DataCenter/PagePartitionManager'
import { StoreV6Panel } from '../mt5DataCenter/StoreV6Panel'
import { SymbolTable, type SymbolTableColumnKey } from '../mt5DataCenter/SymbolTable'
import { WatchlistTable, type WatchlistTableColumnKey } from '../mt5DataCenter/WatchlistTable'
import type { SelectedPanelTab } from '../mt5DataCenter/storeV6Persistence'
import { formatDetailValue, periodFromStoreTableKey, selectedDetailRows } from '../mt5DataCenter/storeV6StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV6StatusFormat'

type ColumnWidths = Record<SymbolTableColumnKey, number>
type WatchlistColumnWidths = Record<WatchlistTableColumnKey, number>
type Progress = { hasEstimate: boolean; width: number }
type SymbolDisplay = { chineseName: string; assetType: string; description: string }

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '详情' },
  { key: 'store', label: '仓库' },
  { key: 'settings', label: '历史分页' },
  { key: 'watchlist', label: '自选列表' },
]

type OpenChartOptions = {
  historyPageWindow?: StoreV6HistoryPageWindow | null
  pageNavigation?: ChartPageNavigation | null
  symbol: string
  period: string
  realtimeEnabled?: boolean
  totalRows?: number | null
  limit?: number
  reloadId?: number
  page?: ChartPageTarget | null
}

type RightDrawerMt5BodyProps = {
  aggregateProgress: StoreV6AggregateJobPayload | null
  canAggregateStoreV6: boolean
  columnWidths: ColumnWidths
  error: string
  loading: boolean
  localStoreStatus: StoreV6CheckPayload | null
  m1CheckJob: Mt5M1CheckJobPayload | null
  mt5M1LastCheckedAt: string
  onAggregateStore: () => void
  onCancelAggregateStore: () => void
  onCancelMt5M1Check: () => void
  onCancelPullStore: () => void
  onCheckMt5M1Staged: () => void
  onCleanLocalM1: () => void
  onColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: SymbolTableColumnKey) => void
  onWatchlistColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: WatchlistTableColumnKey) => void
  onDeleteLocalStore: () => void
  onDeleteSelectedAggregates: () => void
  onLoadSymbols: (refresh: boolean) => void
  onOpenChart?: (options: OpenChartOptions) => void
  onPreparePagePartition?: (period?: string) => Promise<StoreV6CheckPayload | null>
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
  pullProgress: StoreV6PullJobPayload | null
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
  storeCheck: StoreV6CheckPayload | null
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
    aggregateProgress,
    canAggregateStoreV6,
    columnWidths,
    error,
    loading,
    localStoreStatus,
    m1CheckJob,
    mt5M1LastCheckedAt,
    pullProgress,
    query,
    selectedAggregatePeriods,
    selectedDisplay,
    selectedIsInWatchlist,
    selectedPanelTab,
    selectedRow,
    selectedStoreTableKey,
    selectedStoreTableKeyIsVisible,
    selectedSymbol,
    shortcutMenuEnabled,
    status,
    storeCheck,
    storeCheckError,
    storeCheckLoading,
    storeOperationLine,
    storeOperationProgress,
    storePanelPersistenceEnabled,
    storeTableAggregatePeriods,
    tableWrapRef,
    visibleStoreTableRows,
    visibleSymbols,
    watchlistAggregatedPeriods,
    watchlistDirectPeriods,
    watchlistRealtimeEnabled,
    watchlistRealtimeReady,
    watchlistRows,
    watchlistColumnWidths,
    watchlistTableHeight,
    watchlistTableWrapRef,
    watchlistTicks,
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
                <h3 className="ff-import-selected-title">
                  <span className="ff-import-selected-title__symbol">{selectedRow.symbol}</span>
                  <span className="ff-import-selected-title__name"> · {selectedDisplay.chineseName}</span>
                </h3>
                <p>{selectedDisplay.assetType}</p>
                {selectedMarketStatus && <MarketStatusLine status={selectedMarketStatus} />}
              </div>
              <div className="ff-import-selected-head__actions">
                <LoadRow label="添加自选列表" loaded={selectedIsInWatchlist} onSetLoaded={props.onSetSelectedWatchlistLoaded} />
                <LoadRow label="添加快捷菜单" loaded={shortcutMenuEnabled} onSetLoaded={props.onSetShortcutMenuLoaded} />
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
              <StoreV6Panel
                canAggregateStoreV6={canAggregateStoreV6}
                aggregateProgress={aggregateProgress}
                localStoreStatus={localStoreStatus}
                m1CheckJob={m1CheckJob}
                mt5M1LastCheckedAt={mt5M1LastCheckedAt}
                onAggregateStore={props.onAggregateStore}
                onCancelAggregateStore={props.onCancelAggregateStore}
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
                selectedSymbol={selectedSymbol}
                watchlistRealtimeEnabled={watchlistRealtimeEnabled}
                watchlistRows={watchlistRows}
                watchlistTableHeight={watchlistTableHeight}
                watchlistTableWrapRef={watchlistTableWrapRef}
                watchlistTicks={watchlistTicks}
              />
            )}
            {selectedPanelTab === 'settings' && (
              <PagePartitionManager
                onOpenChart={props.onOpenChart}
                onPreparePagePartition={props.onPreparePagePartition}
                onToggleRealtime={props.onToggleRealtime}
                selectedStoreTableKey={selectedStoreTableKey}
                selectedSymbol={selectedSymbol}
                storeRows={[...watchlistDirectPeriods, ...watchlistAggregatedPeriods, ...visibleStoreTableRows]}
                watchlistRealtimeEnabled={watchlistRealtimeEnabled}
                watchlistRealtimeReady={watchlistRealtimeReady}
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
    let frame = 0
    if (!selectedRow?.symbol) {
      frame = window.requestAnimationFrame(() => setStatus(null))
      return () => window.cancelAnimationFrame(frame)
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
      if (frame !== 0) window.cancelAnimationFrame(frame)
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
  const rows = [...directPeriods, ...aggregatedPeriods]
  const activePeriod = periodFromStoreTableKey(selectedStoreTableKey)
  const activeKind = selectedStoreTableKey.startsWith('m1-') ? 'm1' : 'aggregate'
  return (
    <div className="ff-watchlist-periods ff-import-selected-periods ff-chart-jump-controls" aria-label="Selected symbol available periods">
      <div className="ff-watchlist-periods__buttons">
        {rows.map((row) => (
          <button
            data-active={activeKind === row.kind && activePeriod === row.period}
            disabled={!hasStoreV6PeriodPageSystemV2(row.period)}
            key={`${row.kind}-${row.period}`}
            onClick={() => onOpenPeriod(row)}
            title={hasStoreV6PeriodPageSystemV2(row.period)
              ? `${row.period} · ${row.count} rows · ${row.updated}`
              : `${row.period} 暂未接入周期分页系统`}
            type="button"
          >
            {row.period}
          </button>
        ))}
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
