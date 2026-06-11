import { describe, expect, it } from 'vitest'
import { resolvePageLoadPlan } from './pageLoadPlanner'

describe('pageLoadPlanner', () => {
  it('keeps isolated page plans blank', () => {
    const plan = resolvePageLoadPlan({
      page: {
        blank: true,
        fromGlobalIndex: null,
        index: 0,
        limit: 0,
        realtime: false,
        rows: 0,
        toGlobalIndex: null,
      },
    })

    expect(plan.mode).toBe('blank')
    expect(plan.requestedRows).toBe(0)
    expect(plan.chartBehavior.acceptRealtimeTicks).toBe(false)
  })

  it('uses StoreV6 live page defaults when no page is provided', () => {
    const plan = resolvePageLoadPlan({})

    expect(plan.mode).toBe('realtime')
    expect(plan.requestedRows).toBe(2_000)
    expect(plan.query).toEqual({ limit: 2_000, type: 'latest' })
    expect(plan.chartBehavior.acceptRealtimeTicks).toBe(true)
    expect(plan.page?.index).toBe(1)
    expect(plan.page?.realtime).toBe(true)
  })

  it('loads historical pages as static StoreV6 page windows', () => {
    const plan = resolvePageLoadPlan({
      page: {
        fromGlobalIndex: 100,
        index: 2,
        limit: 2_500,
        realtime: false,
        rows: 2_500,
        timeFrom: 10,
        timeTo: 20,
        toGlobalIndex: 2_599,
      },
    })

    expect(plan.mode).toBe('history')
    expect(plan.requestedRows).toBe(2_500)
    expect(plan.query).toMatchObject({
      fromGlobalIndex: 100,
      limit: 2_500,
      timeFrom: 10,
      timeTo: 20,
      toGlobalIndex: 2_599,
      type: 'page',
    })
    expect(plan.chartBehavior.acceptRealtimeTicks).toBe(false)
  })

  it('does not trust stale page limits from older page caches', () => {
    const realtimePlan = resolvePageLoadPlan({
      page: {
        fromGlobalIndex: 1_000,
        index: 1,
        limit: 5_000,
        realtime: true,
        rows: 5_000,
        toGlobalIndex: 5_999,
      },
    })
    const historyPlan = resolvePageLoadPlan({
      page: {
        fromGlobalIndex: 0,
        index: 2,
        limit: 5_000,
        realtime: false,
        rows: 5_000,
        toGlobalIndex: 4_999,
      },
    })

    expect(realtimePlan.requestedRows).toBe(2_000)
    expect(realtimePlan.page?.limit).toBe(2_000)
    expect(realtimePlan.page?.rows).toBe(5_000)
    expect(historyPlan.requestedRows).toBe(2_500)
    expect(historyPlan.page?.limit).toBe(2_500)
    expect(historyPlan.page?.rows).toBe(2_500)
  })

  it('honors explicit time-window page limits', () => {
    const realtimePlan = resolvePageLoadPlan({
      page: {
        fromGlobalIndex: null,
        index: 1,
        limit: 2_272,
        realtime: true,
        rows: null,
        timeFrom: 100,
        timeTo: 200,
        toGlobalIndex: null,
      },
    })
    const historyPlan = resolvePageLoadPlan({
      page: {
        fromGlobalIndex: null,
        index: 2,
        limit: 2_272,
        realtime: false,
        rows: null,
        timeFrom: 10,
        timeTo: 99,
        toGlobalIndex: null,
      },
    })

    expect(realtimePlan.requestedRows).toBe(2_272)
    expect(realtimePlan.page?.rows).toBe(2_272)
    expect(historyPlan.requestedRows).toBe(2_272)
    expect(historyPlan.page?.rows).toBe(2_272)
  })

  it('keeps jump loads static', () => {
    const plan = resolvePageLoadPlan({ jump: { id: 1, timestamp: 1_700_000_000_000 } })

    expect(plan.mode).toBe('jump')
    expect(plan.chartBehavior.acceptRealtimeTicks).toBe(false)
    expect(plan.chartBehavior.followLatest).toBe(false)
  })
})
