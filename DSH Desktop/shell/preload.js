// DSH Desktop 预加载脚本（sandbox 模式）：仅暴露窗口拖拽所需的三个 IPC 通道。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__dshDeskDrag', {
  start: () => ipcRenderer.send('dsh-drag', 'start'),
  move: () => ipcRenderer.send('dsh-drag', 'move'),
  end: () => ipcRenderer.send('dsh-drag', 'end')
});
