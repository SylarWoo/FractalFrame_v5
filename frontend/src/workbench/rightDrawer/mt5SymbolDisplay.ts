import type { Mt5SymbolRow } from '../../services/mt5/mt5SymbolsApi'

type SymbolDisplay = {
  chineseName: string
  assetType: string
  description: string
}

const currencyCodePattern = /^[A-Z]{3}$/

const currencyOverrides: Record<string, string> = {
  CNH: '离岸人民币',
  RUR: '俄罗斯卢布',
  XAG: '白银',
  XAU: '黄金',
  XPD: '钯金',
  XPT: '铂金',
}

const englishCurrencyAliases: Record<string, string> = {
  forint: 'HUF',
  hryvnia: 'UAH',
  rupiah: 'IDR',
  vatu: 'VUV',
  zloty: 'PLN',
  'algerian dinar': 'DZD',
  'angolan kwanza': 'AOA',
  'argentine peso': 'ARS',
  'armenian dram': 'AMD',
  'australian dollar': 'AUD',
  'azerbaijani manat': 'AZN',
  'bahraini dinar': 'BHD',
  'bangladeshi taka': 'BDT',
  'botswana pula': 'BWP',
  'brazilian real': 'BRL',
  'brunei dollar': 'BND',
  'bulgarian lev': 'BGN',
  'canadian dollar': 'CAD',
  'chilean peso': 'CLP',
  'colombian peso': 'COP',
  'croatian kuna': 'HRK',
  'czech koruna': 'CZK',
  'danish krone': 'DKK',
  'danish krona': 'DKK',
  'egyptian pound': 'EGP',
  euro: 'EUR',
  'georgian lari': 'GEL',
  'ghanaian cedi': 'GHS',
  'great britain pound': 'GBP',
  'guatemalan quetzal': 'GTQ',
  'honduran lempira': 'HNL',
  'hong kong dollar': 'HKD',
  'iceland krona': 'ISK',
  'indian rupee': 'INR',
  'iraqi dinars': 'IQD',
  'israeli shekel': 'ILS',
  'japanese yen': 'JPY',
  'jordanian dinar': 'JOD',
  'kazakhstan tenge': 'KZT',
  'kenyan shilling': 'KES',
  'kuwaiti dinar': 'KWD',
  'lebanese pound': 'LBP',
  'malaysian ringgit': 'MYR',
  'mexican peso': 'MXN',
  'moroccan dirham': 'MAD',
  'nepalese rupee': 'NPR',
  'new israeli shekel': 'ILS',
  'new taiwan dollar': 'TWD',
  'new turkish lira': 'TRY',
  'new zealand dollar': 'NZD',
  'nigerian naira': 'NGN',
  'norwegian krone': 'NOK',
  'norwegian krona': 'NOK',
  'omani rial': 'OMR',
  'pakistan rupee': 'PKR',
  'philippine peso': 'PHP',
  'qatari riyal': 'QAR',
  'romanian leu': 'RON',
  'romanian leu new': 'RON',
  'russian ruble': 'RUB',
  'saudi riyal': 'SAR',
  'singapore dollar': 'SGD',
  'south african rand': 'ZAR',
  'south korea won': 'KRW',
  'sri lankan rupee': 'LKR',
  'swedish krona': 'SEK',
  'swiss franc': 'CHF',
  'syrian pound': 'SYP',
  'tajikistan somoni': 'TJS',
  'tajikistani somoni': 'TJS',
  'thai baht': 'THB',
  'turkmenistan manat': 'TMT',
  'tunisian dinar': 'TND',
  'uganda shilling': 'UGX',
  'united arab emirates dirham': 'AED',
  'us dollar': 'USD',
  'uzbekistan sum': 'UZS',
  'uzbekistani som': 'UZS',
  'vietnamese dong': 'VND',
  'west african cfa': 'XOF',
  'yuan renminbi': 'CNY',
}

const cryptoNames: Record<string, string> = {
  '1INCH': '1inch',
  AAVE: '艾维',
  ADA: '艾达币',
  ALGO: 'Algorand',
  ATOM: 'Cosmos',
  AVAX: 'Avalanche',
  BAT: '注意力币',
  BCH: '比特币现金',
  BNB: '币安币',
  BTC: '比特币',
  CAKE: '薄饼',
  COMP: '复合币',
  DOGE: '狗狗币',
  DOT: '波卡',
  ENJ: '恩金币',
  EOS: 'EOS',
  ETC: '以太经典',
  ETH: '以太坊',
  FIL: '文件币',
  HBAR: '海德拉',
  HT: '火币积分',
  ICP: 'Internet Computer',
  IOST: '埃欧塔',
  LINK: '链环',
  LTC: '莱特币',
  MANA: '曼娜',
  MATIC: 'Polygon',
  MBT: '微型比特币',
  NEAR: 'NEAR',
  SHIB: '柴犬币',
  SNX: '合成网络',
  SOL: '索拉纳',
  THETA: '西塔',
  TRX: '波场',
  UNI: '尤尼斯瓦普',
  XLM: '恒星币',
  XMR: '门罗币',
  XRP: '瑞波币',
  XTZ: '泰索斯',
  ZEC: '大零币',
}

const commodityNames: Record<string, { name: string; type: string; aliases?: string[] }> = {
  XAU: { name: '黄金', type: '贵金属', aliases: ['gold'] },
  XAG: { name: '白银', type: '贵金属', aliases: ['silver'] },
  XPT: { name: '铂金', type: '贵金属', aliases: ['platinum'] },
  XPD: { name: '钯金', type: '贵金属', aliases: ['palladium'] },
  XCU: { name: '铜', type: '金属', aliases: ['copper'] },
  XNI: { name: '镍', type: '金属', aliases: ['nickel'] },
  XPB: { name: '铅', type: '金属', aliases: ['lead'] },
  XZN: { name: '锌', type: '金属', aliases: ['zinc'] },
  XAL: { name: '铝', type: '金属', aliases: ['aluminium', 'aluminum'] },
  XNG: { name: '天然气', type: '能源', aliases: ['natural gas'] },
  XTI: { name: '美国原油', type: '能源', aliases: ['wti', 'oil'] },
  XBR: { name: '布伦特原油', type: '能源', aliases: ['brent'] },
}

const stockNames: Record<string, string> = {
  AAPL: '苹果',
  ABBV: '艾伯维',
  ABNB: '爱彼迎',
  ABT: '雅培',
  ADBE: '奥多比',
  ADP: '自动数据处理',
  AMC: 'AMC院线',
  AMD: '超威半导体',
  AMGN: '安进',
  AMT: '美国电塔',
  AMZN: '亚马逊',
  ARM: 'Arm Holdings',
  ATVI: '动视暴雪',
  AVGO: '博通',
  BA: '波音',
  BABA: '阿里巴巴',
  BAC: '美国银行',
  BB: '黑莓',
  BEKE: '贝壳',
  BIDU: '百度',
  BILI: '哔哩哔哩',
  BIIB: '渤健',
  BMY: '百时美施贵宝',
  BRQS: '播思科技',
  BYD: '比亚迪',
  BYND: '别样肉客',
  CAN: '嘉楠科技',
  C: '花旗',
  COIN: 'Coinbase',
  COST: '开市客',
  CRM: '赛富时',
  CSCO: '思科',
  CVX: '雪佛龙',
  DIS: '迪士尼',
  EA: '艺电',
  EBAY: '易贝',
  EDU: '新东方教育',
  EQIX: '易昆尼克斯',
  F: '福特',
  GE: '通用电气',
  GM: '通用汽车',
  GOOGL: '谷歌',
  GOOG: '谷歌',
  HD: '家得宝',
  IBM: 'IBM',
  INTC: '英特尔',
  INTU: '财捷',
  IQ: '爱奇艺',
  ISRG: '直觉外科',
  JD: '京东',
  JNJ: '强生',
  JPM: '摩根大通',
  KO: '可口可乐',
  LI: '理想汽车',
  LLY: '礼来',
  LMT: '洛克希德马丁',
  MA: '万事达',
  MCD: '麦当劳',
  MDLZ: '亿滋国际',
  META: '脸书母公司',
  MRK: '默沙东',
  MS: '摩根士丹利',
  MSFT: '微软',
  MU: '美光科技',
  MMM: '3M',
  MO: '奥驰亚',
  NFLX: '奈飞',
  NIO: '蔚来',
  NKE: '耐克',
  NTES: '网易',
  NVO: '诺和诺德',
  NVDA: '英伟达',
  ORCL: '甲骨文',
  PDD: '拼多多',
  PEP: '百事',
  PFE: '辉瑞',
  PG: '宝洁',
  PLTR: 'Palantir',
  PM: '菲利普莫里斯',
  PYPL: 'PayPal',
  QCOM: '高通',
  RACE: '法拉利',
  REGN: '再生元制药',
  RIVN: 'Rivian',
  RLX: '雾芯科技',
  SBUX: '星巴克',
  SHEL: '壳牌',
  SHOP: 'Shopify',
  SMCI: '超微电脑',
  T: '美国电话电报',
  TAL: '好未来',
  TCEHY: '腾讯控股',
  TM: '丰田汽车',
  TME: '腾讯音乐',
  TSLA: '特斯拉',
  TSM: '台积电',
  UBER: '优步',
  UNH: '联合健康',
  UPS: '联合包裹',
  V: '维萨',
  VIPS: '唯品会',
  VRTX: '福泰制药',
  VZ: '威瑞森',
  WFC: '富国银行',
  WMT: '沃尔玛',
  XOM: '埃克森美孚',
  XPEV: '小鹏汽车',
  YUMC: '百胜中国',
  ZTO: '中通快递',
}

const indexNames: Record<string, string> = {
  AUS200: '澳洲ASX 200',
  CHINA50: '中国A50',
  DAX40: '德国DAX',
  DE30: '德国30指数',
  DE40: '德国DAX',
  DJI: '道琼斯指数',
  DXY: '美元指数',
  FR40: '法国CAC 40',
  GER40: '德国DAX',
  HK50: '恒生指数',
  IN50: '印度50指数',
  JP225: '日经225',
  NAS100: '纳斯达克100',
  SP500: '标普500',
  STOXX50: '欧洲斯托克50',
  UK100: '英国富时100',
  US100: '纳斯达克100',
  US2000: '罗素2000',
  US30: '道琼斯指数',
  US500: '标普500',
  USTEC: '纳斯达克100',
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

function normalizedSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/M$/, '')
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

function stripBrokerSuffix(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/M$/, '')
}

function resolveStockName(normalized: string) {
  const candidates = Object.keys(stockNames).sort((left, right) => right.length - left.length)
  const key = candidates.find((candidate) => normalized === candidate || normalized.startsWith(candidate))
  return key ? stockNames[key] : null
}

function cleanEnglishDescription(description: string) {
  return description
    .replace(/\s*\((?:Cayman|ADR|ADS|The|Class\s+[A-Z]).*?\)\s*/gi, ' ')
    .replace(/\b(?:Inc|Corporation|Corp|Company|Co|Ltd|PLC|SA|NV|AG|Holdings?|Group|Class\s+[A-Z])\.?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
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
