const state = {
  html: `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My App</title></head>
<body><h1>Hello from Website APK Studio</h1><p>Edit HTML/CSS/JS and press Run.</p><button onclick="hello()">Test JavaScript</button><script>function hello(){alert('JavaScript is running!')}</script></body></html>`,
  css: `body{font-family:Arial,sans-serif;padding:30px;background:#f4f6fa}button{padding:10px 16px;border:0;border-radius:8px;cursor:pointer}`,
  js: `console.log('JavaScript ready');`,
  json: `{"name":"My Website App","version":"1.0.0"}`
};
let activeTab = 'html';
const settingIds=['appName','packageName','version','orientation','backNav','downloads','uploads','fullscreen','camera','microphone','notifications','location','keystorePath','keystoreAlias','appProtection','protectionType','otpApiUrl','logoPath','logoName'];
function readSettings(){
  const o={};
  for(const id of settingIds){
    const el=document.getElementById(id);
    if(el) o[id]=el.type==='checkbox'?el.checked:el.value;
  }
  return o;
}
function applySettings(s){
  if(!s) return;
  for(const id of settingIds){
    const el=document.getElementById(id);
    if(!el || s[id]===undefined) continue;
    if(el.type==='checkbox') el.checked=!!s[id]; else el.value=s[id];
  }
}
function saveSettings(){
  localStorage.setItem('was-settings',JSON.stringify(readSettings()));
  log('App settings saved.');
}
function loadSettings(){
  try{applySettings(JSON.parse(localStorage.getItem('was-settings')||'null'));}catch{}
  updateProtectionUI();
  restoreLogoPreview();
}

function updateProtectionUI(){
  const on=document.getElementById('appProtection').checked;
  document.getElementById('protectionOptions').classList.toggle('hidden',!on);
  const otp=document.getElementById('protectionType').value==='otp';
  document.getElementById('passwordProtectionFields').classList.toggle('hidden',!on||otp);
  document.getElementById('otpProtectionFields').classList.toggle('hidden',!on||!otp);
}
async function restoreLogoPreview(){
  const p=localStorage.getItem('was-logo-path') || '';
  if(!p) return;
  const data=await window.studioAPI.readLogoData(p);
  if(data){document.getElementById('logoPreview').src=data;document.getElementById('logoStatus').textContent=localStorage.getItem('was-logo-name')||'Custom logo selected.';}
}

const editor = document.getElementById('editor');
const frame = document.getElementById('previewFrame');
const mobileFrame = document.getElementById('mobileFrame');
const status = document.getElementById('status');
const logs = document.getElementById('logs');

function syncEditor(){ editor.value = state[activeTab]; }
editor.addEventListener('input', ()=> state[activeTab]=editor.value);

document.querySelectorAll('.tab').forEach(btn=>{
  btn.onclick=()=>{ state[activeTab]=editor.value; activeTab=btn.dataset.tab; syncEditor();
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); btn.classList.add('active');
  };
});

function buildDocument(){
  let html = state.html;
  const style = `<style>${state.css}</style>`;
  const script = `<script>${state.js.replace(/<\/script>/gi,'<\\/script>')}</script>`;
  if (/<head[^>]*>/i.test(html)) html=html.replace(/<head[^>]*>/i, m=>m+style);
  else html=style+html;
  if (/<\/body>/i.test(html)) html=html.replace(/<\/body>/i, script+'</body>');
  else html += script;
  return html;
}

function run(){
  state[activeTab]=editor.value;
  const doc=buildDocument();
  frame.srcdoc=doc;
  mobileFrame.srcdoc=doc;
  status.textContent='Running';
  log('Preview refreshed successfully.');
}
function log(x){ logs.textContent += (logs.textContent ? '\\n' : '') + x; logs.scrollTop=logs.scrollHeight; }
document.getElementById('runBtn').onclick=run;
document.getElementById('stopBtn').onclick=()=>{frame.srcdoc='';mobileFrame.srcdoc='';status.textContent='Stopped';log('Preview stopped.')};
document.getElementById('clearBtn').onclick=()=>{state[activeTab]='';syncEditor();status.textContent='Editor cleared'};

document.querySelectorAll('.preview-tab').forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll('.preview-tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
    document.getElementById('websitePreview').classList.toggle('hidden',btn.dataset.preview!=='website');
    document.getElementById('mobilePreview').classList.toggle('hidden',btn.dataset.preview!=='mobile');
    document.getElementById('logs').classList.toggle('hidden',btn.dataset.preview!=='logs');
  }
});

document.getElementById('newBtn').onclick=()=>{state.html='';state.css='';state.js='';state.json='';activeTab='html';syncEditor();run();};
document.getElementById('saveBtn').onclick=()=>{
  localStorage.setItem('was-state',JSON.stringify(state));
  saveSettings();
  localStorage.setItem('was-meta',JSON.stringify({
    appName:appName.value,packageName:packageName.value,version:version.value
  }));
  status.textContent='Project saved';
  log('Project saved locally.');
};

document.getElementById('uploadBtn').onclick=async()=>{
  const paths=await window.studioAPI.pickFiles();
  if(!paths.length) return;
  const result=await window.studioAPI.importFiles(paths);
  if(result.ok){
    document.getElementById('fileList').textContent=result.files.join('\\n');
    log(`Imported ${result.files.length} file(s) into the project.`);
  } else log('IMPORT ERROR: '+result.error);
};
document.getElementById('zipBtn').onclick=async()=>{
  const zip=await window.studioAPI.pickZip();
  if(!zip) return;
  log('Importing ZIP project...');
  const result=await window.studioAPI.importZip(zip);
  if(result.ok){
    document.getElementById('fileList').textContent=result.files.join('\\n');
    log(`ZIP imported successfully. ${result.files.length} top-level entries found.`);
  } else log('ZIP IMPORT ERROR: '+result.error);
};
document.getElementById('urlBtn').onclick=async()=>{
  const url=prompt('Website URL (https://...)');
  if(!url) return;
  log('Downloading website and local assets...');
  const result=await window.studioAPI.importUrl(url.trim());
  if(result.ok){
    document.getElementById('fileList').textContent=result.files.join('\n');
    document.getElementById('projectState').textContent=`Project folder: imported from URL (${result.files.length} files)`;
    log(`URL website imported successfully. ${result.files.length} file(s) downloaded.`);
  } else log('URL IMPORT ERROR: '+result.error);
};

document.getElementById('appProtection').addEventListener('change',()=>{updateProtectionUI();saveSettings();});
document.getElementById('protectionType').addEventListener('change',()=>{updateProtectionUI();saveSettings();});
document.getElementById('uploadLogoBtn').onclick=async()=>{
  const r=await window.studioAPI.pickLogo();
  if(r){
    localStorage.setItem('was-logo-path',r.path);
    localStorage.setItem('was-logo-name',r.name);
    document.getElementById('logoPreview').src=await window.studioAPI.readLogoData(r.path);
    document.getElementById('logoStatus').textContent=r.name+' selected.';
    saveSettings(); log('App logo selected.');
  }
};
document.getElementById('removeLogoBtn').onclick=async()=>{
  await window.studioAPI.removeLogo();
  localStorage.removeItem('was-logo-path');localStorage.removeItem('was-logo-name');
  document.getElementById('logoPreview').removeAttribute('src');
  document.getElementById('logoStatus').textContent='No custom logo selected.';
  document.getElementById('logoPath').value='';document.getElementById('logoName').value='';saveSettings();log('Custom app logo removed.');
};

const appName=document.getElementById('appName'),packageName=document.getElementById('packageName'),version=document.getElementById('version');
const modal=document.getElementById('buildModal');
const progress=document.getElementById('progressBar');
const buildLog=document.getElementById('buildLog');
const setStep=(n,t)=>document.getElementById('s'+n).textContent=t;
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}


function preflight(){
  const errors=[];
  const pkg=packageName.value.trim();
  if(!appName.value.trim()) errors.push('App name is empty.');
  if(!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg)) errors.push('Package name must look like com.example.app');
  if(!state.html.trim()) errors.push('HTML editor is empty.');
  if(!/<html[\s>]/i.test(state.html) && !/<body[\s>]/i.test(state.html)) errors.push('HTML does not appear to contain a document/body.');
  return errors;
}


let lastApkPath='';

function extractMarker(output,name){
  const m=output.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':(.+)'));
  return m ? m[1].trim().split(/\r?\n/)[0] : '';
}
async function validateAndSetApk(output){
  const apk=extractMarker(output,'RELEASE_APK_READY') || extractMarker(output,'APK_READY');
  if(!apk) return {ok:false,error:'Build reported success but no APK path was returned.'};
  const v=await window.studioAPI.validateApk(apk);
  if(!v.ok) return v;
  lastApkPath=v.path;
  return v;
}
async function showApkActions(){
  document.getElementById('downloadApkBtn').disabled=!lastApkPath;
}
document.getElementById('createKeystoreBtn').onclick=async()=>{
  const alias=prompt('Key alias (example: my-key):','my-key');
  if(!alias) return;
  const storePassword=prompt('Keystore password (minimum 6 characters):');
  if(storePassword===null) return;
  const keyPassword=prompt('Key password (minimum 6 characters):',storePassword);
  if(keyPassword===null) return;
  const name=appName.value.trim()||'Website APK Studio';
  const r=await window.studioAPI.createKeystore({alias,storePassword,keyPassword,name,organization:'Website APK Studio'});
  if(r.ok){
    document.getElementById('keystorePath').value=r.path;
    document.getElementById('keystoreAlias').value=r.alias;
    saveSettings();
    log('New Android keystore created successfully. Keep this file and passwords safe.');
  } else if(!r.canceled) log('KEYSTORE ERROR: '+r.error);
};
document.getElementById('chooseKeystoreBtn').onclick=async()=>{
  const p=await window.studioAPI.pickKeystore();
  if(p){document.getElementById('keystorePath').value=p; saveSettings(); log('Keystore selected.');}
};
document.getElementById('openOutputBtn').onclick=async()=>{
  if(lastApkPath) await window.studioAPI.showInFolder(lastApkPath);
  else {
    const p='android/app/build/outputs/apk';
    const r=await window.studioAPI.openPath(p);
    if(!r.ok) log('APK OUTPUT: '+r.error);
  }
};
document.getElementById('downloadApkBtn').onclick=async()=>{
  if(!lastApkPath) return;
  const r=await window.studioAPI.saveApk(lastApkPath);
  if(r.ok){status.textContent='APK downloaded';log('APK copied to: '+r.path);}
  else if(!r.canceled) log('DOWNLOAD ERROR: '+r.error);
};
document.getElementById('openApkFolderBtn').onclick=async()=>{
  if(!lastApkPath){log('No validated APK is available yet.');return;}
  await window.studioAPI.showInFolder(lastApkPath);
};
document.getElementById('buildAgainBtn').onclick=()=>{
  modal.classList.add('hidden');
  setTimeout(()=>document.getElementById('releaseBtn').click(),100);
};

document.getElementById('buildBtn').onclick=async()=>{
  state[activeTab]=editor.value;
  const errors=preflight();
  modal.classList.remove('hidden');
  if(errors.length){
    progress.style.width='0%';
    [1,2,3,4].forEach(n=>setStep(n,'Waiting'));
    buildLog.textContent='PRE-BUILD CHECK FAILED:\n- '+errors.join('\n- ');
    setStep(1,'Failed');
    return;
  } progress.style.width='0%'; buildLog.textContent='';
  [1,2,3,4].forEach(n=>setStep(n,'Waiting'));
  setStep(1,'Running');progress.style.width='10%';await sleep(450);
  if(!appName.value.trim()){setStep(1,'Failed');buildLog.textContent='App name is required.';return;}
  setStep(1,'Done');progress.style.width='25%';setStep(2,'Running');await sleep(600);
  if(!state.html.trim()){setStep(2,'Failed');buildLog.textContent='HTML is empty. Add index.html code before building.';return;}
  setStep(2,'Done');progress.style.width='45%';setStep(3,'Running');
  buildLog.textContent='Preparing Capacitor Android project...';
  try{
    const r=await window.studioAPI.runCommand('npx',['cap','sync','android']);
    buildLog.textContent += '\\n'+r.output;
    if(r.code!==0){setStep(3,'Needs setup');setStep(4,'Waiting');progress.style.width='55%';buildLog.textContent+='\\nRun npm install and npx cap add android first.';return;}
    setStep(3,'Done');progress.style.width='70%';setStep(4,'Running');
    const b=await window.studioAPI.runCommand('node',['scripts/build-apk.js']);
    buildLog.textContent += '\\n'+b.output;
    if(b.code===0){setStep(4,'Done');progress.style.width='100%';status.textContent='APK build completed';}
    else {setStep(4,'Failed');progress.style.width='90%';}
  }catch(e){setStep(3,'Failed');buildLog.textContent+=`\\n${e.message}`;}
};

document.getElementById('releaseBtn').onclick=async()=>{
  state[activeTab]=editor.value;
  const errors=preflight();
  modal.classList.remove('hidden'); progress.style.width='0%'; buildLog.textContent='';
  [1,2,3,4].forEach(n=>setStep(n,'Waiting'));
  lastApkPath=''; await showApkActions();
  if(errors.length){setStep(1,'Failed');buildLog.textContent='PRE-BUILD CHECK FAILED:\n- '+errors.join('\n- ');return;}

  setStep(1,'Running'); progress.style.width='12%';
  buildLog.textContent='Running project validation...\n';
  const validation=await window.studioAPI.runCommand('node',['scripts/validate-project.js']);
  buildLog.textContent+=validation.output||'';
  if(validation.code!==0){setStep(1,'Failed');progress.style.width='15%';return;}
  setStep(1,'Done'); progress.style.width='25%';

  const ks=document.getElementById('keystorePath').value.trim();
  const alias=document.getElementById('keystoreAlias').value.trim();
  const storePassword=document.getElementById('keystorePassword').value;
  const keyPassword=document.getElementById('keyPassword').value;
  if(!ks || !alias || !storePassword || !keyPassword){
    setStep(2,'Failed');
    buildLog.textContent+='\nSIGNING CHECK FAILED: Choose a keystore and enter alias, keystore password, and key password.';
    return;
  }
  setStep(2,'Done'); progress.style.width='40%'; setStep(3,'Running');
  buildLog.textContent+='\nPreparing signed Android release...';
  const buildSettings=readSettings();
  buildSettings.backNavigation=buildSettings.backNav;
  buildSettings.logoPath=localStorage.getItem('was-logo-path')||buildSettings.logoPath||'';
  buildSettings.logoName=localStorage.getItem('was-logo-name')||buildSettings.logoName||'';
  buildSettings.protectionPasswordHash='';
  if(buildSettings.appProtection){
    if(buildSettings.protectionType==='password'){
      const password=document.getElementById('appProtectionPassword').value;
      if(password.length<4){setStep(2,'Failed');buildLog.textContent+='\nPROTECTION CHECK FAILED: Set an opening password of at least 4 characters.';return;}
      const hashed=await window.studioAPI.hashPassword(password);
      if(!hashed.ok){setStep(2,'Failed');buildLog.textContent+='\nPROTECTION CHECK FAILED: '+hashed.error;return;}
      buildSettings.protectionPasswordHash=hashed.hash;
    } else {
      buildSettings.otpApiUrl=(document.getElementById('otpApiUrl').value||'').trim();
      if(!/^https?:\/\//i.test(buildSettings.otpApiUrl)){setStep(2,'Failed');buildLog.textContent+='\nPROTECTION CHECK FAILED: Enter a valid HTTPS OTP service URL.';return;}
    }
  }
  await window.studioAPI.saveBuildSettings(buildSettings);
  localStorage.setItem('was-settings',JSON.stringify(readSettings()));
  const result=await window.studioAPI.buildRelease({
    keystorePath:ks,keystoreAlias:alias,keystorePassword:storePassword,keyPassword:keyPassword
  });
  buildLog.textContent+=result.output||'';
  if(result.code!==0){setStep(3,'Failed');setStep(4,'Failed');progress.style.width='75%';return;}
  setStep(3,'Done'); progress.style.width='82%'; setStep(4,'Running');
  const checked=await validateAndSetApk(result.output||'');
  if(!checked.ok){setStep(4,'Failed');buildLog.textContent+=`\nAPK VALIDATION FAILED: ${checked.error}`;progress.style.width='90%';return;}
  setStep(4,'Done'); progress.style.width='100%';
  status.textContent='Signed APK validated successfully';
  buildLog.textContent+=`\n\nAPK VALIDATED: ${checked.path}\nSize: ${checked.size} bytes`;
  await showApkActions();
};
document.getElementById('closeModal').onclick=()=>modal.classList.add('hidden');

loadSettings(); syncEditor(); run();
