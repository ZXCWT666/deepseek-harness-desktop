import fs from "node:fs";
const asar = "C:/Users/USER/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";
const b = fs.readFileSync(asar);
const L = b.readUInt32LE(12);
const h = JSON.parse(b.subarray(16, 16 + L).toString());
const e = h.files["main.js"];
const t = b.subarray(16 + L + Number(e.offset), 16 + L + Number(e.offset) + Number(e.size)).toString();
fs.writeFileSync("D:/dsh/running-main.js", t);
// extract WINDOW_UI_SCRIPT and syntax check it
const m = t.match(/const WINDOW_UI_SCRIPT = `([\s\S]*?)`;/);
if (!m) { console.log("WINDOW_UI_SCRIPT NOT FOUND"); process.exit(1); }
try {
  new Function(m[1]); // syntax check only, not executed
  console.log("WINDOW_UI_SCRIPT syntax: OK  (len", m[1].length + ")");
} catch (err) {
  console.log("WINDOW_UI_SCRIPT syntax ERROR:", err.message);
}
// also check UI_LOCALIZE_SCRIPT + whole main.js top-level syntax
try {
  new Function(t);
  console.log("main.js (as string) parses: OK");
} catch (err) {
  console.log("main.js parse ERROR:", err.message);
}
