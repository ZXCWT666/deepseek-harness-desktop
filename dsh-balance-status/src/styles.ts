// dsh-balance-status — browser pair of the style sheet: one module holding
// the CSS text and the class map. The text is injected as a plugin style tag
// exactly when the bundle materializes (the factory run), matching the
// shipping client-plugin CSS convention.

/** CSS class map consumed by client.tsx. */
export const styles = {
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

/** The stylesheet text. */
export const cssText = `
/* ── sidebar foot action: full-width two-line status block ─────────────────
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
/* energy bars: a 4px rail under each row — remaining balance (success green)
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
/* ── details dialog ────────────────────────────────────────────────────────
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
/* ── glass panel + high-contrast text ─────────────────────────────────────
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

/** The style-tag identity used for idempotent injection. */
const TAG_ID = "dsh-balance-status/balance.css";

/** Inject the stylesheet once (module materialization = factory execution). */
export function injectStyles() {
	if (typeof document === "undefined") return;
	if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`) !== null) return;
	const tag = document.createElement("style");
	tag.dataset.plugin = "dsh-balance-status";
	tag.dataset.pluginCss = TAG_ID;
	tag.textContent = cssText;
	document.head.appendChild(tag);
}
