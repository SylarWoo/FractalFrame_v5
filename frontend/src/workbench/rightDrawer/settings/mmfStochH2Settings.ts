export type MmfStochH2PassthroughPeriod = 'M5' | 'M30' | 'H2'

export const mmfStochH2PassthroughPeriods: MmfStochH2PassthroughPeriod[] = ['M5', 'M30', 'H2']

export type MmfStochH2IndicatorSettings = {
  closeOverboughtColor: string
  closeOverboughtSize: number
  closeOverboughtSymbol: string
  closeOversoldColor: string
  closeOversoldSize: number
  closeOversoldSymbol: string
  enterOverboughtColor: string
  enterOverboughtSize: number
  enterOverboughtSymbol: string
  enterOversoldColor: string
  enterOversoldSize: number
  enterOversoldSymbol: string
  passthroughPeriods: MmfStochH2PassthroughPeriod[]
  passthroughVisible: boolean
  showCloseOverbought: boolean
  showCloseOversold: boolean
  showEnterOverbought: boolean
  showEnterOversold: boolean
}

export const defaultMmfStochH2IndicatorSettings: MmfStochH2IndicatorSettings = {
  closeOverboughtColor: '#ef5350',
  closeOverboughtSize: 16,
  closeOverboughtSymbol: '\u2190',
  closeOversoldColor: '#26a69a',
  closeOversoldSize: 16,
  closeOversoldSymbol: '\u2192',
  enterOverboughtColor: '#ef5350',
  enterOverboughtSize: 16,
  enterOverboughtSymbol: '\u2193',
  enterOversoldColor: '#26a69a',
  enterOversoldSize: 16,
  enterOversoldSymbol: '\u2191',
  passthroughPeriods: ['H2'],
  passthroughVisible: true,
  showCloseOverbought: false,
  showCloseOversold: false,
  showEnterOverbought: false,
  showEnterOversold: false,
}

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function normalizeMarkerSize(value: unknown, fallback: number) {
  const size = Math.round(Number(value))
  return Number.isFinite(size) ? Math.max(8, Math.min(size, 96)) : fallback
}

function normalizeArrowSymbol(value: unknown, fallback: string) {
  return typeof value === 'string' && ['\u2191', '\u2193', '\u2190', '\u2192'].includes(value) ? value : fallback
}

export function normalizeMmfStochH2PassthroughPeriods(value: unknown): MmfStochH2PassthroughPeriod[] {
  if (!Array.isArray(value)) return [...defaultMmfStochH2IndicatorSettings.passthroughPeriods]
  const periods: MmfStochH2PassthroughPeriod[] = []
  value.forEach((item) => {
    const period = String(item || '').trim().toUpperCase()
    if (!mmfStochH2PassthroughPeriods.includes(period as MmfStochH2PassthroughPeriod)) return
    if (!periods.includes(period as MmfStochH2PassthroughPeriod)) periods.push(period as MmfStochH2PassthroughPeriod)
  })
  return periods
}

export function normalizeMmfStochH2Settings(input?: Partial<MmfStochH2IndicatorSettings>): MmfStochH2IndicatorSettings {
  const merged = { ...defaultMmfStochH2IndicatorSettings, ...(input ?? {}) }
  return {
    closeOverboughtColor: normalizeColor(merged.closeOverboughtColor, defaultMmfStochH2IndicatorSettings.closeOverboughtColor),
    closeOverboughtSize: normalizeMarkerSize(merged.closeOverboughtSize, defaultMmfStochH2IndicatorSettings.closeOverboughtSize),
    closeOverboughtSymbol: normalizeArrowSymbol(merged.closeOverboughtSymbol, defaultMmfStochH2IndicatorSettings.closeOverboughtSymbol),
    closeOversoldColor: normalizeColor(merged.closeOversoldColor, defaultMmfStochH2IndicatorSettings.closeOversoldColor),
    closeOversoldSize: normalizeMarkerSize(merged.closeOversoldSize, defaultMmfStochH2IndicatorSettings.closeOversoldSize),
    closeOversoldSymbol: normalizeArrowSymbol(merged.closeOversoldSymbol, defaultMmfStochH2IndicatorSettings.closeOversoldSymbol),
    enterOverboughtColor: normalizeColor(merged.enterOverboughtColor, defaultMmfStochH2IndicatorSettings.enterOverboughtColor),
    enterOverboughtSize: normalizeMarkerSize(merged.enterOverboughtSize, defaultMmfStochH2IndicatorSettings.enterOverboughtSize),
    enterOverboughtSymbol: normalizeArrowSymbol(merged.enterOverboughtSymbol, defaultMmfStochH2IndicatorSettings.enterOverboughtSymbol),
    enterOversoldColor: normalizeColor(merged.enterOversoldColor, defaultMmfStochH2IndicatorSettings.enterOversoldColor),
    enterOversoldSize: normalizeMarkerSize(merged.enterOversoldSize, defaultMmfStochH2IndicatorSettings.enterOversoldSize),
    enterOversoldSymbol: normalizeArrowSymbol(merged.enterOversoldSymbol, defaultMmfStochH2IndicatorSettings.enterOversoldSymbol),
    passthroughPeriods: normalizeMmfStochH2PassthroughPeriods(merged.passthroughPeriods),
    passthroughVisible: merged.passthroughVisible === true,
    showCloseOverbought: merged.showCloseOverbought === true,
    showCloseOversold: merged.showCloseOversold === true,
    showEnterOverbought: merged.showEnterOverbought === true,
    showEnterOversold: merged.showEnterOversold === true,
  }
}
