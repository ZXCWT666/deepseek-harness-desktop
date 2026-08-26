import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const asar = process.argv[3] || "C:/Users/USER/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";
const buf = fs.readFileSync(asar);
const size = JSON.parse(buf.readUInt32LE(12));
const hdr = JSON.parse(buf.subarray(16, 16 + size).toString());

// Rebuild the asar entries (supporting unpacked files as real files if size==0? keep it simple).
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] || path.resolve(here, "..", "shell-extracted");
fs.mkdirSync(outDir, { recursive: true });

function walk(n, p) {
  if (n.files) {
    for (const k of Object.keys(n.files)) {
      const child = n.files[k];
      if (child.files) walk(child, p + "/" + k);
      else emit(child, p + "/" + k);
    }
  } else {
    emit(n, p);
  }
}
function emit(st, p) {
  const dest = path.join(outDir, p.replace(/^\//, ""));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const content = buf.subarray(16 + size + Number(st.offset), 16 + size + Number(st.offset) + Number(st.size));
  fs.writeFileSync(dest, content);
  console.log("extracted", p, st.size, "bytes");
}
walk(hdr, "");
// Also list the complete tree to stdout for verification
function list(n, p, depth) {
  if (n.files) {
    for (const k of Object.keys(n.files)) {
      console.log(" ".repeat(depth) + k + (n.files[k].files ? "/" : ` (${n.files[k].size})`));
      if (n.files[k].files) list(n.files[k], p + "/" + k, depth + 1);
    }
  }
}
console.log("--- asar tree ---");
list(hdr, "", 1);
console.log("--- done ---");
