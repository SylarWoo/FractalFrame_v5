# MT5 数据中心架构

本文说明 FractalFrame_v5 的 MT5 数据中心边界。核心原则是：MT5 只作为 M1 真源头，StoreV5 是唯一可复用数据资产，图表和回测都只能从 StoreV5 查询层取数。

## 1. 总链路

```txt
MT5 Terminal TIMEFRAME_M1
  ↓
MT5 M1 检查接口
  ↓
正式 M1 validator（寻找首个真实 M1 连续窗口）
  ↓
StoreV5 Direct M1
  ↓
StoreV5 Aggregated
  ↓
DuckDB 查询层
  ↓
KLineCharts datafeed / vectorBT export
```

## 2. 硬规则

1. Direct Store 只允许写 M1。
2. M5、M15、M30、H1、H2、H4、H8、D1、W1、MN1 全部从 Direct M1 聚合生成。
3. MT5 返回条数只记录为 `mt5RowsCount`，不等于可入库条数。
4. 可入库条数是 `trueM1RowsCount`，必须从首个真实 M1 连续窗口开始。首个真实窗口默认要求至少 60 根相邻 bar 严格按 60 秒递进。
5. UTC 22:00 不是 M1 入库起点门禁，也不是必须在数据里找到的一根 K 线；它只是后续聚合使用的交易日分割规则，对应 UTC+8 每日 06:00。
6. 休市、周末、节假日造成的 session gap 可以记录并保留；不补假数据，不把小时级假 M1 当成真实 M1。
7. 前端不直接读 parquet，不直接接 MT5 K 线；前端只调用 HTTP API。

## 3. HTTP API 边界

### MT5 终端检查

```txt
GET /api/market-data/v1/mt5/m1/check?symbol=XAUUSDm
```

用途：只检查 MT5 终端当前能返回多少 M1，以及真实 M1 从哪个时间开始。

返回重点：

```txt
directM1.mt5RowsCount
directM1.trueM1RowsCount
directM1.firstTimeText
directM1.lastTimeText
directM1.m1IntegrityStatus
```

该接口不写 StoreV5。

### StoreV5 仓库状态

```txt
GET /api/market-data/v1/store-v5/status?symbol=XAUUSDm
```

用途：读取 ManifestV5，返回 Direct M1 和 Aggregated 周期仓状态。

该接口不接 MT5，不扫描 parquet。

### 拉取入库

```txt
GET /api/market-data/v1/store-v5/pull?symbol=XAUUSDm&mode=refresh
GET /api/market-data/v1/store-v5/pull?symbol=XAUUSDm&mode=incremental
```

用途：调用正式 `pull_mt5_m1_to_store_v5` 服务，把 validator 通过的 true M1 写入 Direct Store。写入时会丢弃首个真实 M1 之前的小时级假 M1 或其他非 M1 段。

### 聚合重建

```txt
GET /api/market-data/v1/store-v5/aggregate?symbol=XAUUSDm&rebuild=1
```

用途：从 Direct M1 重建派生周期仓。聚合入口必须检查 Direct M1 的 Manifest 状态，不允许从 MT5 直接拉高周期。

### DuckDB 查询

```txt
GET /api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=M1&mode=direct&limit=1000
GET /api/market-data/v1/store-v5/query?symbol=XAUUSDm&timeframe=H1&mode=aggregated&baseTimeframe=M1&anchor=UTC2200
```

用途：统一给图表、指标、回测导出 OHLCV。

返回 rows 使用 StoreV5 底层字段：

```txt
time: UTC 秒
open/high/low/close: number
volume: number
```

## 4. 前端 MT5 Import Center

右侧 MT5 数据中心是控制台，不是数据源本身。

当前职责：

1. 扫描 MT5 品种列表。
2. 选择 symbol。
3. 检查 MT5 终端 M1。
4. 查看 StoreV5 仓库状态。
5. 触发拉取入库。
6. 触发聚合重建。

前端不保存 OHLCV，不计算真实 M1，不直接读取 parquet。

## 5. KLineCharts 接入

KLineCharts 只接 StoreV5 DuckDB 查询层。

StoreV5 保存 UTC 秒级 `time`，KLineCharts 需要毫秒级 `timestamp`，所以转换只发生在前端 datafeed：

```ts
timestamp = time * 1000
```

Direct M1 查询：

```txt
mode=direct
timeframe=M1
```

派生周期查询：

```txt
mode=aggregated
timeframe=H1
baseTimeframe=M1
anchor=UTC2200
```

这里的 `anchor=UTC2200` 是规则 ID，不表示聚合器要在 M1 数据中寻找 UTC22:00 那根 bar。聚合器会把真实 M1 按交易日分割规则映射到 bucket，前面不完整 bucket 自动跳过。

这样图表不会依赖 MT5 是否在线，也不会绕过仓库完整性门禁。即使 Direct M1 的第一根不在 UTC 22:00，聚合层仍会按 UTC+8 每日 06:00 的交易日分割线切 bucket；不完整 bucket 会被跳过。

## 6. vectorBT 接入

vectorBT 后续应走 Python 查询层，而不是 MT5。

推荐导出形态：

```python
result = query_ohlcv_store_v5(
    symbol="XAUUSDm",
    timeframe="H1",
    mode="aggregated",
    base_timeframe="M1",
    anchor="UTC2200",
    limit=None,
)
df = pandas.DataFrame(result["rows"])
df["datetime"] = pandas.to_datetime(df["time"], unit="s", utc=True)
df = df.set_index("datetime")
```

vectorBT 的 close、entries、exits、portfolio 都应基于这个 DataFrame。这样回测、图表、指标共用同一份 StoreV5 数据资产。

## 7. 依赖

Python 数据仓库运行依赖写在项目根目录 `requirements.txt`：

```txt
pandas
pyarrow
duckdb
MetaTrader5
```

后续接 vectorBT 时，建议单独确认 Python 版本兼容性，再加入 requirements。

## 8. 当前状态

已完成：

1. MT5 检查和正式 StoreV5 validator 统一。
2. HTTP API 拆分为 MT5 检查、仓库状态、拉取、聚合、查询。
3. KLineCharts datafeed 改为 StoreV5/DuckDB 查询层。

仍需继续加强：

1. 拉取和聚合按钮需要更细的进度反馈。
2. DuckDB 查询需要分页向前加载，支撑图表滚动历史。
3. vectorBT 需要独立 export/service 层，避免策略代码直接调用 HTTP。
