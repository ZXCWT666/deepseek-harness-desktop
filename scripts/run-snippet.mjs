const wsUrl = process.argv[2];
const snipFile = process.argv[3] || 'snip-diag.js';
const fs = await import('node:fs');
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
function send(m, p) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); }); }
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
};
const evalJS = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
ws.onopen = async () => {
  try {
    console.log(JSON.stringify(await evalJS(fs.readFileSync('D:/dsh/scripts/' + snipFile, 'utf8')), null, 1));
    process.exit(0);
  } catch (e) { console.error("ERR", e.message); process.exit(1); }
};
ws.onerror = (e) => { console.error("WS ERROR", e.message || String(e)); process.exit(1); };
