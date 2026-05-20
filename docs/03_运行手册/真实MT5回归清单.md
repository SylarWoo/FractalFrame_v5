# 真实 MT5 / StoreV5 回归清单

适用场景：改动 MT5 bridge、StoreV5、图表加载、右侧数据中心抽屉后，在真实终端上做最终确认。

## 环境前置

1. MT5 终端已启动并登录。
2. 目标品种在 Market Watch 中可见，默认使用 `XAUUSDm`。
3. Python 虚拟环境可用：`.venv\Scripts\python.exe`。
4. 前端依赖已安装：`frontend\node_modules` 存在。

## 基础检查

```powershell
.\scripts\check_all.ps1
.\scripts\check_live_mt5_store_v5.ps1 -Symbol XAUUSDm
```

预期：

- `check_all.ps1` 全部通过。
- live 检查能启动或连接 bridge。
- `/mt5/symbols` 和 `/store-v5/status` 返回成功。

## 真实小批量拉取

```powershell
.\scripts\check_live_mt5_store_v5.ps1 -Symbol XAUUSDm -RunPull -PullCount 2000
```

预期：

- MT5 初始化成功。
- 小批量 M1 拉取成功。
- StoreV5 M1 查询返回最近 10 根。
- M5/H1 聚合成功。

## 前端人工确认

1. 启动后端：

   ```powershell
   .\.venv\Scripts\python.exe scripts\mt5_symbols_server.py --host 127.0.0.1 --port 8765
   ```

2. 启动前端：

   ```powershell
   cd frontend
   npm run dev -- --host 127.0.0.1 --port 5185
   ```

3. 打开 `http://127.0.0.1:5185/`。
4. 进入 MT5 Import Center。
5. 选择 `XAUUSDm`。
6. 点击刷新状态、检查 M1、拉取 StoreV5、聚合周期。

预期：

- 进度文案持续更新，无控制台 error。
- 拉取/聚合完成后 StoreV5 状态刷新。
- 图表能打开 M1 和 H1 数据。
- 断开/关闭后端时，前端显示可理解的错误，不出现白屏。

## 回归记录

建议记录：

- 日期和提交点。
- MT5 账号环境。
- 品种。
- 拉取数量。
- StoreV5 根目录。
- 是否通过。
