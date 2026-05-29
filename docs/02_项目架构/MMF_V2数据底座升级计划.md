# MMF_V2 数据底座升级计划

## 目标

MMF_V2 后续要同时服务前端画图、Python 指标计算、回测、实盘信号。因此底座必须先统一一套稳定坐标，避免前端 K 线、后端 DataFrame、回测矩阵各自用数组下标导致错位。

核心目标：

- 前端、后端、回测、实盘使用同一根 K 线标识。
- 指标信号不再依赖裸 `index` 作为主坐标。
- 每个信号同时给出“形态点”和“交易点”的完整坐标。
- 任意一个图上点都能追溯到交叉、确认、取高低价窗口、交易 K 线。

## 统一 K 线坐标

每根 K 线必须有稳定 `barKey`：

```text
{symbol}|{timeframe}|{open_time_seconds}
```

字段约定：

- `symbol`：交易品种，例如 `XAUUSD`
- `timeframe`：周期，例如 `M5`
- `time`：K 线开盘时间，Unix seconds
- `barKey`：稳定主键，前后端、回测、实盘共同使用
- `sourceIndex`：输入顺序下标，只用于调试
- `calcIndex`：后端清洗排序后的计算下标，只用于调试

对齐优先级：

1. `barKey`
2. `time`
3. `index`，只作为兼容回退

## 统一信号结构

每个 MMF_V2 信号必须返回：

```text
type
symbol
timeframe

eventBarKey / eventTime / eventIndex
confirmBarKey / confirmTime / confirmIndex
markerBarKey / markerTime / markerIndex / markerPrice
entryBarKey / entryTime / entryIndex / entryPrice

windowStartBarKey / windowStartTime / windowStartIndex
windowEndBarKey / windowEndTime / windowEndIndex

pointDistance
reason
```

语义：

- `event*`：随机指数真实交叉发生的 K 线。
- `confirm*`：%K 前进达到阈值的 K 线，也就是 Sell/Buy 的交易 K 线。
- `marker*`：在起始点到结束点窗口内找到的最高/最低价 K 线。
- `entry*`：交易参考 K 线，目前等于 `confirm*`。
- `pointDistance`：`abs(entryPrice - markerPrice)`。

## 前端职责

前端发送给后端的每根 K 线必须带：

```text
barKey
time
open/high/low/close/volume
```

前端接收信号后：

- 高/低点按 `markerBarKey` 定位。
- Sell/Buy 按 `entryBarKey` 定位。
- 找不到 `barKey` 时按 `time` 回退。
- 仍找不到时不画，并记录 debug。
- 画图价格可以和计算价格分离：
  - Sell 计算用 `entryPrice`，绘制可用 entry K 线 high 上方偏移。
  - Buy 计算用 `entryPrice`，绘制可用 entry K 线 low 下方偏移。

## 后端职责

后端接收 rows 后：

- 保留前端传入的 `barKey` 和 `sourceIndex`。
- 清洗排序后生成 `calcIndex`。
- 不允许信号只返回 `index`。
- 所有窗口、事件、确认、交易、标记点都返回 `barKey + time + index`。

## 回测与实盘准备

回测不应重新猜信号位置，而是直接消费统一信号结构：

- `entryBarKey`
- `entryTime`
- `entryPrice`
- `markerBarKey`
- `pointDistance`
- `reason`

vectorBT 接入时，可以把 `entryTime` 对齐到 price series index；如果输入 price series 也带 `barKey`，则优先用 `barKey` 构建布尔入场矩阵。

实盘接入时，信号落库使用：

```text
signalId = indicator + type + symbol + timeframe + entryBarKey + markerBarKey
```

这样同一根 K 线不会重复触发。

## 分阶段实施

### 阶段 1：MMF_V2 先升级

- 前端请求 rows 添加 `barKey`。
- Python normalize 后保留 `barKey/sourceIndex/calcIndex`。
- MMF_V2 marker payload 添加完整坐标字段。
- 前端绘图按 `barKey -> time -> index` 定位。

### 阶段 2：抽出通用数据模块

- Python 新增通用 `bar_model` 或 `market_data` 模块。
- 前端新增统一 `buildBarKey` 工具。
- 所有指标 API 请求使用相同 row schema。

### 阶段 3：信号调试面板

- 图上点位可查看 event/confirm/marker/entry/window。
- 显示 `barKey`、时间、价格、距离、reason。

### 阶段 4：回测适配

- 输出统一 signal DataFrame。
- vectorBT 读取统一 entry/exit 坐标。
- 回测报告和前端图上点位使用同一批 signal records。

## 当前结论

不要继续在裸 index 上叠功能。MMF_V2 从现在开始必须使用 `barKey` 作为主坐标，为后续回测和实盘打基础。
