const fs=require('fs');
const path=require('path');

const root=process.cwd();
const source=path.join(root,'project');
const target=path.join(root,'www');

if(!fs.existsSync(source)){
  console.log('No imported project folder yet; using existing www folder.');
  process.exit(0);
}

function copyDir(src,dst){
  fs.mkdirSync(dst,{recursive:true});
  for(const name of fs.readdirSync(src)){
    const s=path.join(src,name), d=path.join(dst,name);
    const st=fs.statSync(s);
    if(st.isDirectory()) copyDir(s,d);
    else fs.copyFileSync(s,d);
  }
}

if(!fs.existsSync(path.join(source,'index.html'))){
  console.error('PROJECT_ERROR: index.html is missing.');
  process.exit(1);
}
fs.rmSync(target,{recursive:true,force:true});
copyDir(source,target);
console.log('PROJECT_READY: website files copied to www');
