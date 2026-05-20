export const currencyCodePattern = /^[A-Z]{3}$/

export function normalizedSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/M$/, '')
}

export function stripBrokerSuffix(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/M$/, '')
}

export function cleanEnglishDescription(description: string) {
  return description
    .replace(/\s*\((?:Cayman|ADR|ADS|The|Class\s+[A-Z]).*?\)\s*/gi, ' ')
    .replace(/\b(?:Inc|Corporation|Corp|Company|Co|Ltd|PLC|SA|NV|AG|Holdings?|Group|Class\s+[A-Z])\.?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}
