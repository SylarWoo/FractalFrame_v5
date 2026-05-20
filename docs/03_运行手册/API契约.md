# API 契约摘要

所有 JSON 响应都应包含：

- `ok`: boolean
- `status` 或 `error`: 描述当前状态或错误

## Diagnostics

`GET /api/market-data/v1/diagnostics/mt5?symbol=XAUUSDm`

关键字段：

- `ok`
- `status`
- `symbol`
- `symbolSelectOk`
- `terminal`
- `account`
- `publishedAt`

`GET /api/market-data/v1/diagnostics/runtime`

关键字段：

- `ok`
- `startedAt`
- `paths`
- `jobs`
- `activeOperations`

`GET /api/market-data/v1/diagnostics/jobs`

关键字段：

- `jobs.m1Check`
- `jobs.pull`
- `jobs.aggregate`

## StoreV5

`GET /api/market-data/v1/store-v5/status?symbol=XAUUSDm`

关键字段：

- `symbol`
- `directM1`
- `rawDirectM1`
- `aggregated`

`GET /api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=M1`

关键字段：

- `symbol`
- `timeframe`
- `mode`
- `rowsCount`
- `rows`
- `metadata.datasetKey`

`GET /api/market-data/v1/store-v5/audit?symbol=XAUUSDm`

关键字段：

- `datasetsCount`
- `issuesCount`
- `datasets[].datasetKey`
- `datasets[].issues`

本仓库同时维护机器可读草案：`docs/api/schema.json`。

## Jobs

Pull 和 aggregate job progress 均应包含：

- `jobId`
- `symbol`
- `phase`
- `status`
- `progressPercent`

终态：

- `completed`
- `failed`
- `cancelled`
