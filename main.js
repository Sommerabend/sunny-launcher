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
    title: 'Sunny Games Launcher', icon: path.join(__dirname, 'icon.ico'), backgroundColor: '#070a12', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.loadFile('index.html');
  win.webContents.on('did-finish-load', () => injectAccountFeatures());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function injectAccountFeatures() {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`(() => {
    if (window.__sunnyAccountFeatures) return;
    window.__sunnyAccountFeatures = true;

    const style = document.createElement('style');
    style.textContent = '.accountTools{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.accountBox{background:#101624;border:1px solid #293145;border-radius:14px;padding:18px;margin-bottom:18px}.accountBox h3{margin:0 0 6px}.accountBox p{color:#737e94;font-size:12px;margin:0}.dangerBtn{border:1px solid #66353d;background:#211319;color:#ff9b9b;padding:9px 14px;border-radius:10px;cursor:pointer}';
    document.head.appendChild(style);

    const accountModal = document.createElement('div');
    accountModal.id = 'account-modal'; accountModal.className = 'modal hidden';
    accountModal.innerHTML = '<div class="modalCard"><div class="modalHead"><div><div class="eyebrow">SUNNY ACCOUNT</div><h3>Konto erstellen</h3></div><button id="close-account">×</button></div><form id="account-form"><input id="account-username" autocomplete="username" placeholder="Benutzername" required minlength="3"><input id="account-email" type="email" autocomplete="email" placeholder="E-Mail-Adresse" required><input id="account-display" placeholder="Anzeigename"><input id="account-pass" type="password" autocomplete="new-password" placeholder="Passwort" required minlength="6"><input id="account-pass2" type="password" autocomplete="new-password" placeholder="Passwort wiederholen" required minlength="6"><button class="primary" type="submit">Account erstellen</button></form></div>';
    document.body.appendChild(accountModal);

    const settings = document.getElementById('settings');
    if (settings && !document.getElementById('account-settings-box')) {
      const box = document.createElement('div'); box.id='account-settings-box'; box.className='accountBox';
      box.innerHTML = '<h3>Mein Account</h3><p id="account-settings-info">Anmelden, um deine Account-Einstellungen zu verwalten.</p><div class="accountTools"><button class="secondary" id="create-account-btn">Account erstellen</button><button class="secondary hidden" id="edit-account-btn">Account bearbeiten</button><button class="dangerBtn hidden" id="logout-account-btn">Abmelden</button></div>';
      settings.insertBefore(box, settings.querySelector('.settingsPanel'));
    }

    const oldOpenRedeem = window.openRedeem;
    window.openRedeem = function(){
      if (!currentUser) { toast('Du musst angemeldet sein, um einen Key einzulösen.'); openLogin(); return; }
      oldOpenRedeem();
    };

    const createBtn = document.getElementById('create-account-btn');
    const editBtn = document.getElementById('edit-account-btn');
    const logoutBtn = document.getElementById('logout-account-btn');
    const info = document.getElementById('account-settings-info');
    const modal = accountModal;

    function refreshAccountBox(){
      const logged = !!currentUser;
      createBtn?.classList.toggle('hidden', logged);
      editBtn?.classList.toggle('hidden', !logged);
      logoutBtn?.classList.toggle('hidden', !logged);
      if (logged) info.textContent = 'Angemeldet als ' + (currentUserData?.displayName || currentUserData?.username || currentUser) + (currentUserData?.email ? ' · ' + currentUserData.email : '');
      else info.textContent = 'Anmelden, um deine Account-Einstellungen zu verwalten.';
    }

    createBtn?.addEventListener('click', () => { modal.querySelector('h3').textContent='Konto erstellen'; document.getElementById('account-form').reset(); modal.classList.remove('hidden'); document.getElementById('account-username').focus(); });
    document.getElementById('close-account')?.addEventListener('click', () => modal.classList.add('hidden'));
    logoutBtn?.addEventListener('click', () => window.logout());
    editBtn?.addEventListener('click', async () => {
      if (!currentUser) return openLogin();
      const display = prompt('Neuer Anzeigename:', currentUserData?.displayName || currentUserData?.username || '');
      if (display === null) return;
      const email = prompt('Neue E-Mail-Adresse:', currentUserData?.email || '');
      if (email === null) return;
      try {
        await db.collection('users').doc(currentUser).set({displayName: display.trim() || currentUser, email: email.trim()}, {merge:true});
        currentUserData.displayName = display.trim() || currentUser; currentUserData.email = email.trim(); renderAuth(); refreshAccountBox(); toast('Account-Einstellungen gespeichert.');
      } catch(e) { toast('Speichern fehlgeschlagen: '+e.message); }
    });

    document.getElementById('account-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('account-username').value.trim();
      const email = document.getElementById('account-email').value.trim();
      const displayName = document.getElementById('account-display').value.trim() || username;
      const password = document.getElementById('account-pass').value;
      const password2 = document.getElementById('account-pass2').value;
      if (password !== password2) return toast('Die Passwörter stimmen nicht überein.');
      try {
        const existing = await getSunnyUserDocument(username);
        if (existing.exists) return toast('Dieser Benutzername ist bereits vergeben.');
        const emailSnap = await db.collection('users').where('email','==',email).limit(1).get();
        if (!emailSnap.empty) return toast('Diese E-Mail-Adresse ist bereits registriert.');
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const saltText = Array.from(salt).map(x=>x.toString(16).padStart(2,'0')).join('');
        const passwordHash = await hashSunnyPassword(password, saltText);
        await db.collection('users').doc(username).set({username, displayName, email, passwordHash, passwordSalt:saltText, role:'Member', ownedGames:[], createdAt:firebase.firestore.FieldValue.serverTimestamp()});
        currentUser=username; currentUserData={username,displayName,email,passwordHash,passwordSalt:saltText,role:'Member',ownedGames:[]}; localStorage.setItem(SESSION_KEY,username);
        modal.classList.add('hidden'); renderAuth(); renderGames(); refreshAccountBox(); toast('Account erfolgreich erstellt.');
      } catch(e) { console.error(e); toast('Account konnte nicht erstellt werden: '+e.message); }
    });

    const oldRenderAuth = window.renderAuth;
    window.renderAuth = function(){ oldRenderAuth(); refreshAccountBox(); };
    refreshAccountBox();
  })()`);
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
ipcMain.handle('create-desktop-shortcut', async (_, targetPath) => { if (!targetPath) targetPath = process.execPath; const shortcut = path.join(app.getPath('desktop'), 'Sunny Games Launcher.lnk'); const ok = shell.writeShortcutLink(shortcut, { target: targetPath, cwd: path.dirname(targetPath), description: 'Sunny Games Launcher', icon: targetPath }); return { ok, shortcut }; });
ipcMain.handle('check-update', async () => ({ supported: true, currentVersion: app.getVersion() }));
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
