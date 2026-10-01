const fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.cwd(), dir=path.join(root,'project');
const errors=[], warnings=[];
function exists(p){return fs.existsSync(p);}
if(!exists(dir)) errors.push('Project folder is missing.');
const index=path.join(dir,'index.html');
if(!exists(index)) errors.push('Missing project/index.html.');
else {
 const html=fs.readFileSync(index,'utf8');
 if(!/<html[\s>]/i.test(html)) warnings.push('index.html has no <html> element.');
 if(!/<\/html>/i.test(html)) warnings.push('index.html appears to be missing </html>.');
 for(const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*["']([^"']+)["']/gi)){
   const ref=m[1]; if(/^(https?:|data:|#|javascript:)/i.test(ref)) continue;
   const clean=ref.split('?')[0].split('#')[0].replace(/^\/+/,'');
   if(clean && !exists(path.resolve(dir,clean))) errors.push(`Missing referenced file: ${clean}`);
 }
}
function checkJs(p,label){
 if(!exists(p)) return;
 try { new vm.Script(fs.readFileSync(p,'utf8'),{filename:p}); }
 catch(e){ errors.push(`${label} syntax error: ${e.message}`); }
}
checkJs(path.join(dir,'script.js'),'script.js');
const files=[]; function walk(d){
 for(const n of fs.readdirSync(d)){const p=path.join(d,n),st=fs.statSync(p);if(st.isDirectory())walk(p);else files.push(path.relative(dir,p));}
}
if(exists(dir)) walk(dir);
console.log(`VALIDATION_FILES:${files.length}`);
warnings.forEach(x=>console.log('WARNING:'+x));
errors.forEach(x=>console.log('ERROR:'+x));
if(errors.length){console.log('VALIDATION_STATUS:FAILED');process.exit(1);}
console.log('VALIDATION_STATUS:PASS');
