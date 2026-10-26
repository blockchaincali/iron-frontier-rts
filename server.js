'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocket,WebSocketServer}=require('ws');
const {Game}=require('./src/engine');
const {get:getMap}=require('./public/maps');
const PORT=Number(process.env.PORT||3000),rooms=new Map(),STEP=0.05;
const uid=()=>crypto.randomBytes(9).toString('hex');
const newCode=()=>Array.from(crypto.randomBytes(4),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const send=(ws,data)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data))};
const staticFiles={'/maps.js':'maps.js','/3d.js':'3d.js','/3d.css':'3d.css','/':'index.html','/index.html':'index.html','/style.css':'style.css','/game.js':'game.js','/assets/iron-frontier-hero.webp':'assets/iron-frontier-hero.webp','/assets/3d/coastal-ground-albedo.jpg':'assets/3d/coastal-ground-albedo.jpg','/assets/3d/azure-armor-albedo.jpg':'assets/3d/azure-armor-albedo.jpg','/assets/3d/crimson-armor-albedo.jpg':'assets/3d/crimson-armor-albedo.jpg','/assets/3d/impact-explosion.png':'assets/3d/impact-explosion.png'};
const contentType={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/vendor/three.module.js'||pathname==='/vendor/three.core.js'||pathname==='/vendor/BufferGeometryUtils.js'){const threeFile=pathname.endsWith('BufferGeometryUtils.js')?path.join(__dirname,'node_modules','three','examples','jsm','utils','BufferGeometryUtils.js'):path.join(__dirname,'node_modules','three','build',pathname.endsWith('three.core.js')?'three.core.js':'three.module.js');return fs.readFile(threeFile,(err,data)=>{if(err){res.writeHead(503);return res.end('3D library unavailable')}res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=604800'});res.end(data)})}
 if(pathname==='/healthz'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({status:'ok',game:'Iron Frontier',rooms:rooms.size}))}
 const file=staticFiles[pathname];if(!file){res.writeHead(404);return res.end('Not found')}
 const filePath=path.join(__dirname,'public',file);
 fs.readFile(filePath,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':contentType[path.extname(file)]||'application/octet-stream','Cache-Control':'public,max-age=60'});res.end(data)})
});
const wss=new WebSocketServer({server,path:'/ws',maxPayload:8192});
const participants=room=>room.game.participants;
const broadcast=(room,payload)=>{for(const p of participants(room))if(!p.bot)send(room.sockets.get(p.id),payload)};
const broadcastState=room=>{
 const snap=room.game.snapshot();
 for(const p of participants(room))if(!p.bot)send(room.sockets.get(p.id),{type:'state',me:p.id,team:p.team,host:p.id===room.hostId,...snap});
};
function register(ws,room,p,existing=false){
 const old=room.sockets.get(p.id);if(old&&old!==ws){try{old.close(4000,'Reconnected')}catch{}}
 ws.room=room.code;ws.playerId=p.id;room.sockets.set(p.id,ws);p.connected=true;room.lastActivity=Date.now();
 send(ws,{type:'joined',code:room.code,id:p.id,team:p.team,existing});broadcastState(room)
}
function create(ws,msg){
 if(ws.room)return send(ws,{type:'error',message:'Already in a room'});
 let code=newCode();while(rooms.has(code))code=newCode();
 const mode=msg.mode==='pvp'?'pvp':'solo';const difficulty=mode==='solo'&&['recruit','standard','veteran'].includes(msg.difficulty)?msg.difficulty:'recruit';const map=getMap(String(msg.mapId||'')),terrainSeed=(map.seed^Buffer.from(code).reduce((value,byte)=>Math.imul(value^byte,16777619)>>>0,2166136261))>>>0;const game=new Game({mode,roomCode:code,difficulty,mapId:map.id,terrainSeed,training:mode==='solo'&&msg.training===true});
 const room={code,game,hostId:null,sockets:new Map(),lastActivity:Date.now()};rooms.set(code,room);
 const id=uid(),name=String(msg.name||'Commander').trim().slice(0,18)||'Commander';game.addParticipant(id,name,0,false);room.hostId=id;
 if(mode==='solo')game.addParticipant(uid(),'CRIMSON BOT',1,true);
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
 const playerId=uid();room.game.addParticipant(playerId,String(msg.name||'Commander').slice(0,18),1,false);
 p=room.game.participants.find(p=>p.id===playerId);register(ws,room,p)
}
function action(ws,msg){
 const room=rooms.get(ws.room),player=room?.game.participants.find(p=>p.id===ws.playerId&&!p.bot);
 if(!room||!player||room.sockets.get(player.id)!==ws)return;
 const game=room.game;let outcome;
 switch(msg.type){
  case 'start':if(room.hostId!==player.id)return send(ws,{type:'error',message:'Only host can start'});outcome=game.start()?{ok:true}:{ok:false,reason:'Waiting for opposing commander'};break;
  case 'build':outcome=game.spawn(player.team,String(msg.unitType||''));break;
  case 'command':outcome=game.command(player.team,msg.unitIds,msg.action,msg.x,msg.y,msg.targetId);break;
  case 'ability':outcome=game.orbital(player.team,msg.x,msg.y);break;
  case 'trainingComplete':outcome=game.completeTraining(player.team);break;
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
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log(`IRON FRONTIER listening on ${PORT}`));
module.exports={server,rooms};
