'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {WebSocket,WebSocketServer}=require('ws');
const {Game}=require('./src/engine');
const {get:getMap}=require('./public/maps');
const PORT=Number(process.env.PORT||3000),rooms=new Map(),STEP=0.05;
const uid=()=>crypto.randomBytes(9).toString('hex');
const newCode=()=>Array.from(crypto.randomBytes(4),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
const staticFiles={'/maps.js':'maps.js','/3d.js':'3d.js','/3d.css':'3d.css','/home.js':'home.js','/town.js':'town.js','/platform.js':'platform.js','/audio.js':'audio.js','/catalog.js':'catalog.js','/':'index.html','/index.html':'index.html','/style.css':'style.css','/game.js':'game.js','/assets/iron-frontier-hero.webp':'assets/iron-frontier-hero.webp','/assets/homestand-poster.jpg':'assets/homestand-poster.jpg','/assets/3d/coastal-ground-albedo.jpg':'assets/3d/coastal-ground-albedo.jpg','/assets/3d/azure-armor-albedo.jpg':'assets/3d/azure-armor-albedo.jpg','/assets/3d/crimson-armor-albedo.jpg':'assets/3d/crimson-armor-albedo.jpg','/assets/3d/impact-explosion.png':'assets/3d/impact-explosion.png'};
// Browsers receive the minified Three.js build; the stable /vendor/three.module.js URL keeps the import map unchanged.
const vendorFiles={'/vendor/three.module.js':['three','build','three.module.min.js'],'/vendor/three.core.min.js':['three','build','three.core.min.js'],'/vendor/three.core.js':['three','build','three.core.min.js'],'/vendor/BufferGeometryUtils.js':['three','examples','jsm','utils','BufferGeometryUtils.js']};
const compressible=/\.(html|css|js)$/,responseCache=new Map();
function serveFile(req,res,filePath,cacheControl){
 fs.stat(filePath,(statError,stat)=>{if(statError){res.writeHead(404);return res.end('Not found')}
  const type=contentType[path.extname(filePath)]||'application/octet-stream',etag='"'+stat.size.toString(36)+'-'+Math.floor(stat.mtimeMs).toString(36)+'"',gzip=compressible.test(filePath)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
  const headers={'Content-Type':type,'Cache-Control':cacheControl,ETag:etag,Vary:'Accept-Encoding'};
  if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end()}
  const key=filePath+(gzip?':gz':''),cached=responseCache.get(key),finish=body=>{if(gzip)headers['Content-Encoding']='gzip';headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body)};
  if(cached?.etag===etag)return finish(cached.body);
  fs.readFile(filePath,(readError,data)=>{if(readError){res.writeHead(404);return res.end('Not found')}const body=gzip?zlib.gzipSync(data,{level:9}):data;responseCache.set(key,{etag,body});finish(body)})
 })
}
const contentType={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(vendorFiles[pathname])return serveFile(req,res,path.join(__dirname,'node_modules',...vendorFiles[pathname]),'public, max-age=604800');
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({status:'ok',game:'HOMESTAND',rooms:rooms.size}))}
 const file=staticFiles[pathname];if(!file){res.writeHead(404);return res.end('Not found')}
 serveFile(req,res,path.join(__dirname,'public',file),'public,max-age=60')
});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:8192});
const participants=room=>room.game.participants;
const broadcast=(room,payload)=>{for(const p of participants(room))if(!p.bot)send(room.sockets.get(p.id),payload)};
const broadcastState=room=>{
 const snap=room.game.snapshot();
 for(const p of participants(room))if(!p.bot)send(room.sockets.get(p.id),{type:'state',me:p.id,team:p.team,host:p.id===room.hostId,...snap,mines:room.game.visibleMines(p.team),events:room.game.scenario==='territory'?snap.events.filter(e=>e.team===null||e.team===undefined||e.team===p.team):snap.events});
};
function register(ws,room,p,existing=false){
 const old=room.sockets.get(p.id);if(old&&old!==ws){try{old.close(4000,'Reconnected')}catch{}}
 ws.room=room.code;ws.playerId=p.id;room.sockets.set(p.id,ws);p.connected=true;room.lastActivity=Date.now();
 send(ws,{type:'joined',code:room.code,id:p.id,team:p.team,existing});broadcastState(room)
}
function create(ws,msg){
 if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
 let code=newCode();while(rooms.has(code))code=newCode();
 const mode=msg.mode==='pvp'?'pvp':'solo',missionId=mode==='solo'&&msg.missionId==='safe-haven'?'safe-haven':null,scenario=!missionId&&msg.scenario==='territory'?'territory':null,hostTeam=scenario&&msg.faction==='raiders'?1:0,prepMinutes=[3,5].includes(Number(msg.prepMinutes))?Number(msg.prepMinutes):5;const difficulty=mode==='solo'&&['recruit','standard','veteran'].includes(msg.difficulty)?msg.difficulty:'recruit';const map=getMap(missionId||(scenario?'frontier':String(msg.mapId||''))),terrainSeed=(map.seed^Buffer.from(code).reduce((value,byte)=>Math.imul(value^byte,16777619)>>>0,2166136261))>>>0;const game=new Game({mode,roomCode:code,difficulty,mapId:map.id,terrainSeed,missionId,scenario,prepMinutes,theatreId:String(msg.theatreId||''),training:mode==='solo'&&(missionId==='safe-haven'||msg.training===true),guided:msg.guided===true});
 const room={code,game,hostId:null,sockets:new Map(),lastActivity:Date.now()};rooms.set(code,room);
 const id=uid(),name=String(msg.name||'Commander').trim().slice(0,18)||'Commander';game.addParticipant(id,name,hostTeam,false);room.hostId=id;
 if(mode==='solo')game.addParticipant(uid(),scenario?(hostTeam===0?'RAIDER COMMAND AI':'DEFENCE COMMAND AI'):'CRIMSON BOT',1-hostTeam,true);
 register(ws,room,game.participants[0]);if(mode==='solo'){game.start();broadcastState(room)}
}
function join(ws,msg){
 if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
 const code=String(msg.code||'').toUpperCase();const room=rooms.get(code);
 if(!room)return send(ws,{type:'error',message:'Room expired or not found'});
 const id=String(msg.id||'');let p=room.game.participants.find(p=>p.id===id&&!p.bot);
 if(p){register(ws,room,p,true);return}
 if(room.game.phase!=='lobby')return send(ws,{type:'error',message:'Match already started; you need an existing player session'});
 if(room.game.mode!=='pvp'||room.game.participants.filter(p=>!p.bot).length>=2)return send(ws,{type:'error',message:'This room is full'});
 const playerId=uid(),freeTeam=[0,1].find(t=>!room.game.participants.some(p=>p.team===t));room.game.addParticipant(playerId,String(msg.name||'Commander').slice(0,18),freeTeam,false);
 p=room.game.participants.find(p=>p.id===playerId);register(ws,room,p)
}
function action(ws,msg){
 const room=rooms.get(ws.room),player=room?.game.participants.find(p=>p.id===ws.playerId&&!p.bot);
 if(!room||!player||room.sockets.get(player.id)!==ws)return;
 const game=room.game;let outcome;
 switch(msg.type){
  case 'start':if(room.hostId!==player.id)return send(ws,{type:'error',message:'Only host can start'});outcome=game.start()?{ok:true}:{ok:false,reason:'Waiting for opposing commander'};break;
  case 'build':outcome=game.spawn(player.team,String(msg.unitType||''));break;
  case 'construct':outcome=game.constructionSite(player.team,String(msg.structureType||''),msg.x,msg.y,msg.builderIds,msg.plotId?String(msg.plotId):null);break;
  case 'assist':outcome=game.assistStructure(player.team,String(msg.structureId||''),msg.builderIds);break;
  case 'produce':outcome=game.produce(player.team,String(msg.structureId||''),String(msg.unitType||''));break;
  case 'repair':outcome=game.repairStructure(player.team,String(msg.structureId||''),msg.builderIds);break;
  case 'upgrade':outcome=game.upgradeStructure(player.team,String(msg.structureId||''));break;
  case 'command':outcome=game.command(player.team,msg.unitIds,msg.action,msg.x,msg.y,msg.targetId);break;
  case 'ability':outcome=game.orbital(player.team,msg.x,msg.y);break;
  case 'plant':outcome=game.plantIed(player.team,msg.unitIds,msg.x,msg.y);if(outcome.ok)send(ws,{type:'notice',message:'Charge team moving to the site'});break;
  case 'defuse':outcome=game.defuseIed(player.team,msg.unitIds,msg.mineId?String(msg.mineId):null);if(outcome.ok)send(ws,{type:'notice',message:'Eagle-Eye moving in to defuse'});break;
  case 'trainingComplete':outcome=game.completeTraining(player.team);break;
  case 'tutorialComplete':outcome=game.tutorialComplete(player.team);break;
  case 'surrender':if(game.phase==='playing')game.end(1-player.team,'SURRENDER');outcome={ok:true};break;
  case 'leave':{
   if(game.phase==='playing'&&!game.participants.some(v=>v.bot))game.end(1-player.team,'OPPONENT LEFT');
   room.sockets.delete(player.id);player.connected=false;room.lastActivity=Date.now();
   ws.room=null;ws.playerId=null;broadcastState(room);return;
  }
  default:return;
 }
 if(!outcome.ok)send(ws,{type:'notice',message:outcome.reason||'Not available'});
  else if(msg.type==='build')send(ws,{type:'notice',message:'Unit deployed: '+String(msg.unitType).toUpperCase()});
  else if(msg.type==='construct')send(ws,{type:'notice',message:'Construction team dispatched'});
 broadcastState(room)
}
wss.on('connection',ws=>{
 ws.alive=true;ws.on('pong',()=>{ws.alive=true});
 ws.on('message',raw=>{let msg;try{msg=JSON.parse(raw.toString())}catch{return}
  if(!msg||typeof msg!=='object')return;
  if(msg.type==='create')return create(ws,msg);
  if(msg.type==='join')return join(ws,msg);
  action(ws,msg);
 });
 ws.on('close',()=>{
  const room=rooms.get(ws.room);const p=room?.game.participants.find(p=>p.id===ws.playerId);
  if(p&&room.sockets.get(p.id)===ws){room.sockets.delete(p.id);p.connected=false;room.lastActivity=Date.now();broadcastState(room)}
 });
});
let accumulator=0,last=performance.now(),broadcastClock=0;
const loop=setInterval(()=>{
 const now=performance.now();accumulator=Math.min(0.25,accumulator+(now-last)/1000);last=now;
 while(accumulator>=STEP){for(const room of rooms.values())if(room.game.phase==='playing')room.game.step(STEP);accumulator-=STEP;broadcastClock+=STEP}
 if(broadcastClock>=0.15){broadcastClock=0;for(const room of rooms.values())if(room.game.phase==='playing')broadcastState(room)}
 const age=Date.now();for(const [code,room] of rooms){if(![...room.sockets.values()].some(ws=>ws.readyState===WebSocket.OPEN)&&age-room.lastActivity>5*60*1000)rooms.delete(code)}
},50);loop.unref();
const keepalive=setInterval(()=>{for(const ws of wss.clients){if(ws.alive===false){ws.terminate();continue}ws.alive=false;ws.ping()}},25000);keepalive.unref();
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`HOMESTAND listening on ${PORT}`));
module.exports={server,rooms};
