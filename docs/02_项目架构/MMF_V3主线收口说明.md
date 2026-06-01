# MMF_V3 主线收口说明

## 当前定位

MMF_V3 是 FractalFrame_v5 当前唯一主线 MMF 指标。

MMF v1 和 MMF_V2 不再作为日常实盘入口继续扩展。代码和接口暂时保留为兼容层，用于历史模板、旧测试和对照排查；新功能、稳定性优化、诊断信息和实盘策略联动只进入 MMF_V3。

## 收口原则

1. 前端指标抽屉只暴露 `MMF_V3`。
2. 旧本地持久化中的 `MMF` / `MMF_V2` 加载状态迁移到 `MMF_V3`。
3. 后端 `/api/indicators/v1/mmf/*` 和 `/api/indicators/v2/mmf/*` 暂不删除，避免旧模板或脚本直接失效。
4. MMF_V3 输出契约保持稳定：`markers`、`signals`、`signalFrame`、`signalCatalog`、`metadata`。
5. 后续优化优先做稳定性、缓存、诊断和实盘运行体验，不再围绕 V2 支撑/阻力逻辑继续投入。

## 后续优先级

1. 建立 MMF_V3 固定行情样本回归，验证同一数据同一参数下信号稳定。
2. 强化 MMF_V3 metadata：engine、settingsHash、cacheHit、featureCacheHit、rowsCount、markersCount、耗时。
3. 把 V2/V3 重复代码中真正通用的部分抽到 shared，V3 策略逻辑保留在 V3。
4. 前端补轻量诊断视图，显示当前图表使用的 MMF_V3 engine 和 settingsHash。
