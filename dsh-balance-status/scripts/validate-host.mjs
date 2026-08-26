// Validation harness for the host half: drives the plugin with a fake ctx
// wired to the real session logs and the real DeepSeek balance endpoint.
// Reads $DSH_HOME (default ~/.dsh) and the DEEPSEEK_API_KEY credential.
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { zstdDecompressSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const plugin = await import("../lib/index.js");

/** Harness home override, defaulting to the user profile's .dsh. */
const DSH_HOME = resolve(process.env.DSH_HOME ?? join(homedir(), ".dsh"));
const SESSIONS_ROOT = join(DSH_HOME, "sessions");
const CREDENTIALS_FILE = join(DSH_HOME, ".credentials.yaml");

// debug: surface the underlying fetch cause
const origFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
	try {
		return await origFetch(...args);
	} catch (error) {
		console.log("FETCH FAIL", args[0], "| cause:", error.cause?.message ?? error.cause?.code ?? error.cause ?? "n/a");
		throw error;
	}
};

// fake ctx
let captured = null;
const ctx = {
	get(name) {
		if (name === "webServer") return {
			register(route) {
				captured = route;
				return () => {};
			}
		};
		if (name === "credentials") return {
			resolve: async (ref) => ({ value: readFileSync(CREDENTIALS_FILE, "utf8").match(new RegExp(`${ref}:\\s*(\\S+)`))?.[1] ?? "", source: "file" })
		};
		if (name === "settings") return undefined;
		if (name === "sessionPersistence") return realPersistence;
		return undefined;
	},
	effect(fn) {
		const d = fn();
		if (typeof d === "function") d();
	}
};

// minimal persistence over the real session store
async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else if (entry.name === "session.jsonl.zstd" || entry.name === "session.jsonl") yield { path, id: entry.name.startsWith("session.jsonl.zstd") ? undefined : undefined, name: entry.name };
	}
}
const allLogs = [];
for await (const f of walk(SESSIONS_ROOT)) allLogs.push(f);

function decode(buffer) {
	const parts = [];
	let offset = 0;
	const MAGIC = 4247762216;
	while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === MAGIC) {
		const start = offset;
		offset += 4;
		if (offset === buffer.length) break;
		const descriptor = buffer.readUInt8(offset); offset += 1;
		if ((descriptor & 24) !== 0) break;
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
		offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		for (;;) {
			if (offset + 3 > buffer.length) break;
			const blockHeader = buffer.readUIntLE(offset, 3); offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			offset += blockType === 1 ? 1 : blockSize;
			if (lastBlock) break;
		}
		if (checksum) offset += 4;
		parts.push(zstdDecompressSync(buffer.subarray(start, offset)));
	}
	return Buffer.concat(parts).toString("utf8");
}

const metaById = new Map();
for (const log of allLogs) {
	const text = decode(await readFile(log.path));
	const header = JSON.parse(text.split("\n")[0]);
	metaById.set(header.id, { id: header.id, cwd: header.cwd, path: log.path, text });
}
const realPersistence = {
	list: async () => [...metaById.values()],
	locate: (meta) => ({ path: meta.path }),
	readRaw: async (id) => {
		const meta = metaById.get(id);
		if (!meta) return undefined;
		return { content: meta.text, filename: "session.jsonl" };
	}
};

plugin.apply(ctx);
const url = new URL("http://x/balance-status/status");
const req = { method: "GET", url: url.pathname + url.search };
const res = {
	writeHead(code, headers) { this.code = code; this.headers = headers; },
	end(body) { this.body = body; }
};
await captured.handler(req, res);
const payload = JSON.parse(res.body);
console.log("HTTP", res.code);
console.log("balance:", JSON.stringify(payload.balance));
console.log("balanceError:", JSON.stringify(payload.balanceError));
console.log("usage.today:", JSON.stringify(payload.usage?.today));
console.log("usage.week:", JSON.stringify(payload.usage?.week));
console.log("usage.month:", JSON.stringify(payload.usage?.month));
console.log("usage.all:", JSON.stringify(payload.usage?.all));
console.log("targets:", JSON.stringify(payload.targets));
console.log("syncedAt:", payload.syncedAt, new Date(payload.syncedAt).toISOString());

// force refresh second call (cached path)
const res2 = { writeHead() {}, end(b) { this.body = b; } };
await captured.handler({ method: "GET", url: "/balance-status/status" }, res2);
console.log("second call ok:", JSON.parse(res2.body).ok);
