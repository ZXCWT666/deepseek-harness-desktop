import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const js = fs.readFileSync(path.resolve(here, "..", "shell", "main.js"), "utf8");
const m = js.match(/const WINDOW_UI_SCRIPT = `([\s\S]*?)`;/);
if (!m) throw new Error("WINDOW_UI_SCRIPT not found");
const uiScript = m[1];

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100vh;background:#151517}
body{padding-top:30px}
#root{height:calc(100vh - 30px)}
</style></head><body>
<div id="root"></div>
<script>
${uiScript}
</script>
<div role="dialog" aria-modal="true" style="position:fixed;inset:0;background:rgba(0,0,0,.6)">
  <button id="fake-close" style="position:fixed;top:20px;right:20px;width:36px;height:36px;border-radius:999px;background:#222;border:1px solid #555;color:#fff;font-size:18px">×</button>
</div>
</body></html>`;

const tmp = process.env.TEMP.replace(/\\/g, "/");
const pagePath = process.env.TEMP + "/strip-test.html";
fs.writeFileSync(pagePath, page);
try {
  const dom = execFileSync("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless", "--disable-gpu", "--window-size=1509,949",
    "--virtual-time-budget=2500", "--dump-dom",
    "file:///" + tmp + "/strip-test.html",
  ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const hit = dom.match(/id="dsh-topstrip"[^>]*style="([^"]*)"/);
  const ctl = dom.match(/id="dsh-winctl"[^>]*style="([^"]*)"/);
  console.log("dsh-topstrip style:", hit ? hit[1] : "NOT FOUND");
  console.log("dsh-winctl style:", ctl ? ctl[1] : "NOT FOUND");
  // 30px 顶部偏移必须以内联 !important 生效（body 样式属性中应出现 padding-top: 30px）
  const bodyStyle = dom.match(/<body([^>]*)>/);
  console.log("body tag:", bodyStyle ? bodyStyle[1].replace(/ style="([^"]*)"/, ' style="[ $1 ]"') : "NOT FOUND");
  const okPad = /padding-top:\s*30px/.test(bodyStyle ? bodyStyle[1] : "");
  const okImp = /!important/.test(bodyStyle ? bodyStyle[1] : "");
  console.log("body inline padding-top 30px:", okPad, "| !important:", okImp);
} catch (e) {
  console.log("ERROR", e.message);
}
