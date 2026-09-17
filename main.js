const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');

let win;
let updateInProgress = false;
const downloads = new Map();

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: 'Sunny Games Launcher',
    icon: path.join(__dirname, 'icon.ico'),
    backgroundColor: '#070a12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  win.webContents.on('did-finish-load', () => {
    injectAccountFeatures();
    injectLauncherUpdateUI();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  setTimeout(checkLauncherUpdate, 2500);
}

function injectLauncherUpdateUI() {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`(() => {
    if (window.__sunnyUpdateUI) return;
    window.__sunnyUpdateUI = true;
    const style = document.createElement('style');
    style.textContent = '#sunny-launcher-update-lock{position:fixed;inset:0;background:rgba(3,5,10,.96);backdrop-filter:blur(14px);z-index:99999;display:grid;place-items:center;color:#eef2ff}.sunny-update-card{width:min(560px,90vw);padding:38px;border:1px solid #343d53;border-radius:24px;background:#0d1420;box-shadow:0 30px 100px #0008;text-align:center}.sunny-update-icon{font-size:64px;color:#ffc928;margin-bottom:8px}.sunny-update-card h2{margin:0 0 10px;font-size:28px}.sunny-update-card p{color:#8d97aa;line-height:1.6;margin:8px 0}.sunny-update-progress{height:9px;background:#1a2231;border-radius:99px;overflow:hidden;margin:22px 0 10px}.sunny-update-progress i{display:block;height:100%;width:0;background:#ffc928;transition:width .2s}.sunny-update-status{font-size:12px;color:#aab3c4}';
    document.head.appendChild(style);
    const lock = document.createElement('div');
    lock.id='sunny-launcher-update-lock'; lock.style.display='none';
    lock.innerHTML='<div class="sunny-update-card"><div class="sunny-update-icon">☀</div><h2>Neues Launcher-Update</h2><p id="sunny-update-text">Eine neue Version des Sunny Games Launchers ist verfügbar.</p><div class="sunny-update-progress"><i id="sunny-update-bar"></i></div><div class="sunny-update-status" id="sunny-update-status">Update wird vorbereitet…</div></div>';
    document.body.appendChild(lock);
    window.addEventListener('sunny-launcher-update-available', e => { lock.style.display='grid'; document.getElementById('sunny-update-text').textContent='Version '+e.detail.version+' wird jetzt installiert.'; document.getElementById('sunny-update-status').textContent='Update wird heruntergeladen…'; document.getElementById('sunny-update-bar').style.width='5%'; });
    window.addEventListener('sunny-launcher-update-progress', e => { const p=Math.max(5,Math.min(100,Number(e.detail.percent||0))); document.getElementById('sunny-update-bar').style.width=p+'%'; document.getElementById('sunny-update-status').textContent='Update wird heruntergeladen… '+p+'%'; });
    window.addEventListener('sunny-launcher-update-installing', () => { lock.style.display='grid'; document.getElementById('sunny-update-bar').style.width='100%'; document.getElementById('sunny-update-status').textContent='Neue Version wird installiert…'; });
  })()`);
}

function notifyRenderer(eventName, detail) {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, {detail:${JSON.stringify(detail || {})}}))`).catch(() => {});
}

async function checkLauncherUpdate() {
  if (updateInProgress || !app.isPackaged) return;
  try {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    await autoUpdater.checkForUpdates();
  } catch (e) {
    console.warn('Launcher update check failed:', e.message);
  }
}

autoUpdater.on('update-available', info => {
  updateInProgress = true;
  notifyRenderer('sunny-launcher-update-available', { version: info.version });
});
autoUpdater.on('download-progress', progress => {
  if (!updateInProgress) return;
  notifyRenderer('sunny-launcher-update-progress', { percent: Math.round(progress.percent || 0) });
});
autoUpdater.on('update-downloaded', () => {
  if (!updateInProgress) return;
  notifyRenderer('sunny-launcher-update-installing', {});
  setTimeout(() => {
    try {
      app.quit();
    } catch (e) {
      console.error('Launcher update installation failed:', e);
      updateInProgress = false;
    }
  }, 700);
});
autoUpdater.on('error', err => {
  console.error('Launcher updater error:', err.message);
  updateInProgress = false;
});

function injectAccountFeatures() {
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(`(() => {
    if (window.__sunnyAccountFeatures) return;
    window.__sunnyAccountFeatures = true;
    const style=document.createElement('style'); style.textContent='.accountTools{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.accountBox{background:#101624;border:1px solid #293145;border-radius:14px;padding:18px;margin-bottom:18px}.accountBox h3{margin:0 0 6px}.accountBox p{color:#737e94;font-size:12px;margin:0}.dangerBtn{border:1px solid #66353d;background:#211319;color:#ff9b9b;padding:9px 14px;border-radius:10px;cursor:pointer}.accountEditForm{display:flex;flex-direction:column;gap:12px}.accountEditForm input{background:#080d16;border:1px solid #293246;color:#fff;padding:12px;border-radius:10px}'; document.head.appendChild(style);
    const accountModal=document.createElement('div'); accountModal.id='account-modal'; accountModal.className='modal hidden'; accountModal.innerHTML='<div class="modalCard"><div class="modalHead"><div><div class="eyebrow">SUNNY ACCOUNT</div><h3 id="account-modal-title">Konto erstellen</h3></div><button id="close-account">×</button></div><form id="account-form"><input id="account-username" autocomplete="username" placeholder="Benutzername" required minlength="3"><input id="account-email" type="email" autocomplete="email" placeholder="E-Mail-Adresse" required><input id="account-display" placeholder="Anzeigename"><input id="account-pass" type="password" autocomplete="new-password" placeholder="Passwort" required minlength="6"><input id="account-pass2" type="password" autocomplete="new-password" placeholder="Passwort wiederholen" required minlength="6"><button class="primary" type="submit">Account erstellen</button></form></div>'; document.body.appendChild(accountModal);
    const editModal=document.createElement('div'); editModal.id='account-edit-modal'; editModal.className='modal hidden'; editModal.innerHTML='<div class="modalCard"><div class="modalHead"><div><div class="eyebrow">SUNNY ACCOUNT</div><h3>Account bearbeiten</h3></div><button id="close-account-edit">×</button></div><form id="account-edit-form" class="accountEditForm"><input id="edit-display" placeholder="Anzeigename" required><input id="edit-email" type="email" placeholder="E-Mail-Adresse" required><button class="primary" type="submit">Änderungen speichern</button></form></div>'; document.body.appendChild(editModal);
    const settings=document.getElementById('settings'); if(settings&&!document.getElementById('account-settings-box')){const box=document.createElement('div');box.id='account-settings-box';box.className='accountBox';box.innerHTML='<h3>Mein Account</h3><p id="account-settings-info">Anmelden, um deine Account-Einstellungen zu verwalten.</p><div class="accountTools"><button class="secondary" id="create-account-btn">Account erstellen</button><button class="secondary hidden" id="edit-account-btn">Account bearbeiten</button><button class="dangerBtn hidden" id="logout-account-btn">Abmelden</button></div>';settings.insertBefore(box,settings.querySelector('.settingsPanel'));}
    const oldOpenRedeem=window.openRedeem; window.openRedeem=function(){if(!currentUser){toast('Du musst angemeldet sein, um einen Key einzulösen.');openLogin();return;}oldOpenRedeem();};
    const createBtn=document.getElementById('create-account-btn'),editBtn=document.getElementById('edit-account-btn'),logoutBtn=document.getElementById('logout-account-btn'),info=document.getElementById('account-settings-info');
    function getLoggedUserName(){return typeof currentUser!=='undefined'&&currentUser?String(currentUser):localStorage.getItem('sunny_session')||localStorage.getItem('SESSION_KEY')||'';}
    async function getAccountDoc(username){return firebase.firestore().collection('users').doc(username).get();}
    function refreshAccountBox(){const logged=!!getLoggedUserName();createBtn?.classList.toggle('hidden',logged);editBtn?.classList.toggle('hidden',!logged);logoutBtn?.classList.toggle('hidden',!logged);if(logged){const data=typeof currentUserData!=='undefined'&&currentUserData?currentUserData:{};info.textContent='Angemeldet als '+(data.displayName||data.username||getLoggedUserName())+(data.email?' · '+data.email:'');}else info.textContent='Anmelden, um deine Account-Einstellungen zu verwalten.';}
    createBtn?.addEventListener('click',()=>{accountModal.querySelector('#account-modal-title').textContent='Konto erstellen';document.getElementById('account-form').reset();accountModal.classList.remove('hidden');document.getElementById('account-username').focus();}); document.getElementById('close-account')?.addEventListener('click',()=>accountModal.classList.add('hidden'));document.getElementById('close-account-edit')?.addEventListener('click',()=>editModal.classList.add('hidden'));logoutBtn?.addEventListener('click',()=>window.logout());
    editBtn?.addEventListener('click',async()=>{const username=getLoggedUserName();if(!username)return openLogin();try{const snap=await getAccountDoc(username);if(!snap.exists)return toast('Account wurde in der Sunny-Datenbank nicht gefunden.');const data=snap.data()||{};document.getElementById('edit-display').value=data.displayName||data.username||username;document.getElementById('edit-email').value=data.email||'';editModal.classList.remove('hidden');document.getElementById('edit-display').focus();}catch(e){toast('Account konnte nicht geladen werden: '+e.message);}});
    document.getElementById('account-edit-form')?.addEventListener('submit',async e=>{e.preventDefault();const username=getLoggedUserName();if(!username)return openLogin();const displayName=document.getElementById('edit-display').value.trim(),email=document.getElementById('edit-email').value.trim();if(!displayName||!email)return toast('Bitte alle Felder ausfüllen.');try{const firestore=firebase.firestore(),emailSnap=await firestore.collection('users').where('email','==',email).limit(2).get();if(emailSnap.docs.some(d=>d.id!==username))return toast('Diese E-Mail-Adresse wird bereits verwendet.');await firestore.collection('users').doc(username).set({displayName,email,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});if(typeof currentUserData!=='undefined'&&currentUserData){currentUserData.displayName=displayName;currentUserData.email=email;}if(typeof renderAuth==='function')renderAuth();editModal.classList.add('hidden');refreshAccountBox();toast('Account-Einstellungen gespeichert.');}catch(e){console.error(e);toast('Speichern fehlgeschlagen: '+e.message);}});
    document.getElementById('account-form')?.addEventListener('submit',async e=>{e.preventDefault();const username=document.getElementById('account-username').value.trim(),email=document.getElementById('account-email').value.trim(),displayName=document.getElementById('account-display').value.trim()||username,password=document.getElementById('account-pass').value,password2=document.getElementById('account-pass2').value;if(password!==password2)return toast('Die Passwörter stimmen nicht überein.');try{const existing=await getSunnyUserDocument(username);if(existing.exists)return toast('Dieser Benutzername ist bereits vergeben.');const emailSnap=await firebase.firestore().collection('users').where('email','==',email).limit(1).get();if(!emailSnap.empty)return toast('Diese E-Mail-Adresse ist bereits registriert.');const salt=crypto.getRandomValues(new Uint8Array(16)),saltText=Array.from(salt).map(x=>x.toString(16).padStart(2,'0')).join(''),passwordHash=await hashSunnyPassword(password,saltText);await firebase.firestore().collection('users').doc(username).set({username,displayName,email,passwordHash,passwordSalt:saltText,role:'Member',ownedGames:[],createdAt:firebase.firestore.FieldValue.serverTimestamp()});currentUser=username;currentUserData={username,displayName,email,passwordHash,passwordSalt:saltText,role:'Member',ownedGames:[]};localStorage.setItem('sunny_session',username);accountModal.classList.add('hidden');renderAuth();renderGames();refreshAccountBox();toast('Account erfolgreich erstellt.');}catch(e){console.error(e);toast('Account konnte nicht erstellt werden: '+e.message);}});
    const oldRenderAuth=window.renderAuth;if(typeof oldRenderAuth==='function')window.renderAuth=function(){oldRenderAuth();refreshAccountBox();};refreshAccountBox();
  })()`);
}

function send(channel,payload){if(win&&!win.isDestroyed())win.webContents.send(channel,payload);}
function safeName(name){return String(name||'game').replace(/[^a-z0-9._-]/gi,'_').slice(0,80);}
function downloadFile(url,destination,id){return new Promise((resolve,reject)=>{const file=fs.createWriteStream(destination);let received=0,total=0,settled=false;const fail=err=>{if(settled)return;settled=true;file.close();try{fs.unlinkSync(destination);}catch{}downloads.delete(id);reject(err);};const request=target=>{https.get(target,response=>{if(response.statusCode>=300&&response.statusCode<400&&response.headers.location){response.resume();request(new URL(response.headers.location,target).toString());return;}if(response.statusCode!==200){response.resume();fail(new Error('HTTP '+response.statusCode));return;}total=Number(response.headers['content-length']||0);response.on('data',chunk=>{received+=chunk.length;send('download-progress',{id,received,total,percent:total?Math.round(received/total*100):0});});response.pipe(file);file.on('finish',()=>file.close(()=>{if(settled)return;settled=true;downloads.delete(id);resolve(destination);}));}).on('error',fail);};downloads.set(id,{request,destination});request(url);});}
ipcMain.handle('get-paths',()=>({appData:app.getPath('appData'),downloads:app.getPath('downloads'),desktop:app.getPath('desktop')}));
ipcMain.handle('choose-install-folder',async()=>{const{dialog}=require('electron');const result=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory'],title:'Installationsordner auswählen'});return result.canceled?null:result.filePaths[0];});
function findFileRecursive(rootDir,targetName,maxDepth=5){if(!rootDir||!fs.existsSync(rootDir))return null;const wanted=String(targetName||'').toLowerCase();const walk=(dir,depth)=>{if(depth<0)return null;let entries=[];try{entries=fs.readdirSync(dir,{withFileTypes:true});}catch{return null;}for(const entry of entries){if(entry.name.startsWith('$')&&depth>2)continue;const full=path.join(dir,entry.name);if(entry.isFile()&&entry.name.toLowerCase()===wanted)return full;if(entry.isDirectory()){const found=walk(full,depth-1);if(found)return found;}}return null;};return walk(rootDir,maxDepth);}
function setupSearchRoots(){return [...new Set([process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA,process.env.APPDATA,process.env.USERPROFILE].filter(Boolean))];}
function readWindowsPE(file){try{if(!file||!fs.existsSync(file))return{ok:false,reason:'Datei nicht gefunden.'};const stat=fs.statSync(file);if(!stat.isFile()||stat.size<64)return{ok:false,reason:'Die Datei ist keine gültige Windows-Programmdatei.'};const fd=fs.openSync(file,'r');try{const head=Buffer.alloc(64);fs.readSync(fd,head,0,64,0);if(head[0]!==0x4d||head[1]!==0x5a)return{ok:false,reason:'Die Datei beginnt nicht mit einer Windows-EXE-Signatur (MZ).'};const peOffset=head.readUInt32LE(0x3c);if(peOffset<64||peOffset>stat.size-4)return{ok:false,reason:'Ungültiger Windows-PE-Header.'};const sig=Buffer.alloc(4);fs.readSync(fd,sig,0,4,peOffset);if(sig[0]!==0x50||sig[1]!==0x45||sig[2]!==0x00||sig[3]!==0x00)return{ok:false,reason:'Ungültiger Windows-PE-Header (PE).'};return{ok:true};}finally{fs.closeSync(fd);}}catch(e){return{ok:false,reason:'Die Spieldatei konnte nicht geprüft werden: '+e.message};}}
async function runGameSetup(setupPath,game,installFolder){return await new Promise((resolve,reject)=>{const pe=readWindowsPE(setupPath);if(!pe.ok)return reject(new Error('Das Setup ist keine gültige Windows-EXE: '+pe.reason));const child=spawn(setupPath,[],{detached:false,stdio:'ignore',windowsHide:false,cwd:path.dirname(setupPath)});child.once('error',reject);child.once('exit',async code=>{if(code!==0)return reject(new Error('Das Setup wurde mit Exit-Code '+code+' beendet.'));let found=null;const configured=String(game.postInstallExecutable||'').trim();if(configured){if(path.isAbsolute(configured)&&fs.existsSync(configured))found=configured;else{found=findFileRecursive(installFolder,configured,6);if(!found)for(const rootDir of setupSearchRoots()){found=findFileRecursive(rootDir,configured,5);if(found)break;}}}if(!found&&game.title)for(const rootDir of [installFolder,...setupSearchRoots()]){found=findFileRecursive(rootDir,String(game.title).replace(/[^a-z0-9._-]/gi,'_')+'.exe',5);if(found)break;}if(!found)return reject(new Error('Setup abgeschlossen, aber die Startdatei wurde nicht gefunden. Hinterlege im Admin-Bereich den Namen der Start-EXE (z. B. MeinSpiel.exe).'));try{await launchInstalledExecutable(found);resolve(found);}catch(e){reject(e);}});});}
ipcMain.handle('install-game',async(_,game)=>{if(!game||!game.downloadUrl)throw new Error('Kein Download-Link vorhanden.');const folder=game.installPath||path.join(app.getPath('appData'),'SunnyLauncher','Games',safeName(game.id||game.title));fs.mkdirSync(folder,{recursive:true});const ext=game.fileName?.includes('.')?path.extname(game.fileName):'.exe';const filename=safeName(game.fileName||`${game.title||'game'}${ext}`);const destination=path.join(folder,filename),id=`${Date.now()}-${Math.random().toString(16).slice(2)}`;send('download-start',{id,title:game.title,path:folder});try{await downloadFile(game.downloadUrl,destination,id);send('download-complete',{id,title:game.title,path:destination});const isSetup=game.installType==='setup'||game.runInstaller===true;if(isSetup&&/\.exe$/i.test(destination)){const executablePath=await runGameSetup(destination,game,folder);return{ok:true,id,path:destination,installPath:folder,executablePath,setup:true};}if(/\.exe$/i.test(destination)){const pe=readWindowsPE(destination);if(!pe.ok)throw new Error('Die heruntergeladene Spieldatei ist keine gültige Windows-EXE: '+pe.reason+' Prüfe im Admin-Bereich, ob wirklich die Windows-Version des Spiels hinterlegt ist.');}return{ok:true,id,path:destination,installPath:folder,executablePath:destination,setup:false};}catch(e){send('download-error',{id,title:game.title,error:e.message});throw e;}});
async function launchInstalledExecutable(executablePath){if(!executablePath)throw new Error('Keine installierte EXE hinterlegt.');if(!fs.existsSync(executablePath))throw new Error('Die Spieldatei wurde nicht gefunden. Bitte installiere das Spiel erneut.');const pe=readWindowsPE(executablePath);if(!pe.ok)throw new Error('Diese Datei kann von Windows nicht als Programm gestartet werden: '+pe.reason+' Bitte installiere das Spiel erneut oder hinterlege im Admin-Bereich die richtige Windows-EXE.');const result=await shell.openPath(executablePath);if(result)throw new Error('Spiel konnte nicht gestartet werden: '+result);return true;}
ipcMain.handle('launch-installed-game',async(_,game)=>launchInstalledExecutable(game?.executablePath));
ipcMain.handle('open-folder',async(_,folder)=>{if(folder&&fs.existsSync(folder))await shell.openPath(folder);});
ipcMain.handle('open-external',async(_,url)=>{if(/^https?:\/\//i.test(url))await shell.openExternal(url);});
ipcMain.handle('create-desktop-shortcut',async(_,targetPath)=>{if(!targetPath)targetPath=process.execPath;const shortcut=path.join(app.getPath('desktop'),'Sunny Games Launcher.lnk');const ok=shell.writeShortcutLink(shortcut,{target:targetPath,cwd:path.dirname(targetPath),description:'Sunny Games Launcher',icon:targetPath});return{ok,shortcut};});
ipcMain.handle('check-update',async()=>({supported:true,currentVersion:app.getVersion()}));
app.whenReady().then(createWindow);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});