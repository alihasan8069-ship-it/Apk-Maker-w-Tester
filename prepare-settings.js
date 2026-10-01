const fs=require('fs');
const path=require('path');

const root=process.cwd();
const metaFile=path.join(root,'studio-settings.json');
const defaults={
  appName:'My Website App',
  packageName:'com.example.mywebsiteapp',
  version:'1.0.0',
  orientation:'portrait',
  fullscreen:false,
  backNavigation:true,
  downloads:true,
  uploads:true,
  camera:false,
  microphone:false,
  notifications:false,
  location:false,
  backNavigation:true,
  appProtection:false,
  protectionType:'password',
  protectionPasswordHash:'',
  otpApiUrl:'',
  logoPath:'',
  logoName:''
};

let settings=defaults;
if(fs.existsSync(metaFile)){
  try { settings={...defaults,...JSON.parse(fs.readFileSync(metaFile,'utf8'))}; } catch {}
}
fs.writeFileSync(metaFile,JSON.stringify(settings,null,2));

const capPath=path.join(root,'capacitor.config.json');
const cap={
  appId:settings.packageName,
  appName:settings.appName,
  webDir:'www',
  android:{
    allowMixedContent:false
  },
  server:{androidScheme:'https'}
};
fs.writeFileSync(capPath,JSON.stringify(cap,null,2));

console.log('APP_CONFIG_READY');
console.log(`APP_NAME:${settings.appName}`);
console.log(`PACKAGE:${settings.packageName}`);
console.log(`VERSION:${settings.version}`);
