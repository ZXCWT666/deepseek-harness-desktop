import fs from "node:fs";
import path from "node:path";
const b = fs.readFileSync(process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", "resources", "app.asar")
  : "");
const L = b.readUInt32LE(12);
const h = JSON.parse(b.subarray(16, 16 + L).toString());
const e = h.files["main.js"];
const t = b.subarray(16 + L + Number(e.offset), 16 + L + Number(e.offset) + Number(e.size)).toString();
const m = t.match(/const WINDOW_UI_SCRIPT = `([\s\S]*?)`;/);
try { new Function(m[1]); console.log("syntax OK"); } catch (err) { console.log("SYNTAX ERROR:", err.message); }
console.log("fixed right placement:", t.includes("if (ctl.style.right !== '16px')"));
console.log("pill scan removed:", !t.includes("pillRef"));
console.log("main.js len:", t.length);
