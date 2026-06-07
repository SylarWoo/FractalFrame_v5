export type PageIdentitySource = {
  fromGlobalIndex?: number | null
  index: number
  timeFrom?: number | null
  timeTo?: number | null
  toGlobalIndex?: number | null
}

function finiteInteger(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}

export function createPageIdentity(page: PageIdentitySource | null | undefined, symbol: string, period: string) {
  if (!page) return null
  const normalizedSymbol = symbol.trim()
  const normalizedPeriod = period.trim().toUpperCase()
  const pageIndex = finiteInteger(page.index)
  if (!normalizedSymbol || !normalizedPeriod || pageIndex == null) return null

  const timeFrom = finiteInteger(page.timeFrom)
  const timeTo = finiteInteger(page.timeTo)
  if (timeFrom != null && timeTo != null) {
    return [normalizedSymbol, normalizedPeriod, pageIndex, 'time', timeFrom, timeTo].join('|')
  }

  const fromGlobalIndex = finiteInteger(page.fromGlobalIndex)
  const toGlobalIndex = finiteInteger(page.toGlobalIndex)
  if (fromGlobalIndex != null && toGlobalIndex != null) {
    return [normalizedSymbol, normalizedPeriod, pageIndex, 'rows', fromGlobalIndex, toGlobalIndex].join('|')
  }

  return null
}
