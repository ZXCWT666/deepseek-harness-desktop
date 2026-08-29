(() => {
  // 模拟图片查看器：fixed inset 0 的全屏 role=dialog
  const d = document.createElement('div');
  d.id = 'fake-lightbox';
  d.setAttribute('role', 'dialog');
  d.setAttribute('aria-modal', 'true');
  d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1';
  document.body.appendChild(d);
  return 'fake fullscreen dialog added';
})()
