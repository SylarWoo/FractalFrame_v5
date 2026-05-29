export type MmfMorganRatio = number

export type MmfIndicatorSettings = {
  dpoValue: number
  highColor: string
  highMorganRatio: MmfMorganRatio
  highOffsetPercent: number
  highSize: number
  highAnchorLookbackBars: number
  highStochKAdvance: number
  highConfirmLookaheadBars: number
  highSymbol: string
  deadCrossColor: string
  deadCrossSize: number
  deadCrossSymbol: string
  highConfirmPointColor: string
  highConfirmPointSize: number
  highConfirmPointSymbol: string
  lowColor: string
  lowDpoValue: number
  lowMorganRatio: MmfMorganRatio
  lowOffsetPercent: number
  lowSize: number
  lowAnchorLookbackBars: number
  lowStochKAdvance: number
  lowConfirmLookaheadBars: number
  lowSymbol: string
  goldenCrossColor: string
  goldenCrossSize: number
  goldenCrossSymbol: string
  lowConfirmPointColor: string
  lowConfirmPointSize: number
  lowConfirmPointSymbol: string
  lowPositionHighColor: string
  lowPositionHighSize: number
  lowPositionHighSymbol: string
  highPositionLowColor: string
  highPositionLowSize: number
  highPositionLowSymbol: string
  trendDownReturnColor: string
  trendDownReturnMorganRatio: MmfMorganRatio
  trendDownReturnSize: number
  trendDownReturnSymbol: string
  trendDownReturnVdoThreshold: number
  trendDownDivergenceColor: string
  trendDownDivergenceSize: number
  trendDownDivergenceSymbol: string
  trendDownDivergenceVdoThreshold: number
  trendUpReturnColor: string
  trendUpReturnMorganRatio: MmfMorganRatio
  trendUpReturnSize: number
  trendUpReturnSymbol: string
  trendUpReturnVdoThreshold: number
  trendUpDivergenceColor: string
  trendUpDivergenceSize: number
  trendUpDivergenceSymbol: string
  trendUpDivergenceVdoThreshold: number
  bottomDivergenceColor: string
  bottomDivergenceSize: number
  bottomDivergenceSymbol: string
  bottomDivergenceVdoThreshold: number
  topDivergenceColor: string
  topDivergenceSize: number
  topDivergenceSymbol: string
  topDivergenceVdoThreshold: number
  upBreakConfirmColor: string
  upBreakConfirmSize: number
  upBreakConfirmSymbol: string
  upBreakConfirmVdoThreshold: number
  downBreakConfirmColor: string
  downBreakConfirmSize: number
  downBreakConfirmSymbol: string
  downBreakConfirmVdoThreshold: number
  oscHighDivergenceColor: string
  oscHighDivergenceSize: number
  oscHighDivergenceSymbol: string
  oscHighDivergenceVdoThreshold: number
  oscLowDivergenceColor: string
  oscLowDivergenceSize: number
  oscLowDivergenceSymbol: string
  oscLowDivergenceVdoThreshold: number
  pullbackColor: string
  pullbackSize: number
  pullbackSymbol: string
  pullbackVdoThreshold: number
  reboundColor: string
  reboundSize: number
  reboundSymbol: string
  reboundVdoThreshold: number
  trendDownReboundColor: string
  trendDownReboundSize: number
  trendDownReboundSymbol: string
  trendDownDivergencePointColor: string
  trendDownDivergenceMorganRatio: MmfMorganRatio
  trendDownDivergencePointSize: number
  trendDownDivergencePointSymbol: string
  trendUpPullbackColor: string
  trendUpPullbackSize: number
  trendUpPullbackSymbol: string
  trendUpDivergencePointColor: string
  trendUpDivergenceMorganRatio: MmfMorganRatio
  trendUpDivergencePointSize: number
  trendUpDivergencePointSymbol: string
  resistanceColor: string
  resistanceSize: number
  resistanceSymbol: string
  expectedResistanceColor: string
  expectedResistanceSize: number
  expectedResistanceSymbol: string
  resistanceDownBreakColor: string
  resistanceDownBreakSize: number
  resistanceDownBreakSymbol: string
  resistanceUpBreakColor: string
  resistanceUpBreakSize: number
  resistanceUpBreakSymbol: string
  resistanceVdoLower: number
  resistanceVdoUpper: number
  downBreakVdoLower: number
  downBreakVdoUpper: number
  downBreakColor: string
  downBreakSize: number
  downBreakSymbol: string
  showResistanceLevel: boolean
  showExpectedResistanceLevel: boolean
  showResistanceDownBreakPoint: boolean
  showResistanceUpBreakPoint: boolean
  showBottomDivergencePoint: boolean
  showDownBreakConfirmPoint: boolean
  showHigh: boolean
  showHighPositionLowPoint: boolean
  showLow: boolean
  showLowPositionHighPoint: boolean
  showDeadCross: boolean
  showGoldenCross: boolean
  showHighConfirmPoint: boolean
  showLowConfirmPoint: boolean
  showOscHighDivergencePoint: boolean
  showOscLowDivergencePoint: boolean
  showPullbackPoint: boolean
  showReboundPoint: boolean
  showTrendDownReboundPoint: boolean
  showTrendDownDivergencePointV2: boolean
  showTrendUpPullbackPoint: boolean
  showTrendUpDivergencePointV2: boolean
  showTrendDownDivergencePoint: boolean
  showTrendDownReturnPoint: boolean
  showTrendUpDivergencePoint: boolean
  showTrendUpReturnPoint: boolean
  showTopDivergencePoint: boolean
  showUpBreakConfirmPoint: boolean
  showDownBreakPoint: boolean
  showSupportLevel: boolean
  showExpectedSupportLevel: boolean
  showSupportDownBreakPoint: boolean
  showSupportUpBreakPoint: boolean
  showTrendDownPoint: boolean
  showTrendUpPoint: boolean
  showUpBreakPoint: boolean
  supportColor: string
  supportSize: number
  supportSymbol: string
  expectedSupportColor: string
  expectedSupportSize: number
  expectedSupportSymbol: string
  supportDownBreakColor: string
  supportDownBreakSize: number
  supportDownBreakSymbol: string
  supportUpBreakColor: string
  supportUpBreakSize: number
  supportUpBreakSymbol: string
  supportVdoLower: number
  supportVdoUpper: number
  trendDownColor: string
  trendDownSize: number
  trendDownSymbol: string
  trendDownVdoLower: number
  trendDownVdoUpper: number
  trendUpColor: string
  trendUpSize: number
  trendUpSymbol: string
  trendUpVdoLower: number
  trendUpVdoUpper: number
  upBreakColor: string
  upBreakSize: number
  upBreakSymbol: string
  upBreakVdoLower: number
  upBreakVdoUpper: number
  showVdoMomentumFloatingPanel: boolean
  vdoBreakoutMomentumDownLookback: number
  vdoBreakoutMomentumUpLookback: number
  vdoCloseMomentumDownLookback: number
  vdoCloseMomentumUpLookback: number
  vdoMomentumDownAverage: number
  vdoMomentumDownLookback: number
  vdoMomentumExceedPercent: number
  vdoMomentumUpAverage: number
  vdoMomentumUpLookback: number
}

export const defaultMmfIndicatorSettings: MmfIndicatorSettings = {
  dpoValue: 11,
  highColor: '#ef5350',
  highMorganRatio: 0.118,
  highOffsetPercent: 0,
  highSize: 24,
  highAnchorLookbackBars: 14,
  highStochKAdvance: 10,
  highConfirmLookaheadBars: 7,
  highSymbol: '\u25c6',
  deadCrossColor: '#ef5350',
  deadCrossSize: 16,
  deadCrossSymbol: '\u2715',
  highConfirmPointColor: '#ef5350',
  highConfirmPointSize: 16,
  highConfirmPointSymbol: '\u2193',
  lowColor: '#26a69a',
  lowDpoValue: -11,
  lowMorganRatio: -0.118,
  lowOffsetPercent: 0,
  lowSize: 24,
  lowAnchorLookbackBars: 14,
  lowStochKAdvance: 10,
  lowConfirmLookaheadBars: 7,
  lowSymbol: '\u25c6',
  goldenCrossColor: '#26a69a',
  goldenCrossSize: 16,
  goldenCrossSymbol: '\u2715',
  lowConfirmPointColor: '#26a69a',
  lowConfirmPointSize: 16,
  lowConfirmPointSymbol: '\u2191',
  lowPositionHighColor: '#ef5350',
  lowPositionHighSize: 24,
  lowPositionHighSymbol: '\u21d3',
  highPositionLowColor: '#26a69a',
  highPositionLowSize: 24,
  highPositionLowSymbol: '\u21d1',
  trendDownReturnColor: '#ef5350',
  trendDownReturnMorganRatio: 0.25,
  trendDownReturnSize: 24,
  trendDownReturnSymbol: '\u25c6',
  trendDownReturnVdoThreshold: -0.1,
  trendDownDivergenceColor: '#ef5350',
  trendDownDivergenceSize: 24,
  trendDownDivergenceSymbol: '\u25c6',
  trendDownDivergenceVdoThreshold: -0.05,
  trendUpReturnColor: '#26a69a',
  trendUpReturnMorganRatio: 0.25,
  trendUpReturnSize: 24,
  trendUpReturnSymbol: '\u25c6',
  trendUpReturnVdoThreshold: 0.1,
  trendUpDivergenceColor: '#26a69a',
  trendUpDivergenceSize: 24,
  trendUpDivergenceSymbol: '\u25c6',
  trendUpDivergenceVdoThreshold: 0.05,
  bottomDivergenceColor: '#26a69a',
  bottomDivergenceSize: 24,
  bottomDivergenceSymbol: '\u25c6',
  bottomDivergenceVdoThreshold: -0.1,
  topDivergenceColor: '#ef5350',
  topDivergenceSize: 24,
  topDivergenceSymbol: '\u25c6',
  topDivergenceVdoThreshold: 0.1,
  upBreakConfirmColor: '#26a69a',
  upBreakConfirmSize: 24,
  upBreakConfirmSymbol: '\u25c6',
  upBreakConfirmVdoThreshold: 0.1,
  downBreakConfirmColor: '#ef5350',
  downBreakConfirmSize: 24,
  downBreakConfirmSymbol: '\u25c6',
  downBreakConfirmVdoThreshold: -0.1,
  oscHighDivergenceColor: '#ef5350',
  oscHighDivergenceSize: 24,
  oscHighDivergenceSymbol: '\u25c6',
  oscHighDivergenceVdoThreshold: -0.05,
  oscLowDivergenceColor: '#26a69a',
  oscLowDivergenceSize: 24,
  oscLowDivergenceSymbol: '\u25c6',
  oscLowDivergenceVdoThreshold: 0.05,
  pullbackColor: '#ef5350',
  pullbackSize: 24,
  pullbackSymbol: '\u25c6',
  pullbackVdoThreshold: -0.1,
  reboundColor: '#26a69a',
  reboundSize: 24,
  reboundSymbol: '\u25c6',
  reboundVdoThreshold: 0.1,
  trendDownReboundColor: '#26a69a',
  trendDownReboundSize: 24,
  trendDownReboundSymbol: '\u25c6',
  trendDownDivergencePointColor: '#ef5350',
  trendDownDivergenceMorganRatio: 0.375,
  trendDownDivergencePointSize: 24,
  trendDownDivergencePointSymbol: '\u25c6',
  trendUpPullbackColor: '#ef5350',
  trendUpPullbackSize: 24,
  trendUpPullbackSymbol: '\u25c6',
  trendUpDivergencePointColor: '#26a69a',
  trendUpDivergenceMorganRatio: 0.375,
  trendUpDivergencePointSize: 24,
  trendUpDivergencePointSymbol: '\u25c6',
  resistanceColor: '#ef5350',
  resistanceSize: 24,
  resistanceSymbol: '\u25c6',
  expectedResistanceColor: '#ef5350',
  expectedResistanceSize: 24,
  expectedResistanceSymbol: '\u25c7',
  resistanceDownBreakColor: '#ef5350',
  resistanceDownBreakSize: 24,
  resistanceDownBreakSymbol: '\u25c6',
  resistanceUpBreakColor: '#26a69a',
  resistanceUpBreakSize: 24,
  resistanceUpBreakSymbol: '\u25c6',
  resistanceVdoLower: 0.05,
  resistanceVdoUpper: 0.1,
  downBreakVdoLower: -0.05,
  downBreakVdoUpper: 0.05,
  downBreakColor: '#ef5350',
  downBreakSize: 24,
  downBreakSymbol: '\u25c6',
  showResistanceLevel: false,
  showExpectedResistanceLevel: false,
  showResistanceDownBreakPoint: false,
  showResistanceUpBreakPoint: false,
  showBottomDivergencePoint: false,
  showDownBreakConfirmPoint: false,
  showHigh: true,
  showHighPositionLowPoint: false,
  showLow: false,
  showLowPositionHighPoint: false,
  showDeadCross: false,
  showGoldenCross: false,
  showHighConfirmPoint: true,
  showLowConfirmPoint: true,
  showOscHighDivergencePoint: false,
  showOscLowDivergencePoint: false,
  showPullbackPoint: false,
  showReboundPoint: false,
  showTrendDownReboundPoint: false,
  showTrendDownDivergencePointV2: false,
  showTrendUpPullbackPoint: false,
  showTrendUpDivergencePointV2: false,
  showTrendDownDivergencePoint: false,
  showTrendDownReturnPoint: false,
  showTrendUpDivergencePoint: false,
  showTrendUpReturnPoint: false,
  showTopDivergencePoint: false,
  showUpBreakConfirmPoint: false,
  showDownBreakPoint: false,
  showSupportLevel: false,
  showExpectedSupportLevel: false,
  showSupportDownBreakPoint: false,
  showSupportUpBreakPoint: false,
  showTrendDownPoint: false,
  showTrendUpPoint: false,
  showUpBreakPoint: false,
  supportColor: '#26a69a',
  supportSize: 24,
  supportSymbol: '\u25c6',
  expectedSupportColor: '#26a69a',
  expectedSupportSize: 24,
  expectedSupportSymbol: '\u25c7',
  supportDownBreakColor: '#ef5350',
  supportDownBreakSize: 24,
  supportDownBreakSymbol: '\u25c6',
  supportUpBreakColor: '#26a69a',
  supportUpBreakSize: 24,
  supportUpBreakSymbol: '\u25c6',
  supportVdoLower: -0.1,
  supportVdoUpper: -0.05,
  trendDownColor: '#ef5350',
  trendDownSize: 24,
  trendDownSymbol: '\u25c6',
  trendDownVdoLower: -0.05,
  trendDownVdoUpper: -0.1,
  trendUpColor: '#26a69a',
  trendUpSize: 24,
  trendUpSymbol: '\u25c6',
  trendUpVdoLower: -0.05,
  trendUpVdoUpper: 0.1,
  upBreakColor: '#26a69a',
  upBreakSize: 24,
  upBreakSymbol: '\u25c6',
  upBreakVdoLower: -0.05,
  upBreakVdoUpper: 0.05,
  showVdoMomentumFloatingPanel: true,
  vdoBreakoutMomentumDownLookback: 0,
  vdoBreakoutMomentumUpLookback: 0,
  vdoCloseMomentumDownLookback: 0,
  vdoCloseMomentumUpLookback: 0,
  vdoMomentumDownAverage: 20,
  vdoMomentumDownLookback: 0,
  vdoMomentumExceedPercent: 0,
  vdoMomentumUpAverage: 20,
  vdoMomentumUpLookback: 0,
}

export function normalizeMmfSettings(input?: Partial<MmfIndicatorSettings>): MmfIndicatorSettings {
  const legacy = (input ?? {}) as Partial<Record<string, unknown>>
  const merged = { ...defaultMmfIndicatorSettings, ...(input ?? {}) }
  const hasHighConfirmPointColor = Object.prototype.hasOwnProperty.call(legacy, 'highConfirmPointColor')
  const hasHighConfirmPointSize = Object.prototype.hasOwnProperty.call(legacy, 'highConfirmPointSize')
  const hasHighConfirmPointSymbol = Object.prototype.hasOwnProperty.call(legacy, 'highConfirmPointSymbol')
  const hasLowConfirmPointColor = Object.prototype.hasOwnProperty.call(legacy, 'lowConfirmPointColor')
  const hasLowConfirmPointSize = Object.prototype.hasOwnProperty.call(legacy, 'lowConfirmPointSize')
  const hasLowConfirmPointSymbol = Object.prototype.hasOwnProperty.call(legacy, 'lowConfirmPointSymbol')
  const hasShowHighConfirmPoint = Object.prototype.hasOwnProperty.call(legacy, 'showHighConfirmPoint')
  const hasShowLowConfirmPoint = Object.prototype.hasOwnProperty.call(legacy, 'showLowConfirmPoint')
  const highOffsetPercent = Number(merged.highOffsetPercent)
  const lowOffsetPercent = Number(merged.lowOffsetPercent)
  const highSize = Math.round(Number(merged.highSize))
  const lowSize = Math.round(Number(merged.lowSize))
  const deadCrossSize = Math.round(Number(merged.deadCrossSize))
  const goldenCrossSize = Math.round(Number(merged.goldenCrossSize))
  const highConfirmPointSize = Math.round(Number(hasHighConfirmPointSize ? merged.highConfirmPointSize : legacy.sellSize ?? merged.highConfirmPointSize))
  const lowConfirmPointSize = Math.round(Number(hasLowConfirmPointSize ? merged.lowConfirmPointSize : legacy.buySize ?? merged.lowConfirmPointSize))
  const highAnchorLookbackBars = Math.round(Number(merged.highAnchorLookbackBars))
  const lowAnchorLookbackBars = Math.round(Number(merged.lowAnchorLookbackBars))
  const highStochKAdvance = Number(merged.highStochKAdvance)
  const lowStochKAdvance = Number(merged.lowStochKAdvance)
  const highConfirmLookaheadBars = Math.round(Number(merged.highConfirmLookaheadBars))
  const lowConfirmLookaheadBars = Math.round(Number(merged.lowConfirmLookaheadBars))
  const highColor = typeof merged.highColor === 'string' && merged.highColor.trim() ? merged.highColor : defaultMmfIndicatorSettings.highColor
  const highSymbol = typeof merged.highSymbol === 'string' && merged.highSymbol.trim() ? merged.highSymbol : defaultMmfIndicatorSettings.highSymbol
  const deadCrossColor = typeof merged.deadCrossColor === 'string' && merged.deadCrossColor.trim() ? merged.deadCrossColor : defaultMmfIndicatorSettings.deadCrossColor
  const deadCrossSymbol = typeof merged.deadCrossSymbol === 'string' && merged.deadCrossSymbol.trim() ? merged.deadCrossSymbol : defaultMmfIndicatorSettings.deadCrossSymbol
  const legacySellColor = legacy.sellColor
  const legacySellSymbol = legacy.sellSymbol
  const highConfirmPointColor = hasHighConfirmPointColor && typeof merged.highConfirmPointColor === 'string' && merged.highConfirmPointColor.trim()
    ? merged.highConfirmPointColor
    : typeof legacySellColor === 'string' && legacySellColor.trim()
      ? legacySellColor
      : defaultMmfIndicatorSettings.highConfirmPointColor
  const highConfirmPointSymbol = hasHighConfirmPointSymbol && typeof merged.highConfirmPointSymbol === 'string' && merged.highConfirmPointSymbol.trim()
    ? merged.highConfirmPointSymbol
    : typeof legacySellSymbol === 'string' && legacySellSymbol.trim()
      ? legacySellSymbol
      : defaultMmfIndicatorSettings.highConfirmPointSymbol
  const lowColor = typeof merged.lowColor === 'string' && merged.lowColor.trim() ? merged.lowColor : defaultMmfIndicatorSettings.lowColor
  const lowSymbol = typeof merged.lowSymbol === 'string' && merged.lowSymbol.trim() ? merged.lowSymbol : defaultMmfIndicatorSettings.lowSymbol
  const goldenCrossColor = typeof merged.goldenCrossColor === 'string' && merged.goldenCrossColor.trim() ? merged.goldenCrossColor : defaultMmfIndicatorSettings.goldenCrossColor
  const goldenCrossSymbol = typeof merged.goldenCrossSymbol === 'string' && merged.goldenCrossSymbol.trim() ? merged.goldenCrossSymbol : defaultMmfIndicatorSettings.goldenCrossSymbol
  const legacyBuyColor = legacy.buyColor
  const legacyBuySymbol = legacy.buySymbol
  const lowConfirmPointColor = hasLowConfirmPointColor && typeof merged.lowConfirmPointColor === 'string' && merged.lowConfirmPointColor.trim()
    ? merged.lowConfirmPointColor
    : typeof legacyBuyColor === 'string' && legacyBuyColor.trim()
      ? legacyBuyColor
      : defaultMmfIndicatorSettings.lowConfirmPointColor
  const lowConfirmPointSymbol = hasLowConfirmPointSymbol && typeof merged.lowConfirmPointSymbol === 'string' && merged.lowConfirmPointSymbol.trim()
    ? merged.lowConfirmPointSymbol
    : typeof legacyBuySymbol === 'string' && legacyBuySymbol.trim()
      ? legacyBuySymbol
      : defaultMmfIndicatorSettings.lowConfirmPointSymbol
  const lowPositionHighColor = typeof merged.lowPositionHighColor === 'string' && merged.lowPositionHighColor.trim() ? merged.lowPositionHighColor : defaultMmfIndicatorSettings.lowPositionHighColor
  const lowPositionHighSymbol = typeof merged.lowPositionHighSymbol === 'string' && merged.lowPositionHighSymbol.trim() ? merged.lowPositionHighSymbol : defaultMmfIndicatorSettings.lowPositionHighSymbol
  const highPositionLowColor = typeof merged.highPositionLowColor === 'string' && merged.highPositionLowColor.trim() ? merged.highPositionLowColor : defaultMmfIndicatorSettings.highPositionLowColor
  const highPositionLowSymbol = typeof merged.highPositionLowSymbol === 'string' && merged.highPositionLowSymbol.trim() ? merged.highPositionLowSymbol : defaultMmfIndicatorSettings.highPositionLowSymbol
  const trendDownReturnColor = typeof merged.trendDownReturnColor === 'string' && merged.trendDownReturnColor.trim() ? merged.trendDownReturnColor : defaultMmfIndicatorSettings.trendDownReturnColor
  const trendDownReturnSymbol = typeof merged.trendDownReturnSymbol === 'string' && merged.trendDownReturnSymbol.trim() ? merged.trendDownReturnSymbol : defaultMmfIndicatorSettings.trendDownReturnSymbol
  const trendDownDivergenceColor = typeof merged.trendDownDivergenceColor === 'string' && merged.trendDownDivergenceColor.trim() ? merged.trendDownDivergenceColor : defaultMmfIndicatorSettings.trendDownDivergenceColor
  const trendDownDivergenceSymbol = typeof merged.trendDownDivergenceSymbol === 'string' && merged.trendDownDivergenceSymbol.trim() ? merged.trendDownDivergenceSymbol : defaultMmfIndicatorSettings.trendDownDivergenceSymbol
  const trendUpReturnColor = typeof merged.trendUpReturnColor === 'string' && merged.trendUpReturnColor.trim() ? merged.trendUpReturnColor : defaultMmfIndicatorSettings.trendUpReturnColor
  const trendUpReturnSymbol = typeof merged.trendUpReturnSymbol === 'string' && merged.trendUpReturnSymbol.trim() ? merged.trendUpReturnSymbol : defaultMmfIndicatorSettings.trendUpReturnSymbol
  const trendUpDivergenceColor = typeof merged.trendUpDivergenceColor === 'string' && merged.trendUpDivergenceColor.trim() ? merged.trendUpDivergenceColor : defaultMmfIndicatorSettings.trendUpDivergenceColor
  const trendUpDivergenceSymbol = typeof merged.trendUpDivergenceSymbol === 'string' && merged.trendUpDivergenceSymbol.trim() ? merged.trendUpDivergenceSymbol : defaultMmfIndicatorSettings.trendUpDivergenceSymbol
  const bottomDivergenceColor = typeof merged.bottomDivergenceColor === 'string' && merged.bottomDivergenceColor.trim() ? merged.bottomDivergenceColor : defaultMmfIndicatorSettings.bottomDivergenceColor
  const bottomDivergenceSymbol = typeof merged.bottomDivergenceSymbol === 'string' && merged.bottomDivergenceSymbol.trim() ? merged.bottomDivergenceSymbol : defaultMmfIndicatorSettings.bottomDivergenceSymbol
  const topDivergenceColor = typeof merged.topDivergenceColor === 'string' && merged.topDivergenceColor.trim() ? merged.topDivergenceColor : defaultMmfIndicatorSettings.topDivergenceColor
  const topDivergenceSymbol = typeof merged.topDivergenceSymbol === 'string' && merged.topDivergenceSymbol.trim() ? merged.topDivergenceSymbol : defaultMmfIndicatorSettings.topDivergenceSymbol
  const upBreakConfirmColor = typeof merged.upBreakConfirmColor === 'string' && merged.upBreakConfirmColor.trim() ? merged.upBreakConfirmColor : defaultMmfIndicatorSettings.upBreakConfirmColor
  const upBreakConfirmSymbol = typeof merged.upBreakConfirmSymbol === 'string' && merged.upBreakConfirmSymbol.trim() ? merged.upBreakConfirmSymbol : defaultMmfIndicatorSettings.upBreakConfirmSymbol
  const downBreakConfirmColor = typeof merged.downBreakConfirmColor === 'string' && merged.downBreakConfirmColor.trim() ? merged.downBreakConfirmColor : defaultMmfIndicatorSettings.downBreakConfirmColor
  const downBreakConfirmSymbol = typeof merged.downBreakConfirmSymbol === 'string' && merged.downBreakConfirmSymbol.trim() ? merged.downBreakConfirmSymbol : defaultMmfIndicatorSettings.downBreakConfirmSymbol
  const oscHighDivergenceColor = typeof merged.oscHighDivergenceColor === 'string' && merged.oscHighDivergenceColor.trim() ? merged.oscHighDivergenceColor : defaultMmfIndicatorSettings.oscHighDivergenceColor
  const oscHighDivergenceSymbol = typeof merged.oscHighDivergenceSymbol === 'string' && merged.oscHighDivergenceSymbol.trim() ? merged.oscHighDivergenceSymbol : defaultMmfIndicatorSettings.oscHighDivergenceSymbol
  const oscLowDivergenceColor = typeof merged.oscLowDivergenceColor === 'string' && merged.oscLowDivergenceColor.trim() ? merged.oscLowDivergenceColor : defaultMmfIndicatorSettings.oscLowDivergenceColor
  const oscLowDivergenceSymbol = typeof merged.oscLowDivergenceSymbol === 'string' && merged.oscLowDivergenceSymbol.trim() ? merged.oscLowDivergenceSymbol : defaultMmfIndicatorSettings.oscLowDivergenceSymbol
  const pullbackColor = typeof merged.pullbackColor === 'string' && merged.pullbackColor.trim() ? merged.pullbackColor : defaultMmfIndicatorSettings.pullbackColor
  const pullbackSymbol = typeof merged.pullbackSymbol === 'string' && merged.pullbackSymbol.trim() ? merged.pullbackSymbol : defaultMmfIndicatorSettings.pullbackSymbol
  const reboundColor = typeof merged.reboundColor === 'string' && merged.reboundColor.trim() ? merged.reboundColor : defaultMmfIndicatorSettings.reboundColor
  const reboundSymbol = typeof merged.reboundSymbol === 'string' && merged.reboundSymbol.trim() ? merged.reboundSymbol : defaultMmfIndicatorSettings.reboundSymbol
  const trendDownReboundColor = typeof merged.trendDownReboundColor === 'string' && merged.trendDownReboundColor.trim() ? merged.trendDownReboundColor : defaultMmfIndicatorSettings.trendDownReboundColor
  const trendDownReboundSymbol = typeof merged.trendDownReboundSymbol === 'string' && merged.trendDownReboundSymbol.trim() ? merged.trendDownReboundSymbol : defaultMmfIndicatorSettings.trendDownReboundSymbol
  const trendDownDivergencePointColor = typeof merged.trendDownDivergencePointColor === 'string' && merged.trendDownDivergencePointColor.trim() ? merged.trendDownDivergencePointColor : defaultMmfIndicatorSettings.trendDownDivergencePointColor
  const trendDownDivergencePointSymbol = typeof merged.trendDownDivergencePointSymbol === 'string' && merged.trendDownDivergencePointSymbol.trim() ? merged.trendDownDivergencePointSymbol : defaultMmfIndicatorSettings.trendDownDivergencePointSymbol
  const trendUpPullbackColor = typeof merged.trendUpPullbackColor === 'string' && merged.trendUpPullbackColor.trim() ? merged.trendUpPullbackColor : defaultMmfIndicatorSettings.trendUpPullbackColor
  const trendUpPullbackSymbol = typeof merged.trendUpPullbackSymbol === 'string' && merged.trendUpPullbackSymbol.trim() ? merged.trendUpPullbackSymbol : defaultMmfIndicatorSettings.trendUpPullbackSymbol
  const trendUpDivergencePointColor = typeof merged.trendUpDivergencePointColor === 'string' && merged.trendUpDivergencePointColor.trim() ? merged.trendUpDivergencePointColor : defaultMmfIndicatorSettings.trendUpDivergencePointColor
  const trendUpDivergencePointSymbol = typeof merged.trendUpDivergencePointSymbol === 'string' && merged.trendUpDivergencePointSymbol.trim() ? merged.trendUpDivergencePointSymbol : defaultMmfIndicatorSettings.trendUpDivergencePointSymbol
  const upBreakColor = typeof merged.upBreakColor === 'string' && merged.upBreakColor.trim() ? merged.upBreakColor : defaultMmfIndicatorSettings.upBreakColor
  const upBreakSymbol = typeof merged.upBreakSymbol === 'string' && merged.upBreakSymbol.trim() ? merged.upBreakSymbol : defaultMmfIndicatorSettings.upBreakSymbol
  const downBreakColor = typeof merged.downBreakColor === 'string' && merged.downBreakColor.trim() ? merged.downBreakColor : defaultMmfIndicatorSettings.downBreakColor
  const downBreakSymbol = typeof merged.downBreakSymbol === 'string' && merged.downBreakSymbol.trim() ? merged.downBreakSymbol : defaultMmfIndicatorSettings.downBreakSymbol
  const resistanceColor = typeof merged.resistanceColor === 'string' && merged.resistanceColor.trim() ? merged.resistanceColor : defaultMmfIndicatorSettings.resistanceColor
  const resistanceSymbol = typeof merged.resistanceSymbol === 'string' && merged.resistanceSymbol.trim() ? merged.resistanceSymbol : defaultMmfIndicatorSettings.resistanceSymbol
  const expectedResistanceColor = typeof merged.expectedResistanceColor === 'string' && merged.expectedResistanceColor.trim() ? merged.expectedResistanceColor : defaultMmfIndicatorSettings.expectedResistanceColor
  const expectedResistanceSymbol = typeof merged.expectedResistanceSymbol === 'string' && merged.expectedResistanceSymbol.trim() ? merged.expectedResistanceSymbol : defaultMmfIndicatorSettings.expectedResistanceSymbol
  const resistanceDownBreakColor = typeof merged.resistanceDownBreakColor === 'string' && merged.resistanceDownBreakColor.trim() ? merged.resistanceDownBreakColor : defaultMmfIndicatorSettings.resistanceDownBreakColor
  const resistanceDownBreakSymbol = typeof merged.resistanceDownBreakSymbol === 'string' && merged.resistanceDownBreakSymbol.trim() ? merged.resistanceDownBreakSymbol : defaultMmfIndicatorSettings.resistanceDownBreakSymbol
  const resistanceUpBreakColor = typeof merged.resistanceUpBreakColor === 'string' && merged.resistanceUpBreakColor.trim() ? merged.resistanceUpBreakColor : defaultMmfIndicatorSettings.resistanceUpBreakColor
  const resistanceUpBreakSymbol = typeof merged.resistanceUpBreakSymbol === 'string' && merged.resistanceUpBreakSymbol.trim() ? merged.resistanceUpBreakSymbol : defaultMmfIndicatorSettings.resistanceUpBreakSymbol
  const supportColor = typeof merged.supportColor === 'string' && merged.supportColor.trim() ? merged.supportColor : defaultMmfIndicatorSettings.supportColor
  const supportSymbol = typeof merged.supportSymbol === 'string' && merged.supportSymbol.trim() ? merged.supportSymbol : defaultMmfIndicatorSettings.supportSymbol
  const expectedSupportColor = typeof merged.expectedSupportColor === 'string' && merged.expectedSupportColor.trim() ? merged.expectedSupportColor : defaultMmfIndicatorSettings.expectedSupportColor
  const expectedSupportSymbol = typeof merged.expectedSupportSymbol === 'string' && merged.expectedSupportSymbol.trim() ? merged.expectedSupportSymbol : defaultMmfIndicatorSettings.expectedSupportSymbol
  const supportDownBreakColor = typeof merged.supportDownBreakColor === 'string' && merged.supportDownBreakColor.trim() ? merged.supportDownBreakColor : defaultMmfIndicatorSettings.supportDownBreakColor
  const supportDownBreakSymbol = typeof merged.supportDownBreakSymbol === 'string' && merged.supportDownBreakSymbol.trim() ? merged.supportDownBreakSymbol : defaultMmfIndicatorSettings.supportDownBreakSymbol
  const supportUpBreakColor = typeof merged.supportUpBreakColor === 'string' && merged.supportUpBreakColor.trim() ? merged.supportUpBreakColor : defaultMmfIndicatorSettings.supportUpBreakColor
  const supportUpBreakSymbol = typeof merged.supportUpBreakSymbol === 'string' && merged.supportUpBreakSymbol.trim() ? merged.supportUpBreakSymbol : defaultMmfIndicatorSettings.supportUpBreakSymbol
  const trendDownColor = typeof merged.trendDownColor === 'string' && merged.trendDownColor.trim() ? merged.trendDownColor : defaultMmfIndicatorSettings.trendDownColor
  const trendDownSymbol = typeof merged.trendDownSymbol === 'string' && merged.trendDownSymbol.trim() ? merged.trendDownSymbol : defaultMmfIndicatorSettings.trendDownSymbol
  const trendUpColor = typeof merged.trendUpColor === 'string' && merged.trendUpColor.trim() ? merged.trendUpColor : defaultMmfIndicatorSettings.trendUpColor
  const trendUpSymbol = typeof merged.trendUpSymbol === 'string' && merged.trendUpSymbol.trim() ? merged.trendUpSymbol : defaultMmfIndicatorSettings.trendUpSymbol
  const highMorganRatio = Number(merged.highMorganRatio)
  const lowMorganRatio = Number(merged.lowMorganRatio)
  const lowPositionHighSize = Math.round(Number(merged.lowPositionHighSize))
  const highPositionLowSize = Math.round(Number(merged.highPositionLowSize))
  const trendDownReturnMorganRatio = Number(merged.trendDownReturnMorganRatio)
  const trendUpReturnMorganRatio = Number(merged.trendUpReturnMorganRatio)
  const trendDownDivergenceMorganRatio = Number(merged.trendDownDivergenceMorganRatio)
  const trendUpDivergenceMorganRatio = Number(merged.trendUpDivergenceMorganRatio)
  const pullbackSize = Math.round(Number(merged.pullbackSize))
  const reboundSize = Math.round(Number(merged.reboundSize))
  const trendDownReboundSize = Math.round(Number(merged.trendDownReboundSize))
  const trendDownDivergencePointSize = Math.round(Number(merged.trendDownDivergencePointSize))
  const trendUpPullbackSize = Math.round(Number(merged.trendUpPullbackSize))
  const trendUpDivergencePointSize = Math.round(Number(merged.trendUpDivergencePointSize))
  const trendDownReturnSize = Math.round(Number(merged.trendDownReturnSize))
  const trendDownDivergenceSize = Math.round(Number(merged.trendDownDivergenceSize))
  const trendUpReturnSize = Math.round(Number(merged.trendUpReturnSize))
  const trendUpDivergenceSize = Math.round(Number(merged.trendUpDivergenceSize))
  const bottomDivergenceSize = Math.round(Number(merged.bottomDivergenceSize))
  const topDivergenceSize = Math.round(Number(merged.topDivergenceSize))
  const upBreakConfirmSize = Math.round(Number(merged.upBreakConfirmSize))
  const downBreakConfirmSize = Math.round(Number(merged.downBreakConfirmSize))
  const oscHighDivergenceSize = Math.round(Number(merged.oscHighDivergenceSize))
  const oscLowDivergenceSize = Math.round(Number(merged.oscLowDivergenceSize))
  const upBreakSize = Math.round(Number(merged.upBreakSize))
  const downBreakSize = Math.round(Number(merged.downBreakSize))
  const resistanceSize = Math.round(Number(merged.resistanceSize))
  const expectedResistanceSize = Math.round(Number(merged.expectedResistanceSize))
  const resistanceDownBreakSize = Math.round(Number(merged.resistanceDownBreakSize))
  const resistanceUpBreakSize = Math.round(Number(merged.resistanceUpBreakSize))
  const supportSize = Math.round(Number(merged.supportSize))
  const expectedSupportSize = Math.round(Number(merged.expectedSupportSize))
  const supportDownBreakSize = Math.round(Number(merged.supportDownBreakSize))
  const supportUpBreakSize = Math.round(Number(merged.supportUpBreakSize))
  const trendDownSize = Math.round(Number(merged.trendDownSize))
  const trendUpSize = Math.round(Number(merged.trendUpSize))
  const upBreakVdoLower = Number(merged.upBreakVdoLower)
  const upBreakVdoUpper = Number(merged.upBreakVdoUpper)
  const downBreakVdoLower = Number(merged.downBreakVdoLower)
  const downBreakVdoUpper = Number(merged.downBreakVdoUpper)
  const pullbackVdoThreshold = Number(merged.pullbackVdoThreshold)
  const reboundVdoThreshold = Number(merged.reboundVdoThreshold)
  const oscHighDivergenceVdoThreshold = Number(merged.oscHighDivergenceVdoThreshold)
  const oscLowDivergenceVdoThreshold = Number(merged.oscLowDivergenceVdoThreshold)
  const trendDownDivergenceVdoThreshold = Number(merged.trendDownDivergenceVdoThreshold)
  const trendUpDivergenceVdoThreshold = Number(merged.trendUpDivergenceVdoThreshold)
  const bottomDivergenceVdoThreshold = Number(merged.bottomDivergenceVdoThreshold)
  const topDivergenceVdoThreshold = Number(merged.topDivergenceVdoThreshold)
  const upBreakConfirmVdoThreshold = Number(merged.upBreakConfirmVdoThreshold)
  const downBreakConfirmVdoThreshold = Number(merged.downBreakConfirmVdoThreshold)
  const trendDownReturnVdoThreshold = Number(merged.trendDownReturnVdoThreshold)
  const trendUpReturnVdoThreshold = Number(merged.trendUpReturnVdoThreshold)
  const resistanceVdoLower = Number(merged.resistanceVdoLower)
  const resistanceVdoUpper = Number(merged.resistanceVdoUpper)
  const supportVdoLower = Number(merged.supportVdoLower)
  const supportVdoUpper = Number(merged.supportVdoUpper)
  const trendDownVdoLower = Number(merged.trendDownVdoLower)
  const trendDownVdoUpper = Number(merged.trendDownVdoUpper)
  const trendUpVdoLower = Number(merged.trendUpVdoLower)
  const trendUpVdoUpper = Number(merged.trendUpVdoUpper)
  const vdoMomentumDownAverage = Number(merged.vdoMomentumDownAverage)
  const vdoBreakoutMomentumDownLookback = Math.round(Number(merged.vdoBreakoutMomentumDownLookback))
  const vdoBreakoutMomentumUpLookback = Math.round(Number(merged.vdoBreakoutMomentumUpLookback))
  const vdoCloseMomentumDownLookback = Math.round(Number(merged.vdoCloseMomentumDownLookback))
  const vdoCloseMomentumUpLookback = Math.round(Number(merged.vdoCloseMomentumUpLookback))
  const vdoMomentumDownLookback = Math.round(Number(merged.vdoMomentumDownLookback))
  const vdoMomentumExceedPercent = Number(merged.vdoMomentumExceedPercent)
  const vdoMomentumUpAverage = Number(merged.vdoMomentumUpAverage)
  const vdoMomentumUpLookback = Math.round(Number(merged.vdoMomentumUpLookback))
  return {
    highColor,
    highMorganRatio: Number.isFinite(highMorganRatio) ? Math.max(0.118, Math.min(highMorganRatio, 0.236)) : defaultMmfIndicatorSettings.highMorganRatio,
    highOffsetPercent: Number.isFinite(highOffsetPercent) ? Math.max(-99, Math.min(Math.round(highOffsetPercent), 99)) : defaultMmfIndicatorSettings.highOffsetPercent,
    highSize: Number.isFinite(highSize) ? Math.max(8, Math.min(highSize, 96)) : defaultMmfIndicatorSettings.highSize,
    highAnchorLookbackBars: Number.isFinite(highAnchorLookbackBars) ? Math.max(1, Math.min(highAnchorLookbackBars, 200)) : defaultMmfIndicatorSettings.highAnchorLookbackBars,
    highStochKAdvance: Number.isFinite(highStochKAdvance) ? Math.max(0, Math.min(highStochKAdvance, 100)) : defaultMmfIndicatorSettings.highStochKAdvance,
    highConfirmLookaheadBars: Number.isFinite(highConfirmLookaheadBars) ? Math.max(1, Math.min(highConfirmLookaheadBars, 200)) : defaultMmfIndicatorSettings.highConfirmLookaheadBars,
    highSymbol,
    deadCrossColor,
    deadCrossSize: Number.isFinite(deadCrossSize) ? Math.max(8, Math.min(deadCrossSize, 96)) : defaultMmfIndicatorSettings.deadCrossSize,
    deadCrossSymbol,
    highConfirmPointColor,
    highConfirmPointSize: Number.isFinite(highConfirmPointSize) ? Math.max(8, Math.min(highConfirmPointSize, 96)) : defaultMmfIndicatorSettings.highConfirmPointSize,
    highConfirmPointSymbol,
    dpoValue: Number.isFinite(Number(merged.dpoValue)) ? Math.max(0, Math.min(Math.round(Number(merged.dpoValue)), 40)) : defaultMmfIndicatorSettings.dpoValue,
    lowColor,
    lowDpoValue: Number.isFinite(Number(merged.lowDpoValue)) ? Math.max(-40, Math.min(Math.round(Number(merged.lowDpoValue)), 0)) : defaultMmfIndicatorSettings.lowDpoValue,
    lowMorganRatio: Number.isFinite(lowMorganRatio) ? Math.max(-0.236, Math.min(lowMorganRatio, -0.118)) : defaultMmfIndicatorSettings.lowMorganRatio,
    lowOffsetPercent: Number.isFinite(lowOffsetPercent) ? Math.max(-99, Math.min(Math.round(lowOffsetPercent), 99)) : defaultMmfIndicatorSettings.lowOffsetPercent,
    lowSize: Number.isFinite(lowSize) ? Math.max(8, Math.min(lowSize, 96)) : defaultMmfIndicatorSettings.lowSize,
    lowAnchorLookbackBars: Number.isFinite(lowAnchorLookbackBars) ? Math.max(1, Math.min(lowAnchorLookbackBars, 200)) : defaultMmfIndicatorSettings.lowAnchorLookbackBars,
    lowStochKAdvance: Number.isFinite(lowStochKAdvance) ? Math.max(0, Math.min(lowStochKAdvance, 100)) : defaultMmfIndicatorSettings.lowStochKAdvance,
    lowConfirmLookaheadBars: Number.isFinite(lowConfirmLookaheadBars) ? Math.max(1, Math.min(lowConfirmLookaheadBars, 200)) : defaultMmfIndicatorSettings.lowConfirmLookaheadBars,
    lowSymbol,
    goldenCrossColor,
    goldenCrossSize: Number.isFinite(goldenCrossSize) ? Math.max(8, Math.min(goldenCrossSize, 96)) : defaultMmfIndicatorSettings.goldenCrossSize,
    goldenCrossSymbol,
    lowConfirmPointColor,
    lowConfirmPointSize: Number.isFinite(lowConfirmPointSize) ? Math.max(8, Math.min(lowConfirmPointSize, 96)) : defaultMmfIndicatorSettings.lowConfirmPointSize,
    lowConfirmPointSymbol,
    lowPositionHighColor,
    lowPositionHighSize: Number.isFinite(lowPositionHighSize) ? Math.max(8, Math.min(lowPositionHighSize, 96)) : defaultMmfIndicatorSettings.lowPositionHighSize,
    lowPositionHighSymbol,
    highPositionLowColor,
    highPositionLowSize: Number.isFinite(highPositionLowSize) ? Math.max(8, Math.min(highPositionLowSize, 96)) : defaultMmfIndicatorSettings.highPositionLowSize,
    highPositionLowSymbol,
    trendDownReturnColor,
    trendDownReturnMorganRatio: Number.isFinite(trendDownReturnMorganRatio) ? Math.max(0, Math.min(trendDownReturnMorganRatio, 1)) : defaultMmfIndicatorSettings.trendDownReturnMorganRatio,
    trendDownReturnSize: Number.isFinite(trendDownReturnSize) ? Math.max(8, Math.min(trendDownReturnSize, 96)) : defaultMmfIndicatorSettings.trendDownReturnSize,
    trendDownReturnSymbol,
    trendDownReturnVdoThreshold: Number.isFinite(trendDownReturnVdoThreshold) ? trendDownReturnVdoThreshold : defaultMmfIndicatorSettings.trendDownReturnVdoThreshold,
    trendDownDivergenceColor,
    trendDownDivergenceSize: Number.isFinite(trendDownDivergenceSize) ? Math.max(8, Math.min(trendDownDivergenceSize, 96)) : defaultMmfIndicatorSettings.trendDownDivergenceSize,
    trendDownDivergenceSymbol,
    trendDownDivergenceVdoThreshold: Number.isFinite(trendDownDivergenceVdoThreshold) ? trendDownDivergenceVdoThreshold : defaultMmfIndicatorSettings.trendDownDivergenceVdoThreshold,
    trendUpReturnColor,
    trendUpReturnMorganRatio: Number.isFinite(trendUpReturnMorganRatio) ? Math.max(0, Math.min(trendUpReturnMorganRatio, 1)) : defaultMmfIndicatorSettings.trendUpReturnMorganRatio,
    trendUpReturnSize: Number.isFinite(trendUpReturnSize) ? Math.max(8, Math.min(trendUpReturnSize, 96)) : defaultMmfIndicatorSettings.trendUpReturnSize,
    trendUpReturnSymbol,
    trendUpReturnVdoThreshold: Number.isFinite(trendUpReturnVdoThreshold) ? trendUpReturnVdoThreshold : defaultMmfIndicatorSettings.trendUpReturnVdoThreshold,
    trendUpDivergenceColor,
    trendUpDivergenceSize: Number.isFinite(trendUpDivergenceSize) ? Math.max(8, Math.min(trendUpDivergenceSize, 96)) : defaultMmfIndicatorSettings.trendUpDivergenceSize,
    trendUpDivergenceSymbol,
    trendUpDivergenceVdoThreshold: Number.isFinite(trendUpDivergenceVdoThreshold) ? trendUpDivergenceVdoThreshold : defaultMmfIndicatorSettings.trendUpDivergenceVdoThreshold,
    bottomDivergenceColor,
    bottomDivergenceSize: Number.isFinite(bottomDivergenceSize) ? Math.max(8, Math.min(bottomDivergenceSize, 96)) : defaultMmfIndicatorSettings.bottomDivergenceSize,
    bottomDivergenceSymbol,
    bottomDivergenceVdoThreshold: Number.isFinite(bottomDivergenceVdoThreshold) ? bottomDivergenceVdoThreshold : defaultMmfIndicatorSettings.bottomDivergenceVdoThreshold,
    topDivergenceColor,
    topDivergenceSize: Number.isFinite(topDivergenceSize) ? Math.max(8, Math.min(topDivergenceSize, 96)) : defaultMmfIndicatorSettings.topDivergenceSize,
    topDivergenceSymbol,
    topDivergenceVdoThreshold: Number.isFinite(topDivergenceVdoThreshold) ? topDivergenceVdoThreshold : defaultMmfIndicatorSettings.topDivergenceVdoThreshold,
    upBreakConfirmColor,
    upBreakConfirmSize: Number.isFinite(upBreakConfirmSize) ? Math.max(8, Math.min(upBreakConfirmSize, 96)) : defaultMmfIndicatorSettings.upBreakConfirmSize,
    upBreakConfirmSymbol,
    upBreakConfirmVdoThreshold: Number.isFinite(upBreakConfirmVdoThreshold) ? upBreakConfirmVdoThreshold : defaultMmfIndicatorSettings.upBreakConfirmVdoThreshold,
    downBreakConfirmColor,
    downBreakConfirmSize: Number.isFinite(downBreakConfirmSize) ? Math.max(8, Math.min(downBreakConfirmSize, 96)) : defaultMmfIndicatorSettings.downBreakConfirmSize,
    downBreakConfirmSymbol,
    downBreakConfirmVdoThreshold: Number.isFinite(downBreakConfirmVdoThreshold) ? downBreakConfirmVdoThreshold : defaultMmfIndicatorSettings.downBreakConfirmVdoThreshold,
    oscHighDivergenceColor,
    oscHighDivergenceSize: Number.isFinite(oscHighDivergenceSize) ? Math.max(8, Math.min(oscHighDivergenceSize, 96)) : defaultMmfIndicatorSettings.oscHighDivergenceSize,
    oscHighDivergenceSymbol,
    oscHighDivergenceVdoThreshold: Number.isFinite(oscHighDivergenceVdoThreshold) ? oscHighDivergenceVdoThreshold : defaultMmfIndicatorSettings.oscHighDivergenceVdoThreshold,
    oscLowDivergenceColor,
    oscLowDivergenceSize: Number.isFinite(oscLowDivergenceSize) ? Math.max(8, Math.min(oscLowDivergenceSize, 96)) : defaultMmfIndicatorSettings.oscLowDivergenceSize,
    oscLowDivergenceSymbol,
    oscLowDivergenceVdoThreshold: Number.isFinite(oscLowDivergenceVdoThreshold) ? oscLowDivergenceVdoThreshold : defaultMmfIndicatorSettings.oscLowDivergenceVdoThreshold,
    pullbackColor,
    pullbackSize: Number.isFinite(pullbackSize) ? Math.max(8, Math.min(pullbackSize, 96)) : defaultMmfIndicatorSettings.pullbackSize,
    pullbackSymbol,
    pullbackVdoThreshold: Number.isFinite(pullbackVdoThreshold) ? pullbackVdoThreshold : defaultMmfIndicatorSettings.pullbackVdoThreshold,
    reboundColor,
    reboundSize: Number.isFinite(reboundSize) ? Math.max(8, Math.min(reboundSize, 96)) : defaultMmfIndicatorSettings.reboundSize,
    reboundSymbol,
    reboundVdoThreshold: Number.isFinite(reboundVdoThreshold) ? reboundVdoThreshold : defaultMmfIndicatorSettings.reboundVdoThreshold,
    trendDownReboundColor,
    trendDownReboundSize: Number.isFinite(trendDownReboundSize) ? Math.max(8, Math.min(trendDownReboundSize, 96)) : defaultMmfIndicatorSettings.trendDownReboundSize,
    trendDownReboundSymbol,
    trendDownDivergencePointColor,
    trendDownDivergenceMorganRatio: Number.isFinite(trendDownDivergenceMorganRatio) ? Math.max(0, Math.min(trendDownDivergenceMorganRatio, 1)) : defaultMmfIndicatorSettings.trendDownDivergenceMorganRatio,
    trendDownDivergencePointSize: Number.isFinite(trendDownDivergencePointSize) ? Math.max(8, Math.min(trendDownDivergencePointSize, 96)) : defaultMmfIndicatorSettings.trendDownDivergencePointSize,
    trendDownDivergencePointSymbol,
    trendUpPullbackColor,
    trendUpPullbackSize: Number.isFinite(trendUpPullbackSize) ? Math.max(8, Math.min(trendUpPullbackSize, 96)) : defaultMmfIndicatorSettings.trendUpPullbackSize,
    trendUpPullbackSymbol,
    trendUpDivergencePointColor,
    trendUpDivergenceMorganRatio: Number.isFinite(trendUpDivergenceMorganRatio) ? Math.max(0, Math.min(trendUpDivergenceMorganRatio, 1)) : defaultMmfIndicatorSettings.trendUpDivergenceMorganRatio,
    trendUpDivergencePointSize: Number.isFinite(trendUpDivergencePointSize) ? Math.max(8, Math.min(trendUpDivergencePointSize, 96)) : defaultMmfIndicatorSettings.trendUpDivergencePointSize,
    trendUpDivergencePointSymbol,
    resistanceColor,
    resistanceSize: Number.isFinite(resistanceSize) ? Math.max(8, Math.min(resistanceSize, 96)) : defaultMmfIndicatorSettings.resistanceSize,
    resistanceSymbol,
    expectedResistanceColor,
    expectedResistanceSize: Number.isFinite(expectedResistanceSize) ? Math.max(8, Math.min(expectedResistanceSize, 96)) : defaultMmfIndicatorSettings.expectedResistanceSize,
    expectedResistanceSymbol,
    resistanceDownBreakColor,
    resistanceDownBreakSize: Number.isFinite(resistanceDownBreakSize) ? Math.max(8, Math.min(resistanceDownBreakSize, 96)) : defaultMmfIndicatorSettings.resistanceDownBreakSize,
    resistanceDownBreakSymbol,
    resistanceUpBreakColor,
    resistanceUpBreakSize: Number.isFinite(resistanceUpBreakSize) ? Math.max(8, Math.min(resistanceUpBreakSize, 96)) : defaultMmfIndicatorSettings.resistanceUpBreakSize,
    resistanceUpBreakSymbol,
    resistanceVdoLower: Number.isFinite(resistanceVdoLower) ? resistanceVdoLower : defaultMmfIndicatorSettings.resistanceVdoLower,
    resistanceVdoUpper: Number.isFinite(resistanceVdoUpper) ? resistanceVdoUpper : defaultMmfIndicatorSettings.resistanceVdoUpper,
    downBreakVdoLower: Number.isFinite(downBreakVdoLower) ? downBreakVdoLower : defaultMmfIndicatorSettings.downBreakVdoLower,
    downBreakVdoUpper: Number.isFinite(downBreakVdoUpper) ? downBreakVdoUpper : defaultMmfIndicatorSettings.downBreakVdoUpper,
    downBreakColor,
    downBreakSize: Number.isFinite(downBreakSize) ? Math.max(8, Math.min(downBreakSize, 96)) : defaultMmfIndicatorSettings.downBreakSize,
    downBreakSymbol,
    showResistanceLevel: merged.showResistanceLevel === true,
    showExpectedResistanceLevel: merged.showExpectedResistanceLevel === true,
    showResistanceDownBreakPoint: merged.showResistanceDownBreakPoint === true,
    showResistanceUpBreakPoint: merged.showResistanceUpBreakPoint === true,
    showBottomDivergencePoint: merged.showBottomDivergencePoint === true,
    showDownBreakConfirmPoint: merged.showDownBreakConfirmPoint === true,
    showHigh: merged.showHigh === true,
    showHighPositionLowPoint: merged.showHighPositionLowPoint === true,
    showLow: merged.showLow === true,
    showLowPositionHighPoint: merged.showLowPositionHighPoint === true,
    showDeadCross: merged.showDeadCross === true,
    showGoldenCross: merged.showGoldenCross === true,
    showHighConfirmPoint: hasShowHighConfirmPoint ? merged.showHighConfirmPoint !== false : legacy.showSell !== false,
    showLowConfirmPoint: hasShowLowConfirmPoint ? merged.showLowConfirmPoint !== false : legacy.showBuy !== false,
    showOscHighDivergencePoint: merged.showOscHighDivergencePoint === true,
    showOscLowDivergencePoint: merged.showOscLowDivergencePoint === true,
    showPullbackPoint: merged.showPullbackPoint === true,
    showReboundPoint: merged.showReboundPoint === true,
    showTrendDownReboundPoint: merged.showTrendDownReboundPoint === true,
    showTrendDownDivergencePointV2: merged.showTrendDownDivergencePointV2 === true,
    showTrendUpPullbackPoint: merged.showTrendUpPullbackPoint === true,
    showTrendUpDivergencePointV2: merged.showTrendUpDivergencePointV2 === true,
    showTrendDownDivergencePoint: merged.showTrendDownDivergencePoint === true,
    showTrendDownReturnPoint: merged.showTrendDownReturnPoint === true,
    showTrendUpDivergencePoint: merged.showTrendUpDivergencePoint === true,
    showTrendUpReturnPoint: merged.showTrendUpReturnPoint === true,
    showTopDivergencePoint: merged.showTopDivergencePoint === true,
    showUpBreakConfirmPoint: merged.showUpBreakConfirmPoint === true,
    showDownBreakPoint: merged.showDownBreakPoint === true,
    showSupportLevel: merged.showSupportLevel === true,
    showExpectedSupportLevel: merged.showExpectedSupportLevel === true,
    showSupportDownBreakPoint: merged.showSupportDownBreakPoint === true,
    showSupportUpBreakPoint: merged.showSupportUpBreakPoint === true,
    showTrendDownPoint: merged.showTrendDownPoint === true,
    showTrendUpPoint: merged.showTrendUpPoint === true,
    showUpBreakPoint: merged.showUpBreakPoint === true,
    showVdoMomentumFloatingPanel: merged.showVdoMomentumFloatingPanel !== false,
    supportColor,
    supportSize: Number.isFinite(supportSize) ? Math.max(8, Math.min(supportSize, 96)) : defaultMmfIndicatorSettings.supportSize,
    supportSymbol,
    expectedSupportColor,
    expectedSupportSize: Number.isFinite(expectedSupportSize) ? Math.max(8, Math.min(expectedSupportSize, 96)) : defaultMmfIndicatorSettings.expectedSupportSize,
    expectedSupportSymbol,
    supportDownBreakColor,
    supportDownBreakSize: Number.isFinite(supportDownBreakSize) ? Math.max(8, Math.min(supportDownBreakSize, 96)) : defaultMmfIndicatorSettings.supportDownBreakSize,
    supportDownBreakSymbol,
    supportUpBreakColor,
    supportUpBreakSize: Number.isFinite(supportUpBreakSize) ? Math.max(8, Math.min(supportUpBreakSize, 96)) : defaultMmfIndicatorSettings.supportUpBreakSize,
    supportUpBreakSymbol,
    supportVdoLower: Number.isFinite(supportVdoLower) ? supportVdoLower : defaultMmfIndicatorSettings.supportVdoLower,
    supportVdoUpper: Number.isFinite(supportVdoUpper) ? supportVdoUpper : defaultMmfIndicatorSettings.supportVdoUpper,
    trendDownColor,
    trendDownSize: Number.isFinite(trendDownSize) ? Math.max(8, Math.min(trendDownSize, 96)) : defaultMmfIndicatorSettings.trendDownSize,
    trendDownSymbol,
    trendDownVdoLower: Number.isFinite(trendDownVdoLower) ? trendDownVdoLower : defaultMmfIndicatorSettings.trendDownVdoLower,
    trendDownVdoUpper: Number.isFinite(trendDownVdoUpper) ? trendDownVdoUpper : defaultMmfIndicatorSettings.trendDownVdoUpper,
    trendUpColor,
    trendUpSize: Number.isFinite(trendUpSize) ? Math.max(8, Math.min(trendUpSize, 96)) : defaultMmfIndicatorSettings.trendUpSize,
    trendUpSymbol,
    trendUpVdoLower: Number.isFinite(trendUpVdoLower) ? trendUpVdoLower : defaultMmfIndicatorSettings.trendUpVdoLower,
    trendUpVdoUpper: Number.isFinite(trendUpVdoUpper) ? trendUpVdoUpper : defaultMmfIndicatorSettings.trendUpVdoUpper,
    upBreakColor,
    upBreakSize: Number.isFinite(upBreakSize) ? Math.max(8, Math.min(upBreakSize, 96)) : defaultMmfIndicatorSettings.upBreakSize,
    upBreakSymbol,
    upBreakVdoLower: Number.isFinite(upBreakVdoLower) ? upBreakVdoLower : defaultMmfIndicatorSettings.upBreakVdoLower,
    upBreakVdoUpper: Number.isFinite(upBreakVdoUpper) ? upBreakVdoUpper : defaultMmfIndicatorSettings.upBreakVdoUpper,
    vdoBreakoutMomentumDownLookback: Number.isFinite(vdoBreakoutMomentumDownLookback) ? Math.max(0, Math.min(vdoBreakoutMomentumDownLookback, 100000)) : defaultMmfIndicatorSettings.vdoBreakoutMomentumDownLookback,
    vdoBreakoutMomentumUpLookback: Number.isFinite(vdoBreakoutMomentumUpLookback) ? Math.max(0, Math.min(vdoBreakoutMomentumUpLookback, 100000)) : defaultMmfIndicatorSettings.vdoBreakoutMomentumUpLookback,
    vdoCloseMomentumDownLookback: Number.isFinite(vdoCloseMomentumDownLookback) ? Math.max(0, Math.min(vdoCloseMomentumDownLookback, 100000)) : defaultMmfIndicatorSettings.vdoCloseMomentumDownLookback,
    vdoCloseMomentumUpLookback: Number.isFinite(vdoCloseMomentumUpLookback) ? Math.max(0, Math.min(vdoCloseMomentumUpLookback, 100000)) : defaultMmfIndicatorSettings.vdoCloseMomentumUpLookback,
    vdoMomentumDownAverage: Number.isFinite(vdoMomentumDownAverage) ? Math.max(0, vdoMomentumDownAverage) : defaultMmfIndicatorSettings.vdoMomentumDownAverage,
    vdoMomentumDownLookback: Number.isFinite(vdoMomentumDownLookback) ? Math.max(0, Math.min(vdoMomentumDownLookback, 100000)) : defaultMmfIndicatorSettings.vdoMomentumDownLookback,
    vdoMomentumExceedPercent: Number.isFinite(vdoMomentumExceedPercent) ? Math.max(0, Math.min(vdoMomentumExceedPercent, 1000)) : defaultMmfIndicatorSettings.vdoMomentumExceedPercent,
    vdoMomentumUpAverage: Number.isFinite(vdoMomentumUpAverage) ? Math.max(0, vdoMomentumUpAverage) : defaultMmfIndicatorSettings.vdoMomentumUpAverage,
    vdoMomentumUpLookback: Number.isFinite(vdoMomentumUpLookback) ? Math.max(0, Math.min(vdoMomentumUpLookback, 100000)) : defaultMmfIndicatorSettings.vdoMomentumUpLookback,
  }
}
