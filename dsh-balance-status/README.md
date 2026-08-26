# dsh-balance-status

DeepSeek 账户余额状态组件 — a native profile plugin for
**DeepSeek Harness Web (dsh web)**. It registers into the sidebar foot as a
status widget that looks and behaves like a built-in feature: no card
background, no border, no shadow, no new visual layer.

## Features

```
DeepSeek 账户余额                      ¥46.93
[██████░░░░]  ← remaining-balance bar
今日 Token 消耗                     274.5K
[████████░░]  ← consumed daily-quota bar
```

- **Sidebar widget**（设置按钮正上方）: two status rows with energy bars —
  the balance row shows the **remaining** amount against
  `BALANCE_DISPLAY_TARGET` (¥100 reference, green), the token row shows
  **today's consumed** tokens against `DAILY_TOKEN_TARGET` (500K/day
  reference, brand accent). Both constants live at the top of `lib/index.js`.
  Collapsed rail mode shows two mini bars instead of icons.
- **Hover tooltip**（原生轻量）: 账户余额 / 今日消耗 / 输入 Token / 输出
  Token / 余额剩余与今日配额百分比 / 最后同步.
- **Details dialog**（原生 primitives Modal）: 账户余额（总额/赠送/充值）、
  今日/本周/本月 Token 使用与调用次数、本月按模型拆分用量、API 调用次数、
  手动刷新、加载/错误状态；弹窗为**主题成对的磨砂玻璃面板**（白色外观
  白玻璃+深色高反差字，深色外观纯玻璃+近白字）。
- **数据来源**: 余额走 DeepSeek `user/balance` API，复用 Models 页管理的
  凭证（`llm-deepseek.apiKeyEnv`，默认 `DEEPSEEK_API_KEY`；`baseURL` 跟随
  `llm-deepseek` 设置或 `DEEPSEEK_BASE_URL`，3 次重试 + 15s 超时）。
  Token 消耗从 `$DSH_HOME/sessions` 的 zstd JSONL 会话日志聚合（按本地天
  分桶，只重读变更的日志；今日/本周/本月一次扫描应答）。
- **刷新策略**: 宿主 60s 快照缓存 + 余额 60s 自动重取；组件挂载与每 60s
  轮询、弹窗打开即再同步、支持手动强制刷新（`?force=1`）。

## Layout

```
dsh-balance-status/
  package.json        profile bundle + dsh.client declaration
  cordis.patch.yml    inserts the composition row (id: balance-status)
  lib/index.js        host half (plain ESM, no build): /balance-status/status
  lib/client.js       browser half (built from src/, __ModuleLoader__ format)
  src/client.tsx      the widget/dialog component source
  src/styles.ts       class map + plugin CSS text (themed glass included)
  scripts/build-client.mjs   esbuild wrapper (writes lib/client.js)
  scripts/validate-host.mjs  offline harness for the host half
  scripts/smoke-client.mjs   materialization smoke test for the client bundle
```

## Install / rebuild

```powershell
# one-time profile install (reconciles dsh.profile.bundles)
dsh plugin --profile web add <本仓库路径>

# after editing src/*: rebuild lib/client.js, then refresh the installed copy
node scripts/build-client.mjs
dsh plugin --profile web add <本仓库路径>   # 或 pnpm install --force
```

Profile/bundle-set changes are resolved at server start, so a profile change
requires restarting `dsh web` (restart the Harness app). Client-bundle content
changes only need a page refresh (served with `no-cache`).

## Endpoint

`GET http://127.0.0.1:3080/balance-status/status` → JSON:

```json
{
  "ok": true,
  "syncedAt": 1787668701995,
  "balance": { "available": true, "currency": "CNY", "total": 46.93,
               "granted": 0, "toppedUp": 46.93 },
  "balanceError": null,
  "targets": { "balance": 100, "dailyTokens": 500000 },
  "usage": {
    "today": { "input": 179159, "output": 95344, "calls": 136, "models": { } },
    "week":  { ... },
    "month": { ... },
    "all":   { ... }
  },
  "errors": []
}
```

## Notes

- The one shell-CSS overlay (`footerActions` flex direction) stacks sidebar
  foot actions vertically so a full-width status block can precede accent
  actions (the Cordis badge) while staying directly above the Settings row;
  it is tied to the client-sidebar module hash of its build.
- Model usage windows anchor on the host's local timezone (the GUI runs on
  the same machine).
- 深色/浅色主题均已适配（详见 `src/styles.ts` 的 theme-paired 规则）。

## License

[MIT](LICENSE)
