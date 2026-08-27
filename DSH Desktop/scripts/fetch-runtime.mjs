// DSH Desktop 三平台运行时获取：下载官方 Node 并安装 @deepseek-ai/dsh 依赖到 runtime\
// 产物结构（与 shell\main.js bundledRuntime() 的约定一致）：
//   runtime\node\node(.exe)            —— 官方 Node 运行时（单文件）
//   runtime\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js  —— dsh CLI 及依赖树
// 用法：node scripts/fetch-runtime.mjs [--platform win32|linux|darwin] [--arch x64|arm64]
//       缺省 = 当前平台/架构（CI 在各系统原生执行，保证原生模块匹配）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const NODE_VERSION = process.env.DSH_BUNDLED_NODE || "v26.7.0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(root, "runtime");
const nodeDir = path.join(runtimeDir, "node");
const dshDir = path.join(runtimeDir, "dsh");

const args = process.argv.slice(2);
const argOf = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const platform = argOf("--platform") || process.platform;
const arch = argOf("--arch") || process.arch.replace("ia32", "x86").replace("x64", "x64");
const nodeExe = platform === "win32" ? "node.exe" : "node";

function fail(msg) {
  console.error("fetch-runtime:", msg);
  process.exit(1);
}
async function download(url, dest) {
  console.log("  download", url);
  const res = await fetch(url);
  if (!res.ok) fail(`HTTP ${res.status} for ${url}`);
  const tmp = dest + ".part";
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  fs.renameSync(tmp, dest);
}

async function extract(archive, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (archive.endsWith(".zip")) {
    const { execFileSync } = await import("node:child_process");
    // PowerShell Expand-Archive 对 zip 即可（跨平台 CI 用系统 unzip/bsdtar）
    if (platform === "win32") {
      spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -Force '${archive}' '${destDir}'`], { stdio: "inherit" });
    } else {
      spawnSync("unzip", ["-o", "-q", archive, "-d", destDir], { stdio: "inherit" });
    }
  } else {
    spawnSync("tar", ["-xJf", archive, "-C", destDir], { stdio: "inherit" });
  }
  if (fs.existsSync(path.join(destDir, "nul"))) fs.rmSync(path.join(destDir, "nul"), { force: true });
  // 官方 tar 包解出 node-vX.Y.Z-<platform>-<arch>/ 一层目录
  const inner = fs.readdirSync(destDir).find((d) => d.startsWith("node-v") && fs.statSync(path.join(destDir, d)).isDirectory());
  return inner ? path.join(destDir, inner) : destDir;
}

// ---------- 1) Node 运行时 ----------
// nodejs.org 归档命名：Windows 用 win-x64（注意不是 win32-x64），Linux/mac 用 linux-x64 / darwin-x64 / darwin-arm64
const nodeKey = platform === "win32" ? `win-${arch}` : `${platform}-${arch}`;
const ext = platform === "win32" ? "zip" : "tar.xz";
const nodeUrl = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${nodeKey}.${ext}`;
console.log(`==> Node ${NODE_VERSION} (${nodeKey})`);
const dlDir = path.join(runtimeDir, ".download");
fs.mkdirSync(dlDir, { recursive: true });
const archive = path.join(dlDir, `node-${NODE_VERSION}-${nodeKey}.${ext}`);
if (!fs.existsSync(archive)) await download(nodeUrl, archive);

fs.rmSync(nodeDir, { recursive: true, force: true });
const inner = await extract(archive, dlDir);
// Windows zip：node.exe 在解包根目录；Linux/mac tar.xz：bin/node（官方 tar 包布局）
const srcNode = [path.join(inner, nodeExe), path.join(inner, "bin", nodeExe)].find((p) => fs.existsSync(p));
if (!srcNode) fail(`node binary not found in ${inner}`);
fs.mkdirSync(nodeDir, { recursive: true });
fs.copyFileSync(srcNode, path.join(nodeDir, nodeExe));
if (platform !== "win32") fs.chmodSync(path.join(nodeDir, nodeExe), 0o755);
console.log(`==> node -> runtime/node/${nodeExe}`);

// ---------- 2) dsh 依赖树 ----------
console.log("==> npm install @deepseek-ai/dsh (native deps for current platform)");
fs.rmSync(dshDir, { recursive: true, force: true });
fs.mkdirSync(dshDir, { recursive: true });
fs.writeFileSync(path.join(dshDir, "package.json"), JSON.stringify({ name: "dsh-bundled", private: true, dependencies: { "@deepseek-ai/dsh": "latest" } }, null, 2));
const npm = platform === "win32" ? "npm.cmd" : "npm";
const npmExe = spawnSync("where", ["npm.cmd"], { encoding: "utf8" }).status === 0 ? "npm.cmd" : "npm";
// macOS arm64 runner 内存较小，dsh 依赖树安装会触发 Node 堆 OOM：放大堆上限
const npmEnv = { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" };
const r = spawnSync(npmExe, ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: dshDir, stdio: "inherit", shell: platform === "win32", env: npmEnv });
if (r.status !== 0) fail(`npm install failed (${r.status})`);
if (!fs.existsSync(path.join(dshDir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"))) fail("dsh bundle missing after install");

// ---------- 3) 校验 ----------
const probe = spawnSync(path.join(nodeDir, nodeExe), ["--version"], { encoding: "utf8" });
if (probe.status !== 0) fail("bundled node cannot run");
const dshProbe = spawnSync(path.join(nodeDir, nodeExe), [path.join(dshDir, "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"), "--version"], { encoding: "utf8" });
console.log(`==> bundled node ${probe.stdout.trim()} | dsh ${dshProbe.stdout.trim() || "(version ok)"}`);
console.log("==> runtime ready:", runtimeDir);
fs.rmSync(dlDir, { recursive: true, force: true });
