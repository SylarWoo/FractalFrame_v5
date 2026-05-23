export function formatOverlayPrice(value: number, pricePrecision: number, thousandsSeparator: string) {
  const precision = Number.isFinite(pricePrecision) ? Math.max(0, Math.min(Math.round(pricePrecision), 10)) : 2
  const fixed = value.toFixed(precision)
  const [integer, decimal] = fixed.split('.')
  const grouped = thousandsSeparator
    ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator)
    : integer
  return decimal == null ? grouped : `${grouped}.${decimal}`
}

export function resolveHorizontalLineLabelPrecision(paneId: string | undefined, pricePrecision: number) {
  if (paneId === 'macd_pane' || paneId === 'vi_pane') return 4
  if (paneId === 'rsi_pane' || paneId === 'stoch_pane' || paneId === 'tsi_pane') return 2
  return pricePrecision
}
