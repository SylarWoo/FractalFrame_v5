export const chartSettingKeys = {
  pricePrecision: 'price.precision',
  timezone: 'time.timezone',
  statusTitleMode: 'status.title.mode',
  statusChartValuesVisible: 'status.chartValues.visible',
  statusCandleChangeVisible: 'status.candleChange.visible',
  statusCandleTimeVisible: 'status.candleTime.visible',
  sessionBreakVisible: 'events.sessionBreak.visible',
} as const

export const chartSettingDefaults = {
  pricePrecision: '6',
  timezone: 'UTC',
  statusTitleMode: 'symbol-name',
  statusChartValuesVisible: true,
  statusCandleChangeVisible: true,
  statusCandleTimeVisible: true,
  sessionBreakVisible: false,
} as const
