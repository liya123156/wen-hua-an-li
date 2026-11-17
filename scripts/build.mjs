import{mkdirSync,copyFileSync,readdirSync,readFileSync}from'node:fs';
import{join}from'node:path';
mkdirSync('dist',{recursive:true});
for(const f of readdirSync('src'))copyFileSync(join('src',f),join('dist',f));
if(!readFileSync('dist/config.js','utf8').includes('sb_publishable_'))throw Error('Missing publishable client configuration');
console.log('Static build ready: dist/');
