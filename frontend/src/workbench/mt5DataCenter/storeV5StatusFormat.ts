import type { ChartLoadState } from '../chart/ChartCoreHost'
import type { Mt5M1CheckJobPayload, Mt5SymbolRow, StoreV5AggregateJobPayload, StoreV5CheckPayload, StoreV5PullJobPayload } from '../../services/mt5/mt5SymbolsApi'

export type StoreTableRow = {
  period: string
  count: string
  updated: string
  kind: 'm1' | 'aggregate'
  rowsCount?: number | null
}

export type DetailRow =
  | readonly [string, string | number | boolean | null | undefined, string, string | number | boolean | null | undefined]
  | readonly [string, string | number | boolean | null | undefined]

export function formatSymbolStatus(totalCount: number, visibleCount: number, merge?: { added?: number; updated?: number }) {
  return `共 ${totalCount} 个品种，本地已保存，刷新后自动恢复（当前显示 ${visibleCount} 个）`
    + (merge ? ` · 新增 ${merge.added ?? 0}，更新 ${merge.updated ?? 0}` : '')
}

export function stripNulCharacters(value: string) {
  return value.split('').filter((char) => char.charCodeAt(0) !== 0).join('')
}

function isAsciiOrWhitespace(value: string) {
  return value.split('').every((char) => char.charCodeAt(0) <= 127 || /\s/.test(char))
}

export function normalizeStoredStatus(status: string, symbolCount: number) {
  const normalizedStatus = stripNulCharacters(status)
  if (
    !normalizedStatus
    || normalizedStatus.includes('symbol(s)')
    || normalizedStatus.includes('stored locally')
    || normalizedStatus.includes('viewport renders')
    || normalizedStatus.includes('added')
    || isAsciiOrWhitespace(normalizedStatus)
  ) {
    return symbolCount ? formatSymbolStatus(symbolCount, symbolCount) : '点击 Scan MT5 加载品种列表。'
  }
  return normalizedStatus
}

export function formatDetailValue(value: string | number | boolean | null | undefined) {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function formatSessionDay(value: string | undefined) {
  return value && value.trim() ? value : '-'
}

function formatSessionPair(row: Mt5SymbolRow, dayIndex: number) {
  const quote = formatSessionDay(row.sessions?.quote?.[dayIndex])
  const trade = formatSessionDay(row.sessions?.trade?.[dayIndex])
  if (quote === trade) return quote
  return `行情 ${quote} / 交易 ${trade}`
}

function formatMt5Bitmask(value: number | null | undefined, labels: Array<[number, string]>) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const selected = labels.filter(([bit]) => (value & bit) === bit).map(([, label]) => label)
  return selected.length ? selected.join('，') : value
}

function formatTradeMode(value: number | null | undefined) {
  if (value === 0) return '禁用'
  if (value === 1) return '只允许多头'
  if (value === 2) return '只允许空头'
  if (value === 3) return '只允许平仓'
  if (value === 4) return '完全访问'
  return value
}

function formatTradeExecution(value: number | null | undefined) {
  if (value === 0) return '请求'
  if (value === 1) return '即时'
  if (value === 2) return '市价'
  if (value === 3) return '交易所'
  return value
}

function formatSwapMode(value: number | null | undefined) {
  if (value === 0) return '禁用'
  if (value === 1) return '点模式'
  if (value === 2) return '货币'
  if (value === 3) return '利息'
  if (value === 4) return '保证金币种'
  return value
}

export function formatCount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '-'
}

export function formatMarketPrice(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US', { maximumFractionDigits: 6 })
    : '-'
}

export function formatMarketChange(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}

export function formatMarketPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

export function formatChartLoadStatus(state: ChartLoadState | null | undefined) {
  if (!state) return '-'
  if (state.loading) return `${state.symbol} ${state.period} 加载中 ${state.requestedRows.toLocaleString()}`
  if (state.error) return `${state.symbol} ${state.period} 加载失败`
  const localRows = typeof state.totalRows === 'number' && Number.isFinite(state.totalRows)
    ? state.totalRows
    : state.requestedRows
  return `${state.symbol} ${state.period} 已进入 ${state.rows.toLocaleString()} / 本地 ${localRows.toLocaleString()}${state.loadingMore ? ' · 加载历史' : ''}`
}

export function formatCountWithWan(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (Math.abs(value) < 10000) return value.toLocaleString('en-US')
  const wan = value / 10000
  return `${value.toLocaleString('en-US')}（${wan.toFixed(wan >= 100 ? 0 : 1)}W）`
}

export function formatCheckTime(value?: string | null) {
  if (!value) return '-'
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return value
  return new Date(time).toLocaleString()
}

export function formatEpochSeconds(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return new Date(value * 1000).toLocaleString()
}

export function parseChartJumpTime(value: string) {
  const normalized = value.trim().replace('T', ' ')
  if (!normalized) return null
  const match = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4] ?? 0)
  const minute = Number(match[5] ?? 0)
  const second = Number(match[6] ?? 0)
  const timestamp = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function resolveLocalM1Rows(status: StoreV5CheckPayload | null) {
  return status?.directM1?.rowsCount
    ?? status?.directM1?.trueM1RowsCount
    ?? status?.rawDirectM1?.rowsCount
    ?? status?.rawDirectM1?.rawRowsCount
    ?? null
}

export function resolveLocalM1LastTime(status: StoreV5CheckPayload | null) {
  return status?.directM1?.lastTime ?? status?.rawDirectM1?.lastTime ?? null
}

export function storeTableKeyForPeriod(period: string, rows: StoreTableRow[] = []) {
  const normalized = period.toUpperCase()
  const visibleRow = rows.find((row) => row.period.toUpperCase() === normalized)
  if (visibleRow) return `${visibleRow.kind}-${visibleRow.period}`
  return normalized === 'M1' ? 'm1-M1' : `aggregate-${normalized}`
}

export function periodFromStoreTableKey(key: string) {
  const parts = key.split('-')
  return (parts[parts.length - 1] || '').toUpperCase()
}

export function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function formatUtcRange(firstText?: string | null, lastText?: string | null) {
  if (!firstText || !lastText) return '-'
  return `${firstText.replace(':00 UTC', '')} ~ ${lastText.replace(':00 UTC', '')} (UTC)`
}

export function formatStoreOperationLine(
  pullJob: StoreV5PullJobPayload | null,
  checkJob: Mt5M1CheckJobPayload | null,
  aggregateProgress: StoreV5AggregateJobPayload | null,
  fallback: string,
) {
  if (pullJob) {
    if (pullJob.progressLabel) return pullJob.progressLabel

    const batchSize = pullJob.fetchChunkSize ?? pullJob.writeBatchSize ?? 200000
    if (pullJob.phase === 'probing' || pullJob.phase === 'queued' || pullJob.phase === 'fetching') {
      return `开始读取 ${formatCountWithWan(batchSize)}，已读取 ${formatCountWithWan(pullJob.rowsFetched)}`
    }
    if (pullJob.phase === 'streaming' || pullJob.phase === 'writing') {
      const currentBatch = pullJob.writeBatchRows ?? batchSize
      return `开始写入 ${formatCountWithWan(currentBatch)}，已写入 ${formatCountWithWan(pullJob.rowsWritten)}`
    }
    if (pullJob.phase === 'checking' || pullJob.phase === 'validating') return '已经写完，开始检查错误字段'
    if (pullJob.phase === 'cleaning') {
      const deleted = pullJob.cleanupDeletedRows != null ? `，已删除 ${formatCountWithWan(pullJob.cleanupDeletedRows)}` : ''
      return `检查完成，删除错误字段${deleted}`
    }
    if (pullJob.phase === 'completed') return '完成，本地 M1 数据已更新'
    if (pullJob.phase === 'cancelled') return '已取消'
    if (pullJob.phase === 'failed') return `失败：${pullJob.error || pullJob.status}`
    return pullJob.status || fallback
  }
  if (checkJob) {
    const batchSize = checkJob.chunkSize ?? 200000
    if (checkJob.phase === 'fetching' || checkJob.phase === 'queued') {
      if (checkJob.currentBatchIndex && checkJob.currentBatchRequested) {
        return `正在读取第 ${checkJob.currentBatchIndex} 批：计划 ${formatCountWithWan(checkJob.currentBatchRequested)}，已读取 ${formatCountWithWan(checkJob.mt5RowsCount)}`
      }
      return `开始读取 ${formatCountWithWan(batchSize)}，已读取 ${formatCountWithWan(checkJob.mt5RowsCount)}`
    }
    if (checkJob.phase === 'validating') return '已经读完，开始检查错误字段'
    if (checkJob.phase === 'completed') return '检查完成'
    if (checkJob.phase === 'cancelled') return '已取消'
    if (checkJob.phase === 'failed') return `失败：${checkJob.error || checkJob.status}`
    return checkJob.status || fallback
  }
  if (aggregateProgress) {
    if (aggregateProgress.progressLabel) return aggregateProgress.progressLabel
    if (aggregateProgress.phase === 'completed') {
      return `聚合完成：${aggregateProgress.periods.join('、')}`
    }
    if (aggregateProgress.phase === 'failed') {
      return `聚合失败：${aggregateProgress.currentPeriod ?? aggregateProgress.periods.join('、')}`
    }
    const current = aggregateProgress.currentPeriod ? `，当前 ${aggregateProgress.currentPeriod}` : ''
    return `正在聚合：${aggregateProgress.completed}/${aggregateProgress.total}${current}`
  }
  return fallback
}

export function resolveStoreOperationProgress(
  pullJob: StoreV5PullJobPayload | null,
  checkJob: Mt5M1CheckJobPayload | null,
  aggregateProgress: StoreV5AggregateJobPayload | null,
) {
  if (pullJob) {
    if (pullJob.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (pullJob.phase === 'failed' || pullJob.phase === 'cancelled') return null
    if (typeof pullJob.progressPercent === 'number') {
      return {
        hasEstimate: true,
        width: Math.max(1, Math.min(99, Math.round(pullJob.progressPercent))),
      }
    }
    if (pullJob.phase === 'writing') {
      const written = typeof pullJob.rowsWritten === 'number' ? pullJob.rowsWritten : 0
      const total = typeof pullJob.trueM1RowsCount === 'number' && pullJob.trueM1RowsCount > 0 ? pullJob.trueM1RowsCount : null
      if (total) return { hasEstimate: true, width: Math.max(1, Math.min(99, Math.round((written / total) * 100))) }
    }
    const fetched = typeof pullJob.rowsFetched === 'number' ? pullJob.rowsFetched : 0
    const total = typeof pullJob.maxCount === 'number' && pullJob.maxCount > 0 ? pullJob.maxCount : null
    if (total) return { hasEstimate: true, width: Math.max(fetched > 0 ? 1 : 0, Math.min(99, Math.round((fetched / total) * 100))) }
    return { hasEstimate: false, width: 45 }
  }
  if (checkJob) {
    if (checkJob.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (checkJob.phase === 'failed' || checkJob.phase === 'cancelled') return null
    if (typeof checkJob.progressPercent === 'number') {
      return { hasEstimate: true, width: Math.max(1, Math.min(99, Math.round(checkJob.progressPercent))) }
    }
    return { hasEstimate: false, width: 45 }
  }
  if (aggregateProgress) {
    if (aggregateProgress.phase === 'completed') return { hasEstimate: true, width: 100 }
    if (aggregateProgress.phase === 'failed') return null
    return {
      hasEstimate: true,
      width: Math.max(4, Math.min(99, Math.round((aggregateProgress.completed / Math.max(1, aggregateProgress.total)) * 100))),
    }
  }
  return null
}

export function selectedDetailRows(row: Mt5SymbolRow): DetailRow[] {
  const spread = row.spreadFloat ? `${formatDetailValue(row.spread)} 浮动` : row.spread
  return [
    ['名称', row.name],
    ['描述', row.description],
    ['分类', row.category || row.source || row.market, '市场', row.market],
    ['小数位', row.digits, '点', row.point],
    ['点差', spread, '止损级别', row.tradeStopsLevel],
    ['合约量', row.tradeContractSize, '计算', row.tradeCalcMode],
    ['基础货币', row.currencyBase, '盈利货币', row.currencyProfit],
    ['预付款货币', row.currencyMargin, '图表模式', row.tradeMode],
    ['交易', formatTradeMode(row.tradeMode), '执行模式', formatTradeExecution(row.tradeExeMode)],
    ['最小量', row.volumeMin, '最大量', row.volumeMax],
    ['步长', row.volumeStep, 'Tick Size', row.tradeTickSize],
    ['Tick Value', row.tradeTickValue, '可见', row.visible],
    ['自定义', row.custom, '选择', row.select],
    ['最新缺失', row.missingFromLatestScan, 'GTC 模式', row.orderGtcMode],
    ['库存费类型', formatSwapMode(row.swapMode), '买入库存费', row.swapLong],
    ['卖出库存费', row.swapShort, '3 日库存费', row.swapRollover3Days],
    ['成交指令', formatMt5Bitmask(row.fillingMode, [[1, 'FOK'], [2, 'IOC'], [4, 'BOC']])],
    ['订单', formatMt5Bitmask(row.orderMode, [[1, '买入'], [2, '卖出'], [4, '买入限价'], [8, '卖出限价'], [16, '买入止损'], [32, '卖出止损'], [64, '止损限价']])],
    ['到期', formatMt5Bitmask(row.expirationMode, [[1, 'GTC'], [2, '日'], [4, '指定'], [8, '指定日']])],
    ['到期时间', row.expirationTime],
    ['交易期间', row.sessionsSource ? `行情 / 交易 · ${row.sessionsSource}` : '未导出'],
    ['时段更新时间', row.sessionsUpdatedAt],
    ['时段文件', row.sessionsPath],
    ['星期日', formatSessionPair(row, 0)],
    ['星期一', formatSessionPair(row, 1)],
    ['星期二', formatSessionPair(row, 2)],
    ['星期三', formatSessionPair(row, 3)],
    ['星期四', formatSessionPair(row, 4)],
    ['星期五', formatSessionPair(row, 5)],
    ['星期六', formatSessionPair(row, 6)],
    ['路径', row.path],
    ['最后扫描', row.lastSeenAt || row.seenAt],
  ]
}


