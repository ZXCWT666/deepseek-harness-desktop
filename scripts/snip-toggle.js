(() => {
  const btns = Array.from(document.querySelectorAll('button'));
  const target = btns.find(x => (x.getAttribute('aria-label') || '').match(/panel|sidebar|fold|收起|侧边/i))
    || btns.find(x => String(x.className).match(/Panel|panel/i))
    || btns.find(x => /panel|sidebar|side.*bar|面板/i.test(x.title || ''));
  if (!target) return 'no toggle found; buttons: ' + btns.slice(0, 40).map((x, i) => i + ':' + (x.getAttribute('aria-label') || x.title || String(x.className).slice(0, 25))).join(' | ');
  target.click();
  return 'toggled: ' + (target.getAttribute('aria-label') || target.title || target.className);
})()
