import * as THREE from '/vendor/three.module.js';
import {Kit,townScenery,groundMesh,facilityMesh,structureParts,vehicleTemplate,crowd,toX,toZ,layout,disposeTree,rngFrom,C} from '/town.js';

// Cinematic main-menu scene: the real Kachia district at golden hour, with civilian life,
// a distant warning in the east and a Safe Haven convoy arriving to fortify the town.
// It is deliberately lighter than the battle renderer and is fully disposed on deploy.
const BEATS=[
 {at:0,time:'KACHIA · 16:40',text:'Market day in a peaceful town.'},
 {at:4.2,time:'EASTERN RIDGE',text:'An armed group is gathering beyond the hills.',warning:true},
 {at:8.4,time:'HIGHWAY WEST',text:'The Safe Haven response convoy rolls in.'},
 {at:12.4,time:'RESPONSE BASE',text:'Engineers begin fortifying the town.'}
];
const INTRO=16.5,LOOP=46;
let renderer=null,scene=null,camera=null,host=null,raf=0,running=false,elapsed=0,last=0,skipped=false,beatIndex=-1,options={},reduced=false,visibleHandler=null,resizeHandler=null;
let traffic=[],convoy=[],people=null,dust=null,beacons=[],sparks=null,plume=[],introCurve=null,introTargets=null,loopCurve=null,loopTargets=null;
const tmp=new THREE.Object3D(),v1=new THREE.Vector3(),v2=new THREE.Vector3();

function sky(){const c=document.createElement('canvas');c.width=8;c.height=256;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#4f7f93');g.addColorStop(.42,'#b9cdbf');g.addColorStop(.62,'#ecd3a2');g.addColorStop(1,'#e9c999');x.fillStyle=g;x.fillRect(0,0,8,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function glowSprite(color,size){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,color);g.addColorStop(.3,color.replace(/[\d.]+\)$/,'.45)'));g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c),s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));s.scale.set(size,size,1);return s}
function smokeSprite(){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(170,140,110,.75)');g.addColorStop(1,'rgba(170,140,110,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)}

function path(points){const pts=points.map(([x,y])=>new THREE.Vector3(toX(x),0,toZ(y))),lengths=[0];for(let i=1;i<pts.length;i++)lengths.push(lengths[i-1]+pts[i].distanceTo(pts[i-1]));return {pts,lengths,total:lengths.at(-1)}}
function along(p,d,out){d=((d%p.total)+p.total)%p.total;let i=1;while(i<p.lengths.length-1&&p.lengths[i]<d)i++;const a=p.pts[i-1],b=p.pts[i],t=(d-p.lengths[i-1])/((p.lengths[i]-p.lengths[i-1])||1);out.lerpVectors(a,b,t);return Math.atan2(b.x-a.x,b.z-a.z)}

function instanceVehicle(kind,color){const g=vehicleTemplate(kind,color);g.traverse(o=>{if(o.isMesh){o.castShadow=false}});scene.add(g);return g}
function buildScene(quality){
 const L=layout();scene=new THREE.Scene();scene.background=sky();scene.fog=new THREE.FogExp2(0xe6c897,.0145);
 scene.add(new THREE.HemisphereLight(0xd6e8f0,0x5e4a30,1.35));const sun=new THREE.DirectionalLight(0xffd6a0,3.4);sun.position.set(-30,26,18);sun.castShadow=quality==='high';if(sun.castShadow){sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-46,right:46,top:30,bottom:-30,near:1,far:120});sun.shadow.bias=-.0006;sun.shadow.normalBias=.02}scene.add(sun);const rim=new THREE.DirectionalLight(0x9fd6ff,.6);rim.position.set(24,12,-20);scene.add(rim);
 const outer=new THREE.Mesh(new THREE.PlaneGeometry(900,900),new THREE.MeshStandardMaterial({color:0x7c844c,roughness:1}));outer.rotation.x=-Math.PI/2;outer.position.y=-.12;outer.receiveShadow=true;scene.add(outer);
 scene.add(groundMesh(quality==='low'?1024:quality==='balanced'?1536:2048,quality==='high'?8:4));
 const k=new Kit(0x5afe);townScenery(k,{quality,lite:quality!=='high'});scene.add(k.build({shadows:quality==='high'}));
 for(const [kind,id,x,y] of [['civilianClinic','facility-clinic',790,480],['market','facility-market',1040,900],['community','facility-centre',560,830],['community','facility-school',1260,430]]){const m=facilityMesh(kind,id);m.position.set(toX(x),0,toZ(y));m.traverse(o=>{if(o.isMesh)o.castShadow=quality==='high'});scene.add(m)}
 const hq=structureParts('hq',0),hqGroup=new THREE.Group();hqGroup.add(hq.foundation,hq.body);hqGroup.position.set(toX(250),0,toZ(680));scene.add(hqGroup);
 const tower=structureParts('watchtower',0),tg=new THREE.Group();tg.add(tower.foundation,tower.body);tg.position.set(toX(470),0,toZ(470));scene.add(tg);
 const barracks=structureParts('barracks',0),bg=new THREE.Group();bg.add(barracks.foundation,barracks.body,barracks.scaffold);barracks.body.scale.y=.42;bg.position.set(toX(430),0,toZ(585));scene.add(bg);
 const camp=structureParts('camp',1),cg=new THREE.Group();cg.add(camp.foundation,camp.body);cg.position.set(toX(2190),0,toZ(675));scene.add(cg);
 // Civilian traffic loops the road network in both directions.
 const highway=path(L.roads.find(r=>r.id==='highway').points),avenue=path(L.roads.find(r=>r.id==='avenue').points),market=path(L.roads.find(r=>r.id==='market-street').points),school=path(L.roads.find(r=>r.id==='school-road').points);
 const rng=rngFrom(77),colours=[0xd8452f,0xf1ede3,0x2d78c4,0x3a3d40,0xb7b9ba,0x8d3fa8];
 const spec=[[highway,'danfo',.5,1],[highway,'car',.5,1],[highway,'car',-.5,-1],[highway,'keke',.5,1],[highway,'car',-.5,-1],[highway,'danfo',-.5,-1],[avenue,'car',.45,1],[avenue,'keke',-.45,-1],[avenue,'danfo',.45,1],[market,'keke',.35,1],[market,'car',-.35,-1],[school,'car',.35,1],[school,'keke',-.35,-1]];
 traffic=spec.slice(0,quality==='low'?7:spec.length).map(([p,kind,lane,dir],i)=>({p,lane,dir,speed:(kind==='keke'?2.1:kind==='danfo'?2.8:3.3)*(.85+rng()*.3),d:rng()*p.total,g:instanceVehicle(kind,colours[i%colours.length])}));
 // Convoy: patrol trucks, a supply truck and an engineer rig enter from the west highway.
 const base=[[toX(330),toZ(650)],[toX(330),toZ(715)],[toX(390),toZ(650)],[toX(390),toZ(715)],[toX(430),toZ(640)]];
 convoy=['patrol','patrol','truck','patrol','engineer'].map((kind,i)=>({kind,g:instanceVehicle(kind),start:4.4+i*.75,from:new THREE.Vector3(-50-i*2.2,0,toZ(682)),stop:new THREE.Vector3(base[i][0],0,base[i][1]),site:kind==='engineer'?new THREE.Vector3(toX(470),0,toZ(585)):null}));
 // Residents shop and walk around the market and along the avenue.
 people=crowd(quality==='low'?28:64,11);scene.add(people.bodies,people.heads);people.walkers=[];const m=L.market;for(let i=0;i<people.count;i++){const inMarket=i%3!==0,cx=inMarket?m.x:940+(rng()-.5)*30,cy=inMarket?m.y:300+rng()*700;people.walkers.push({x:toX(cx+(rng()-.5)*(inMarket?m.w:20)),z:toZ(cy+(rng()-.5)*(inMarket?m.d*1.6:0)),tx:0,tz:0,speed:.35+rng()*.35,phase:rng()*6,area:inMarket?'market':'avenue',wait:rng()*3});retarget(people.walkers[i],rng)}
 // Distant hostile warning beacons and a dust plume over the staging area.
 for(const [x,y] of [[2150,560],[2230,760],[2100,820]]){const b=glowSprite('rgba(255,60,40,.95)',2.6);b.position.set(toX(x),1.6,toZ(y));scene.add(b);beacons.push(b)}
 const smoke=smokeSprite();for(let i=0;i<10;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:smoke,transparent:true,depthWrite:false,opacity:.0}));s.userData.seed=i/10;scene.add(s);plume.push(s)}plume.texture=smoke;
 const n=quality==='low'?90:220,geo=new THREE.BufferGeometry(),pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(rng()-.5)*90;pos[i*3+1]=rng()*9;pos[i*3+2]=(rng()-.5)*56}geo.setAttribute('position',new THREE.BufferAttribute(pos,3));dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffe2b0,size:.09,transparent:true,opacity:.5,depthWrite:false}));scene.add(dust);
 const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(24*3),3));sparks=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffd27a,size:.12,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sparks.position.set(toX(430),0,toZ(585));scene.add(sparks);
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);
 // One keyframe per story beat: market, eastern warning, convoy on the west highway, base construction.
 introCurve=new THREE.CatmullRomCurve3([V(-10,17,31),V(12,15,20),V(-20,12.5,17),V(-30,11,13),V(-34,10.5,9)]);
 introTargets=new THREE.CatmullRomCurve3([V(-6,0,5),V(28,0,0),V(-36,0,0),V(-28,0,-1),V(-25,0,-3)]);
 loopCurve=new THREE.CatmullRomCurve3([V(-34,10.5,9),V(-24,13,24),V(-2,15,27),V(16,14,20),V(4,16,10),V(-22,12,-2)],true,'centripetal');
 loopTargets=new THREE.CatmullRomCurve3([V(-25,0,-3),V(-14,0,5),V(-2,0,7),V(12,0,2),V(-4,0,-6),V(-24,0,-6)],true,'centripetal');
}
function retarget(w,rng=Math.random){const L=layout(),m=L.market;if(w.area==='market'){w.tx=toX(m.x+(rng()-.5)*m.w*1.05);w.tz=toZ(m.y+(rng()-.5)*m.d*1.6)}else{w.tx=toX(940+(rng()<.5?-38:38));w.tz=toZ(200+rng()*900)}}

function placeVehicle(g,pos,angle){g.position.copy(pos);g.rotation.y=angle-Math.PI/2}
function update(dt){
 elapsed+=dt;const t=elapsed;
 const beat=BEATS.reduce((found,b,i)=>t>=b.at&&(skipped?false:true)?i:found,-1);if(!skipped&&beat!==beatIndex&&t<INTRO){beatIndex=beat;options.onBeat?.(BEATS[beat],beat)}if(!skipped&&t>=INTRO&&beatIndex!==99){beatIndex=99;options.onBeat?.(null,99)}
 for(const v of traffic){v.d+=v.speed*v.dir*dt;const a=along(v.p,v.d,v1),side=v.lane;v1.x+=Math.cos(a)*side;v1.z-=Math.sin(a)*side;placeVehicle(v.g,v1,a+(v.dir<0?Math.PI:0))}
 for(const c of convoy){const local=t-c.start;if(local<=0&&!skipped){c.g.visible=false;continue}c.g.visible=true;const travel=Math.max(0,skipped?999:local)*4.2,total=c.from.distanceTo(c.stop);if(travel<total){v2.copy(c.stop).sub(c.from).normalize();v1.copy(c.from).addScaledVector(v2,travel);placeVehicle(c.g,v1,Math.atan2(v2.x,v2.z))}else if(c.site){const extra=Math.min(1,(travel-total)/(4.2*2.5));v1.lerpVectors(c.stop,c.site,extra);placeVehicle(c.g,v1,extra<1?Math.atan2(c.site.x-c.stop.x,c.site.z-c.stop.z):Math.PI*.5)}else placeVehicle(c.g,c.stop,Math.PI/2)}
 const w=people.walkers;for(let i=0;i<w.length;i++){const p=w[i];if(p.wait>0)p.wait-=dt;else{const dx=p.tx-p.x,dz=p.tz-p.z,d=Math.hypot(dx,dz);if(d<.1){p.wait=1+Math.random()*3;retarget(p)}else{p.x+=dx/d*p.speed*dt;p.z+=dz/d*p.speed*dt}}const bob=p.wait>0?0:Math.abs(Math.sin(t*7+p.phase))*.05;tmp.position.set(p.x,bob,p.z);tmp.rotation.set(0,0,0);tmp.scale.setScalar(.72);tmp.updateMatrix();people.bodies.setMatrixAt(i,tmp.matrix);people.heads.setMatrixAt(i,tmp.matrix)}people.bodies.instanceMatrix.needsUpdate=people.heads.instanceMatrix.needsUpdate=true;
 for(const [i,b] of beacons.entries()){const s=2.2+Math.sin(t*3.2+i)*.9;b.scale.set(s,s,1)}
 for(const s of plume){const life=(t*.08+s.userData.seed)%1;s.position.set(toX(2160)+life*3,1+life*9,toZ(660)-life*2);const size=3+life*9;s.scale.set(size,size,1);s.material.opacity=Math.sin(life*Math.PI)*.42}
 const dp=dust.geometry.attributes.position.array;for(let i=0;i<dp.length;i+=3){dp[i]+=dt*.35;dp[i+1]+=Math.sin(t+i)*dt*.05;if(dp[i]>45)dp[i]=-45}dust.geometry.attributes.position.needsUpdate=true;
 const sp=sparks.geometry.attributes.position.array,building=skipped||t>13;sparks.visible=building;if(building)for(let i=0;i<sp.length;i+=3){const life=(t*1.7+i*.137)%1;sp[i]=Math.sin(i*12.9)*.9+Math.sin(i)*.2*life;sp[i+1]=.9+life*.9-life*life*1.4;sp[i+2]=Math.cos(i*7.1)*.7}sparks.geometry.attributes.position.needsUpdate=true;
 if(!skipped&&t<INTRO){const u=t/INTRO;introCurve.getPoint(u,camera.position);introTargets.getPoint(u,v1);camera.lookAt(v1)}else{const u=((t-(skipped?0:INTRO))/LOOP)%1;loopCurve.getPoint(u,camera.position);loopTargets.getPoint(u,v1);camera.lookAt(v1)}
}
function frame(now){if(!running)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(now-(last||now))/1000);last=now;update(dt);renderer.render(scene,camera)}
function resize(){if(!renderer||!host)return;const w=host.clientWidth||innerWidth,h=host.clientHeight||innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w/h<1.1?58:w/h<1.6?46:38;camera.updateProjectionMatrix()}
function play(){if(running||!renderer||reduced||document.hidden)return;running=true;last=0;raf=requestAnimationFrame(frame)}
function pause(){running=false;cancelAnimationFrame(raf)}

export function mount(target,opts={}){
 if(renderer)return;host=target;options=opts;reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;skipped=Boolean(opts.skipIntro);elapsed=opts.poster?11.5:0;beatIndex=-1;
 const small=matchMedia('(max-width: 900px), (max-height: 520px)').matches,quality=opts.quality||(small||(navigator.hardwareConcurrency||8)<=4?'balanced':'high');
 try{renderer=new THREE.WebGLRenderer({antialias:!small,powerPreference:'high-performance',preserveDrawingBuffer:Boolean(opts.poster)})}catch(error){console.warn('Homepage scene unavailable',error);opts.onFail?.();return}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,opts.poster?2:small?1.25:1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=quality==='high';renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 camera=new THREE.PerspectiveCamera(40,1,.3,320);buildScene(quality);
 const canvas=renderer.domElement;canvas.className='home-canvas';canvas.setAttribute('aria-hidden','true');host.appendChild(canvas);resize();
 if(opts.poster){skipped=true;update(0);camera.position.set(-30,12.5,21);camera.lookAt(-10,0,1)}else update(0);
 renderer.render(scene,camera);requestAnimationFrame(()=>{canvas.classList.add('ready');opts.onReady?.()});
 resizeHandler=()=>resize();addEventListener('resize',resizeHandler);visibleHandler=()=>document.hidden?pause():play();document.addEventListener('visibilitychange',visibleHandler);
 if(!opts.poster)play();
}
export function skip(){if(skipped)return;skipped=true;elapsed=0;options.onBeat?.(null,99)}
export function unmount(){pause();removeEventListener('resize',resizeHandler);document.removeEventListener('visibilitychange',visibleHandler);if(scene){disposeTree(scene);scene.background?.dispose();plume.texture?.dispose();for(const b of beacons)b.material.map?.dispose()}renderer?.dispose();renderer?.domElement.remove();renderer=scene=camera=null;traffic=[];convoy=[];people=null;dust=null;beacons=[];plume=[];sparks=null}
export const active=()=>Boolean(renderer);
window.HomestandHome={mount,unmount,skip,active,pause,play};
window.dispatchEvent(new Event('homestand-home-ready'));
