from pathlib import Path
p=Path('main.js')
s=p.read_text(encoding='utf-8')
old="function setupSearchRoots(){return [...new Set([process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA,process.env.APPDATA,process.env.USERPROFILE].filter(Boolean))];}"
new="""function setupSearchRoots(){return [...new Set([process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA,process.env.APPDATA,process.env.USERPROFILE].filter(Boolean))];}
function isWindowsExecutable(file){try{if(!file||!fs.existsSync(file)||!fs.statSync(file).isFile())return false;const fd=fs.openSync(file,'r');const b=Buffer.alloc(2);fs.readSync(fd,b,0,2,0);fs.closeSync(fd);return b[0]===0x4d&&b[1]===0x5a;}catch{return false;}}
function normalizeGameExecutable(file){if(!file)return null;const resolved=path.resolve(file);return isWindowsExecutable(resolved)?resolved:null;}"""
if old not in s: raise SystemExit('anchor missing')
s=s.replace(old,new,1)
# Replace direct launch handler body conservatively by adding validation before spawn calls.
needle="ipcMain.handle('launch-installed-game',async(_,payload)=>{"
idx=s.find(needle)
if idx<0: raise SystemExit('launch handler missing')
insert="""ipcMain.handle('launch-installed-game',async(_,payload)=>{\n  const candidate=payload&&payload.path?String(payload.path):'';\n  const executable=normalizeGameExecutable(candidate);\n  if(!executable) throw new Error('Die ausgewählte Spieldatei ist keine gültige Windows-EXE (MZ-Datei). Bitte die richtige Windows-Spiel-EXE auswählen oder das Spiel neu installieren.');\n  return new Promise((resolve,reject)=>{const child=spawn(executable,Array.isArray(payload.args)?payload.args:[],{cwd:path.dirname(executable),detached:true,stdio:'ignore',windowsHide:false});child.once('error',reject);child.unref();resolve(true);});\n});"""
end=s.find('\n});',idx)
if end<0: raise SystemExit('handler end missing')
end+=4
s=s[:idx]+insert+s[end:]
p.write_text(s,encoding='utf-8')

pp=Path('package.json')
import json
d=json.loads(pp.read_text(encoding='utf-8'))
d['version']='3.2.8'
pp.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
