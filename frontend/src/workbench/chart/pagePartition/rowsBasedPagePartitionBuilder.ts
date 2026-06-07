import {
  type StoreV6PagePartition,
  type StoreV6PagePartitionItem,
} from './pagePartitionBuilder'

const rowsBasedLivePageSize = 2_000
const rowsBasedHistoryPageSize = 2_500

function normalizeTotalRows(totalRows: number | null | undefined) {
  if (typeof totalRows !== 'number' || !Number.isFinite(totalRows)) return null
  return Math.max(0, Math.floor(totalRows))
}

export function buildRowsBasedPagePartition(options: {
  historyPageSize?: number
  livePageSize?: number
  period?: string
  symbol?: string
  totalRows?: number | null
}): StoreV6PagePartition {
  const symbol = options.symbol?.trim() ?? ''
  const period = options.period?.trim().toUpperCase() ?? ''
  const livePageSize = Math.max(1, Math.floor(options.livePageSize ?? rowsBasedLivePageSize))
  const historyPageSize = Math.max(1, Math.floor(options.historyPageSize ?? rowsBasedHistoryPageSize))
  const totalRows = normalizeTotalRows(options.totalRows)

  if (!symbol || !period) {
    return {
      historyPageSize,
      livePageSize,
      pages: [],
      period,
      status: 'missing_selection',
      statusText: '请选择交易品种和周期。',
      symbol,
      totalRows,
    }
  }

  if (totalRows == null || totalRows <= 0) {
    return {
      historyPageSize,
      livePageSize,
      pages: [],
      period,
      status: 'empty',
      statusText: '历史数据不够，请先准备 StoreV6 历史数据。',
      symbol,
      totalRows,
    }
  }

  const pages: StoreV6PagePartitionItem[] = []
  const liveRows = Math.min(totalRows, livePageSize)
  const liveFromGlobalIndex = totalRows - liveRows
  const liveToGlobalIndex = totalRows - 1
  pages.push({
    fromGlobalIndex: liveFromGlobalIndex,
    index: 1,
    limit: livePageSize,
    pageType: 'live',
    realtime: true,
    rows: liveRows,
    toGlobalIndex: liveToGlobalIndex,
  })

  let nextHistoryToIndex = liveFromGlobalIndex - 1
  while (nextHistoryToIndex >= 0) {
    const rows = Math.min(historyPageSize, nextHistoryToIndex + 1)
    const fromGlobalIndex = nextHistoryToIndex - rows + 1
    pages.push({
      fromGlobalIndex,
      index: pages.length + 1,
      limit: historyPageSize,
      pageType: 'history',
      realtime: false,
      rows,
      toGlobalIndex: nextHistoryToIndex,
    })
    nextHistoryToIndex = fromGlobalIndex - 1
  }

  return {
    historyPageSize,
    livePageSize,
    pages,
    period,
    status: totalRows < livePageSize ? 'insufficient_rows' : 'ready',
    statusText: totalRows < livePageSize
      ? `历史数据不够，实时页需要 ${livePageSize.toLocaleString('en-US')} 根，请先准备 StoreV6 历史数据。`
      : '历史数据足够，已按 StoreV6 全局索引完成分页。',
    symbol,
    totalRows,
  }
}
