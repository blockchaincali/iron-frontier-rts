import * as THREE from '/vendor/three.module.js';
import {mergeGeometries} from '/vendor/BufferGeometryUtils.js';

// HOMESTAND town kit. Every building, prop and vehicle is authored here from simple
// primitives, baked with vertex colour and height-based ambient occlusion, then merged
// per material. The whole Kachia district renders in a handful of draw calls and is
// shared by the battle renderer and the cinematic homepage.
const W=2400,H=1350,S=30,TAU=Math.PI*2;
export const toX=x=>(x-W/2)/S,toZ=y=>(y-H/2)/S;
const MAPS=globalThis.IronMaps;
export const layout=()=>MAPS.layouts['safe-haven'];

export const C={cream:0xeadcc0,peach:0xe2b088,sky:0x9fc6d2,mint:0xb7d3b0,ochre:0xd9a85c,rose:0xdba59c,white:0xf1ede3,lime:0xc9cf8a,
 zinc:0x96a2a8,rust:0x9a5b3b,red:0xa8432f,green:0x4d7d58,blue:0x41708f,teal:0x2f8f86,
 cement:0xc9bea5,concrete:0xa9a597,darkConcrete:0x6c6a64,steel:0x5f6c72,black:0x24282b,tank:0x1d2124,wood:0x6e4b2e,plank:0x9b7448,
 leafA:0x2e6a37,leafB:0x3e7c3c,leafC:0x5b8a37,leafDry:0x86884a,trunk:0x5a4030,laterite:0xa3542f,granite:0x9b8f86,sand:0xc7a679,
 hazard:0xf0b632,azure:0x2f86b4,azureDark:0x1d4c66,crimson:0xa83a2c,olive:0x6b6a43,khaki:0xa59a6b,yellow:0xf2c230,orange:0xe27b2e};
const WALLS=[C.cream,C.peach,C.sky,C.mint,C.ochre,C.rose],ROOFS=[C.zinc,C.rust,C.red,C.green,C.blue,C.zinc],GATES=[0x2d5a43,0x2b4a6b,0x3a3a3a,0x6b2f2a,0x2d5a43,0x445a2a];
const CLOTH=[0xd8452f,0x2d78c4,0xf2c230,0x3a9b5c,0xe27b2e,0x8d3fa8,0xf1ede3,0x1f9aa0];

export function rngFrom(seed){let s=(seed>>>0)||1;return ()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296)}

// Unit geometries. Boxes, cylinders and cones stand on y=0 so heights read naturally.
const base=new Map();
function unitGeo(key,make){if(!base.has(key)){let g=make();if(g.index){const flat=g.toNonIndexed();g.dispose();g=flat}for(const name of Object.keys(g.attributes))if(name!=='position'&&name!=='normal')g.deleteAttribute(name);g.computeBoundingBox();base.set(key,g)}return base.get(key)}
const G={
 box:()=>unitGeo('box',()=>new THREE.BoxGeometry(1,1,1).translate(0,.5,0)),
 cyl:(n=10,top=1)=>unitGeo('cyl'+n+':'+top,()=>new THREE.CylinderGeometry(.5*top,.5,1,n).translate(0,.5,0)),
 cone:(n=8)=>unitGeo('cone'+n,()=>new THREE.ConeGeometry(.5,1,n).translate(0,.5,0)),
 blob:(detail=1)=>unitGeo('blob'+detail,()=>new THREE.IcosahedronGeometry(.5,detail)),
 sphere:()=>unitGeo('sphere',()=>new THREE.SphereGeometry(.5,10,7)),
 prism:()=>unitGeo('prism',()=>{const g=new THREE.BufferGeometry(),p=[-.5,0,.5,.5,0,.5,.5,1,0, -.5,0,.5,.5,1,0,-.5,1,0, .5,0,-.5,-.5,0,-.5,-.5,1,0, .5,0,-.5,-.5,1,0,.5,1,0, -.5,0,-.5,-.5,0,.5,-.5,1,0, .5,0,.5,.5,0,-.5,.5,1,0];g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g}),
 hip:(ridge=.3)=>unitGeo('hip'+ridge.toFixed(2),()=>{const r=ridge,g=new THREE.BufferGeometry(),a=[-.5,0,.5],b=[.5,0,.5],c=[.5,0,-.5],d=[-.5,0,-.5],e=[-r,1,0],f=[r,1,0],p=[...a,...b,...f,...a,...f,...e,...c,...d,...e,...c,...e,...f,...d,...a,...e,...b,...c,...f];g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g})
};

const MATERIALS={matte:{roughness:.92,metalness:0},paint:{roughness:.66,metalness:.05},metal:{roughness:.45,metalness:.45},glass:{roughness:.16,metalness:.6},glow:null},SHARED=new Map();
function kitMaterial(name,shared){if(shared&&SHARED.has(name))return SHARED.get(name);const spec=MATERIALS[name],material=spec?new THREE.MeshStandardMaterial({vertexColors:true,...spec}):new THREE.MeshBasicMaterial({vertexColors:true});if(shared){material.userData.shared=true;SHARED.set(name,material)}return material}
export class Kit{
 constructor(seed=0x51ab){this.parts={matte:[],paint:[],metal:[],glass:[],glow:[]};this.stack=[new THREE.Matrix4()];this.rng=rngFrom(seed);this._m=new THREE.Matrix4();this._q=new THREE.Quaternion();this._e=new THREE.Euler();this._p=new THREE.Vector3();this._s=new THREE.Vector3();this._c=new THREE.Color()}
 push(x=0,z=0,ry=0,y=0,scale=1){this._e.set(0,ry,0);this._q.setFromEuler(this._e);const m=new THREE.Matrix4().compose(this._p.set(x,y,z),this._q,this._s.set(scale,scale,scale));this.stack.push(this.stack.at(-1).clone().multiply(m));return this}
 pop(){if(this.stack.length>1)this.stack.pop();return this}
 // ao darkens the lower part of each piece, faking contact shadow and weathering.
 add(bucket,geo,color,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0,ao=.32,jitter=.05){
  this._e.set(rx,ry,rz);this._q.setFromEuler(this._e);this._m.compose(this._p.set(x,y,z),this._q,this._s.set(sx,sy,sz)).premultiply(this.stack.at(-1));
  const g=geo.clone(),pos=geo.attributes.position,count=pos.count,colors=new Float32Array(count*3),box=geo.boundingBox,span=box.max.y-box.min.y||1,tint=1+(this.rng()-.5)*jitter*2;this._c.setHex(color);
  for(let i=0;i<count;i++){const h=(pos.getY(i)-box.min.y)/span,f=tint*(1-ao*(1-h));colors[i*3]=this._c.r*f;colors[i*3+1]=this._c.g*f;colors[i*3+2]=this._c.b*f}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.applyMatrix4(this._m);this.parts[bucket].push(g);return this}
 box(b,c,x,y,z,w,h,d,ry=0,ao,j){return this.add(b,G.box(),c,x,y,z,w,h,d,ry,0,0,ao,j)}
 cyl(b,c,x,y,z,r,h,n=10,ry=0,rx=0,rz=0,top=1){return this.add(b,G.cyl(n,top),c,x,y,z,r*2,h,r*2,ry,rx,rz,.25)}
 cone(b,c,x,y,z,r,h,n=8,ry=0,rx=0,rz=0){return this.add(b,G.cone(n),c,x,y,z,r*2,h,r*2,ry,rx,rz,.2)}
 blob(b,c,x,y,z,sx,sy,sz,ry=0,ao=.35){return this.add(b,G.blob(1),c,x,y,z,sx,sy,sz,ry,0,0,ao,.08)}
 rock(b,c,x,y,z,sx,sy,sz,ry=0){return this.add(b,G.blob(0),c,x,y,z,sx,sy,sz,ry,(this.rng()-.5)*.4,0,.4,.1)}
 prism(b,c,x,y,z,w,h,d,ry=0){return this.add(b,G.prism(),c,x,y,z,w,h,d,ry,0,0,.12)}
 hip(b,c,x,y,z,w,h,d,ry=0){const ridge=Math.max(0,Math.round((.5-d/w*.5)*20)/20);return this.add(b,G.hip(ridge),c,x,y,z,w,h,d,ry,0,0,.12)}
 build({shadows=false,receive=true,shared=false}={}){
  const group=new THREE.Group();
  for(const [name,list] of Object.entries(this.parts)){if(!list.length)continue;const merged=mergeGeometries(list,false);for(const g of list)g.dispose();this.parts[name]=[];if(!merged)continue;merged.computeBoundingSphere();
   const material=kitMaterial(name,shared),mesh=new THREE.Mesh(merged,material);mesh.castShadow=shadows&&name!=='glow'&&name!=='glass';mesh.receiveShadow=receive;mesh.userData.townPart=name;group.add(mesh)}
  return group}
}
export function disposeTree(root){root?.traverse(o=>{if(o.isMesh||o.isPoints||o.isInstancedMesh){o.geometry?.dispose();for(const m of [].concat(o.material||[])){if(m.userData?.shared)continue;m.map?.dispose();m.bumpMap?.dispose();m.dispose()}}})}

// ---------- Architecture ----------
export function house(k,w,d,storeys=1,style=0){
 const wall=WALLS[style%WALLS.length],roof=ROOFS[style%ROOFS.length],h=storeys*1.02,trim=0x5c4a3c,rng=k.rng;
 k.box('matte',C.concrete,0,0,0,w+.16,.12,d+.16,0,.2);k.box('matte',wall,0,.12,0,w,h,d,0,.38);k.box('matte',new THREE.Color(wall).multiplyScalar(.72).getHex(),0,.12,0,w+.02,.16,d+.02,0,.1);
 const cols=Math.max(2,Math.round(w/.85));for(let s=0;s<storeys;s++)for(let i=0;i<cols;i++){const x=-w/2+(i+.5)*w/cols;if(s===0&&i===Math.floor(cols/2)){k.box('matte',C.wood,x,.12,d/2,.34,.66,.04,0,.15);continue}k.box('glass',0x334a55,x,.42+s*1.02,d/2,.3,.34,.035,0,0);k.box('paint',C.white,x,.39+s*1.02,d/2+.01,.38,.05,.05,0,0)}
 for(let s=0;s<storeys;s++){k.box('glass',0x334a55,w/2,.42+s*1.02,0,.035,.34,.3,0,0)}
 if(storeys>1){k.box('matte',C.concrete,0,1.08,d/2+.28,w*.55,.08,.56,0,.1);for(let i=0;i<5;i++)k.box('metal',C.black,-w*.27+i*w*.135,1.16,d/2+.54,.035,.32,.035,0,0);k.box('metal',C.black,0,1.46,d/2+.54,w*.55,.035,.035,0,0)}
 const over=.2;k.hip('metal',roof,0,.12+h,0,w+over*2,Math.min(w,d)*.36,d+over*2);
 if(rng()<.55){const tx=w/2-.32,tz=-d/2+.32;for(const [a,b] of [[-.18,-.18],[.18,-.18],[-.18,.18],[.18,.18]])k.box('metal',C.steel,tx+a,.12+h,tz+b,.04,.5,.04,0,0);k.box('metal',C.steel,tx,.6+h,tz,.42,.04,.42,0,0);k.cyl('paint',C.tank,tx,.64+h,tz,.22,.48,12)}
 if(rng()<.35)k.add('paint',G.cone(10),C.white,-w/2+.3,.16+h+Math.min(w,d)*.2,d/2-.1,.36,.06,.36,0,-.9,0,0);
 if(rng()<.5)k.box('paint',0xe9ece6,w/2+.06,.62,d*.2,.12,.22,.34,0,.2);
}
export function compound(k,c){
 const w=c.w/S,d=c.d/S,style=c.style||0,rng=k.rng;k.push(toX(c.x),toZ(c.y),-(c.rot||0));
 const wallC=[C.cement,0xd8cbb0,0xc4b494][style%3],gate=GATES[style%GATES.length],t=.13,wh=.64,gap=1.05;
 k.box('matte',wallC,0,0,-d/2,w,wh,t,0,.4);k.box('matte',wallC,-w/2,0,0,t,wh,d,0,.4);k.box('matte',wallC,w/2,0,0,t,wh,d,0,.4);
 const side=(w-gap)/2;k.box('matte',wallC,-gap/2-side/2,0,d/2,side,wh,t,0,.4);k.box('matte',wallC,gap/2+side/2,0,d/2,side,wh,t,0,.4);
 for(const [x,z,ww,dd] of [[0,-d/2,w+.04,t+.06],[-w/2,0,t+.06,d+.04],[w/2,0,t+.06,d+.04],[-gap/2-side/2,d/2,side,t+.06],[gap/2+side/2,d/2,side,t+.06]])k.box('matte',0xe8e0cc,x,wh,z,ww,.05,dd,0,0);
 for(const x of [-gap/2,gap/2])k.box('matte',wallC,x,0,d/2,.2,wh+.18,.2,0,.3);
 k.box('metal',gate,0,.02,d/2,gap*.96,wh*.98,.05,0,.15);
 k.push(0,-d*.12);house(k,w*.62,d*.5,c.storeys||1,style);k.pop();
 const tx=(rng()<.5?-1:1)*w*.34,tz=d*.28;if(rng()<.7)mango(k,tx,tz,.55+rng()*.2);else palm(k,tx,tz,.7);
 if(rng()<.55)car(k,-tx*.85,d*.3,CLOTH[Math.floor(rng()*CLOTH.length)],Math.PI/2+(rng()-.5)*.3);
 if(rng()<.6){const lx=-w*.35,lz=-d*.36;k.box('metal',C.steel,lx,0,lz,.03,.42,.03,0,0);k.box('metal',C.steel,lx+.8,0,lz,.03,.42,.03,0,0);for(let i=0;i<4;i++)k.box('matte',CLOTH[(i+style)%CLOTH.length],lx+.14+i*.17,.24,lz,.12,.16,.02,0,0)}
 k.pop();
}
export function mango(k,x,z,s=1){k.cyl('matte',C.trunk,x,0,z,.09*s,.9*s,6,0,0,0,.7);const g=k.rng()<.5?C.leafA:C.leafB;k.blob('matte',g,x,1.25*s,z,1.7*s,1.15*s,1.6*s,k.rng()*TAU);k.blob('matte',g===C.leafA?C.leafB:C.leafA,x+.35*s,1.55*s,z-.15*s,1.1*s,.85*s,1.05*s)}
export function neem(k,x,z,s=1){k.cyl('matte',C.trunk,x,0,z,.07*s,1.4*s,6,0,0,0,.7);k.blob('matte',C.leafC,x,1.85*s,z,1.15*s,1.45*s,1.1*s);k.blob('matte',C.leafB,x-.2*s,1.45*s,z+.15*s,.9*s,.8*s,.9*s)}
export function palm(k,x,z,s=1){const lean=(k.rng()-.5)*.25;for(let i=0;i<3;i++)k.cyl('matte',0x6d5640,x+lean*i*s*.35,i*.75*s,z,.075*s,.78*s,6,0,0,lean,.85);const tx=x+lean*s*1.05,ty=2.2*s;k.blob('matte',0x4a3a26,tx,ty,z,.28*s,.26*s,.28*s);for(let i=0;i<8;i++){const a=i/8*TAU+k.rng()*.3;k.add('matte',G.cone(4),i%2?C.leafB:C.leafC,tx+Math.cos(a)*.12*s,ty-.05*s,z+Math.sin(a)*.12*s,.32*s,1.35*s,.08*s,Math.PI-a,0,Math.PI/2+.35,0,.06)}}
export function shrub(k,x,z,s=1){k.blob('matte',k.rng()<.5?C.leafB:C.leafDry,x,.18*s,z,.7*s,.45*s,.7*s,k.rng()*TAU,.45)}
export function grass(k,x,z,s=1){for(let i=0;i<3;i++)k.cone('matte',i%2?C.leafDry:0x9a9a52,x+(k.rng()-.5)*.25*s,0,z+(k.rng()-.5)*.25*s,.06*s,.35*s+.2*k.rng()*s,4)}
export function termite(k,x,z,s=1){k.cone('matte',C.laterite,x,0,z,.42*s,1.3*s,7);k.cone('matte',0x9b4f2c,x+.22*s,0,z+.1*s,.22*s,.8*s,6)}
export function car(k,x,z,color,ry=0){k.push(x,z,ry);k.box('paint',color,0,.12,0,1.0,.28,.46,0,.25);k.box('glass',0x2c3c46,-.06,.4,0,.56,.22,.42,0,0);k.box('paint',color,-.06,.6,0,.5,.04,.4,0,0);for(const [a,b] of [[-.33,-.22],[.33,-.22],[-.33,.22],[.33,.22]])k.cyl('matte',C.black,a,.12,b,.12,.08,10,0,Math.PI/2,0);k.pop()}
export function danfo(k,x,z,ry=0){k.push(x,z,ry);k.box('paint',C.yellow,0,.14,0,1.65,.6,.62,0,.2);for(const y of [.24,.5])k.box('matte',C.black,0,y,0,1.66,.035,.63,0,0);k.box('glass',0x2c3c46,.1,.48,0,1.3,.18,.635,0,0);k.box('glass',0x2c3c46,.83,.42,0,.03,.26,.5,0,0);for(const [a,b] of [[-.52,-.3],[.52,-.3],[-.52,.3],[.52,.3]])k.cyl('matte',C.black,a,.14,b,.14,.09,10,0,Math.PI/2,0);k.pop()}
export function keke(k,x,z,ry=0){k.push(x,z,ry);k.box('paint',C.yellow,0,.1,0,.6,.32,.42,0,.2);k.box('matte',C.black,-.05,.58,0,.62,.05,.46,0,0);for(const a of [-.2,.2])k.box('metal',C.black,a,.42,0,.03,.18,.42,0,0);k.box('paint',0x2d78c4,.18,.42,0,.02,.12,.4,0,0);k.cyl('matte',C.black,.32,.09,0,.09,.06,8,0,Math.PI/2,0);for(const b of [-.2,.2])k.cyl('matte',C.black,-.22,.09,b,.09,.06,8,0,Math.PI/2,0);k.pop()}
function pole(k,x,z,h=3,ry=0){k.cyl('matte',0x4e3b2a,x,0,z,.05,h,6);k.box('matte',0x4e3b2a,x,h-.2,z,.06,.06,.75,ry,0)}

function roadPoints(road){return road.points.map(([x,y])=>[toX(x),toZ(y)])}
function walk(points,step,fn){for(let i=0;i<points.length-1;i++){const [ax,az]=points[i],[bx,bz]=points[i+1],len=Math.hypot(bx-ax,bz-az),nx=(bx-ax)/len,nz=(bz-az)/len;for(let t=step/2;t<len;t+=step)fn(ax+nx*t,az+nz*t,nx,nz,i)}}

export function marketStalls(k,m){
 const w=m.w/S,d=m.d/S,canopies=[C.red,C.blue,C.yellow,C.green,C.orange,0x2d78c4,0xd8452f,C.teal],goods=[0xd8452f,0x3a9b5c,0x8a5a2b,0xf2c230,0xe27b2e,0x7d3fa0];k.push(toX(m.x),toZ(m.y));
 const cols=Math.floor(w/1.25);for(let row=0;row<2;row++)for(let i=0;i<cols;i++){const x=-w/2+(i+.5)*w/cols,z=(row?1:-1)*d*.24,c=canopies[(i*3+row*5)%canopies.length];
  k.box('matte',C.plank,x,.38,z,.95,.07,.62,0,.1);for(const [a,b] of [[-.42,-.27],[.42,-.27],[-.42,.27],[.42,.27]])k.box('matte',C.wood,x+a,0,z+b,.05,b<0?1.18:1.02,.05,0,.2);
  k.add('metal',G.box(),c,x,1.08,z,1.08,.04,.82,0,row?-.16:.16,0,0,.04);for(let g=0;g<4;g++)k.blob('matte',goods[(i+g+row)%goods.length],x-.3+g*.2,.5,z+(k.rng()-.5)*.25,.18,.13,.18)}
 for(let i=0;i<3;i++){const x=-w/2+.9+i*1.55,col=[0x2d78c4,C.yellow,C.red][i];k.box('paint',col,x,0,d*.5+.55,1.45,.88,.72,0,.25);k.box('matte',C.black,x,.08,d*.5+.92,.9,.66,.02,0,0);k.add('metal',G.box(),C.zinc,x,.92,d*.5+1.02,1.5,.04,.5,0,-.2,0,0,0)}
 for(let i=0;i<5;i++){const a=i/5*TAU+.4,x=Math.cos(a)*w*.56,z=Math.sin(a)*d*.75;k.box('metal',C.steel,x,0,z,.035,1.15,.035,0,0);k.cone('paint',canopies[(i+2)%canopies.length],x,1.0,z,.62,.32,8)}
 for(let i=0;i<4;i++)keke(k,-w/2-.8+i*.75,d*.75+.3,Math.PI/2+.15);danfo(k,w/2+1.2,-d*.1,Math.PI/2);k.pop();
}
export function footballField(k,f){k.push(toX(f.x),toZ(f.y));const w=f.w/S;for(const s of [-1,1]){k.box('paint',C.white,s*w*.47,0,-.55,.05,.75,.05,0,0);k.box('paint',C.white,s*w*.47,0,.55,.05,.75,.05,0,0);k.box('paint',C.white,s*w*.47,.72,0,.05,.05,1.15,0,0)}k.pop()}
export function checkpoint(k,c){k.push(toX(c.x),toZ(c.y),-(c.rot||0));for(const s of [-1,1]){for(let i=0;i<6;i++)for(let r=0;r<2;r++)k.blob('matte',C.khaki,-.75+i*.3+r*.15,.09+r*.15,s*1.85,.34,.17,.24,0,.3);k.box('paint',C.white,s*.35,0,s*1.6,.62,.85,.62,0,.3);k.hip('metal',C.zinc,s*.35,.85,s*1.6,.8,.22,.8)}
 k.box('metal',C.black,-.9,0,-1.25,.08,.65,.08,0,0);for(let i=0;i<8;i++)k.box('paint',i%2?C.white:C.red,-.9+.06,.62,-1.08+i*.3,.06,.06,.3,0,0);k.pop()}
export function stagingCamp(k,s){const rng=k.rng;k.push(toX(s.x),toZ(s.y));const w=s.w/S,d=s.d/S;
 for(let i=0;i<11;i++){const x=(rng()-.5)*w,z=(rng()-.5)*d;if(Math.abs(z)<1.6&&Math.abs(x)<3.4)continue;k.prism('matte',i%3?C.olive:C.khaki,x,0,z,1.4,.8,1.05,rng()*TAU)}
 for(let i=0;i<16;i++){const x=(rng()-.5)*w*1.1,z=(rng()-.5)*d,ry=rng()*TAU;if(Math.abs(z)<1.5&&Math.abs(x)<2.6)continue;if(i%2)k.cyl('paint',i%4===1?0x4a5a3a:0x7a4a2a,x,0,z,.16,.44,10);else k.box('matte',C.plank,x,0,z,.42,.34,.42,ry,.2)}
 for(let i=0;i<6;i++)k.rock('matte',C.laterite,(rng()-.5)*w,0,(rng()-.5)*d,1.1,.35,.7);k.pop()}

export function townScenery(k,{quality='high',lite=false}={}){
 const L=layout(),rng=k.rng,dense=quality==='high'?1:quality==='balanced'?.7:.45;
 for(const c of L.compounds)compound(k,c);marketStalls(k,L.market);footballField(k,L.field);for(const c of L.checkpoints)checkpoint(k,c);stagingCamp(k,L.staging);
 const road=L.roads.find(r=>r.id==='highway'),pts=roadPoints(road);let prev=null;walk(pts,4.2,(x,z,nx,nz)=>{const px=x-nz*1.75,pz=z+nx*1.75;pole(k,px,pz,3,Math.atan2(nx,nz)+Math.PI/2);if(prev)for(const off of [-.3,0,.3]){const dx=px-prev[0],dz=pz-prev[1],len=Math.hypot(dx,dz);k.box('matte',0x1c1c1c,(px+prev[0])/2-nz*off,2.78,(pz+prev[1])/2+nx*off,.018,.018,len,Math.atan2(dx,dz),0,0)}prev=[px,pz]});
 for(const id of ['avenue','evacuation'])walk(roadPoints(L.roads.find(r=>r.id===id)),5.2,(x,z,nx,nz,i)=>{for(const s of [-1,1]){const w=(id==='avenue'?54:52)/S/2+.32,px=x-nz*w*s,pz=z+nx*w*s;k.box('metal',C.steel,px,0,pz,.06,2.4,.06,0,0);k.box('metal',C.steel,px+nz*s*.25,2.36,pz-nx*s*.25,.06,.05,.55,Math.atan2(nx,nz)+Math.PI/2,0);k.box('glow',0xfff1c4,px+nz*s*.48,2.3,pz-nx*s*.48,.18,.06,.12)}});
 // Concrete kerbs and drainage slabs edge the asphalt network.
 for(const r of L.roads.filter(r=>r.surface==='asphalt'))walk(roadPoints(r),1.6,(x,z,nx,nz)=>{const half=r.width/S/2;for(const s of [-1,1])k.box('matte',C.concrete,x-nz*half*s,0,z+nx*half*s,.12,.07,1.5,Math.atan2(nx,nz),.1,.06)});
 for(const [x,y,col] of [[1330,612,C.blue],[820,740,C.red],[1690,742,C.green]]){const bx=toX(x),bz=toZ(y);for(const s of [-1,1])k.box('metal',C.steel,bx+s*.9,0,bz,.08,1.6,.08,0,0);k.box('paint',col,bx,1.55,bz,2.3,1.0,.08,0,.05);k.box('paint',C.white,bx-.4,1.75,bz+.05,1.0,.5,.02,0,0)}
 for(const [x,y] of [[940,676],[1120,676],[940,330],[940,880],[560,830]]){const bx=toX(x)+1.2,bz=toZ(y)-1.15;k.box('metal',C.steel,bx,0,bz,.05,1.4,.05,0,0);k.box('paint',0x2d7a4a,bx,1.25,bz,.75,.28,.04,0,0)}
 for(const f of L.forests){const n=Math.round(f.r*f.r/900*dense*.55);for(let i=0;i<n;i++){const a=rng()*TAU,r=Math.sqrt(rng())*f.r,x=toX(f.x+Math.cos(a)*r),z=toZ(f.y+Math.sin(a)*r*.8);const t=rng();if(t<.45)mango(k,x,z,.75+rng()*.5);else if(t<.75)neem(k,x,z,.8+rng()*.4);else palm(k,x,z,.85+rng()*.35)}}
 const clear=(x,y)=>L.compounds.every(c=>Math.hypot(c.x-x,c.y-y)>c.w*.7)&&L.roads.every(r=>r.points.every(([px,py],i)=>{const n=r.points[i+1];if(!n)return true;const dx=n[0]-px,dy=n[1]-py,len2=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((x-px)*dx+(y-py)*dy)/len2));return Math.hypot(px+dx*t-x,py+dy*t-y)>r.width*.5+26}))&&Math.hypot(x-250,y-680)>120&&Math.hypot(x-2190,y-675)>110;
 const scatter=lite?140:Math.round(420*dense);for(let i=0;i<scatter;i++){const x=60+rng()*2280,y=60+rng()*1230;if(!clear(x,y))continue;const t=rng(),X=toX(x),Z=toZ(y);if(x>300&&x<760&&y>320&&y<820&&t<.75)continue;if(t<.16)mango(k,X,Z,.7+rng()*.45);else if(t<.26)palm(k,X,Z,.8+rng()*.3);else if(t<.32)neem(k,X,Z,.7+rng()*.3);else if(t<.62)shrub(k,X,Z,.7+rng()*.6);else if(t<.9)grass(k,X,Z,1+rng());else if(t<.95)termite(k,X,Z,.7+rng()*.5);else k.rock('matte',C.granite,X,.1,Z,.6+rng()*.6,.4,.5+rng()*.5,rng()*TAU)}
 // Granite inselbergs and low hills frame the district beyond the playable boundary.
 const ring=lite?20:44;for(let i=0;i<ring;i++){const a=i/ring*TAU+rng()*.1,rx=46+rng()*16,rz=29+rng()*12,x=Math.cos(a)*rx,z=Math.sin(a)*rz,s=2.5+rng()*4.5;if(i%3===0)k.rock('matte',C.granite,x,-.4,z,s*1.4,s*.9,s*1.2,rng()*TAU);else k.blob('matte',i%2?0x7f7c4a:0x8a8150,x,-s*.35,z,s*2.2,s*.9,s*1.8,rng()*TAU,.25);if(rng()<.6)mango(k,x*.92,z*.92,1+rng()*.6)}
}

// ---------- Mission buildings (entities) ----------
export function facilityMesh(kind,id){
 const k=new Kit(id?[...id].reduce((a,c)=>a*31+c.charCodeAt(0)>>>0,7):7);
 if(kind==='civilianClinic'){k.box('matte',C.concrete,0,0,0,3.4,.16,2.6,0,.1);k.box('matte',C.white,0,.16,0,3.1,1.3,2.1,0,.3);k.box('paint',C.teal,0,.16,0,3.12,.22,2.12,0,.1);k.hip('metal',C.green,0,1.46,0,3.5,.6,2.5);k.box('paint',C.white,0,1.46,1.08,1.6,.16,.6,0,0);for(const x of [-.7,.7])k.box('paint',C.white,x,.16,1.36,.1,1.3,.1,0,.2);k.box('paint',C.red,0,.58,1.07,.18,.62,.04,0,0);k.box('paint',C.red,0,.8,1.07,.62,.18,.04,0,0);for(const x of [-1.15,1.15])k.box('glass',0x2f4a55,x,.55,1.06,.5,.42,.03,0,0);
  k.box('paint',C.white,0,2.0,0,.24,.12,.9,0,0);k.box('paint',C.red,0,2.12,0,.9,.03,.24,0,0);k.box('paint',C.red,0,2.12,0,.24,.031,.9,0,0);
  k.push(-1.95,.9,Math.PI/2);k.box('paint',C.white,0,.14,0,1.25,.62,.58,0,.2);k.box('paint',C.red,0,.38,0,1.26,.08,.59,0,0);k.box('glass',0x2c3c46,.45,.48,0,.32,.2,.59,0,0);for(const [a,b] of [[-.4,-.28],[.4,-.28],[-.4,.28],[.4,.28]])k.cyl('matte',C.black,a,.13,b,.13,.08,10,0,Math.PI/2,0);k.pop();
  k.cyl('paint',C.tank,1.25,1.46,-.6,.3,.55,12)}
 else if(kind==='market'){k.box('matte',C.concrete,0,0,0,3.6,.14,2.8,0,.1);for(const x of [-1.5,-.5,.5,1.5])for(const z of [-1.15,1.15])k.box('metal',C.steel,x,.14,z,.1,1.7,.1,0,.1);k.prism('metal',C.rust,0,1.82,0,3.7,.75,2.9);k.box('matte',0x8a3c2a,0,1.8,0,3.75,.06,2.95,0,0);
  const goods=[0xd8452f,0x3a9b5c,0xf2c230,0xe27b2e,0x2d78c4,0x8a5a2b];for(let i=0;i<6;i++){const x=-1.3+i*.52;k.box('matte',C.plank,x,.38,-.4,.44,.1,.7,0,.1);k.box('matte',C.plank,x,.38,.55,.44,.1,.6,0,.1);for(let g=0;g<3;g++){k.blob('matte',goods[(i+g)%6],x-.1+g*.1,.55,-.4+(g-1)*.2,.16,.12,.16);k.blob('matte',goods[(i+g+3)%6],x-.1+g*.1,.55,.55,.14,.11,.14)}}
  for(const [x,c] of [[-1.9,C.red],[1.95,C.yellow]]){k.box('metal',C.steel,x,.14,1.45,.04,1.3,.04,0,0);k.cone('paint',c,x,1.15,1.45,.72,.34,8)}}
 else if(id==='facility-school'){k.box('matte',C.concrete,0,0,0,3.8,.14,2.7,0,.1);k.box('matte',C.sky,-.2,.14,-.45,3.3,1.08,1.25,0,.3);k.box('matte',C.sky,1.2,.14,.35,.95,1.08,1.6,0,.3);k.box('paint',C.blue,-.2,.14,-.45,3.32,.2,1.27,0,.1);k.box('matte',C.concrete,-.4,.14,.42,2.8,.08,.55,0,.1);for(let i=0;i<6;i++)k.box('paint',C.white,-1.65+i*.5,.22,.66,.08,.96,.08,0,.2);k.box('metal',C.zinc,-.4,1.18,.42,2.95,.05,.7,0,0);
  for(let i=0;i<5;i++)k.box('glass',0x2f4a55,-1.55+i*.6,.5,.19,.36,.36,.03,0,0);k.hip('metal',C.blue,-.2,1.22,-.45,3.55,.5,1.5);k.hip('metal',C.blue,1.2,1.22,.35,1.2,.48,1.85);k.box('metal',C.steel,-1.95,.14,1.2,.04,2.4,.04,0,0);k.box('paint',C.ochre,-1.75,2.2,1.2,.38,.24,.02,0,0)}
 else{k.box('matte',C.concrete,0,0,0,3.6,.14,2.8,0,.1);k.box('matte',C.ochre,0,.14,0,3.0,1.35,2.0,0,.3);k.box('matte',0xb88a4a,0,.14,0,3.02,.24,2.02,0,.1);k.prism('metal',C.red,0,1.49,0,3.3,.85,2.3);k.box('matte',C.concrete,0,.14,1.3,2.5,.08,.6,0,.1);for(let i=0;i<5;i++)k.box('paint',C.white,-1.1+i*.55,.22,1.52,.1,1.15,.1,0,.2);k.box('metal',C.rust,0,1.32,1.32,2.7,.05,.72,0,0);for(const x of [-.9,.9])k.box('glass',0x2f4a55,x,.55,1.01,.45,.45,.03,0,0);k.box('matte',C.wood,0,.14,1.01,.5,.8,.03,0,0);k.cyl('paint',C.tank,-1.25,1.49,-.6,.28,.5,12);mango(k,1.75,-.7,.6)}
 return k.build({shadows:true,shared:true})}

export function structureParts(type,team=0){
 const body=new Kit(type.length*97+team),found=new Kit(type.length*13),acc=team===0?C.azure:C.crimson,dark=team===0?C.azureDark:0x5a1d16;
 if(type==='barricade'){found.box('matte',C.darkConcrete,0,0,0,2.4,.06,.9,0,.1);for(const x of [-.78,0,.78]){body.add('matte',G.prism(),C.concrete,x,0,0,.74,.62,.5,0,0,0,.35);body.box('paint',C.hazard,x,.42,.12,.5,.07,.02,0,0)}for(let i=0;i<7;i++)for(let r=0;r<2;r++)body.blob('matte',C.khaki,-1.05+i*.35+r*.17,.1+r*.15,-.45,.38,.18,.26,0,.3)}
 else if(type==='watchtower'){found.box('matte',C.darkConcrete,0,0,0,1.8,.08,1.8,0,.1);for(const [x,z] of [[-.6,-.6],[.6,-.6],[-.6,.6],[.6,.6]])body.box('metal',C.steel,x,0,z,.13,2.1,.13,0,.2);for(const y of [.6,1.3])for(const s of [-1,1]){body.box('metal',C.steel,0,y,s*.6,1.2,.05,.05,0,0);body.box('metal',C.steel,s*.6,y,0,.05,.05,1.2,0,0)}body.box('matte',C.plank,0,2.1,0,1.6,.12,1.6,0,.1);for(let i=0;i<4;i++){const a=i*Math.PI/2;for(let j=0;j<4;j++)body.blob('matte',C.khaki,Math.cos(a)*.72+Math.sin(a)*(-.55+j*.37),2.3,Math.sin(a)*.72-Math.cos(a)*(-.55+j*.37),.4,.2,.28,a)}body.box('metal',C.steel,-.7,2.2,-.7,.06,1.0,.06,0,0);body.box('metal',C.steel,.7,2.2,.7,.06,1.0,.06,0,0);body.hip('metal',acc,0,3.15,0,1.9,.4,1.9);body.cyl('paint',0xe9ece6,.55,2.5,.55,.12,.18,8,0,Math.PI/2,0)}
 else if(type==='barracks'){found.box('matte',C.darkConcrete,0,0,0,2.9,.1,2.2,0,.1);body.box('matte',0x7d8a6a,0,.1,0,2.6,1.15,1.6,0,.35);body.box('paint',acc,0,.1,0,2.62,.2,1.62,0,.1);body.prism('metal',C.zinc,0,1.25,0,2.85,.6,1.85);for(const x of [-.85,0,.85])body.box('glass',0x2f4a55,x,.55,.81,.42,.32,.03,0,0);body.box('matte',C.wood,-.42,.1,.81,.34,.72,.03,0,0);for(let i=0;i<5;i++)body.blob('matte',C.khaki,.25+i*.28,.12,1.05,.32,.2,.22,0,.3);body.box('metal',C.steel,1.35,.1,.95,.04,2.2,.04,0,0);body.box('paint',acc,1.52,2.0,.95,.32,.2,.02,0,0)}
 else if(type==='workshop'){found.box('matte',C.darkConcrete,0,0,0,3.2,.1,2.5,0,.1);body.box('matte',0x8a9096,0,.1,-.1,2.9,1.65,2.0,0,.35);body.box('paint',acc,0,1.55,-.1,2.92,.2,2.02,0,0);body.prism('metal',C.zinc,0,1.75,-.1,3.1,.55,2.2);body.box('metal',0x5b6268,-.35,.1,.91,1.5,1.25,.04,0,.2);for(let i=0;i<7;i++)body.box('metal',0x41474c,-.35,.2+i*.16,.94,1.5,.03,.02,0,0);for(const s of [-1,1])body.box('paint',C.hazard,-.35+s*.79,.1,.93,.08,1.25,.02,0,0);body.box('metal',C.hazard,1.25,.1,1.0,.08,1.9,.08,0,0);body.box('metal',C.hazard,1.25,1.95,.55,.08,.08,1.0,0,0);for(let i=0;i<3;i++)body.cyl('paint',[0x2d5a43,C.rust,0x2b4a6b][i],-1.25+i*.28,.1,1.15,.14,.42,10)}
 else if(type==='clinic'){found.box('matte',C.darkConcrete,0,0,0,2.6,.06,2.0,0,.1);body.prism('matte',0xeeeee6,0,0,0,2.3,1.3,1.7);body.box('paint',C.red,0,.55,.86,.16,.5,.03,0,0);body.box('paint',C.red,0,.72,.86,.5,.16,.03,0,0);body.box('paint',C.red,0,1.1,0,.6,.02,.16,0,0);for(let i=0;i<3;i++)body.box('paint',C.white,-1.0+i*.32,0,.95,.26,.24,.3,0,.2);body.box('metal',C.steel,1.1,0,.85,.04,1.9,.04,0,0);body.box('paint',C.white,1.27,1.7,.85,.32,.22,.02,0,0);body.box('paint',C.red,1.27,1.7,.86,.12,.06,.02,0,0)}
 else if(type==='hq'){found.box('matte',C.darkConcrete,0,0,0,4.6,.12,3.8,0,.1);body.box('matte',0x7f8a7a,0,.12,0,3.4,1.25,2.4,0,.35);body.box('matte',0x8d977f,-.4,1.37,-.2,2.2,1.0,1.7,0,.3);body.box('paint',acc,0,.12,0,3.42,.24,2.42,0,.1);body.box('paint',acc,-.4,2.3,-.2,2.22,.12,1.72,0,0);for(const x of [-1.1,-.4,.3,1.0])body.box('glass',0x2f4a55,x,.6,1.21,.42,.36,.03,0,0);for(const x of [-1.1,-.4,.3])body.box('glass',0x2f4a55,x-.15,1.7,.66,.42,.32,.03,0,0);body.box('matte',C.wood,1.25,.12,1.21,.4,.75,.03,0,0);
  for(let i=0;i<12;i++){const a=i/12*TAU;body.blob('matte',C.khaki,Math.cos(a)*2.15,.12,Math.sin(a)*1.8,.55,.32,.32,-a,.3)}body.box('metal',C.steel,1.2,1.37,-.7,.08,2.6,.08,0,0);body.box('metal',C.steel,1.2,3.6,-.7,.6,.04,.04,0,0);body.add('paint',G.cone(14),0xe9ece6,-1.2,2.5,-.65,.7,.12,.7,0,.6,0,0);body.box('metal',C.steel,-1.6,1.37,.8,.05,2.0,.05,0,0);body.box('paint',acc,-1.42,3.1,.8,.38,.24,.02,0,0)}
 else if(type==='camp'){found.box('matte',0x6e5a3e,0,0,0,4.2,.06,3.6,0,.1);for(const [x,z,r] of [[-1,-.6,.2],[.9,-.8,-.3],[0,.9,.1]])body.prism('matte',C.olive,x,0,z,1.6,.95,1.2,r);for(let i=0;i<5;i++)body.cyl('paint',0x4a5a3a,-1.6+i*.35,0,1.5,.16,.44,10);body.box('metal',C.steel,1.6,0,.9,.06,2.4,.06,0,0);body.box('paint',C.crimson,1.8,2.1,.9,.42,.28,.02,0,0);body.box('paint',0x3d3a32,.2,0,-1.7,1.6,.55,.7,0,.2)}
 const scaffold=new Kit(5);if(type!=='barricade'){const w=type==='workshop'?1.6:type==='hq'?2.2:1.3,d=type==='workshop'?1.3:1.1;for(const [x,z] of [[-w,-d],[w,-d],[-w,d],[w,d]])scaffold.box('metal',C.hazard,x,0,z,.07,2.0,.07,0,0);for(const y of [.7,1.4])for(const s of [-1,1]){scaffold.box('matte',C.plank,0,y,s*d,w*2,.05,.18,0,0);scaffold.box('matte',C.plank,s*w,y,0,.18,.05,d*2,0,0)}}
 return {foundation:found.build({shadows:false,shared:true}),body:body.build({shadows:true,shared:true}),scaffold:scaffold.build({shadows:false,shared:true})}}

// ---------- Ground painting ----------
const groundCache=new Map();
export function paintGround(size=2048){
 if(groundCache.has(size))return groundCache.get(size);
 const L=layout(),cw=size,ch=Math.round(size*.5625),c=document.createElement('canvas');c.width=cw;c.height=ch;const x=c.getContext('2d'),rng=rngFrom(0x7a11),margin=.1,
  sx=v=>(v/W+margin)/(1+margin*2)*cw,sy=v=>(v/H+margin)/(1+margin*2)*ch,sc=cw/(W*(1+margin*2));
 x.fillStyle='#7c844c';x.fillRect(0,0,cw,ch);
 const blob=(px,py,r,col,a)=>{const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,col.replace('A',a));g.addColorStop(1,col.replace('A',0));x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,TAU);x.fill()};
 for(let i=0;i<520;i++){const px=rng()*cw,py=rng()*ch,r=(30+rng()*140)*sc*3;const t=rng();blob(px,py,r,t<.4?'rgba(104,126,58,A)':t<.6?'rgba(160,146,86,A)':t<.85?'rgba(86,108,50,A)':'rgba(160,96,58,A)',.22+rng()*.2)}
 for(const f of L.forests)for(let i=0;i<40;i++){const a=rng()*TAU,r=Math.sqrt(rng())*f.r;blob(sx(f.x+Math.cos(a)*r),sy(f.y+Math.sin(a)*r),(40+rng()*50)*sc,'rgba(64,92,44,A)',.35)}
 const rect=(cx,cy,w,d,rot,fill,blur=0)=>{x.save();x.translate(sx(cx),sy(cy));x.rotate(rot||0);x.shadowColor=fill;x.shadowBlur=blur*sc;x.fillStyle=fill;x.fillRect(-w*sc/2,-d*sc/2,w*sc,d*sc);x.restore()};
 blob(sx(330),sy(640),330*sc,'rgba(150,128,96,A)',.75);blob(sx(250),sy(680),150*sc,'rgba(124,118,108,A)',.85);
 for(const c of L.compounds)rect(c.x,c.y,c.w+24,c.d+24,c.rot,'rgba(196,164,118,.95)',18);
 rect(L.market.x,L.market.y,L.market.w+120,L.market.d+140,0,'rgba(150,112,76,.9)',30);
 for(const [fx,fy,r] of [[790,480,95],[1040,900,95],[560,830,100],[1260,430,100]])blob(sx(fx),sy(fy),r*sc*1.5,'rgba(186,156,112,A)',.95);
 blob(sx(2150),sy(675),300*sc,'rgba(132,100,70,A)',.75);
 const f=L.field;rect(f.x,f.y,f.w+20,f.d+20,0,'#6f8a3e',6);x.strokeStyle='rgba(240,240,230,.85)';x.lineWidth=Math.max(1,3*sc);x.strokeRect(sx(f.x-f.w/2),sy(f.y-f.d/2),f.w*sc,f.d*sc);x.beginPath();x.moveTo(sx(f.x),sy(f.y-f.d/2));x.lineTo(sx(f.x),sy(f.y+f.d/2));x.stroke();x.beginPath();x.arc(sx(f.x),sy(f.y),18*sc,0,TAU);x.stroke();
 const stroke=(road,width,col,dash)=>{x.beginPath();road.points.forEach(([px,py],i)=>i?x.lineTo(sx(px),sy(py)):x.moveTo(sx(px),sy(py)));x.lineWidth=width*sc;x.strokeStyle=col;x.lineCap='round';x.lineJoin='round';x.setLineDash(dash?dash.map(v=>v*sc):[]);x.stroke();x.setLineDash([])};
 for(const r of L.roads.filter(r=>r.surface==='laterite')){stroke(r,r.width+22,'rgba(150,78,44,.55)');stroke(r,r.width,'#a85a33');stroke(r,r.width*.18,'rgba(110,52,30,.55)',[40,18])}
 for(const r of L.roads.filter(r=>r.surface==='asphalt')){stroke(r,r.width+30,'rgba(90,84,74,.7)');stroke(r,r.width+10,'#4a4844');stroke(r,r.width,'#3d3f41');for(const s of [-.24,.24]){const lane={points:r.points.map(([px,py],i)=>{const n=r.points[i+1]||r.points[i-1],k=r.points[i+1]?1:-1,dx=(n[0]-px)*k,dy=(n[1]-py)*k,len=Math.hypot(dx,dy)||1;return [px-dy/len*r.width*s,py+dx/len*r.width*s]})};stroke(lane,r.width*.16,'rgba(34,35,37,.55)')}}
 for(const r of L.roads.filter(r=>r.surface==='asphalt')){for(const s of [-1,1]){x.save();x.beginPath();r.points.forEach(([px,py],i)=>{const n=r.points[i+1]||r.points[i-1],dx=(n[0]-px)*(r.points[i+1]?1:-1),dy=(n[1]-py)*(r.points[i+1]?1:-1),len=Math.hypot(dx,dy)||1,ox=-dy/len*r.width*.43*s,oy=dx/len*r.width*.43*s;i?x.lineTo(sx(px+ox),sy(py+oy)):x.moveTo(sx(px+ox),sy(py+oy))});x.strokeStyle='rgba(236,232,220,.7)';x.lineWidth=Math.max(1,2.4*sc);x.stroke();x.restore()}
  stroke(r,3.4,r.evacuation?'rgba(80,220,140,.95)':'rgba(242,190,50,.95)',[34,26])}
 const evac=L.roads.find(r=>r.evacuation);for(let i=0;i<evac.points.length-1;i++){const [ax,ay]=evac.points[i],[bx,by]=evac.points[i+1],len=Math.hypot(bx-ax,by-ay),a=Math.atan2(by-ay,bx-ax);for(let t=70;t<len;t+=150){x.save();x.translate(sx(ax+(bx-ax)*t/len),sy(ay+(by-ay)*t/len));x.rotate(a);x.fillStyle='rgba(90,230,150,.85)';x.beginPath();x.moveTo(14*sc,0);x.lineTo(-8*sc,-13*sc);x.lineTo(-2*sc,0);x.lineTo(-8*sc,13*sc);x.closePath();x.fill();x.restore()}}
 blob(sx(L.evacuationPoint.x),sy(L.evacuationPoint.y),90*sc,'rgba(90,220,150,A)',.35);
 for(let i=0;i<9000;i++){const px=rng()*cw,py=rng()*ch;x.fillStyle=rng()<.5?'rgba(60,64,30,.18)':'rgba(214,196,140,.16)';x.fillRect(px,py,1+rng()*2.5,1+rng()*1.5)}
 const data=x.getImageData(0,0,cw,ch),p=data.data;for(let i=0;i<p.length;i+=4){const n=(rng()-.5)*22;p[i]+=n;p[i+1]+=n;p[i+2]+=n*.8}x.putImageData(data,0,0);
 const fade=(x0,y0,x1,y1)=>{const g=x.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(124,132,76,1)');g.addColorStop(1,'rgba(124,132,76,0)');x.fillStyle=g;x.fillRect(Math.min(x0,x1),Math.min(y0,y1),Math.abs(x1-x0)||cw,Math.abs(y1-y0)||ch)},mx=cw*margin/(1+margin*2)*.9,my=ch*margin/(1+margin*2)*.9;fade(0,0,mx,0);fade(cw,0,cw-mx,0);fade(0,0,0,my);fade(0,ch,0,ch-my);
 const result={canvas:c,width:(W*(1+margin*2))/S,depth:(H*(1+margin*2))/S};groundCache.set(size,result);return result}

export function groundMesh(size=2048,anisotropy=8){
 const painted=paintGround(size),texture=new THREE.CanvasTexture(painted.canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
 const detail=detailTexture();const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:detail,bumpScale:.6,roughness:.95,metalness:0}),mesh=new THREE.Mesh(new THREE.PlaneGeometry(painted.width,painted.depth),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=-.04;mesh.receiveShadow=true;mesh.userData.townGround=true;return mesh}
function detailTexture(){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),rng=rngFrom(91);x.fillStyle='#808080';x.fillRect(0,0,256,256);for(let i=0;i<2600;i++){const v=90+Math.floor(rng()*90);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(rng()*256,rng()*256,1+rng()*3,1+rng()*2)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(36,20);return t}

// ---------- People and traffic (homepage and evacuation) ----------
export function crowd(count,seed=3){
 const rng=rngFrom(seed),bodies=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.11,.3,3,6).translate(0,.27,0),new THREE.MeshStandardMaterial({roughness:.8}),count),heads=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,8,6).translate(0,.6,0),new THREE.MeshStandardMaterial({roughness:.7}),count),col=new THREE.Color();
 for(let i=0;i<count;i++){bodies.setColorAt(i,col.setHex(CLOTH[Math.floor(rng()*CLOTH.length)]));heads.setColorAt(i,col.setHex([0x4a2c1d,0x5c3824,0x3b2418,0x6b4129][i%4]))}
 bodies.castShadow=false;return {bodies,heads,count,rng}}
export function vehicleTemplate(kind,color){const k=new Kit(kind.length+(color||0));const build=()=>k.build({shadows:false,shared:true});if(kind==='danfo')danfo(k,0,0);else if(kind==='keke')keke(k,0,0);else if(kind==='patrol')patrolTruck(k);else if(kind==='engineer')engineerRig(k);else if(kind==='truck')supplyTruck(k);else car(k,0,0,color||C.white);return build()}
export function patrolTruck(k){k.box('paint',C.azure,0,.25,0,1.6,.55,.82,0,.25);k.box('paint',C.azureDark,-.5,.8,0,.55,.4,.78,0,.15);k.box('glass',0x2c3c46,-.2,.86,0,.04,.24,.66,0,0);k.box('paint',C.azure,.35,.8,0,.75,.32,.8,0,.2);k.cyl('metal',C.steel,.35,1.12,0,.22,.16,10);k.cyl('metal',C.steel,.62,1.2,0,.04,.55,6,0,0,Math.PI/2);for(const [a,b] of [[-.52,-.42],[.52,-.42],[-.52,.42],[.52,.42]])k.cyl('matte',C.black,a,.22,b,.22,.16,12,0,Math.PI/2,0);k.box('glow',0xbfeaff,-.82,.42,.28,.03,.08,.12);k.box('glow',0xbfeaff,-.82,.42,-.28,.03,.08,.12)}
export function engineerRig(k){k.box('paint',C.hazard,0,.2,0,1.4,.45,.8,0,.25);k.box('paint',0x3a3a34,-.15,.65,0,.6,.45,.62,0,.15);k.box('glass',0x2c3c46,-.15,.8,0,.62,.2,.5,0,0);k.box('metal',C.steel,-.95,.08,0,.16,.42,1.0,0,.2);k.add('paint',G.box(),C.hazard,.3,.95,0,1.2,.12,.12,0,0,0,.45,.05);for(const z of [-.4,.4])k.box('matte',C.black,0,.04,z,1.25,.32,.2,0,.2)}
export function supplyTruck(k){k.box('paint',0xe8e2d4,-.62,.2,0,.5,.62,.74,0,.2);k.box('glass',0x2c3c46,-.88,.52,0,.03,.22,.6,0,0);k.box('paint',C.azure,.28,.25,0,1.25,.68,.8,0,.2);k.box('paint',C.white,.28,.62,.41,.5,.2,.01,0,0);for(const [a,b] of [[-.6,-.36],[.1,-.36],[.6,-.36],[-.6,.36],[.1,.36],[.6,.36]])k.cyl('matte',C.black,a,.16,b,.16,.12,10,0,Math.PI/2,0)}
