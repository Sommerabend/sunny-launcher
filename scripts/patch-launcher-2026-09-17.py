from pathlib import Path

root = Path(__file__).resolve().parents[1]

main = root / 'main.js'
s = main.read_text(encoding='utf-8')
old = "ipcMain.handle('launch-installed-game',async(_,game)=>{if(!game?.executablePath)throw new Error('Keine installierte EXE hinterlegt.');if(!fs.existsSync(game.executablePath))throw new Error('Die Spieldatei wurde nicht gefunden.');spawn(game.executablePath,[],{detached:true,stdio:'ignore'}).unref();return true;});"
new = "async function launchInstalledExecutable(executablePath){if(!executablePath)throw new Error('Keine installierte EXE hinterlegt.');if(!fs.existsSync(executablePath))throw new Error('Die Spieldatei wurde nicht gefunden. Bitte installiere das Spiel erneut.');const result=await shell.openPath(executablePath);if(result)throw new Error('Spiel konnte nicht gestartet werden: '+result);return true;}\nipcMain.handle('launch-installed-game',async(_,game)=>launchInstalledExecutable(game?.executablePath));"
if old not in s:
    raise SystemExit('main.js launch handler not found')
s = s.replace(old, new, 1)
main.write_text(s, encoding='utf-8')

index = root / 'index.html'
s = index.read_text(encoding='utf-8')
old = '<form id="upload-game-form" onsubmit="uploadGame(event)"><input id="app-title" placeholder="Spieltitel" required><textarea id="app-desc" placeholder="Beschreibung…" required></textarea><input id="app-cover" placeholder="Cover Image URL" required><input id="app-download" placeholder="Download/EXE URL" required><input id="app-version" placeholder="Version, z.B. 1.0.0" value="1.0.0"><select id="app-pricing"><option value="free">Kostenlos</option><option value="paid">Key benötigt</option></select><button class="primary" type="submit">Spiel veröffentlichen</button></form>'
new = old + '<div style="border-top:1px solid #20283a;margin-top:20px;padding-top:18px"><b>Spiel-Update veröffentlichen</b><p style="color:#737e94;font-size:12px;margin:6px 0 12px">Wähle ein veröffentlichtes Spiel und stelle eine neue Version bereit.</p><select id="admin-update-game" class="secondary" style="width:100%"></select><input id="admin-update-version" placeholder="Neue Version, z.B. 1.1.0" style="margin-top:10px" required><input id="admin-update-download" placeholder="Neue Download/EXE URL" style="margin-top:10px" required><textarea id="admin-update-notes" placeholder="Änderungen / Update-Notizen…" style="margin-top:10px"></textarea><button class="primary" type="button" onclick="publishGameUpdate()" style="margin-top:10px">Update veröffentlichen</button></div>'
if old not in s:
    raise SystemExit('index admin upload form not found')
s = s.replace(old, new, 1)

old = "const sel=document.getElementById('key-game-select');if(sel)sel.innerHTML=gamesData.map(g=>`<option value=\"${esc(g.id)}\">${esc(g.title)}</option>`).join('')"
new = "const sel=document.getElementById('key-game-select');if(sel)sel.innerHTML=gamesData.map(g=>`<option value=\"${esc(g.id)}\">${esc(g.title)}</option>`).join('');const updateSel=document.getElementById('admin-update-game');if(updateSel)updateSel.innerHTML=gamesData.map(g=>`<option value=\"${esc(g.id)}\">${esc(g.title)} · v${esc(g.version||'1.0.0')}</option>`).join('')"
if old not in s:
    raise SystemExit('index game selector hook not found')
s = s.replace(old, new, 1)

old = "async function uploadGame(e){e.preventDefault();if(!isAdmin())return toast('Admin-Berechtigung erforderlich.');const g={title:document.getElementById('app-title').value.trim(),description:document.getElementById('app-desc').value.trim(),coverUrl:document.getElementById('app-cover').value.trim(),downloadUrl:document.getElementById('app-download').value.trim(),version:document.getElementById('app-version').value.trim()||'1.0.0',pricing:document.getElementById('app-pricing').value,createdAt:firebase.firestore.FieldValue.serverTimestamp(),publishedBy:currentUser};try{await db.collection('launcher_games').add(g);toast('Spiel veröffentlicht.');e.target.reset();document.getElementById('admin-modal').classList.add('hidden')}catch(err){toast('Fehler: '+err.message)}}"
new = old + "\nasync function publishGameUpdate(){if(!isAdmin())return toast('Admin-Berechtigung erforderlich.');const gameId=document.getElementById('admin-update-game')?.value;const version=document.getElementById('admin-update-version')?.value.trim();const downloadUrl=document.getElementById('admin-update-download')?.value.trim();const updateNotes=document.getElementById('admin-update-notes')?.value.trim();if(!gameId||!version||!downloadUrl)return toast('Spiel, Version und Download-Link sind erforderlich.');const game=gamesData.find(g=>g.id===gameId);if(!game)return toast('Spiel wurde nicht gefunden.');if(version===String(game.version||''))return toast('Diese Version ist bereits veröffentlicht.');try{await db.collection('launcher_games').doc(gameId).set({version,downloadUrl,updateNotes,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:currentUser},{merge:true});document.getElementById('admin-update-version').value='';document.getElementById('admin-update-download').value='';document.getElementById('admin-update-notes').value='';toast(game.title+' · Update v'+version+' veröffentlicht.');}catch(e){console.error(e);toast('Update konnte nicht veröffentlicht werden: '+e.message)}}"
if old not in s:
    raise SystemExit('index uploadGame function not found')
s = s.replace(old, new, 1)

old = "function renderUpdates(){const up=gamesData.filter(g=>installed[g.id]&&installed[g.id].version!==g.version&&g.version);document.getElementById('updateList').innerHTML=up.length?up.map(g=>`<div class=\"updateRow\"><div><b>${esc(g.title)}</b><p>Installiert: v${esc(installed[g.id].version)} → verfügbar: v${esc(g.version)}</p></div><button class=\"primary\" onclick=\"installGame('${g.id}')\">Update installieren</button></div>`).join(''):'<div class=\"empty\">Alle installierten Spiele sind aktuell.</div>';const b=document.getElementById('updateBadge');b.classList.toggle('hidden',!up.length);b.textContent=up.length}"
new = "function renderUpdates(){const up=gamesData.filter(g=>installed[g.id]&&installed[g.id].version!==g.version&&g.version);document.getElementById('updateList').innerHTML=up.length?up.map(g=>`<div class=\"updateRow\"><div><b>${esc(g.title)}</b><p>Installiert: v${esc(installed[g.id].version)} → verfügbar: v${esc(g.version)}</p>${g.updateNotes?`<p>${esc(g.updateNotes)}</p>`:''}</div><button class=\"primary\" onclick=\"installGame('${g.id}')\">Update installieren</button></div>`).join(''):'<div class=\"empty\">Alle installierten Spiele sind aktuell.</div>';const b=document.getElementById('updateBadge');b.classList.toggle('hidden',!up.length);b.textContent=up.length}"
if old not in s:
    raise SystemExit('index renderUpdates function not found')
s = s.replace(old, new, 1)

index.write_text(s, encoding='utf-8')

pkg = root / 'package.json'
p = pkg.read_text(encoding='utf-8')
p = p.replace('"version": "3.2.3"', '"version": "3.2.4"', 1)
pkg.write_text(p, encoding='utf-8')

print('Patched launcher: robust game launching + admin game updates + version 3.2.4')
