import fs from "node:fs";
// Usage: node check-asar.mjs [path-to-app.asar]
const asar = process.argv[2] || "C:/Users/USER/AppData/Local/Programs/DeepSeek Harness/resources/app.asar";
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
const name = read("assets/brand-name.svg");
console.log("brand-name.svg preserveAspectRatio:", name.includes('preserveAspectRatio="xMinYMin meet"'));
