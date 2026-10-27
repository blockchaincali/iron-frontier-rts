'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
function match(){const g=new Game({mode:'solo',roomCode:'GAME'});assert.equal(g.addParticipant('p0','Commander',0),true);assert.equal(g.addParticipant('bot','Rival AI',1,true),true);assert.equal(g.start(),true);return g}
test('Starts a match with two armed factions, 3 relays, bases and resources',()=>{
 const g=match();assert.equal(g.phase,'playing');assert.equal(g.nodes.length,3);assert.equal(g.units.length,10);
 assert.equal(g.units.filter(u=>u.team===0).length,5);assert.equal(g.bases.length,6);
 assert.ok(g.teams.every(t=>t.credits===350));
});
test('Map identity and deterministic terrain seed survive snapshots and rematches',()=>{
 const g=new Game({mode:'solo',roomCode:'ICE1',mapId:'frozen',terrainSeed:424242});g.addParticipant('p0','Commander',0);g.addParticipant('bot','Rival',1,true);g.start();
 assert.equal(g.snapshot().mapId,'frozen');assert.equal(g.snapshot().terrainSeed,424242);g.end(0,'TEST');g.start();assert.equal(g.snapshot().mapId,'frozen');assert.equal(g.snapshot().terrainSeed,424242);
 const invalid=new Game({mapId:'unknown',terrainSeed:-1});assert.equal(invalid.mapId,'coastal');assert.equal(invalid.terrainSeed,4294967295);
});
test('Recruitment debits resources, enforces supply and rejects invalid unit types',()=>{
 const g=match(),before=g.teams[0].credits;
 let r=g.spawn(0,'tank');assert.equal(r.ok,true);assert.equal(g.teams[0].credits,before-165);
 r=g.spawn(0,'banana');assert.equal(r.ok,false);
 r=g.spawn(0,'tank');assert.equal(r.ok,true);r=g.spawn(0,'tank');assert.equal(r.ok,false);
});
test('Selection commands enforce team ownership and destinations',()=>{
 const g=match(),own=g.units.find(u=>u.team===0),enemy=g.units.find(u=>u.team===1);
 assert.equal(g.command(0,[enemy.id],'move',800,450).ok,false);
 assert.equal(g.command(0,[own.id],'move',800,450).ok,true);
 assert.equal(own.order,'move');assert.equal(own.dest.x,800);
 assert.equal(g.command(0,[own.id],'focus',0,0,enemy.id).ok,true);
 assert.equal(own.targetId,enemy.id);
});
test('Capture relays grants control, credits, energy, score',()=>{
 const g=match();g.units=g.units.filter(u=>u.team===0);for(const u of g.units){u.x=800;u.y=200;u.hold=true;u.order='hold'}
 for(let i=0;i<165;i++)g.step(.05);
 assert.equal(g.nodes[0].owner,0);
 const credits=g.teams[0].credits,points=g.teams[0].points,energy=g.teams[0].energy;
 for(let i=0;i<45;i++)g.step(.05);
 assert.ok(g.teams[0].credits>credits);assert.ok(g.teams[0].points>points);assert.ok(g.teams[0].energy>energy);
});
test('Orbital strike requires energy and applies area damage',()=>{
 const g=match(),enemy=g.units.find(u=>u.team===1);enemy.x=750;enemy.y=450;enemy.hp=86;
 g.teams[0].energy=130;const r=g.orbital(0,750,450);assert.equal(r.ok,true);assert.equal(g.orbital(0,750,450).ok,false);
 for(let i=0;i<36;i++)g.step(.05);
 assert.ok(!g.units.find(u=>u.id===enemy.id));
});
test('AI produces troops and commands an army toward capture relays',()=>{
 const g=match();g.teams[1].credits=1000;const initial=g.units.filter(u=>u.team===1).length;
 for(let i=0;i<80;i++)g.step(.05);
 assert.ok(g.units.filter(u=>u.team===1).length>initial);assert.ok(g.units.some(u=>u.team===1&&u.dest?.x>=700));
});
test('Round ends when HQ is destroyed and rematch resets world',()=>{
 const g=match();let hq=g.bases.find(b=>b.team===1&&b.kind==='hq');g.applyDamage(hq,2000,0);
 assert.equal(g.phase,'results');assert.equal(g.win.team,0);
 assert.equal(g.start(),true);assert.equal(g.phase,'playing');assert.equal(g.round,2);assert.equal(g.units.length,10);
});
test('Long simulation stays finite with valid world coordinates',()=>{
 const g=match();for(let i=0;i<1500;i++){g.step(.05);if(g.phase!=='playing')break}
 const snap=g.snapshot();assert.ok(snap.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.y)&&u.x>=105&&u.x<=1495&&u.y>=85&&u.y<=815));
 assert.ok(snap.projectiles.length<200);assert.ok(snap.blasts.length<100);
});
test('Training freezes hostile pressure and keeps every tutorial step achievable',()=>{
 const g=new Game({mode:'solo',roomCode:'TRAIN',difficulty:'recruit',training:true});g.addParticipant('p0','Trainee',0);g.addParticipant('bot','Instructor',1,true);g.start();
 const startingHp=new Map(g.units.filter(unit=>unit.team===0).map(unit=>[unit.id,unit.hp]));for(let i=0;i<3600;i++)g.step(.05);
 assert.equal(g.phase,'playing');assert.equal(g.time,0);assert.equal(g.nodes.some(node=>node.owner===1),false);assert.ok(g.units.filter(unit=>unit.team===0).every(unit=>unit.hp===startingHp.get(unit.id)));assert.ok(g.teams[0].credits>=620);
 const trainee=g.units.find(unit=>unit.team===0);trainee.x=g.nodes[0].x;trainee.y=g.nodes[0].y;trainee.hold=true;trainee.order='hold';for(let i=0;i<180;i++)g.step(.05);assert.equal(g.nodes[0].owner,0);assert.equal(g.spawn(0,'rifle').ok,true);
 assert.equal(g.completeTraining(0).ok,true);g.step(.1);assert.equal(g.training,false);assert.ok(g.time>0);assert.ok(g.units.filter(unit=>unit.team===1).every(unit=>unit.order==='attackmove'));
});
test('Operation Safe Haven construction, production, upgrades, and mission stages are authoritative',()=>{
 const g=new Game({mode:'solo',roomCode:'HAVEN',difficulty:'recruit',missionId:'safe-haven'});g.addParticipant('p0','Coordinator',0);g.addParticipant('bot','Fictional Insurgents',1,true);g.start();const engineer=g.units.find(unit=>unit.type==='engineer');
 assert.equal(g.mapId,'safe-haven');assert.equal(g.training,true);assert.equal(g.mission.stage,'prepare');assert.equal(g.units.some(unit=>unit.team===1),false);assert.equal(g.constructionSite(0,'watchtower',610,285,[engineer.id]).ok,false);
 const build=(type,x,y)=>{const result=g.constructionSite(0,type,x,y,[engineer.id]);assert.equal(result.ok,true,result.reason);engineer.x=x;engineer.y=y;for(let elapsed=0;elapsed<result.structure.buildTime+.2;elapsed+=.05)g.step(.05);assert.equal(result.structure.status,'active');return result.structure};
 const barricade=build('barricade',380,340),tower=build('watchtower',480,430),clinic=build('clinic',520,550);assert.ok(barricade.hp>500);const rifle=g.units.find(unit=>unit.type==='rifle');rifle.x=clinic.x;rifle.y=clinic.y;rifle.hp=20;g.step(1);assert.ok(rifle.hp>20);
 const workshop=build('workshop',650,500),barracks=build('barracks',880,350);assert.equal(g.training,true);assert.equal(g.mission.stage,'prepare');assert.equal(g.units.some(unit=>unit.team===1),false);const infantryBefore=g.units.filter(unit=>unit.type==='rifle').length;assert.equal(g.produce(0,barracks.id,'rifle').ok,true);for(let elapsed=0;elapsed<4.7;elapsed+=.05)g.step(.05);assert.equal(g.units.filter(unit=>unit.type==='rifle').length,infantryBefore+1);const before=g.units.filter(unit=>unit.type==='patrol').length;assert.equal(g.produce(0,workshop.id,'patrol').ok,true);for(let elapsed=0;elapsed<8.2;elapsed+=.05)g.step(.05);assert.equal(g.units.filter(unit=>unit.type==='patrol').length,before+1);
 tower.hp=200;g.teams[0].credits=200;engineer.x=tower.x;engineer.y=tower.y;assert.equal(g.repairStructure(0,tower.id,[engineer.id]).ok,true);for(let elapsed=0;elapsed<.5;elapsed+=.05)g.step(.05);assert.ok(tower.hp>200);assert.ok(g.teams[0].credits<200);assert.equal(g.completeTraining(0).ok,true);assert.equal(g.training,false);assert.equal(g.mission.stage,'protect');assert.ok(g.units.some(unit=>unit.team===1));
 g.teams[0].credits=200;assert.equal(g.upgradeStructure(0,tower.id).ok,true);for(let elapsed=0;elapsed<5.2;elapsed+=.05)g.step(.05);assert.equal(tower.level,2);assert.ok(tower.maxHp>430);
 g.mission.stage='protect';g.mission.stageTime=49.9;g.step(.2);assert.equal(g.mission.stage,'route');const route=g.nodes.find(node=>node.id==='node2');route.owner=0;route.progress=-100;g.aiClock=-100;for(const enemy of g.units.filter(unit=>unit.team===1)){enemy.x=1450;enemy.y=120;enemy.hold=true}for(let elapsed=0;elapsed<8.2;elapsed+=.05)g.step(.05);assert.equal(g.mission.stage,'final');g.mission.stageTime=69.9;g.step(.2);assert.equal(g.phase,'results');assert.equal(g.win.team,0);
});
test('Safe Haven is lost when the civilian safety network collapses',()=>{
 const g=new Game({mode:'solo',missionId:'safe-haven'});g.addParticipant('p','Player',0);g.addParticipant('b','Bot',1,true);g.start();g.training=false;g.mission.stage='protect';g.applyDamage(g.facilities[0],9999,1);assert.equal(g.phase,'playing');g.applyDamage(g.facilities[1],9999,1);assert.equal(g.phase,'results');assert.equal(g.win.team,1);
});
