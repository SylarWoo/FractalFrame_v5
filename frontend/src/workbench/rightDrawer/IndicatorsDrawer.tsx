import { useEffect } from 'react'
import { IndicatorsTable } from './IndicatorsTable'
import { indicatorRows } from './indicatorDefinitions'
import { IndicatorsSettingsPane } from './IndicatorsSettingsPane'
import type { IndicatorsController } from '../indicators/useIndicatorsController'
import type { MorganRangeSegment } from '../chart/morganRangeModel'
import { useRightDrawerVerticalSplit } from './useRightDrawerVerticalSplit'
import './IndicatorsDrawer.css'

type IndicatorsDrawerProps = {
  indicatorShortcutKeys: string[]
  indicatorsController: IndicatorsController
  loadedIndicatorKeys: string[]
  morganRangeSegment?: MorganRangeSegment | null
  onIndicatorShortcutKeysChange: (keys: string[]) => void
}

export function IndicatorsDrawer({
  indicatorShortcutKeys,
  indicatorsController,
  loadedIndicatorKeys,
  morganRangeSegment,
  onIndicatorShortcutKeysChange,
}: IndicatorsDrawerProps) {
  const { handleSplitPointerDown, topHeight } = useRightDrawerVerticalSplit({
    bodyDatasetKey: 'fractalframeIndicatorsSplitting',
    defaultHeight: 254,
    maxHeight: 420,
    minHeight: 96,
  })
  const loadedKeySet = new Set(loadedIndicatorKeys)
  const selectedKey = indicatorsController.selectedKey
  const settingsTab = indicatorsController.settingsTab
  const selected = indicatorRows.find((row) => row.key === selectedKey) ?? indicatorRows[0]
  const selectedLoaded = loadedKeySet.has(selected.key)

  useEffect(() => {
    if (settingsTab === 'strategy') {
      indicatorsController.setSettingsTab('input')
    }
  }, [indicatorsController, settingsTab])

  return (
    <section className="ff-indicators-drawer" data-right-widget-panel="indicators" data-testid="ff-indicators-drawer-panel">
      <div
        className="ff-indicators-split-v1"
        data-ff-indicators-split-v1
        style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}
      >
        <IndicatorsTable
          indicatorShortcutKeys={indicatorShortcutKeys}
          rows={indicatorRows}
          selectedKey={selectedKey}
          onIndicatorShortcutKeysChange={onIndicatorShortcutKeysChange}
          onSelect={indicatorsController.setSelectedKey}
        />
        <button
          aria-label="Resize indicators drawer split"
          className="ff-indicators-split-v1__handle"
          data-ff-indicators-split-handle-v1="true"
          onPointerDown={handleSplitPointerDown}
          title="上下拖动调整窗口大小"
          type="button"
        />
        <div className="ff-indicators-split-v1__bottom" data-ff-indicators-split-bottom-v1>
          <IndicatorsSettingsPane
            indicatorsController={indicatorsController}
            loaded={selectedLoaded}
            morganRangeSegment={morganRangeSegment}
            selected={selected}
          />
        </div>
      </div>
    </section>
  )
}
