// 下载 CI 构建产物并上传安装包到指定 GitHub Release（幂等：已存在的附件跳过）
// 用法：node scripts/attach-release.mjs <token> <runId> <tag> [filterSubstr...]
//       第四个及以后的参数为产物名过滤子串（只处理匹配的 artifact）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [token, runId, tag, ...filters] = process.argv.slice(2);
const repo = "ZXCWT666/deepseek-harness-desktop";
const api = `https://api.github.com/repos/${repo}`;
const h = { Authorization: `token ${token}`, "User-Agent": "dsh-rel", Accept: "application/vnd.github+json" };
const work = path.join(os.tmpdir(), "dsh-artifacts");
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

async function apiFetch(url, opts = {}, tries = 5, timeoutMs = 600000) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetch(url, { ...opts, headers: { ...h, ...(opts.headers || {}) }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      last = e;
      console.log(`  retry ${i}/${tries} ${url.slice(0, 80)}...`);
      await new Promise((r) => setTimeout(r, 6000 * i));
    }
  }
  throw last;
}

const arts = await (await apiFetch(`${api}/actions/runs/${runId}/artifacts`)).json();
const rel = await (await apiFetch(`${api}/releases/tags/${tag}`)).json();
const existing = new Set(rel.assets.map((a) => a.name));

for (const a of arts.artifacts) {
  if (a.expired) continue;
  if (filters.length > 0 && !filters.some((f) => a.name.includes(f))) { console.log("skip (filter):", a.name); continue; }
  console.log("==> artifact:", a.name);
  const zipPath = path.join(work, a.name + ".zip");
  const res = await apiFetch(`${api}/actions/artifacts/${a.id}/zip`);
  fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  const dir = path.join(work, a.name);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Force '${zipPath}' '${dir}'`], { stdio: "inherit" });
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => /\.(exe|AppImage|deb|dmg)$/i.test(f));
  for (const f of files) {
    const full = path.join(dir, f);
    const name = path.basename(f);
    if (existing.has(name)) { console.log("  skip (exists):", name); continue; }
    console.log("  upload:", name);
    const up = await apiFetch(`https://uploads.github.com/repos/${repo}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: fs.readFileSync(full),
    });
    const j = await up.json();
    console.log("   ->", j.browser_download_url || JSON.stringify(j).slice(0, 160));
  }
}
console.log("done");
