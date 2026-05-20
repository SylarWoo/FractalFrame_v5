import { useEffect, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { ChartLoadState } from '../chart/ChartCoreHost'
import type { SymbolTableColumnKey } from '../mt5DataCenter/SymbolTable'
import { SymbolTable } from '../mt5DataCenter/SymbolTable'
import { StoreV5Panel } from '../mt5DataCenter/StoreV5Panel'
import { WatchlistTable } from '../mt5DataCenter/WatchlistTable'
import { fetchMt5Diagnostics, fetchRuntimeObservability } from '../../services/mt5/mt5SymbolsApi'
import type { Mt5DiagnosticsPayload, Mt5RealtimeTick, Mt5SymbolRow, RuntimeObservabilityPayload, StoreV5CheckPayload, Mt5M1CheckJobPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'
import type { SelectedPanelTab } from '../mt5DataCenter/storeV5Persistence'
import { formatDetailValue, selectedDetailRows } from '../mt5DataCenter/storeV5StatusFormat'
import type { StoreTableRow } from '../mt5DataCenter/storeV5StatusFormat'

type ColumnWidths = Record<SymbolTableColumnKey, number>
type Progress = { hasEstimate: boolean; width: number }
type SymbolDisplay = { chineseName: string; assetType: string; description: string }

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '细节' },
  { key: 'store', label: '仓库' },
  { key: 'watchlist', label: '自选列表' },
  { key: 'settings', label: '设置' },
]

type RightDrawerMt5BodyProps = {
  canAggregateStoreV5: boolean
  chartJumpError: string
  chartJumpInput: string
  chartLoadState?: ChartLoadState | null
  columnWidths: ColumnWidths
  error: string
  loading: boolean
  localStoreStatus: StoreV5CheckPayload | null
  m1CheckJob: Mt5M1CheckJobPayload | null
  mt5M1LastCheckedAt: string
  onAddM1ToStoreList: () => void
  onAggregateStore: () => void
  onCancelMt5M1Check: () => void
  onCancelPullStore: () => void
  onCheckMt5M1Staged: () => void
  onCleanLocalM1: () => void
  onColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: SymbolTableColumnKey) => void
  onDeleteLocalStore: () => void
  onDeleteSelectedAggregates: () => void
  onJumpChartToTime: () => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onLoadSymbols: (refresh: boolean) => void
  onOpenStoreTableRow: (row: StoreTableRow) => void
  onOpenWatchlistPeriod: (row: StoreTableRow) => void
  onPullStore: () => void
  onRefreshStoreStatus: () => void
  onResetChartToLatest: () => void
  onResetColumnWidth: (column: SymbolTableColumnKey) => void
  onResetTopPaneHeight: () => void
  onResetWatchlistHeight: () => void
  onResizeWatchlistPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onSearch: (event: FormEvent<HTMLFormElement>) => void
  onSelectSymbol: (symbol: string) => void
  onSetChartJumpError: (value: string) => void
  onSetChartJumpInput: (value: string) => void
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
  watchlistLastTickAt: string
  watchlistRealtimeEnabled: boolean
  watchlistRealtimeLog: string[]
  watchlistRealtimeReady: boolean
  watchlistRealtimeStatus: string
  watchlistRows: Mt5SymbolRow[]
  watchlistTableHeight: number
  watchlistTicks: Record<string, Mt5RealtimeTick>
}

export function RightDrawerMt5Body(props: RightDrawerMt5BodyProps) {
  const {
    canAggregateStoreV5, chartJumpError, chartJumpInput, chartLoadState, columnWidths, error, loading,
    localStoreStatus, m1CheckJob, mt5M1LastCheckedAt, pullProgress, query, selectedAggregatePeriods,
    selectedDisplay, selectedIsInWatchlist, selectedPanelTab, selectedRow, selectedStoreTableKey,
    selectedStoreTableKeyIsVisible, selectedSymbol, shortcutMenuEnabled, status, storeCheck, storeCheckError,
    storeCheckLoading, storeOperationLine, storeOperationProgress, storePanelPersistenceEnabled,
    storeTableAggregatePeriods, tableWrapRef, visibleStoreTableRows, visibleSymbols, watchlistAggregatedPeriods,
    watchlistDirectPeriods, watchlistLastTickAt, watchlistRealtimeEnabled, watchlistRealtimeLog,
    watchlistRealtimeReady, watchlistRealtimeStatus, watchlistRows, watchlistTableHeight, watchlistTicks,
  } = props
  const [diagnostics, setDiagnostics] = useState<Mt5DiagnosticsPayload | null>(null)
  const [runtime, setRuntime] = useState<RuntimeObservabilityPayload | null>(null)

  useEffect(() => {
    let disposed = false
    const refresh = () => Promise.allSettled([fetchMt5Diagnostics(selectedSymbol), fetchRuntimeObservability()]).then(([mt5Result, runtimeResult]) => {
      if (disposed) return
      setDiagnostics(mt5Result.status === 'fulfilled' ? mt5Result.value : { ok: false, status: 'diagnostics_fetch_failed', error: String(mt5Result.reason) })
      setRuntime(runtimeResult.status === 'fulfilled' ? runtimeResult.value : null)
    })
    refresh()
    const intervalId = window.setInterval(refresh, 10_000)
    return () => {
      disposed = true
      window.clearInterval(intervalId)
    }
  }, [selectedSymbol])

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
              <>
                <DiagnosticsStrip diagnostics={diagnostics} runtime={runtime} />
                <StoreV5Panel
                  canAggregateStoreV5={canAggregateStoreV5}
                chartJumpError={chartJumpError}
                chartJumpInput={chartJumpInput}
                chartLoadState={chartLoadState}
                localStoreStatus={localStoreStatus}
                m1CheckJob={m1CheckJob}
                mt5M1LastCheckedAt={mt5M1LastCheckedAt}
                onAddM1ToStoreList={props.onAddM1ToStoreList}
                onAggregateStore={props.onAggregateStore}
                onCancelMt5M1Check={props.onCancelMt5M1Check}
                onCancelPullStore={props.onCancelPullStore}
                onCheckMt5M1Staged={props.onCheckMt5M1Staged}
                onCleanLocalM1={props.onCleanLocalM1}
                onDeleteLocalStore={props.onDeleteLocalStore}
                onDeleteSelectedAggregates={props.onDeleteSelectedAggregates}
                onJumpChartToTime={props.onJumpChartToTime}
                onLoadChartStep={props.onLoadChartStep}
                onOpenStoreTableRow={props.onOpenStoreTableRow}
                onPullStore={props.onPullStore}
                onRefreshStoreStatus={props.onRefreshStoreStatus}
                onResetChartToLatest={props.onResetChartToLatest}
                onSetChartJumpError={props.onSetChartJumpError}
                onSetChartJumpInput={props.onSetChartJumpInput}
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
              </>
            )}
            {selectedPanelTab === 'watchlist' && (
              <WatchlistTable
                onOpenWatchlistPeriod={props.onOpenWatchlistPeriod}
                onResizePointerDown={props.onResizeWatchlistPointerDown}
                onResetHeight={props.onResetWatchlistHeight}
                onSelectSymbol={props.onSelectSymbol}
                onToggleRealtime={props.onToggleRealtime}
                selectedStoreTableKey={selectedStoreTableKey}
                selectedSymbol={selectedSymbol}
                watchlistAggregatedPeriods={watchlistAggregatedPeriods}
                watchlistDirectPeriods={watchlistDirectPeriods}
                watchlistLastTickAt={watchlistLastTickAt}
                watchlistRealtimeEnabled={watchlistRealtimeEnabled}
                watchlistRealtimeLog={watchlistRealtimeLog}
                watchlistRealtimeReady={watchlistRealtimeReady}
                watchlistRealtimeStatus={watchlistRealtimeStatus}
                watchlistRows={watchlistRows}
                watchlistTableHeight={watchlistTableHeight}
                watchlistTicks={watchlistTicks}
              />
            )}
          </section>
        )}
      </section>
    </div>
  )
}

function DiagnosticsStrip({ diagnostics, runtime }: { diagnostics: Mt5DiagnosticsPayload | null; runtime: RuntimeObservabilityPayload | null }) {
  const active = runtime?.activeOperations?.map((item) => `${item.symbol}:${item.operation}`).join(', ') || 'none'
  return (
    <div className="ff-store-status-line" aria-label="Bridge diagnostics">
      <span>Bridge: {runtime?.ok ? 'online' : 'checking'}</span>
      <span>MT5: {diagnostics ? diagnostics.status : 'checking'}</span>
      <span>Active: {active}</span>
      {diagnostics?.error && <span>{diagnostics.error}</span>}
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
