const wsUrl = process.argv[2];
const fs = await import('node:fs');
const snippets = {
  structure: fs.readFileSync('D:/dsh/scripts/snip-structure.js', 'utf8'),
  toggle: fs.readFileSync('D:/dsh/scripts/snip-toggle.js', 'utf8'),
  roll: fs.readFileSync('D:/dsh/scripts/snip-roll.js', 'utf8'),
};
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
const errs = [];
function send(m, p) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); }); }
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(JSON.stringify(msg.error))) : p.res(msg.result); }
  else if (msg.method === "Runtime.exceptionThrown") errs.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
  else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errs.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
};
const evalJS = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

ws.onopen = async () => {
  try {
    await send("Runtime.enable");
    console.log("== A. 结构 ==");
    console.log(await evalJS(snippets.structure));
    console.log("== B. 滚动/布局 ==");
    console.log(JSON.stringify(await evalJS(snippets.roll)));
    console.log("== C. 折叠切换 ==");
    const before = await evalJS(`(() => { const c = document.querySelector('[class*="sidebarCol" i]'); return c ? c.getBoundingClientRect().width : -1; })()`);
    const toggled = await evalJS(snippets.toggle);
    console.log("before width:", before, "| toggle:", String(toggled).slice(0, 200));
    await new Promise((r) => setTimeout(r, 900));
    const after = await evalJS(snippets.roll);
    console.log("after toggle:", JSON.stringify(after));
    await new Promise((r) => setTimeout(r, 300));
    const restored = await evalJS(snippets.toggle);
    console.log("restore toggle:", String(restored).slice(0, 120));
    await new Promise((r) => setTimeout(r, 500));
    console.log("== D. 控制台错误 ==");
    console.log(errs.length ? errs.slice(0, 25).join('\n') : '(无)');
    console.log("DONE");
    process.exit(0);
  } catch (e) { console.error("ERR", e.message); process.exit(1); }
};
ws.onerror = (e) => { console.error("WS ERROR", e.message || String(e)); process.exit(1); };
