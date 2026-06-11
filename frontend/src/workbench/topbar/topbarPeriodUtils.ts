import { readJson } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import { normalizePeriodForUi, periodToStoreTimeframe } from '../mt5DataCenter/storeV6StatusFormat'

export type StoreV6StatusSnapshot = {
  directM1?: {
    rowsCount?: number | null
    trueM1RowsCount?: number | null
  } | null
  rawDirectM1?: {
    rowsCount?: number | null
    rawRowsCount?: number | null
  } | null
  aggregated?: Array<{
    timeframe?: string
    rowsCount?: number | null
  }>
}

export type PeriodOption = {
  period: string
  rowsCount?: number | null
}

export const periodOrder = ['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN']

function resolveDirectM1Rows(status: StoreV6StatusSnapshot | null) {
  return status?.directM1?.rowsCount
    ?? status?.directM1?.trueM1RowsCount
    ?? status?.rawDirectM1?.rowsCount
    ?? status?.rawDirectM1?.rawRowsCount
    ?? null
}

export function readShortcutPeriods() {
  const stored = readJson<unknown>(storageKeys.importCenterShortcutMenuPeriods, [])
  const rows = Array.isArray(stored)
    ? stored
    : stored && typeof stored === 'object'
      ? Object.values(stored as Record<string, PeriodOption[]>).find((item) => Array.isArray(item)) ?? []
      : []
  return rows
    .filter((row) => typeof row?.period === 'string' && row.period.trim())
    .map((row) => ({
      period: normalizePeriodForUi(row.period),
      rowsCount: row.rowsCount ?? null,
    }))
}

export function readPeriodsForSymbol(symbol: string) {
  const statuses = readJson<Record<string, StoreV6StatusSnapshot>>(storageKeys.importCenterStoreV6Status, {})
  const status = statuses?.[symbol] ?? null
  const savedPeriods = readShortcutPeriods()
  const directRows = resolveDirectM1Rows(status)
  const direct: PeriodOption[] =
    typeof directRows === 'number' && Number.isFinite(directRows) && directRows > 0
      ? [{ period: 'M1', rowsCount: directRows }]
      : []

  const cellsByPeriod = new Map(
    (status?.aggregated ?? [])
      .filter((cell) => typeof cell.timeframe === 'string')
      .map((cell) => [normalizePeriodForUi(String(cell.timeframe)), cell]),
  )
  const aggregate = periodOrder.filter((period) => period !== 'M1').flatMap((period) => {
    const rowsCount = cellsByPeriod.get(period)?.rowsCount
    if (typeof rowsCount !== 'number' || !Number.isFinite(rowsCount) || rowsCount <= 0) return []
    return [{ period, rowsCount }]
  })

  const merged = new Map<string, PeriodOption>()
  for (const option of [...direct, ...aggregate]) merged.set(option.period, option)
  for (const option of savedPeriods) merged.set(option.period, option)
  return periodOrder.flatMap((period) => {
    const option = merged.get(period)
    return option ? [option] : []
  })
}

export function readShortcutMenuPeriods() {
  const savedPeriods = readShortcutPeriods()
  return periodOrder.flatMap((period) => {
    const option = savedPeriods.find((item) => item.period === period)
    return option ? [option] : []
  })
}

export function resolveShortcutActivePeriod(activePeriod: string, periods: PeriodOption[]) {
  return periods.some((item) => item.period === activePeriod)
    ? activePeriod
    : periods[0]?.period ?? activePeriod
}

export function periodToChartPeriod(period: string) {
  return periodToStoreTimeframe(period)
}
