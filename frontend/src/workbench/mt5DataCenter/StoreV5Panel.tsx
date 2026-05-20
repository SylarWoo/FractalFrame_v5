import type { ChartLoadState } from '../chart/ChartCoreHost'
import type {
  Mt5M1CheckJobPayload,
  StoreV5CheckPayload,
  StoreV5PullJobPayload,
} from '../../services/mt5/mt5SymbolsApi'
import {
  formatChartLoadStatus,
  formatCheckTime,
  formatCount,
  formatUtcRange,
} from './storeV5StatusFormat'
import type { StoreTableRow } from './storeV5StatusFormat'
import './StoreV5Panel.css'

type StoreOperationProgress = {
  hasEstimate: boolean
  width: number
}

type StoreV5PanelProps = {
  canAggregateStoreV5: boolean
  chartJumpError: string
  chartJumpInput: string
  chartLoadState?: ChartLoadState | null
  localStoreStatus: StoreV5CheckPayload | null
  m1CheckJob: Mt5M1CheckJobPayload | null
  mt5M1LastCheckedAt: string
  onAddM1ToStoreList: () => void
  onAggregateStore: () => void
  onCancelMt5M1Check: () => void
  onCancelPullStore: () => void
  onCheckMt5M1Staged: () => void
  onCleanLocalM1: () => void
  onDeleteLocalStore: () => void
  onDeleteSelectedAggregates: () => void
  onJumpChartToTime: () => void
  onLoadChartStep?: (direction: 'left' | 'right') => void
  onOpenStoreTableRow: (row: StoreTableRow) => void
  onPullStore: () => void
  onRefreshStoreStatus: () => void
  onResetChartToLatest: () => void
  onSetChartJumpError: (value: string) => void
  onSetChartJumpInput: (value: string) => void
  onToggleAggregatePeriod: (period: string) => void
  onToggleAllAggregatePeriods: () => void
  onToggleStorePanelPersistence: (enabled: boolean) => void
  pullProgress: StoreV5PullJobPayload | null
  selectedAggregatePeriods: string[]
  selectedStoreTableKey: string
  selectedStoreTableKeyIsVisible: boolean
  storeCheck: StoreV5CheckPayload | null
  storeCheckError: string
  storeCheckLoading: boolean
  storeOperationLine: string
  storeOperationProgress: StoreOperationProgress | null
  storePanelPersistenceEnabled: boolean
  storeTableAggregatePeriods: string[]
  visibleStoreTableRows: StoreTableRow[]
}

export function StoreV5Panel({
  canAggregateStoreV5,
  chartJumpError,
  chartJumpInput,
  chartLoadState,
  localStoreStatus,
  m1CheckJob,
  mt5M1LastCheckedAt,
  onAddM1ToStoreList,
  onAggregateStore,
  onCancelMt5M1Check,
  onCancelPullStore,
  onCheckMt5M1Staged,
  onCleanLocalM1,
  onDeleteLocalStore,
  onDeleteSelectedAggregates,
  onJumpChartToTime,
  onLoadChartStep,
  onOpenStoreTableRow,
  onPullStore,
  onRefreshStoreStatus,
  onResetChartToLatest,
  onSetChartJumpError,
  onSetChartJumpInput,
  onToggleAggregatePeriod,
  onToggleAllAggregatePeriods,
  onToggleStorePanelPersistence,
  pullProgress,
  selectedAggregatePeriods,
  selectedStoreTableKey,
  selectedStoreTableKeyIsVisible,
  storeCheck,
  storeCheckError,
  storeCheckLoading,
  storeOperationLine,
  storeOperationProgress,
  storePanelPersistenceEnabled,
  storeTableAggregatePeriods,
  visibleStoreTableRows,
}: StoreV5PanelProps) {
  const isCheckingMt5M1 = storeCheckLoading && m1CheckJob != null
  const isPullingStoreV5 = storeCheckLoading && pullProgress != null

  return (
    <div className="ff-import-store-panel" role="tabpanel">
      <section className="ff-store-card ff-store-card--direct">
        <label className="ff-store-persistence-toggle">
          <input
            checked={storePanelPersistenceEnabled}
            onChange={(event) => onToggleStorePanelPersistence(event.target.checked)}
            type="checkbox"
          />
          <span>持久化</span>
        </label>
        <div className="ff-store-direct-summary">
          <strong>本地仓库 M1</strong>
          {storeCheck?.directM1 ? (
            <>
              <span>MT5 条数：{formatCount(storeCheck.directM1.mt5RowsCount)}</span>
              <span>真实条数：{formatCount(storeCheck.directM1.trueM1RowsCount)} · 最后检查：{formatCheckTime(mt5M1LastCheckedAt)}</span>
              <span>
                真实 M1 范围：{formatUtcRange(storeCheck.directM1.firstTimeText, storeCheck.directM1.lastTimeText)}
              </span>
              {storeCheck.directM1.validationError && (
                <span className="ff-store-direct-summary__error">
                  校验失败：{storeCheck.directM1.validationError}
                </span>
              )}
            </>
          ) : (
            <>
              <span>MT5 条数：-</span>
              <span>真实条数：-</span>
              <span>真实 M1 范围：-</span>
            </>
          )}
          <span>
            本地 M1 数据：{localStoreStatus?.directM1?.rowsCount != null
              ? `${formatCount(localStoreStatus.directM1.rowsCount)} 条 · 最后更新时间：${formatCheckTime(localStoreStatus.directM1.lastImportAt)}`
              : '无数据'}
          </span>
          {storeCheckError && (
            <span className="ff-store-direct-summary__error">{storeCheckError}</span>
          )}
        </div>
      </section>

      {storeOperationLine && (
        <div className="ff-store-status-line">
          <div className="ff-store-status-line__row">
            <span>{storeOperationLine}</span>
            {m1CheckJob?.jobId && (
              <button onClick={onCancelMt5M1Check} type="button">取消</button>
            )}
            {pullProgress?.jobId && pullProgress.phase !== 'completed' && (
              <button onClick={onCancelPullStore} type="button">取消</button>
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
        <button disabled={storeCheckLoading} onClick={onCheckMt5M1Staged} type="button">
          {isCheckingMt5M1 ? '检查中' : '检查 MT5 数据'}
        </button>
        <button disabled={storeCheckLoading} onClick={onRefreshStoreStatus} type="button">检查本地仓库</button>
        <button disabled={storeCheckLoading} onClick={onPullStore} type="button">
          {isPullingStoreV5 ? '拉取中' : '拉取'}
        </button>
        <button disabled={storeCheckLoading} onClick={onDeleteLocalStore} type="button">删除本地数据</button>
        <button disabled={storeCheckLoading} onClick={onCleanLocalM1} type="button">清理无效 M1</button>
        <button disabled={storeCheckLoading} onClick={onAddM1ToStoreList} type="button">加入列表</button>
      </div>
      <table className="ff-store-detail-table ff-store-aggregate-table">
        <thead>
          <tr>
            <th>周期</th>
            <th>条数</th>
            <th>最后K线</th>
          </tr>
        </thead>
        <tbody>
          {visibleStoreTableRows.map((row) => (
            <tr
              data-selected={selectedStoreTableKeyIsVisible && selectedStoreTableKey === `${row.kind}-${row.period}`}
              key={`${row.kind}-${row.period}`}
              onClick={() => onOpenStoreTableRow(row)}
            >
              <td>
                {row.kind === 'aggregate' ? (
                  <label className="ff-store-period-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      checked={selectedAggregatePeriods.includes(row.period)}
                      disabled={storeCheckLoading}
                      onChange={() => onToggleAggregatePeriod(row.period)}
                      type="checkbox"
                    />
                    <strong>{row.period}</strong>
                  </label>
                ) : (
                  <strong>{row.period}</strong>
                )}
              </td>
              <td>{row.count}</td>
              <td>{row.updated}</td>
            </tr>
          ))}
          {!visibleStoreTableRows.length && (
            <tr>
              <td className="ff-symbol-table__empty" colSpan={3}>
                暂无 StoreV5 聚合周期。请先拉取 M1，再执行聚合。
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="ff-store-direct-actions ff-store-direct-actions--aggregate">
        <button
          data-state={
            selectedAggregatePeriods.length === 0
              ? 'none'
              : selectedAggregatePeriods.length === storeTableAggregatePeriods.length
                ? 'all'
                : 'mixed'
          }
          disabled={storeCheckLoading}
          onClick={onToggleAllAggregatePeriods}
          type="button"
        >
          {selectedAggregatePeriods.length === storeTableAggregatePeriods.length ? '全不选' : '全选'}
        </button>
        <button disabled={storeCheckLoading} onClick={onRefreshStoreStatus} type="button">
          {storeCheckLoading ? '刷新中' : '刷新仓库'}
        </button>
        <button disabled={storeCheckLoading || selectedAggregatePeriods.length === 0} onClick={onDeleteSelectedAggregates} type="button">删除</button>
        <button
          disabled={storeCheckLoading || selectedAggregatePeriods.length === 0}
          onClick={onAggregateStore}
          title={!canAggregateStoreV5 ? '会先自动清理无效 M1，再聚合' : undefined}
          type="button"
        >
          聚合
        </button>
      </div>

      <div className="ff-chart-jump-controls">
        <input
          aria-label="跳转日期时间"
          onChange={(event) => {
            onSetChartJumpInput(event.target.value)
            onSetChartJumpError('')
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onJumpChartToTime()
            }
          }}
          placeholder="YYYY-MM-DD HH:mm"
          type="text"
          value={chartJumpInput}
        />
        <button onClick={onJumpChartToTime} type="button">跳转</button>
        <button onClick={onResetChartToLatest} type="button">回到当前</button>
        <button onClick={() => onLoadChartStep?.('left')} type="button">向左10000</button>
        <button onClick={() => onLoadChartStep?.('right')} type="button">向右10000</button>
        {chartJumpError && <span>{chartJumpError}</span>}
      </div>

      <div className="ff-chart-load-status">
        {formatChartLoadStatus(chartLoadState)}
      </div>
    </div>
  )
}
