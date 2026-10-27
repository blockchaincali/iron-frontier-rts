'use strict';
const {W,H,BOUNDS,UNITS,STRUCTURES,START_CREDITS,MAX_SUPPLY,MAX_TIME,WIN_SCORE,NODES}=require('./config');
const rnum=(min,max)=>min+Math.random()*(max-min);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const teamName=t=>t===0?'AZURE UNION':'CRIMSON LEGION';

class Game {
 constructor({mode='solo',roomCode='TEST',duration=MAX_TIME,difficulty='veteran',mapId='coastal',terrainSeed=0x43a91f2d,training=false,missionId=null}={}){
  this.code=roomCode;this.mode=mode;this.missionId=mode==='solo'&&missionId==='safe-haven'?'safe-haven':null;this.mapId=this.missionId||(['coastal','desert','frozen'].includes(mapId)?mapId:'coastal');this.terrainSeed=Number(terrainSeed)>>>0;this.difficulty=['recruit','standard','veteran'].includes(difficulty)?difficulty:'recruit';this.training=mode==='solo'&&Boolean(training);this.duration=this.missionId?420:duration;this.phase='lobby';this.time=0;this.events=[];this.eventId=1;this.seq=1;
  this.teams=[];this.units=[];this.bases=[];this.nodes=[];this.structures=[];this.facilities=[];this.projectiles=[];this.blasts=[];this.participants=[];this.mission=null;
  this.win=null;this.aiClock=0;this.incomeClock=0;this.snapshotClock=0;this.round=0;
  this.resetWorld();
 }
 nextId(prefix='o'){return prefix+(this.seq++)}
 event(text,team=null){this.events.push({id:this.eventId++,text,team});if(this.events.length>12)this.events.shift()}
 addParticipant(id,name,team,isBot=false){if(this.phase!=='lobby')return false;if(this.participants.some(p=>p.team===team))return false;this.participants.push({id,name:name.slice(0,18),team,bot:isBot,connected:true});return true}
 resetWorld(){
  this.time=0;this.aiClock=0;this.incomeClock=0;this.seq=1;this.eventId=1;this.units=[];this.bases=[];this.structures=[];this.facilities=[];this.projectiles=[];this.blasts=[];this.events=[];this.win=null;
  const recruit=this.mode==='solo'&&this.difficulty==='recruit';
  this.teams=[{credits:recruit?620:START_CREDITS,energy:130,points:0,kills:0,powerCooldown:0},{credits:recruit?160:START_CREDITS,energy:130,points:0,kills:0,powerCooldown:0}];
  this.nodes=NODES.map((n,i)=>({...n,id:'node'+i,owner:-1,progress:0}));
  this.bases=[{id:'hq0',kind:'hq',team:0,x:215,y:449,hp:1500,maxHp:1500,radius:58,cd:0,range:190},
              {id:'hq1',kind:'hq',team:1,x:1385,y:449,hp:1500,maxHp:1500,radius:58,cd:0,range:190},
              {id:'tur0a',kind:'turret',team:0,x:326,y:250,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur0b',kind:'turret',team:0,x:326,y:650,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur1a',kind:'turret',team:1,x:1274,y:250,hp:280,maxHp:280,radius:28,cd:0,range:230},
              {id:'tur1b',kind:'turret',team:1,x:1274,y:650,hp:280,maxHp:280,radius:28,cd:0,range:230}];
  if(this.missionId==='safe-haven')this.resetSafeHaven();
 }
 resetSafeHaven(){
  this.training=true;this.teams=[{credits:760,energy:130,points:0,kills:0,powerCooldown:0},{credits:300,energy:130,points:0,kills:0,powerCooldown:0}];
  this.nodes=[{id:'node0',x:735,y:238,name:'COMMUNITY SQUARE',owner:0,progress:-100},{id:'node1',x:830,y:485,name:'CLINIC JUNCTION',owner:-1,progress:0},{id:'node2',x:1125,y:690,name:'EVACUATION ROUTE',owner:-1,progress:0}];
  this.bases=[{id:'hq0',kind:'hq',team:0,x:205,y:455,hp:1800,maxHp:1800,radius:58,cd:0,range:190},{id:'hq1',kind:'hq',team:1,x:1450,y:450,hp:1300,maxHp:1300,radius:52,cd:0,range:170}];
  this.facilities=[{id:'facility-clinic',kind:'civilianClinic',team:0,x:610,y:285,hp:720,maxHp:720,radius:45,name:'Amina Community Clinic'},{id:'facility-market',kind:'market',team:0,x:765,y:620,hp:660,maxHp:660,radius:48,name:'Unity Market'},{id:'facility-centre',kind:'community',team:0,x:430,y:635,hp:760,maxHp:760,radius:48,name:'Safe Haven Centre'}];
  this.mission={id:'safe-haven',stage:'prepare',stageTime:0,wave:0,routeHeld:0,facilitiesRequired:2};
 }
 start(){if(this.participants.length<2)return false;this.resetWorld();this.round++;this.phase='playing';
  if(this.missionId==='safe-haven'){
   this.spawn(0,'engineer',true);this.spawn(0,'rifle',true);this.spawn(0,'rifle',true);this.spawn(0,'rifle',true);this.spawn(0,'rifle',true);this.event('OPERATION SAFE HAVEN - DEPLOY DEFENSES AROUND THE TOWN',0);return true;
  }
  for(let team=0;team<2;team++){
   const beginnerBot=this.mode==='solo'&&team===1&&this.difficulty==='recruit';
   for(let i=0;i<(beginnerBot?2:4);i++)this.spawn(team,'rifle',true);
   if(!beginnerBot)this.spawn(team,'tank',true);
  }
  if(this.training)for(const unit of this.units){unit.order='hold';unit.dest=null;unit.hold=true}
  this.event('THE FRONTIER IS CONTESTED — CAPTURE THE THREE RELAYS');return true;
 }
 completeTraining(team){if(!this.training)return {ok:true};if(team!==0)return {ok:false,reason:'Only the trainee commander can finish training'};if(this.mission){const missing=['barricade','watchtower','barracks','workshop'].filter(type=>!this.structures.some(structure=>structure.team===team&&structure.type===type&&structure.status==='active'));if(missing.length)return {ok:false,reason:'Complete the '+missing.map(type=>STRUCTURES[type].label).join(', ')+' first'}}this.training=false;this.aiClock=0;this.incomeClock=0;if(this.mission){this.mission.stage='protect';this.mission.stageTime=0;this.spawnMissionWave(1);this.event('DEFENSE BEGUN - PROTECT CIVILIANS AND THE EVACUATION ROUTE',0)}else{for(const unit of this.units.filter(unit=>unit.team===1)){unit.hold=false;unit.order='attackmove';unit.dest={x:800,y:450}}this.event('FIELD TRAINING COMPLETE - LIVE BATTLE STARTED',0)}return {ok:true}}
 supply(team){return this.units.filter(u=>u.team===team).reduce((sum,u)=>sum+UNITS[u.type].supply,0)}
 spawn(team,type,free=false){
  const d=UNITS[type],t=this.teams[team]; if(!d||!t||this.phase!=='playing'&&!free)return {ok:false,reason:'No battle running'};
  if(type==='engineer'&&this.missionId!=='safe-haven')return {ok:false,reason:'Engineers are assigned to Operation Safe Haven'};if(type==='patrol'&&!free)return {ok:false,reason:'Produce patrol vehicles from a workshop'};
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
 constructionSite(team,type,x,y,builderIds){
  if(this.missionId!=='safe-haven'||this.phase!=='playing')return {ok:false,reason:'Construction is only available during Operation Safe Haven'};
  const definition=STRUCTURES[type],px=Number(x),py=Number(y),builders=this.units.filter(unit=>unit.team===team&&unit.type==='engineer'&&builderIds?.includes(unit.id));
  if(!definition)return {ok:false,reason:'Unknown structure'};if(!builders.length)return {ok:false,reason:'Select an engineer vehicle first'};
  if(builders.every(builder=>builder.order==='construct'&&this.structures.some(structure=>structure.builderId===builder.id&&structure.status==='building')))return {ok:false,reason:'Engineer is already constructing'};
  if(!Number.isFinite(px)||!Number.isFinite(py)||px<BOUNDS.left+45||px>BOUNDS.right-45||py<BOUNDS.top+45||py>BOUNDS.bottom-45)return {ok:false,reason:'Build inside the marked town boundary'};
  if(Math.min(...builders.map(builder=>Math.hypot(builder.x-px,builder.y-py)))>390)return {ok:false,reason:'Build closer to your engineer'};
  const blockers=[...this.bases,...this.facilities,...this.structures,...this.nodes];if(blockers.some(object=>object.hp!==0&&Math.hypot(object.x-px,object.y-py)<(object.radius||44)+definition.radius+18))return {ok:false,reason:'That location is blocked'};
  if(this.teams[team].credits<definition.cost)return {ok:false,reason:'Need '+definition.cost+' credits'};this.teams[team].credits-=definition.cost;
  const structure={id:this.nextId('s'),team,type,x:px,y:py,hp:Math.ceil(definition.hp*.3),maxHp:definition.hp,radius:definition.radius,status:'building',progress:0,buildTime:definition.buildTime,level:1,cd:0,production:null,upgradeProgress:0,builderId:builders[0].id};this.structures.push(structure);
  for(const builder of builders){builder.order='construct';builder.dest={x:px,y:py};builder.targetId=structure.id;builder.hold=false}this.event('CONSTRUCTION STARTED - '+definition.label.toUpperCase(),team);return {ok:true,structure};
 }
 produce(team,structureId,type){
  const producerType=type==='rifle'?'barracks':type==='patrol'?'workshop':null,producer=this.structures.find(structure=>structure.id===structureId&&structure.team===team&&structure.type===producerType&&structure.status==='active');
  if(!producerType)return {ok:false,reason:'That unit cannot be produced by a town structure'};if(!producer)return {ok:false,reason:'Select an active '+STRUCTURES[producerType].label.toLowerCase()};if(producer.production)return {ok:false,reason:'Production queue is busy'};const definition=UNITS[type],queued=this.structures.filter(value=>value.team===team&&value.production).reduce((sum,value)=>sum+(UNITS[value.production.type]?.supply||0),0);if(this.supply(team)+queued+definition.supply>MAX_SUPPLY)return {ok:false,reason:'Unit supply cap reached'};if(this.teams[team].credits<definition.cost)return {ok:false,reason:'Need '+definition.cost+' credits'};
  this.teams[team].credits-=definition.cost;producer.production={type,progress:0,duration:type==='rifle'?4.5:8};this.event((type==='rifle'?'INFANTRY SQUAD TRAINING':'PROTECTED PATROL VEHICLE IN PRODUCTION'),team);return {ok:true};
 }
 repairStructure(team,structureId,builderIds){
  const structure=this.structures.find(value=>value.id===structureId&&value.team===team&&value.status==='active');if(!structure)return {ok:false,reason:'Select a completed friendly defense'};if(structure.hp>=structure.maxHp)return {ok:false,reason:'This defense is already at full health'};const engineer=this.units.find(unit=>unit.team===team&&unit.type==='engineer'&&builderIds?.includes(unit.id));if(!engineer)return {ok:false,reason:'Select an engineer vehicle to repair'};engineer.order='repair';engineer.dest={x:structure.x,y:structure.y};engineer.targetId=structure.id;engineer.hold=false;this.event('ENGINEER DISPATCHED FOR MAINTENANCE',team);return {ok:true};
 }
 upgradeStructure(team,structureId){
  const structure=this.structures.find(value=>value.id===structureId&&value.team===team&&value.status==='active');if(!structure)return {ok:false,reason:'Select a completed structure'};if(structure.level>=2)return {ok:false,reason:'Structure already upgraded'};if(structure.upgradeProgress)return {ok:false,reason:'Upgrade already underway'};const cost=80;if(this.teams[team].credits<cost)return {ok:false,reason:'Need '+cost+' credits'};this.teams[team].credits-=cost;structure.upgradeProgress=.001;this.event('STRUCTURE UPGRADE STARTED',team);return {ok:true};
 }
 spawnAt(team,type,x,y){const definition=UNITS[type];if(!definition)return null;const unit={id:this.nextId('u'),team,type,x:clamp(x,BOUNDS.left,BOUNDS.right),y:clamp(y,BOUNDS.top,BOUNDS.bottom),hp:definition.hp,maxHp:definition.hp,radius:definition.radius,cd:0,order:'hold',dest:null,targetId:null,hold:true,angle:team===0?0:Math.PI,vx:0,vy:0};this.units.push(unit);return unit}
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
  if(this.training&&target.team===0)return;
  target.hp=Math.max(0,target.hp-damage);
  if(target.hp>0)return;
  if(this.units.includes(target)){this.units=this.units.filter(u=>u.id!==target.id)}
  else if(this.structures.includes(target)){this.structures=this.structures.filter(value=>value!==target);this.event('DEFENSE DESTROYED - '+STRUCTURES[target.type].label.toUpperCase(),target.team)}
  else if(this.facilities.includes(target)){this.event(target.name.toUpperCase()+' HAS BEEN LOST',0);if(this.facilities.filter(value=>value.hp>0).length<this.mission.facilitiesRequired)this.end(1,'CIVILIAN SAFETY NETWORK COLLAPSED')}
  else{if(target.kind==='turret')this.event(teamName(target.team)+' LOST A TURRET',target.team);
  if(target.kind==='hq')this.end(1-target.team,this.missionId==='safe-haven'?(target.team===0?'SAFE HAVEN COMMAND POST LOST':'TOWN SECURED'):'COMMAND CENTER DESTROYED')}
  if(attacker!==null&&attacker!==undefined){this.teams[attacker].kills++;this.teams[attacker].credits+=target.type?9:40}
 }
 fire(source,target,damage,speed,splash=0){
  this.projectiles.push({id:this.nextId('p'),sourceId:source.id,x:source.x,y:source.y,from:source.team,toX:target.x,toY:target.y,targetId:target.id,damage,speed,splash,age:0,life:3,type:source.type||source.kind});
 }
 step(dt=0.05){
  if(this.phase!=='playing')return;
  dt=clamp(dt,0,0.12);if(!this.training)this.time+=dt;this.aiClock+=dt;this.incomeClock+=dt;
  for(const b of this.bases){if(b.hp<=0)continue;b.cd-=dt;if(this.training)continue;const target=this.closestEnemy(b,b.team,b.range);if(target&&b.cd<=0){this.fire(b,target,b.kind==='hq'?22:25,575,9);b.cd=b.kind==='hq'?0.65:1.0}}
  this.stepStructures(dt);
  for(const u of [...this.units]){
   const d=UNITS[u.type];u.cd-=dt;
   if(this.training&&u.team===1)continue;
   if(u.type==='engineer'&&u.order==='repair'){
    const repairTarget=this.structures.find(value=>value.id===u.targetId&&value.team===u.team&&value.status==='active');if(!repairTarget||repairTarget.hp>=repairTarget.maxHp){u.order='hold';u.dest=null;u.targetId=null;u.hold=true;continue}const repairDistance=Math.hypot(u.x-repairTarget.x,u.y-repairTarget.y);if(repairDistance<=u.radius+repairTarget.radius+24){u.hold=true;const affordable=Math.min(32*dt,this.teams[u.team].credits*4);repairTarget.hp=Math.min(repairTarget.maxHp,repairTarget.hp+affordable);this.teams[u.team].credits=Math.max(0,this.teams[u.team].credits-affordable/4);if(repairTarget.hp>=repairTarget.maxHp){u.order='hold';u.dest=null;u.targetId=null;this.event(STRUCTURES[repairTarget.type].label.toUpperCase()+' REPAIRED',u.team)}continue}}
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
   for(const other of this.units){if(other===u)continue;const ox=u.x-other.x,oy=u.y-other.y,near=Math.hypot(ox,oy);if(near>0&&near<d.radius+other.radius+6){separationX+=ox/near*.7;separationY+=oy/near*.7}}
   for(const obstacle of this.structures.filter(value=>value.hp>0)){const ox=u.x-obstacle.x,oy=u.y-obstacle.y,near=Math.hypot(ox,oy),limit=d.radius+obstacle.radius+3;if(near>0&&near<limit){separationX+=ox/near*2.3;separationY+=oy/near*2.3}}
   const ax=dx/dist+separationX,ay=dy/dist+separationY,len=Math.hypot(ax,ay)||1;
   u.x=clamp(u.x+ax/len*speed,BOUNDS.left,BOUNDS.right);u.y=clamp(u.y+ay/len*speed,BOUNDS.top,BOUNDS.bottom);
   u.angle=Math.atan2(ay,ax);
  }
  for(const p of [...this.projectiles]){
   p.age+=dt;p.life-=dt;
   const target=this.combatants().find(t=>t.id===p.targetId&&t.hp>0);
   if(target){p.toX=target.x;p.toY=target.y}
   const dx=p.toX-p.x,dy=p.toY-p.y,dist=Math.hypot(dx,dy),advance=p.speed*dt;
   if(dist<advance+9||p.life<=0){
    const victims=this.combatants().filter(v=>v.team!==p.from&&v.hp>0&&Math.hypot(v.x-p.toX,v.y-p.toY)<(p.splash||10)+v.radius);
    for(const v of victims)this.applyDamage(v,p.damage*(v.id===p.targetId?1:p.splash?0.55:1),p.from);
    this.blasts.push({id:this.nextId('spark'),x:p.toX,y:p.toY,radius:p.splash?Math.max(32,p.splash):17,age:0,delay:0,duration:0.32,hit:true,team:p.from});
    this.projectiles=this.projectiles.filter(o=>o!==p);
   }else{p.x+=dx/dist*advance;p.y+=dy/dist*advance}
  }
  for(const v of [...this.blasts]){
   v.age+=dt;
   if(!v.hit&&v.age>=v.delay){v.hit=true;
    for(const target of this.combatants())if(target.hp>0&&target.team!==v.team&&Math.hypot(target.x-v.x,target.y-v.y)<v.radius+target.radius)this.applyDamage(target,target.kind==='hq'?125:235,v.team);
   }
   if(v.age>=v.delay+v.duration)this.blasts=this.blasts.filter(b=>b!==v);
  }
  for(const node of this.nodes){
   const near=[0,1].map(team=>this.training&&team===1?0:this.units.filter(u=>u.team===team&&Math.hypot(u.x-node.x,u.y-node.y)<90).length);
   const direction=near[0]&&!near[1]?-1:near[1]&&!near[0]?1:0;
   if(direction){node.progress=clamp(node.progress+direction*(15+Math.min(near[direction===-1?0:1]-1,3)*4)*dt,-100,100)}
   const previous=node.owner;
   if(node.progress<=-96)node.owner=0;
   else if(node.progress>=96)node.owner=1;
   else if(Math.abs(node.progress)<32)node.owner=-1;
   if(previous!==node.owner){this.event(node.owner===-1?node.name+' CONTESTED':teamName(node.owner)+' CAPTURED '+node.name,node.owner)}
  }
  if(this.incomeClock>=1){const seconds=Math.floor(this.incomeClock);this.incomeClock-=seconds;
   for(let t=0;t<2;t++){const owned=this.nodes.filter(n=>n.owner===t).length;this.teams[t].credits=Math.min(1100,this.teams[t].credits+(13+owned*13)*seconds);this.teams[t].energy=Math.min(180,this.teams[t].energy+(1.2+owned*1.9)*seconds);if(!this.training)this.teams[t].points+=owned*seconds*2}
   if(this.training){this.teams[0].credits=Math.max(this.teams[0].credits,620);this.teams[0].energy=Math.max(this.teams[0].energy,130)}
  }
  const aiPeriod=this.mode==='solo'?{recruit:5.2,standard:2.8,veteran:1.3}[this.difficulty]:1.3;
  if(!this.training&&this.aiClock>=aiPeriod){this.aiClock=0;for(const p of this.participants.filter(p=>p.bot))this.aiAction(p.team)}
  if(this.mission)this.stepMission(dt);
  else if(!this.training&&this.teams.some(t=>t.points>=WIN_SCORE))this.end(this.teams[0].points>this.teams[1].points?0:1,'CONTROL POINT VICTORY');
  if(!this.mission&&!this.training&&this.time>=this.duration)this.end(this.teams[0].points===this.teams[1].points?this.bases[0].hp>=this.bases[1].hp?0:1:this.teams[0].points>this.teams[1].points?0:1,'TIME LIMIT');
 }
 combatants(){return [...this.units,...this.bases,...this.structures,...this.facilities]}
 closestEnemy(actor,team,range){let best=null,nearest=Infinity;
  for(const u of this.combatants()){if(u.team===team||u.hp<=0)continue;const d=hypot(actor,u);if(d<range&&d<nearest){nearest=d;best=u}}return best;
 }
 stepStructures(dt){
  for(const structure of [...this.structures]){
   if(structure.status==='building'){
    const builder=this.units.find(unit=>unit.id===structure.builderId&&unit.team===structure.team);if(!builder)continue;const distance=Math.hypot(builder.x-structure.x,builder.y-structure.y);if(distance<=structure.radius+builder.radius+22){builder.hold=true;builder.order='construct';structure.progress=Math.min(structure.buildTime,structure.progress+dt);structure.hp=Math.min(structure.maxHp,structure.hp+structure.maxHp*.7/structure.buildTime*dt);if(structure.progress>=structure.buildTime){structure.status='active';structure.hp=structure.maxHp;builder.order='hold';builder.targetId=null;this.event(STRUCTURES[structure.type].label.toUpperCase()+' READY',structure.team)}}continue;
   }
   if(structure.upgradeProgress){structure.upgradeProgress+=dt;if(structure.upgradeProgress>=5){structure.upgradeProgress=0;structure.level=2;structure.maxHp=Math.ceil(structure.maxHp*1.35);structure.hp=structure.maxHp;this.event(STRUCTURES[structure.type].label.toUpperCase()+' UPGRADED',structure.team)}}
   if(structure.type==='watchtower'){structure.cd-=dt;if(!this.training){const target=this.closestEnemy(structure,structure.team,STRUCTURES.watchtower.range+(structure.level-1)*35);if(target&&structure.cd<=0){this.fire(structure,target,STRUCTURES.watchtower.damage+(structure.level-1)*8,650,4);structure.cd=STRUCTURES.watchtower.fireRate}}}
   if(structure.type==='clinic'){const amount=STRUCTURES.clinic.heal*(structure.level===2?1.45:1)*dt;for(const unit of this.units.filter(unit=>unit.team===structure.team&&unit.hp<unit.maxHp&&Math.hypot(unit.x-structure.x,unit.y-structure.y)<155))unit.hp=Math.min(unit.maxHp,unit.hp+amount)}
   if((structure.type==='workshop'||structure.type==='barracks')&&structure.production){structure.production.progress+=dt;if(structure.production.progress>=structure.production.duration){const produced=structure.production.type,offset=structure.radius+36;this.spawnAt(structure.team,produced,structure.x+(structure.team===0?offset:-offset),structure.y);structure.production=null;this.event(produced==='rifle'?'INFANTRY SQUAD READY':'PROTECTED PATROL VEHICLE DEPLOYED',structure.team)}}
  }
 }
 spawnMissionWave(size=1){
  if(!this.mission||this.training)return;this.mission.wave++;const count=(this.difficulty==='recruit'?1:2)+size*2+(this.difficulty==='veteran'?2:0),types=[];for(let index=0;index<count;index++)types.push(index%4===3?'tank':index%5===4?'rocket':'rifle');
  for(let index=0;index<types.length;index++){const unit=this.spawnAt(1,types[index],1390+(index%2)*25,285+(index*73)%330),targets=this.facilities.filter(value=>value.hp>0);const target=targets[index%Math.max(1,targets.length)]||this.bases[0];unit.order='attackmove';unit.dest={x:target.x,y:target.y};unit.hold=false}this.event('HOSTILE WAVE '+this.mission.wave+' APPROACHING THE TOWN',1);
 }
 stepMission(dt){
  if(!this.mission||this.phase!=='playing'||this.training)return;const mission=this.mission;mission.stageTime+=dt;
  if(mission.stage==='protect'){if(mission.stageTime>=18+mission.wave*8)this.spawnMissionWave(Math.min(3,mission.wave+1));if(mission.stageTime>=50){mission.stage='route';mission.stageTime=0;this.event('SECURE THE EASTERN EVACUATION ROUTE',0)}}
  else if(mission.stage==='route'){if(mission.stageTime>=24+mission.wave*6)this.spawnMissionWave(2);const route=this.nodes.find(node=>node.id==='node2');mission.routeHeld=route?.owner===0?mission.routeHeld+dt:0;if(mission.routeHeld>=8){mission.stage='final';mission.stageTime=0;this.spawnMissionWave(3);this.event('EVACUATION MOVING - SURVIVE THE FINAL ASSAULT',0)}}
  else if(mission.stage==='final'){if(mission.stageTime>=18+Math.max(0,mission.wave-4)*14)this.spawnMissionWave(3);if(mission.stageTime>=70&&this.facilities.filter(value=>value.hp>0).length>=mission.facilitiesRequired)this.end(0,'CIVILIANS EVACUATED - SAFETY RESTORED')}
 }
 aiAction(team){if(this.phase!=='playing')return;
  if(this.mission){for(const unit of this.units.filter(value=>value.team===team)){if(unit.order==='focus'&&unit.targetId)continue;const targets=this.facilities.filter(value=>value.hp>0),target=targets.sort((a,b)=>hypot(unit,a)-hypot(unit,b))[0]||this.bases.find(value=>value.team===0);if(target){unit.order='attackmove';unit.dest={x:target.x+rnum(-25,25),y:target.y+rnum(-25,25)};unit.hold=false}}return}
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
 snapshot(){return {difficulty:this.difficulty,mapId:this.mapId,missionId:this.missionId,mission:this.mission?{...this.mission}:null,terrainSeed:this.terrainSeed,training:this.training,code:this.code,phase:this.phase,time:Math.round(this.time*10)/10,timeLeft:Math.max(0,Math.ceil(this.duration-this.time)),round:this.round,win:this.win,
  teams:this.teams.map((t,i)=>({...t,supply:this.supply(i),powerCooldown:Math.max(0,t.powerCooldown-this.time)})),
  units:this.units.map(u=>({id:u.id,team:u.team,type:u.type,x:Math.round(u.x),y:Math.round(u.y),hp:Math.ceil(u.hp),maxHp:u.maxHp,angle:u.angle,order:u.order,dest:u.dest?{x:Math.round(u.dest.x),y:Math.round(u.dest.y)}:null})),
  bases:this.bases.map(b=>({id:b.id,kind:b.kind,team:b.team,x:b.x,y:b.y,hp:Math.ceil(b.hp),maxHp:b.maxHp,radius:b.radius})),
  structures:this.structures.map(structure=>({...structure,hp:Math.ceil(structure.hp),progress:Math.round(structure.progress*10)/10,production:structure.production?{...structure.production,progress:Math.round(structure.production.progress*10)/10}:null})),facilities:this.facilities.map(facility=>({...facility,hp:Math.ceil(facility.hp)})),
  nodes:this.nodes.map(n=>({...n})),projectiles:this.projectiles.map(p=>({id:p.id,sourceId:p.sourceId,x:Math.round(p.x),y:Math.round(p.y),toX:p.toX,toY:p.toY,from:p.from,type:p.type})),
  blasts:this.blasts.map(b=>({id:b.id,x:b.x,y:b.y,age:b.age,delay:b.delay,radius:b.radius,team:b.team})),events:this.events.slice(-7),participants:this.participants.map(p=>({id:p.id,name:p.name,team:p.team,bot:p.bot,connected:p.connected}))};
 }
}
module.exports={Game};
