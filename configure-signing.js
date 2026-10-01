const fs=require('fs'), path=require('path');
const root=process.cwd(), file=path.join(root,'android','app','build.gradle');
if(!fs.existsSync(file)) throw new Error('android/app/build.gradle not found.');
let s=fs.readFileSync(file,'utf8');

const block=`
/* WEBSITE_APK_STUDIO_SIGNING_START */
def wasStoreFile = project.findProperty('WAS_STORE_FILE') ?: System.getenv('WAS_STORE_FILE')
def wasStorePassword = project.findProperty('WAS_STORE_PASSWORD') ?: System.getenv('WAS_STORE_PASSWORD')
def wasKeyAlias = project.findProperty('WAS_KEY_ALIAS') ?: System.getenv('WAS_KEY_ALIAS')
def wasKeyPassword = project.findProperty('WAS_KEY_PASSWORD') ?: System.getenv('WAS_KEY_PASSWORD')

android {
    signingConfigs {
        release {
            if (wasStoreFile && wasStorePassword && wasKeyAlias && wasKeyPassword) {
                storeFile file(wasStoreFile)
                storePassword wasStorePassword
                keyAlias wasKeyAlias
                keyPassword wasKeyPassword
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
/* WEBSITE_APK_STUDIO_SIGNING_END */
`;

const start='/* WEBSITE_APK_STUDIO_SIGNING_START */', end='/* WEBSITE_APK_STUDIO_SIGNING_END */';
const a=s.indexOf(start), b=s.indexOf(end);
if(a>=0 && b>=0) s=s.slice(0,a)+block.trim()+s.slice(b+end.length);
else s += '\n'+block;
fs.writeFileSync(file,s);
console.log('SIGNING_CONFIGURED');
