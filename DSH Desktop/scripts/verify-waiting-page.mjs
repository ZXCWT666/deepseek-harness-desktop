import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const shell = path.resolve(here, "..", "shell");
const mark = fs.readFileSync(path.join(shell, "assets/brand-mark.svg"), "utf8");
const name = fs.readFileSync(path.join(shell, "assets/brand-name.svg"), "utf8");

const html = `<!doctype html><html><head><meta charset="utf-8"><title>DeepSeek Harness</title>
<style>html,body{margin:0;height:100vh;background:#0f1218}
.screen{height:100vh;display:flex;align-items:center;justify-content:center}
.brand{display:flex;align-items:center;gap:clamp(6px,1vw,14px);color:#f0f4fa;
animation:breathe 3.4s ease-in-out infinite;will-change:opacity,filter}
.brand svg{height:clamp(46px,8.5vh,104px);width:auto;flex:0 0 auto;display:block}
@keyframes breathe{0%,100%{opacity:1;filter:brightness(1.06)}50%{opacity:.4;filter:brightness(.66)}}</style></head>
<body><div class="screen">
<div class="brand">${mark}${name}</div>
</div></body></html>`;

const tmp = process.env.TEMP.replace(/\\/g, "/");
fs.writeFileSync(process.env.TEMP + "/waiting-fixed.html", html);
execFileSync("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless", "--disable-gpu", "--window-size=1509,949",
  "--screenshot=" + process.env.TEMP + "/waiting-fixed.png",
  "file:///" + tmp + "/waiting-fixed.html",
], { stdio: "ignore" });
console.log("rendered waiting-fixed.png");
