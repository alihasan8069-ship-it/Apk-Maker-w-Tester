const {spawn}=require('child_process');
const fs=require('fs'), path=require('path');

function run(cmd,args,opts={}) {
 return new Promise((resolve,reject)=>{
  const p=spawn(cmd,args,{shell:false,stdio:'inherit',...opts});
  p.on('close',c=>c===0?resolve():reject(new Error(`${cmd} failed (${c})`)));
  p.on('error',reject);
 });
}

function requireEnv(name){ const v=process.env[name]; if(!v) throw new Error(`${name} is required for a signed release build.`); return v; }

(async()=>{
 try{
  const root=process.cwd(), android=path.join(root,'android');
  if(!fs.existsSync(android)) throw new Error('Android project missing. Run npm run android:add first.');
  const keystore=requireEnv('WAS_KEYSTORE_PATH');
  const alias=requireEnv('WAS_KEY_ALIAS');
  const storePassword=requireEnv('WAS_KEYSTORE_PASSWORD');
  const keyPassword=requireEnv('WAS_KEY_PASSWORD');
  if(!fs.existsSync(keystore)) throw new Error(`Keystore not found: ${keystore}`);

  await run('node',['scripts/prepare-project.js']);
  await run('node',['scripts/prepare-settings.js']);
  await run('node',['scripts/prepare-app-protection.js']);
  await run('npx',['cap','sync','android']);
  await run('node',['scripts/prepare-app-assets.js']);
  await run('node',['scripts/configure-signing.js'],{env:{...process.env}});

  const gradle=process.platform==='win32'?'gradlew.bat':'./gradlew';
  await run(gradle,['assembleRelease',
    `-PWAS_STORE_FILE=${keystore}`,
    `-PWAS_STORE_PASSWORD=${storePassword}`,
    `-PWAS_KEY_ALIAS=${alias}`,
    `-PWAS_KEY_PASSWORD=${keyPassword}`
  ],{cwd:android,env:{...process.env,
    WAS_STORE_FILE:keystore,WAS_STORE_PASSWORD:storePassword,WAS_KEY_ALIAS:alias,WAS_KEY_PASSWORD:keyPassword
  }});

  const relDir=path.join(android,'app','build','outputs','apk','release');
  const apks=fs.existsSync(relDir)?fs.readdirSync(relDir).filter(x=>x.endsWith('.apk')):[];
  if(!apks.length) throw new Error('Gradle finished but no release APK was found.');
  const apk=path.join(relDir,apks[0]);
  const st=fs.statSync(apk);
  if(st.size<1024) throw new Error('Generated APK is unexpectedly small.');
  const fd=fs.openSync(apk,'r'), head=Buffer.alloc(2); fs.readSync(fd,head,0,2,0); fs.closeSync(fd);
  if(head.toString('ascii')!=='PK') throw new Error('Generated file is not a valid APK/ZIP.');
  console.log(`RELEASE_APK_READY:${apk}`);
  console.log(`APK_SIZE:${st.size}`);
  console.log('BUILD_STATUS:SUCCESS');
 }catch(e){console.error('BUILD_STATUS:FAILED');console.error(e.message);process.exit(1)}
})()
