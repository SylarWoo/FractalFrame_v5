import type { KLineData } from 'klinecharts'

export type BarIdentityKLineData = KLineData & {
  barKey?: string
}

export function createBarKey(symbol: string, timeframe: string, timeSeconds: number) {
  return `${symbol}|${timeframe}|${timeSeconds}`
}

export function getKLineTimeSeconds(row: KLineData) {
  return Math.floor(Number(row.timestamp) / 1000)
}

export function assignBarKey(row: KLineData, symbol: string, timeframe: string) {
  const rowWithKey = row as BarIdentityKLineData
  const time = getKLineTimeSeconds(row)
  const barKey = createBarKey(symbol, timeframe, time)
  rowWithKey.barKey = barKey
  return barKey
}

export function createBarIndexResolver(rows: KLineData[]) {
  const rowIndexByBarKey = new Map<string, number>()
  const rowIndexByTime = new Map<number, number>()

  rows.forEach((row, index) => {
    const rowWithKey = row as BarIdentityKLineData
    const time = getKLineTimeSeconds(row)
    if (typeof rowWithKey.barKey === 'string' && rowWithKey.barKey.trim()) {
      rowIndexByBarKey.set(rowWithKey.barKey, index)
    }
    if (Number.isFinite(time)) rowIndexByTime.set(time, index)
  })

  return (barKeyValue: unknown, timeValue: unknown, indexValue: unknown) => {
    if (typeof barKeyValue === 'string' && barKeyValue.trim()) {
      const indexFromBarKey = rowIndexByBarKey.get(barKeyValue)
      if (indexFromBarKey != null) return indexFromBarKey
    }
    const time = Math.floor(Number(timeValue))
    const indexFromTime = Number.isFinite(time) ? rowIndexByTime.get(time) : undefined
    if (indexFromTime != null) return indexFromTime
    const index = Math.round(Number(indexValue))
    return Number.isFinite(index) && index >= 0 && index < rows.length ? index : -1
  }
}
