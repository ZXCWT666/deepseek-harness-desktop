import fs from "node:fs";
import { execFileSync } from "node:child_process";
// verify the installed asar script syntax
const asar = "C:/Users/USER/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";
const b = fs.readFileSync(asar);
const L = b.readUInt32LE(12);
const h = JSON.parse(b.subarray(16, 16 + L).toString());
const e = h.files["main.js"];
const t = b.subarray(16 + L + Number(e.offset), 16 + L + Number(e.offset) + Number(e.size)).toString();
const m = t.match(/const WINDOW_UI_SCRIPT = `([\s\S]*?)`;/);
try {
  new Function(m[1]);
  console.log("installed WINDOW_UI_SCRIPT syntax: OK, len", m[1].length, "| main.js len", t.length);
} catch (err) {
  console.log("installed SYNTAX ERROR:", err.message);
}
