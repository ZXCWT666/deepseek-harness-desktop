(() => {
  // 打开设置页 → 检查三键/空条；再关闭 → 再检查
  const btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === '设置');
  if (!btn) return 'no settings btn';
  btn.click();
  return 'clicked settings';
})()
