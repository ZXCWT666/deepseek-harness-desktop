// dsh-balance-status — browser half.
//
// Registers one additive entry into the sidebar foot (`sidebar.footer.action`,
// the row directly above the Settings trigger): a two-line account status
// block rendered with the sidebar's own colors, spacing, and hover affordance
// — no card, no border, no shadow, no extra background layer. Hovering shows
// a light native tooltip (balance, today's tokens, input/output split, last
// sync); clicking opens a native primitives Modal with the account details
// and a manual refresh.

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, IconLoadingOutline16, Modal, Tooltip } from "@deepseek-ai/dsh-client-ui-primitives";
import { injectStyles, styles } from "./styles";

// The plugin style tag is added when the bundle materializes (factory run).
injectStyles();

/** Locale namespace owned by this plugin. */
const NS = "balance";

/** Simplified Chinese dictionary (key-set source of truth). */
const zh = {
	"title": "DeepSeek 账户余额",
	"today": "今日 Token 消耗",
	"loading": "同步中…",
	"failed": "获取失败",
	"unconfigured": "未配置密钥",
	"tooltip.balance": "账户余额",
	"tooltip.today": "今日消耗",
	"tooltip.input": "输入 Token",
	"tooltip.output": "输出 Token",
	"tooltip.synced": "最后同步",
	"tooltip.balanceRemain": "余额剩余",
	"tooltip.todayQuota": "今日配额",
	"modal.title": "DeepSeek 账户详情",
	"modal.balance": "账户余额",
	"modal.granted": "赠送余额",
	"modal.toppedUp": "充值余额",
	"modal.unavailable": "不可用",
	"modal.usage": "Token 使用情况",
	"modal.today": "今日",
	"modal.week": "本周",
	"modal.month": "本月",
	"modal.models": "模型使用（本月）",
	"modal.calls": "API 调用次数（本月）",
	"modal.callsUnit": "次",
	"modal.synced": "最后同步",
	"modal.refresh": "刷新",
	"modal.close": "关闭",
	"modal.fetchFailed": "数据获取失败"
};

/** English dictionary, complete against the zh key set. */
const en = {
	"title": "DeepSeek Account Balance",
	"today": "Tokens Used Today",
	"loading": "Syncing…",
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

// ── formatting helpers ─────────────────────────────────────────────────────

/** Currency symbol for the DeepSeek balance record. */
function currencySymbol(currency) {
	if (currency === "CNY") return "¥";
	if (currency === "USD") return "$";
	return `${currency} `;
}

/** ¥12.86-style fixed-point money formatting. */
function formatMoney(currency, total) {
	return `${currencySymbol(currency)}${Number.isFinite(total) ? total.toFixed(2) : "0.00"}`;
}

/** Compact token figure: 128,560 → 128.5K, 860,000 → 860K, 3,200,000 → 3.2M. */
function formatCompact(value) {
	if (!Number.isFinite(value)) return "0";
	if (value >= 1e9) return `${trimZero((value / 1e9).toFixed(1))}B`;
	if (value >= 1e6) return `${trimZero((value / 1e6).toFixed(1))}M`;
	if (value >= 1e3) return `${trimZero((Math.floor(value / 100) / 10).toFixed(1))}K`;
	return String(Math.round(value));
}

/** Strip a trailing .0 from a compact-formatted number. */
function trimZero(text) {
	return text.endsWith(".0") ? text.slice(0, -2) : text;
}

/** Full token figure: 128,560. */
function formatFull(value) {
	if (!Number.isFinite(value)) return "0";
	return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

/** Relative sync age: 刚刚 / X 分钟前 / X 小时前 / date. */
function formatRelativeLabel(now, at) {
	const delta = now - at;
	if (delta < 60_000) return "刚刚";
	if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
	if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
	const d = new Date(at);
	const pad = (v) => String(v).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** deepseek-v4-flash-vision-exp → DeepSeek-V4-Flash-Vision-Exp. */
function prettyModel(model) {
	return String(model).split("-").map((segment) => {
		if (segment === "deepseek") return "DeepSeek";
		if (/^v\d+$/iu.test(segment)) return segment.toUpperCase();
		if (segment === "") return segment;
		return segment.charAt(0).toUpperCase() + segment.slice(1);
	}).join("-");
}

/** Combine a stateless class list (tiny clsx stand-in). */
function cx(...parts) {
	return parts.filter((part) => typeof part === "string" && part !== "").join(" ");
}

/** Clamp a ratio to [0, 1]. */
function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

// ── data shapes (wire from /balance-status/status) ─────────────────────────

/** One usage window's totals, with per-model splits. */
interface UsageWindow {
  input: number;
  output: number;
  calls: number;
  models: Record<string, { input: number; output: number; calls: number }>;
}

/** The status snapshot served by the host half. */
interface StatusPayload {
  ok: boolean;
  syncedAt: number;
  balance: {
    available: boolean;
    currency: string;
    total: number;
    granted: number;
    toppedUp: number;
  } | null;
  balanceError: { code: string; message: string } | null;
  targets: {
    balance: number;
    dailyTokens: number;
  };
  usage: { today: UsageWindow; week: UsageWindow; month: UsageWindow; all: UsageWindow } | null;
  errors: { code: string; message: string }[];
}

/** Slot owner props handed by the sidebar shell (contract: footer action). */
interface BalanceStatusProps {
  wide: boolean;
  t: (key: string) => string;
}

// ── component ──────────────────────────────────────────────────────────────

/** One detail row of the modal: label left, value right. */
function DetailRow({ label, value }) {
	return (
		<div className={styles.detailRow}>
			<span className={styles.detailLabel}>{label}</span>
			<span className={styles.detailValue}>{value}</span>
		</div>
	);
}

/** The energy bar under a status row: remaining (balance) or consumed (tokens). */
function EnergyBar({ label, ratio, fillClass }) {
	const pct = Math.round(clamp01(ratio) * 100);
	return (
		<span
			className={styles.bar}
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={pct}
		>
			<span className={cx(styles.barFill, fillClass)} style={{ width: `${pct}%` }} />
		</span>
	);
}

/**
 * The sidebar foot status widget: two-line account summary in the wide
 * column, one icon circle in the collapsed rail, plus the hover tooltip and
 * the details modal.
 */
function BalanceStatus({ wide, t }: BalanceStatusProps) {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [open, setOpen] = useState(false);
	const seq = useRef(0);

	const load = useCallback((force) => {
		const current = (seq.current += 1);
		setLoading(true);
		fetch(`/balance-status/status${force ? "?force=1" : ""}`, { cache: "no-store" }).then((res) => res.json()).then((payload) => {
			if (current !== seq.current) return;
			setData(payload);
			setError(payload.ok ? null : (payload.errors?.[0]?.message ?? payload.balanceError?.message ?? t("modal.fetchFailed")));
		}).catch((cause) => {
			if (current !== seq.current) return;
			setError(cause instanceof Error ? cause.message : String(cause));
		}).finally(() => {
			if (current === seq.current) setLoading(false);
		});
	}, [t]);

	// Mount-time load plus the automatic refresh cadence (host caches too).
	useEffect(() => {
		load(false);
		const timer = window.setInterval(() => load(false), 60_000);
		return () => window.clearInterval(timer);
	}, [load]);

	// Re-sync when the details dialog opens.
	useEffect(() => {
		if (open) load(false);
	}, [open, load]);

	const balance = data?.balance ?? null;
	const usage = data?.usage ?? null;
	const today = usage?.today ?? null;
	const targets = data?.targets ?? null;
	const todayTotal = today !== null ? today.input + today.output : 0;
	const balancePct = balance !== null && targets !== null ? clamp01(balance.total / targets.balance) : 0;
	const tokenPct = targets !== null ? clamp01(todayTotal / targets.dailyTokens) : 0;
	const balanceText = balance !== null
		? formatMoney(balance.currency, balance.total)
		: loading ? "—" : data?.balanceError?.code === "MISSING_CREDENTIAL" ? t("unconfigured") : t("failed");
	const todayTokens = today !== null ? `${formatCompact(todayTotal)} Tokens` : loading ? "—" : t("failed");

	const tooltipLabel = () => {
		const lines = [];
		lines.push(`${t("tooltip.balance")}：${balance !== null ? formatMoney(balance.currency, balance.total) : data?.balanceError?.code === "MISSING_CREDENTIAL" ? t("unconfigured") : t("failed")}`);
		if (today !== null) {
			lines.push(`${t("tooltip.today")}：${formatFull(todayTotal)} Tokens`);
			lines.push(`${t("tooltip.input")}：${formatFull(today.input)}`);
			lines.push(`${t("tooltip.output")}：${formatFull(today.output)}`);
		} else if (loading) {
			lines.push(`${t("tooltip.today")}：…`);
		}
		if (balance !== null && targets !== null) {
			lines.push(`${t("tooltip.balanceRemain")}：${formatMoney(balance.currency, balance.total)} / ${formatMoney(balance.currency, targets.balance)}（${Math.round(balancePct * 100)}%）`);
		}
		if (today !== null && targets !== null) {
			lines.push(`${t("tooltip.todayQuota")}：${formatCompact(todayTotal)} / ${formatCompact(targets.dailyTokens)} Tokens（${Math.round(tokenPct * 100)}%）`);
		}
		lines.push(`${t("tooltip.synced")}：${data !== null ? formatRelativeLabel(Date.now(), data.syncedAt) : "—"}`);
		return lines.join("\n");
	};

	const balanceSub = balance !== null
		? `${t("modal.granted")} ${formatMoney(balance.currency, balance.granted)} · ${t("modal.toppedUp")} ${formatMoney(balance.currency, balance.toppedUp)}`
		: null;
	const monthModels = usage?.month?.models ?? {};
	const modelEntries = Object.entries(monthModels).sort((a, b) => (b[1].input + b[1].output) - (a[1].input + a[1].output));

	return (
		<>
			<Tooltip
				label={tooltipLabel}
				side={wide ? "top" : "right"}
				delayMs={400}
				disabled={data === null}
			>
				<button
					type="button"
					className={cx(styles.root, !wide && styles.rail)}
					aria-haspopup="dialog"
					aria-expanded={open}
					onClick={() => setOpen(true)}
				>
					{wide ? (
						<>
							<span className={styles.row}>
								<span className={styles.label}>{t("title")}</span>
								<span className={styles.value}>{balanceText}</span>
							</span>
							<EnergyBar label={t("title")} ratio={balancePct} fillClass={styles.barFillBalance} />
							<span className={styles.row}>
								<span className={styles.label}>{t("today")}</span>
								<span className={styles.value}>{todayTokens}</span>
							</span>
							<EnergyBar label={t("today")} ratio={tokenPct} fillClass={styles.barFillToken} />
						</>
					) : (
						<span className={styles.railBars} aria-hidden="true">
							<span className={cx(styles.railBar, styles.railBarBalance)} style={{ width: `${Math.round(balancePct * 100)}%` }} />
							<span className={cx(styles.railBar, styles.railBarToken)} style={{ width: `${Math.round(tokenPct * 100)}%` }} />
						</span>
					)}
				</button>
			</Tooltip>
			<Modal
				open={open}
				onClose={() => setOpen(false)}
				title={t("modal.title")}
				closeLabel={t("modal.close")}
				className={styles.modal}
			>
				<div className={styles.modalBody}>
					<section className={styles.block}>
						<span className={styles.caption}>{t("modal.balance")}</span>
						<span className={styles.balanceMain}>{balance !== null ? formatMoney(balance.currency, balance.total) : t("modal.unavailable")}</span>
						{balanceSub !== null && <span className={styles.balanceSub}>{balanceSub}</span>}
					</section>
					<section className={styles.block}>
						<span className={styles.caption}>{t("modal.usage")}</span>
						<div className={styles.rows}>
							<DetailRow label={t("modal.today")} value={usage !== null ? `${formatFull(usage.today.input + usage.today.output)} Tokens · ${formatFull(usage.today.calls)} ${t("modal.callsUnit")}` : "—"} />
							<DetailRow label={t("modal.week")} value={usage !== null ? `${formatFull(usage.week.input + usage.week.output)} Tokens · ${formatFull(usage.week.calls)} ${t("modal.callsUnit")}` : "—"} />
							<DetailRow label={t("modal.month")} value={usage !== null ? `${formatFull(usage.month.input + usage.month.output)} Tokens · ${formatFull(usage.month.calls)} ${t("modal.callsUnit")}` : "—"} />
						</div>
					</section>
					<section className={styles.block}>
						<span className={styles.caption}>{t("modal.models")}</span>
						{modelEntries.length === 0
							? <span className={styles.muted}>—</span>
							: modelEntries.map(([model, mb]) => (
								<div className={styles.modelRow} key={model}>
									<span className={styles.modelName}>{prettyModel(model)}</span>
									<span className={styles.modelMeta}>{formatFull(mb.calls)} {t("modal.callsUnit")} · {formatFull(mb.input + mb.output)} Tokens</span>
								</div>
							))}
					</section>
					<section className={styles.block}>
						<span className={styles.caption}>{t("modal.calls")}</span>
						<span className={styles.callMain}>
							{usage !== null ? `${formatFull(usage.month.calls)} ${t("modal.callsUnit")}` : "—"}
						</span>
					</section>
					{error !== null && <p className={styles.error} role="alert">{error}</p>}
					{loading && <p className={styles.muted} role="status">{t("loading")}</p>}
				</div>
				<div className={styles.modalFooter}>
					<span className={styles.syncNote}>
						{t("modal.synced")}：{data !== null ? formatRelativeLabel(Date.now(), data.syncedAt) : "—"}
						{loading && <IconLoadingOutline16 size={14} className={styles.spin} />}
					</span>
					<Button variant="outline" disabled={loading} onClick={() => load(true)}>
						{t("modal.refresh")}
					</Button>
				</div>
			</Modal>
		</>
	);
}

// ── plugin face ────────────────────────────────────────────────────────────

/** Services required before the plugin activates. */
const inject = ["slots", "locale"];

/**
 * Register the dictionaries and the sidebar foot entry.
 * @param ctx - the client root context.
 */
function apply(ctx) {
	ctx.effect(() => ctx.locale.register(NS, { zh, en }), "balance-status: dictionaries");
	ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
		name: "sidebar.footer.action",
		id: "balance-status",
		order: -100,
		locale: NS
	}, BalanceStatus));
}

export { apply, inject };
