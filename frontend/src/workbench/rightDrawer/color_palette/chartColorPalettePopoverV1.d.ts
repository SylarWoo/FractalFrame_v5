export function openChartColorPalettePopoverV1(options: {
  anchorEl: HTMLElement
  doc: Document
  initialHex?: string
  initialLineStyle?: string
  initialOpacity?: number
  initialThickness?: number
  onPick: (payload: {
    hex?: string
    hexOpaque?: string
    lineStyle?: string
    lineStyleLw?: number
    opacity?: number
    thickness?: number
  }) => void
  showCustomColorsRow?: boolean
  showCustomPicker?: boolean
  showPresetGrid?: boolean
  showLineStyle?: boolean
  showOpacity?: boolean
  showThickness?: boolean
  thicknessSteps?: number
}): { close: () => void }

export function createChartColorSwatchHostV1(options: {
  doc: Document
  features?: {
    customColorsRow?: boolean
    customPicker?: boolean
    opacity?: boolean
    thickness?: boolean
    lineStyle?: boolean
    thicknessSteps?: number
  }
  initialHex?: string
  initialLineStyle?: string
  initialPickMeta?: unknown
  initialThickness?: number
  onExtendedPick?: (payload: unknown) => void
  resolveInitialThickness?: () => number
  title?: string
  variant?: 'line' | 'background'
}): HTMLElement
