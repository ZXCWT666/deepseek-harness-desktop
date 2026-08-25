// dsh-balance-status — host half.
//
// Owns the account status data plane for the sidebar widget:
//   1. DeepSeek balance (GET {baseURL}/user/balance with the same credential
//      reference the Models page manages), cached for BALANCE_TTL_MS and
//      re-fetched automatically on refresh.
//   2. Token usage aggregated from the durable session logs (the zstd JSONL
//      artifacts under $DSH_HOME/sessions) — input/output tokens and model
//      counts per successful model call, bucketed by local day so today/week/
//      month windows can be answered without re-reading old logs.
//
// Serves one JSON endpoint at GET /balance-status/status (force=1 re-reads
// everything). Plain ESM, no bundling: the cordis loader imports this file
// directly.

import { stat } from "node:fs/promises";
import { zstdDecompressSync } from "node:zlib";

/** Stable plugin name (the row id is composition-local). */
const name = "dsh-balance-status";
/** Services required before this plugin may mount. */
const inject = ["webServer"];
/** Route prefix owned by this plugin. */
const ROUTE_PREFIX = "/balance-status";
/** Route path of the status endpoint. */
const ROUTE_PATH = `${ROUTE_PREFIX}/status`;
/** How long a status snapshot stays serviceable without re-reading. */
const SNAPSHOT_TTL_MS = 60_000;
/** How long a fetched balance stays fresh (auto-refresh cadence). */
const BALANCE_TTL_MS = 60_000;
/** Provider default endpoint; `llm-deepseek` settings may override baseURL. */
const DEFAULT_BASE_URL = "https://api.deepseek.com";
/** Default credential reference, matching the official adapter. */
const DEFAULT_CREDENTIAL_REF = "DEEPSEEK_API_KEY";
/** Provider endpoint override honored from the environment (adapter parity). */
const BASE_URL_ENV = "DEEPSEEK_BASE_URL";
/** Balance fetch attempts before the failure surfaces to the widget. */
const BALANCE_FETCH_ATTEMPTS = 3;
/** Delay between balance fetch attempts. */
const BALANCE_FETCH_RETRY_MS = 800;
/** Per-attempt request timeout. */
const BALANCE_FETCH_TIMEOUT_MS = 15000;
/** Reference amount (in the balance record's currency) the balance bar shades against. */
const BALANCE_DISPLAY_TARGET = 100;
/** Reference daily token figure the consumption bar shades against. */
const DAILY_TOKEN_TARGET = 500000;
/** Zstandard frame magic (little endian 0xFD2FB528). */
const ZSTD_MAGIC = 4247762216;

// ── local-time window helpers ──────────────────────────────────────────────

/** Milliseconds at local midnight of the day containing value. */
function startOfDay(ms) {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** Milliseconds at local Monday 00:00 of the week containing value. */
function startOfWeek(ms) {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay() || 7;
	d.setDate(d.getDate() - day + 1);
	return d.getTime();
}

/** Milliseconds at local 1st 00:00 of the month containing value. */
function startOfMonth(ms) {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	d.setDate(1);
	return d.getTime();
}

/** A day bucket: billed tokens and call counts, optionally split per model. */
function emptyBucket() {
	return {
		input: 0,
		output: 0,
		calls: 0,
		models: new Map()
	};
}

// ── zstd frame scanning (the persistence backend's container format) ───────

/**
 * Locate the complete Zstandard frames of a concatenated-frame session log
 * without decompressing their blocks. Same walk as
 * dsh-session-persistence-jsonl's zstd scanner; the final torn frame is
 * simply not returned (a status widget reads committed prefix data).
 * @param buffer - complete artifact bytes.
 * @returns the frame ranges [start, end).
 */
function scanZstdFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return frames;
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) return frames;
		offset += 4;
		if (offset === buffer.length) return frames;
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) return frames;
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return frames;
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return frames;
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return frames;
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return frames;
			offset += 4;
		}
		frames.push({ start, end: offset });
	}
	return frames;
}

/** Decode one concatenated-frame artifact to its plaintext JSONL text. */
function decodeSessionLog(buffer) {
	const frames = scanZstdFrames(buffer);
	const parts = [];
	for (const frame of frames) parts.push(zstdDecompressSync(buffer.subarray(frame.start, frame.end)));
	return Buffer.concat(parts.map((part) => Buffer.from(part))).toString("utf8");
}

// ── usage folding ──────────────────────────────────────────────────────────

/**
 * Fold one session's recorded model-call usage into per-day buckets.
 * A billing event is an `assistant/message` whose message source is a model;
 * its `usage` carries the provider-reported input/output tokens. The fold
 * keeps only days at or after `floorMs` (the month floor), because the
 * status widget never answers windows older than the current month.
 * @param content - the JSONL artifact text.
 * @param floorMs - earliest day-start kept.
 * @returns a Map keyed by local day-start epoch ms.
 */
function foldUsage(content, floorMs) {
	const days = new Map();
	for (const line of content.split("\n")) {
		if (line === "") continue;
		let event;
		try {
			event = JSON.parse(line);
		} catch {
			continue;
		}
		if (event?.type !== "assistant/message") continue;
		const data = event.data;
		if (data === null || typeof data !== "object") continue;
		const source = data.message?.source ?? data.source;
		if (source?.kind !== "model") continue;
		const usage = data.usage;
		if (usage === null || typeof usage !== "object") continue;
		const input = Number(usage.inputTokens) || 0;
		const output = Number(usage.outputTokens) || 0;
		if (input <= 0 && output <= 0) continue;
		const time = typeof event.time === "number" ? event.time : 0;
		const day = startOfDay(time);
		if (day < floorMs) continue;
		let bucket = days.get(day);
		if (bucket === undefined) {
			bucket = emptyBucket();
			days.set(day, bucket);
		}
		bucket.input += input;
		bucket.output += output;
		bucket.calls += 1;
		const model = typeof source.model === "string" && source.model !== "" ? source.model : "unknown-model";
		let modelBucket = bucket.models.get(model);
		if (modelBucket === undefined) {
			modelBucket = { input: 0, output: 0, calls: 0 };
			bucket.models.set(model, modelBucket);
		}
		modelBucket.input += input;
		modelBucket.output += output;
		modelBucket.calls += 1;
	}
	return days;
}

/**
 * Aggregate the day buckets falling inside [fromMs, toMs) across all sessions.
 * @param folds - iterable of per-session day maps.
 * @param fromMs - inclusive window start.
 * @param toMs - exclusive window end.
 * @returns the window totals with a plain models record.
 */
function aggregateWindows(folds, fromMs, toMs) {
	const out = { input: 0, output: 0, calls: 0, models: {} };
	for (const days of folds) {
		if (days === null) continue;
		for (const [day, bucket] of days) {
			if (day < fromMs || day >= toMs) continue;
			out.input += bucket.input;
			out.output += bucket.output;
			out.calls += bucket.calls;
			for (const [model, mb] of bucket.models) {
				const held = out.models[model];
				if (held === undefined) out.models[model] = { input: mb.input, output: mb.output, calls: mb.calls };
				else {
					held.input += mb.input;
					held.output += mb.output;
					held.calls += mb.calls;
				}
			}
		}
	}
	return out;
}

// ── balance fetching ───────────────────────────────────────────────────────

/**
 * Fetch the DeepSeek account balance with the same credential seam the Models
 * page writes (settings `llm-deepseek.apiKeyEnv`/`baseURL`, defaulting to
 * DEEPSEEK_API_KEY and https://api.deepseek.com).
 * @param ctx - the plugin context.
 * @returns the normalized balance record.
 */
async function fetchBalance(ctx) {
	const credentials = ctx.get("credentials");
	const settings = ctx.get("settings");
	let credRef = DEFAULT_CREDENTIAL_REF;
	let baseUrl = DEFAULT_BASE_URL;
	if (settings !== undefined) {
		try {
			const section = settings.get("llm-deepseek");
			if (section !== null && typeof section === "object") {
				if (typeof section.apiKeyEnv === "string" && section.apiKeyEnv !== "") credRef = section.apiKeyEnv;
				if (typeof section.baseURL === "string" && section.baseURL !== "") baseUrl = section.baseURL;
			}
		} catch {
			/* settings service absent or namespace unregistered: defaults. */
		}
	}
	if (baseUrl === DEFAULT_BASE_URL) {
		const environmentBase = process.env[BASE_URL_ENV];
		if (typeof environmentBase === "string" && environmentBase !== "") baseUrl = environmentBase;
	}
	const hit = credentials === undefined ? undefined : await credentials.resolve(credRef);
	const key = hit?.value;
	if (typeof key !== "string" || key === "") {
		const err = new Error(`no credential for ${credRef}`);
		err.code = "MISSING_CREDENTIAL";
		throw err;
	}
	const url = `${baseUrl.replace(/\/+$/u, "")}/user/balance`;
	let lastError;
	for (let attempt = 1; attempt <= BALANCE_FETCH_ATTEMPTS; attempt += 1) {
		try {
			const res = await fetch(url, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${key}`,
					Accept: "application/json"
				},
				signal: AbortSignal.timeout(BALANCE_FETCH_TIMEOUT_MS)
			});
			if (res.ok) {
				const body = await res.json();
				const infos = Array.isArray(body?.balance_infos) ? body.balance_infos : [];
				const info = infos.find((candidate) => candidate?.currency === "CNY") ?? infos[0];
				return {
					available: body?.is_available === true,
					currency: typeof info?.currency === "string" && info.currency !== "" ? info.currency : "CNY",
					total: Number(info?.total_balance ?? 0),
					granted: Number(info?.granted_balance ?? 0),
					toppedUp: Number(info?.topped_up_balance ?? 0)
				};
			}
			const err = new Error(`DeepSeek balance API answered ${res.status}`);
			err.code = res.status === 401 || res.status === 403 ? "UNAUTHORIZED" : "HTTP_ERROR";
			throw err;
		} catch (error) {
			lastError = error;
			if (attempt < BALANCE_FETCH_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, BALANCE_FETCH_RETRY_MS));
		}
	}
	throw lastError;
}

// ── snapshot computation ───────────────────────────────────────────────────

/** Create one plugin-local service holding caches and the single-flight gate. */
function createStatusService(ctx) {
	let snapshot = null;
	let snapshotAt = 0;
	let inflight = null;
	let balanceCache = { at: 0, value: null, error: null };
	/** Per-session usage folds, keyed by session id, guarded by file identity. */
	const folds = new Map();

	/**
	 * Read and fold one session's log when its file changed. Sessions whose
	 * artifact predates the month floor cannot contain usage inside a window.
	 * @param persistence - the sessionPersistence service.
	 * @param sessions - the sessions service (live flush), may be undefined.
	 * @param meta - one persisted session metadata record.
	 * @param floorMs - the current month's start.
	 * @returns the day map, or null when the session carries nothing relevant.
	 */
	async function sessionDays(persistence, sessions, meta, floorMs) {
		const location = persistence.locate?.(meta);
		const path = typeof location === "object" && location !== null && typeof location.path === "string" ? location.path : undefined;
		if (path === undefined) return null;
		let before;
		try {
			before = await stat(path);
		} catch {
			return null;
		}
		if (before.mtimeMs < floorMs) return null;
		const cached = folds.get(meta.id);
		if (cached !== undefined && cached.mtimeMs === before.mtimeMs && cached.size === before.size) return cached.days;
		const live = sessions?.get?.(meta.id);
		if (live !== undefined) {
			try {
				await sessions.flush(live);
			} catch {
				/* live flush is best-effort for a status read. */
			}
		}
		let raw;
		try {
			raw = await persistence.readRaw(meta.id);
		} catch {
			return null;
		}
		if (raw === undefined) return null;
		const content = typeof raw.content === "string" ? raw.content : undefined;
		if (content === undefined) return null;
		const days = foldUsage(content, floorMs);
		let after;
		try {
			after = await stat(path);
		} catch {
			after = before;
		}
		folds.set(meta.id, { mtimeMs: after.mtimeMs, size: after.size, days });
		return days;
	}

	/**
	 * Collect usage across every persisted session.
	 * @returns {today, week, month, all, models} totals.
	 */
	async function collectUsage() {
		const persistence = ctx.get("sessionPersistence");
		if (persistence === undefined) return { today: emptyBucket(), week: emptyBucket(), month: emptyBucket(), all: emptyBucket() };
		const sessions = ctx.get("sessions");
		const now = Date.now();
		const floor = startOfMonth(now) - 86400000;
		const metas = await persistence.list();
		const collected = [];
		for (const meta of metas) {
			if (meta === null || typeof meta !== "object") continue;
			if (typeof meta.id !== "string" || meta.id === "") continue;
			collected.push(await sessionDays(persistence, sessions, meta, floor));
		}
		const all = aggregateWindows(collected, 0, Number.MAX_SAFE_INTEGER);
		return {
			today: aggregateWindows(collected, startOfDay(now), now + 1),
			week: aggregateWindows(collected, startOfWeek(now), now + 1),
			month: aggregateWindows(collected, floor + 86400000, now + 1),
			all
		};
	}

	/** One complete status snapshot (balance + windows + diagnostics). */
	async function computeStatus(force) {
		const errors = [];
		let balance = balanceCache.value;
		let balanceError = balanceCache.error;
		if (force || balance === null || Date.now() - balanceCache.at >= BALANCE_TTL_MS) {
			try {
				balance = await fetchBalance(ctx);
				balanceCache = { at: Date.now(), value: balance, error: null };
				balanceError = null;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				balanceError = { code: error?.code ?? "BALANCE_FETCH_FAILED", message };
				if (balance === null) {
					balanceCache = { at: Date.now(), value: null, error: balanceError };
				} else {
					balanceCache = { ...balanceCache, error: balanceError };
				}
			}
		}
		let usage = null;
		try {
			usage = await collectUsage();
		} catch (error) {
			errors.push({ code: "USAGE_READ_FAILED", message: error instanceof Error ? error.message : String(error) });
		}
		const syncedAt = Date.now();
		return {
			ok: true,
			syncedAt,
			balance,
			balanceError,
			targets: {
				balance: BALANCE_DISPLAY_TARGET,
				dailyTokens: DAILY_TOKEN_TARGET
			},
			usage,
			errors
		};
	}

	/** The public read synchronized by TTL and single-flight. */
	async function status(force) {
		if (!force && snapshot !== null && Date.now() - snapshotAt < SNAPSHOT_TTL_MS) return snapshot;
		if (inflight !== null) return inflight;
		inflight = (async () => {
			try {
				snapshot = await computeStatus(force);
				snapshotAt = Date.now();
				return snapshot;
			} finally {
				inflight = null;
			}
		})();
		return inflight;
	}

	return { status };
}

// ── plugin ─────────────────────────────────────────────────────────────────

/**
 * Mount the route and the status service.
 * @param ctx - the plugin context carrying webServer.
 */
function apply(ctx) {
	const service = createStatusService(ctx);
	const webServer = ctx.get("webServer");
	if (webServer === undefined) return;
	ctx.effect(() => webServer.register({
		kind: "prefix",
		path: ROUTE_PREFIX,
		handler: async (req, res) => {
			const url = new URL(req.url ?? "/", "http://x");
			if (url.pathname !== ROUTE_PATH) {
				res.writeHead(404);
				res.end();
				return;
			}
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.writeHead(405);
				res.end();
				return;
			}
			const force = url.searchParams.get("force") === "1";
			let payload;
			try {
				payload = await service.status(force);
			} catch (error) {
				payload = {
					ok: false,
					syncedAt: Date.now(),
					balance: null,
					balanceError: { code: "INTERNAL", message: error instanceof Error ? error.message : String(error) },
					targets: {
						balance: BALANCE_DISPLAY_TARGET,
						dailyTokens: DAILY_TOKEN_TARGET
					},
					usage: null,
					errors: [{ code: "INTERNAL", message: error instanceof Error ? error.message : String(error) }]
				};
			}
			const body = JSON.stringify(payload);
			res.writeHead(200, {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store"
			});
			res.end(req.method === "HEAD" ? undefined : body);
		}
	}), "balance-status: status route");
}

export { apply, inject, name };
