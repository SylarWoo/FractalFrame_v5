import { readStoreV6PageSlice } from '../pageSliceV2'
import type {
  StoreV6HistoryPageRequest,
  StoreV6HistoryPageResult,
  StoreV6HistoryPageSliceReader,
} from './historyPageRequestTypes'

export class StoreV6HistoryPageRequestError extends Error {
  readonly code: 'missing_page' | 'missing_selection'

  constructor(message: string, code: 'missing_page' | 'missing_selection') {
    super(message)
    this.code = code
    this.name = 'StoreV6HistoryPageRequestError'
  }
}

function normalizePageIndex(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.round(value))
    : 1
}

function resolveRequestedPage(request: StoreV6HistoryPageRequest) {
  const pageIndex = normalizePageIndex(request.pageIndex)
  return {
    page: request.pages.find((page) => page.index === pageIndex) ?? null,
    pageIndex,
  }
}

function assertSelection(request: StoreV6HistoryPageRequest) {
  if (!request.symbol.trim() || !request.period.trim()) {
    throw new StoreV6HistoryPageRequestError('symbol_and_period_required', 'missing_selection')
  }
}

export async function requestStoreV6HistoryPage(
  request: StoreV6HistoryPageRequest,
  readSlice: StoreV6HistoryPageSliceReader = readStoreV6PageSlice,
): Promise<StoreV6HistoryPageResult> {
  assertSelection(request)
  const { page, pageIndex } = resolveRequestedPage(request)
  if (!page) {
    throw new StoreV6HistoryPageRequestError(`history_page_not_found:${pageIndex}`, 'missing_page')
  }

  const slice = await readSlice({
    lookaheadRows: request.lookaheadRows,
    mode: 'history-page',
    page,
    period: request.period,
    symbol: request.symbol,
    warmupRows: request.warmupRows,
  })

  return {
    page,
    pageIndex,
    slice,
    source: 'store-v6-history-page-request-v2',
    status: 'ready',
  }
}
