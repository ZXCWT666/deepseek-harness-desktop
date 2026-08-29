(() => {
  const sb = document.querySelector('[class*="sidebarCol" i]');
  if (!sb) return 'sidebarCol gone';
  const strip = document.getElementById('dsh-topstrip-side');
  const out = [];
  sb.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if (el.scrollHeight > el.clientHeight + 4 && cs.overflowY !== 'visible') out.push({ cls: String(el.className).slice(0, 110), sh: el.scrollHeight, ch: el.clientHeight });
  });
  return { colW: sb.getBoundingClientRect().width, colH: sb.getBoundingClientRect().height, stripW: strip ? strip.getBoundingClientRect().width : 'no strip', scrollers: out.slice(0, 8) };
})()
