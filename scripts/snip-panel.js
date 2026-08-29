(() => {
  const panel = document.querySelector('[class*="VOzbGW_panel"]');
  const info = { viewport: [window.innerWidth, window.innerHeight] };
  if (panel) {
    const r = panel.getBoundingClientRect();
    info.panel = { rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
    // 面板内的关闭按钮
    const close = panel.querySelector('button[aria-label*="close" i], [class*="close" i]');
    if (close) { const c = close.getBoundingClientRect(); info.panelClose = [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)]; }
    else info.panelClose = 'none';
  }
  return info;
})()
