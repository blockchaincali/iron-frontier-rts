'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Game}=require('../src/engine');
function match(){const g=new Game({mode:'solo',roomCode:'GAME'});assert.equal(g.addParticipant('p0','Commander',0),true);assert.equal(g.addParticipant('bot','Rival AI',1,true),true);assert.equal(g.start(),true);return g}
test('Starts a match with two armed factions, 3 relays, bases and resources',()=>{
 const g=match();assert.equal(g.phase,'playing');assert.equal(g.nodes.length,3);assert.equal(g.units.length,10);
 assert.equal(g.units.filter(u=>u.team===0).length,5);assert.equal(g.bases.length,6);
 assert.ok(g.teams.every(t=>t.credits===350));
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
