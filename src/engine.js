'use strict';
const {W,H,BOUNDS,UNITS,START_CREDITS,MAX_SUPPLY,MAX_TIME,WIN_SCORE,NODES}=require('./config');
const rnum=(min,max)=>min+Math.random()*(max-min);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const teamName=t=>t===0?'AZURE UNION':'CRIMSON LEGION';

class Game {
 constructor({mode='solo',roomCode='TEST',duration=MAX_TIME,difficulty='veteran',mapId='coastal',terrainSeed=0x43a91f2d}={}){
  this.code=roomCode;this.mode=mode;this.mapId=['coastal','desert','frozen'].includes(mapId)?mapId:'coastal';this.terrainSeed=Number(terrainSeed)>>>0;this.difficulty=['recruit','standard','veteran'].includes(difficulty)?difficulty:'recruit';this.duration=duration;this.phase='lobby';this.time=0;this.events=[];this.eventId=1;this.seq=1;
  this.teams=[];this.units=[];this.bases=[];this.nodes=[];this.projectiles=[];this.blasts=[];this.participants=[];
  this.win=null;this.aiClock=0;this.incomeClock=0;this.snapshotClock=0;this.round=0;
  this.resetWorld();
 }
 nextId(prefix='o'){return prefix+(this.seq++)}
 event(text,team=null){this.events.push({id:this.eventId++,text,team});if(this.events.length>12)this.events.shift()}
 addParticipant(id,name,team,isBot=false){if(this.phase!=='lobby')return false;if(this.participants.some(p=>p.team===team))return false;this.participants.push({id,name:name.slice(0,18),team,bot:isBot,connected:true});return true}
 resetWorld(){
  this.time=0;this.aiClock=0;this.incomeClock=0;this.seq=1;this.eventId=1;this.units=[];this.bases=[];this.projectiles=[];this.blasts=[];this.events=[];this.win=null;
  const recruit=this.mode==='solo'&&this.difficulty==='recruit';
  this.teams=[{credits:recruit?620:START_CREDITS,energy:130,points:0,kills:0,powerCooldown:0},{credits:recruit?160:START_CREDITS,energy:130,points:0,kills:0,powerCooldown:0}];
  this.nodes=NODES.map((n,i)=>({...n,id:'node'+i,owner:-1,progress:0}));
  this.bases=[{id:'hq0',kind:'hq',team:0,x:215,y:449,hp:1500,maxHp:1500,radius:58,cd:0,range:190},
              {id:'hq1',kind:'hq',team:1,x:1385,y:449,hp:1500,maxHp:1500,radius:58,cd:0,range:190},
              {id:'tur0a',kind:'turret',team:0,x:326,y:250,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur0b',kind:'turret',team:0,x:326,y:650,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur1a',kind:'turret',team:1,x:1274,y:250,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur1b',kind:'turret',team:1,x:1274,y:650,hp:280,maxHp:280,radius:28,cd:0,range:230}];
 }
 start(){if(this.participants.length<2)return false;this.resetWorld();this.round++;this.phase='playing';
  for(let team=0;team<2;team++){
   const beginnerBot=this.mode==='solo'&&team===1&&this.difficulty==='recruit';
   for(let i=0;i<(beginnerBot?2:4);i++)this.spawn(team,'rifle',true);
   if(!beginnerBot)this.spawn(team,'tank',true);
  }
  this.event('THE FRONTIER IS CONTESTED — CAPTURE THE THREE RELAYS');return true;
 }
 supply(team){return this.units.filter(u=>u.team===team).reduce((sum,u)=>sum+UNITS[u.type].supply,0)}
 spawn(team,type,free=false){
  const d=UNITS[type],t=this.teams[team]; if(!d||!t||this.phase!=='playing'&&!free)return {ok:false,reason:'No battle running'};
  if(this.supply(team)+d.supply>MAX_SUPPLY)return {ok:false,reason:'Unit supply cap reached'};
  if(!free&&t.credits<d.cost)return {ok:false,reason:'Insufficient credits'};
  const base=this.bases.find(b=>b.kind==='hq'&&b.team===team&&b.hp>0);if(!base)return {ok:false,reason:'Command center destroyed'};
  if(!free)t.credits-=d.cost;
  const side=team===0?1:-1;
  const x=base.x+side*rnum(68,104),y=clamp(base.y+rnum(-140,140),BOUNDS.top+15,BOUNDS.bottom-15);
  const objective=this.nodes[team===0?1:1];
  const u={id:this.nextId('u'),team,type,x,y,hp:d.hp,maxHp:d.hp,radius:d.radius,cd:rnum(0,0.6),order:'attackmove',dest:{x:objective.x+(team?60:-60),y:objective.y+rnum(-30,30)},targetId:null,hold:false,angle:team===0?0:Math.PI,vx:0,vy:0};
  this.units.push(u);return {ok:true,unit:u};
 }
 command(team,ids,action,x,y,targetId){
  if(this.phase!=='playing')return {ok:false,reason:'No active battle'};
  if(!['move','attackmove','hold','focus','stop'].includes(action))return {ok:false,reason:'Invalid command'};
  if(!Array.isArray(ids)||ids.length>100)return {ok:false,reason:'Invalid selection'};
  const units=this.units.filter(u=>u.team===team&&ids.includes(u.id));if(!units.length)return {ok:false,reason:'Select your units first'};
  if(action==='focus'){
   const obj=[...this.units,...this.bases].find(v=>v.id===targetId&&v.team!==team&&v.hp>0);
   if(!obj)return {ok:false,reason:'Target unavailable'};
  }
  units.forEach((u,i)=>{
   const spread=(i-(units.length-1)/2)*27;
   u.order=action;u.targetId=action==='focus'?targetId:null;
   u.hold=action==='hold'||action==='stop';
   if(action==='move'||action==='attackmove')u.dest={x:clamp(Number(x)||u.x,BOUNDS.left,BOUNDS.right),y:clamp((Number(y)||u.y)+spread,BOUNDS.top,BOUNDS.bottom)};
   if(action==='focus')u.dest=null;
  });
  return {ok:true,count:units.length};
 }
 orbital(team,x,y){
  const t=this.teams[team];if(this.phase!=='playing')return {ok:false,reason:'Battle ended'};
  if(t.energy<110)return {ok:false,reason:'Need 110 energy'};
  if(t.powerCooldown>this.time)return {ok:false,reason:'Orbital strike cooling down'};
  t.energy-=110;t.powerCooldown=this.time+24;
  const px=clamp(Number(x)||800,BOUNDS.left,BOUNDS.right),py=clamp(Number(y)||450,BOUNDS.top,BOUNDS.bottom);
  this.blasts.push({id:this.nextId('blast'),team,x:px,y:py,delay:1.25,age:0,radius:100,duration:0.9,hit:false});
  this.event((team===0?'AZURE':'CRIMSON')+' ORBITAL STRIKE INBOUND',team);
  return {ok:true};
 }
 applyDamage(target,damage,attacker){
  target.hp=Math.max(0,target.hp-damage);
  if(target.hp>0)return;
  if(target.type){this.units=this.units.filter(u=>u.id!==target.id)}
  else{if(target.kind==='turret')this.event(teamName(target.team)+' LOST A TURRET',target.team);
  if(target.kind==='hq')this.end(1-target.team,'COMMAND CENTER DESTROYED')}
  if(attacker!==null&&attacker!==undefined){this.teams[attacker].kills++;this.teams[attacker].credits+=target.type?9:40}
 }
 fire(source,target,damage,speed,splash=0){
  this.projectiles.push({id:this.nextId('p'),sourceId:source.id,x:source.x,y:source.y,from:source.team,toX:target.x,toY:target.y,targetId:target.id,damage,speed,splash,age:0,life:3,type:source.type||source.kind});
 }
 step(dt=0.05){
  if(this.phase!=='playing')return;
  dt=clamp(dt,0,0.12);this.time+=dt;this.aiClock+=dt;this.incomeClock+=dt;
  for(const b of this.bases){if(b.hp<=0)continue;b.cd-=dt;const target=this.closestEnemy(b,b.team,b.range);if(target&&b.cd<=0){this.fire(b,target,b.kind==='hq'?22:25,575,9);b.cd=b.kind==='hq'?0.65:1.0}}
  for(const u of [...this.units]){
   const d=UNITS[u.type];u.cd-=dt;
   let target=u.targetId?[...this.units,...this.bases].find(t=>t.id===u.targetId&&t.hp>0&&t.team!==u.team):null;
   if(!target&&u.order!=='move')target=this.closestEnemy(u,u.team,d.range+(u.order==='focus'?220:35));
   if(target&&hypot(u,target)<=d.range){
    u.angle=Math.atan2(target.y-u.y,target.x-u.x);
    if(u.cd<=0){this.fire(u,target,d.damage,d.bulletSpeed,d.splash);u.cd=d.fireRate}
    continue;
   }
   if(u.hold)continue;
   let dest=u.dest;
   if(u.order==='focus'&&target)dest={x:target.x,y:target.y};
   if(!dest||u.order==='attackmove'&&target&&hypot(u,target)<d.range*1.25&&u.type==='rocket')continue;
   const dx=dest.x-u.x,dy=dest.y-u.y,dist=Math.hypot(dx,dy);
   if(dist<d.radius*0.65){if(u.order==='move')u.order='hold';continue}
   const speed=Math.min(d.speed*dt,dist);
   let separationX=0,separationY=0;
   for(const other of this.units){if(other===u)continue;const ox=u.x-other.x,oy=u.y-other.y,near=Math.hypot(ox,oy);if(near>0&&near<d.radius+other.radius+6){separationX+=ox/near*0.7;separationY+=oy/near*0.7}}
   const ax=dx/dist+separationX,ay=dy/dist+separationY,len=Math.hypot(ax,ay)||1;
   u.x=clamp(u.x+ax/len*speed,BOUNDS.left,BOUNDS.right);u.y=clamp(u.y+ay/len*speed,BOUNDS.top,BOUNDS.bottom);
   u.angle=Math.atan2(ay,ax);
  }
  for(const p of [...this.projectiles]){
   p.age+=dt;p.life-=dt;
   const target=[...this.units,...this.bases].find(t=>t.id===p.targetId&&t.hp>0);
   if(target){p.toX=target.x;p.toY=target.y}
   const dx=p.toX-p.x,dy=p.toY-p.y,dist=Math.hypot(dx,dy),advance=p.speed*dt;
   if(dist<advance+9||p.life<=0){
    const victims=[...this.units,...this.bases].filter(v=>v.team!==p.from&&v.hp>0&&Math.hypot(v.x-p.toX,v.y-p.toY)<(p.splash||10)+v.radius);
    for(const v of victims)this.applyDamage(v,p.damage*(v.id===p.targetId?1:p.splash?0.55:1),p.from);
    this.blasts.push({id:this.nextId('spark'),x:p.toX,y:p.toY,radius:p.splash?Math.max(32,p.splash):17,age:0,delay:0,duration:0.32,hit:true,team:p.from});
    this.projectiles=this.projectiles.filter(o=>o!==p);
   }else{p.x+=dx/dist*advance;p.y+=dy/dist*advance}
  }
  for(const v of [...this.blasts]){
   v.age+=dt;
   if(!v.hit&&v.age>=v.delay){v.hit=true;
    for(const target of [...this.units,...this.bases])if(target.hp>0&&target.team!==v.team&&Math.hypot(target.x-v.x,target.y-v.y)<v.radius+target.radius)this.applyDamage(target,target.kind==='hq'?125:235,v.team);
   }
   if(v.age>=v.delay+v.duration)this.blasts=this.blasts.filter(b=>b!==v);
  }
  for(const node of this.nodes){
   const near=[0,1].map(team=>this.units.filter(u=>u.team===team&&Math.hypot(u.x-node.x,u.y-node.y)<90).length);
   const direction=near[0]&&!near[1]?-1:near[1]&&!near[0]?1:0;
   if(direction){node.progress=clamp(node.progress+direction*(15+Math.min(near[direction===-1?0:1]-1,3)*4)*dt,-100,100)}
   const previous=node.owner;
   if(node.progress<=-96)node.owner=0;
   else if(node.progress>=96)node.owner=1;
   else if(Math.abs(node.progress)<32)node.owner=-1;
   if(previous!==node.owner){this.event(node.owner===-1?node.name+' CONTESTED':teamName(node.owner)+' CAPTURED '+node.name,node.owner)}
  }
  if(this.incomeClock>=1){const seconds=Math.floor(this.incomeClock);this.incomeClock-=seconds;
   for(let t=0;t<2;t++){const owned=this.nodes.filter(n=>n.owner===t).length;this.teams[t].credits=Math.min(1100,this.teams[t].credits+(13+owned*13)*seconds);this.teams[t].energy=Math.min(180,this.teams[t].energy+(1.2+owned*1.9)*seconds);this.teams[t].points+=owned*seconds*2}
  }
  const aiPeriod=this.mode==='solo'?{recruit:5.2,standard:2.8,veteran:1.3}[this.difficulty]:1.3;
  if(this.aiClock>=aiPeriod){this.aiClock=0;for(const p of this.participants.filter(p=>p.bot))this.aiAction(p.team)}
  if(this.teams.some(t=>t.points>=WIN_SCORE))this.end(this.teams[0].points>this.teams[1].points?0:1,'CONTROL POINT VICTORY');
  if(this.time>=this.duration)this.end(this.teams[0].points===this.teams[1].points?this.bases[0].hp>=this.bases[1].hp?0:1:this.teams[0].points>this.teams[1].points?0:1,'TIME LIMIT');
 }
 closestEnemy(actor,team,range){let best=null,nearest=Infinity;
  for(const u of [...this.units,...this.bases]){if(u.team===team||u.hp<=0)continue;const d=hypot(actor,u);if(d<range&&d<nearest){nearest=d;best=u}}return best;
 }
 aiAction(team){if(this.phase!=='playing')return;
  const t=this.teams[team],supply=this.supply(team);
  const easy=this.mode==='solo'&&this.difficulty==='recruit';
  if(easy&&this.time<20)return;
  const maxAiSupply=easy?21:this.difficulty==='standard'?32:42;
  if(supply<maxAiSupply){const options=easy?['rifle','rifle','rifle','tank']:this.time>50?['tank','tank','rocket','rifle','rifle']:['rifle','rifle','tank','rocket'];
   const type=options[Math.floor(Math.random()*options.length)];if(t.credits>=UNITS[type].cost)this.spawn(team,type)}
  const owned=this.nodes.filter(n=>n.owner===team);const desired=this.nodes.filter(n=>n.owner!==team);
  for(const u of this.units.filter(u=>u.team===team)){
   if(u.order==='focus'&&u.targetId)continue;
   const dest=desired.length?desired.reduce((a,b)=>Math.abs(b.x-u.x)+Math.abs(b.y-u.y)<Math.abs(a.x-u.x)+Math.abs(a.y-u.y)?b:a):this.bases.find(b=>b.team!==team&&b.kind==='hq');
   if(!dest)continue;
   const nearDist=Math.hypot(u.x-dest.x,u.y-dest.y);
   if(nearDist>105||!u.dest||u.order==='hold'){
    u.order='attackmove';u.dest={x:dest.x+(team===0?-15:15)+rnum(-25,25),y:dest.y+rnum(-52,52)};u.hold=false;
   }
  }
  if(this.time>(easy?220:85)&&t.energy>=110&&t.powerCooldown<this.time&&Math.random()<(easy?0.04:0.17)){const target=this.units.filter(u=>u.team!==team).sort((a,b)=>hypot(a,{x:800,y:450})-hypot(b,{x:800,y:450}))[0];if(target)this.orbital(team,target.x,target.y)}
  if(!desired.length&&owned.length===3&&this.time>40){for(const u of this.units.filter(u=>u.team===team)){u.dest={x:team===0?1340:260,y:rnum(300,600)};u.order='attackmove'}}
 }
 end(winner,reason){if(this.phase!=='playing')return;this.phase='results';this.win={team:winner,reason};this.event(teamName(winner)+' WINS — '+reason,winner)}
 snapshot(){return {difficulty:this.difficulty,mapId:this.mapId,terrainSeed:this.terrainSeed,code:this.code,phase:this.phase,time:Math.round(this.time*10)/10,timeLeft:Math.max(0,Math.ceil(this.duration-this.time)),round:this.round,win:this.win,
  teams:this.teams.map((t,i)=>({...t,supply:this.supply(i),powerCooldown:Math.max(0,t.powerCooldown-this.time)})),
  units:this.units.map(u=>({id:u.id,team:u.team,type:u.type,x:Math.round(u.x),y:Math.round(u.y),hp:Math.ceil(u.hp),maxHp:u.maxHp,angle:u.angle,order:u.order})),
  bases:this.bases.map(b=>({id:b.id,kind:b.kind,team:b.team,x:b.x,y:b.y,hp:Math.ceil(b.hp),maxHp:b.maxHp,radius:b.radius})),
  nodes:this.nodes.map(n=>({...n})),projectiles:this.projectiles.map(p=>({id:p.id,sourceId:p.sourceId,x:Math.round(p.x),y:Math.round(p.y),toX:p.toX,toY:p.toY,from:p.from,type:p.type})),
  blasts:this.blasts.map(b=>({id:b.id,x:b.x,y:b.y,age:b.age,delay:b.delay,radius:b.radius,team:b.team})),events:this.events.slice(-7),participants:this.participants.map(p=>({id:p.id,name:p.name,team:p.team,bot:p.bot,connected:p.connected}))};
 }
}
module.exports={Game};
