import fs from "node:fs";
import path from "node:path";
// Usage: node check-asar.mjs [path-to-app.asar]
const defaultAsar = () => process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", "resources", "app.asar")
  : "";
const asar = process.argv[2] || defaultAsar();
const b = fs.readFileSync(asar);
const L = b.readUInt32LE(12);
const hdr = JSON.parse(b.subarray(16, 16 + L).toString());
const read = (rel) => {
  let node = hdr;
  for (const k of rel.split("/")) {
    node = node.files?.[k];
    if (!node) throw new Error("not found: " + rel);
  }
  return b.subarray(16 + L + Number(node.offset), 16 + L + Number(node.offset) + Number(node.size)).toString();
};
const pkg = JSON.parse(read("package.json"));
console.log("asar pkg version:", pkg.version);
const main = read("main.js");
console.log("main.js has gap fix:", main.includes("gap:clamp(6px,1vw,14px)"));
console.log("main.js has strip fix:", main.includes("全屏弹层（图片查看器等）"));
console.log("main.js has settings-card defer fix:", main.includes("}, 00);"));
console.log("main.js has v1.1.3 keep-page fix:", main.includes("everLoadedMain"));
console.log("main.js has v1.1.3 port-probe fix:", main.includes("probePort"));
console.log("main.js has v1.1.3 ping-timeout fix:", main.includes("PING_TIMEOUT_MS"));
const name = read("assets/brand-name.svg");
console.log("brand-name.svg preserveAspectRatio:", name.includes('preserveAspectRatio="xMinYMin meet"'));
