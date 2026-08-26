'use strict';

/**
 * DeepSeek Harness 桌面端（纯壳封装 + 服务自愈）
 *
 * 原则（零改动）：
 *   本文件不修改、不注入 Web 端的任何代码——BrowserWindow 直接加载
 *   DSH Web 服务地址（默认 http://127.0.0.1:3080/），页面 UI 与功能
 *   与浏览器中打开的 Web 端完全一致。本地等待页仅在服务不可用时短暂显示，
 *   不参与 Web 页面本身。
 *
 * 服务策略（v1.3.0，纯客户端 + 静默自愈）：
 *   - 桌面端不“拥有”3080 端口：服务可能由 Harness 环境 / 用户 / 桌面端任一
 *     方提供，可能随时被外部回收（实测 dsh web 进程会被外部以
 *     exit code 4294967295/-1 强制终止，随后由外部另起一个接替）。
 *   - 后台检查器（每 1.5s）只做三件事：
 *       1) 服务可达 → 若窗口停留在等待页则自动加载正式页面；
 *       2) 服务不可达 & 没有任何服务进程 → 按递增退避（3s→60s 封顶）静默重启；
 *       3) 自己的进程被外部终止 → 不与之对抗，改用现有服务或继续退避重试。
 *   - 服务恢复后自动重新加载页面；整个过程不弹“服务已停止”类阻塞对话框
 *     （仅当 Node.js / DeepSeek Harness 安装都找不到时提示一次）。
 *   - 退出时只清理“由桌面端启动且仍在运行”的进程；先于桌面端运行的服务不受影响。
 *
 *   服务安装位置发现顺序：
 *     1) %LOCALAPPDATA%\npm-cache\_npx\*\node_modules\@deepseek-ai\dsh（取最新）
 *     2) %APPDATA%\npm\node_modules\@deepseek-ai\dsh（npm 全局安装）
 *     3) PATH 中的 `dsh`（兜底）
 *
 * 环境变量（均可选）：
 *   DSH_DESKTOP_URL               目标 Web 地址（默认 http://127.0.0.1:3080/）
 *   DSH_DESKTOP_SERVER_CMD        显式指定自动启动命令（覆盖自动发现）
 *   DSH_DESKTOP_SERVER_CWD        服务进程的工作目录（默认用户主目录）
 *   DSH_DESKTOP_SERVER_PORT       追加 --port 参数（测试/避让端口用）
 *   DSH_DESKTOP_NO_AUTOSTART      设为 1 时禁用自动启动，仅加载页面
 *   DSH_SMOKE_TEST                设为 1 时进入冒烟测试：加载成功后截图并退出
 *   DSH_SMOKE_OUT                 冒烟测试截图输出路径（默认 smoke-test.png）
 */

const { app, BrowserWindow, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

// ---------- 配置 ----------
const APP_URL = process.env.DSH_DESKTOP_URL || 'http://127.0.0.1:3080/';
const AUTO_START = process.env.DSH_DESKTOP_NO_AUTOSTART !== '1';
const SERVER_CWD = process.env.DSH_DESKTOP_SERVER_CWD || os.homedir();
const SERVER_PORT = process.env.DSH_DESKTOP_SERVER_PORT || '';
const SMOKE_TEST = process.env.DSH_SMOKE_TEST === '1';
const SMOKE_OUT = process.env.DSH_SMOKE_OUT || 'smoke-test.png';
const SMOKE_ANY = process.env.DSH_SMOKE_ANY === '1'; // 冒烟也截图等待页（本地化验证用）
const SMOKE_SETTINGS = process.env.DSH_SMOKE_SETTINGS === '1'; // 冒烟先打开设置页再截图
const CHECK_INTERVAL_MS = 1500;
const BACKOFF_INITIAL_MS = 3000;
const BACKOFF_MAX_MS = 60000;
const LOADING_TIMEOUT_MS = 30000;
let appOrigin = '';
try {
  appOrigin = new URL(APP_URL).origin;
} catch {
  appOrigin = APP_URL;
}

// ---------- 状态 ----------
let mainWindow = null;
let serverProc = null;         // 由桌面端启动的服务进程（原生命令，需 taskkill /T 清理）
let serverStartedAt = 0;       // 上次由桌面端拉起服务的时间
let serverStartedByUs = false;
let shuttingDown = false;
let checking = false;          // 检查器重入保护
let backoffMs = BACKOFF_INITIAL_MS;
let setupWarned = false;       // “未找到安装”提示只弹一次
let checker = null;
let lastTickAt = 0;
let attemptCount = 0;          // 等待页展示的重试次数
let lastErr = '';
let tray = null;               // 系统托盘
let quitting = false;          // 真正退出（关闭时最小化到托盘开关生效时区分）
let settings = { autostart: false, closeToTray: true };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function serverLogPath() {
  return path.join(app.getPath('userData'), 'server.log');
}

// ---------- 服务安装位置发现 ----------

function findDshInNpxCache() {
  const roots = [];
  if (process.env.LOCALAPPDATA) roots.push(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'));
  roots.push(path.join(os.homedir(), '.npm', '_npx'));
  let best = null;
  let bestMtime = 0;
  for (const cache of roots) {
    if (!fs.existsSync(cache)) continue;
    for (const entry of fs.readdirSync(cache)) {
      const bin = path.join(cache, entry, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
      if (fs.existsSync(bin)) {
        try {
          const m = fs.statSync(bin).mtimeMs;
          if (m > bestMtime) { best = bin; bestMtime = m; }
        } catch { /* ignore */ }
      }
    }
  }
  return best;
}

function findDshInGlobalNpm() {
  const roots = [];
  if (process.env.APPDATA) roots.push(path.join(process.env.APPDATA, 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
  roots.push('/usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js');
  roots.push('/usr/lib/node_modules/@deepseek-ai/dsh/lib/bin.js');
  for (const root of roots) {
    if (root && fs.existsSync(root)) return root;
  }
  return null;
}

function findNodeExe() {
  try {
    const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
    const r = spawnSync(cmd, ['node'], { windowsHide: true, encoding: 'utf8' });
    if (r.status === 0 && r.stdout) {
      const first = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean)[0];
      if (first && (first.endsWith('node.exe') || first.endsWith('node'))) return first;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * 内置运行时（完全自包含）：打包了 Node 运行时与 dsh 依赖树，
 * 无需本机安装 Node / dsh 即可运行。非 Windows 返回 null。
 */
function bundledRuntime() {
  if (process.platform !== 'win32') return null;
  const root = app.isPackaged ? process.resourcesPath : path.join(__dirname, 'resources');
  const node = path.join(root, 'node', 'node.exe');
  const bin = path.join(root, 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
  return fs.existsSync(node) && fs.existsSync(bin) ? { node, bin } : null;
}

function resolveServerCommand() {
  if (process.env.DSH_DESKTOP_SERVER_CMD) {
    return { cmd: process.env.DSH_DESKTOP_SERVER_CMD, args: [], shell: true, hint: 'env override' };
  }
  // 优先使用内置运行时（无需外部 Node/dsh 安装）
  const built = bundledRuntime();
  if (built) {
    const args = [built.bin, 'web', '--no-open'];
    if (SERVER_PORT) args.push('--port', String(SERVER_PORT));
    return { cmd: built.node, args, shell: false, hint: 'bundled' };
  }
  const node = findNodeExe();
  const bin = findDshInNpxCache() || findDshInGlobalNpm();
  if (node && bin) {
    const args = [bin, 'web', '--no-open'];
    if (SERVER_PORT) args.push('--port', String(SERVER_PORT));
    return { cmd: node, args, shell: false, hint: 'discovery' };
  }
  return { cmd: SERVER_PORT ? `dsh web --no-open --port ${SERVER_PORT}` : 'dsh web --no-open', args: [], shell: true, hint: 'PATH fallback' };
}

// ---------- 服务管理 ----------

function pingServer(timeoutMs = 700) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
    try {
      const req = http.get(APP_URL, { timeout: timeoutMs }, (res) => {
        res.resume();
        done(true);
      });
      req.on('timeout', () => { req.destroy(); done(false); });
      req.on('error', () => done(false));
    } catch {
      done(false);
    }
  });
}

function startServer() {
  if (!AUTO_START) return null;
  const { cmd, args, shell, hint } = resolveServerCommand();
  const log = serverLogPath();
  try { fs.mkdirSync(path.dirname(log), { recursive: true }); } catch { /* ignore */ }
  const out = fs.openSync(log, 'a');
  fs.writeSync(out, `\n[${new Date().toISOString()}] starting: ${cmd} ${args.join(' ')} (cwd=${SERVER_CWD}) [${hint}]\n`);
  const proc = spawn(cmd, args, {
    cwd: SERVER_CWD,
    shell,
    windowsHide: true,
    env: process.env,
    stdio: ['ignore', out, out]
  });
  proc.on('error', (err) => {
    lastErr = `spawn: ${err.message}`;
    try { fs.writeSync(out, `spawn error: ${err.message}\n`); } catch { /* ignore */ }
    if (serverProc === proc) serverProc = null;
  });
  proc.on('exit', (code, signal) => {
    try { fs.writeSync(out, `[${new Date().toISOString()}] exited code=${code} signal=${signal}\n`); } catch { /* ignore */ }
    if (serverProc === proc) serverProc = null;
    // 不在这里重启：交给后台检查器判断（可能已被外部服务接替，无需对抗）
  });
  serverProc = proc;
  serverStartedByUs = true;
  serverStartedAt = Date.now();
  return proc;
}

function killServerTree() {
  const proc = serverProc;
  if (!proc) return;
  serverProc = null;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
    } else {
      proc.kill('SIGKILL');
    }
  } catch { /* ignore */ }
}

// ---------- 等待页（官方品牌 logo + 呼吸动画） ----------

function brandSvg(file) {
  try {
    return fs.readFileSync(path.join(__dirname, 'assets', file), 'utf8');
  } catch { return ''; }
}

function waitingPageHtml() {
  const mark = brandSvg('brand-mark.svg');
  const name = brandSvg('brand-name.svg');
  const logo =
    mark && name
      ? `<div class="brand">${mark}${name}</div>`
      : `<div class="brand"><span style="font-size:34px;font-weight:600;color:#e8edf6">DeepSeek Harness</span></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>DeepSeek Harness</title>
<style>html,body{margin:0;height:100vh;background:#0f1218}
.screen{height:100vh;display:flex;align-items:center;justify-content:center}
.brand{display:flex;align-items:center;gap:clamp(6px,1vw,14px);color:#f0f4fa;
animation:breathe 3.4s ease-in-out infinite;will-change:opacity,filter}
.brand svg{height:clamp(46px,8.5vh,104px);width:auto;flex:0 0 auto;display:block}
@keyframes breathe{0%,100%{opacity:1;filter:brightness(1.06)}50%{opacity:.4;filter:brightness(.66)}}</style></head>
<body><div class="screen">
<div class="brand">${logo}</div>
</div></body></html>`;
}
const LOADING_URL = 'data:text/html;charset=utf-8,' + encodeURIComponent(waitingPageHtml());

function currentUrl() {
  try { return mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getURL() : ''; } catch { return ''; }
}
const isWaitingPage = (u) => u.startsWith('data:text/html');
const isMainPage = (u) => u.startsWith(appOrigin);

function loadWaitingPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const u = currentUrl();
  if (isWaitingPage(u)) return;
  mainWindow.loadURL(LOADING_URL).catch(() => {});
}

function loadMainPage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const u = currentUrl();
  if (isMainPage(u)) return;
  mainWindow.loadURL(APP_URL).catch(() => {});
}

function updateWaitingStatus(text) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const u = currentUrl();
  if (!isWaitingPage(u)) return;
  mainWindow.webContents.executeJavaScript(`window.__dshStatus && window.__dshStatus(${JSON.stringify(text)});`).catch(() => {});
}

// ---------- 后台检查器（静默自愈） ----------

async function checkOnce() {
  if (checking || shuttingDown || !mainWindow || mainWindow.isDestroyed()) return;
  checking = true;
  try {
    lastTickAt = Date.now();
    const ok = await pingServer(800);
    if (ok) {
      backoffMs = BACKOFF_INITIAL_MS;
      if (!isMainPage(currentUrl())) loadMainPage(); // 服务可用（无论由谁提供）→ 自动进入
      return;
    }
    // 服务不可达
    if (serverProc) {
      // 自己的进程还在但迟迟没有监听（超过 10s）→ 杀掉检查器重启，避免死等
      if (Date.now() - serverStartedAt > 10000) {
        lastErr = '进程存在但 10 秒内未监听';
        killServerTree();
      } else {
        loadWaitingPage();
        updateWaitingStatus('服务启动中…');
        return;
      }
    }
    loadWaitingPage();
    if (!AUTO_START) {
      updateWaitingStatus('未连接，自动启动已禁用');
      return;
    }
    if (Date.now() - lastSpawnAt() > backoffMs) {
      attemptCount++;
      updateWaitingStatus(`第 ${attemptCount} 次尝试启动服务…`);
      startServer();
      _lastSpawnAt = Date.now();
      backoffMs = Math.min(backoffMs * 1.8, BACKOFF_MAX_MS);
      const { hint } = resolveServerCommand();
      if (hint === 'PATH fallback' && !setupWarned) {
        warnSetupOnce('未找到 DeepSeek Harness 安装（Node.js / @deepseek-ai/dsh）');
      }
    } else {
      updateWaitingStatus(`等待退避后自动重试（第 ${attemptCount} 次已尝试）${lastErr ? '，' + lastErr : ''}`);
    }
  } finally {
    checking = false;
  }
}

let _lastSpawnAt = 0;
function lastSpawnAt() {
  return _lastSpawnAt;
}
function forceRetry() {
  backoffMs = BACKOFF_INITIAL_MS;
  _lastSpawnAt = 0;
  attemptCount = 0;
  killServerTree(); // 清掉自己残留的进程实例（等待页可见说明当前服务不可达）
  checkOnce();
}

function warnSetupOnce(title) {
  if (setupWarned || shuttingDown) return;
  setupWarned = true;
  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title,
    message: '无法自动启动 DeepSeek Harness 服务。',
    detail:
      `请确认本机安装了 Node.js 与 DeepSeek Harness（npx @deepseek-ai/dsh 或 npm 全局安装）。\n` +
      `桌面端会持续静默重试，服务就绪后自动进入。\n日志：${serverLogPath()}`,
    buttons: ['继续等待', '退出'],
    defaultId: 0,
    cancelId: 1
  }).then(({ response }) => {
    if (response === 1) app.quit();
  });
}

function startChecker() {
  if (checker) return;
  checker = setInterval(() => { checkOnce(); }, CHECK_INTERVAL_MS);
  checkOnce();
}

// ---------- 托盘 + 开机自启 + 设置持久化（跨平台） ----------

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (typeof raw.autostart === 'boolean') settings.autostart = raw.autostart;
    if (typeof raw.closeToTray === 'boolean') settings.closeToTray = raw.closeToTray;
  } catch { /* 首次运行无配置文件 */ }
}

function saveSettings() {
  try {
    const p = settingsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(settings, null, 2));
  } catch { /* ignore */ }
}

/** 把当前设置状态推送到页面（设置卡片开关状态同步） */
function pushSettingsState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents
    .executeJavaScript(
      `window.__dshSetState && window.__dshSetState(${JSON.stringify({ autostart: settings.autostart, closeToTray: settings.closeToTray })});`
    )
    .catch(() => {});
}

/** 推送窗口最大化状态（内置窗口按钮图标同步） */
function pushWinState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents
    .executeJavaScript(`window.__dshWinMax && window.__dshWinMax(${mainWindow.isMaximized()});`)
    .catch(() => {});
}

/** 设置页面卡片发来的开关变更（app://dshsetting/<key>/<0|1>） */
function applySettingFromPage(key, value) {
  if (key === 'autostart') {
    settings.autostart = value === '1';
    saveSettings();
    applyAutostart();
  } else if (key === 'closeToTray') {
    settings.closeToTray = value === '1';
    saveSettings();
  } else {
    return;
  }
  try { tray.setContextMenu(buildTrayMenu()); } catch { /* ignore */ }
  pushSettingsState();
}

/** 开机自启：Windows/macOS 走原生 API；Linux 写 ~/.config/autostart 桌面项 */
function applyAutostart() {
  try {
    if (process.platform === 'linux') {
      const dir = path.join(os.homedir(), '.config', 'autostart');
      const file = path.join(dir, 'deepseek-harness.desktop');
      if (settings.autostart) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          file,
          '[Desktop Entry]\nType=Application\nName=DeepSeek Harness\n' +
            `Exec="${process.execPath}"\nX-GNOME-Autostart-enabled=true\nComment=DeepSeek Harness Desktop\n`
        );
      } else {
        try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
      }
    } else {
      app.setLoginItemSettings({ openAtLogin: settings.autostart });
    }
  } catch { /* ignore */ }
}

function trayIcon() {
  const p = path.join(__dirname, 'assets', 'tray.png');
  try {
    const img = nativeImage.createFromPath(p);
    if (!img.isEmpty()) return img;
  } catch { /* ignore */ }
  return nativeImage.createEmpty();
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]);
}

function createTray() {
  if (tray) return;
  try {
    tray = new Tray(trayIcon());
    tray.setToolTip('DeepSeek Harness');
    tray.setContextMenu(buildTrayMenu());
    tray.on('click', () => showMainWindow()); // Windows/macOS 单击托盘显示窗口
  } catch { /* 无托盘环境（部分 Linux 桌面）不影响使用 */ }
}

// ---------- UI 本地化覆盖（仅桌面端视觉层，不修改服务端/页面代码） ----------

/**
 * 在页面内执行的本地化脚本：
 *  - 删除“预览版”徽标；
 *  - 权限三选项（Full access / Read only / Workspace Write）→ 中文；
 *  - 推理等级（Low / Medium / High / Max）→ 中文（低/中/高/最高）。
 * 策略：精确匹配文本节点；控件/弹窗（button、select、option、dialog、menu、
 * menuitem、listbox、tooltip、aria-label、title 等）内做子串替换；
 * 跳过代码块/输入区（pre/code/script/style/textarea/input、contenteditable），
 * 避免误改聊天内容。MutationObserver 持续覆盖动态渲染的界面。
 */
const UI_LOCALIZE_SCRIPT = `(function () {
  if (window.__dshUiLocInstalled) return;
  window.__dshUiLocInstalled = true;
  // 精确匹配（下拉项/标签）：大小写不敏感；译文经谷歌翻译确认并沿用界面既有译法
  var EXACT = {
    'low': '低', 'medium': '中', 'high': '高', 'max': '最高',
    'off': '关闭', 'ask': '询问',
    'read only': '只读', 'read-only': '只读'
  };
  // 控件/弹窗内子串替换：多词短语 + 单词（词边界），均大小写不敏感
  var PHRASES = [['full access', '完全访问'], ['read only', '只读'], ['workspace write', '工作区写入']];
  var WORDS = { 'low': '低', 'medium': '中', 'high': '高', 'max': '最高', 'off': '关闭', 'ask': '询问' };
  function isProtected(el) {
    var e = el;
    for (var n = 0; n < 6 && e; n++) {
      var tg = e.tagName;
      if (tg === 'PRE' || tg === 'CODE' || tg === 'SCRIPT' || tg === 'STYLE' || tg === 'TEXTAREA' || tg === 'INPUT') return true;
      if (e.isContentEditable) return true;
      e = e.parentElement;
    }
    return false;
  }
  function isUiChrome(el) {
    var e = el;
    for (var n = 0; n < 10 && e; n++) {
      var tg = (e.tagName || '').toLowerCase();
      if (tg === 'button' || tg === 'select' || tg === 'option' || tg === 'a') return true;
      if (e.getAttribute) {
        var role = e.getAttribute('role');
        if (role === 'dialog' || role === 'menu' || role === 'menuitem' || role === 'listbox' || role === 'tooltip' || role === 'button') return true;
        if (e.hasAttribute('aria-label') || e.hasAttribute('title')) return true;
      }
      e = e.parentElement;
    }
    return false;
  }
  function rewrite(node) {
    var data = node.data;
    var t = data.trim();
    var el = node.parentElement;
    var prot = !el || isProtected(el);
    if (t === '预览版') {
      if (el && el.textContent.trim() === '预览版') { el.style.display = 'none'; }
      else { node.data = ''; }
      return;
    }
    if (!prot && Object.prototype.hasOwnProperty.call(EXACT, t.toLowerCase())) {
      node.data = data.replace(t, EXACT[t.toLowerCase()]);
      return;
    }
    if (!prot && isUiChrome(el)) {
      var nd = data, changed = false, i, k;
      for (i = 0; i < PHRASES.length; i++) {
        var re = new RegExp(PHRASES[i][0], 'gi');
        if (re.test(nd)) { nd = nd.replace(re, PHRASES[i][1]); changed = true; }
      }
      for (k in WORDS) {
        var re2 = new RegExp('\\b' + k + '\\b', 'gi');
        if (re2.test(nd)) { nd = nd.replace(re2, WORDS[k]); changed = true; }
      }
      if (changed) node.data = nd;
    }
  }
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) { rewrite(node); return; }
    if (node.nodeType !== 1) return;
    for (var n = node.firstChild; n; n = n.nextSibling) walk(n);
  }
  // ---------- 桌面端设置卡片（通用设置面板顶部） ----------
  window.__dshSettingsState = null;
  window.__dshSetState = function (s) {
    window.__dshSettingsState = s;
    var keys = { autostart: 'dsh-ast', closeToTray: 'dsh-tray' };
    for (var k in keys) {
      var b = document.getElementById(keys[k]);
      if (b && b.childNodes && b.childNodes.length) {
        b.dataset.on = s && s[k] ? '1' : '0';
        b.childNodes[0].nodeValue = s && s[k] ? '开启' : '关闭';
      }
    }
  };
  function mountSettingsCard() {
    if (document.getElementById('dsh-desktop-settings')) return;
    function leafOf(text) {
      var all = document.querySelectorAll('*');
      var hit = null;
      for (var i = all.length - 1; i >= 0; i--) {
        var el = all[i];
        if (el.childElementCount > 0) continue;
        if ((el.textContent || '').trim() === text) { hit = el; break; }
      }
      return hit;
    }
    function commonAncestor(a, b) {
      var p = a.parentElement;
      while (p && !p.contains(b)) p = p.parentElement;
      return p;
    }
    // 单次扫描同时定位两个锚点（导航“通用设置” + 面板独有行“权限”），避免重复全 DOM 扫描
    var navLeaf = null;
    var rowLeaf = null;
    var allNodes = document.querySelectorAll('*');
    for (var i = allNodes.length - 1; i >= 0; i--) {
      var el = allNodes[i];
      if (el.childElementCount > 0) continue;
      var txt = (el.textContent || '').trim();
      if (txt === '通用设置' || txt === 'General') { if (!navLeaf) navLeaf = el; }
      else if (txt === '权限') { if (!rowLeaf) rowLeaf = el; }
      if (navLeaf && rowLeaf) break;
    }
    if (!navLeaf || !rowLeaf) return;
    var root = commonAncestor(navLeaf, rowLeaf);
    if (!root || root.tagName === 'BODY') return;
    var panel = rowLeaf;
    for (var up = 0; up < 8 && panel.parentElement && panel.parentElement !== root; up++) {
      panel = panel.parentElement;
    }
    if (panel === root) return;
    // 采样官方行列的实时计算样式，保证字体/间距 1:1 对齐（主题无关）
    function sample(el, props) {
      if (!el) return null;
      var cs = window.getComputedStyle(el);
      var o = {};
      for (var i = 0; i < props.length; i++) o[props[i]] = cs[props[i]];
      return o;
    }
    function applyStyle(el, style) {
      if (!style) return;
      for (var k in style) {
        try { el.style[k] = style[k]; } catch (e) {}
      }
    }
    var tProps = ['fontSize', 'fontWeight', 'lineHeight', 'fontFamily', 'letterSpacing', 'color'];
    var headStyle = sample(leafOf('Agent 预设'), tProps);
    var titleStyle = sample(rowLeaf, tProps);
    var descStyle = sample(leafOf('选择新会话的默认权限模式'), tProps);
    // 从标题向上找带底部分隔线的“行容器”，采样它的 padding 与边框（与官方行 1:1）
    var rowBox = rowLeaf.parentElement;
    for (var rb = 0; rb < 6 && rowBox; rb++) {
      var cs2 = window.getComputedStyle(rowBox);
      try { if (parseFloat(cs2.borderBottomWidth) > 0) break; } catch (e) {}
      rowBox = rowBox.parentElement;
    }
    var rowCS = rowBox ? window.getComputedStyle(rowBox) : null;
    var rowPadT = rowCS ? rowCS.paddingTop : '16px';
    var rowPadB = rowCS ? rowCS.paddingBottom : '16px';
    var bColor = rowCS ? rowCS.borderBottomColor : '';
    var bStyle = rowCS ? rowCS.borderBottomStyle : '';
    var bWidth = rowCS ? rowCS.borderBottomWidth : '';
    // 标题与描述之间的列内间距（官方文字块的 gap）
    var textBlock = rowLeaf.parentElement;
    var textGap = textBlock && textBlock.style ? window.getComputedStyle(textBlock).rowGap : '4px';
    if (!textGap || textGap === 'normal') textGap = '4px';
    // 与下方官方行水平对齐：采样官方行/选择器相对面板的左右偏移，套用到卡片
    var padL = '0px';
    var padR = '0px';
    try {
      var panelRect = panel.getBoundingClientRect();
      var offRect = rowLeaf.getBoundingClientRect();
      padL = Math.max(offRect.left - panelRect.left, 0) + 'px';
      if (rowBox) {
        var rowBoxRect = rowBox.getBoundingClientRect();
        padR = Math.max(panelRect.right - rowBoxRect.right, 0) + 'px';
      }
    } catch (e) {}
    var st = window.__dshSettingsState || {};
    var card = document.createElement('div');
    card.id = 'dsh-desktop-settings';
    card.style.cssText = 'display:flex;flex-direction:column;padding-left:' + padL + ';padding-right:' + padR + ';';
    var head = document.createElement('div');
    head.textContent = '桌面端设置';
    applyStyle(head, headStyle);
    head.style.paddingTop = rowPadT;
    head.style.paddingBottom = rowPadB;
    card.appendChild(head);
    function mkRow(key, id, title, desc) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:12px;min-width:0;' +
        'padding:' + rowPadT + ' 0 ' + rowPadB + ';';
      if (bColor && bWidth) row.style.borderBottom = bWidth + ' ' + bStyle + ' ' + bColor;
      var tx = document.createElement('div');
      tx.style.cssText = 'display:flex;flex-direction:column;gap:' + textGap + ';min-width:0;flex:1;';
      var t2 = document.createElement('div');
      t2.textContent = title;
      applyStyle(t2, titleStyle);
      var d = document.createElement('div');
      d.textContent = desc;
      applyStyle(d, descStyle);
      if (descStyle) d.style.color = 'var(--dsw-alias-label-tertiary,#8a94a6)';
      tx.appendChild(t2);
      tx.appendChild(d);
      row.appendChild(tx);
      // 右侧选择器（与“权限”行同款的胶囊按钮 + 下拉选项）
      var sel = document.createElement('button');
      sel.type = 'button';
      sel.id = id;
      sel.className = 'dsh-sel';
      sel.dataset.key = key;
      sel.dataset.on = st && st[key] ? '1' : '0';
      sel.textContent = st && st[key] ? '开启' : '关闭';
      // 官方同款箭头（14x14 svg，源自权限选择器）
      var chev = document.createElement('span');
      chev.className = 'dsh-chevron';
      chev.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z" fill="currentColor"></path></svg>';
      chev.style.cssText = 'display:inline-flex;margin-left:6px;color:var(--dsw-alias-label-tertiary,#8a94a6)';
      sel.appendChild(chev);
      sel.addEventListener('click', function () { toggleSelMenu(sel, key); });
      row.appendChild(sel);
      return row;
    }
    // 下拉菜单（开启/关闭 + 当前项 ✓）
    var openMenu = null;
    function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
    function toggleSelMenu(sel, key) {
      closeMenu();
      var r = sel.getBoundingClientRect();
      var curOn = !!(window.__dshSettingsState && window.__dshSettingsState[key]);
      var menu = document.createElement('div');
      menu.className = 'dsh-menu';
      menu.style.cssText =
        'position:fixed;z-index:2147483645;min-width:142px;' +
        'background:var(--dsw-alias-bg-module-platform,#262b33);' +
        'border:1px solid var(--dsw-alias-border-l2,#39414e);' +
        'border-radius:12px;padding:4px;' +
        'box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:inherit';
      function mkItem(label, on) {
        var it = document.createElement('div');
        it.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;gap:8px;' +
          'padding:8px 10px;border-radius:8px;' +
          'font-size:14px;line-height:22px;font-weight:400;' +
          'color:#f9fafb;cursor:pointer;white-space:nowrap';
        var span = document.createElement('span');
        span.textContent = label;
        it.appendChild(span);
        if (on === curOn) {
          var ck = document.createElement('span');
          ck.textContent = '\\u2713';
          ck.style.cssText = 'color:#f9fafb;font-size:14px;line-height:22px';
          it.appendChild(ck);
        }
        it.addEventListener('mouseenter', function () { it.style.background = 'var(--dsw-alias-interactive-bg-hover,#2a3340)'; });
        it.addEventListener('mouseleave', function () { it.style.background = 'transparent'; });
        it.addEventListener('click', function (e) {
          e.stopPropagation();
          closeMenu();
          if (curOn !== on) location.href = 'app://dshsetting/' + key + '/' + (on ? 1 : 0);
        });
        return it;
      }
      menu.appendChild(mkItem('开启', true));
      menu.appendChild(mkItem('关闭', false));
      var left = Math.min(r.left, window.innerWidth - 152);
      var top = r.bottom + 4;
      if (top + 110 > window.innerHeight) top = Math.max(8, r.top - 110);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      document.body.appendChild(menu);
      openMenu = menu;
      setTimeout(function () {
        document.addEventListener('click', function handler(ev) {
          if (!openMenu) return;
          if (openMenu.contains(ev.target)) return;
          // 选择器按钮自带开合逻辑：跳过，避免点击其他选择器时新菜单被立刻关闭
          if (ev.target && ev.target.closest && ev.target.closest('.dsh-sel')) return;
          document.removeEventListener('click', handler);
          closeMenu();
        });
      }, 0);
    }
    card.appendChild(mkRow('autostart', 'dsh-ast', '开机自动启动', '开机后自动启动 DeepSeek Harness'));
    card.appendChild(mkRow('closeToTray', 'dsh-tray', '关闭时最小化到托盘', '关闭窗口时隐藏到系统托盘，应用在后台驻留'));
    // 选择器样式（与官方胶囊按钮 1:1：36px 高、18px 圆角、14px 字、12px 内距、同 font-family）
    if (!document.getElementById('dsh-settings-css')) {
      var as = document.createElement('style');
      as.id = 'dsh-settings-css';
      as.textContent =
        '.dsh-sel{background:var(--dsw-alias-bg-module-platform,#35363a);height:36px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB",' +
        '"Microsoft YaHei","Helvetica Neue",Helvetica,Arial,sans-serif;' +
        'color:var(--dsw-alias-label-primary,#f9fafb);cursor:pointer;border:none;border-radius:18px;' +
        'align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex;flex:0 0 auto}' +
        '.dsh-sel:hover{background:var(--dsw-alias-interactive-bg-hover,#2a3340)}';
      document.head.appendChild(as);
    }
    panel.insertBefore(card, panel.children[0]);
  }
  // 桌面端设置卡片：仅在“通用设置”分区激活时显示，其余分区（模型/插件/Agent 预设）隐藏
  function syncCardVisibility() {
    var card = document.getElementById('dsh-desktop-settings');
    if (!card) return;
    var all = document.querySelectorAll('*');
    var active = false;
    for (var i = all.length - 1; i >= 0; i--) {
      var n = all[i];
      if (n.childElementCount > 0) continue;
      var t = (n.textContent || '').trim();
      if (t === '通用设置' || t === 'General') {
        var b = n.closest('button') || n.closest('[aria-current]') || n;
        var cls = String(b.className || '');
        var cur = b.getAttribute && b.getAttribute('aria-current');
        if (cur === 'true' || /active/i.test(cls)) active = true;
        break;
      }
    }
    card.style.display = active ? '' : 'none';
  }
  // 事件驱动同步（不再周期扫描）：DOM/aria-current/class 变化时 80ms 防抖
  // 一并完成“挂载（React 重建后恢复）”与“分区可见性”，渲染风暴只处理一次
  var cardSyncTimer = null;
  function scheduleCardSync() {
    if (cardSyncTimer) return;
    cardSyncTimer = setTimeout(function () {
      cardSyncTimer = null;
      mountSettingsCard();
      syncCardVisibility();
    }, 00);
  }
  try {
    new MutationObserver(scheduleCardSync).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current', 'class']
    });
  } catch (e) {}
  scheduleCardSync();
  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    walk(document.body);
    scheduleCardSync();
    try {
      var mo = new MutationObserver(function (ms) {
        scheduleCardSync();
        for (var i = 0; i < ms.length; i++) {
          if (ms[i].type === 'characterData') { walk(ms[i].target); continue; }
          var a = ms[i].addedNodes;
          for (var j = 0; j < a.length; j++) walk(a[j]);
        }
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }
  start();
})();`;

/**
 * 内置窗口控制（无边框窗口，样式融合进软件内部）：
 * 三键为悬浮控件，悬浮于页头下方右侧空白区，不占用页面布局（与 web 端
 * 页面 1:1，不推挤任何页头元素）；侧边栏品牌 logo 作为拖动把手；
 * 图片查看器等全屏弹层打开时自动隐藏控件。
 */
const WINDOW_UI_SCRIPT = `(function () {
  if (window.__dshWinUiInstalled) return;
  window.__dshWinUiInstalled = true;
  var ctl = null;
  function mk(id, label, title) {
    var b = document.createElement('button');
    b.id = id;
    b.innerHTML = label;
    b.title = title;
    b.style.cssText =
      'width:36px;height:28px;border:none;border-radius:7px;background:transparent;' +
      'color:var(--dsw-alias-label-primary,#e8eaed);padding:0;cursor:pointer;display:inline-flex;' +
      'align-items:center;justify-content:center';
    b.addEventListener('click', function () {
      location.href = 'app://win/' + id.replace('dsh-win-', '');
    });
    return b;
  }
  function hideCheck() {
    if (!ctl) return;
    var els = document.querySelectorAll('[role="dialog"],[class*="lightbox"],[class*="modal"],[class*="viewer"]');
    var hide = false;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === ctl || el.contains(ctl)) continue;
      var r = el.getBoundingClientRect();
      if (r.width > 300 && r.height > 200) { hide = true; break; }
    }
    ctl.style.display = hide ? 'none' : 'flex';
    // 全屏弹层（图片查看器等）打开时同步隐藏顶部 30px 空条背景：空条是桌面端
    // 覆盖层，会遮住弹层顶部的自身控件（如图片查看器右上角关闭按钮 top:20px
    // 的上半部分被空条裁掉）。空条隐藏后该区域露出弹层的遮罩层，视觉连续，
    // 关闭按钮完整可见；拖拽条仍保留，关闭弹层后空条恢复。
    var strip = document.getElementById('dsh-topstrip');
    if (strip) strip.style.display = hide ? 'none' : '';
  }
  function make() {
    if (!document.body) { setTimeout(make, 100); return; }
    if (document.getElementById('dsh-winctl')) return;
    ctl = document.createElement('div');
    ctl.id = 'dsh-winctl';
    ctl.style.cssText =
      'position:fixed;top:2px;right:8px;z-index:2147483646;display:flex;gap:4px;background:transparent';
    var min = mk('dsh-win-min', '<svg width="13" height="13" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><rect x="0.7" y="5.05" width="10.6" height="1.9" fill="currentColor"/></svg>', '最小化');
    var max = mk('dsh-win-max', '<svg width="13" height="13" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="10" height="10" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', '最大化/还原');
    var close = mk('dsh-win-close', '<svg width="13" height="13" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5 L10.5 10.5 M10.5 1.5 L1.5 10.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>', '关闭');
    min.addEventListener('mouseenter', function () { min.style.background = 'var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,0.08))'; });
    min.addEventListener('mouseleave', function () { min.style.background = 'transparent'; });
    max.addEventListener('mouseenter', function () { max.style.background = 'var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,0.08))'; });
    max.addEventListener('mouseleave', function () { max.style.background = 'transparent'; });
    close.addEventListener('mouseenter', function () {
      close.style.background = '#e81123'; close.style.color = '#ffffff';
    });
    close.addEventListener('mouseleave', function () {
      close.style.background = 'transparent'; close.style.color = 'var(--dsw-alias-label-primary,#e8eaed)';
    });
    ctl.appendChild(min); ctl.appendChild(max); ctl.appendChild(close);
    document.body.appendChild(ctl);
    // 页头上方 30px 空条（窗口边框向上延伸）：应用整体下移 30px，但页面内部
    // 布局不变（与 web 端相对布局 1:1）；三键放在空条内、Session log 胶囊正上方。
    if (!document.getElementById('dsh-topstrip-css')) {
      var st = document.createElement('style');
      st.id = 'dsh-topstrip-css';
      st.textContent =
        'html{overflow:hidden}' +
        'body{padding-top:30px;background:var(--dsw-alias-bg-base,#151517)}' +
        '#root{height:calc(100vh - 30px)}';
      document.head.appendChild(st);
    }
    // 页面顶部的 30px 偏移必须内联 + !important 兜底：Web 端样式表（静态 CSS 或
    // 客户端模块后期注入的样式）可能覆盖 body/#root 规则，导致内容整体上移、
    // 页头（标题/ Session log 胶囊）顶部被空条压住。内联 !important 优先级高于
    // 一切普通样式表，唯一失效条件是被页面重新写 body/#root 的内联样式，因此
    // 每次布局同步时重施一次。
    function applyTopPadding() {
      try {
        document.body.style.setProperty('padding-top', '30px', 'important');
        var root = document.getElementById('root');
        if (root) root.style.setProperty('height', 'calc(100vh - 30px)', 'important');
      } catch (e) {}
    }
    applyTopPadding();
    // 空条背景层：整体为应用基色，左侧按侧边栏延伸（背景 + 右边框线贯通空条）
    if (!document.getElementById('dsh-topstrip')) {
      var ts = document.createElement('div');
      ts.id = 'dsh-topstrip';
      ts.style.cssText =
        'position:fixed;top:0;left:0;right:0;height:30px;z-index:2147483644;' +
        'pointer-events:none;background:var(--dsw-alias-bg-base,#151517)';
      var tsSide = document.createElement('div');
      tsSide.id = 'dsh-topstrip-side';
      tsSide.style.cssText =
        'position:absolute;top:0;left:0;bottom:0;width:280px;box-sizing:border-box;' +
        'background:var(--dsw-specific-sidebar-fill,var(--dsw-alias-bg-base,#151517));' +
        'border-right:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08))';
      ts.appendChild(tsSide);
      document.body.appendChild(ts);
    }
    // 全宽顶部拖拽条（透明、避开三键区域）：空条内任意位置都可推动窗口
    if (!document.getElementById('dsh-dragstrip')) {
      var strip = document.createElement('div');
      strip.id = 'dsh-dragstrip';
      strip.style.cssText =
        'position:fixed;top:0;left:0;right:160px;height:30px;z-index:2147483645;' +
        '-webkit-app-region:drag;background:transparent';
      document.body.appendChild(strip);
    }
    // 放置并持续校正三键位置：三键固定在空条内（top:2px），水平中心对齐
    // Session log 胶囊中心；不推挤页头任何元素。找不到胶囊时靠右上角。
    // React 可能重渲染头部行，因此每次布局同步都重施样式并重算位置。
    // 空条背景 = --dsw-alias-bg-base（主题变量在 body 上解析，浅#fff/深#151517，
    // 主题切换后 var() 自动重算，空条始终与内部背景一致）；侧边栏延伸段宽度
    // 每次同步按实际侧边栏宽度校正（含折叠为图标栏的情况）。
    function syncStripSide() {
      try {
        var col = document.querySelector('[class*="sidebarCol"]');
        var side = document.getElementById('dsh-topstrip-side');
        if (!col || !side) return;
        var w = Math.round(col.getBoundingClientRect().width);
        if (!(w > 30)) w = 280;
        var bw = w + 'px';
        if (side.style.width !== bw) side.style.width = bw;
      } catch (e) {}
    }
    var pillRef = null;
    function placeWinCtl() {
      if (!ctl) return;
      syncStripSide();
      if (pillRef && pillRef.isConnected) {
        var rx = pillRef.getBoundingClientRect();
        ctl.style.top = '2px';
        ctl.style.left = (rx.left + rx.width / 2 - 58) + 'px';
        ctl.style.right = 'auto';
        return;
      }
      pillRef = null;
      var all = document.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var n = all[i];
        if (n.childElementCount !== 0) continue;
        if ((n.textContent || '').trim() === 'Session log') {
          var pill = n.closest('button') || n;
          var r = pill.getBoundingClientRect();
          ctl.style.top = '2px';
          ctl.style.left = (r.left + r.width / 2 - 58) + 'px';
          ctl.style.right = 'auto';
          pillRef = pill;
          break;
        }
      }
      // 未找到锚点时固定回右上角默认位置
      if (!pillRef) { ctl.style.top = '2px'; ctl.style.left = ''; ctl.style.right = '8px'; }
    }
    placeWinCtl();
    // 事件驱动：DOM 变化时（防抖 120ms）重算三键位置与弹层显示，不再高频全 DOM 扫描
    var winSyncTimer = null;
    function scheduleWinSync() {
      if (winSyncTimer) return;
      winSyncTimer = setTimeout(function () {
        winSyncTimer = null;
        applyTopPadding();
        placeWinCtl();
        hideCheck();
      }, 120);
    }
    try {
      new MutationObserver(scheduleWinSync).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    // 低频兜底校正：缓存引用直接取 rect（无需全 DOM 扫描）
    setInterval(function () {
      if (!pillRef && ctl) {
        // 尚未定位到 Session log（可能还未渲染）：重新扫描（代价较高，仅未定位时执行）
        placeWinCtl();
      }
    }, 1500);
    // 侧边栏品牌 logo 作为拖动把手（不遮挡任何交互元素）
    try {
      var brand = document.querySelector('[class*="brandIdentity"]');
      if (brand) brand.style.webkitAppRegion = 'drag';
    } catch (e) {}
  }
  make();
  window.__dshWinMax = function (m) {
    var b = document.getElementById('dsh-win-max');
    if (b) {
      b.innerHTML = m
        ? '<svg width="13" height="13" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><rect x="0.9" y="4.2" width="6.9" height="6.9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.2 4.2 V2.8 A1.2 1.2 0 0 1 5.4 1.6 H9.6 A1.2 1.2 0 0 1 10.8 2.8 V7 A1.2 1.2 0 0 1 9.6 8.2 H8.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
        : '<svg width="13" height="13" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="10" height="10" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    }
  };
})();`;

// ---------- 窗口 ----------

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 900,
    minHeight: 600,
    title: 'DeepSeek Harness',
    frame: false, // 无边框：窗口控制由内置按钮承担（注入于页面顶部）
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  win.on('maximize', () => pushWinState());
  win.on('unmaximize', () => pushWinState());

  win.once('ready-to-show', () => win.show());

  // 固定窗口标题：页面会动态更新 document.title（如“会话名——DeepSeek Harness”），
  // 这里拦截标题更新并主动纠正，保持桌面窗口标题恒定（页面行为不受影响）
  win.setTitle('DeepSeek Harness');
  win.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    try { win.setTitle('DeepSeek Harness'); } catch { /* ignore */ }
  });
  const titleGuard = setInterval(() => {
    if (win.isDestroyed()) { clearInterval(titleGuard); return; }
    if (win.getTitle() !== 'DeepSeek Harness') win.setTitle('DeepSeek Harness');
  }, 500);
  win.on('closed', () => clearInterval(titleGuard));

  // 关闭时最小化到托盘（用户可开关）：关闭按钮 → 隐藏窗口，应用驻留托盘
  win.on('close', (event) => {
    if (settings.closeToTray && !quitting && !SMOKE_TEST) {
      event.preventDefault();
      win.hide();
    }
  });

  // 页面中的 target=_blank / window.open 链接交给系统默认浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // 等待页“立即重试”按钮：app://retry → 立即触发检查与启动；
  // 设置卡片开关：app://dshsetting/<key>/<0|1> → 应用设置；
  // 内置窗口按钮：app://win/<min|max|close>
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('app://retry')) {
      event.preventDefault();
      forceRetry();
      return;
    }
    const mSetting = /^app:\/\/dshsetting\/(autostart|closeToTray)\/([01])$/.exec(url);
    if (mSetting) {
      event.preventDefault();
      applySettingFromPage(mSetting[1], mSetting[2]);
      return;
    }
    const mWin = /^app:\/\/win\/(min|max|close)$/.exec(url);
    if (mWin) {
      event.preventDefault();
      if (mWin[1] === 'min') {
        win.minimize();
      } else if (mWin[1] === 'max') {
        if (win.isMaximized()) win.unmaximize(); else win.maximize();
      } else {
        win.close(); // 尊重“关闭时最小化到托盘”设置
      }
    }
  });

  // 主框架加载失败不弹窗：交给检查器自愈（等服务就绪自动重载）
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (SMOKE_TEST) {
      console.error(`SMOKE_FAIL ${errorCode} ${errorDescription}`);
      app.exit(2);
      return;
    }
    loadWaitingPage();
  });

  // 每次加载正式页面后注入 UI 覆盖（本地化 + 设置卡片 + 内置窗口控制）并推送状态
  win.webContents.on('did-finish-load', () => {
    const u = win.webContents.getURL();
    if (!/^https?:/i.test(u)) return; // 忽略 data: 等待页
    win.webContents.executeJavaScript(UI_LOCALIZE_SCRIPT).catch(() => {});
    win.webContents.executeJavaScript(WINDOW_UI_SCRIPT).catch(() => {});
    pushSettingsState();
    pushWinState();
  });

  // 冒烟测试：加载真正的页面后截图并退出（截图前不干扰页面）
  if (SMOKE_TEST) {
    win.webContents.on('did-finish-load', async () => {
      const u = win.webContents.getURL();
      const isReal = /^https?:/i.test(u);
      const isWaiting = u.startsWith('data:text/html');
      if (!isReal && !(SMOKE_ANY && isWaiting)) return; // 默认忽略 data: 等待页
      try {
        await sleep(1500);
        if (SMOKE_SETTINGS && isReal) {
          const clicked = await win.webContents.executeJavaScript(`(() => {
            const els = Array.from(document.querySelectorAll('*'));
            const leaf = els.find((n) => n.childElementCount === 0 && (n.textContent || '').trim() === '设置');
            if (!leaf) return false;
            const btn = leaf.closest('button') || leaf.closest('[role="button"]') || leaf;
            btn.click();
            return true;
          })()`);
          if (clicked) await sleep(2600); // 等待设置页渲染 + 桌面端设置卡片挂载
        }
        if (SMOKE_SETTINGS && isReal) {
          const st = await win.webContents
            .executeJavaScript(
              `({ st: window.__dshSettingsState, ast: (document.getElementById('dsh-ast') || {}).dataset ? document.getElementById('dsh-ast').dataset.on : undefined, tray: (document.getElementById('dsh-tray') || {}).dataset ? document.getElementById('dsh-tray').dataset.on : undefined })`
            )
            .catch(() => null);
          console.log('CARDSTATE ' + JSON.stringify(st));
        }
        const image = await win.webContents.capturePage();
        const winbar = await win.webContents
          .executeJavaScript(
            `(() => { const b = document.getElementById('dsh-winctl'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: r.top, left: r.left, w: r.width, h: r.height, btns: b.querySelectorAll('button').length, visible: b.style.display !== 'none' }; })()`
          )
          .catch(() => null);
        console.log('WINBAR ' + JSON.stringify(winbar));
        fs.writeFileSync(SMOKE_OUT, image.toPNG());
        console.log(`SMOKE_OK ${SMOKE_OUT}`);
        console.log('TITLE ' + win.getTitle());
        shuttingDown = true;
        killServerTree();
        app.exit(0);
      } catch (err) {
        console.error(`SMOKE_FAIL ${err.message}`);
        app.exit(2);
      }
    });
    setTimeout(() => {
      console.error('SMOKE_FAIL global-timeout');
      app.exit(2);
    }, 180000).unref();
  }

  // 立即探测并启动后台检查器（静默自愈）
  setImmediate(() => { _lastSpawnAt = 0; startChecker(); });

  return win;
}

// ---------- 应用生命周期 ----------
app.setAppUserModelId('com.deepseek.harness.desktop');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    loadSettings();
    applyAutostart();
    createTray();
    mainWindow = createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
      } else {
        showMainWindow();
      }
    });
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // 最小化到托盘开启时窗口只是隐藏（不会走到这里）；到这说明用户选择退出
      quitting = true;
      app.quit();
    }
  });

  // 退出前清理由桌面端启动且仍存活的进程（先于桌面端运行的服务不受影响）
  app.on('will-quit', () => {
    shuttingDown = true;
    if (checker) clearInterval(checker);
    killServerTree();
  });
}
