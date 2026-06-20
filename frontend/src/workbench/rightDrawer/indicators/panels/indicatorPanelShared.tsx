import type {
  AoIndicatorSettings,
  DpoIndicatorSettings,
  MacdIndicatorSettings,
  MaIndicatorSettings,
  MmfIndicatorSettings,
  MrIndicatorSettings,
  RsiIndicatorSettings,
  SqzmomIndicatorSettings,
  StochIndicatorSettings,
  TsiIndicatorSettings,
  VdoIndicatorSettings,
  ViIndicatorSettings,
  VmiIndicatorSettings,
  VwapIndicatorSettings,
} from '../../indicatorPersistence'

export function updateSettings(
  current: RsiIndicatorSettings,
  patch: Partial<RsiIndicatorSettings>,
): RsiIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMaSettings(
  current: MaIndicatorSettings,
  patch: Partial<MaIndicatorSettings>,
): MaIndicatorSettings {
  return { ...current, ...patch }
}

export function updateVwapSettings(
  current: VwapIndicatorSettings,
  patch: Partial<VwapIndicatorSettings>,
): VwapIndicatorSettings {
  return { ...current, ...patch }
}

export function updateStochSettings(
  current: StochIndicatorSettings,
  patch: Partial<StochIndicatorSettings>,
): StochIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMacdSettings(
  current: MacdIndicatorSettings,
  patch: Partial<MacdIndicatorSettings>,
): MacdIndicatorSettings {
  return { ...current, ...patch }
}

export function updateSqzmomSettings(
  current: SqzmomIndicatorSettings,
  patch: Partial<SqzmomIndicatorSettings>,
): SqzmomIndicatorSettings {
  return { ...current, ...patch }
}

export function updateTsiSettings(
  current: TsiIndicatorSettings,
  patch: Partial<TsiIndicatorSettings>,
): TsiIndicatorSettings {
  return { ...current, ...patch }
}

export function updateViSettings(
  current: ViIndicatorSettings,
  patch: Partial<ViIndicatorSettings>,
): ViIndicatorSettings {
  return { ...current, ...patch }
}

export function updateAoSettings(
  current: AoIndicatorSettings,
  patch: Partial<AoIndicatorSettings>,
): AoIndicatorSettings {
  return { ...current, ...patch }
}

export function updateVmiSettings(
  current: VmiIndicatorSettings,
  patch: Partial<VmiIndicatorSettings>,
): VmiIndicatorSettings {
  return { ...current, ...patch }
}

export function updateDpoSettings(
  current: DpoIndicatorSettings,
  patch: Partial<DpoIndicatorSettings>,
): DpoIndicatorSettings {
  return { ...current, ...patch }
}

export function updateVdoSettings(
  current: VdoIndicatorSettings,
  patch: Partial<VdoIndicatorSettings>,
): VdoIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMrSettings(
  current: MrIndicatorSettings,
  patch: Partial<MrIndicatorSettings>,
): MrIndicatorSettings {
  return { ...current, ...patch }
}

export function updateMmfSettings(
  current: MmfIndicatorSettings,
  patch: Partial<MmfIndicatorSettings>,
): MmfIndicatorSettings {
  return { ...current, ...patch }
}
