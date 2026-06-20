export type DrawingCrossPeriodTarget = 'M5' | 'M30' | 'H2'

export const drawingCrossPeriodTargets: DrawingCrossPeriodTarget[] = ['M5', 'M30', 'H2']
export const crossPeriodDrawingPeriods = new Set<DrawingCrossPeriodTarget>(drawingCrossPeriodTargets)

export function normalizeDrawingPeriod(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase()
}

export function isCrossPeriodDrawingPeriod(value: string | null | undefined) {
  return crossPeriodDrawingPeriods.has(normalizeDrawingPeriod(value) as DrawingCrossPeriodTarget)
}

export function normalizeDrawingCrossPeriodTargets(value: unknown): DrawingCrossPeriodTarget[] {
  if (!Array.isArray(value)) return [...drawingCrossPeriodTargets]
  const targets: DrawingCrossPeriodTarget[] = []
  value.forEach((item) => {
    const period = normalizeDrawingPeriod(typeof item === 'string' ? item : '')
    if (!crossPeriodDrawingPeriods.has(period as DrawingCrossPeriodTarget)) return
    if (!targets.includes(period as DrawingCrossPeriodTarget)) targets.push(period as DrawingCrossPeriodTarget)
  })
  return targets
}

export function isDrawingVisibleForPeriod(options: {
  crossPeriod?: boolean
  crossPeriodTargets?: string[]
  currentPeriod: string
  sourcePeriod?: string
}) {
  const currentPeriod = normalizeDrawingPeriod(options.currentPeriod)
  const sourcePeriod = normalizeDrawingPeriod(options.sourcePeriod)
  if (!sourcePeriod) return true
  if (options.crossPeriod === true) {
    return normalizeDrawingCrossPeriodTargets(options.crossPeriodTargets).includes(currentPeriod as DrawingCrossPeriodTarget)
  }
  return currentPeriod === sourcePeriod
}
