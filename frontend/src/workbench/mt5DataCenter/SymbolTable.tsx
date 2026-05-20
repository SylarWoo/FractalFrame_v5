import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { resolveMt5SymbolDisplay } from '../rightDrawer/mt5SymbolDisplay'
import './SymbolTable.css'

export type SymbolTableColumnKey = 'symbol' | 'name' | 'type'

type SymbolTableColumnWidths = Record<SymbolTableColumnKey, number>

type SymbolTableProps = {
  columnWidths: SymbolTableColumnWidths
  loading: boolean
  onColumnResizePointerDown: (event: ReactPointerEvent<HTMLSpanElement>, column: SymbolTableColumnKey) => void
  onResetColumnWidth: (column: SymbolTableColumnKey) => void
  onSelectSymbol: (symbol: string) => void
  selectedSymbol: string
  tableWrapRef: RefObject<HTMLDivElement | null>
  visibleSymbols: Mt5SymbolRow[]
}

export function SymbolTable({
  columnWidths,
  loading,
  onColumnResizePointerDown,
  onResetColumnWidth,
  onSelectSymbol,
  selectedSymbol,
  tableWrapRef,
  visibleSymbols,
}: SymbolTableProps) {
  return (
    <div className="ff-symbol-table-wrap" ref={tableWrapRef}>
      <table className="ff-symbol-table">
        <colgroup>
          <col style={{ width: `${columnWidths.symbol}px` }} />
          <col style={{ width: `${columnWidths.name}px` }} />
          <col style={{ width: `${columnWidths.type}px` }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>
              {'\u4ea4\u6613\u54c1\u79cd'}
              <span
                className="ff-symbol-table__column-resizer"
                onDoubleClick={() => onResetColumnWidth('symbol')}
                onPointerDown={(event) => onColumnResizePointerDown(event, 'symbol')}
              />
            </th>
            <th>
              {'\u4e2d\u6587\u540d\u79f0'}
              <span
                className="ff-symbol-table__column-resizer"
                onDoubleClick={() => onResetColumnWidth('name')}
                onPointerDown={(event) => onColumnResizePointerDown(event, 'name')}
              />
            </th>
            <th>
              {'\u7c7b\u578b'}
              <span
                className="ff-symbol-table__column-resizer"
                onDoubleClick={() => onResetColumnWidth('type')}
                onPointerDown={(event) => onColumnResizePointerDown(event, 'type')}
              />
            </th>
            <th>
              {'\u63cf\u8ff0'}
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleSymbols.map((row) => {
            const display = resolveMt5SymbolDisplay(row)
            return (
              <tr
                data-selected={selectedSymbol === row.symbol}
                key={row.symbol}
                onClick={() => onSelectSymbol(row.symbol)}
                tabIndex={0}
              >
                <td title={row.symbol}>{row.symbol}</td>
                <td title={display.chineseName}>{display.chineseName}</td>
                <td title={display.assetType}>{display.assetType}</td>
                <td title={display.description || row.description || row.name || row.path || '-'}>
                  {display.description || row.description || row.name || row.path || '-'}
                </td>
              </tr>
            )
          })}
          {!visibleSymbols.length && (
            <tr>
              <td className="ff-symbol-table__empty" colSpan={4}>
                {loading ? 'Scanning MT5 symbols...' : 'No symbols. Click Scan MT5.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
