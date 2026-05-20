import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'
import { cleanEnglishDescription, currencyCodePattern, normalizedSymbol, stripBrokerSuffix } from './mt5SymbolStringUtils'
import { commodityNames, cryptoNames, currencyOverrides, englishCurrencyAliases, indexNames, stockNames } from './mt5SymbolCatalog'

type SymbolDisplay = {
  chineseName: string
  assetType: string
  description: string
}

function normalizeAssetType(assetType: string) {
  const normalized = assetType.trim().toLowerCase()
  if (normalized === 'exotic') return '外汇'
  if (normalized === 'forex') return '外汇'
  if (normalized === 'crypto') return '加密货币'
  if (normalized === 'stocks') return '股票'
  if (normalized === 'indices') return '指数'
  if (normalized === 'energy') return '能源'
  if (normalized === 'forex_metal') return '贵金属'
  if (normalized === 'unknown') return '其它'
  return assetType || '其它'
}

function currencyName(code: string) {
  const normalized = code.toUpperCase()
  if (currencyOverrides[normalized]) return currencyOverrides[normalized]
  if (!currencyCodePattern.test(normalized)) return null

  try {
    const display = new Intl.DisplayNames(['zh-CN'], { type: 'currency' }).of(normalized)
    return display && display !== normalized ? display : null
  } catch {
    return null
  }
}

const cryptoQuoteCodes = Array.from(
  new Set([
    'USDT',
    'USD',
    ...Object.values(englishCurrencyAliases),
    ...Object.keys(currencyOverrides),
  ]),
).sort((left, right) => right.length - left.length)

function resolveCryptoPair(normalized: string) {
  const cryptoKey = Object.keys(cryptoNames)
    .sort((left, right) => right.length - left.length)
    .find((key) => normalized === key || normalized.startsWith(key))
  if (!cryptoKey) return null

  const quotePart = normalized.slice(cryptoKey.length)
  const quote = cryptoQuoteCodes.find((candidate) => quotePart === candidate || quotePart.startsWith(candidate))
  const baseName = cryptoNames[cryptoKey]
  if (!quote) return quotePart ? null : baseName

  const quoteName = quote ? currencyName(quote.replace('USDT', 'USD')) : null
  return quoteName && quote !== 'USD' && quote !== 'USDT' ? `${baseName}/${quoteName}` : baseName
}

function resolveCryptoFromDescription(descriptionLower: string) {
  if (descriptionLower.includes('micro bitcoin')) return '微型比特币'
  if (descriptionLower.includes('bitcoin')) return '比特币'
  if (descriptionLower.includes('ethereum')) return '以太坊'
  return null
}

function resolveFxPair(normalized: string, description: string) {
  const pair = normalized.slice(0, 6)
  const base = currencyName(pair.slice(0, 3))
  const quote = currencyName(pair.slice(3, 6))
  if (base && quote) return `${base}/${quote}`

  const parts = description.toLowerCase().split(/\s+vs\s+/)
  if (parts.length === 2) {
    const leftCode = englishCurrencyAliases[parts[0].trim()]
    const rightCode = englishCurrencyAliases[parts[1].trim()]
    const left = leftCode ? currencyName(leftCode) : null
    const right = rightCode ? currencyName(rightCode) : null
    if (left && right) return `${left}/${right}`
  }

  return null
}

function resolveCommodity(normalized: string, descriptionLower: string) {
  const metalPair = normalized.match(/^(XAU|XAG|XPT|XPD)(USD|EUR|GBP|JPY|AUD|CAD|CHF|CNH|CNY)/)
  if (metalPair) {
    const base = commodityNames[metalPair[1]]
    const quote = currencyName(metalPair[2])
    if (base && quote) {
      return { name: `${base.name}/${quote}`, type: base.type }
    }
  }

  const symbolMatch = Object.entries(commodityNames).find(([key]) => normalized.startsWith(key))
  if (symbolMatch) return symbolMatch[1]

  return Object.values(commodityNames).find((item) =>
    item.aliases?.some((alias) => descriptionLower.includes(alias)),
  )
}

function resolveStockName(normalized: string) {
  const candidates = Object.keys(stockNames).sort((left, right) => right.length - left.length)
  const key = candidates.find((candidate) => normalized === candidate || normalized.startsWith(candidate))
  return key ? stockNames[key] : null
}

export function resolveMt5SymbolDisplay(row: Mt5SymbolRow): SymbolDisplay {
  const normalized = normalizedSymbol(row.symbol)
  const description = row.description || row.name || row.symbol
  const descriptionLower = description.toLowerCase()

  const cryptoName = resolveCryptoPair(normalized)
  if (cryptoName) {
    return { chineseName: cryptoName, assetType: '加密货币', description: cryptoName }
  }

  const descriptionCryptoName = resolveCryptoFromDescription(descriptionLower)
  if (descriptionCryptoName) {
    return {
      chineseName: descriptionCryptoName,
      assetType: '加密货币',
      description: descriptionCryptoName,
    }
  }

  const commodity = resolveCommodity(normalized, descriptionLower)
  if (commodity) {
    return { chineseName: commodity.name, assetType: commodity.type, description: commodity.name }
  }

  const indexKey = Object.keys(indexNames).find((key) => normalized.startsWith(key))
  if (indexKey) {
    return { chineseName: indexNames[indexKey], assetType: '指数', description: indexNames[indexKey] }
  }

  const stockName = resolveStockName(stripBrokerSuffix(row.symbol))
  if (stockName && row.market === 'stocks') {
    return { chineseName: stockName, assetType: '股票', description: stockName }
  }

  const fxName = resolveFxPair(normalized, description)
  if (fxName) {
    const assetType = normalizeAssetType(
      row.category === 'Exotic' ? 'Exotic' : (row.market || 'forex'),
    )
    return { chineseName: fxName, assetType, description: fxName }
  }

  if (descriptionLower.includes('oil')) {
    return { chineseName: '原油', assetType: '能源', description: '原油' }
  }
  if (descriptionLower.includes('gas')) {
    return { chineseName: '天然气', assetType: '能源', description: '天然气' }
  }

  if (row.market === 'stocks') {
    const cleaned = cleanEnglishDescription(description) || description
    return { chineseName: cleaned, assetType: '股票', description: cleaned }
  }
  if (row.market === 'indices') return { chineseName: description, assetType: '指数', description }
  if (row.market === 'energy') return { chineseName: description, assetType: '能源', description }
  if (row.market === 'forex') return { chineseName: description, assetType: '外汇', description }

  return {
    chineseName: description,
    assetType: normalizeAssetType(row.category || row.market || '其它'),
    description,
  }
}
