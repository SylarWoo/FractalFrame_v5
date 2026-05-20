import { lazy, Suspense } from 'react'
import type { SettingsPanelTab } from '../settings/SettingsPanel'

const SettingsPanel = lazy(() => import('../settings/SettingsPanel').then((module) => ({ default: module.SettingsPanel })))

type RightDrawerSettingsHostProps = {
  selectedTab: SettingsPanelTab
  onSelectedTabChange: (tab: SettingsPanelTab) => void
}

export function RightDrawerSettingsHost({
  selectedTab,
  onSelectedTabChange,
}: RightDrawerSettingsHostProps) {
  return (
    <Suspense fallback={<div className="ff-settings-drawer__body" />}>
      <SettingsPanel
        selectedTab={selectedTab}
        onSelectedTabChange={onSelectedTabChange}
      />
    </Suspense>
  )
}
