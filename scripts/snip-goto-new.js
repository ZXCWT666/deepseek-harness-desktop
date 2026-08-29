(() => {
  // 点侧边栏「新会话」按钮，看能否离开设置页
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === '新会话');
  if (!btn) return 'no new-session button';
  const r = btn.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return 'button not visible, rect=' + JSON.stringify([r.width, r.height]);
  btn.click();
  return 'clicked, rect=' + JSON.stringify([Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]);
})()
