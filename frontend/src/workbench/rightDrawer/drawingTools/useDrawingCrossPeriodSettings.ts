import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  drawingCrossPeriodTargets,
  normalizeDrawingCrossPeriodTargets,
  type DrawingCrossPeriodTarget,
} from '../../drawing/drawingCrossPeriodModel'
import {
  readDrawingCrossPeriod,
  readDrawingCrossPeriodTargets,
  writeDrawingCrossPeriod,
  writeDrawingCrossPeriodTargets,
} from '../drawingPersistence'
import type { DrawingToolKey } from './drawingTypes'

type CrossPeriodToolKey = 'horizontalLine' | 'trendLine'

type CrossPeriodSelection = {
  crossPeriod?: boolean
  crossPeriodTargets?: string[]
  tool: DrawingToolKey
}

type CrossPeriodUpdate = {
  crossPeriod: boolean
  crossPeriodTargets: DrawingCrossPeriodTarget[]
  tool: CrossPeriodToolKey
}

function isCrossPeriodToolKey(value: DrawingToolKey): value is CrossPeriodToolKey {
  return value === 'horizontalLine' || value === 'trendLine'
}

function readCrossPeriodTools(storagePeriod: string) {
  return {
    horizontalLine: readDrawingCrossPeriod('horizontalLine', storagePeriod),
    trendLine: readDrawingCrossPeriod('trendLine', storagePeriod),
  }
}

function readCrossPeriodTargetTools(storagePeriod: string) {
  return {
    horizontalLine: readDrawingCrossPeriodTargets('horizontalLine', storagePeriod),
    trendLine: readDrawingCrossPeriodTargets('trendLine', storagePeriod),
  }
}

export function useDrawingCrossPeriodSettings<TSelection extends CrossPeriodSelection>({
  publishUpdate,
  selectedDrawing,
  selectedKey,
  setSelectedDrawing,
  storagePeriod,
}: {
  publishUpdate: (update: CrossPeriodUpdate) => void
  selectedDrawing: TSelection | null
  selectedKey: DrawingToolKey
  setSelectedDrawing: Dispatch<SetStateAction<TSelection | null>>
  storagePeriod: string
}) {
  const [crossPeriodTools, setCrossPeriodTools] = useState<Record<CrossPeriodToolKey, boolean>>(() => readCrossPeriodTools(storagePeriod))
  const [crossPeriodTargetTools, setCrossPeriodTargetTools] = useState<Record<CrossPeriodToolKey, DrawingCrossPeriodTarget[]>>(() => readCrossPeriodTargetTools(storagePeriod))

  useEffect(() => {
    setCrossPeriodTools(readCrossPeriodTools(storagePeriod))
    setCrossPeriodTargetTools(readCrossPeriodTargetTools(storagePeriod))
  }, [storagePeriod])

  const selectedCrossPeriod = isCrossPeriodToolKey(selectedKey)
    ? selectedDrawing?.tool === selectedKey
      ? selectedDrawing.crossPeriod === true
      : crossPeriodTools[selectedKey] === true
    : false

  const selectedCrossPeriodTargets = isCrossPeriodToolKey(selectedKey)
    ? selectedDrawing?.tool === selectedKey
      ? normalizeDrawingCrossPeriodTargets(selectedDrawing.crossPeriodTargets)
      : crossPeriodTargetTools[selectedKey] ?? [...drawingCrossPeriodTargets]
    : [...drawingCrossPeriodTargets]

  function setSelectedCrossPeriod(enabled: boolean) {
    if (!isCrossPeriodToolKey(selectedKey)) return
    const tool = selectedKey
    const targets = selectedCrossPeriodTargets.length > 0 ? selectedCrossPeriodTargets : [...drawingCrossPeriodTargets]
    setCrossPeriodTools((current) => ({ ...current, [tool]: enabled }))
    setCrossPeriodTargetTools((current) => ({ ...current, [tool]: targets }))
    writeDrawingCrossPeriod(tool, enabled, storagePeriod)
    writeDrawingCrossPeriodTargets(tool, targets, storagePeriod)
    setSelectedDrawing((current) => current?.tool === tool
      ? ({ ...current, crossPeriod: enabled, crossPeriodTargets: targets } as TSelection)
      : current)
    if (selectedDrawing?.tool !== tool) return
    publishUpdate({ crossPeriod: enabled, crossPeriodTargets: targets, tool })
  }

  function setSelectedCrossPeriodTargets(targets: DrawingCrossPeriodTarget[]) {
    if (!isCrossPeriodToolKey(selectedKey)) return
    const tool = selectedKey
    const normalized = normalizeDrawingCrossPeriodTargets(targets)
    setCrossPeriodTools((current) => ({ ...current, [tool]: true }))
    setCrossPeriodTargetTools((current) => ({ ...current, [tool]: normalized }))
    writeDrawingCrossPeriod(tool, true, storagePeriod)
    writeDrawingCrossPeriodTargets(tool, normalized, storagePeriod)
    setSelectedDrawing((current) => current?.tool === tool
      ? ({ ...current, crossPeriod: true, crossPeriodTargets: normalized } as TSelection)
      : current)
    if (selectedDrawing?.tool !== tool) return
    publishUpdate({ crossPeriod: true, crossPeriodTargets: normalized, tool })
  }

  return {
    selectedCrossPeriod,
    selectedCrossPeriodTargets,
    setSelectedCrossPeriod,
    setSelectedCrossPeriodTargets,
  }
}
