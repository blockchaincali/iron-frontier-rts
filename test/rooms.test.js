'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),Module=require('node:module');
class FakeWebSocket extends EventEmitter{constructor(){super();this.readyState=1;this.received=[];this.alive=true}send(message){this.received.push(JSON.parse(message))}close(){this.readyState=3;this.emit('close')}ping(){this.emit('pong')}receive(payload){this.emit('message',Buffer.from(JSON.stringify(payload)))}last(type){return [...this.received].reverse().find(m=>m.type===type)}}
FakeWebSocket.OPEN=1;
class FakeWSS extends EventEmitter{constructor(){super();this.clients=new Set();globalThis.__testWss=this}connect(){const ws=new FakeWebSocket();this.clients.add(ws);this.emit('connection',ws);return ws}}
const originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==='ws')return {WebSocket:FakeWebSocket,WebSocketServer:FakeWSS};return originalLoad.call(this,request,parent,isMain)};
const {rooms,server}=require('../server');Module._load=originalLoad;
const wss=globalThis.__testWss;
function create(ws,mode='solo'){ws.receive({type:'create',mode,name:'Tester'});const joined=ws.last('joined');assert.ok(joined);return joined}
test('Solo server creates playable game and relays purchases and commands',()=>{
 const ws=wss.connect(),j=create(ws);const room=rooms.get(j.code);assert.equal(room.game.phase,'playing');assert.equal(room.game.participants.length,2);
 const credits=room.game.teams[0].credits;ws.receive({type:'build',unitType:'rifle'});assert.equal(room.game.teams[0].credits,credits-60);
 const own=room.game.units.find(u=>u.team===0);ws.receive({type:'command',action:'move',unitIds:[own.id],x:700,y:300});assert.equal(own.order,'move');
 ws.receive({type:'ability',x:820,y:450});assert.ok(room.game.blasts.length>0);
 room.game.end(0,'TEST');ws.receive({type:'start'});assert.equal(room.game.phase,'playing');assert.equal(room.game.round,2);
 ws.receive({type:'leave'});assert.equal(ws.room,null);assert.equal(room.game.participants[0].connected,false);
});
test('Online 1v1 host and guest can enter a room and launch',()=>{
 const a=wss.connect(),b=wss.connect();const roomCode=create(a,'pvp').code;
 assert.equal(rooms.get(roomCode).game.phase,'lobby');b.receive({type:'join',code:roomCode,name:'Opponent'});
 assert.equal(b.last('joined').team,1);const room=rooms.get(roomCode);assert.equal(room.game.participants.length,2);
 b.receive({type:'start'});assert.equal(room.game.phase,'lobby');assert.equal(b.last('error').message,'Only host can start');
 a.receive({type:'start'});assert.equal(room.game.phase,'playing');
 const rival=room.game.units.find(u=>u.team===0),own=room.game.units.find(u=>u.team===1);
 b.receive({type:'command',action:'move',unitIds:[rival.id],x:900,y:450});assert.equal(b.last('notice').message,'Select your units first');
 b.receive({type:'command',action:'move',unitIds:[own.id],x:950,y:450});assert.equal(own.order,'move');
});
test('Reconnect from a second socket recovers existing participant instead of creating duplicates',()=>{
 const a=wss.connect();const first=create(a,'pvp');const newcomer=wss.connect();newcomer.receive({type:'join',code:first.code,id:first.id,name:'Tester'});
 assert.equal(newcomer.last('joined').existing,true);assert.equal(rooms.get(first.code).game.participants.length,1);
 assert.equal(a.readyState,3);
});
test('Multiplayer host map and terrain seed are authoritative for every participant',()=>{
 const host=wss.connect(),guest=wss.connect();host.receive({type:'create',mode:'pvp',name:'Host',mapId:'desert'});const joined=host.last('joined');guest.receive({type:'join',code:joined.code,name:'Guest',mapId:'frozen'});
 const hostState=host.last('state'),guestState=guest.last('state');assert.equal(hostState.mapId,'desert');assert.equal(guestState.mapId,'desert');assert.equal(hostState.terrainSeed,guestState.terrainSeed);assert.ok(Number.isInteger(hostState.terrainSeed));
});
test('Solo tutorial protection is authoritative and ends only on trainee command',()=>{
 const ws=wss.connect();ws.receive({type:'create',mode:'solo',difficulty:'recruit',training:true,name:'Trainee'});const joined=ws.last('joined'),room=rooms.get(joined.code);assert.equal(room.game.training,true);room.game.step(5);assert.equal(room.game.time,0);assert.equal(ws.last('state').training,true);
 ws.receive({type:'trainingComplete'});assert.equal(room.game.training,false);assert.equal(ws.last('state').training,false);
});
