import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import type {
  Mt5M1CheckJobPayload,
  StoreV6AggregateJobPayload,
  StoreV6CheckPayload,
  StoreV6PullJobPayload,
} from '../../services/mt5/mt5SymbolsApi'
import {
  formatCheckTime,
  formatCount,
  formatUtcRange,
} from './storeV6StatusFormat'
import type { StoreTableRow } from './storeV6StatusFormat'
import { readString, writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import './StoreV6Panel.css'

const storeV6AggregatePeriods = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']

type StoreOperationProgress = {
  hasEstimate: boolean
  width: number
}

type StoreV6PanelProps = {
  aggregateProgress: StoreV6AggregateJobPayload | null
  canAggregateStoreV6: boolean
  localStoreStatus: StoreV6CheckPayload | null
  m1CheckJob: Mt5M1CheckJobPayload | null
  mt5M1LastCheckedAt: string
  onAggregateStore: () => void
  onCancelAggregateStore: () => void
  onCancelMt5M1Check: () => void
  onCancelPullStore: () => void
  onCheckMt5M1Staged: () => void
  onCleanLocalM1: () => void
  onDeleteLocalStore: () => void
  onDeleteSelectedAggregates: () => void
  onOpenStoreTableRow: (row: StoreTableRow) => void
  onPullStore: () => void
  onRefreshStoreStatus: () => void
  onRepairM1Gaps: () => void
  onToggleAggregatePeriod: (period: string) => void
  onToggleAllAggregatePeriods: () => void
  onToggleStorePanelPersistence: (enabled: boolean) => void
  pullProgress: StoreV6PullJobPayload | null
  selectedAggregatePeriods: string[]
  selectedStoreTableKey: string
  selectedStoreTableKeyIsVisible: boolean
  storeCheck: StoreV6CheckPayload | null
  storeCheckError: string
  storeCheckLoading: boolean
  storeOperationLine: string
  storeOperationProgress: StoreOperationProgress | null
  storePanelPersistenceEnabled: boolean
  storeTableAggregatePeriods: string[]
  visibleStoreTableRows: StoreTableRow[]
}

const defaultStoreAggregateTableHeight = 228
const minStoreAggregateTableHeight = 96
const maxStoreAggregateTableHeight = 520

function readStoreAggregateTableHeight() {
  const parsed = Number(readString(storageKeys.importCenterStoreAggregateTableHeightPx))
  return Number.isFinite(parsed)
    ? Math.max(minStoreAggregateTableHeight, Math.min(Math.round(parsed), maxStoreAggregateTableHeight))
    : defaultStoreAggregateTableHeight
}

export function StoreV6Panel({
  aggregateProgress,
  localStoreStatus,
  mt5M1LastCheckedAt,
  onAggregateStore,
  onCancelAggregateStore,
  onCancelPullStore,
  onOpenStoreTableRow,
  onPullStore,
  pullProgress,
  selectedStoreTableKey,
  storeCheck,
  storeCheckError,
  storeCheckLoading,
  storeOperationLine,
  storeOperationProgress,
  storeTableAggregatePeriods,
  visibleStoreTableRows,
}: StoreV6PanelProps) {
  const [aggregateTableHeight, setAggregateTableHeight] = useState(readStoreAggregateTableHeight)
  const isPullingStoreV6 = storeCheckLoading && pullProgress != null
  const isAggregatingStoreV6 = storeCheckLoading && aggregateProgress != null
  const directM1 = localStoreStatus?.directM1 ?? storeCheck?.directM1 ?? null
  const rawM1 = localStoreStatus?.rawDirectM1 ?? storeCheck?.rawDirectM1 ?? null
  const mt5RowsCount = rawM1?.mt5RowsCount ?? directM1?.mt5RowsCount ?? null
  const warehouseRowsCount = directM1?.rowsCount ?? null
  const liveLag = localStoreStatus?.liveLag ?? storeCheck?.liveLag ?? null
  const lagBars = typeof liveLag?.lagM1Bars === 'number' && Number.isFinite(liveLag.lagM1Bars)
    ? liveLag.lagM1Bars
    : null
  const liveLagText = liveLag?.ok
    ? `MT5 最新：${liveLag.mt5LatestM1TimeText ?? '-'}；仓库尾部：${liveLag.storeLastM1TimeText ?? '-'}；落后 ${formatCount(lagBars)} 根 M1`
    : liveLag?.status
      ? `实时差距检查：${liveLag.status}${liveLag.error ? `：${liveLag.error}` : ''}`
      : ''
  const rangeText = directM1
    ? formatUtcRange(directM1.firstTimeText, directM1.lastTimeText)
    : '-'
  const lastUpdatedText = directM1?.lastImportAt
    ? formatCheckTime(directM1.lastImportAt)
    : mt5M1LastCheckedAt
      ? formatCheckTime(mt5M1LastCheckedAt)
      : '-'
  const aggregatePeriods = storeV6AggregatePeriods.filter((period) => (
    storeTableAggregatePeriods.length === 0 || storeTableAggregatePeriods.includes(period)
  ))
  const aggregateRowsByPeriod = new Map(
    visibleStoreTableRows
      .filter((row) => row.kind === 'aggregate' && aggregatePeriods.includes(row.period))
      .map((row) => [row.period, row]),
  )

  const startResizeAggregateTable = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = aggregateTableHeight
    const drawer = event.currentTarget.closest('.ff-right-drawer')
    const tableWrap = event.currentTarget.previousElementSibling as HTMLElement | null
    const drawerBottom = drawer?.getBoundingClientRect().bottom ?? window.innerHeight
    const tableTop = tableWrap?.getBoundingClientRect().top ?? event.clientY
    const maxHeight = Math.max(minStoreAggregateTableHeight, Math.min(maxStoreAggregateTableHeight, Math.round(drawerBottom - tableTop - 86)))
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-store-aggregate-table-resizing', 'true')
    handle.setAttribute('data-dragging', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY
      const next = Math.max(minStoreAggregateTableHeight, Math.min(maxHeight, Math.round(startHeight + deltaY)))
      setAggregateTableHeight(next)
      try {
        writeString(storageKeys.importCenterStoreAggregateTableHeightPx, String(next))
      } catch {
        // Store aggregate list height persistence is best-effort only.
      }
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-store-aggregate-table-resizing')
      handle.removeAttribute('data-dragging')
      handle.releasePointerCapture(upEvent.pointerId)
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  return (
    <div className="ff-import-store-panel" role="tabpanel">
      <section className="ff-store-card ff-store-card--direct">
        <div className="ff-store-direct-summary">
          <strong>本地仓库 M1</strong>
          <span>MT5 条数：{formatCount(mt5RowsCount)}</span>
          <span>仓库条数：{formatCount(warehouseRowsCount)}</span>
          <span>范围：{rangeText}</span>
          <span>最后更新时间：{lastUpdatedText}</span>
          {liveLagText && (
            <span className={lagBars && lagBars > 0 ? 'ff-store-direct-summary__warning' : undefined}>{liveLagText}</span>
          )}
          {storeCheckError && (
            <span className="ff-store-direct-summary__error">{storeCheckError}</span>
          )}
        </div>
      </section>

      <section className="ff-store-aggregate-list" aria-label="聚合周期列表" style={{ height: `${aggregateTableHeight}px` }}>
        <table className="right-widget-drawer__table ff-indicators-table-v1 ff-store-aggregate-table">
          <thead>
            <tr>
              <th>周期</th>
              <th>仓库条数</th>
              <th>最后时间</th>
            </tr>
          </thead>
          <tbody>
            {aggregatePeriods.map((period) => {
              const row = aggregateRowsByPeriod.get(period) ?? {
                period,
                count: '-',
                updated: '-',
                kind: 'aggregate' as const,
                rowsCount: null,
              }
              return (
                <tr
                  data-selected={selectedStoreTableKey === `${row.kind}-${row.period}`}
                  key={period}
                  onClick={() => onOpenStoreTableRow(row)}
                  tabIndex={0}
                >
                  <td>{period}</td>
                  <td>{row.count}</td>
                  <td>{row.updated}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
      <div
        className="ff-store-aggregate-list-splitter"
        onDoubleClick={() => {
          setAggregateTableHeight(defaultStoreAggregateTableHeight)
          writeString(storageKeys.importCenterStoreAggregateTableHeightPx, String(defaultStoreAggregateTableHeight))
        }}
        onPointerDown={startResizeAggregateTable}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize aggregate table"
        tabIndex={0}
      />

      {storeOperationLine && (
        <div className="ff-store-status-line">
          <div className="ff-store-status-line__row">
            <span>{storeOperationLine}</span>
            {(pullProgress || aggregateProgress) && (
              <button onClick={pullProgress ? onCancelPullStore : onCancelAggregateStore} type="button">停止</button>
            )}
          </div>
          {storeOperationProgress && (
            <div
              className="ff-store-status-line__bar"
              data-estimated={storeOperationProgress.hasEstimate}
              aria-hidden="true"
            >
              <span style={{ width: `${storeOperationProgress.width}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="ff-store-direct-actions">
        <button disabled={storeCheckLoading} onClick={onPullStore} type="button">
          {isPullingStoreV6 ? '拉取中' : '拉取'}
        </button>
        <button
          disabled={storeCheckLoading}
          onClick={onAggregateStore}
          type="button"
        >
          {isAggregatingStoreV6 ? '聚合中' : '聚合'}
        </button>
      </div>
    </div>
  )
}
