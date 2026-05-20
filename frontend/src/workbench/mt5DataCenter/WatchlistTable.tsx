import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Mt5RealtimeTick, Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { resolveMt5SymbolDisplay } from '../rightDrawer/mt5SymbolDisplay'
import {
  formatMarketChange,
  formatMarketPercent,
  formatMarketPrice,
} from './storeV5StatusFormat'
import type { StoreTableRow } from './storeV5StatusFormat'
import './WatchlistTable.css'

type WatchlistTableProps = {
  onOpenWatchlistPeriod: (row: StoreTableRow) => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onResetHeight: () => void
  onSelectSymbol: (symbol: string) => void
  onToggleRealtime: () => void
  selectedStoreTableKey: string
  selectedSymbol: string
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

export function WatchlistTable({
  onOpenWatchlistPeriod,
  onResizePointerDown,
  onResetHeight,
  onSelectSymbol,
  onToggleRealtime,
  selectedStoreTableKey,
  selectedSymbol,
  watchlistAggregatedPeriods,
  watchlistDirectPeriods,
  watchlistLastTickAt,
  watchlistRealtimeEnabled,
  watchlistRealtimeLog,
  watchlistRealtimeReady,
  watchlistRealtimeStatus,
  watchlistRows,
  watchlistTableHeight,
  watchlistTicks,
}: WatchlistTableProps) {
  return (
    <div className="ff-import-watchlist-panel" role="tabpanel">
      <div
        className="ff-watchlist-table-wrap"
        style={{ height: `${watchlistTableHeight}px` }}
      >
        <table className="ff-watchlist-table" aria-label="Watchlist">
          <thead>
            <tr>
              <th>SYMBOL</th>
              <th>{'\u4e2d\u6587\u540d\u79f0'}</th>
              <th>{'\u8d44\u4ea7\u7c7b\u578b'}</th>
              <th>LAST</th>
              <th>CHG</th>
              <th>CHG%</th>
            </tr>
          </thead>
          <tbody>
            {watchlistRows.map((row) => {
              const display = resolveMt5SymbolDisplay(row)
              const tick = watchlistTicks[row.symbol]
              return (
                <tr
                  data-selected={selectedSymbol === row.symbol}
                  data-realtime={watchlistRealtimeEnabled && tick ? 'true' : 'false'}
                  key={row.symbol}
                  onClick={() => onSelectSymbol(row.symbol)}
                  tabIndex={0}
                >
                  <td title={row.symbol}>{row.symbol}</td>
                  <td title={display.chineseName}>{display.chineseName}</td>
                  <td title={display.assetType}>{display.assetType}</td>
                  <td title={tick?.publishedAt ?? ''}>{formatMarketPrice(tick?.last)}</td>
                  <td data-direction={(tick?.change ?? 0) > 0 ? 'up' : (tick?.change ?? 0) < 0 ? 'down' : 'flat'}>
                    {formatMarketChange(tick?.change)}
                  </td>
                  <td data-direction={(tick?.changePercent ?? 0) > 0 ? 'up' : (tick?.changePercent ?? 0) < 0 ? 'down' : 'flat'}>
                    {formatMarketPercent(tick?.changePercent)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div
        className="ff-watchlist-table-splitter"
        onDoubleClick={onResetHeight}
        onPointerDown={onResizePointerDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize watchlist table"
        tabIndex={0}
      />
      {(watchlistDirectPeriods.length > 0 || watchlistAggregatedPeriods.length > 0) && (
        <div className="ff-watchlist-periods" aria-label="Watchlist available periods">
          {watchlistDirectPeriods.length > 0 && (
            <section className="ff-watchlist-periods__group">
              <h4>Direct source</h4>
              <div className="ff-watchlist-periods__buttons">
                {watchlistDirectPeriods.map((row) => (
                  <button
                    data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                    key={`${row.kind}-${row.period}`}
                    onClick={() => onOpenWatchlistPeriod(row)}
                    title={`${row.period} · ${row.count} rows · ${row.updated}`}
                    type="button"
                  >
                    {row.period}
                  </button>
                ))}
              </div>
            </section>
          )}
          {watchlistAggregatedPeriods.length > 0 && (
            <section className="ff-watchlist-periods__group">
              <h4>Aggregated source</h4>
              <div className="ff-watchlist-periods__buttons">
                {watchlistAggregatedPeriods.map((row) => (
                  <button
                    data-active={selectedStoreTableKey === `${row.kind}-${row.period}`}
                    key={`${row.kind}-${row.period}`}
                    onClick={() => onOpenWatchlistPeriod(row)}
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
      )}
      <div className="ff-watchlist-realtime-controls">
        <button
          className="ff-watchlist-realtime-toggle"
          data-active={watchlistRealtimeEnabled}
          data-ready={watchlistRealtimeReady}
          onClick={onToggleRealtime}
          type="button"
          aria-pressed={watchlistRealtimeEnabled}
        >
          <span>{watchlistRealtimeEnabled && !watchlistRealtimeReady ? 'Syncing' : 'Realtime'}</span>
          <i aria-hidden="true" />
        </button>
        {watchlistRealtimeStatus && (
          <span className="ff-watchlist-realtime-status">
            {watchlistRealtimeStatus || 'Live'}
            {watchlistLastTickAt ? ` · ${watchlistLastTickAt}` : ''}
          </span>
        )}
      </div>
      {watchlistRealtimeLog.length > 0 && (
        <div className="ff-watchlist-realtime-log" aria-label="Realtime sync log">
          <div className="ff-watchlist-realtime-log__title">
            {watchlistRealtimeReady ? 'Realtime Feed' : 'Realtime Sync'}
          </div>
          <div className="ff-watchlist-realtime-log__body">
            {watchlistRealtimeLog.map((line, index) => (
              <div key={`${line}-${index}`}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

