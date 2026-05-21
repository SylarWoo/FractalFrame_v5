import type { ReactNode } from 'react'
import type { IndicatorSettingsTab } from './indicatorPersistence'

type IndicatorSettingsShellTab = {
  id: IndicatorSettingsTab
  label: string
}

const defaultTabs: IndicatorSettingsShellTab[] = [
  { id: 'input', label: '\u8f93\u5165' },
  { id: 'style', label: '\u6837\u5f0f' },
  { id: 'visibility', label: '\u53ef\u89c1\u8303\u56f4' },
]

type IndicatorSettingsShellProps = {
  activeTab: IndicatorSettingsTab
  children?: ReactNode
  loaded: boolean
  persistenceEnabled: boolean
  tabs?: IndicatorSettingsShellTab[]
  title: string
  unloadedContent?: ReactNode
  onLoad: () => void
  onPersistenceChange: (enabled: boolean) => void
  onTabChange: (tab: IndicatorSettingsTab) => void
  onUnload: () => void
}

export function IndicatorSettingsShell({
  activeTab,
  children,
  loaded,
  persistenceEnabled,
  tabs = defaultTabs,
  title,
  unloadedContent,
  onLoad,
  onPersistenceChange,
  onTabChange,
  onUnload,
}: IndicatorSettingsShellProps) {
  return (
    <>
      <div className="ff-indicators-detail-v1 ff-indicator-settings-panel-v1__row" data-modifier="detail" data-ff-indicators-detail-v1>
        <span className="ff-indicators-detail-v1__title ff-indicator-settings-panel-v1__row-label" data-ff-indicators-detail-title-v1>
          {title}
        </span>
        <span className="ff-indicators-detail-v1__actions ff-indicator-settings-panel-v1__row-control">
          <button className="ff-indicators-detail-v1__btn" data-active={loaded ? 'true' : undefined} onClick={onLoad} type="button">Load</button>
          <button className="ff-indicators-detail-v1__btn" data-active={loaded ? undefined : 'true'} onClick={onUnload} type="button">Unload</button>
        </span>
      </div>
      <div className="ff-indicators-input-panel-v1" data-ff-indicators-input-panel-root="true">
        {loaded ? (
          <>
            <div className="ff-indicators-input-panel-v1__tabs" role="tablist">
              {tabs.map((tab) => (
                <button
                  aria-selected={activeTab === tab.id}
                  className="ff-indicators-input-panel-v1__tab"
                  data-active={activeTab === tab.id ? 'true' : undefined}
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
              <span className="ff-indicators-style-persistence-v1">
                <button className="ff-indicators-style-persistence-v1__button" data-active={persistenceEnabled ? 'true' : undefined} onClick={() => onPersistenceChange(true)} type="button">Save</button>
                <button className="ff-indicators-style-persistence-v1__button" data-active={persistenceEnabled ? undefined : 'true'} onClick={() => onPersistenceChange(false)} type="button">Unsave</button>
              </span>
            </div>
            {children}
          </>
        ) : (
          unloadedContent
        )}
      </div>
    </>
  )
}
