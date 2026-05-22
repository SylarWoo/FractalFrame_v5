import type { RsiPrecision } from '../rightDrawer/indicatorPersistence'

const autoIndicatorPrecision = 8

function trimFormattedNumber(value: string) {
  return value.replace(/\.?0+$/, '')
}

export function formatIndicatorValue(value: unknown, precision: RsiPrecision | unknown, fallbackDigits: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '--'
  if (precision !== 'system') {
    const digits = Number(precision)
    const fixedDigits = Number.isFinite(digits)
      ? Math.max(0, Math.min(Math.round(digits), 8))
      : Math.max(0, Math.min(Math.round(fallbackDigits), 8))
    return trimFormattedNumber(number.toFixed(fixedDigits))
  }
  return trimFormattedNumber(number.toFixed(Math.max(0, Math.min(Math.round(fallbackDigits), autoIndicatorPrecision))))
}
