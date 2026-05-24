import type { ReactNode } from 'react'

export type SegmentedControlItem = {
  active: boolean
  label: string
  onClick?: () => void
  statusOnly?: boolean
}

export function SegmentedControl({
  ariaLabel,
  className = '',
  items,
}: {
  ariaLabel: string
  className?: string
  items: SegmentedControlItem[]
}) {
  return (
    <div className={`ff-indicators-style-persistence-v1 ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          className="ff-indicators-style-persistence-v1__button"
          data-active={item.active ? 'true' : undefined}
          data-status-only={item.statusOnly ? 'true' : undefined}
          key={item.label}
          onClick={item.statusOnly ? undefined : item.onClick}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function DrawingToolHeader({
  objectId,
  toolLabel,
}: {
  objectId: string
  toolLabel: string
}) {
  return (
    <div className="ff-indicators-detail-v1 ff-indicator-settings-panel-v1__row" data-modifier="detail">
      <span className="ff-indicators-detail-v1__title ff-indicator-settings-panel-v1__row-label" data-ff-drawing-tools-detail-title-v1>
        <span className="ff-drawing-detail-title-v1__label">{toolLabel}</span>
        {objectId ? (
          <span className="ff-drawing-detail-title-v1__id">{objectId}</span>
        ) : null}
      </span>
    </div>
  )
}

export function DrawingToolActionControls({
  armed,
  locked,
  onArm,
  onDelete,
  onRelease,
  onToggleLock,
  persistenceControls,
  selected,
  toolLabel,
}: {
  armed: boolean
  locked: boolean
  onArm: () => void
  onDelete: () => void
  onRelease: () => void
  onToggleLock: () => void
  persistenceControls?: ReactNode
  selected: boolean
  toolLabel: string
}) {
  return (
    <>
      <div className="ff-drawing-hline-top-actions-v1">
        <SegmentedControl
          ariaLabel={`${toolLabel} draw mode`}
          items={[
            { active: armed, label: '\u753b\u7ebf', onClick: onArm },
            { active: !armed, label: '\u91ca\u653e', onClick: onRelease },
          ]}
        />
        {persistenceControls}
      </div>
      <SegmentedControl
        ariaLabel={`${toolLabel} actions`}
        className="ff-drawing-hline-actions-v1--segmented"
        items={[
          { active: selected, label: '\u9009\u4e2d', statusOnly: true },
          { active: locked, label: '\u9501\u5b9a', onClick: onToggleLock },
          { active: false, label: '\u5220\u9664', onClick: onDelete },
        ]}
      />
    </>
  )
}

export function DrawingToolPersistenceControls({
  onSave,
  onUnsave,
  persisted,
  toolLabel,
}: {
  onSave: () => void
  onUnsave: () => void
  persisted: boolean
  toolLabel: string
}) {
  return (
    <SegmentedControl
      ariaLabel={`${toolLabel} persistence`}
      className="ff-drawing-hline-top-actions-v1__persist"
      items={[
        { active: persisted, label: 'Save', onClick: onSave },
        { active: !persisted, label: 'Unsave', onClick: onUnsave },
      ]}
    />
  )
}

export function DrawingToolTabs({
  activeKey,
  ariaLabel,
  onChange,
  renderPanel,
  tabs,
}: {
  activeKey: string
  ariaLabel: string
  onChange: (key: string) => void
  renderPanel: (key: string) => ReactNode
  tabs: Array<{ key: string; label: string }>
}) {
  return (
    <>
      <div className="ff-indicators-input-panel-v1__tabs" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => (
          <button
            aria-selected={activeKey === tab.key}
            className="ff-indicators-input-panel-v1__tab"
            data-active={activeKey === tab.key ? 'true' : 'false'}
            key={tab.key}
            onClick={() => onChange(tab.key)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="ff-indicators-input-panel-v1__tab-panels">
        {tabs.map((tab) => (
          <div
            className="ff-indicators-input-panel-v1__tab-panel"
            data-active={activeKey === tab.key ? 'true' : 'false'}
            hidden={activeKey !== tab.key}
            key={tab.key}
            role="tabpanel"
          >
            {renderPanel(tab.key)}
          </div>
        ))}
      </div>
    </>
  )
}
