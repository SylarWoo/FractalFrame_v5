import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Mt5RealtimeTick, Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { formatGlobalPrice, formatGlobalPriceDelta } from '../chart/globalPricePrecision'
import { resolveMt5SymbolDisplay } from '../rightDrawer/mt5SymbolDisplay'
import { formatMarketChange, formatMarketPercent } from './storeV6StatusFormat'
import './WatchlistTable.css'

export type WatchlistTableColumnKey = 'symbol' | 'name' | 'assetType' | 'last' | 'change'

type WatchlistTableColumnWidths = Record<WatchlistTableColumnKey, number>

type WatchlistTableProps = {
  columnWidths: WatchlistTableColumnWidths
  onColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: WatchlistTableColumnKey) => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onResetColumnWidth: (column: WatchlistTableColumnKey) => void
  onResetHeight: () => void
  onSelectSymbol: (symbol: string) => void
  selectedSymbol: string
  watchlistRealtimeEnabled: boolean
  watchlistRows: Mt5SymbolRow[]
  watchlistTableHeight: number
  watchlistTableWrapRef: RefObject<HTMLDivElement | null>
  watchlistTicks: Record<string, Mt5RealtimeTick>
}

export function WatchlistTable({
  columnWidths,
  onColumnResizePointerDown,
  onResizePointerDown,
  onResetColumnWidth,
  onResetHeight,
  onSelectSymbol,
  selectedSymbol,
  watchlistRealtimeEnabled,
  watchlistRows,
  watchlistTableHeight,
  watchlistTableWrapRef,
  watchlistTicks,
}: WatchlistTableProps) {
  function renderResizableHeader(label: string, column: WatchlistTableColumnKey) {
    return (
      <th>
        {label}
        <span
          className="ff-watchlist-table__column-resizer"
          onDoubleClick={() => onResetColumnWidth(column)}
          onPointerDown={(event) => onColumnResizePointerDown(event, column)}
        />
      </th>
    )
  }

  return (
    <div className="ff-import-watchlist-panel" role="tabpanel">
      <div
        className="ff-watchlist-table-wrap"
        ref={watchlistTableWrapRef}
        style={{ height: `${watchlistTableHeight}px` }}
      >
        <table className="ff-watchlist-table" aria-label="Watchlist">
          <colgroup>
            <col style={{ width: `${columnWidths.symbol}px` }} />
            <col style={{ width: `${columnWidths.name}px` }} />
            <col style={{ width: `${columnWidths.assetType}px` }} />
            <col style={{ width: `${columnWidths.last}px` }} />
            <col style={{ width: `${columnWidths.change}px` }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              {renderResizableHeader('SYMBOL', 'symbol')}
              {renderResizableHeader('中文名称', 'name')}
              {renderResizableHeader('资产类型', 'assetType')}
              {renderResizableHeader('LAST', 'last')}
              {renderResizableHeader('CHG', 'change')}
              <th>CHG%</th>
            </tr>
          </thead>
          <tbody>
            {watchlistRows.map((row) => {
              const display = resolveMt5SymbolDisplay(row)
              const tick = watchlistTicks[row.symbol]
              const priceContext = { assetType: display.assetType, market: row.market, symbol: row.symbol }
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
                  <td title={tick?.publishedAt ?? ''}>{formatGlobalPrice(tick?.last, '-', priceContext)}</td>
                  <td data-direction={(tick?.change ?? 0) > 0 ? 'up' : (tick?.change ?? 0) < 0 ? 'down' : 'flat'}>
                    {typeof tick?.change === 'number' && Number.isFinite(tick.change) ? `${tick.change > 0 ? '+' : ''}${formatGlobalPriceDelta(Math.abs(tick.change), tick.last, '-', priceContext)}` : formatMarketChange(tick?.change)}
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
    </div>
  )
}
