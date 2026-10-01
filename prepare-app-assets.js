const fs=require('fs');
const path=require('path');
const root=process.cwd();
const settingsPath=path.join(root,'studio-settings.json');
let settings={}; if(fs.existsSync(settingsPath)) settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
const android=path.join(root,'android');
if(!fs.existsSync(android)){console.log('APP_ASSETS:ANDROID_PROJECT_MISSING');process.exit(0);}
const logo=String(settings.logoPath||'');
if(!logo || !fs.existsSync(logo)){console.log('APP_LOGO:DEFAULT');process.exit(0);}
const ext=path.extname(logo).toLowerCase();
if(!['.png','.jpg','.jpeg','.webp'].includes(ext)) throw new Error('App logo must be PNG, JPG, JPEG, or WEBP.');
const res=path.join(android,'app','src','main','res','drawable');
fs.mkdirSync(res,{recursive:true});
const dest=path.join(res,'app_logo'+ext);
for(const n of ['app_logo.png','app_logo.jpg','app_logo.jpeg','app_logo.webp']) fs.rmSync(path.join(res,n),{force:true});
fs.copyFileSync(logo,dest);
const manifest=path.join(android,'app','src','main','AndroidManifest.xml');
if(fs.existsSync(manifest)){
 let s=fs.readFileSync(manifest,'utf8');
 s=s.replace(/android:icon="[^"]*"/,'android:icon="@drawable/app_logo"');
 s=s.replace(/android:roundIcon="[^"]*"/,'android:roundIcon="@drawable/app_logo"');
 fs.writeFileSync(manifest,s);
}
console.log(`APP_LOGO:${dest}`);
