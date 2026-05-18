import type { PointerEvent as ReactPointerEvent } from 'react'
import './RightDrawer.css'

type RightDrawerProps = {
  drawerWidth: number
  open: boolean
  onClose: () => void
  onResize: (width: number) => void
  onToggle: () => void
}

const symbols = [
  ['BCHUSDm', '比特币现金', 'Bitcoin Cash vs US Dollar'],
  ['BTCJPYm', '比特币/日元', 'Bitcoin vs Japanese Yen'],
  ['BTCUSDm', '比特币', 'Bitcoin vs US Dollar'],
  ['ETHUSDm', '以太坊', 'Ethereum vs US Dollar'],
  ['LTCUSDm', '莱特币', 'Litecoin vs US Dollar'],
  ['XRPUSDm', '瑞波币', 'Ripple vs US Dollar'],
  ['LINKUSDm', '链环', 'ChainLink Token vs US Dollar'],
]

const minDrawerWidth = 220
const maxDrawerWidth = 900

function clampDrawerWidth(width: number) {
  return Math.max(minDrawerWidth, Math.min(maxDrawerWidth, Math.round(width)))
}

export function RightDrawer({
  drawerWidth,
  open,
  onClose,
  onResize,
  onToggle,
}: RightDrawerProps) {
  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault()

    const startX = event.clientX
    const startWidth = drawerWidth
    const ownerDocument = event.currentTarget.ownerDocument
    const handle = event.currentTarget

    ownerDocument.body.setAttribute('data-fractalframe-right-widget-drawer-resizing', 'true')
    handle.setPointerCapture(event.pointerId)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX
      onResize(clampDrawerWidth(startWidth - deltaX))
      window.dispatchEvent(new Event('resize'))
    }

    const finishResize = (upEvent: PointerEvent) => {
      ownerDocument.removeEventListener('pointermove', handlePointerMove)
      ownerDocument.removeEventListener('pointerup', finishResize)
      ownerDocument.removeEventListener('pointercancel', finishResize)
      ownerDocument.body.removeAttribute('data-fractalframe-right-widget-drawer-resizing')
      handle.releasePointerCapture(upEvent.pointerId)
      window.dispatchEvent(new Event('resize'))
    }

    ownerDocument.addEventListener('pointermove', handlePointerMove)
    ownerDocument.addEventListener('pointerup', finishResize)
    ownerDocument.addEventListener('pointercancel', finishResize)
  }

  return (
    <>
      <div className="ff-right-rail" aria-label="Right toolbar">
        <button
          className="ff-right-rail__button"
          data-active={open}
          onClick={onToggle}
          title="MT5 Import Center"
          type="button"
        >
          <span />
        </button>
      </div>

      <aside className="ff-right-drawer" data-open={open} aria-hidden={!open}>
        <div
          className="ff-right-drawer__resize-handle"
          onDoubleClick={() => onResize(280)}
          onPointerDown={handleResizePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize right panel"
          tabIndex={0}
        />

        <header className="ff-right-drawer__header">
          <h2>MT5 Import Center</h2>
          <button className="ff-right-drawer__close" onClick={onClose} type="button">
            x
          </button>
        </header>

        <div className="ff-import-toolbar">
          <input placeholder="Search..." />
          <button type="button">Search</button>
          <button type="button">Scan MT5</button>
        </div>

        <div className="ff-import-note">
          351 symbol(s); viewport renders visible rows only (351 in list).
        </div>

        <table className="ff-symbol-table">
          <thead>
            <tr>
              <th>交易品种</th>
              <th>中文名称</th>
              <th>描述</th>
            </tr>
          </thead>
          <tbody>
            {symbols.map(([symbol, name, description], index) => (
              <tr data-selected={index === 0} key={symbol}>
                <td>{symbol}</td>
                <td>{name}</td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="ff-import-detail">
          <h3>BCHUSDm · 比特币现金</h3>
          <p>Bitcoin Cash vs US Dollar</p>
          <div className="ff-detail-grid">
            <span>分类</span>
            <strong>Crypto</strong>
            <span>小数位</span>
            <strong>2</strong>
            <span>合约量</span>
            <strong>1</strong>
            <span>点差</span>
            <strong>浮动</strong>
            <span>盈利货币</span>
            <strong>USD</strong>
            <span>基础货币</span>
            <strong>BCH</strong>
          </div>
        </section>

        <section className="ff-import-store">
          <h3>Current MT5 rows detected</h3>
          <p>Latest Direct import: no timing data</p>
          <div className="ff-timeframe-grid">
            {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map((item) => (
              <label key={item}>
                <input disabled type="checkbox" />
                <span>{item}</span>
                <em>未检查</em>
              </label>
            ))}
          </div>
        </section>
      </aside>
    </>
  )
}
