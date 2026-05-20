import { expect, test } from '@playwright/test'

const storageKeys = {
  activeDrawer: 'fractalframe:rightWidgetActiveDrawer:v1',
  m1CheckResults: 'fractalframe:mt5ImportCenterM1CheckResults:v1',
  selectedTab: 'fractalframe:mt5ImportCenterSelectedTab:v1',
  shortcutMenuEnabled: 'fractalframe:mt5ImportCenterShortcutMenuEnabled:v1',
  shortcutMenuPeriods: 'fractalframe:mt5ImportCenterShortcutMenuPeriods:v1',
  sharedSelection: 'fractalframe:mt5ImportCenterSharedSelection:v1',
  storePanelSelection: 'fractalframe:mt5ImportCenterStorePanelSelectedTableKey:v1',
  storeStatus: 'fractalframe:mt5ImportCenterStoreV5Status:v1',
  symbolSnapshot: 'fractalframe:mt5ImportCenterSymbolSnapshot:v1',
  watchlistSymbols: 'fractalframe:mt5ImportCenterWatchlistSymbols:v1',
}

const symbol = 'XAUUSDm'

const symbolRow = {
  symbol,
  name: 'Gold CFD',
  description: 'Gold vs US Dollar',
  path: 'Metals\\Gold',
  category: 'Metals',
  market: 'CFD',
  visible: true,
  digits: 2,
  spread: 20,
  spreadFloat: true,
  currencyBase: 'XAU',
  currencyProfit: 'USD',
  currencyMargin: 'USD',
  tradeMode: 4,
  tradeCalcMode: 0,
  tradeContractSize: 100,
  volumeMin: 0.01,
  volumeMax: 100,
  volumeStep: 0.01,
  tradeTickSize: 0.01,
  tradeTickValue: 1,
  tradeStopsLevel: 0,
}

const storeStatus = {
  ok: true,
  status: 'ok',
  symbol,
  directM1: {
    datasetKey: `${symbol}:direct:M1`,
    rowsCount: 12000,
    mt5RowsCount: 12000,
    trueM1RowsCount: 11980,
    firstTimeText: '2026-05-20 00:00:00 UTC',
    lastTimeText: '2026-05-20 10:00:00 UTC',
    lastImportAt: '2026-05-20T10:00:00Z',
    status: 'ready',
  },
  rawDirectM1: null,
  aggregated: [
    {
      timeframe: 'H1',
      rowsCount: 200,
      lastTimeText: '2026-05-20 10:00:00 UTC',
    },
  ],
}

async function mockMt5Api(page: import('@playwright/test').Page) {
  await page.route('http://127.0.0.1:8765/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/store-v5/query')) {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          ok: true,
          symbol,
          timeframe: url.searchParams.get('timeframe') ?? 'M1',
          mode: url.searchParams.get('mode') ?? 'direct',
          rowsCount: 2,
          rows: [
            { time: 1779235200, open: 2400, high: 2405, low: 2398, close: 2402, volume: 10 },
            { time: 1779235260, open: 2402, high: 2408, low: 2401, close: 2407, volume: 12 },
          ],
        },
      })
      return
    }

    if (url.pathname.endsWith('/store-v5/status')) {
      await route.fulfill({ contentType: 'application/json', json: storeStatus })
      return
    }

    if (url.pathname.endsWith('/mt5/symbols')) {
      await route.fulfill({
        contentType: 'application/json',
        json: { ok: true, status: 'ok', count: 1, totalCount: 1, symbols: [symbolRow] },
      })
      return
    }

    await route.fulfill({ contentType: 'application/json', json: { ok: true, status: 'ok', symbol } })
  })
}

async function mockMt5ApiWithPullProgress(page: import('@playwright/test').Page) {
  await page.route('http://127.0.0.1:8765/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/store-v5/pull/start')) {
      await route.fulfill({
        contentType: 'application/json',
        json: { ok: true, jobId: 'pull-job-1', symbol, phase: 'queued', status: 'store_v5_pull_queued', progressPercent: 0 },
      })
      return
    }
    if (url.pathname.endsWith('/store-v5/pull/events')) {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: [
          'id: 1',
          'event: progress',
          `data: ${JSON.stringify({ ok: true, jobId: 'pull-job-1', symbol, phase: 'fetching', status: 'store_v5_pull_raw_m1_fetching', progressPercent: 35, progressLabel: 'Reading MT5 M1' })}`,
          '',
          'id: 2',
          'event: done',
          `data: ${JSON.stringify({ ok: true, jobId: 'pull-job-1', symbol, phase: 'completed', status: 'store_v5_pull_completed', progressPercent: 100, rowsFetched: 20, rowsWritten: 20 })}`,
          '',
        ].join('\n'),
      })
      return
    }
    if (url.pathname.endsWith('/store-v5/aggregate/start')) {
      await route.fulfill({
        contentType: 'application/json',
        json: { ok: true, jobId: 'aggregate-job-1', symbol, phase: 'completed', status: 'store_v5_aggregate_completed', periods: ['H1'], completed: 1, total: 1 },
      })
      return
    }
    if (url.pathname.endsWith('/store-v5/aggregate/events')) {
      await route.fulfill({
        contentType: 'text/event-stream',
        body: `id: 1\nevent: done\ndata: ${JSON.stringify({ ok: true, jobId: 'aggregate-job-1', symbol, phase: 'completed', status: 'store_v5_aggregate_completed', periods: ['H1'], completed: 1, total: 1 })}\n\n`,
      })
      return
    }
    if (url.pathname.endsWith('/store-v5/m1/repair-gaps')) {
      await route.fulfill({ contentType: 'application/json', json: { ok: true, status: 'ok', gapsDetected: 0, rowsWritten: 0 } })
      return
    }
    if (url.pathname.endsWith('/store-v5/status')) {
      await route.fulfill({ contentType: 'application/json', json: storeStatus })
      return
    }
    if (url.pathname.endsWith('/store-v5/query')) {
      await route.fulfill({ contentType: 'application/json', json: { ok: true, symbol, timeframe: 'M1', rowsCount: 0, rows: [] } })
      return
    }
    await route.fulfill({ contentType: 'application/json', json: { ok: true, status: 'ok', symbol } })
  })
}

async function mockMt5ApiWithRefreshError(page: import('@playwright/test').Page) {
  await page.route('http://127.0.0.1:8765/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/store-v5/m1/repair-gaps')) {
      await route.fulfill({ status: 500, contentType: 'application/json', json: { ok: false, status: 'store_v5_m1_gap_repair_failed', error: 'repair exploded' } })
      return
    }
    if (url.pathname.endsWith('/store-v5/status')) {
      await route.fulfill({ contentType: 'application/json', json: storeStatus })
      return
    }
    await route.fulfill({ contentType: 'application/json', json: { ok: true, status: 'ok', symbol } })
  })
}

async function seedWorkbenchStorage(page: import('@playwright/test').Page) {
  await page.addInitScript(({ keys, row, status, selectedSymbol }) => {
    window.localStorage.setItem(keys.activeDrawer, 'mt5')
    window.localStorage.setItem(keys.selectedTab, 'store')
    window.localStorage.setItem(keys.sharedSelection, JSON.stringify({ symbol: selectedSymbol, period: 'M1' }))
    window.localStorage.setItem(keys.shortcutMenuEnabled, '1')
    window.localStorage.setItem(keys.shortcutMenuPeriods, JSON.stringify(['M1', 'H1', 'H4']))
    window.localStorage.setItem(keys.watchlistSymbols, JSON.stringify([selectedSymbol, 'BTCUSDm', 'EURUSDm']))
    window.localStorage.setItem(keys.symbolSnapshot, JSON.stringify({
      selectedSymbol,
      status: '共 1 个品种，本地已保存，刷新后自动恢复（当前显示 1 个）',
      symbols: [row],
      savedAt: '2026-05-20T00:00:00Z',
    }))
    window.localStorage.setItem(keys.storeStatus, JSON.stringify({
      [selectedSymbol]: { checkedAt: '2026-05-20T10:00:00Z', payload: status },
    }))
    window.localStorage.setItem(keys.m1CheckResults, JSON.stringify({
      [selectedSymbol]: { checkedAt: '2026-05-20T10:00:00Z', payload: status },
    }))
    window.localStorage.setItem(keys.storePanelSelection, JSON.stringify({
      [selectedSymbol]: { key: 'm1-M1', symbol: selectedSymbol },
    }))
  }, { keys: storageKeys, row: symbolRow, selectedSymbol: symbol, status: storeStatus })
}

test('workbench renders chart, MT5 drawer, StoreV5 panel, and settings drawer', async ({ page }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await mockMt5Api(page)
  await seedWorkbenchStorage(page)
  await page.goto('/')

  await expect(page.locator('#root')).toBeVisible()
  await expect(page.locator('.ff-chart-core-host')).toBeVisible()
  const chartBox = await page.locator('.ff-chart-core-host__canvas').boundingBox()
  expect(chartBox?.width ?? 0).toBeGreaterThan(100)
  expect(chartBox?.height ?? 0).toBeGreaterThan(100)

  await expect(page.getByRole('heading', { name: 'MT5 Import Center' })).toBeVisible()
  await expect(page.locator('.ff-symbol-table-wrap')).toBeVisible()
  await expect(page.locator('.ff-import-store-panel')).toBeVisible()
  await expect(page.locator('.ff-store-detail-table')).toBeVisible()
  await expect(page.locator('.ff-store-direct-actions').first()).toBeVisible()
  await expect(page.locator('.ff-chart-jump-controls')).toBeVisible()
  const storePanelBox = await page.locator('.ff-import-store-panel').boundingBox()
  expect(storePanelBox?.height ?? 0).toBeGreaterThan(100)

  await page.getByTitle('Settings').click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  const settingsTabs = page.locator('.ff-settings-tabs__item')
  await expect(settingsTabs).toHaveCount(7)
  await settingsTabs.nth(1).click()
  await expect(settingsTabs.nth(1)).toHaveAttribute('aria-selected', 'true')

  expect(pageErrors).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('shortcut symbol menu closes on outside click', async ({ page }) => {
  await mockMt5Api(page)
  await seedWorkbenchStorage(page)
  await page.goto('/')

  const toggle = page.locator('.ff-shortcut-symbol__toggle')
  const menu = page.locator('.ff-shortcut-symbol__menu')

  await expect(toggle).toBeVisible()
  await toggle.click()
  await expect(menu).toBeVisible()
  await page.locator('.ff-chart-core-host').click({ position: { x: 300, y: 200 } })
  await expect(menu).toBeHidden()
})

test('StoreV5 pull shows mocked job progress', async ({ page }) => {
  await mockMt5ApiWithPullProgress(page)
  await seedWorkbenchStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: '拉取' }).click()
  await expect(page.getByText(/Reading MT5 M1|Pulling MT5 M1/)).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole('button', { name: /拉取中|拉取/ })).toBeDisabled()
})

test('StoreV5 refresh API errors are visible to the user', async ({ page }) => {
  await mockMt5ApiWithRefreshError(page)
  await seedWorkbenchStorage(page)
  await page.goto('/')

  await page.getByRole('button', { name: '检查本地仓库' }).click()
  await expect(page.getByText('repair exploded')).toBeVisible({ timeout: 5000 })
})
