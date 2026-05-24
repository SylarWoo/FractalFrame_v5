import { readBooleanFlag, writeBooleanFlag } from '../persistence/jsonStorage'

const quickMeasureEnabledStorageKey = 'fractalframe.drawingsDrawer.quickMeasureEnabled'

export function readQuickMeasureEnabled() {
  return readBooleanFlag(quickMeasureEnabledStorageKey, false)
}

export function writeQuickMeasureEnabled(enabled: boolean) {
  return writeBooleanFlag(quickMeasureEnabledStorageKey, enabled)
}
