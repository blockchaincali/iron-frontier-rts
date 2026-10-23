'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=__dirname;
function unpack(){
 const bundle=fs.readFileSync(path.join(root,'source.bundle.b64'),'utf8').trim();
 const files=JSON.parse(zlib.gunzipSync(Buffer.from(bundle,'base64')).toString('utf8'));
 for(const [name,entry] of Object.entries(files)){
  if(name.startsWith('/')||name.split('/').some(x=>x==='..'))throw Error('Invalid bundle path');
  const file=path.join(root,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,entry.encoding==='base64'?Buffer.from(entry.data,'base64'):entry.data);
 }
 return Object.keys(files).length;
}
console.log('IRON FRONTIER: restored '+unpack()+' source files');
if(process.argv.includes('--extract'))process.exit(0);
if(process.argv.includes('--test')){
 const {spawnSync}=require('node:child_process');
 const result=spawnSync(process.execPath,['--test','test/engine.test.js','test/rooms.test.js'],{stdio:'inherit',cwd:root});
 process.exit(result.status??1);
}
require('./server.js');
