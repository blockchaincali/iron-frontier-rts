'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Game}=require('../src/engine');

const renderer=fs.readFileSync(path.join(__dirname,'..','public','3d.js'),'utf8');
const gameUi=fs.readFileSync(path.join(__dirname,'..','public','game.js'),'utf8');

function match(){const g=new Game({mode:'solo',roomCode:'VFX3'});g.addParticipant('p0','Commander',0);g.addParticipant('bot','Rival AI',1,true);g.start();return g}

test('3D renderer exposes camera, quality, inspection and telemetry controls',()=>{
 for(const api of ['focusSelection','resetCamera','inspect','metrics','quality'])assert.match(renderer,new RegExp(`${api}[:(]`));
 assert.match(renderer,/webglcontextlost/);
 assert.match(renderer,/InstancedMesh/);
 assert.match(renderer,/powerPreference:'high-performance'/);
});

test('3D art is local and procedural with no remote runtime asset requests',()=>{
 assert.doesNotMatch(renderer,/https?:\/\//);
 assert.match(renderer,/terrainTexture\(\)/);
 assert.match(renderer,/rifleSquad|rocketBattery|hqModel/);
});

test('2D fallback and contextual input bridge remain wired',()=>{
 assert.match(gameUi,/iron-frontier-view/);
 assert.match(gameUi,/window\.IronBridge=/);
 assert.match(gameUi,/applyViewMode\(\)/);
 assert.match(gameUi,/handleWorldTap/);
});

test('projectile snapshots identify their source for authoritative recoil and muzzle VFX',()=>{
 const g=match(),source=g.units.find(unit=>unit.team===0),target=g.units.find(unit=>unit.team===1);
 g.fire(source,target,23,900,0);
 const projectile=g.snapshot().projectiles.at(-1);
 assert.equal(projectile.sourceId,source.id);
 assert.equal(projectile.from,source.team);
 assert.equal(projectile.targetId,undefined,'private targeting data is not leaked in the snapshot');
});
