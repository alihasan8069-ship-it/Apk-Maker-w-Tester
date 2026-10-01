const fs=require('fs');
const path=require('path');

const root=process.cwd();
const settingsPath=path.join(root,'studio-settings.json');
let s={};
if(fs.existsSync(settingsPath)) s=JSON.parse(fs.readFileSync(settingsPath,'utf8'));

const required=['appName','packageName','version'];
for(const k of required) if(!s[k]) throw new Error(`Missing setting: ${k}`);

const safe=(x)=>String(x).replace(/[^a-zA-Z0-9._-]/g,'_');
const gradleProps=path.join(root,'android','gradle.properties');
if(fs.existsSync(gradleProps)){
  let t=fs.readFileSync(gradleProps,'utf8');
  if(!t.includes('android.useAndroidX=true')) t += '\nandroid.useAndroidX=true\n';
  fs.writeFileSync(gradleProps,t);
}
console.log('RELEASE_CONFIG_READY');
console.log(`APP:${s.appName}`);
console.log(`PACKAGE:${s.packageName}`);
console.log(`VERSION:${s.version}`);
console.log(`KEYSTORE:${s.keystorePath||'not configured'}`);
