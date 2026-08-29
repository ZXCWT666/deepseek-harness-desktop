(() => {
  const strip = document.getElementById('dsh-topstrip');
  const side = document.getElementById('dsh-topstrip-side');
  const col = document.querySelector('[class*="sidebarCol" i]');
  const ctl = document.getElementById('dsh-winctl');
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"],[class*="modal"],[class*="lightbox"]')).filter(el => {
    const r = el.getBoundingClientRect(); return r.width > 300 && r.height > 200;
  }).map(el => ({ tag: el.tagName, cls: String(el.className).slice(0, 80), rect: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)] }));
  return {
    strip: strip ? { display: getComputedStyle(strip).display, h: strip.getBoundingClientRect().height } : 'no strip',
    side: side ? { inlineW: side.style.width, rectW: side.getBoundingClientRect().width, display: getComputedStyle(side).display } : 'no side',
    col: col ? { w: col.getBoundingClientRect().width, h: col.getBoundingClientRect().height } : 'no col',
    ctl: ctl ? { display: ctl.style.display, rect: [Math.round(ctl.getBoundingClientRect().width), Math.round(ctl.getBoundingClientRect().height)] } : 'no ctl',
    dialogs: dialogs,
    currentView: document.body.textContent.includes('通用设置') ? 'settings' : document.body.textContent.includes('探索未至之境') ? 'new-session' : 'other',
  };
})()
