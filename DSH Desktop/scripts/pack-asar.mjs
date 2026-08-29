import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Rebuild app.asar preserving the canonical layout observed from the shipped app:
//   u32(4) u32(4+4+L) u32(4+L) u32(L) JSON(pad4) [payload]
// file entries: {"size":n,"offset":"<relative-to-payload-start>"} grouped by dir.

const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.resolve(here, "..");
const shellDir = process.argv[3] || path.join(base, "shell");
const out = process.argv[2] || path.join(base, "artifacts", "app.asar");

// Version baked into package.json.
const pkgPath = path.join(shellDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

// Ordered, relative POSIX paths (dirs first in the same order the original used).
const order = [
  "assets/brand-mark.svg",
  "assets/brand-name.svg",
  "assets/tray.png",
  "main.js",
  "preload.js",
  "package.json",
];

// Build the JSON tree.
function mkTree() {
  const root = { files: {} };
  for (const rel of order) {
    const parts = rel.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.files[parts[i]]) node.files[parts[i]] = { files: {} };
      node = node.files[parts[i]];
    }
    const bytes = fs.readFileSync(path.join(shellDir, ...parts));
    node.files[parts[parts.length - 1]] = { size: bytes.length, offset: "pending" };
  }
  return root;
}

const tree = mkTree();
// Payload offsets in order.
let payloadLen = 0;
const parts = [];
for (const rel of order) {
  const partsArr = rel.split("/");
  let node = tree;
  for (let i = 0; i < partsArr.length - 1; i++) node = node.files[partsArr[i]];
  const bytes = fs.readFileSync(path.join(shellDir, ...partsArr));
  node.files[partsArr[partsArr.length - 1]].offset = String(payloadLen);
  parts.push(bytes);
  payloadLen += bytes.length;
}

const json = Buffer.from(JSON.stringify(tree), "utf8");
const L = json.length;
const header = Buffer.alloc(16);
header.writeUInt32LE(4, 0);
header.writeUInt32LE(4 + 4 + L, 4);
header.writeUInt32LE(4 + L, 8);
header.writeUInt32LE(L, 12);
const file = Buffer.concat([header, json, ...parts]);
fs.writeFileSync(out, file);
console.log("wrote", out, file.length, "bytes; json", L);

// --- verify: re-read with the same reader used for extraction ---
const buf = fs.readFileSync(out);
const jl = buf.readUInt32LE(12);
const hdr = JSON.parse(buf.subarray(16, 16 + jl).toString());
function walk(n, p) {
  if (n.files) for (const k of Object.keys(n.files)) walk(n.files[k], p + "/" + k);
  else console.log("  verify", p, "offset", n.offset, "size", n.size);
}
walk(hdr, "");
for (const rel of order) {
  const partsArr = rel.split("/");
  let node = hdr;
  for (let i = 0; i < partsArr.length - 1; i++) node = node.files[partsArr[i]];
  const entry = node.files[partsArr[partsArr.length - 1]];
  const actual = buf.subarray(16 + jl + Number(entry.offset), 16 + jl + Number(entry.offset) + Number(entry.size));
  const expected = fs.readFileSync(path.join(shellDir, ...partsArr));
  if (Buffer.compare(actual, expected) !== 0) throw new Error("MISMATCH " + rel);
  console.log("  bytes ok:", rel, actual.length);
}
console.log("asar round-trip verified");
