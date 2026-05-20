import { describe, expect, it } from 'vitest'
import { resolveMt5SymbolDisplay } from './mt5SymbolDisplay'
import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'

function symbolRow(row: Partial<Mt5SymbolRow> & Pick<Mt5SymbolRow, 'symbol'>): Mt5SymbolRow {
  return {
    category: row.category ?? '',
    description: row.description ?? '',
    digits: row.digits ?? null,
    market: row.market ?? '',
    name: row.name ?? row.symbol,
    path: row.path ?? '',
    symbol: row.symbol,
    visible: row.visible ?? true,
  }
}

describe('mt5SymbolDisplay', () => {
  it('renders metal pairs and asset types without mojibake', () => {
    expect(resolveMt5SymbolDisplay(symbolRow({
      category: 'Forex_Metal',
      description: 'Gold vs US Dollar',
      market: 'forex',
      symbol: 'XAUUSDm',
    }))).toMatchObject({
      assetType: '贵金属',
      chineseName: '黄金/美元',
    })
  })

  it('uses clean display names for common watchlist symbols', () => {
    expect(resolveMt5SymbolDisplay(symbolRow({
      description: 'Apple Inc',
      market: 'stocks',
      symbol: 'AAPLm',
    }))).toMatchObject({
      assetType: '股票',
      chineseName: '苹果',
    })

    expect(resolveMt5SymbolDisplay(symbolRow({
      description: 'US Dollar Index',
      market: 'indices',
      symbol: 'DXYm',
    }))).toMatchObject({
      assetType: '指数',
      chineseName: '美元指数',
    })
  })
})
