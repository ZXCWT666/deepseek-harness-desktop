(() => {
  const sb = document.querySelector('[class*="sidebarCol" i]');
  if (!sb) return 'NO SIDEBAR';
  const dump = (el, d, max) => {
    if (d > max) return '';
    let s = ' '.repeat(d * 2) + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '');
    const r = el.getBoundingClientRect();
    s += ' [' + Math.round(r.width) + 'x' + Math.round(r.height) + '@' + Math.round(r.left) + ',' + Math.round(r.top) + ']';
    const txt = Array.from(el.childNodes).filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent.trim()).join(' ');
    if (txt) s += ' "' + txt.slice(0, 70) + '"';
    s += '\n';
    for (const c of el.children) s += dump(c, d + 1, max);
    return s;
  };
  return dump(sb, 0, 5);
})()
