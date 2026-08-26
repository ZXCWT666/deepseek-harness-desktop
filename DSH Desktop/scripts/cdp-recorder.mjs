// CDP 采样器 v2：逐帧记录三键/空条状态，配合窗口操作复现"闪"的瞬间
const wsUrl = process.argv[2];
const durationMs = Number(process.argv[3] || 45000);
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  }
};
ws.onopen = async () => {
  try {
    await send("Runtime.evaluate", { expression: "1+1", returnByValue: true });
    console.log("CDP connected");
    await send("Runtime.evaluate", {
      expression: `(() => {
        window.__rec = []; window.__recOn = true;
        const tick = () => {
          if (!window.__recOn) return;
          const c = document.getElementById('dsh-winctl');
          const st = document.getElementById('dsh-topstrip');
          const r = c ? c.getBoundingClientRect() : null;
          window.__rec.push([
            Math.round(performance.now()),
            c ? (c.style.display || 'flex') : 'gone',
            r ? Math.round(r.left) : -1,
            r ? Math.round(r.top) : -1,
            st ? (st.style.display || '') : 'gone'
          ]);
          if (window.__rec.length > 60000) window.__rec.splice(0, 30000);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return 'recorder installed';
      })()`,
      returnByValue: true,
    });
    console.log("recorder installed");
    setTimeout(async () => {
      const r = await send("Runtime.evaluate", {
        expression: `(function(){ window.__recOn = false; return JSON.stringify(window.__rec); })()`,
        returnByValue: true,
      });
      console.log("REC_START");
      console.log(r.result.value);
      console.log("REC_END");
      process.exit(0);
    }, durationMs);
  } catch (e) {
    console.error("ERR", e.message);
    process.exit(1);
  }
};
ws.onerror = (e) => { console.error("WS ERROR:", e.message || String(e)); };
ws.onclose = (e) => { console.error("WS CLOSED:", e.code, e.reason || ""); };
