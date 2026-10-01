const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { spawn } = require('child_process');
const crypto = require('crypto');




const OTP_EMAIL = 'alihasan8069@gmail.com';

function otpApiUrl(){ return process.env.WAS_OTP_API_URL || ''; }

ipcMain.handle('auth-send-otp', async () => {
  try {
    const api = otpApiUrl();
    if (!api) return {ok:false, error:'OTP email service is not configured. Set WAS_OTP_API_URL to your secure OTP backend.'};
    const response = await fetch(api, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'send',email:OTP_EMAIL})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok || !data.ok) throw new Error(data.error||`OTP service returned HTTP ${response.status}.`);
    return {ok:true,sessionId:data.sessionId||'',maskedEmail:'a***@gmail.com',expiresIn:data.expiresIn||300};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('auth-verify-otp', async (_event, sessionId, code) => {
  try {
    const api = otpApiUrl();
    if (!api) return {ok:false, error:'OTP email service is not configured.'};
    const response = await fetch(api, {
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'verify',email:OTP_EMAIL,sessionId,code:String(code||'').trim()})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok || !data.ok) return {ok:false,error:data.error||'OTP verification failed.'};
    return {ok:true,email:OTP_EMAIL};
  } catch(e) { return {ok:false,error:e.message}; }
});

function projectRoot() {
  return path.join(app.getAppPath(), 'project');
}
function safeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
function copyFileIntoProject(src) {
  const destDir = projectRoot();
  fs.mkdirSync(destDir, {recursive:true});
  const dest = path.join(destDir, safeName(path.basename(src)));
  fs.copyFileSync(src,dest);
  return dest;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}


function normalizeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Invalid website URL.'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http:// and https:// URLs are supported.');
  return u;
}

function safeJoin(baseDir, relativeUrl) {
  const decoded = decodeURIComponent(relativeUrl.split('?')[0].split('#')[0]);
  const clean = decoded.replace(/^\/+/, '');
  const dest = path.resolve(baseDir, clean || 'index.html');
  if (!dest.startsWith(path.resolve(baseDir) + path.sep) && dest !== path.resolve(baseDir)) {
    throw new Error('Blocked unsafe URL path.');
  }
  return dest;
}

async function downloadWebsite(rawUrl) {
  const rootUrl = normalizeUrl(rawUrl);
  const target = projectRoot();
  fs.rmSync(target,{recursive:true,force:true});
  fs.mkdirSync(target,{recursive:true});

  const queue=[rootUrl.href], seen=new Set(), downloaded=[];
  const rootOrigin=rootUrl.origin;

  while(queue.length && seen.size<200) {
    const current=new URL(queue.shift());
    if(current.origin !== rootOrigin || seen.has(current.href)) continue;
    seen.add(current.href);
    const res=await fetch(current.href,{redirect:'follow'});
    if(!res.ok) continue;
    const type=(res.headers.get('content-type')||'').toLowerCase();
    const buf=Buffer.from(await res.arrayBuffer());
    let rel=current.pathname.replace(/^\/+/,'') || 'index.html';
    if(rel.endsWith('/')) rel += 'index.html';
    if(!path.extname(rel) && type.includes('text/html')) rel += '/index.html';
    const dest=safeJoin(target,rel);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,buf);
    downloaded.push(path.relative(target,dest));

    if(type.includes('text/html')) {
      const html=buf.toString('utf8');
      const refs=[];
      for(const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) refs.push(m[1]);
      for(const ref of refs) {
        if(!ref || /^(data:|javascript:|mailto:|tel:|#)/i.test(ref)) continue;
        try {
          const u=new URL(ref,current.href);
          if(u.origin===rootOrigin && /^https?:$/.test(u.protocol)) queue.push(u.href);
        } catch {}
      }
    }
  }
  if(!fs.existsSync(path.join(target,'index.html'))) throw new Error('Website URL did not provide an index.html page.');
  return downloaded;
}

ipcMain.handle('create-keystore', async (_event, settings={}) => {
  try {
    const alias=String(settings.alias||'my-key').trim();
    const storePassword=String(settings.storePassword||'');
    const keyPassword=String(settings.keyPassword||'');
    if(!/^[A-Za-z0-9._-]{1,40}$/.test(alias)) return {ok:false,error:'Invalid key alias.'};
    if(storePassword.length<6 || keyPassword.length<6) return {ok:false,error:'Passwords must be at least 6 characters.'};
    const result=await dialog.showSaveDialog({
      title:'Create Android Keystore',
      defaultPath:path.join(app.getPath('documents'),`${safeName(settings.name||'website-app')}.jks`),
      filters:[{name:'Android Keystore',extensions:['jks']}]
    });
    if(result.canceled || !result.filePath) return {ok:false,canceled:true};
    const dname=String(settings.name||'Website APK Studio').replace(/[^A-Za-z0-9 ._-]/g,' ').trim()||'Website APK Studio';
    const args=['-genkeypair','-v','-keystore',result.filePath,'-storepass',storePassword,'-alias',alias,'-keypass',keyPassword,'-keyalg','RSA','-keysize','2048','-validity','10000','-dname',`CN=${dname}, OU=Website APK Studio, O=${String(settings.organization||'Website APK Studio').replace(/[,=]/g,' ')}`,'-noprompt'];
    await new Promise((resolve,reject)=>execFile(process.platform==='win32'?'keytool':'keytool',args,(err,stdout,stderr)=>err?reject(new Error(stderr||err.message)):resolve(stdout||'')));
    return {ok:true,path:result.filePath,alias};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('pick-keystore', async () => {
  const result = await dialog.showOpenDialog({
    properties:['openFile'],
    filters:[{name:'Android Keystore',extensions:['jks','keystore']}]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-path', async (_event, target) => {
  if(!target) return {ok:false,error:'Path is empty.'};
  const p=path.resolve(target);
  if(!fs.existsSync(p)) return {ok:false,error:'Path does not exist.'};
  const err=await shell.openPath(p);
  return {ok:!err,error:err||null};
});

ipcMain.handle('show-in-folder', async (_event, target) => {
  if(!target || !fs.existsSync(target)) return {ok:false,error:'File does not exist.'};
  shell.showItemInFolder(path.resolve(target));
  return {ok:true};
});

ipcMain.handle('save-apk', async (_event, apkPath) => {
  try {
    if(!apkPath || !fs.existsSync(apkPath)) return {ok:false,error:'APK file does not exist.'};
    const result=await dialog.showSaveDialog({
      defaultPath:path.basename(apkPath),
      filters:[{name:'Android APK',extensions:['apk']}]
    });
    if(result.canceled || !result.filePath) return {ok:false,canceled:true};
    fs.copyFileSync(apkPath,result.filePath);
    return {ok:true,path:result.filePath};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('validate-apk', async (_event, apkPath) => {
  try {
    const p=path.resolve(apkPath||'');
    const st=fs.statSync(p);
    if(!p.toLowerCase().endsWith('.apk')) throw new Error('Not an APK file.');
    if(st.size < 1024) throw new Error('APK file is unexpectedly small.');
    const fd=fs.openSync(p,'r'); const head=Buffer.alloc(2); fs.readSync(fd,head,0,2,0); fs.closeSync(fd);
    if(head.toString('ascii') !== 'PK') throw new Error('APK is not a valid ZIP-based APK.');
    return {ok:true,path:p,size:st.size};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('build-release', async (_event, settings) => {
  return new Promise((resolve) => {
    const env={...process.env,
      WAS_KEYSTORE_PATH: settings?.keystorePath || '',
      WAS_KEY_ALIAS: settings?.keystoreAlias || '',
      WAS_KEYSTORE_PASSWORD: settings?.keystorePassword || '',
      WAS_KEY_PASSWORD: settings?.keyPassword || ''
    };
    const child=spawn(process.platform==='win32'?'node':'node',['scripts/build-release.js'],{
      cwd:app.getAppPath(), env, shell:false
    });
    let output='';
    child.stdout.on('data',d=>output+=d.toString());
    child.stderr.on('data',d=>output+=d.toString());
    child.on('close',code=>resolve({code,output}));
    child.on('error',e=>resolve({code:-1,output:e.message}));
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('pick-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Website files', extensions: ['html','htm','css','js','json','png','jpg','jpeg','webp','svg','gif','woff','woff2','ttf'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('pick-zip', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'ZIP Project', extensions: ['zip'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('run-command', async (_event, command, args) => {
  return new Promise((resolve) => {
    const child = spawn(command, args || [], { shell: true, cwd: app.getAppPath() });
    let output = '';
    child.stdout.on('data', d => output += d.toString());
    child.stderr.on('data', d => output += d.toString());
    child.on('close', code => resolve({ code, output }));
    child.on('error', err => resolve({ code: -1, output: err.message }));
  });
});


ipcMain.handle('import-files', async (_event, paths) => {
  try {
    fs.rmSync(projectRoot(), {recursive:true,force:true});
    fs.mkdirSync(projectRoot(), {recursive:true});
    const copied=[];
    for(const p of paths||[]) copied.push(copyFileIntoProject(p));
    return {ok:true,files:copied.map(x=>path.basename(x))};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('import-zip', async (_event, zipPath) => {
  try {
    const target=projectRoot();
    fs.rmSync(target,{recursive:true,force:true});
    fs.mkdirSync(target,{recursive:true});
    const unzip = process.platform==='win32' ? 'tar' : 'unzip';
    const args = process.platform==='win32'
      ? ['-xf',zipPath,'-C',target]
      : ['-o',zipPath,'-d',target];
    await new Promise((resolve,reject)=>{
      execFile(unzip,args,(err,stdout,stderr)=>err?reject(new Error(stderr||err.message)):resolve());
    });
    // If ZIP contains one top-level folder, flatten it.
    const entries=fs.readdirSync(target);
    if(entries.length===1 && fs.statSync(path.join(target,entries[0])).isDirectory()){
      const nested=path.join(target,entries[0]);
      const temp=path.join(os.tmpdir(),'was_flatten_'+Date.now());
      fs.renameSync(nested,temp);
      for(const item of fs.readdirSync(temp)) fs.renameSync(path.join(temp,item),path.join(target,item));
      fs.rmSync(temp,{recursive:true,force:true});
    }
    return {ok:true,files:fs.readdirSync(target)};
  } catch(e) { return {ok:false,error:e.message}; }
});


ipcMain.handle('import-url', async (_event, rawUrl) => {
  try {
    const files=await downloadWebsite(rawUrl);
    return {ok:true,files};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('project-files', async () => {
  const dir=projectRoot();
  if(!fs.existsSync(dir)) return [];
  const out=[];
  function walk(base,rel=''){
    for(const name of fs.readdirSync(base)){
      const full=path.join(base,name), r=path.join(rel,name);
      if(fs.statSync(full).isDirectory()) walk(full,r); else out.push(r);
    }
  }
  walk(dir); return out;
});

ipcMain.handle('pick-logo', async () => {
  const result = await dialog.showOpenDialog({
    properties:['openFile'],
    filters:[{name:'App Logo Image',extensions:['png','jpg','jpeg','webp']}]
  });
  if(result.canceled || !result.filePaths[0]) return null;
  const source=result.filePaths[0];
  const destDir=path.join(projectRoot(),'assets');
  fs.mkdirSync(destDir,{recursive:true});
  const ext=path.extname(source).toLowerCase() || '.png';
  const dest=path.join(destDir,'app-logo'+ext);
  fs.copyFileSync(source,dest);
  return {path:dest,relative:path.relative(app.getAppPath(),dest),name:path.basename(dest)};
});

ipcMain.handle('read-logo-data', async (_event, filePath) => {
  try {
    const p=path.resolve(String(filePath||''));
    if(!p.startsWith(path.resolve(projectRoot())+path.sep) || !fs.existsSync(p)) return null;
    const ext=path.extname(p).toLowerCase();
    const mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'}[ext]||'application/octet-stream';
    return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
  } catch { return null; }
});

ipcMain.handle('remove-logo', async () => {
  const dir=path.join(projectRoot(),'assets');
  if(!fs.existsSync(dir)) return {ok:true};
  for(const name of fs.readdirSync(dir)) if(/^app-logo\.(png|jpe?g|webp)$/i.test(name)) fs.rmSync(path.join(dir,name),{force:true});
  return {ok:true};
});

ipcMain.handle('save-build-settings', async (_event, settings) => {
  try {
    const file=path.join(app.getAppPath(),'studio-settings.json');
    const clean={...(settings||{})};
    delete clean.appProtectionPassword;
    fs.writeFileSync(file,JSON.stringify(clean,null,2));
    return {ok:true,path:file};
  } catch(e) { return {ok:false,error:e.message}; }
});

ipcMain.handle('hash-password', async (_event, password) => {
  try {
    const value=String(password||'');
    if(value.length<4) return {ok:false,error:'Password must be at least 4 characters.'};
    const salt=crypto.randomBytes(16).toString('hex');
    const hash=crypto.createHash('sha256').update(salt+'\0'+value).digest('hex');
    return {ok:true,hash:`sha256$${salt}$${hash}`};
  } catch(e) { return {ok:false,error:e.message}; }
});
