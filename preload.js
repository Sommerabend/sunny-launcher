const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sunnyDesktop', {
  getPaths: () => ipcRenderer.invoke('get-paths'),
  chooseInstallFolder: () => ipcRenderer.invoke('choose-install-folder'),
  installGame: game => ipcRenderer.invoke('install-game', game),
  launchInstalledGame: game => ipcRenderer.invoke('launch-installed-game', game),
  openFolder: folder => ipcRenderer.invoke('open-folder', folder),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  createDesktopShortcut: target => ipcRenderer.invoke('create-desktop-shortcut', target),
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  localAI: prompt => ipcRenderer.invoke('local-ai', prompt),
  localAISetup: () => ipcRenderer.invoke('local-ai-setup'),
  onDownloadProgress: fn => ipcRenderer.on('download-progress', (_, data) => fn(data)),
  onDownloadStart: fn => ipcRenderer.on('download-start', (_, data) => fn(data)),
  onDownloadComplete: fn => ipcRenderer.on('download-complete', (_, data) => fn(data)),
  onDownloadError: fn => ipcRenderer.on('download-error', (_, data) => fn(data))
});
