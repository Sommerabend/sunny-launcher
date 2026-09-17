const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');

let win;
const downloads = new Map();

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: 'Sunny Launcher', backgroundColor: '#070a12', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}
function send(channel, payload) { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); }
function safeName(name) { return String(name || 'game').replace(/[^a-z0-9._-]/gi, '_').slice(0, 80); }
function downloadFile(url, destination, id) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination); let received = 0; let total = 0; let settled = false;
    const fail = err => { if (settled) return; settled = true; file.close(); try { fs.unlinkSync(destination); } catch {} downloads.delete(id); reject(err); };
    const request = target => {
      https.get(target, response => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) { response.resume(); request(new URL(response.headers.location, target).toString()); return; }
        if (response.statusCode !== 200) { response.resume(); fail(new Error(`HTTP ${response.statusCode}`)); return; }
        total = Number(response.headers['content-length'] || 0);
        response.on('data', chunk => { received += chunk.length; send('download-progress', { id, received, total, percent: total ? Math.round(received / total * 100) : 0 }); });
        response.pipe(file);
        file.on('finish', () => file.close(() => { if (settled) return; settled = true; downloads.delete(id); resolve(destination); }));
      }).on('error', fail);
    };
    downloads.set(id, { request, destination }); request(url);
  });
}
ipcMain.handle('get-paths', () => ({ appData: app.getPath('appData'), downloads: app.getPath('downloads'), desktop: app.getPath('desktop') }));
ipcMain.handle('choose-install-folder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Installationsordner auswählen' });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('install-game', async (_, game) => {
  if (!game || !game.downloadUrl) throw new Error('Kein Download-Link vorhanden.');
  const folder = game.installPath || path.join(app.getPath('appData'), 'SunnyLauncher', 'Games', safeName(game.id || game.title));
  fs.mkdirSync(folder, { recursive: true });
  const ext = game.fileName?.includes('.') ? path.extname(game.fileName) : '.exe';
  const filename = safeName(game.fileName || `${game.title || 'game'}${ext}`);
  const destination = path.join(folder, filename); const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  send('download-start', { id, title: game.title, path: folder });
  try {
    await downloadFile(game.downloadUrl, destination, id); send('download-complete', { id, title: game.title, path: destination });
    if (game.runInstaller && /\.exe$/i.test(destination)) spawn(destination, [], { detached: true, stdio: 'ignore' }).unref();
    return { ok: true, id, path: destination, installPath: folder };
  } catch (e) { send('download-error', { id, title: game.title, error: e.message }); throw e; }
});
ipcMain.handle('launch-installed-game', async (_, game) => { if (!game?.executablePath) throw new Error('Keine installierte EXE hinterlegt.'); if (!fs.existsSync(game.executablePath)) throw new Error('Die Spieldatei wurde nicht gefunden.'); spawn(game.executablePath, [], { detached: true, stdio: 'ignore' }).unref(); return true; });
ipcMain.handle('open-folder', async (_, folder) => { if (folder && fs.existsSync(folder)) await shell.openPath(folder); });
ipcMain.handle('open-external', async (_, url) => { if (/^https?:\/\//i.test(url)) await shell.openExternal(url); });
ipcMain.handle('create-desktop-shortcut', async (_, targetPath) => { if (!targetPath) targetPath = process.execPath; const shortcut = path.join(app.getPath('desktop'), 'Sunny Launcher.lnk'); const ok = shell.writeShortcutLink(shortcut, { target: targetPath, cwd: path.dirname(targetPath), description: 'Sunny Launcher' }); return { ok, shortcut }; });
ipcMain.handle('check-update', async () => ({ supported: true, currentVersion: app.getVersion() }));
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
