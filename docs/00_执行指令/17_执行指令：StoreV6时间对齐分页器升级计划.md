# 执行指令：StoreV6 时间对齐分页器升级计划

## 0. 目标

本阶段在当前 StoreV6 页面窗口架构基础上，新增一套独立的 **时间对齐分页器**。

当前 rows-based 分页器继续保留，作为备用分页器：

```text
实时页：2,000 rows
历史页：2,500 rows
```

新时间分页器第一阶段只接入 `M5`。`M1 / M15 / M30 / H1 / H4 / D1` 暂时全部继续走旧分页器。

核心目标：

```text
M5：每页 7 天窗口。
翻页步进：上一个有效交易日边界。
交易日边界：北京时间 06:00。
分页表只生成 timeFrom / timeTo，不提前查询每页 K 线。
点击某页时，再按 timeFrom / timeTo 查询该页 K 线。
```

---

## 1. 为什么要升级

旧分页器按 rows 切页。问题是：为了显示每页时间范围，需要知道该页第一根和最后一根 K 线；为了知道这些，又要查询该页 K 线。这样如果一次性查询所有页会很慢，只懒加载当前页和下一页又会导致分页表时间范围不完整。

新分页器改成先算时间边界：

```text
分页规划阶段：只用公式计算 timeFrom / timeTo。
页面加载阶段：用户点击哪页，才查询哪页 K 线。
```

这样分页列表可以很快生成，不需要提前扫描所有历史页。

---

## 2. 架构关系

新增模块建议：

```text
frontend/src/workbench/chart/pagePartition/rowsBasedPagePartitionBuilder.ts
frontend/src/workbench/chart/pagePartition/calendarPageProfiles.ts
frontend/src/workbench/chart/pagePartition/tradingDayBoundary.ts
frontend/src/workbench/chart/pagePartition/m5CalendarPageAligner.ts
```

主入口仍然保留：

```text
frontend/src/workbench/chart/pagePartition/pagePartitionBuilder.ts
```

主入口职责：

```text
period === M5 且 latestTime 有效：使用 m5CalendarPageAligner。
其它周期：使用 rowsBasedPagePartitionBuilder。
M5 时间分页失败：fallback 到 rowsBasedPagePartitionBuilder。
```

---

## 3. M5 时间分页规则

M5 第一阶段规则：

```text
windowDays = 7
stepMode = previousTradingDay
boundaryHour = 6
timezone = Asia/Shanghai
skipWeekends = true
```

含义：

```text
每页都是 7 天窗口。
每翻一页，页面尾部移动到上一个有效交易日边界。
周六、周日不作为历史页尾部边界。
```

示例：如果当前最新 K 所属交易日边界是周五 06:00：

```text
第 1 页：上周五 06:00 -> 当前最新 K
第 2 页：上周四 06:00 -> 本周四 06:00
第 3 页：上周三 06:00 -> 本周三 06:00
第 4 页：上周二 06:00 -> 本周二 06:00
第 5 页：上周一 06:00 -> 本周一 06:00
```

示例：如果当前最新 K 所属交易日边界是周一 06:00：

```text
第 1 页：上周一 06:00 -> 当前最新 K
第 2 页：上上周五 06:00 -> 上周五 06:00
第 3 页：上上周四 06:00 -> 上周四 06:00
第 4 页：上上周三 06:00 -> 上周三 06:00
```

---

## 4. PagePlanItem 变化

M5 时间分页器输出的页面可以先没有 globalIndex 和 rows。

建议结构：

```text
index: number
realtime: boolean
pageType: live | history
timeFrom: number
timeTo: number
fromGlobalIndex: null
toGlobalIndex: null
rows: null
limit: number
```

原因：

```text
时间分页器只负责生成时间范围。
真实 rows / fromGlobalIndex / toGlobalIndex 在用户打开页面后，由 PageDataProvider 按 timeFrom / timeTo 查询得到。
```

分页 UI 必须支持：

```text
有 timeFrom/timeTo，但 rows/globalIndex 为空。
```

显示时优先展示时间范围，rows 可以显示为 `-` 或 `点击加载`。

---

## 5. 与 PageDataProvider 对接

M5 时间页点击后，不再要求 fromGlobalIndex / toGlobalIndex。

传给 PageDataProvider：

```text
symbol
period = M5
pageIndex
timeFrom
timeTo
mode = realtime 或 history
```

PageDataProvider 负责：

```text
按 timeFrom / timeTo 查询 StoreV6。
得到 displayRows。
构建 PageDataSlice。
交给 ChartPageWindow。
由 ChartAdapter 写入 KLineCharts。
```

时间分页器禁止直接查询 K 线，禁止直接操作 PageWindow，禁止直接操作 KLineCharts。

---

## 6. 与实时页窗口的关系

M5 时间分页器只决定第 1 页实时页初始范围。

实时 tick 仍然由 RealtimePageWindow / RealtimePageBuffer 管理。

规则：

```text
普通 tick：不重建分页表。
当前 bar 更新：只更新实时页窗口尾部。
新 bar 出现：只追加到实时页窗口。
每日 06:00 维护完成后：重新生成 M5 时间分页表。
```

---

## 7. 触发时机

M5 时间分页表在以下情况重算：

```text
切换到 M5。
点击历史分页更新。
StoreV6 拉取 / 聚合完成。
每日 06:00 维护完成。
symbol 切换且当前周期为 M5。
```

不在以下情况重算：

```text
普通 tick。
鼠标滚动。
图表缩放。
十字线移动。
当前 M5 bar 内价格跳动。
```

---

## 8. 旧分页器保留

旧 rows-based 分页器保留为备用分页器。

第一阶段：

```text
M5：走时间对齐分页器。
M1：继续 rows-based。
M15：继续 rows-based。
M30：继续 rows-based。
H1/H4/D1：继续 rows-based。
```

未来可逐步接入：

```text
M1：1 天一页。
M15：15 天一页。
M30：30 天一页。
```

但本阶段不启用这些周期。

---

## 9. 验收标准

### M5 分页表

```text
1. M5 切换后生成时间分页。
2. 每页都有 timeFrom / timeTo。
3. 每页窗口长度为 7 天。
4. 第 1 页为 realtime。
5. 第 2 页以后为 history。
6. 第 2 页尾部为上一个有效交易日边界。
7. 周一上一页跳到上周五，不生成周日尾部页。
8. 不为了显示分页表提前查询每页 K 线。
9. rows / globalIndex 允许为空。
10. 点击页面后再查询实际 K 线。
```

### 旧分页器

```text
1. M1 仍使用 2000 / 2500 rows 分页。
2. M15 仍使用 2000 / 2500 rows 分页。
3. M30 仍使用 2000 / 2500 rows 分页。
4. H1/H4/D1 不受影响。
5. M5 时间分页失败时自动 fallback rows-based。
```

### 图表加载

```text
1. M5 第 1 页可加载 7 天实时窗口。
2. M5 第 2 页可加载上一个有效交易日尾部的 7 天窗口。
3. KLineCharts 只收到 displayRows。
4. PageWindow / ChartAdapter 链路不被破坏。
5. 实时 tick 不触发重新分页。
6. 每日维护后重新生成 M5 分页表。
```

---

## 10. 核心结论

本阶段不是把所有周期都改成时间分页，而是只把 M5 从 rows-based 分页升级为交易日滑动周窗口分页。

最终结构：

```text
pagePartitionBuilder.ts
  -> M5: m5CalendarPageAligner
  -> others: rowsBasedPagePartitionBuilder
```

M5 规则：

```text
每页长度 = 7 天
翻页步进 = 上一个有效交易日边界
交易日边界 = Asia/Shanghai 06:00
分页表只算 timeFrom / timeTo
点击页面后才查 K 线
```

这样 M5 页面拥有清晰的时间身份，同时避免为了显示分页表而提前查询大量 K 线。
