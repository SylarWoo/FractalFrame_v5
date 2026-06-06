# MT5 数据中心架构

> 新版核心原则：MT5 只提供原始数据源，StoreV6 负责把原始 K 线整理成可复用数据资产。数据中心的底座不是“边拉取边猜哪些 K 线有效”，而是先建立 `symbol + period + openTime` 的全局 K 线身份和交易时段规则，再清洗、标记、补洞、聚合、查询。分页、指标、图表、回测以后都必须基于这套全局索引。

## 0. 总体结论

当前 StoreV5 的方向需要升级为 StoreV6。升级重点不是 parquet 文件格式本身，而是底层数据资产模型、索引规则、质量标记和补洞机制：

```text
原始拉取数据
  -> Raw Store
  -> 全局 K 线索引
  -> 交易时段/开休市规则
  -> 缺口扫描和错误 K 线隔离
  -> Clean M1 Store
  -> 规则聚合 Store
  -> DuckDB 查询层
```

本次改造涉及目录结构、manifest、写入协议、质量标记、索引规则和查询协议，应按 `StoreV6` 设计。旧 StoreV5 可以作为迁移来源，但新底座不再沿用“拉取时直接筛出最终可信 K 线”的旧思路。

核心分工：

```text
StoreV6 = 数据仓库体系、规则层、manifest、索引、质量标记和资产管理
parquet = K 线数据最终落地的列式文件格式
DuckDB = 查询 parquet 数据的 SQL 引擎
```

## 0.5 StoreV6 数据目录和文件结构

StoreV6 必须使用独立数据目录，不在 StoreV5 原目录上直接覆盖。

推荐目录：

```text
runtime_data/
  store_v5/
    ...旧数据，迁移期保留

  store_v6/
    manifests/
      store_v6_manifest.json
      symbols/
        XAUUSDm.json

    raw/
      XAUUSDm/
        M1/
          raw_m1.parquet

    clean/
      XAUUSDm/
        M1/
          clean_m1.parquet

    aggregated/
      XAUUSDm/
        M5/
          aggregated_m5.parquet
        M15/
          aggregated_m15.parquet
        H1/
          aggregated_h1.parquet
        H4/
          aggregated_h4.parquet
        D1/
          aggregated_d1.parquet

    index/
      XAUUSDm/
        M1/
          global_bar_index.parquet
        M5/
          global_bar_index.parquet
        H1/
          global_bar_index.parquet

    quality/
      XAUUSDm/
        M1/
          rejected_bars.parquet
          missing_ranges.parquet
          reference_diffs.parquet

    sessions/
      trading_session_rules.json
      mt5_symbol_details.json
      session_calendar.parquet
      symbols/
        XAUUSDm.session_rule.json

    diagnostics/
      pull_jobs.parquet
      aggregate_jobs.parquet
      repair_jobs.parquet
```

目录职责：

```text
raw/ = MT5 原始拉取数据，完整保留，不物理删除异常 K 线。
clean/ = 通过 Clean 准入标准的可信 K 线。
aggregated/ = 从 Clean M1 按 TradingSessionRule 聚合出的唯一历史高周期存量。
index/ = 每个 symbol+period 的 barKey/globalIndex/sessionId 索引。
quality/ = rejected、missing、reference diff 等质量诊断资产。
sessions/ = MT5 品种详情缓存、交易时段规则和 session 日历。
manifests/ = StoreV6 总状态和每个 symbol 的仓库状态。
diagnostics/ = 拉取、聚合、修复任务记录。
```

### 0.5.1 parquet 文件标准

Raw M1 parquet：

```text
symbol
period
openTime
closeTime
timestamp
barKey
open
high
low
close
volume
spread
realVolume
source
pullJobId
pulledAt
quality
rejectReason
```

Clean M1 parquet：

```text
symbol
period
openTime
closeTime
timestamp
barKey
globalIndex
sessionId
sessionOpenTime
sessionCloseTime
open
high
low
close
volume
quality
gapBefore
createdAt
updatedAt
```

Aggregated parquet：

```text
symbol
period
openTime
closeTime
timestamp
barKey
globalIndex
sessionId
sourcePeriod
sourceFromOpenTime
sourceToOpenTime
sourceBars
expectedSourceBars
completeness
open
high
low
close
volume
createdAt
updatedAt
```

Global index parquet：

```text
symbol
period
openTime
closeTime
timestamp
barKey
globalIndex
sessionId
isTradingTime
quality
source
gapBefore
createdAt
updatedAt
```

Missing ranges parquet：

```text
symbol
period
timeFrom
timeTo
expectedBars
reason
gapType
status
missingBarKeys
filledBarKeys
firstDetectedAt
lastCheckedAt
```

Reference diffs parquet：

```text
symbol
period
barKey
openTime
trustedSource
referenceSource
trustedOpen
trustedHigh
trustedLow
trustedClose
trustedVolume
referenceOpen
referenceHigh
referenceLow
referenceClose
referenceVolume
diffReason
detectedAt
```

### 0.5.1.1 K 线字段分层标准

StoreV6 的 K 线字段必须分成“固定身份字段”和“可重算扩展字段”。不能把交易时间段、session 归属、质量解释直接写进 K 线身份 ID。

原因：

```text
1. symbol + period + openTime 与一根逻辑 K 线一一对应。
2. 交易时间段、开休市规则、节假日规则后期可能调整。
3. 如果把交易时间规则放进 barKey，规则一变，历史 K 线身份会整体变化。
4. 正确做法是身份固定，规则解释可版本化、可重算。
```

固定身份字段：

```text
barKey
symbol
period
openTime
closeTime
timestamp
```

这些字段用于回答：“这根 K 线是谁？”

固定规则：

```text
barKey = symbol + "|" + period + "|" + openTime
UNIQUE(symbol, period, openTime)
```

可重算扩展字段：

```text
globalIndex
sessionRuleId
sessionRuleVersion
sessionId
tradingDay
sessionOpenTime
sessionCloseTime
sessionState
isTradingTime
gapBefore
gapKind
quality
rejectReason
completeness
expectedSourceBars
sourceBars
sourceFromOpenTime
sourceToOpenTime
```

这些字段用于回答：“在当前规则版本下，这根 K 线怎么解释？”

字段分层：

```text
1. Identity 固定层
   唯一定位 K 线，不随交易时间规则变化。

2. OHLCV 数据层
   保存 open/high/low/close/volume/spread/realVolume。

3. Rule Annotation 可重算层
   保存 session、tradingDay、gap、quality、completeness。

4. Source Lineage 来源层
   保存 source、provider、pullJobId、aggregateJobId、sourcePeriod、source range。
```

规则调整后的处理方式：

```text
不改：
  barKey / symbol / period / openTime

重算：
  globalIndex / sessionId / tradingDay / sessionState / gapKind / quality / completeness

重建：
  受影响区间的 Clean M1
  受影响区间的 Aggregated Store
  受影响区间的 MissingRange 和 quality diagnostics
```

因此，StoreV6 的身份是稳定资产，交易时间规则是可编辑规则。规则可以升级，但同一根 K 线的身份不能漂移。

### 0.5.2 manifest 标准

StoreV6 总 manifest：

```json
{
  "version": "store_v6",
  "rootPath": "runtime_data/store_v6",
  "createdAt": "",
  "updatedAt": "",
  "symbols": []
}
```

Symbol manifest：

```json
{
  "symbol": "XAUUSDm",
  "storeVersion": "store_v6",
  "raw": {
    "M1": {
      "rowsCount": 0,
      "firstOpenTime": null,
      "lastOpenTime": null,
      "lastPullAt": null
    }
  },
  "clean": {
    "M1": {
      "rowsCount": 0,
      "firstOpenTime": null,
      "lastOpenTime": null,
      "lastCleanAt": null,
      "missingRanges": 0,
      "rejectedRows": 0
    }
  },
  "aggregated": {
    "H1": {
      "rowsCount": 0,
      "firstOpenTime": null,
      "lastOpenTime": null,
      "lastAggregateAt": null,
      "dirty": false
    }
  }
}
```

### 0.5.3 StoreV5 迁移和删除规则

旧 StoreV5 不应在 StoreV6 建立前直接删除。

迁移顺序：

```text
1. 新建 runtime_data/store_v6。
2. 从 MT5 重新全量拉 Raw M1。
3. 建立 barKey/globalIndex/sessionId。
4. 生成 Clean M1。
5. 生成 Aggregated Store。
6. DuckDB 查询和前端图表切到 StoreV6。
7. 抽样核对条数、范围、最后 K 线、图表显示。
8. 确认 StoreV6 可用后，归档或删除 StoreV5。
```

删除旧库规则：

```text
StoreV6 未完成前，不删除 StoreV5。
StoreV6 查询层未切换前，不删除 StoreV5。
StoreV6 抽样核对失败时，不删除 StoreV5。
确认 StoreV6 正常后，可以把 StoreV5 移到 archive，最后再人工删除。
```

## 1. 数据中心核心链路

推荐链路：

```txt
MT5 Terminal 原始拉取
  ↓
Raw M1 Store
  ↓
GlobalBarIndexBuilder
  ↓
SessionCalendar / TradingSessionRule
  ↓
M1IntegrityScanner
  ↓
Clean M1 Store
  ↓
Aggregated Store
  ↓
DuckDB 查询层
  ↓
KLineCharts datafeed / 后续外部系统接入
```

关键变化：

```text
先全量导入。
再建立全局索引。
再按交易时段规则清洗。
再做增量补洞。
最后从 Clean M1 聚合所有高周期。
```

不再把系统复杂度压在“拉取时过滤真实 M1”这一步。拉取只负责尽量完整拿到原始数据；可信数据由索引、时间网格和交易时段规则统一判断。

## 2. K 线唯一身份

每根 K 线的唯一身份必须固定、可反解析、可长期复用。

建议规则：

```text
barKey = symbol + "|" + period + "|" + openTime
```

示例：

```text
XAUUSDm|M5|1717386600
```

含义：

```text
symbol = XAUUSDm
period = M5
openTime = 1717386600 UTC 秒
```

数据库或 parquet 资产必须保证：

```text
UNIQUE(symbol, period, openTime)
```

`closeTime` 需要保存，但不建议放进唯一身份。正常情况下：

```text
closeTime = openTime + periodSeconds
```

建议结构必须分层，不能把所有字段都理解成身份字段：

```ts
type KLineIdentity = {
  symbol: string
  period: string
  openTime: number
  closeTime: number
  timestamp: number
  barKey: string
}

type KLineOhlcv = {
  open: number
  high: number
  low: number
  close: number
  volume: number
  spread?: number | null
  realVolume?: number | null
}

type KLineRuleAnnotation = {
  globalIndex: number
  sessionRuleId: string | null
  sessionRuleVersion: number | null
  sessionId: string | null
  tradingDay: string | null
  sessionOpenTime: number | null
  sessionCloseTime: number | null
  sessionState: 'trading' | 'closed' | 'weekend' | 'holiday' | 'unknown'
  isTradingTime: boolean

  quality: 'raw' | 'clean' | 'suspect' | 'rejected'
  rejectReason?: string | null
  gapBefore?: 'none' | 'missing' | 'session_gap' | 'weekend_gap' | 'holiday_gap'
  gapKind?: string | null
  completeness?: 'complete' | 'incomplete' | 'unknown'
}

type KLineSourceLineage = {
  source: 'mt5_raw' | 'clean_m1' | 'aggregated_m1' | 'mt5_reference'
  provider: 'mt5' | 'store_v6'
  pullJobId?: string | null
  aggregateJobId?: string | null
  sourcePeriod?: string | null
  sourceFromOpenTime?: number | null
  sourceToOpenTime?: number | null
  sourceBars?: number | null
  expectedSourceBars?: number | null
}

type StoreV6KLineRow =
  & KLineIdentity
  & KLineOhlcv
  & KLineRuleAnnotation
  & KLineSourceLineage
  & {
  createdAt: string
  updatedAt: string
  }
```

职责划分：

```text
barKey = 不可变身份
openTime = 连续性、缺口、交易日映射的基础
globalIndex = 按 symbol+period+openTime 排序后的序号，可随规则重建
sessionRuleId/sessionRuleVersion = 当前解释规则的版本
sessionId/tradingDay = 当前规则下的交易日/交易时段归属，可重算
quality/completeness = 当前规则下的质量解释，可重算
```

重要约束：

```text
barKey 不包含 sessionId。
barKey 不包含 sessionRuleVersion。
barKey 不包含 tradingDay。
barKey 不包含 quality。
```

也就是说，交易时间规则变化时，不允许改变 K 线身份，只允许重算解释字段。

## 2.5 Clean K 线准入标准

一根 K 线能够生成 `barKey`，只是说明它有可识别身份；能够进入 Clean Store，还必须通过准入标准。

Clean K 线的最低标准：

```text
1. symbol 有效，能匹配当前交易品种。
2. period 有效，能映射到明确的 periodSeconds。
3. openTime 有效，使用 UTC 秒。
4. barKey 可由 symbol+period+openTime 稳定生成。
5. openTime 落在该 period 的时间网格上。
6. openTime 符合 TradingSessionRule，不落在非交易时间内。
7. closeTime = openTime + periodSeconds，或能由 periodSeconds 稳定推导。
8. OHLCV 基本合法。
9. 与前后 Clean K 线的关系可解释：连续、合法 session gap、真实 missing gap 之后继续。
10. 没有重复占用同一个 UNIQUE(symbol, period, openTime)。
```

OHLCV 基本合法规则：

```text
open/high/low/close 都是有效数字。
high >= max(open, close, low)。
low <= min(open, close, high)。
volume 不为负数。
价格不为 0，除非该品种规则明确允许。
```

时间网格规则：

```text
openTime % periodSeconds == periodAnchorOffset
```

其中 `periodAnchorOffset` 必须来自周期规则和交易时段规则，不能由前端临时猜。

对于 M1：

```text
periodSeconds = 60
openTime 必须落在分钟边界。
```

对于 M5：

```text
periodSeconds = 300
openTime 必须落在 5 分钟边界。
```

对于 H4/D1 等高周期：

```text
openTime 必须落在 TradingSessionRule 定义的 bucket 边界。
不能直接套用 MT5 平台高周期边界。
```

准入结论：

```text
通过全部检查：
  quality = clean
  可进入 Clean Store / Aggregated Store

有 barKey 但不满足准入：
  留在 Raw Store
  标记 suspect/rejected/off_grid/wrong_period
  不进入 Clean Store

缺失但理论上应该存在：
  不造假 K 线
  生成 MissingRange
```

所以 StoreV6 不再以“清理/删除”为主流程。主流程是：

```text
识别身份 -> 检查准入 -> 标记质量 -> 只让 clean 数据进入正式序列
```

## 3. 全局时间网格

数据中心需要为每个 `symbol + period` 建立可预判的时间网格。

例如 M5：

```text
03:50 -> 03:55 -> 04:00 -> 04:05 -> ...
```

如果实际数据是：

```text
03:50 -> 04:30
```

并且这段时间属于交易时段，则可以直接算出缺失 K 线：

```text
periodSeconds = 300
diff = 04:30 - 03:50 = 2400 秒
missingCount = diff / periodSeconds - 1 = 7
```

缺失 openTime：

```text
03:55
04:00
04:05
04:10
04:15
04:20
04:25
```

判断规则：

```text
next.openTime == current.openTime + periodSeconds
  -> 连续

next.openTime > current.openTime + periodSeconds
  -> 可能有缺口

next.openTime <= current.openTime
  -> 重复、乱序或异常
```

但缺口必须结合交易时段判断：

```text
交易时段内缺 K 线 = missing gap
交易时段外没有 K 线 = session gap，不补假数据
周末/节假日没有 K 线 = weekend_gap / holiday_gap，不补假数据
```

## 4. 交易时段和开休市判断

每个品种需要有交易时段规则。对黄金这类品种，交易日分隔线可以按规则 ID 管理，例如：

```text
anchor = UTC2200
含义 = UTC 22:00 / UTC+8 06:00 作为交易日分割线
```

这个规则不是要求 M1 数据里必须存在 UTC 22:00 那根 K 线，而是用于：

```text
1. 判断当前时间是否处于交易时段。
2. 判断两个 K 线之间的空白是缺失还是休市。
3. 给每根 K 线分配 sessionId。
4. 对齐交易日分隔线。
5. 作为 H1/H4/D1 等聚合 bucket 的边界规则。
```

建议结构：

```ts
type TradingSessionRule = {
  ruleId: string
  ruleVersion: number
  symbol: string
  timezone: 'UTC'
  sessionAnchor: 'UTC2200'
  source: Array<'mt5_export' | 'inferred_from_m1' | 'manual_override'>
  weeklyOpenTime: string
  weeklyCloseTime: string
  dailyBreaks: Array<{
    from: string
    to: string
  }>
  holidays?: Array<{
    date: string
    reason: string
  }>
  overrides?: Array<{
    from: string
    to: string
    state: 'open' | 'closed'
    reason: string
  }>
  updatedAt: string
}
```

规则保存位置：

```text
runtime_data/store_v6/sessions/
  trading_session_rules.json
  symbols/
    XAUUSDm.session_rule.json
  session_calendar.parquet
```

MT5 的交易时间段不一定能直接、完整、稳定地从 Python API 读取。StoreV6 不应依赖单一来源，而应支持三类规则来源合并：

```text
1. mt5_export
   通过 MT5/MQL5 导出 SymbolInfoSessionTrade / SymbolInfoSessionQuote。

2. inferred_from_m1
   从历史 M1 实际连续性反推周内开盘、每日停盘、周末断点。

3. manual_override
   人工覆盖特殊品种规则，例如黄金 UTC2200 锚点、每日停盘、节假日。
```

最终进入 Clean/聚合判断的不是“MT5 原始 session”，而是 StoreV6 自己的 `TradingSessionRule`。该规则必须带 `ruleId` 和 `ruleVersion`。

规则变更原则：

```text
规则可以调整。
barKey 不可以调整。
```

当交易时间规则变化时，系统应执行规则重算任务：

```text
1. 新增或更新 TradingSessionRule.ruleVersion。
2. 找出受影响的 symbol 和时间范围。
3. 不修改 Raw Store 的 barKey。
4. 重算 Global Index 的 sessionRuleId/sessionRuleVersion/sessionId/tradingDay/sessionState。
5. 重算 Clean M1 的 quality/gapKind/sessionId/tradingDay。
6. 重算 MissingRange。
7. 标记受影响 Aggregated Store dirty。
8. 重新聚合受影响周期。
```

这意味着：一根 K 线的身份永久固定，但它在某个规则版本下的解释可以变化。

### 4.1 MT5 完整扫描和本地规则缓存

`Scan MT5` 不应只作为前端列表刷新按钮。StoreV6 需要把它升级为数据中心前置任务：

```text
完整扫描 MT5 品种
  -> 读取 symbol_info 基础详情
  -> 读取或导入 SymbolInfoSessionQuote / SymbolInfoSessionTrade
  -> 写入 StoreV6 本地详情文件
  -> 生成 TradingSessionRule v1
  -> 后续拉取、清洗、聚合、开休市判断都读本地规则文件
```

StoreV6 本地文件：

```text
runtime_data/store_v6/sessions/mt5_symbol_details.json
runtime_data/store_v6/sessions/trading_session_rules.json
runtime_data/store_v6/sessions/symbols/{symbol}.session_rule.json
```

职责：

```text
mt5_symbol_details.json
  保存完整 MT5 symbol_info 扫描结果，包括 digits、point、spread、contract、currency、tradeMode、sessions 等。

trading_session_rules.json
  保存所有品种的 StoreV6 TradingSessionRule 汇总。

symbols/{symbol}.session_rule.json
  保存单个品种的规则文件，方便拉取、聚合、市场状态判断直接读取。
```

交易时段来源顺序：

```text
1. 优先读取 MQL5 导出文件：
   FractalFrame/mt5_symbol_sessions.json

2. 如果导出文件不存在，刷新扫描时尝试 Python MetaTrader5 session 函数：
   symbol_info_session_quote
   symbol_info_session_trade

3. 如果仍然没有，保留 symbol_info，session 来源标记为 symbol_scan，后续允许 inferred_from_m1 或 manual_override 补规则。
```

这个前置模块属于 StoreV6，不属于 StoreV5。旧的 `runtime_data/instruments/mt5/symbol_universe_info.json` 可以继续作为 MT5 品种列表缓存，但正式规则来源应同步到 `runtime_data/store_v6/sessions/`。

后续模块读取边界：

```text
拉取按钮：
  读 symbols/{symbol}.session_rule.json，判断下一根理论 M1、session gap 和缺口。
  写入 Raw/Clean 时补充 sessionRuleId、sessionRuleVersion、sessionState、isTradingTime、tradingDay。

聚合按钮：
  读 symbols/{symbol}.session_rule.json，确定 H1/H4/D1/W1/MN bucket 边界。
  写入 Aggregated 时补充同一套可重算规则注解字段。

开市/休市判断：
  读 symbols/{symbol}.session_rule.json，结合当前时间和最新 Clean K 线判断 marketStatus。

规则调整：
  修改或覆盖 symbols/{symbol}.session_rule.json，提升 ruleVersion，然后触发规则重算。
```

有了交易时段规则后，可以稳定判断市场状态：

```ts
type MarketStatus =
  | 'open'
  | 'closed'
  | 'session_break'
  | 'weekend'
  | 'holiday'
  | 'open_but_data_lagging'
  | 'unknown'
```

判断逻辑：

```text
1. 取当前时间 now。
2. 查询 symbol 的 TradingSessionRule。
3. 判断 now 是否处于交易时段。
4. 读取最新 clean/indexed K 线 lastBar。
5. 如果 now 在交易时段，但 lastBar 明显落后，则标记 open_but_data_lagging。
6. 如果 now 不在交易时段，则标记 closed/session_break/weekend/holiday。
```

这样系统可以回答：

```text
现在应该有新 K 线吗？
MT5 没有返回新数据是正常休市，还是数据源落后？
某段空白应该补，还是应该保留为 session gap？
```

## 5. Raw Store 和 Clean Store

底层建议拆成两层：

```text
Raw Store = 原始拉取数据，尽量完整保留，用于审计、回放、修复
Clean Store = 经过索引和交易时段规则清洗后的可信 K 线，用于图表、指标、聚合、回测
```

Raw M1 写入原则：

```text
1. MT5 能拉多少先落多少。
2. 按 symbol+period+openTime 去重。
3. 不在拉取阶段做复杂真假判断。
4. 保留 mt5RowsCount、pullTime、sourceRange、原始质量标记。
5. 不物理删除异常数据，只标记质量和原因。
```

Clean M1 生成原则：

```text
1. 只从 Raw M1 或补洞结果生成。
2. 必须拥有 barKey/globalIndex/sessionId。
3. 必须通过 periodSeconds 连续性检查。
4. 必须区分 missing gap 和合法 session gap。
5. 可疑或错误 K 线不直接删除物理文件，优先隔离或标记 quality。
6. 图表、指标、聚合默认只读取 quality=clean 的数据。
```

Raw 数据质量状态：

```ts
type RawBarQuality =
  | 'raw'
  | 'clean'
  | 'suspect'
  | 'rejected'
  | 'duplicate'
  | 'off_grid'
  | 'wrong_period'
```

拒绝或隔离原因：

```ts
type RejectReason =
  | 'unexpected_open_time'
  | 'off_time_grid'
  | 'duplicate_bar_key'
  | 'before_first_valid_m1'
  | 'wrong_period_shape'
  | 'ohlcv_invalid'
  | 'older_than_clean_tail'
  | 'unknown'
```

分页和查询默认策略：

```text
历史图表 / 指标计算 / 高周期聚合：
  只读 Clean Store。

数据中心诊断页：
  可以读取 Raw + clean + suspect + rejected + MissingRange。

修复工具：
  根据 rejectReason、gapType、barKey 定位异常和补洞。
```

parquet 推荐字段：

```text
symbol
period
openTime
closeTime
timestamp
barKey
globalIndex
sessionId
open
high
low
close
volume
quality
rejectReason
source
```

## 6. 全量导入和增量补洞

### 6.1 首次全量导入

首次建立某个 symbol 的数据资产时，推荐流程：

```text
1. 从 MT5 全量拉取 M1 原始数据。
2. 写入 Raw M1 Store。
3. 按 symbol+M1+openTime 去重、排序。
4. 生成 barKey。
5. 建立 globalIndex。
6. 按 TradingSessionRule 生成 sessionId。
7. 扫描连续性和缺口。
8. 标记 wrong_period/off_grid/duplicate/suspect/rejected。
9. 生成 Clean M1 Store。
10. 更新 manifest 和 index manifest。
```

首次扫描时，经常会遇到 MT5 历史最前段不是 M1 的情况：

```text
最早一段：一天一根
中间一段：一小时一根
后面才开始：一分钟一根
```

StoreV6 不在拉取阶段猜真假，而是在索引扫描阶段处理：

```text
1. 取候选 Raw bar。
2. 计算 expectedOpenTime。
3. 如果 raw.openTime 不在 M1 时间网格上，标记 off_grid/wrong_period。
4. 如果 raw.openTime 早于第一根有效 M1，标记 before_first_valid_m1。
5. 如果 raw.openTime 等于 expectedOpenTime，进入 Clean Store。
6. 如果 raw.openTime 大于 expectedOpenTime，结合 TradingSessionRule 判断：
   - 中间是休市/周末/节假日：记录 session_gap/weekend_gap/holiday_gap，允许继续。
   - 中间是交易时间：记录 MissingRange。
7. 如果 raw.openTime 小于 expectedOpenTime，标记 older_than_clean_tail 或 duplicate。
```

`expectedOpenTime` 不能简单写死为 `lastOpenTime + 60`，必须来自交易时段规则：

```text
expectedOpenTime = sessionRule.nextTradableOpenTime(lastOpenTime, period)
```

### 6.2 后续增量

后续增量不应该盲目拉全量。

标准流程：

```text
1. 查询当前 symbol+period 的 clean/index 范围。
2. 查询 MT5 可返回的最新 M1 时间。
3. 计算 tail missing range。
4. 扫描 index manifest 中已有 middle missing range。
5. 已有 barKey 不重复拉。
6. 定向拉取 tail 或 middle gap。
7. 写入 Raw Store。
8. 重建受影响区间的 Clean Store 和 globalIndex。
9. 更新缺口清单、页面清单和聚合状态。
```

增量扫描规则：

```text
1. 从当前 Clean Store 最后一根可信 K 线开始。
2. 用 sessionRule.nextTradableOpenTime 预测下一根 openTime。
3. 拉取 MT5 候选数据并写入 Raw Store。
4. Raw 候选按 openTime 排序、去重。
5. 已有 barKey 不进入 Clean Store。
6. raw.openTime == expectedOpenTime：
   - 接入 Clean Store
   - 推进 expectedOpenTime
7. raw.openTime < expectedOpenTime：
   - 标记 older_than_clean_tail / duplicate
8. raw.openTime > expectedOpenTime：
   - 如果中间是合法休市，记录 session gap 后继续接入。
   - 如果中间是交易时间，生成 MissingRange。
   - 是否继续接入后续 K 线由完整性策略决定。
```

推荐完整性策略：

```text
历史底座采用宽松接入：
  记录 MissingRange，但允许后续可对齐 K 线继续进入 Clean Store。

聚合和指标采用完整性门禁：
  涉及 MissingRange 的高周期 bucket 标记 incomplete 或跳过。
```

这样即使 MT5 底层数据缺了几根，系统也不会假造数据；缺口会留在 manifest 中，未来如果 MT5 补回同一 `barKey`，可以精确填洞。

缺失区间结构：

```ts
type MissingRange = {
  symbol: string
  period: string
  timeFrom: number
  timeTo: number
  expectedBars: number
  reason: 'head' | 'tail' | 'middle_gap'
  gapType: 'missing' | 'session_gap' | 'weekend_gap' | 'holiday_gap'
  status: 'open' | 'partial_filled' | 'filled' | 'ignored' | 'unfillable_from_mt5'
  missingBarKeys?: string[]
  filledBarKeys?: string[]
  firstDetectedAt: string
  lastCheckedAt?: string
}
```

补洞规则：

```text
1. MissingRange 是任务，不是 K 线。
2. 缺口内每个理论 K 线都可以按 symbol+period+openTime 生成 barKey。
3. 后续 MT5 如果返回同一 barKey，先写 Raw，再重新进入 Clean 扫描。
4. 通过检查后，MissingRange 缩小、partial_filled 或 filled。
5. 多次检查 MT5 仍无法返回，可以标记 unfillable_from_mt5，但不伪造 K 线。
6. session_gap/weekend_gap/holiday_gap 默认 ignored，不作为待补任务。
```

### 6.3 拉取按钮：顺序推进式拉取模块

StoreV6 的 `拉取` 按钮不再代表旧 StoreV5 的“一次性全量拉取后再过滤”。新拉取模块应当是顺序推进式任务：

```text
从历史最早端开始
  -> 按批次向最新端推进
  -> 每根 K 线生成稳定身份
  -> 校验时间网格和交易时段
  -> 写入 Raw / Clean / Quality
  -> 更新 manifest 和进度
```

核心原则：

```text
1. 主方向永远是从头到尾，不从尾部倒着补历史。
2. 第一次建立底座时会慢，因为要从 MT5 最早可用 M1 一直推进到当前。
3. 第一次完成后，后续增量只从当前 Clean M1 尾部继续推进。
4. 越早的历史 K 线越稳定，一旦通过 Clean 准入并入库，原则上不再反复扫描。
5. 已有 barKey 不重复写入；重复返回的数据只标记 duplicate 或跳过 Clean。
6. 不因为中间有缺口就伪造 K 线；缺口进入 MissingRange。
7. 不物理删除异常数据；异常 Raw bar 只做 quality/rejectReason 标记。
```

推荐批次大小：

```text
默认每批 20,000 根 M1。
批次大小应可配置，例如 5,000 / 20,000 / 100,000。
前端按钮不直接决定批次逻辑，只触发后端 StoreV6 pull job。
```

#### 6.3.1 首次拉取流程

本地没有 Clean M1 时：

```text
1. 查询 MT5 当前能返回的最早 M1 候选位置。
2. 从最早端开始拉取第一批，例如 20,000 根。
3. 对每根候选 K 线生成 barKey：
   barKey = symbol + "|" + "M1" + "|" + openTime
4. 检查 openTime 是否落在 M1 时间网格。
5. 检查 openTime 是否符合 TradingSessionRule。
6. 检查 OHLCV 基本合法性。
7. 合格数据进入 Clean M1。
8. 不合格数据保留在 Raw，标记 suspect/rejected/off_grid/wrong_period。
9. 如果发现 raw.openTime 大于 expectedOpenTime：
   - 中间是休市/周末/节假日：记录 session_gap/weekend_gap/holiday_gap。
   - 中间是交易时间：生成 MissingRange。
10. 本批完成后，以上一批最后一根可推进位置作为下一批起点。
11. 重复拉取，直到推进到 MT5 当前最新 M1 或市场当前可解释的末端。
12. 更新 symbol manifest、pull job diagnostics、缺口清单和页面状态。
```

#### 6.3.2 后续增量拉取流程

本地已有 Clean M1 时：

```text
1. 读取当前 symbol 的最后一根 clean M1。
2. 通过 sessionRule.nextTradableOpenTime(lastOpenTime, M1) 计算下一根理论 openTime。
3. 从这个理论位置附近开始向后拉取 MT5 候选数据。
4. 每批仍按 20,000 根左右处理。
5. 对每根候选数据生成 barKey。
6. 如果 barKey 已存在：
   - 不重复写入 Clean。
   - 可记录 duplicate/overlap，用于诊断。
7. 如果 raw.openTime == expectedOpenTime：
   - 通过准入后写入 Clean。
   - 推进 expectedOpenTime。
8. 如果 raw.openTime < expectedOpenTime：
   - 标记 older_than_clean_tail 或 duplicate。
9. 如果 raw.openTime > expectedOpenTime：
   - 结合 TradingSessionRule 判断中间空白。
   - 合法休市空白记录为 session gap。
   - 交易时间内缺失记录为 MissingRange。
10. 持续推进到 MT5 最新可用 M1。
```

增量拉取的本质不是“重新检查全部历史”，而是：

```text
读取 Clean Store 尾部
  -> 计算下一根理论 K 线
  -> 从尾部继续追加
```

因此第一次拉取完成后，后续拉取应当很快。

#### 6.3.3 有相同 ID 时的处理

`barKey` 是去重和对齐的主键，但不能把“有相同 ID”理解为“MT5 不需要拉”。MT5 API 通常仍然按时间或数量返回数据，真正的去重发生在 StoreV6 写入层。

规则：

```text
1. Raw 层可以保留重复返回记录，或记录 duplicate diagnostics。
2. Clean 层必须保证 UNIQUE(symbol, period, openTime)。
3. 同一 barKey 已有 clean 数据时，新返回候选不覆盖 clean。
4. 如果同一 barKey 的 OHLCV 与 clean 不一致，记录 revision/diff，不直接覆盖。
5. 只有明确执行修复任务时，才允许按审计规则替换 clean 数据。
```

#### 6.3.4 拉取进度条和状态文案

前端 `拉取` 按钮应复用 Store 面板已有进度条结构：

```text
一行状态文字
一条进度条
停止按钮
```

UI 行为规则：

```text
1. 默认没有拉取任务时，进度条隐藏。
2. 点击“拉取”后，立即创建 pull job，并显示进度条。
3. 进度条区域直接显示当前阶段文字和“停止”按钮。
4. 点击“停止”后，请求后端取消当前 pull job。
5. 停止后前端立即关闭进度条区域。
6. 已经写入 Raw/Clean 的批次保留，不回滚。
7. 再次点击“拉取”时，重新读取 Clean M1 尾部并继续推进。
8. 断点续传不依赖前端记忆，而依赖 StoreV6 的 barKey、Clean 尾部和 manifest。
```

状态文字由后端 pull job 上报，推荐阶段：

```text
准备拉取：读取本地最后一根 clean M1
正在定位起点：计算下一根理论 K 线
正在从 MT5 读取：本批 20,000 根
正在生成 K 线身份 ID
正在校验 M1 时间网格
正在校验交易时段
正在写入 Raw Store
正在写入 Clean Store
正在记录缺口与异常
本批完成，准备下一批
拉取完成，仓库已推进到最新
```

进度条规则：

```text
1. 如果知道 MT5 最新时间和当前推进时间，可以显示总体百分比。
2. 如果不知道总范围，使用不确定进度动画。
3. 每批内部可以按 fetchedRows / batchSize 显示批次进度。
4. 后端任务状态必须包含 phase、currentBatch、rowsFetched、rowsWritten、lastOpenTime、latestMt5OpenTime。
5. 前端只展示状态，不在前端推导数据真假。
```

建议 pull job 状态结构：

```ts
type StoreV6PullJob = {
  jobId: string
  symbol: string
  period: 'M1'
  mode: 'initial' | 'incremental' | 'repair'
  phase:
    | 'preparing'
    | 'locating_start'
    | 'fetching'
    | 'building_identity'
    | 'validating_grid'
    | 'validating_session'
    | 'writing_raw'
    | 'writing_clean'
    | 'recording_quality'
    | 'batch_completed'
    | 'completed'
    | 'failed'
    | 'cancelled'

  batchSize: number
  currentBatch: number
  rowsFetched: number
  rowsWrittenRaw: number
  rowsWrittenClean: number
  duplicateRows: number
  rejectedRows: number
  missingRanges: number

  firstOpenTime: number | null
  lastOpenTime: number | null
  latestMt5OpenTime: number | null
  progressPercent: number | null
  progressLabel: string
  startedAt: string
  updatedAt: string
  error?: string
}
```

#### 6.3.5 停止和断点续传

`停止` 不是删除任务成果，也不是回滚仓库。它只表示停止当前后台拉取任务继续读取下一批。

停止流程：

```text
1. 用户点击进度条上的“停止”。
2. 前端调用 cancel pull job API。
3. 后端把当前 job 标记为 cancelling/cancelled。
4. 如果正在写入某个批次，必须保证批次写入要么完成，要么按事务/临时文件规则不污染正式文件。
5. 已经完成写入并通过准入的 K 线保留。
6. 前端关闭进度条。
7. 概览和周期列表可以刷新一次，显示当前已经推进到的位置。
```

再次拉取流程：

```text
1. 用户再次点击“拉取”。
2. 后端读取 symbol manifest 和 Clean M1 的最后一根 clean bar。
3. 通过 sessionRule.nextTradableOpenTime(lastOpenTime, M1) 得到下一根理论 K 线。
4. 从该位置继续向后拉取。
5. 如果 MT5 返回了已经存在的 barKey，写入层自动跳过或标记 duplicate。
6. 因此自然形成断点续传。
```

断点续传的关键不是前端保存“上次拉到第几批”，而是数据本身有稳定身份：

```text
barKey = symbol + "|" + period + "|" + openTime
Clean tail = 当前仓库最后一根可信 K 线
manifest = 当前仓库范围、最后更新时间、缺口状态
```

所以即使前端刷新、任务中断、程序重启，只要 StoreV6 已经落盘，下一次拉取仍然可以对齐到正确位置继续。

#### 6.3.6 拉取按钮的职责边界

前端按钮只负责触发任务和显示任务状态：

```text
点击拉取
  -> POST /store-v6/pull
  -> 后端创建 StoreV6PullJob
  -> 前端轮询或订阅 job 状态
  -> 显示阶段文字和进度条
  -> 完成后刷新 M1 概览、周期列表和 manifest
```

拉取按钮不负责：

```text
1. 在前端判断真假 M1。
2. 在前端生成最终 Clean 数据。
3. 在前端直接读写 parquet。
4. 在前端删除异常数据。
5. 在前端决定高周期聚合结果。
```

后端 StoreV6 pull job 负责：

```text
1. 分批从 MT5 读取候选 M1。
2. 生成 barKey/globalIndex/sessionId。
3. 写 Raw。
4. 按准入标准写 Clean。
5. 记录 duplicate/suspect/rejected/MissingRange。
6. 更新 manifest。
7. 上报进度。
```

当前实现补充：

```text
1. 拉取按钮只负责 Raw/Clean M1。
2. 拉取完成后不自动触发高周期聚合。
3. 如果没有新的已闭合 M1，任务直接 no-op 完成，不访问 MT5。
4. 如果新增了 M1，只把对应聚合周期标记 dirty。
5. 需要更新 M5/M15/H1 等高周期时，用户单独点击“聚合”。
```

## 7. 高周期聚合规则

MT5 的高周期 K 线不能作为最终可信资产。

原因是：MT5 的 H4、D1 等周期可能按 UTC0 或平台规则聚合，而黄金等品种真实交易日可能按 UTC22:00 开始，并且中间存在停盘空隙。如果直接使用 MT5 高周期，停盘空白可能被错误聚合进某根 H4/D1，导致图表、指标和回测都错位。

硬规则：

```text
1. Direct Store 只允许 Clean M1 作为真源头。
2. M5、M15、M30、H1、H4、D1、W1、MN 全部从 Clean M1 聚合生成。
3. MT5 高周期只允许作为实时看盘输入、参考或对照，不进入历史可信 Store。
4. 聚合必须使用 TradingSessionRule 和 sessionId。
5. 不完整 bucket 自动跳过或标记 incomplete，不能伪造成完整 K 线。
```

周期命名以 MT5 界面为准：

```text
M1, M5, M15, M30, H1, H4, D1, W1, MN
```

如果旧 StoreV5 或 MT5 Python API 内部仍使用 `MN1`，StoreV6 查询和聚合入口可以把 `MN` 兼容映射为 `MN1`，但前端和文档统一展示为 `MN`。

### 7.1 聚合按钮：顺序周期 + 分批写入

`聚合` 按钮不应一次性把所有周期混在一起处理。它应当是一个可观察、可停止、可续传的 StoreV6 aggregate job。

默认顺序：

```text
M5 -> M15 -> M30 -> H1 -> H4 -> D1 -> W1 -> MN
```

聚合输入永远是 StoreV6 Clean M1。每个目标周期都按同一套规则生成身份：

```text
barKey = symbol + "|" + period + "|" + openTime
globalIndex = 当前 period 内按 openTime 排序后的序号
sourcePeriod = M1
sourceBars = 本根聚合 K 线使用的 Clean M1 数量
expectedSourceBars = 理论应使用的 M1 数量
completeness = complete / incomplete
```

因此，聚合 K 线不是“写完以后再补索引”，而是在每根聚合 K 线生成时就确定身份 ID、周期、开盘时间、来源范围和完整性。只有带身份的聚合 K 线才能写入 Aggregated Store。

分批规则：

```text
1. 后端不一次性把 Clean M1 全部读进 Python 内存。
2. DuckDB 从 Clean M1 parquet 按 openTime 顺序读取窗口。
3. 默认每个窗口约 20,000 根 M1。
4. 先处理当前目标周期，例如 M5。
5. 当前窗口最后一个未确认完整的 bucket 暂存为 carry。
6. 下一窗口到来时，carry 与新窗口开头拼接后继续判断。
7. 已确认可落库的 bucket 生成目标周期 K 线。
8. 每根目标周期 K 线生成 barKey/globalIndex/sourceFrom/sourceTo。
9. 写入 aggregated parquet。
10. 更新 manifest 和进度。
11. 当前周期完成后，再进入下一个周期。
```

这个方式称为 DuckDB 流式窗口聚合。它适合黄金这类长期历史 M1 数据，例如 300W 根 M1，不需要一次性加载到内存。

进度条复用拉取模块的同一套 UI：

```text
正在聚合 M5：第 1/12 批，来源 M1 20,000/240,000
正在聚合 M5：第 2/12 批，来源 M1 40,000/240,000
...
M5 完成
正在聚合 M15：第 1/12 批
...
全部聚合完成
```

停止规则和拉取一致：

```text
1. 用户点击进度条上的“停止”。
2. 后端标记 aggregate job cancelRequested。
3. 当前已完成写入的批次保留。
4. 未完成的批次不写入正式文件，或通过临时文件规则避免污染正式文件。
5. 前端关闭进度条。
6. 再次点击聚合时，根据 barKey 去重和 manifest 状态继续推进。
```

断点续传的关键仍然是 `barKey`。如果某个周期前 3 批已经写入，再次聚合时遇到相同 `barKey` 直接跳过或覆盖为同一身份记录，不需要前端记住“上次聚合到第几批”。

如果选择 `rebuild=true`，表示主动重建目标周期，可以先清空该周期 Aggregated Store 后重新生成；如果是普通聚合或停止后的继续聚合，应走 append/deduplicate 模式，依靠 `barKey` 自然续传。

当前 StoreV6 普通聚合规则：

```text
rebuild=false 时，不从头聚合。

1. 如果目标周期已存在且 manifest 证明它覆盖到 Clean M1 当前应有 bucket，直接跳过。
2. 如果目标周期 dirty 或落后，读取该周期上次 sourceLastTime / lastOpenTime。
3. 回退到该 source 所在的目标周期 bucket。
4. 删除该 bucket 之后的尾部聚合 K。
5. 只读取这段之后的 Clean M1，重新生成尾部聚合 K。
6. 周期完整完成后，才把 sourceLastTime 提升到 Clean M1 最新 lastOpenTime。
7. 如果中途停止，已写入批次保留，但 manifest 不应假装该周期已经完整最新。
```

StoreV6 manifest 不能只靠 `sourceLastTime` 判断聚合周期是否最新，还必须检查目标周期自己的 `lastOpenTime`：

```text
expectedBucket = bucketStart(cleanM1.lastOpenTime, targetPeriod, UTC2200)
if aggregated.lastOpenTime < expectedBucket:
    targetPeriod 必须重新进入聚合目标
```

这是为了避免出现 “sourceLastTime 已经到最新 M1，但 M5 lastTime 仍停在旧时间” 的假最新状态。

### 7.1.1 StoreV6 Audit / Repair

StoreV6 必须提供 manifest 审计修复能力。原因是 parquet 已经落盘后，任务中断、旧逻辑 bug、手工迁移都可能导致 manifest 与真实 parquet 不一致。

接口：

```text
GET /api/market-data/v1/store-v6/audit?symbol=XAUUSDm
GET /api/market-data/v1/store-v6/audit?symbol=XAUUSDm&repair=1
```

审计内容：

```text
1. 扫描 symbol 下每个 dataset 的 parquet part 文件。
2. 计算真实 rowsCount / partsCount / firstOpenTime / lastOpenTime。
3. 对比 manifest 中的 rowsCount / partsCount / firstOpenTime / lastOpenTime / firstTime / lastTime。
4. 对聚合周期额外检查 lastOpenTime 是否覆盖到 Clean M1 当前应有 bucket。
5. repair=1 时修正 manifest，并把落后的聚合周期标记 dirty=true。
```

Audit/repair 只修 manifest，不伪造 K 线，不直接改写 Clean M1。真正的数据重算仍然由“聚合”任务完成。

### 7.2 MT5 高周期的定位

MT5 高周期数据不是历史存量库的一部分，它主要解决前台实时看盘问题。

例如用户正在看 H1 图，而 Clean M1 还没有整理到最新位置，此时可以直接拉取 MT5 H1：

```text
MT5 H1/H4 拉取
  -> 按 symbol+period+openTime 生成 barKey
  -> 放入实时序列或临时参考层
  -> 前台先显示
```

这些临时 K 线可以排在历史聚合序列右侧，因为它们使用同一套身份规则：

```text
barKey = symbol + "|" + period + "|" + openTime
```

当后续 Clean M1 补齐并重新聚合出同一根高周期 K 线时：

```text
同一 barKey 下，Clean M1 聚合结果接管。
MT5 高周期结果只作为 reference/diff 记录，不覆盖历史可信资产。
```

因此不需要把高周期历史数据永久拆成“MT5 拉取库”和“聚合库”两套可信库。最终历史存量只有一套：

```text
Aggregated Store = Clean M1 按 TradingSessionRule 聚合后的可信高周期资产
```

MT5 高周期只作为：

```text
1. 实时看盘临时数据。
2. 聚合结果的参考对照。
3. 定位 M1 缺口、平台 bucket 差异、数据源修正的诊断输入。
```

### 7.3 同一 barKey 的优先级

如果 MT5 高周期和系统聚合高周期可以生成同一个 `barKey`，说明它们指向同一根逻辑 K 线。

判断规则：

```text
symbol 相同
period 相同
openTime 相同
barKey 相同
  -> 同一根 K 线
```

如果 OHLCV 也一致：

```text
referenceMatched = true
```

如果 `barKey` 一致但 OHLCV 不一致：

```text
trusted = Clean M1 聚合结果
reference = MT5 高周期结果
记录 diff，不覆盖 trusted
```

原因：

```text
M1 是更细粒度的事实源。
高周期只是聚合结果。
只要 Clean M1 完整可信，系统自己的聚合结果优先级最高。
```

建议差异结构：

```ts
type ReferenceBarDiff = {
  symbol: string
  period: string
  barKey: string
  openTime: number

  trustedSource: 'clean_m1_aggregated'
  referenceSource: 'mt5_period'

  trustedOhlcv: Ohlcv
  referenceOhlcv: Ohlcv

  diff: {
    open?: number
    high?: number
    low?: number
    close?: number
    volume?: number
  }

  reason?: 'mt5_bucket_rule_diff' | 'm1_gap' | 'broker_revision' | 'unknown'
}
```

聚合后生成新的高周期 K 线身份：

```text
barKey = symbol + "|" + aggregatedPeriod + "|" + bucketOpenTime
```

例如：

```text
XAUUSDm|H4|1717387200
```

聚合输入和输出都必须能追溯：

```ts
type AggregatedBarRow = {
  symbol: string
  period: string
  openTime: number
  closeTime: number
  barKey: string
  globalIndex: number
  sessionId: string

  sourcePeriod: 'M1'
  sourceFromOpenTime: number
  sourceToOpenTime: number
  sourceBars: number
  expectedSourceBars: number
  completeness: 'complete' | 'incomplete' | 'session_trimmed'

  open: number
  high: number
  low: number
  close: number
  volume: number
}
```

## 8. HTTP API 边界

StoreV6 新接口建议使用 `/store-v6/` 前缀。旧 `/store-v5/` 可以在迁移期做兼容转发，但新功能、质量标记、补洞、Raw/Clean 分层和高周期接管规则都按 StoreV6 语义实现。

### MT5 原始检查

```txt
GET /api/market-data/v1/mt5/m1/check?symbol=XAUUSDm
```

用途：只检查 MT5 当前能返回多少 M1、最新时间、连接状态。

该接口不写 Clean Store，不做最终入库判断。

### Raw 拉取

```txt
GET /api/market-data/v1/store-v6/raw/pull?symbol=XAUUSDm&mode=full
GET /api/market-data/v1/store-v6/raw/pull?symbol=XAUUSDm&mode=incremental
```

用途：把 MT5 原始 M1 写入 Raw Store。

### MT5 高周期实时拉取

```txt
GET /api/market-data/v1/mt5/period/query?symbol=XAUUSDm&period=H1&limit=500
```

用途：为前台实时看盘临时拉取 MT5 高周期。

规则：

```text
1. 返回结果也必须按 symbol+period+openTime 生成 barKey。
2. 可以与 Aggregated Store 的历史序列按 barKey 对齐。
3. 只能作为 realtime/reference 输入。
4. 不写入历史可信 Aggregated Store。
5. 后续 Clean M1 聚合出同一 barKey 时，由聚合结果接管。
```

### 索引重建和清洗

```txt
POST /api/market-data/v1/store-v6/index/rebuild
POST /api/market-data/v1/store-v6/clean/rebuild
```

用途：

```text
index/rebuild = 按 symbol+period+openTime 建立 barKey/globalIndex/sessionId
clean/rebuild = 按索引和交易时段规则生成 Clean M1
```

### 缺口扫描

```txt
GET /api/market-data/v1/store-v6/gaps?symbol=XAUUSDm&period=M1
```

用途：返回 missing gap、session gap、weekend gap、holiday gap。

### 市场状态

```txt
GET /api/market-data/v1/store-v6/market-status?symbol=XAUUSDm&period=M1
```

用途：基于交易时段规则、当前时间和最新 clean K 线判断开市/休市/数据滞后。

### 聚合重建

```txt
POST /api/market-data/v1/store-v6/aggregate/rebuild
```

用途：从 Clean M1 按 TradingSessionRule 重建派生周期仓。

### DuckDB 查询

```txt
GET /api/market-data/v1/store-v6/query?symbol=XAUUSDm&period=M1&mode=clean&limit=1000
GET /api/market-data/v1/store-v6/query?symbol=XAUUSDm&period=H4&mode=aggregated&anchor=UTC2200
```

用途：统一给图表、分页、指标、后续外部系统提供 OHLCV 和索引字段。

返回 rows 至少包含：

```text
symbol
period
openTime
closeTime
timestamp
barKey
globalIndex
sessionId
open/high/low/close
volume
```

## 9. 前端 MT5 Import Center

右侧 MT5 数据中心是控制台，不是数据源本身。

新版职责：

1. 扫描 MT5 品种列表。
2. 选择 symbol。
3. 检查 MT5 原始 M1 状态。
4. 触发 Raw 全量/增量拉取。
5. 查看 Raw Store、Clean Store、Aggregated Store 状态。
6. 触发索引重建。
7. 查看缺口清单。
8. 触发 Clean M1 重建。
9. 查看市场状态：开市、休市、数据滞后、节假日。
10. 触发高周期聚合重建。

前端不保存 OHLCV，不计算 K 线真假，不直接读取 parquet，不直接接 MT5 K 线。前端只调用 HTTP API。

## 10. KLineCharts 接入

KLineCharts 只接 StoreV6 DuckDB 查询层。

Store 保存 UTC 秒级 `openTime`，KLineCharts 需要毫秒级 `timestamp`，所以转换只发生在前端 datafeed：

```ts
timestamp = openTime * 1000
```

Direct M1 查询：

```txt
mode=clean
period=M1
```

派生周期查询：

```txt
mode=aggregated
period=H4
anchor=UTC2200
```

历史图表不得绕过 Clean Store 直接使用 MT5 高周期。历史高周期必须来自 Clean M1 的规则聚合。

实时看盘可以临时拼接 MT5 高周期参考数据：

```text
Aggregated Store 历史序列
  + MT5 高周期 realtime/reference 右侧临时序列
```

拼接条件：

```text
1. symbol 相同。
2. period 相同。
3. openTime 可生成同一套 barKey。
4. 不覆盖 Aggregated Store 已有 trusted bar。
5. 当 Clean M1 聚合结果补到同一 barKey 时，移除或降级 MT5 reference bar。
```

### 10.1 分页规划器

分页规划器是 StoreV6 仓库和图表加载之间的第一层前端规划模块。它不负责加载 OHLCV，也不负责计算指标，只负责把一个 `symbol + period` 的 StoreV6 序列切成稳定页面。

核心链路：

```text
StoreV6 仓库
  -> 分页规划器
  -> 加载规划器
  -> KLineCharts
```

分页规划器职责：

```text
1. 读取 StoreV6 当前总行数、period、symbol。
2. 固定第 1 页为实时页。
3. 第 1 页以 StoreV6 最新 2000 根作为活动实时页基准。
4. 第 2 页开始为历史页。
5. 历史页大小默认 2500 根。
6. 为每一页生成 fromGlobalIndex / toGlobalIndex / rows / pageIndex。
7. 为当前页和下一页懒加载 timeFrom / timeTo。
8. 把分页符缓存到前端本地状态，避免每次打开都重新规划。
9. 管理第 1 页活动实时缓存的 rows/timeFrom/timeTo 展示状态。
```

分页规划器不做的事：

```text
1. 不直接查询整页 OHLCV。
2. 不计算指标。
3. 不直接处理实时 tick，但可以读取活动实时页缓存的摘要。
4. 不决定 KLineCharts 的实时/静态行为。
5. 不全量补齐所有页的起止时间。
```

时间范围加载规则：

```text
点击更新：
  生成全部分页符。
  立即打开第 1 页。
  只预取第 1 页和第 2 页的 timeFrom/timeTo。

点击第 N 页：
  打开第 N 页。
  只预取第 N 页和第 N+1 页的 timeFrom/timeTo。

禁止：
  点击更新时一次性查询所有页的起止时间。
```

这样做的原因：

```text
1. globalIndex 可以快速确定分页边界。
2. 起止时间只在展示、快捷翻页、补齐页面时需要。
3. 一次性补全所有页时间会让 DuckDB 扫描和前端等待变重。
4. 当前页 + 下一页预取可以支持主图下方的快捷翻页提示。
```

#### 10.1.0 活动实时页缓存器

第 1 页不是普通历史页，也不是每次打开都重新查询的静态页。第 1 页应被视为一个独占的“活动实时页缓存”：

```text
StoreV6 最新 2000 根
  -> 建立活动实时页缓存基准
  -> MT5 tick 持续更新最后一根或追加新 K 线
  -> 缓存 rows 从 2000 增长到 2001、2002...
  -> 前端本地持久化
```

活动实时页缓存器职责：

```text
1. 保存 symbol + period 对应的实时页 K 线数组。
2. 初始基准来自 StoreV6 最新 2000 根。
3. 后续只接收尾部实时更新，不在缩放/拖动时补载历史。
4. 切到历史页时继续在后台更新，不渲染实时 K 线。
5. 切回第 1 页时直接渲染缓存，不重新按 StoreV6 固定 2000 根重建。
6. 刷新前端后从本地持久化恢复缓存。
7. 缓存行数变化时通知分页规划器更新第 1 页 rows/timeFrom/timeTo。
```

缓存边界规则：

```text
首次建立：
  StoreV6 最新 2000 根 -> 写入活动实时页缓存。

运行中：
  tick 更新最后一根。
  新 bar 出现时追加到缓存尾部。
  缓存可以增长，不强制裁回 2000。

达到 2500：
  触发分页整理提示或整理事件。
  不每秒轮询，不每个 tick 重排分页。

手动更新分页 / 每日整理完成：
  重新从 StoreV6 最新 2000 根重建缓存基准。
  再重新生成分页符。
  第一页和第二页边界重新对齐。
```

这样第 1 页就是一个活动页，而第 2 页及之后是静态历史页。两者不能混成同一种加载模型。

活动实时页缓存的本地持久化建议：

```ts
type RealtimePageBuffer = {
  key: `${symbol}:${period}`
  savedAt: string
  rows: KLineData[]
  timeFrom: number | null
  timeTo: number | null
}
```

前端实现上可以使用本地状态键：

```text
fractalframe:chartRealtimePageBuffer:v1
```

该缓存属于分页规划器体系的一部分，而不是 StoreV6 的正式历史资产。StoreV6 仍然以拉取、清洗、聚合后落盘的数据为准。

当前前端实现约束：

```text
活动实时页缓存基础容量 = 2000 根。
活动实时页缓存硬上限 = 2500 根。
写入缓存时按 timestamp 去重、升序排列，只保留最新 2500 根。
手动更新分页或自动整理完成后，重新从 StoreV6 最新 2000 根建立活动页缓存。
```

因此缓存不会无限增长。2500 不是长期保存容量，而是整理边界。

#### 10.1.1 分页整理触发器

分页规划器内部需要一个低频整理触发器，用来决定什么时候重新整理 StoreV6、重新聚合、重新生成分页符。

它不是每秒轮询，也不是每个 tick 都重排分页。实时页高频变化只更新当前图表数据；分页整理必须是事件触发。

核心原则：

```text
实时更新：
  高频，只更新活动实时页缓存最后一根/追加实时缓冲尾部。
  不重排分页符。

分页整理：
  低频，事件触发。
  触发后执行完整链路：
    拉取 -> 聚合 -> audit/repair -> 重建分页规划 -> 写入完成记录。
```

触发事件：

```text
1. 用户手动点击整理/更新。
2. 每日固定维护时间，例如本地时间 06:00。
3. 后端桥服务启动时的补整理检查。
4. 拉取任务完成。
5. 聚合任务完成。
6. 未来实时缓冲累计新增 >= 500 根 K 线。
```

实时缓冲累计触发规则：

```text
第 1 页基准 = 2000 根。
活动缓存增长到 2500 根：
  触发完整整理事件。
  整理链路完成后缓存重置为最新 2000 根。
  不继续累积到 3000 / 3500。

每日整理或手动整理完成：
  StoreV6 已经吸收新增历史。
  活动缓存重新从最新 2000 根建立。
  计数重新开始。
```

默认日常链路：

```text
DailyMaintenanceTrigger
  -> 检查今日是否已整理
  -> 拉取最新 M1
  -> 更新 Clean M1
  -> 聚合 M5/M15/M30/H1/H4/D1/W1/MN
  -> audit/repair manifest
  -> 分页规划器重新读取 totalRows
  -> 活动实时页缓存重新按 StoreV6 最新 2000 根建基准
  -> 重建分页符
  -> 写 completed
  -> 通知前端刷新分页列表
```

这个触发器应该由后端桥服务管理。前端只负责显示状态、手动触发、刷新分页列表，不负责每日 06:00 定时和启动补整理。

前端“更新分页”按钮的正式链路：

```text
点击更新
  -> 拉取 StoreV6 最新 M1
  -> 按 dirty 状态聚合需要更新的高周期
  -> audit/repair
  -> 重新读取 StoreV6 status / totalRows
  -> 从 StoreV6 最新 2000 根重建活动实时页缓存
  -> 重新生成分页符
  -> 自动打开第 1 页实时页
```

该按钮不再只是“重新切分页符”。它是前端手动整理入口。拉取、聚合、audit 都由 StoreV6 job/API 执行，分页规划器只负责串联和刷新页面规划结果。

旧链路隔离要求：

```text
前端命名统一使用 StoreV6 / page planner / page loader / realtime buffer。
旧 StoreV5 后端服务文件可以作为兼容层暂时保留，但不能再作为前端主链路命名。
后续如果重命名后端文件，应先保留路由兼容，再迁移内部模块名，最后删除旧别名。
```

指标链路隔离要求：

```text
裸 K 加载底座只加载分页规划器给出的页面 K 线。
实时页不回到旧的全局 5000 根加载逻辑。
历史页不让指标反向决定分页大小。
指标以后接入加载规划器，只读取当前 PageLoadPlan 的 displayRows + 必要 warmup。
```

#### 10.1.2 每日整理 Ledger 和事件日志

为了避免关闭终端、重新打开终端后重复整理，StoreV6 必须记录每日整理状态。

判断标准不是“今天开过几次终端”，而是：

```text
今天这个 symbol 是否已经完成过每日整理。
```

建议落地文件：

```text
runtime_data/store_v6/diagnostics/daily_maintenance_ledger.json
runtime_data/store_v6/diagnostics/daily_maintenance_events.jsonl
```

Ledger 记录当前状态，用来防止重复触发：

```json
{
  "date": "2026-06-03",
  "symbol": "XAUUSDm",
  "status": "completed",
  "trigger": "manual",
  "startedAt": "2026-06-03T06:02:10+08:00",
  "finishedAt": "2026-06-03T06:08:44+08:00",
  "pullJobId": "pull-xxx",
  "aggregateJobId": "aggregate-xxx",
  "pagePlanVersion": "page-plan-xxx"
}
```

Events 记录每次触发过程，用于排查、恢复和前端显示：

```json
{"eventId":"evt-001","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"pull_started","status":"running","createdAt":"2026-06-03T06:00:00+08:00"}
{"eventId":"evt-002","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"pull_completed","status":"completed","rowsAdded":351}
{"eventId":"evt-003","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"aggregate_completed","status":"completed"}
{"eventId":"evt-004","date":"2026-06-03","symbol":"XAUUSDm","trigger":"scheduled_0600","step":"page_plan_rebuilt","status":"completed"}
```

启动后端桥服务时的判断：

```text
1. 读取 daily_maintenance_ledger.json。
2. 查今天 date + symbol 的记录。
3. 如果 status = completed：
   不触发。
4. 如果没有记录，且当前时间已经过 06:00：
   触发补整理事件链。
5. 如果 status = running：
   判断是否超时。
   超时则追加 previous_running_expired event，再决定重跑或等待人工处理。
6. 如果 status = failed：
   可以允许启动补整理，也可以要求人工手动触发，按配置决定。
```

手动整理规则：

```text
用户手动触发整理：
  直接执行完整链路。
  成功后 Ledger 写 completed。
  今日后续关闭终端再打开，不再自动触发。
```

每日 06:00 自动整理规则：

```text
到达每日整理时间：
  如果今日没有 completed：
    执行完整链路。
  如果今日已有 completed：
    不执行任务，只追加 skipped event。
```

这套机制保证：

```text
1. 终端关闭再打开不会重复整理。
2. 06:00 未运行程序时，后续启动可以补整理。
3. 手动整理过以后，当天不再自动重复整理。
4. 崩溃中的 running 任务可以被识别和恢复。
5. 分页规划器的重排是低频事件，不是 tick 轮询。
```

分页规划器输出建议：

```ts
type PagePlanItem = {
  index: number
  realtime: boolean
  rows: number
  limit: number
  fromGlobalIndex: number | null
  toGlobalIndex: number | null
  timeFrom?: number | null
  timeTo?: number | null
}
```

### 10.2 加载规划器

加载规划器是分页规划器之后、KLineCharts 之前的第二层前端规划模块。它决定“当前页面应该如何加载、如何计算、是否实时跳动”。

加载规划器不是数据仓库，也不是图表组件。它是看图模式的调度层。

核心职责：

```text
1. 接收分页规划器给出的 PagePlanItem。
2. 判断当前页是实时页还是历史页。
3. 决定 OHLCV 查询方式。
4. 决定指标计算方式。
5. 决定是否接入实时 tick / 最新 K 线更新。
6. 决定 KLineCharts 是否自动跟随最新 K 线。
7. 决定快捷翻页时预加载哪一页。
```

两套运行模式：

```text
实时页模式：
  目标：看最新行情。
  来源：活动实时页缓存。
  首次基准：StoreV6 最新 2000 根。
  查询：首次 limit=2000；运行中不因缩放/拖动补载历史。
  实时：允许接 tick、倒计时、当前 K 线更新，只更新尾部。
  指标：按当前活动页数据计算，可随实时更新重新计算或局部刷新。
  图表：可以自动跟随最新 K 线。

历史页模式：
  目标：稳定查看历史分页。
  来源：StoreV6 指定 fromGlobalIndex/toGlobalIndex 范围。
  查询：按分页符读取固定范围，默认 2500 根。
  实时：不渲染实时 K 线，不被最新行情打断。
  后台实时：活动实时页缓存继续更新。
  实时价标记：可在右侧价格轴显示后台实时页最后价和倒计时。
  指标：进入页面时按当前页数据一次性计算。
  图表：保持静态，不自动跳回最新。
```

加载规划器输入：

```ts
type LoadPlanInput = {
  symbol: string
  period: string
  page: PagePlanItem
  totalRows: number | null
  indicatorConfigs: IndicatorConfig[]
}
```

加载规划器输出：

```ts
type LoadPlan = {
  mode: 'realtime' | 'history'
  symbol: string
  period: string
  query: {
    mode: 'clean' | 'aggregated'
    limit?: number
    fromGlobalIndex?: number
    toGlobalIndex?: number
    timeFrom?: number | null
    timeTo?: number | null
  }
  chartBehavior: {
    followLatest: boolean
    acceptRealtimeTicks: boolean
    showCountdown: boolean
  }
  indicatorBehavior: {
    calculateOnLoad: boolean
    recalculateOnTick: boolean
    scope: 'page'
  }
  prefetch?: {
    nextPageIndex?: number
    nextPageTimeFrom?: number | null
    nextPageTimeTo?: number | null
  }
}
```

加载规划器边界：

```text
1. 它可以决定怎么查，但不直接操作 parquet。
2. 它可以决定是否实时，但不直接接 MT5。
3. 它可以决定指标计算范围，但不保存指标结果为历史固定资产。
4. 它可以使用分页规划器的下一页时间范围，但不重新规划分页符。
5. 它把最终 LoadPlan 交给 datafeed、指标计算器和 KLineCharts。
6. 实时页禁止使用 KLineCharts 的加载更多回调补历史，只允许尾部 tick 更新。
7. 历史页禁止被 tick 重建 K 线，但允许显示后台实时价 DOM 标记。
```

#### 10.2.1 历史页实时价标记器

历史页查看时，用户仍然需要知道当前实时价格位置，但不能让实时 tick 改写历史页 K 线。因此需要独立的实时价标记器：

```text
活动实时页缓存
  -> 读取最后一根 K 线 close / timestamp
  -> 换算到当前历史页价格轴 y 坐标
  -> 在右侧价格轴显示实时价标签
  -> 在主图区域显示横向虚线
```

标记器职责：

```text
1. 只读活动实时页缓存。
2. 不写 KLineCharts 数据。
3. 不触发页面切换。
4. 不参与历史页指标计算。
5. 根据当前价格轴缩放和滚动重新定位。
6. 显示价格、倒计时和实时价虚线。
```

显示规则：

```text
当前页 = 实时页：
  使用实时页当前 K 线倒计时标签。
  实时价标记器隐藏，避免重复。

当前页 = 历史页：
  历史 K 线保持静态。
  实时价标记器显示后台实时缓存最后价。
  右侧价格标签和横向虚线跟随价格轴移动。
```

这使得“看历史页”和“知道当前实时价格”可以同时成立。历史页不再需要接 tick，也不需要重建 K 线。

后续主图下方快捷翻页应使用加载规划器：

```text
当前页 = Page N
分页规划器已经预取 Page N+1 的时间范围
加载规划器生成下一页 LoadPlan
KLineCharts 点击快捷翻页
  -> 请求加载规划器切换到 Page N+1
  -> 图表进入对应实时/历史模式
```

最终目标是：KLineCharts 只负责渲染和交互，不自己决定实时、历史、分页、指标和数据来源。

## 11. 后续外部系统接入

vectorBT 暂时不是当前优先级。

原因是：只要全局 K 线身份、Clean Store、聚合规则和 DuckDB 查询层建立稳定，未来接 vectorBT 或其他回测/分析系统都会比较直接。外部系统只需要读取带有 `barKey/openTime/globalIndex/sessionId` 的可信 K 线表。

当前优先级：

```text
1. 全局 K 线身份
2. 交易时段规则
3. Raw/Clean 分层
4. 缺口扫描
5. Clean M1
6. 规则聚合
7. DuckDB 查询
```

## 12. 依赖

Python 数据仓库运行依赖写在项目根目录 `requirements.txt`：

```txt
pandas
pyarrow
duckdb
MetaTrader5
```

后续如果接入 vectorBT，再单独确认 Python 版本兼容性和依赖边界。

## 13. 当前迁移重点

第一阶段：建立 StoreV6 独立目录。

```text
新建 runtime_data/store_v6。
不覆盖 runtime_data/store_v5。
StoreV5 作为迁移期对照和回滚来源保留。
```

第二阶段：建立 Raw Store。

```text
MT5 拉取结果先完整落 raw parquet。
不在拉取阶段做复杂真假 M1 判断。
异常数据不物理删除，只标记 quality/rejectReason。
```

第三阶段：建立全局索引。

```text
symbol + period + openTime -> barKey
按 openTime 排序 -> globalIndex
按交易时段规则 -> sessionId
barKey 属于固定身份字段，不随交易时段规则变化。
globalIndex/sessionId/tradingDay/quality 属于可重算解释字段。
```

第四阶段：建立交易时段规则。

```text
支持开市、休市、周末、节假日、每日停盘空隙。
支持 UTC2200 等交易日分隔规则。
支持 mt5_export / inferred_from_m1 / manual_override 三类来源。
支持 ruleId/ruleVersion。
规则变更后，不改 barKey，只重算 session、gap、quality 和聚合层。
```

第五阶段：建立 Clean M1。

```text
从 Raw M1 生成可信 M1。
错误 K 线标记或隔离。
wrong_period/off_grid/before_first_valid_m1 不进入 Clean Store。
合法 session gap 保留。
真实 missing gap 进入缺口清单。
```

第六阶段：建立增量补洞。

```text
已有 barKey 不重复拉。
tail gap 和 middle gap 定向补。
缺口内每根理论 K 线都能生成 barKey。
补回同一 barKey 后更新 MissingRange 状态。
补完后重建受影响区间索引和 Clean Store。
```

第七阶段：重建聚合层。

```text
所有高周期从 Clean M1 按 TradingSessionRule 聚合。
Aggregated Store 是唯一历史高周期存量。
MT5 高周期只做实时看盘临时输入和参考对照，不做可信资产。
同一 barKey 下，Clean M1 聚合结果覆盖或接管 MT5 reference bar。
```

第八阶段：更新查询层。

```text
DuckDB 查询必须返回 barKey/openTime/globalIndex/sessionId。
图表、分页、指标都按这些字段对齐。
```

第九阶段：处理旧 StoreV5。

```text
StoreV6 查询、图表、聚合验证通过后，再归档或删除 StoreV5。
不在 StoreV6 建立前删除旧库。
```

## 14. 验收标准

1. 每根 Clean M1 都有稳定 `barKey`。
2. 每根 Clean M1 都有 `globalIndex`。
3. 每根 Clean M1 都能映射到 `sessionId` 或明确标记非交易时段。
4. 有 `barKey` 只是准入必要条件，不满足时间网格、交易时段、OHLCV 合法性时不能进入 Clean Store。
5. 任意两根相邻 K 线之间能判断连续、真实缺口、休市缺口、周末缺口、节假日缺口。
6. 系统能基于当前时间和最新 K 线判断开市、休市、数据滞后。
7. Raw Store 和 Clean Store 分离。
8. 错误 K 线可以标记或隔离，不物理删除，不污染 Clean Store。
9. 增量拉取不会重复拉已有 barKey。
10. 中间缺口可以被扫描出来并定向补。
11. H4/D1 等高周期来自 Clean M1 规则聚合，不直接采用 MT5 高周期。
12. 聚合 K 线有自己的 `barKey/globalIndex/sessionId`。
13. DuckDB 查询层返回完整索引字段。
14. 历史高周期只有一套可信 Aggregated Store，不拆成 MT5 拉取库和聚合库两套历史库。
15. MT5 高周期可以临时服务实时看盘，但必须按同一 `barKey` 与聚合序列对齐。
16. 同一 `barKey` 下如果 MT5 高周期和聚合高周期 OHLCV 不一致，历史可信数据以 Clean M1 聚合结果为准。
17. KLineCharts 历史数据只从 Clean/Aggregated 查询层取数，实时右侧可以临时拼接 MT5 reference bar。
18. 分页和指标默认不显示 rejected/suspect/off_grid 数据。
19. 数据中心诊断页可以查看 Raw、Rejected、Suspect 和 MissingRange。
20. 后续如果 MT5 补回缺失 barKey，StoreV6 可以精确填洞并更新 Clean Store。
21. StoreV6 使用独立 `runtime_data/store_v6` 目录，不覆盖旧 StoreV5。
22. StoreV6 manifest 能描述 raw、clean、aggregated、index、quality 的状态。
23. `barKey` 只由 `symbol + period + openTime` 生成，不包含 sessionId、ruleVersion、quality。
24. K 线字段分成固定身份字段和可重算扩展字段。
25. TradingSessionRule 有 `ruleId/ruleVersion`，规则变更后可以重算 session、gap、quality、completeness。
26. 规则重算不能改变已有 K 线身份，只能重建受影响区间的 Clean、Index、MissingRange 和 Aggregated Store。
27. StoreV6 未完成查询和图表切换前，不能删除 StoreV5。

## 15. 关键结论

数据中心的根本目标不是“把 MT5 拉来的数据直接变成 parquet”，而是建立一套可预判、可审计、可补洞、可聚合的 K 线时间网格。

真正稳定的底座是：

```text
品种 + 周期 + 开盘时间 + 交易时段规则
```

真实 K 线只是挂在这个时间网格上的数据。只要这套全局索引建立好，后续分页、指标、交易日分隔线、H4 聚合、历史回放、外部回测系统接入都会变简单。

`barKey` 是 Clean K 线的必要条件，不是充分条件。真正能进入正式序列的 K 线，必须同时满足身份可识别、时间网格可对齐、交易时段可解释、OHLCV 合法、前后关系可解释。

高周期历史数据也遵循同一原则：最终只保存一套由 Clean M1 聚合出来的可信序列。MT5 高周期可以先用于实时看盘，但它只要能生成同样的 `barKey`，就能被后续聚合结果精确接管；如果长得不一样，就记录差异，不污染历史存量。

## 16. StoreV6 未来可选升级方向

当前 StoreV6 拉取、身份 ID、Raw/Clean 写入、增量续拉、聚合联动、DuckDB 查询和 audit/repair 主链已经可以作为数据底座使用。后续升级不应推翻当前结构，而是在 `barKey + openTime + manifest + TradingSessionRule` 这套基础上继续增强。

### 16.1 Index Rebuild / 全局索引重算

当前 Clean M1 和 Aggregated Store 已经写入 `globalIndex`，其来源是按当前存量顺序继续编号。

未来可以增加独立任务：

```text
POST /api/market-data/v1/store-v6/index/rebuild
```

职责：

```text
1. 按 symbol + period + openTime 重新排序。
2. 重建 globalIndex。
3. 重算 sessionId / tradingDay / sessionState。
4. 不改变 barKey。
5. 不改变 OHLCV。
6. 只更新可重算扩展字段和 index manifest。
```

适用场景：

```text
交易时间规则调整。
历史数据补洞后需要重排。
人工修复 manifest 后需要统一索引。
未来需要更严格的分页、回放、交易日分隔线对齐。
```

原则：

```text
barKey 是固定身份，不重算。
globalIndex 是排序解释，可以重算。
sessionId/tradingDay 是规则解释，可以重算。
```

### 16.2 Quality / Rejected 数据集

当前 Raw 层保留原始数据，Clean 层只进入合格 K 线。未来可以把不合格数据独立沉淀为质量诊断资产：

```text
runtime_data/store_v6/quality/{symbol}/{period}/rejected_bars.parquet
runtime_data/store_v6/quality/{symbol}/{period}/suspect_bars.parquet
runtime_data/store_v6/quality/{symbol}/{period}/missing_ranges.parquet
```

字段建议：

```text
barKey
symbol
period
openTime
closeTime
source
quality
rejectReason
expectedOpenTime
actualOpenTime
gapBefore
gapAfter
sessionRuleId
sessionRuleVersion
detectedAt
resolvedAt
```

这样做以后，系统不需要物理删除异常数据：

```text
分页默认不显示 rejected/suspect。
诊断页可以查看 rejected/suspect。
如果 MT5 后续补回同一 barKey，可以把 missing/rejected 标记为 resolved。
```

### 16.3 MissingRange / 缺口资产化

当前增量拉取可以根据 Clean M1 尾部继续推进。未来可以把所有中间缺口沉淀成可查询资产：

```text
runtime_data/store_v6/quality/{symbol}/M1/missing_ranges.parquet
```

每条 MissingRange 表示一个缺口区间，而不是假造 K 线：

```text
symbol
period
fromOpenTime
toOpenTime
expectedBars
missingBarKeys
gapType
reason
sessionRuleId
sessionRuleVersion
status
detectedAt
resolvedAt
```

`gapType` 可以分为：

```text
trading_gap
session_gap
weekend_gap
holiday_gap
mt5_missing
unknown
```

原则：

```text
真实缺口不伪造 K 线。
休市缺口不当作错误。
MT5 缺失只记录，不凭空生成。
未来补回同一 barKey 后，更新 MissingRange 状态。
```

### 16.4 TradingSessionRule 重算任务

当前拉取和聚合已经读取 StoreV6 本地 session rule，并写入 `sessionRuleId/sessionRuleVersion/sessionState/isTradingTime`。

未来可以增加规则重算任务：

```text
POST /api/market-data/v1/store-v6/session-rules/rebuild
```

职责：

```text
1. 读取最新 mt5_symbol_details / trading_session_rules。
2. 对指定 symbol 或全量 symbol 提升 ruleVersion。
3. 重算 Raw/Clean/Aggregated 的 session 扩展字段。
4. 重算 MissingRange。
5. 标记受影响聚合周期 dirty。
6. 不改变 barKey。
```

适用场景：

```text
MT5 交易时间段导出更新。
人工修正黄金、指数、外汇的开停盘时间。
夏令时规则变化。
发现某个品种交易日分隔线不准。
```

### 16.5 Raw 层身份补强

当前 Raw M1 已经有 `barKey/openTime/sessionRule...`，但 `globalIndex` 可以保持为空，因为 Raw 是原始层，不是正式序列。

未来如果需要 Raw 层也支持严格定位，可以增加 Raw Index：

```text
runtime_data/store_v6/index/{symbol}/M1/raw_index.parquet
```

用途：

```text
记录所有 MT5 原始返回 bar 的出现顺序。
记录同一 barKey 多次返回的版本。
追踪某根 Raw bar 最早由哪个 pullJob 写入。
对比 Raw 与 Clean 的接管关系。
```

但 Raw Index 不应替代 Clean Index。正式图表、分页、指标仍以 Clean/Aggregated 为准。

### 16.6 MT5 高周期 Reference 对照库

当前设计中，历史高周期以 Clean M1 聚合结果为准，MT5 高周期只服务实时看盘和参考。

未来可以把 MT5 高周期作为 reference asset 保存：

```text
runtime_data/store_v6/reference/mt5/{symbol}/{period}/
```

用途：

```text
实时看盘临时拼接。
与聚合高周期做 OHLCV diff。
发现 MT5 高周期因 UTC0/H4 锚点造成的错误聚合。
记录某个 barKey 下 MT5 reference 与 StoreV6 aggregated 的差异。
```

规则：

```text
同一 barKey 下，如果 reference 与 aggregated 不一致，历史可信数据以 aggregated 为准。
reference 不进入正式历史存量。
reference 可以帮助前端实时显示，但不能污染 Clean/Aggregated。
```

### 16.7 Audit / Repair 深化

当前 audit/repair 主要核对 manifest 和 parquet：

```text
rowsCount
partsCount
firstOpenTime
lastOpenTime
aggregated 是否落后 Clean M1 bucket
```

未来可以扩展为深度审计：

```text
1. barKey 唯一性扫描。
2. openTime 单调性扫描。
3. globalIndex 连续性扫描。
4. sessionRuleVersion 一致性扫描。
5. Clean 与 Raw 的来源关系扫描。
6. Aggregated 与 Clean M1 sourceFrom/sourceTo 对齐扫描。
7. MissingRange 与真实缺口对齐扫描。
```

深度 repair 的原则：

```text
只修 manifest 和可重算字段。
不伪造 OHLCV。
不直接覆盖 Clean M1 的历史价格。
需要重算价格时交给 pull / aggregate / index rebuild 专门任务。
```

### 16.8 前端诊断页增强

当前前端以“拉取、聚合、状态列表”为主。未来可以增加 StoreV6 诊断视图：

```text
Raw rows
Clean rows
Aggregated rows
Rejected rows
Suspect rows
Missing ranges
Manifest issues
Session rule version
Last audit time
Last repair time
```

用户操作建议：

```text
Audit
Repair Manifest
Rebuild Index
Recompute Session Rule
Rebuild Aggregates
Open Rejected Rows
Open Missing Ranges
```

这些按钮应当是诊断和维护入口，不应放进日常主流程。日常主流程仍然保持：

```text
Scan MT5 -> 拉取 -> 聚合 -> 查询/图表
```

### 16.9 外部系统接入

只要 StoreV6 的身份字段稳定，未来接入 vectorBT 或其它回测系统时，不需要重新设计数据结构。

推荐对外输出：

```text
symbol
period
barKey
openTime
closeTime
globalIndex
sessionId
tradingDay
open
high
low
close
volume
quality
```

对外系统只能读取 Clean/Aggregated，不直接读取 Raw。

### 16.10 升级优先级建议

推荐顺序：

```text
1. Quality / Rejected 数据集
2. MissingRange 资产化
3. Index Rebuild
4. TradingSessionRule 重算任务
5. Deep Audit / Repair
6. MT5 高周期 Reference 对照库
7. 前端诊断页
8. 外部回测系统接入
```

原因：

```text
Quality 和 MissingRange 最直接提升可审计性。
Index Rebuild 和 Session Rule Recompute 提升规则可维护性。
Deep Audit 保证长期数据可靠。
Reference 和外部系统接入属于稳定后扩展。
```

### 16.11 同端口周期切换实时缓存

当前前台实时页不是单一页面缓存，而应当按交易品种和周期拆成多个实时运行域。这个模块属于数据中心的前台运行缓存层，不属于 StoreV6 正式历史仓库。

核心规则：
```text
runtimeKey = symbol + period
```

示例：
```text
XAUUSD:M5
XAUUSD:M30
EURUSD:M5
```

同一个端口内切换周期时，不应该把不同周期混成一套实时页。比如 5185 当前先看 XAUUSD M5，再切到 XAUUSD M30：
```text
XAUUSD:M5  保留自己的实时缓存、最后一根K线、指标状态、视图状态。
XAUUSD:M30 建立或读取自己的实时缓存。
两个周期互不覆盖。
```

缓存内容建议：
```text
rows：实时页 2000-2500 根 K 线
lastBarKey：缓存最后一根 K 线身份
lastTimestamp：缓存最后一根 K 线时间
indicatorState：实时页已加载指标和参数
viewportState：缩放、Y轴、可视范围
updatedAt：缓存更新时间
```

周期切换流程：
```text
1. 当前 M5 实时页运行到 2018 根。
2. 用户切到 M30。
3. M5 缓存停留在 XAUUSD:M5，不继续渲染，但缓存不丢。
4. 系统读取或建立 XAUUSD:M30 缓存。
5. M30 页面按自己的 StoreV6 最新数据和 tick 开始运行。
6. 用户切回 M5。
7. 系统读取 XAUUSD:M5 缓存。
8. 用 lastBarKey / lastTimestamp 查询 StoreV6 中该时间之后新增的 M5 K 线。
9. 合并补齐 M5 缓存。
10. 用补齐后的 M5 缓存恢复实时页。
```

这和历史页切换不同：
```text
历史页：静态 page，切过去就是固定区间，不接实时 tick。
周期切换：切换实时运行域，要恢复该周期自己的活动缓存，并补齐离线期间缺口。
```

补齐原则：
```text
优先从 StoreV6 读取 lastTimestamp 之后的新 K 线。
如果 StoreV6 还没更新到最新，则交给拉取/聚合链路补齐。
补齐后仍然保持最大 2500 根上限。
达到 2500 根后触发分页整理，实时页重置为最新 2000 根。
```

端口扩展规划：
```text
当前阶段：runtimeKey = symbol + period
多端口阶段：runtimeKey = port + symbol + period
```

例如后续同时开 5185 和 5186：
```text
5185:XAUUSD:M5
5185:XAUUSD:M30
5186:XAUUSD:M30
```

多端口阶段的原则是：StoreV6 仍然是统一数据底座，但每个端口的前台实时运行缓存可以独立，避免两个窗口的缩放、指标、实时页状态互相覆盖。

### 16.12 实时页状态文件

活动实时页缓存不能只被理解成“前端临时缓存”。它还承担一个关键职责：记录前台实时页和 StoreV6 仓库整理链之间的运行状态。

因此需要把实时页缓存拆成两类信息：

```text
1. 实时页数据缓存
   保存当前 symbol+period 实时页的 K 线数组。
   行数从 StoreV6 最新 2000 根开始，随 tick 增长，最多保留 2500 根。
   它服务前台渲染，不是正式历史资产。

2. 实时页状态记录
   保存当前实时页是否需要整理、上次整理何时完成、是否有失败需要补偿。
   它服务自动触发、恢复补偿、状态展示和诊断。
```

当前阶段可以先使用浏览器本地持久化：

```text
fractalframe:chartRealtimePageBuffer:v1
  保存 symbol+period 对应的实时页 K 线数组。

fractalframe:chartRealtimePageSnapshot:v1
  保存当前活动实时页摘要。

fractalframe:chartRealtimePageIndexCache:v1
  保存分页规划结果。

fractalframe:chartRealtimePageLastResetCache:v1
  保存最近一次手动或自动整理信息。
```

但从架构上，它应当被抽象成独立模块：

```text
RealtimePageStateManager
```

职责：

```text
1. 维护 runtimeKey = symbol + period 的实时页状态。
2. 记录 rows / timeFrom / timeTo / lastBarTime。
3. 记录实时页是否达到 2500 整理边界。
4. 记录上次手动整理、自动整理、6 点维护后的重建时间。
5. 记录整理链路是否正在运行，避免重复触发。
6. 记录整理失败原因，供恢复后补偿。
7. 记录缓存对应的 StoreV6 仓库尾部时间，便于判断是否需要补齐。
```

建议状态结构：

```ts
type RealtimePageState = {
  runtimeKey: string
  symbol: string
  period: string

  rows: number
  pageSize: 2000
  rolloverThresholdRows: 2500

  timeFrom: number | null
  timeTo: number | null
  lastBarTime: number | null
  lastBarKey: string | null

  storeLastTime: number | null
  storeRowsCount: number | null

  needsRollover: boolean
  rolloverStatus: 'idle' | 'requested' | 'running' | 'completed' | 'failed'
  rolloverReason: 'manual' | 'realtime_2500' | 'daily_0600' | 'resume_compensation' | null

  lastRolloverRequestedAt: string | null
  lastRolloverStartedAt: string | null
  lastRolloverCompletedAt: string | null
  lastRolloverError: string | null

  lastManualResetAt: string | null
  lastDailyMaintenanceAt: string | null
  updatedAt: string
}
```

运行规则：

```text
1. 图表打开实时页：
   从 StoreV6 最新 2000 根建立实时页数据缓存。
   写入 RealtimePageState。

2. tick 到来：
   更新实时页数据缓存。
   更新 rows / timeTo / lastBarTime。
   如果 rows >= 2500，设置 needsRollover = true。

3. 2500 自动整理触发：
   不直接写 StoreV6。
   只请求既有主链：
     pull Clean M1 -> aggregate -> audit/repair -> rebuild realtime page

4. 手动更新：
   走同一条主链。
   完成后覆盖 RealtimePageState 中的 lastManualResetAt / lastRolloverCompletedAt。
   实时页重置为 StoreV6 最新 2000 根。

5. 每日 6 点维护：
   后端执行 pull -> aggregate -> audit。
   前端下一次读取状态时，应把 daily maintenance 的完成时间同步到 RealtimePageState。
   如果当前实时页还在运行，则按 StoreV6 最新 2000 根重建或补齐缓存。

6. 页面刷新或浏览器恢复：
   读取 RealtimePageState。
   如果 needsRollover = true 或 rolloverStatus = failed/requested 且未完成，
   则触发 resume_compensation，继续走同一条主链补偿。
```

补偿原则：

```text
补偿只补触发状态，不发明第二套落盘规则。
所有落盘仍然只通过：
  Clean M1 增量拉取
  Clean M1 -> Aggregated 聚合
  audit/repair
  StoreV6 查询层重建实时页
```

后端文件化建议：

```text
runtime_data/store_v6/diagnostics/realtime_page_state.json
```

如果只依赖前端 localStorage，页面关闭、事件丢失、浏览器休眠时无法稳定补偿。后续可以由前端继续保存实时页数据缓存，但把关键状态同步到后端 diagnostics 文件：

```text
前端 localStorage：
  保存实时页 K 线数组，服务快速恢复渲染。

后端 diagnostics/realtime_page_state.json：
  保存整理状态、触发状态、失败状态和补偿判断。
```

边界：

```text
RealtimePageState 不是 StoreV6 历史资产。
它不参与 Clean/Aggregated 查询结果。
它不能覆盖 parquet 中的 OHLCV。
它只能触发或记录主链运行状态。
```
