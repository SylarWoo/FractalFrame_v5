import { describe, expect, it } from 'vitest'
import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { parseSymbolSearchTokens, symbolRowMatchesSearchTokens } from './useRightDrawerSelection'

function symbolRow(overrides: Partial<Mt5SymbolRow>): Mt5SymbolRow {
  return {
    category: '',
    description: '',
    name: '',
    path: '',
    source: 'mt5',
    symbol: 'XAUUSDm',
    visible: true,
    ...overrides,
  }
}

describe('parseSymbolSearchTokens', () => {
  it('splits symbol search by common English and Chinese separators', () => {
    expect(parseSymbolSearchTokens('XAUUSD,BTCUSD EURUSD，NAS、US30;GBPUSD；USDJPY|ETHUSD')).toEqual([
      'xauusd',
      'btcusd',
      'eurusd',
      'nas',
      'us30',
      'gbpusd',
      'usdjpy',
      'ethusd',
    ])
  })
})

describe('symbolRowMatchesSearchTokens', () => {
  it('matches any search token against symbol metadata', () => {
    const rows = [
      symbolRow({ symbol: 'XAUUSDm', description: '黄金/美元' }),
      symbolRow({ symbol: 'BTCUSDm', description: 'Bitcoin vs US Dollar' }),
      symbolRow({ symbol: 'EURUSDm', description: 'Euro vs US Dollar' }),
    ]
    const tokens = parseSymbolSearchTokens('XAUUSD,BTCUSD')

    expect(rows.filter((row) => symbolRowMatchesSearchTokens(row, tokens)).map((row) => row.symbol)).toEqual([
      'XAUUSDm',
      'BTCUSDm',
    ])
  })
})
