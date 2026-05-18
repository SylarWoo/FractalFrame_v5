import { useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import './RightDrawer.css'
import { resolveMt5SymbolDisplay } from './mt5SymbolDisplay'
import { fetchMt5Symbols } from './mt5SymbolsApi'
import type { Mt5SymbolRow } from './mt5SymbolsApi'

type RightDrawerProps = {
  drawerWidth: number
  open: boolean
  onClose: () => void
  onResize: (width: number) => void
  onToggle: () => void
}

const minDrawerWidth = 220
const maxDrawerWidth = 900
const splitHeightStorageKey = 'fractalframe:mt5ImportCenterTopPaneHeightPx:v1'
const columnWidthsStorageKey = 'fractalframe:mt5ImportCenterColumnWidthsPx:v1'
const symbolSnapshotStorageKey = 'fractalframe:mt5ImportCenterSymbolSnapshot:v1'

const defaultColumnWidths = {
  symbol: 96,
  name: 126,
  type: 64,
}

type ColumnKey = keyof typeof defaultColumnWidths
type SelectedPanelTab = 'details' | 'store' | 'watchlist' | 'settings'
type DetailRow =
  | readonly [string, string | number | boolean | null | undefined, string, string | number | boolean | null | undefined]
  | readonly [string, string | number | boolean | null | undefined]

type SymbolSnapshot = {
  selectedSymbol: string
  status: string
  symbols: Mt5SymbolRow[]
  savedAt: string
}

const selectedPanelTabs: Array<{ key: SelectedPanelTab; label: string }> = [
  { key: 'details', label: '细节' },
  { key: 'store', label: '仓库' },
  { key: 'watchlist', label: '自选列表' },
  { key: 'settings', label: '设置' },
]

const storeAggregateRows = [
  { period: 'M5', count: '249,715', updated: '1 分钟前' },
  { period: 'M15', count: '83,238', updated: '1 分钟前' },
  { period: 'M30', count: '41,612', updated: '1 分钟前' },
  { period: 'H1', count: '20,806', updated: '1 分钟前' },
  { period: 'H2', count: '10,403', updated: '1 分钟前' },
  { period: 'H4', count: '5,202', updated: '1 分钟前' },
  { period: 'H8', count: '2,601', updated: '1 分钟前' },
  { period: 'D1', count: '138', updated: '1 分钟前' },
  { period: 'W1', count: '28', updated: '1 分钟前' },
  { period: 'MN1', count: '7', updated: '1 分钟前' },
]

function clampDrawerWidth(width: number) {
  return Math.max(minDrawerWidth, Math.min(maxDrawerWidth, Math.round(width)))
}

function getInitialTopPaneHeight() {
  const fallbackHeight = 430

  try {
    const raw = window.localStorage.getItem(splitHeightStorageKey)
    const value = raw == null ? fallbackHeight : Number(raw)
    return Math.max(180, Math.min(760, Math.round(value)))
  } catch {
    return fallbackHeight
  }
}

function getInitialColumnWidths() {
  try {
    const raw = window.localStorage.getItem(columnWidthsStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return defaultColumnWidths
    return {
      symbol: clampColumnWidth(Number(parsed.symbol), 'symbol'),
      name: clampColumnWidth(Number(parsed.name), 'name'),
      type: clampColumnWidth(Number(parsed.type), 'type'),
    }
  } catch {
    return defaultColumnWidths
  }
}

function getInitialSymbolSnapshot(): SymbolSnapshot | null {
  try {
    const raw = window.localStorage.getItem(symbolSnapshotStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.symbols)) return null

    return {
      selectedSymbol: typeof parsed.selectedSymbol === 'string' ? parsed.selectedSymbol : '',
      status: typeof parsed.status === 'string' ? parsed.status : '',
      symbols: parsed.symbols,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    }
  } catch {
    return null
  }
}

function saveSymbolSnapshot(snapshot: Omit<SymbolSnapshot, 'savedAt'>) {
  try {
    window.localStorage.setItem(
      symbolSnapshotStorageKey,
      JSON.stringify({ ...snapshot, savedAt: new Date().toISOString() }),
    )
  } catch {
    // Symbol persistence is best-effort only.
  }
}

function formatSymbolStatus(totalCount: number, visibleCount: number, merge?: { added?: number; updated?: number }) {
  return `共 ${totalCount} 个品种，本地已保存，刷新后自动恢复（当前显示 ${visibleCount} 个）`
    + (merge ? ` · 新增 ${merge.added ?? 0}，更新 ${merge.updated ?? 0}` : '')
}

function normalizeStoredStatus(status: string, symbolCount: number) {
  if (
    !status
    || status.includes('symbol(s)')
    || status.includes('stored locally')
    || status.includes('viewport renders')
    || status.includes('added')
    || /^[\x00-\x7F\s.,;:()/-]+$/.test(status)
  ) {
    return symbolCount ? formatSymbolStatus(symbolCount, symbolCount) : '点击 Scan MT5 加载品种列表。'
  }
  return status
}

function formatDetailValue(value: string | number | boolean | null | undefined) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function selectedDetailRows(row: Mt5SymbolRow): DetailRow[] {
  return [
    ['分类', row.category || row.market, '小数位', row.digits],
    ['合约量', row.tradeContractSize, '点差', row.spreadFloat ? '浮动' : row.spread],
    ['停损级别', row.tradeStopsLevel, '预付款货币', row.currencyMargin],
    ['盈利货币', row.currencyProfit, '基础货币', row.currencyBase],
    ['计算', row.tradeCalcMode, '图表模式', row.tradeMode],
    ['交易模式', row.tradeMode, '执行模式', row.tradeCalcMode],
    ['最小手数', row.volumeMin, '最大手数', row.volumeMax],
    ['手数步进', row.volumeStep, 'Tick Size', row.tradeTickSize],
    ['Tick Value', row.tradeTickValue, '可见', row.visible],
    ['路径', row.path],
  ]
}

function clampColumnWidth(width: number, column: ColumnKey) {
  const minByColumn: Record<ColumnKey, number> = {
    symbol: 46,
    name: 52,
    type: 40,
  }
  const maxByColumn: Record<ColumnKey, number> = {
    symbol: 180,
    name: 260,
    type: 140,
  }
  const fallback = defaultColumnWidths[column]
  const value = Number.isFinite(width) ? width : fallback
  return Math.max(minByColumn[column], Math.min(maxByColumn[column], Math.round(value)))
}

export function RightDrawer({
  drawerWidth,
  open,
  onClose,
  onResize,
  onToggle,
}: RightDrawerProps) {
  const initialSnapshot = useMemo(getInitialSymbolSnapshot, [])
  const [query, setQuery] = useState('')
  const [symbols, setSymbols] = useState<Mt5SymbolRow[]>(() => initialSnapshot?.symbols ?? [])
  const [selectedSymbol, setSelectedSymbol] = useState(() => initialSnapshot?.selectedSymbol ?? '')
  const [status, setStatus] = useState(
    () => normalizeStoredStatus(initialSnapshot?.status ?? '', initialSnapshot?.symbols.length ?? 0),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topPaneHeight, setTopPaneHeight] = useState(getInitialTopPaneHeight)
  const [columnWidths, setColumnWidths] = useState(getInitialColumnWidths)
  const [selectedPanelTab, setSelectedPanelTab] = useState<SelectedPanelTab>('details')
  const tableWrapRef = useRef<HTMLDivElement | null>(null)

  const visibleSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return symbols
    return symbols.filter((row) => {
      const display = resolveMt5SymbolDisplay(row)
      return [
        row.symbol,
        row.name,
        row.description,
        row.path,
        row.category,
        display.chineseName,
        display.assetType,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [query, symbols])

  const selectedRow = useMemo(() => {
    return symbols.find((row) => row.symbol === selectedSymbol) ?? visibleSymbols[0] ?? null
  }, [selectedSymbol, symbols, visibleSymbols])

  const selectedDisplay = selectedRow ? resolveMt5SymbolDisplay(selectedRow) : null

  async function loadSymbols(refresh: boolean) {
    setLoading(true)
    setError('')
    setStatus(refresh ? '正在扫描 MT5 品种...' : '正在读取 MT5 品种缓存...')

    try {
      const payload = await fetchMt5Symbols({ limit: 50000, refresh })
      const rows = Array.isArray(payload.symbols) ? payload.symbols : []
      const merge = payload.scanReport ?? payload.cache?.lastScanReport
      const nextSelectedSymbol =
        selectedSymbol && rows.some((row) => row.symbol === selectedSymbol)
          ? selectedSymbol
          : rows[0]?.symbol ?? ''
      const nextStatus = formatSymbolStatus(
        payload.totalCount ?? payload.count ?? rows.length,
        rows.length,
        merge,
      )

      setSymbols(rows)
      setSelectedSymbol(nextSelectedSymbol)
      setStatus(nextStatus)
      saveSymbolSnapshot({
        selectedSymbol: nextSelectedSymbol,
        status: nextStatus,
        symbols: rows,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSymbols([])
      setSelectedSymbol('')
      setError(message)
      setStatus(`扫描失败：${message}`)
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = drawerWidth
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      onResize(clampDrawerWidth(startWidth - deltaX))
      window.dispatchEvent(new Event('resize'))
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
      window.dispatchEvent(new Event('resize'))
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = topPaneHeight
    const drawer = event.currentTarget.closest('.ff-right-drawer')
    const maxHeight = Math.max(220, (drawer?.clientHeight ?? 760) - 190)
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-splitting', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      const next = Math.max(180, Math.min(maxHeight, Math.round(startHeight + deltaY)))
      setTopPaneHeight(next)
      try {
        window.localStorage.setItem(splitHeightStorageKey, String(next))
      } catch {
        // Split persistence is best-effort only.
      }
    }

    const finishSplit = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishSplit)
      ownerDocument.removeEventListener('pointercancel', finishSplit)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-splitting')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishSplit)
    ownerDocument.addEventListener('pointercancel', finishSplit)
  }

  function handleColumnResizePointerDown(
    event: ReactPointerEvent<HTMLSpanElement>,
    column: ColumnKey,
  ) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const tableWrap = tableWrapRef.current
    const tableWidth = tableWrap?.clientWidth ?? 0
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-mt5-column-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      setColumnWidths((current) => {
        const otherColumnsWidth = Object.entries(current).reduce((sum, [key, value]) => {
          return key === column ? sum : sum + value
        }, 0)
        const maxToKeepTableFilled = Math.max(
          defaultColumnWidths[column],
          tableWidth - otherColumnsWidth - 90,
        )
        const next = {
          ...current,
          [column]: Math.min(clampColumnWidth(startWidth + deltaX, column), maxToKeepTableFilled),
        }
        try {
          window.localStorage.setItem(columnWidthsStorageKey, JSON.stringify(next))
        } catch {
          // Column width persistence is best-effort only.
        }
        return next
      })
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-mt5-column-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  function resetColumnWidth(column: ColumnKey) {
    setColumnWidths((current) => {
      const next = { ...current, [column]: defaultColumnWidths[column] }
      try {
        window.localStorage.setItem(columnWidthsStorageKey, JSON.stringify(next))
      } catch {
        // Column width persistence is best-effort only.
      }
      return next
    })
  }

  function handleSelectSymbol(symbol: string) {
    setSelectedSymbol(symbol)
    if (symbols.length) {
      saveSymbolSnapshot({
        selectedSymbol: symbol,
        status,
        symbols,
      })
    }
  }

  return (
    <>
      <div className="ff-right-rail" aria-label="Right toolbar">
        <button
          className="ff-right-rail__button"
          data-active={open}
          onClick={onToggle}
          title="MT5 Import Center"
          type="button"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M43.5,14.9312c0,4.251-8.73,7.6971-19.5,7.6971S4.5,19.1822,4.5,14.9312,13.23,7.234,24,7.234,43.5,10.68,43.5,14.9312Z" />
            <path d="M43.5,23.9991c0,4.251-8.73,7.6971-19.5,7.6971S4.5,28.25,4.5,23.9991" />
            <path d="M43.5,33.0688c0,4.251-8.73,7.6972-19.5,7.6972S4.5,37.32,4.5,33.0688" />
            <path d="M4.5,33.0688v-9.07" />
            <path d="M43.5,33.0688v-9.07" />
            <path d="M43.5,23.9991v-9.07" />
            <path d="M4.5,24V14.93" />
          </svg>
        </button>
      </div>

      <aside
        className="ff-right-drawer"
        data-open={open}
        aria-hidden={!open}
        style={{
          ['--ff-mt5-top-pane-height' as string]: `${topPaneHeight}px`,
        }}
      >
        <div
          className="ff-right-drawer__resize-handle"
          onDoubleClick={() => onResize(280)}
          onPointerDown={handleResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          tabIndex={0}
        />

        <header className="ff-right-drawer__header">
          <h2>MT5 Import Center</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="ff-right-drawer__body">
          <section className="ff-mt5-pane ff-mt5-pane--top">
            <form className="ff-import-toolbar" onSubmit={handleSearch}>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
                value={query}
              />
              <button className="ff-import-toolbar__search" type="submit">Search</button>
              <button disabled={loading} onClick={() => loadSymbols(true)} type="button">
                {loading ? 'Scanning...' : 'Scan MT5'}
              </button>
            </form>

            <div className="ff-import-note" data-error={Boolean(error)}>
              {status}
            </div>

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
                      交易品种
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('symbol')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'symbol')}
                      />
                    </th>
                    <th>
                      中文名称
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('name')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'name')}
                      />
                    </th>
                    <th>
                      类型
                      <span
                        className="ff-symbol-table__column-resizer"
                        onDoubleClick={() => resetColumnWidth('type')}
                        onPointerDown={(event) => handleColumnResizePointerDown(event, 'type')}
                      />
                    </th>
                    <th>
                      描述
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
                        onClick={() => handleSelectSymbol(row.symbol)}
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
                        {loading ? '正在扫描 MT5 品种...' : '暂无品种。请点击 Scan MT5。'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div
            className="ff-mt5-pane-splitter"
            onDoubleClick={() => setTopPaneHeight(430)}
            onPointerDown={handleSplitPointerDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize MT5 panel split"
            tabIndex={0}
          />

          <section className="ff-mt5-pane ff-mt5-pane--bottom" aria-label="MT5 lower workspace">
            {selectedRow && selectedDisplay && (
              <section className="ff-import-selected" aria-label="Selected MT5 symbol">
                <h3>{selectedRow.symbol} · {selectedDisplay.chineseName}</h3>
                <p>{selectedDisplay.assetType}</p>
                <div className="ff-import-selected-tabs" role="tablist" aria-label="MT5 symbol panels">
                  {selectedPanelTabs.map((tab) => (
                    <button
                      aria-selected={selectedPanelTab === tab.key}
                      className="ff-import-selected-tabs__item"
                      data-active={selectedPanelTab === tab.key}
                      key={tab.key}
                      onClick={() => setSelectedPanelTab(tab.key)}
                      role="tab"
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {selectedPanelTab === 'details' && (
                  <div className="ff-import-selected-detail" role="tabpanel">
                    {selectedDetailRows(selectedRow).map(([leftLabel, leftValue, rightLabel, rightValue]) => (
                      <div
                        className="ff-import-selected-detail__row"
                        data-wide={rightLabel == null}
                        key={`${leftLabel}-${rightLabel ?? 'wide'}`}
                      >
                        <span>{leftLabel}</span>
                        {rightLabel == null ? (
                          <strong
                            className="ff-import-selected-detail__wide-value"
                            title={formatDetailValue(leftValue)}
                          >
                            {formatDetailValue(leftValue)}
                          </strong>
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
                )}

                {selectedPanelTab === 'store' && (
                  <div className="ff-import-store-panel" role="tabpanel">
                    <section className="ff-store-card ff-store-card--direct">
                      <div className="ff-store-direct-summary">
                        <strong>直连仓库 M1</strong>
                        <span>MT5 条数：1,248,576</span>
                        <span>真实条数：1,237,652</span>
                        <span>时间范围：2025-01-01 22:00 ~ 2025-05-18 22:00(UTC)</span>
                        <span>本地条数：1,237,652</span>
                      </div>
                    </section>

                    <div className="ff-store-direct-actions">
                      <button type="button">检查</button>
                      <button type="button">拉取</button>
                    </div>

                    <table className="ff-store-detail-table ff-store-aggregate-table">
                      <thead>
                        <tr>
                          <th>周期</th>
                          <th>条数</th>
                          <th>最后更新</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeAggregateRows.map((row) => (
                          <tr key={row.period}>
                            <td>
                              <strong>{row.period}</strong>
                            </td>
                            <td>{row.count}</td>
                            <td>{row.updated}</td>
                            <td>
                              <button title={`重建 ${row.period}`} type="button">↻</button>
                              <button title={`删除 ${row.period}`} type="button">×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="ff-store-direct-actions">
                      <button type="button">检查</button>
                      <button type="button">聚合</button>
                    </div>

                  </div>
                )}
              </section>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}
