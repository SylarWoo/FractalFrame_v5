import { readBooleanFlag, writeBooleanFlag } from '../persistence/jsonStorage'
import { readPeriodUiState, writePeriodUiState } from '../persistence/periodUiStateStorage'

const quickMeasureEnabledStorageKey = 'fractalframe.drawingsDrawer.quickMeasureEnabled'

export function readQuickMeasureEnabled(period = 'M5') {
  const saved = readPeriodUiState<{ quickMeasureEnabled?: boolean }>('drawings', period, {}).quickMeasureEnabled
  return typeof saved === 'boolean' ? saved : readBooleanFlag(quickMeasureEnabledStorageKey, false)
}

export function writeQuickMeasureEnabled(enabled: boolean, period = 'M5') {
  writePeriodUiState('drawings', period, {
    ...readPeriodUiState<Record<string, unknown>>('drawings', period, {}),
    quickMeasureEnabled: enabled,
  })
  return writeBooleanFlag(quickMeasureEnabledStorageKey, enabled)
}
