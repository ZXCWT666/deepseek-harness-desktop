window.__ModuleLoader__.load({
	id: "dsh-balance-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// dsh-balance-status/src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// dsh-balance-status/src/styles.ts
var styles = {
  root: "dbs-root",
  rail: "dbs-rail",
  row: "dbs-row",
  label: "dbs-label",
  value: "dbs-value",
  bar: "dbs-bar",
  barFill: "dbs-barFill",
  barFillBalance: "dbs-barFillBalance",
  barFillToken: "dbs-barFillToken",
  railBars: "dbs-railBars",
  railBar: "dbs-railBar",
  railBarBalance: "dbs-railBarBalance",
  railBarToken: "dbs-railBarToken",
  modal: "dbs-modal",
  modalBody: "dbs-modalBody",
  modalFooter: "dbs-modalFooter",
  block: "dbs-block",
  caption: "dbs-caption",
  balanceMain: "dbs-balanceMain",
  callMain: "dbs-callMain",
  balanceSub: "dbs-balanceSub",
  rows: "dbs-rows",
  detailRow: "dbs-detailRow",
  detailLabel: "dbs-detailLabel",
  detailValue: "dbs-detailValue",
  modelRow: "dbs-modelRow",
  modelName: "dbs-modelName",
  modelMeta: "dbs-modelMeta",
  muted: "dbs-muted",
  error: "dbs-error",
  syncNote: "dbs-syncNote",
  spin: "dbs-spin"
};
var cssText = `
/* \u2500\u2500 sidebar foot action: full-width two-line status block \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Mirrors the shell's own trigger-row geometry (Settings footer trigger):
   transparent by default, one 12px interactive hover fill, no border, no
   shadow, no card layer. */
.dbs-root{
  box-sizing:border-box;
  cursor:pointer;
  width:calc(100% + 4px);
  color:var(--dsw-alias-label-primary);
  background:transparent;
  border:none;
  border-radius:12px;
  flex:none;
  margin:4px -2px;
  padding:6px 10px 6px 8px;
  font-family:inherit;
  font-size:14px;
  line-height:20px;
  display:flex;
  flex-direction:column;
  gap:2px;
  text-align:left;
  overflow:hidden;
}
.dbs-root:hover,.dbs-root[data-active]{background:var(--dsw-alias-interactive-bg-hover)}
.dbs-row{display:flex;align-items:center;gap:8px;min-height:20px}
.dbs-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dbs-value{flex:none;margin-left:auto;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* energy bars: a 4px rail under each row \u2014 remaining balance (success green)
   and consumed daily tokens (brand accent). No track color of its own beyond
   the subtle hover fill, so nothing adds a visual layer. */
.dbs-bar{box-sizing:border-box;flex:none;display:block;width:100%;height:4px;border-radius:2px;background:var(--dsw-alias-interactive-bg-hover);overflow:hidden}
.dbs-barFill{display:block;height:100%;border-radius:2px;transition:width .4s var(--ds-ease-in-out)}
.dbs-barFillBalance{background:var(--dsw-alias-state-success-primary)}
.dbs-barFillToken{background:var(--dsw-alias-brand-primary)}
/* collapsed 56px rail: one 36px circle with two stacked mini bars, same foot
   geometry as Settings */
.dbs-rail{
  cursor:pointer;
  box-sizing:border-box;
  border:none;
  background:transparent;
  border-radius:50%;
  width:36px;
  height:36px;
  margin:2px 0;
  padding:0;
  color:var(--dsw-alias-label-primary);
  display:inline-flex;
  justify-content:center;
  align-items:center;
}
.dbs-rail:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dbs-railBars{display:flex;flex-direction:column;gap:3px;width:16px;align-items:flex-start}
.dbs-railBar{display:block;height:5px;border-radius:2.5px;background:var(--dsw-alias-interactive-bg-hover)}
.dbs-railBarBalance{background:var(--dsw-alias-state-success-primary)}
.dbs-railBarToken{background:var(--dsw-alias-brand-primary)}
/* The shell stacks foot actions on one row and each shipped action is a
   full-width element; a status block needs the column so it sits directly
   above the Settings trigger while accent actions below it stack naturally. */
.hHd-Xa_footerActions{flex-direction:column;align-items:stretch}
/* \u2500\u2500 details dialog \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Native primitives Modal chrome (mask + dialog) is kept; only width and the
   content rhythm are owned here. */
.dbs-modal{width:480px;max-width:calc(100vw - 48px)}
.dbs-modalBody{display:flex;flex-direction:column;gap:18px;padding-bottom:4px}
.dbs-block{display:flex;flex-direction:column;gap:6px}
.dbs-caption{color:var(--dsw-alias-label-caption);text-transform:uppercase;letter-spacing:.04em;font-size:12px;line-height:18px}
.dbs-balanceMain{color:var(--dsw-alias-label-primary);font-size:24px;line-height:32px;font-weight:600}
.dbs-callMain{color:var(--dsw-alias-label-primary);font-size:16px;line-height:22px;font-weight:500}
.dbs-balanceSub{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dbs-rows{display:flex;flex-direction:column}
.dbs-detailRow{display:flex;align-items:baseline;gap:8px;height:28px}
.dbs-detailLabel{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
.dbs-detailValue{margin-left:auto;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;font-variant-numeric:tabular-nums}
.dbs-modelRow{display:flex;align-items:baseline;gap:8px;min-height:24px}
.dbs-modelName{min-width:0;color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dbs-modelMeta{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}
.dbs-muted{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.dbs-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}
.dbs-modalFooter{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:12px}
.dbs-syncNote{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;display:inline-flex;align-items:center;gap:6px}
.dbs-spin{animation:dbs-spin 1s linear infinite}
@keyframes dbs-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
/* \u2500\u2500 glass panel + high-contrast text \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Theme-paired frosted glass. Light theme: white frosted sheet (white veil
   replaces the dark modal mask via :has() so the glass never reads black)
   with dark near-black text. Dark theme: fully transparent glass (blur +
   sheen only) with bright near-white text. Each theme sets its own ramp. */
/* light theme (default): white glass + dark ramp */
.dbs-modal{
  background:rgba(255,255,255,.42);
  -webkit-backdrop-filter:blur(30px) saturate(1.6);
  backdrop-filter:blur(30px) saturate(1.6);
  border-color:rgba(255,255,255,.65);
  box-shadow:var(--dsw-shadow-lv3), inset 0 1px 0 rgba(255,255,255,.8);
  color:#171a21;
}
.dbs-modal .dbs-caption,
.dbs-modal .dbs-balanceSub,
.dbs-modal .dbs-modelMeta,
.dbs-modal .dbs-muted,
.dbs-modal .dbs-syncNote{color:#5b6472}
.dbs-modal .dbs-detailLabel{color:#333c48}
.dbs-modal .dbs-balanceMain,
.dbs-modal .dbs-callMain,
.dbs-modal .dbs-detailValue,
.dbs-modal .dbs-modelName{color:#101318}
.dbs-modal .dbs-error{color:#d64545}
body:not([data-ds-dark-theme]) div[role="presentation"]:has(> .dbs-modal) > div[aria-hidden="true"]{
  background:rgba(255,255,255,.32);
  -webkit-backdrop-filter:none;
  backdrop-filter:none;
}
/* dark theme: pure glass + white ramp */
body[data-ds-dark-theme] .dbs-modal{
  background:transparent;
  -webkit-backdrop-filter:blur(32px) saturate(2);
  backdrop-filter:blur(32px) saturate(2);
  border-color:color-mix(in srgb, var(--dsw-alias-border-inverted) 35%, transparent);
  box-shadow:var(--dsw-shadow-lv3), inset 0 1px 0 color-mix(in srgb, #ffffff 16%, transparent);
  color:#eef1f6;
}
body[data-ds-dark-theme] .dbs-modal .dbs-caption,
body[data-ds-dark-theme] .dbs-modal .dbs-balanceSub,
body[data-ds-dark-theme] .dbs-modal .dbs-modelMeta,
body[data-ds-dark-theme] .dbs-modal .dbs-muted,
body[data-ds-dark-theme] .dbs-modal .dbs-syncNote{color:#a9b3c2}
body[data-ds-dark-theme] .dbs-modal .dbs-detailLabel{color:#c9d1dc}
body[data-ds-dark-theme] .dbs-modal .dbs-balanceMain,
body[data-ds-dark-theme] .dbs-modal .dbs-callMain,
body[data-ds-dark-theme] .dbs-modal .dbs-detailValue,
body[data-ds-dark-theme] .dbs-modal .dbs-modelName{color:#f6f8fb}
body[data-ds-dark-theme] .dbs-modal .dbs-error{color:#ff8a80}
@media (prefers-reduced-motion:reduce){
  .dbs-spin{animation:none}
  .dbs-barFill{transition:none}
}
`;
var TAG_ID = "dsh-balance-status/balance.css";
function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-balance-status";
  tag.dataset.pluginCss = TAG_ID;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

// dsh-balance-status/src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
injectStyles();
var NS = "balance";
var zh = {
  "title": "DeepSeek \u8D26\u6237\u4F59\u989D",
  "today": "\u4ECA\u65E5 Token \u6D88\u8017",
  "loading": "\u540C\u6B65\u4E2D\u2026",
  "failed": "\u83B7\u53D6\u5931\u8D25",
  "unconfigured": "\u672A\u914D\u7F6E\u5BC6\u94A5",
  "tooltip.balance": "\u8D26\u6237\u4F59\u989D",
  "tooltip.today": "\u4ECA\u65E5\u6D88\u8017",
  "tooltip.input": "\u8F93\u5165 Token",
  "tooltip.output": "\u8F93\u51FA Token",
  "tooltip.synced": "\u6700\u540E\u540C\u6B65",
  "tooltip.balanceRemain": "\u4F59\u989D\u5269\u4F59",
  "tooltip.todayQuota": "\u4ECA\u65E5\u914D\u989D",
  "modal.title": "DeepSeek \u8D26\u6237\u8BE6\u60C5",
  "modal.balance": "\u8D26\u6237\u4F59\u989D",
  "modal.granted": "\u8D60\u9001\u4F59\u989D",
  "modal.toppedUp": "\u5145\u503C\u4F59\u989D",
  "modal.unavailable": "\u4E0D\u53EF\u7528",
  "modal.usage": "Token \u4F7F\u7528\u60C5\u51B5",
  "modal.today": "\u4ECA\u65E5",
  "modal.week": "\u672C\u5468",
  "modal.month": "\u672C\u6708",
  "modal.models": "\u6A21\u578B\u4F7F\u7528\uFF08\u672C\u6708\uFF09",
  "modal.calls": "API \u8C03\u7528\u6B21\u6570\uFF08\u672C\u6708\uFF09",
  "modal.callsUnit": "\u6B21",
  "modal.synced": "\u6700\u540E\u540C\u6B65",
  "modal.refresh": "\u5237\u65B0",
  "modal.close": "\u5173\u95ED",
  "modal.fetchFailed": "\u6570\u636E\u83B7\u53D6\u5931\u8D25"
};
var en = {
  "title": "DeepSeek Account Balance",
  "today": "Tokens Used Today",
  "loading": "Syncing\u2026",
  "failed": "Unavailable",
  "unconfigured": "No API key",
  "tooltip.balance": "Balance",
  "tooltip.today": "Today",
  "tooltip.input": "Input tokens",
  "tooltip.output": "Output tokens",
  "tooltip.synced": "Last sync",
  "tooltip.balanceRemain": "Balance left",
  "tooltip.todayQuota": "Today's quota",
  "modal.title": "DeepSeek Account",
  "modal.balance": "Account balance",
  "modal.granted": "Granted balance",
  "modal.toppedUp": "Topped-up balance",
  "modal.unavailable": "Unavailable",
  "modal.usage": "Token usage",
  "modal.today": "Today",
  "modal.week": "This week",
  "modal.month": "This month",
  "modal.models": "Model usage (this month)",
  "modal.calls": "API calls (this month)",
  "modal.callsUnit": "calls",
  "modal.synced": "Last sync",
  "modal.refresh": "Refresh",
  "modal.close": "Close",
  "modal.fetchFailed": "Failed to fetch status"
};
function currencySymbol(currency) {
  if (currency === "CNY") return "\xA5";
  if (currency === "USD") return "$";
  return `${currency} `;
}
function formatMoney(currency, total) {
  return `${currencySymbol(currency)}${Number.isFinite(total) ? total.toFixed(2) : "0.00"}`;
}
function formatCompact(value) {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1e9) return `${trimZero((value / 1e9).toFixed(1))}B`;
  if (value >= 1e6) return `${trimZero((value / 1e6).toFixed(1))}M`;
  if (value >= 1e3) return `${trimZero((Math.floor(value / 100) / 10).toFixed(1))}K`;
  return String(Math.round(value));
}
function trimZero(text) {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}
function formatFull(value) {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}
function formatRelativeLabel(now, at) {
  const delta = now - at;
  if (delta < 6e4) return "\u521A\u521A";
  if (delta < 36e5) return `${Math.floor(delta / 6e4)} \u5206\u949F\u524D`;
  if (delta < 864e5) return `${Math.floor(delta / 36e5)} \u5C0F\u65F6\u524D`;
  const d = new Date(at);
  const pad = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function prettyModel(model) {
  return String(model).split("-").map((segment) => {
    if (segment === "deepseek") return "DeepSeek";
    if (/^v\d+$/iu.test(segment)) return segment.toUpperCase();
    if (segment === "") return segment;
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  }).join("-");
}
function cx(...parts) {
  return parts.filter((part) => typeof part === "string" && part !== "").join(" ");
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function DetailRow({ label, value }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: styles.detailRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.detailLabel, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.detailValue, children: value })
  ] });
}
function EnergyBar({ label, ratio, fillClass }) {
  const pct = Math.round(clamp01(ratio) * 100);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      className: styles.bar,
      role: "progressbar",
      "aria-label": label,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": pct,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx(styles.barFill, fillClass), style: { width: `${pct}%` } })
    }
  );
}
function BalanceStatus({ wide, t }) {
  const [data, setData] = (0, import_react.useState)(null);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [error, setError] = (0, import_react.useState)(null);
  const [open, setOpen] = (0, import_react.useState)(false);
  const seq = (0, import_react.useRef)(0);
  const load = (0, import_react.useCallback)((force) => {
    const current = seq.current += 1;
    setLoading(true);
    fetch(`/balance-status/status${force ? "?force=1" : ""}`, { cache: "no-store" }).then((res) => res.json()).then((payload) => {
      if (current !== seq.current) return;
      setData(payload);
      setError(payload.ok ? null : payload.errors?.[0]?.message ?? payload.balanceError?.message ?? t("modal.fetchFailed"));
    }).catch((cause) => {
      if (current !== seq.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => {
      if (current === seq.current) setLoading(false);
    });
  }, [t]);
  (0, import_react.useEffect)(() => {
    load(false);
    const timer = window.setInterval(() => load(false), 6e4);
    return () => window.clearInterval(timer);
  }, [load]);
  (0, import_react.useEffect)(() => {
    if (open) load(false);
  }, [open, load]);
  const balance = data?.balance ?? null;
  const usage = data?.usage ?? null;
  const today = usage?.today ?? null;
  const targets = data?.targets ?? null;
  const todayTotal = today !== null ? today.input + today.output : 0;
  const balancePct = balance !== null && targets !== null ? clamp01(balance.total / targets.balance) : 0;
  const tokenPct = targets !== null ? clamp01(todayTotal / targets.dailyTokens) : 0;
  const balanceText = balance !== null ? formatMoney(balance.currency, balance.total) : loading ? "\u2014" : data?.balanceError?.code === "MISSING_CREDENTIAL" ? t("unconfigured") : t("failed");
  const todayTokens = today !== null ? `${formatCompact(todayTotal)} Tokens` : loading ? "\u2014" : t("failed");
  const tooltipLabel = () => {
    const lines = [];
    lines.push(`${t("tooltip.balance")}\uFF1A${balance !== null ? formatMoney(balance.currency, balance.total) : data?.balanceError?.code === "MISSING_CREDENTIAL" ? t("unconfigured") : t("failed")}`);
    if (today !== null) {
      lines.push(`${t("tooltip.today")}\uFF1A${formatFull(todayTotal)} Tokens`);
      lines.push(`${t("tooltip.input")}\uFF1A${formatFull(today.input)}`);
      lines.push(`${t("tooltip.output")}\uFF1A${formatFull(today.output)}`);
    } else if (loading) {
      lines.push(`${t("tooltip.today")}\uFF1A\u2026`);
    }
    if (balance !== null && targets !== null) {
      lines.push(`${t("tooltip.balanceRemain")}\uFF1A${formatMoney(balance.currency, balance.total)} / ${formatMoney(balance.currency, targets.balance)}\uFF08${Math.round(balancePct * 100)}%\uFF09`);
    }
    if (today !== null && targets !== null) {
      lines.push(`${t("tooltip.todayQuota")}\uFF1A${formatCompact(todayTotal)} / ${formatCompact(targets.dailyTokens)} Tokens\uFF08${Math.round(tokenPct * 100)}%\uFF09`);
    }
    lines.push(`${t("tooltip.synced")}\uFF1A${data !== null ? formatRelativeLabel(Date.now(), data.syncedAt) : "\u2014"}`);
    return lines.join("\n");
  };
  const balanceSub = balance !== null ? `${t("modal.granted")} ${formatMoney(balance.currency, balance.granted)} \xB7 ${t("modal.toppedUp")} ${formatMoney(balance.currency, balance.toppedUp)}` : null;
  const monthModels = usage?.month?.models ?? {};
  const modelEntries = Object.entries(monthModels).sort((a, b) => b[1].input + b[1].output - (a[1].input + a[1].output));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Tooltip,
      {
        label: tooltipLabel,
        side: wide ? "top" : "right",
        delayMs: 400,
        disabled: data === null,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: cx(styles.root, !wide && styles.rail),
            "aria-haspopup": "dialog",
            "aria-expanded": open,
            onClick: () => setOpen(true),
            children: wide ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: styles.row, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.label, children: t("title") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.value, children: balanceText })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnergyBar, { label: t("title"), ratio: balancePct, fillClass: styles.barFillBalance }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: styles.row, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.label, children: t("today") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.value, children: todayTokens })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnergyBar, { label: t("today"), ratio: tokenPct, fillClass: styles.barFillToken })
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: styles.railBars, "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx(styles.railBar, styles.railBarBalance), style: { width: `${Math.round(balancePct * 100)}%` } }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx(styles.railBar, styles.railBarToken), style: { width: `${Math.round(tokenPct * 100)}%` } })
            ] })
          }
        )
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      import_dsh_client_ui_primitives.Modal,
      {
        open,
        onClose: () => setOpen(false),
        title: t("modal.title"),
        closeLabel: t("modal.close"),
        className: styles.modal,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: styles.modalBody, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: styles.block, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.caption, children: t("modal.balance") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.balanceMain, children: balance !== null ? formatMoney(balance.currency, balance.total) : t("modal.unavailable") }),
              balanceSub !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.balanceSub, children: balanceSub })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: styles.block, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.caption, children: t("modal.usage") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: styles.rows, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailRow, { label: t("modal.today"), value: usage !== null ? `${formatFull(usage.today.input + usage.today.output)} Tokens \xB7 ${formatFull(usage.today.calls)} ${t("modal.callsUnit")}` : "\u2014" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailRow, { label: t("modal.week"), value: usage !== null ? `${formatFull(usage.week.input + usage.week.output)} Tokens \xB7 ${formatFull(usage.week.calls)} ${t("modal.callsUnit")}` : "\u2014" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetailRow, { label: t("modal.month"), value: usage !== null ? `${formatFull(usage.month.input + usage.month.output)} Tokens \xB7 ${formatFull(usage.month.calls)} ${t("modal.callsUnit")}` : "\u2014" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: styles.block, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.caption, children: t("modal.models") }),
              modelEntries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.muted, children: "\u2014" }) : modelEntries.map(([model, mb]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: styles.modelRow, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.modelName, children: prettyModel(model) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: styles.modelMeta, children: [
                  formatFull(mb.calls),
                  " ",
                  t("modal.callsUnit"),
                  " \xB7 ",
                  formatFull(mb.input + mb.output),
                  " Tokens"
                ] })
              ] }, model))
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: styles.block, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.caption, children: t("modal.calls") }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: styles.callMain, children: usage !== null ? `${formatFull(usage.month.calls)} ${t("modal.callsUnit")}` : "\u2014" })
            ] }),
            error !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: styles.error, role: "alert", children: error }),
            loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: styles.muted, role: "status", children: t("loading") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: styles.modalFooter, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: styles.syncNote, children: [
              t("modal.synced"),
              "\uFF1A",
              data !== null ? formatRelativeLabel(Date.now(), data.syncedAt) : "\u2014",
              loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconLoadingOutline16, { size: 14, className: styles.spin })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", disabled: loading, onClick: () => load(true), children: t("modal.refresh") })
          ] })
        ]
      }
    )
  ] });
}
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "balance-status: dictionaries");
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "balance-status",
    order: -100,
    locale: NS
  }, BalanceStatus));
}

		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
