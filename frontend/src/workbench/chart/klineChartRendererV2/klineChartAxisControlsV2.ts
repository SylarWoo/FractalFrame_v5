import type { Chart } from 'klinecharts'
import {
  applyAxisLineStyle,
  applyAxisTextStyle,
} from '../chartAxisStyles'

export function applyKLineChartAxisControlsV2(chart: Chart) {
  applyAxisTextStyle(chart)
  applyAxisLineStyle(chart)
}
