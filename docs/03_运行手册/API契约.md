# API Contract Summary

All JSON payloads should include:

- `ok`: boolean
- `status` or `error`: current state or error code

## Diagnostics

`GET /api/market-data/v1/diagnostics/mt5?symbol=XAUUSDm`

Key fields:

- `ok`
- `status`
- `symbol`
- `symbolSelectOk`
- `terminal`
- `account`
- `publishedAt`

`GET /api/market-data/v1/diagnostics/runtime`

Key fields:

- `ok`
- `startedAt`
- `paths`
- `jobs`
- `activeOperations`

`GET /api/market-data/v1/diagnostics/jobs`

Key fields:

- `jobs.m1Check`
- `jobs.pull`
- `jobs.aggregate`

`GET /api/market-data/v1/diagnostics/logs?tail=200`

Key fields:

- `path`
- `lines`

## StoreV5

`GET /api/market-data/v1/store-v5/status?symbol=XAUUSDm`

Key fields:

- `symbol`
- `directM1`
- `rawDirectM1`
- `aggregated`

`GET /api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=M1`

Key fields:

- `symbol`
- `timeframe`
- `mode`
- `rowsCount`
- `rows`
- `metadata.datasetKey`

`GET /api/market-data/v1/store-v5/audit?symbol=XAUUSDm`

Key fields:

- `datasetsCount`
- `issuesCount`
- `datasets[].datasetKey`
- `datasets[].issues`

Machine-readable draft schema: `docs/api/schema.json`.

## Jobs

Pull and aggregate job progress payloads should include:

- `jobId`
- `symbol`
- `phase`
- `status`
- `progressPercent`

Terminal phases:

- `completed`
- `failed`
- `cancelled`
