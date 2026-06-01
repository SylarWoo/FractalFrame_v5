import { useEffect, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { readJson, readString, writeJson, writeString } from '../persistence/jsonStorage'
import { storageKeys } from '../persistence/storageKeys'
import './StrategyDrawer.css'

type StrategyRow = {
  description: string
  key: string
  name: string
  system: string
  type: string
}

type StrategyTab = 'test' | 'data' | 'replay'
type StrategyColumnKey = 'name' | 'system' | 'type' | 'description'
type StrategyColumnWidths = Record<StrategyColumnKey, number>

type StrategyDrawerProps = {
  loadedStrategyKeys: string[]
  persistenceEnabled: boolean
  strategyShortcutKeys: string[]
  onLoadStrategy: (key: string) => void
  onPersistenceEnabledChange: (enabled: boolean) => void
  onStrategyShortcutKeysChange: (keys: string[]) => void
  onUnloadStrategy: (key: string) => void
}

const strategyRows: StrategyRow[] = [
  {
    description: '基于 MMF_V2 主趋势与波动信号的顺势策略样例',
    key: 'main-trend-volatility',
    name: '主趋势波动策略',
    system: 'MMF_v2',
    type: '顺势',
  },
  {
    description: '基于 M5 突破后的顺势回撤确认，预留给日内主波段回测。',
    key: 'm5-breakout-pullback',
    name: '5分钟突破回撤策略',
    system: 'MMF_v3',
    type: '顺势',
  },
]

const defaultColumnWidths: StrategyColumnWidths = {
  name: 142,
  system: 74,
  type: 64,
  description: 188,
}

const minColumnWidths: StrategyColumnWidths = {
  name: 96,
  system: 58,
  type: 52,
  description: 120,
}

const strategyTabs: Array<{ id: StrategyTab; label: string }> = [
  { id: 'test', label: '测试' },
  { id: 'data', label: '数据' },
  { id: 'replay', label: '回放' },
]

function clampTopHeight(value: unknown) {
  const number = Math.round(Number(value))
  return Number.isFinite(number) ? Math.max(96, Math.min(420, number)) : 254
}

function readInitialSelectedStrategyKey() {
  const key = readString(storageKeys.strategyDrawerSelectedKey, strategyRows[0].key)
  return strategyRows.some((row) => row.key === key) ? key : strategyRows[0].key
}

function readInitialStrategyTab(): StrategyTab {
  const tab = readString(storageKeys.strategyDrawerActiveTab, 'test')
  return tab === 'data' || tab === 'replay' ? tab : 'test'
}

function readInitialStrategyTopHeight() {
  return clampTopHeight(readString(storageKeys.strategyDrawerTopHeightPx, '254'))
}

function readInitialStrategyColumnWidths(): StrategyColumnWidths {
  const parsed = readJson<Partial<StrategyColumnWidths> | null>(storageKeys.strategyDrawerColumnWidthsPx, null)
  return {
    name: Math.max(minColumnWidths.name, Math.round(Number(parsed?.name) || defaultColumnWidths.name)),
    system: Math.max(minColumnWidths.system, Math.round(Number(parsed?.system) || defaultColumnWidths.system)),
    type: Math.max(minColumnWidths.type, Math.round(Number(parsed?.type) || defaultColumnWidths.type)),
    description: Math.max(minColumnWidths.description, Math.round(Number(parsed?.description) || defaultColumnWidths.description)),
  }
}

function renderStrategyTestPanel(strategy: StrategyRow) {
  if (strategy.key !== 'm5-breakout-pullback') {
    return '策略测试参数稍后接入。'
  }

  return (
    <section className="ff-strategy-rule-card-v1" aria-label="规则标记">
      <div className="ff-strategy-rule-card-v1__header">
        <span className="ff-strategy-rule-card-v1__title">规则标记</span>
        <span className="ff-strategy-rule-card-v1__tag">5分钟突破回撤</span>
      </div>

      <div className="ff-strategy-rule-card-v1__grid">
        <div className="ff-strategy-rule-card-v1__section">
          <div className="ff-strategy-rule-card-v1__section-title">多头</div>
          <ol className="ff-strategy-rule-card-v1__steps">
            <li>多头市场开启，超买突破成立。</li>
            <li>价格回撤，VMI 转为负值。</li>
            <li>后续 TSI 金叉确认，箭头下标记 BPR Buy。</li>
            <li>TSI 再次死叉确认，箭头上标记 BPR Long Exit。</li>
          </ol>
        </div>

        <div className="ff-strategy-rule-card-v1__section">
          <div className="ff-strategy-rule-card-v1__section-title">空头</div>
          <ol className="ff-strategy-rule-card-v1__steps">
            <li>空头市场开启，超卖突破成立。</li>
            <li>价格反弹，VMI 转为正值。</li>
            <li>后续 TSI 死叉确认，箭头上标记 BPR Sell。</li>
            <li>TSI 再次金叉确认，箭头下标记 BPR Short Exit。</li>
          </ol>
        </div>
      </div>

      <div className="ff-strategy-rule-card-v1__stop">
        止损：当期摩根区间 2/8。触发后标记 Stop Loss：多头在止损 K 线下方，空头在止损 K 线上方。
      </div>
    </section>
  )
}

export function StrategyDrawer({
  loadedStrategyKeys,
  persistenceEnabled,
  strategyShortcutKeys,
  onLoadStrategy,
  onPersistenceEnabledChange,
  onStrategyShortcutKeysChange,
  onUnloadStrategy,
}: StrategyDrawerProps) {
  const [selectedKey, setSelectedKey] = useState(readInitialSelectedStrategyKey)
  const [activeTab, setActiveTab] = useState<StrategyTab>(readInitialStrategyTab)
  const [columnWidths, setColumnWidths] = useState<StrategyColumnWidths>(readInitialStrategyColumnWidths)
  const [topHeight, setTopHeight] = useState(readInitialStrategyTopHeight)
  const selected = strategyRows.find((row) => row.key === selectedKey) ?? strategyRows[0]
  const selectedLoaded = loadedStrategyKeys.includes(selected.key)

  useEffect(() => {
    writeString(storageKeys.strategyDrawerSelectedKey, selectedKey)
  }, [selectedKey])

  useEffect(() => {
    writeString(storageKeys.strategyDrawerActiveTab, activeTab)
  }, [activeTab])

  useEffect(() => {
    writeString(storageKeys.strategyDrawerTopHeightPx, String(topHeight))
  }, [topHeight])

  useEffect(() => {
    writeJson(storageKeys.strategyDrawerColumnWidthsPx, columnWidths)
  }, [columnWidths])

  function handleShortcutCheckedChange(key: string, checked: boolean) {
    setSelectedKey(key)
    if (checked) {
      onStrategyShortcutKeysChange(strategyShortcutKeys.includes(key) ? strategyShortcutKeys : [...strategyShortcutKeys, key])
      return
    }
    onStrategyShortcutKeysChange(strategyShortcutKeys.filter((item) => item !== key))
  }

  function handleColumnResizePointerDown(event: ReactPointerEvent<HTMLSpanElement>, column: StrategyColumnKey) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = columnWidths[column]
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.setAttribute('data-fractalframe-indicators-column-resizing', 'true')

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + (moveEvent.clientX - startX)
      setColumnWidths((current) => ({
        ...current,
        [column]: Math.max(minColumnWidths[column], Math.round(nextWidth)),
      }))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-indicators-column-resizing')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  function resetColumnWidth(column: StrategyColumnKey) {
    setColumnWidths((current) => ({ ...current, [column]: defaultColumnWidths[column] }))
  }

  function renderResizableHeader(label: string, column: StrategyColumnKey, resizable = true) {
    return (
      <th scope="col">
        {label}
        {resizable ? (
          <span
            className="ff-indicators-table-v1__column-resizer"
            onDoubleClick={() => resetColumnWidth(column)}
            onPointerDown={(event) => handleColumnResizePointerDown(event, column)}
          />
        ) : null}
      </th>
    )
  }

  function handleSplitPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()

    const startY = event.clientY
    const startHeight = topHeight
    const pointerId = event.pointerId
    const target = event.currentTarget

    target.setPointerCapture(pointerId)
    document.body.dataset.fractalframeIndicatorsSplitting = 'true'

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight + (moveEvent.clientY - startY)
      setTopHeight(Math.max(96, Math.min(420, Math.round(nextHeight))))
    }

    const handlePointerUp = () => {
      document.body.removeAttribute('data-fractalframe-indicators-splitting')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already be released by the browser.
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
  }

  return (
    <section className="ff-strategy-drawer" aria-label="Strategy drawer">
      <div
        className="ff-indicators-split-v1 ff-strategy-split-v1"
        style={{ ['--ff-indicators-top-height' as string]: `${topHeight}px` }}
      >
        <div className="ff-indicators-split-v1__top">
          <table className="right-widget-drawer__table ff-indicators-table-v1 ff-strategy-table-v1" aria-label="Strategy list">
            <colgroup>
              <col style={{ width: `${columnWidths.name}px` }} />
              <col style={{ width: `${columnWidths.system}px` }} />
              <col style={{ width: `${columnWidths.type}px` }} />
              <col style={{ width: `${columnWidths.description}px` }} />
            </colgroup>
            <thead>
              <tr>
                {renderResizableHeader('策略名称', 'name')}
                {renderResizableHeader('系统', 'system')}
                {renderResizableHeader('类型', 'type')}
                {renderResizableHeader('描述', 'description', false)}
              </tr>
            </thead>
            <tbody>
              {strategyRows.map((row) => {
                const inShortcutMenu = strategyShortcutKeys.includes(row.key)
                return (
                  <tr
                    data-selected={selected.key === row.key}
                    key={row.key}
                    onClick={() => setSelectedKey(row.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedKey(row.key)
                      }
                    }}
                    tabIndex={0}
                  >
                    <td>
                      <span className="ff-indicators-table-v1__check">
                        <input
                          aria-label={`${row.name} shortcut`}
                          checked={inShortcutMenu}
                          onChange={(event) => handleShortcutCheckedChange(row.key, event.target.checked)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          type="checkbox"
                        />
                        <span>{row.name}</span>
                      </span>
                    </td>
                    <td>{row.system}</td>
                    <td>{row.type}</td>
                    <td title={row.description}>{row.description}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <button
          aria-label="Resize strategy drawer split"
          className="ff-indicators-split-v1__handle"
          onPointerDown={handleSplitPointerDown}
          title="上下拖动调整窗口大小"
          type="button"
        />

        <div className="ff-indicators-split-v1__bottom">
          <div className="ff-indicators-detail-v1 ff-indicator-settings-panel-v1__row" data-modifier="detail">
            <span className="ff-indicators-detail-v1__title ff-indicator-settings-panel-v1__row-label">
              {selected.name} - {selected.system}
            </span>
            <span className="ff-indicators-detail-v1__actions ff-indicator-settings-panel-v1__row-control">
              <button className="ff-indicators-detail-v1__btn" disabled={selectedLoaded} onClick={() => onLoadStrategy(selected.key)} type="button">Load</button>
              <button className="ff-indicators-detail-v1__btn" disabled={!selectedLoaded} onClick={() => onUnloadStrategy(selected.key)} type="button">Unload</button>
            </span>
          </div>

          <div className="ff-indicators-input-panel-v1">
            <div className="ff-indicators-input-panel-v1__tabs" role="tablist">
              {strategyTabs.map((tab) => (
                <button
                  aria-selected={activeTab === tab.id}
                  className="ff-indicators-input-panel-v1__tab"
                  data-active={activeTab === tab.id ? 'true' : undefined}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
              <span className="ff-indicators-style-persistence-v1">
                <button className="ff-indicators-style-persistence-v1__button" data-active={persistenceEnabled ? 'true' : undefined} onClick={() => onPersistenceEnabledChange(true)} type="button">Save</button>
                <button className="ff-indicators-style-persistence-v1__button" data-active={persistenceEnabled ? undefined : 'true'} onClick={() => onPersistenceEnabledChange(false)} type="button">Unsave</button>
              </span>
            </div>
            <div className="ff-strategy-tab-panel-v1">
              {activeTab === 'test' ? renderStrategyTestPanel(selected) : activeTab === 'data' ? '策略数据源稍后接入。' : '策略回放控制稍后接入。'}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
