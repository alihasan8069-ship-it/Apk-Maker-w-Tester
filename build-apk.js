const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd,args,opts={}) {
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{shell:true,stdio:'inherit',...opts});
    p.on('close',code=>code===0?resolve():reject(new Error(`${cmd} failed with code ${code}`)));
    p.on('error',reject);
  });
}

(async()=>{
  try {
    const root=process.cwd();
    const android=path.join(root,'android');
    if(!fs.existsSync(android)) {
      console.error('Android project not initialized.');
      console.error('Run: npm run android:add');
      process.exit(2);
    }

    await run('node',['scripts/prepare-project.js']);
    await run('npx',['cap','sync','android']);

    const gradle=process.platform==='win32'?'gradlew.bat':'./gradlew';
    await run(gradle,['assembleDebug'],{cwd:android});

    const apk=path.join(android,'app','build','outputs','apk','debug','app-debug.apk');
    if(fs.existsSync(apk)) {
      console.log(`APK_READY:${apk}`);
      console.log('BUILD_STATUS:SUCCESS');
    } else {
      throw new Error('Gradle finished but APK file was not found.');
    }
  } catch(e) {
    console.error('BUILD_STATUS:FAILED');
    console.error(e.message);
    process.exit(1);
  }
})();