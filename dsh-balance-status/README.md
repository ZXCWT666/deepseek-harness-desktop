# dsh-balance-status

DeepSeek 账户余额状态组件 — a feature-grade sidebar widget for DeepSeek
Harness Web (dsh web), wired as a native profile plugin so it behaves like a
built-in component rather than an插件卡片.

## What it does

Sits in the left sidebar foot, directly above the Settings trigger, styled as
a system-status line: sidebar fill colors, no card background, no border, no
shadow, no new visual layer.

```
DeepSeek 账户余额                      ¥46.93
[██████░░░░]  ← remaining balance bar
今日 Token 消耗                     274.5K
[████████░░]  ← consumed daily quota bar
```

Both rows carry an energy bar: the balance bar shades the remaining amount
against `BALANCE_DISPLAY_TARGET` (¥100 reference), and the token bar shades
today's consumed tokens against `DAILY_TOKEN_TARGET` (500K/day reference) —
both constants live at the top of `lib/index.js` (today: 剩余量绿色条,
消耗条用主题品牌色).

- **Hover** shows the lightweight native tooltip: balance, today's consumed
  tokens, input/output split, and last-sync age.
- **Click** opens the native details modal: balance (total/granted/topped-up),
  today/week/month token usage, per-model usage and API call counts for the
  month, a manual Refresh button, and error/loading states.
- **Data**: balance comes from the DeepSeek balance API using the same
  credential the Models page manages (`llm-deepseek.apiKeyEnv`, default
  `DEEPSEEK_API_KEY`, per-request resolution through the credentials service;
  `baseURL` follows the `llm-deepseek` settings section). Token usage is
  aggregated from the durable session logs under `$DSH_HOME/sessions` (zstd
  JSONL artifacts, local-day buckets; only changed logs are re-read).
- **Refresh policy**: host caches the snapshot for 60 s and auto-re-fetches;
  the widget polls on mount and every 60 s, re-syncs when the dialog opens,
  and supports a manual forced refresh (`?force=1`).

## Layout

```
dsh-balance-status/
  package.json        profile bundle + dsh.client declaration
  cordis.patch.yml    inserts the composition row (id: balance-status)
  lib/index.js        host half (plain ESM, no build): /balance-status/status
  lib/client.js       browser half (built from src/, __ModuleLoader__ format)
  src/client.tsx      the widget/dialog component source
  src/styles.ts       class map + plugin CSS text
  scripts/build-client.mjs   esbuild wrapper (writes lib/client.js)
  scripts/validate-host.mjs  offline harness for the host half
  scripts/smoke-client.mjs   materialization smoke test for the client bundle
```

## Install / rebuild

```powershell
# one-time profile install (reconciles dsh.profile.bundles)
dsh plugin --profile web add file:D:\dsh\dsh-balance-status

# after editing src/*: rebuild lib/client.js, then re-add to refresh the copy
node scripts/build-client.mjs
dsh plugin --profile web add file:D:\dsh\dsh-balance-status
```

Composition and client-bundle discovery both resolve at server start, so a
profile change requires restarting `dsh web` (restart the Harness app).

## Endpoint

`GET http://127.0.0.1:3080/balance-status/status` → JSON:

```json
{
  "ok": true,
  "syncedAt": 1787668701995,
  "balance": { "available": true, "currency": "CNY", "total": 46.93,
               "granted": 0, "toppedUp": 46.93 },
  "balanceError": null,
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
  it is tied to the client-sidebar module hash of this build.
- Model usage windows anchor on the host's local timezone (the GUI runs on
  the same machine).
