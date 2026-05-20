# Live MT5 / StoreV5 Regression Checklist

Use this after changes to the MT5 bridge, StoreV5, chart loading, or MT5 import center.

## Prerequisites

1. MT5 terminal is running and logged in.
2. The target symbol is visible in Market Watch. Default: `XAUUSDm`.
3. Python virtualenv exists: `.venv\Scripts\python.exe`.
4. Frontend dependencies are installed: `frontend\node_modules`.

## Baseline Checks

```powershell
.\scripts\check_all.ps1
.\scripts\check_live_mt5_store_v5.ps1 -Symbol XAUUSDm
.\.venv\Scripts\python.exe scripts\audit_store_v5.py --symbol XAUUSDm
.\.venv\Scripts\python.exe scripts\verify_store_v5_aggregates.py --symbol XAUUSDm --timeframes M5,H1,H4
.\.venv\Scripts\python.exe scripts\store_v5_size_report.py --symbol XAUUSDm
```

Expected:

- `check_all.ps1` passes.
- Live check can start or connect to the bridge.
- `/mt5/symbols` and `/store-v5/status` return successfully.
- StoreV5 audit reports no structural issues.
- Aggregate verification reports matching OHLCV rows for sampled windows.

## Small Live Pull

```powershell
.\scripts\check_live_mt5_store_v5.ps1 -Symbol XAUUSDm -RunPull -PullCount 2000
```

Expected:

- MT5 initializes successfully.
- Small M1 pull succeeds.
- StoreV5 M1 query returns recent rows.
- M5/H1 aggregation succeeds.

## Manual Frontend Check

1. Start backend:

   ```powershell
   .\.venv\Scripts\python.exe scripts\mt5_symbols_server.py --host 127.0.0.1 --port 8765
   ```

2. Start frontend:

   ```powershell
   cd frontend
   npm run dev -- --host 127.0.0.1 --port 5185
   ```

3. Open `http://127.0.0.1:5185/`.
4. Open MT5 Import Center.
5. Select `XAUUSDm`.
6. Run status refresh, M1 check, StoreV5 pull, and aggregation.

Expected:

- Progress text updates continuously.
- Browser console has no errors.
- StoreV5 status refreshes after pull/aggregate.
- M1 and H1 charts can open.
- If backend is stopped, the frontend shows a recoverable error rather than a blank page.
