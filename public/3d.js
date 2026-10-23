import * as THREE from '/vendor/three.module.js';

// Interactive, procedurally modeled RTS battlefield. No third-party art assets.
const W=1600,H=900,S=30;
const toX=x=>(x-W/2)/S, toZ=y=>(y-H/2)/S;
const shades=[0x42bbed,0xe96f53], highlights=[0x9befff,0xffbd83];
const mat=(hex,roughness=0.8,metalness=0.1)=>new THREE.MeshStandardMaterial({color:hex,roughness,metalness,flatShading:true});
const M={ground:mat(0x526f45),road:mat(0xa99668),path:mat(0x96875d),sand:mat(0xc2aa70),water:mat(0x18687c,0.23,0.1),forest:mat(0x275c39),forest2:mat(0x42784b),trunk:mat(0x725b36),dark:mat(0x24323a,0.6),metal:mat(0x60767e,0.4,0.5),tire:mat(0x161d23),glass:mat(0x79c8cb,0.19,0.65),gold:mat(0xffcf75),glow: new THREE.MeshBasicMaterial({color:0xffeb96}),red:mat(shades[1]),blue:mat(shades[0])};
const baseGeo=new Map();
function geom(type,...dims){let key=[type,...dims].join(':');if(baseGeo.has(key))return baseGeo.get(key);let g;
 if(type==='box')g=new THREE.BoxGeometry(...dims);
 else if(type==='sphere')g=new THREE.SphereGeometry(...dims);
 else if(type==='cyl')g=new THREE.CylinderGeometry(...dims);
 else if(type==='cone')g=new THREE.ConeGeometry(...dims);
 else g=new THREE.TorusGeometry(...dims);
 baseGeo.set(key,g);return g;}
function mesh(parent,type,material,x,y,z,...dims){const obj=new THREE.Mesh(geom(type,...dims),material);obj.position.set(x,y,z);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj}
function box(parent,material,x,y,z,w,h,d){return mesh(parent,'box',material,x,y,z,w,h,d)}
function random(seed=89021){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const rand=random();
let scene,camera,renderer,canvas,active=false,frameHandle=0,objects=new Map(),groundObjects=[],decor=[],clock=new THREE.Clock(),snapshot=null,selected=new Set(),cameraTarget=new THREE.Vector3(0,0,0),pan={startX:0,startY:0,moved:false,button:0},rot=-0.15,range=41,canopyMesh=null;
function terrain(){
 box(scene,M.ground,0,-0.7,0,W/S,1.2,H/S);
 box(scene,M.water,0,-0.6,-H/S/2+1.15,W/S,1.4,3.4);
 box(scene,M.sand,0,-0.35,-H/S/2+3.6,W/S,.4,3);
 // Roads and tactical crossings
 box(scene,M.road,0,-.018,0,W/S,.07,3.5);
 box(scene,M.path,0,-.008,0,2.05,.09,H/S*.88);
 for(const zz of [-8.3,8.3])box(scene,M.path,0,-.001,zz,47,.07,1.25);
 for(const x of [-20.1,20.1]){box(scene,M.dark,x,.02,0,9.2,.22,16.6);for(let i=0;i<8;i++)box(scene,M.metal,x,.13,-7.7+i*2.1,9.1,.04,.04)}
 // Trees and rocks. Clear the combat lanes to retain accurate click targets.
 for(let i=0;i<145;i++){
  const x=(rand()-.5)*W/S*.95,z=(rand()-.5)*H/S*.95;
  if(Math.abs(z)<3.1||Math.abs(x)<2.95||Math.abs(x)>18&&Math.abs(z)<10||z<-12)continue;
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);decor.push(g);
  if(rand()<.21){let s=.45+rand()*.75;const rock=mesh(g,'sphere',mat(i%2?0x657260:0x84917c),0,.15,0,1,8,6);rock.scale.set(s*1.5,s*.66,s);continue}
  const height=.8+rand()*1.25;
  mesh(g,'cyl',M.trunk,0,height/2,0,.08,.17,height,6);
  const leaves=i%2?M.forest:M.forest2;
  for(let j=0;j<5;j++){let a=j*Math.PI*2/5+rand()*.35,l=.55+rand()*.42;
    const leaf=mesh(g,'cone',leaves,Math.cos(a)*l*.3,height+.22,Math.sin(a)*l*.3,.37,l,5);
    leaf.rotation.z=Math.cos(a)*-.48;leaf.rotation.x=Math.sin(a)*.48;
  }
 }
 for(let i=0;i<65;i++){const x=(rand()-.5)*52,z=(rand()-.5)*28;if(Math.abs(z)<3.5||Math.abs(x)<4)continue;
   const grass=new THREE.Group();grass.position.set(x,.02,z);scene.add(grass);decor.push(grass);
   for(let j=0;j<3;j++){const blade=mesh(grass,'cone',i%3?M.forest2:M.forest,(rand()-.5)*.22,.17,(rand()-.5)*.22,.1,.35,4);blade.rotation.z=(rand()-.5)*.7}
 }
}
function makeUnit(u){const g=new THREE.Group(),c=mat(shades[u.team],.48,.3),shine=mat(highlights[u.team],.45,.2);g.userData.entity=u.id;g.userData.kind='unit';
 if(u.type==='rifle'){
  mesh(g,'cyl',M.dark,0,.40,0,.21,.23,.36,8);
  mesh(g,'cyl',c,0,.70,0,.23,.28,.34,8);
  mesh(g,'sphere',shine,.05,1.0,0,.26,8,6);
  box(g,M.glass,.21,1.02,0,.13,.12,.29);
  for(const z of [-.2,.2]){box(g,M.dark,-.04,.22,z,.20,.34,.12);box(g,c,-.03,.72,z,.15,.33,.12)}
  const gun=box(g,M.metal,.32,.66,.05,.58,.13,.11);gun.rotation.z=.07;
 }else if(u.type==='tank'){
  const hull=box(g,M.tire,0,.27,0,1.52,.39,1.1);
  for(const z of [-.58,.58]){box(g,M.tire,0,.25,z,1.53,.44,.28);for(let xx of [-.54,-.18,.18,.54])mesh(g,'cyl',M.metal,xx,.20,z*.99,.17,.17,.13,8).rotation.x=Math.PI/2}
  box(g,c,0,.58,0,1.51,.43,.96);box(g,shine,.45,.79,0,.58,.1,.6);
  mesh(g,'cyl',M.dark,-.06,.90,0,.4,.5,.26,10);
  box(g,c,-.04,1.02,0,.85,.31,.71);
  const barrel=mesh(g,'cyl',M.metal,.88,1.04,0,.12,.16,1.25,9);barrel.rotation.z=Math.PI/2;
  box(g,M.gold,1.46,1.03,0,.16,.21,.2);
 }else{
  for(const z of [-.55,.55])box(g,M.tire,0,.25,z,1.17,.48,.26);
  box(g,c,0,.58,0,1.2,.48,.86);box(g,M.dark,-.12,.98,0,1.0,.22,.8);
  for(const z of [-.3,0,.3]){const missile=mesh(g,'cyl',M.metal,.35,1.03,z,.15,.16,1.18,8);missile.rotation.z=Math.PI/2;mesh(g,'cone',shine,.98,1.03,z,.13,.27,8).rotation.z=-Math.PI/2}
 }
 const ring=mesh(g,'torus',mat(0x9ff8dd),0,.055,0,Math.max(.40,u.type==='tank'?.93:.69),.065,8,30);ring.rotation.x=Math.PI/2;ring.visible=false;ring.userData.selectionRing=true;
 const hpBack=box(g,M.tire,0,1.75,0,1,.13,.10),hpFront=box(g,mat(0x6aef9b),0,1.755,.01,1,.135,.12);g.userData.ring=ring;g.userData.hpFront=hpFront;g.userData.hpBack=hpBack;
 return g;
}
function makeBase(b){const g=new THREE.Group(),c=mat(shades[b.team],.5,.5),hi=mat(highlights[b.team],.35,.5);
 if(b.kind==='hq'){
  box(g,M.dark,0,.40,0,4.2,.75,3.55);box(g,c,0,1.21,0,3.55,1.1,3.0);
  box(g,M.metal,0,2.15,0,2.45,.68,2.2);box(g,c,0,2.65,0,1.8,.38,1.7);
  box(g,hi,1.0,1.5,1.53,.70,.74,.13);box(g,hi,-1.0,1.5,1.53,.70,.74,.13);
  for(const xx of [-1.35,1.35]){box(g,M.dark,xx,2.0,-.9,.58,2.0,.56);box(g,hi,xx,3.12,-.9,.61,.22,.59)}
  const antenna=mesh(g,'cyl',M.metal,0,3.55,0,.06,.06,1.6,8);mesh(g,'sphere',hi,0,4.38,0,.22,10,8);
 }else{
  box(g,M.dark,0,.34,0,1.65,.6,1.6);box(g,c,0,.88,0,1.32,.75,1.25);
  mesh(g,'cyl',M.metal,0,1.45,0,.54,.62,.40,10);box(g,hi,0,1.61,0,.9,.33,.77);
  mesh(g,'cyl',M.metal,b.team?-.71:.71,1.65,0,.13,.19,1.48,9).rotation.z=Math.PI/2;
 }
 return g;
}
function makeNode(n){const g=new THREE.Group(),ring=mesh(g,'torus',mat(0xffe6a1),0,.16,0,2.18,.11,9,60);ring.rotation.x=Math.PI/2;
 mesh(g,'cyl',M.dark,0,.30,0,1.15,1.2,.6,10);box(g,M.metal,0,1.14,0,1.32,1.35,1.32);
 box(g,M.glass,0,1.87,0,.8,.18,.8);mesh(g,'sphere',M.gold,0,2.08,0,.26,10,9);
 g.userData.ring=ring;return g;
}
function makeProjectile(p){const g=new THREE.Group(),orb=mesh(g,'sphere',p.from?M.red:M.gold,0,.65,0,p.type==='rocket'?.2:.12,8,7);
 orb.material=mat(p.from?0xff966c:0xffe4a2,0.2,0.6);return g}
function makeBlast(b){const g=new THREE.Group();const fire=mesh(g,'sphere',new THREE.MeshBasicMaterial({color:0xff9239,transparent:true,opacity:.7,depthWrite:false}),0,.36,0,1,10,8);
 fire.scale.set(.4,.6,.4);g.userData.fire=fire;return g}
const loc=(entity)=>({x:toX(entity.x),z:toZ(entity.y)});
function addEntity(kind,e){let g;if(kind==='unit')g=makeUnit(e);else if(kind==='base')g=makeBase(e);else if(kind==='node')g=makeNode(e);else if(kind==='projectile')g=makeProjectile(e);else g=makeBlast(e);
 const p=loc(e);g.position.set(p.x,0,p.z);scene.add(g);objects.set(kind+e.id,{g,kind,last:e})}
function sync(data,s){snapshot=data;selected=new Set(s||[]);if(!scene||!active||!snapshot)return;
 const expected=new Set();for(const [kind,arr] of [['unit',data.units],['base',data.bases],['node',data.nodes],['projectile',data.projectiles],['blast',data.blasts]])for(const e of arr){if(kind==='base'&&e.hp<=0)continue;const key=kind+e.id;expected.add(key);if(!objects.has(key))addEntity(kind,e);const entry=objects.get(key);entry.last=e;
   if(kind==='unit'){entry.g.userData.ring.visible=selected.has(e.id);entry.g.userData.hpFront.scale.x=Math.max(.01,e.hp/e.maxHp);entry.g.userData.hpFront.position.x=-(1-e.hp/e.maxHp)/2;entry.g.userData.hpFront.material.color.setHex(e.hp/e.maxHp<.35?0xff635a:0x6aef9b);}
   else if(kind==='node'){entry.g.userData.ring.material.color.setHex(e.owner===0?0x49d9fd:e.owner===1?0xff795e:0xffe6a1)}
 }
 for(const [k,obj] of objects)if(!expected.has(k)){scene.remove(obj.g);objects.delete(k)}
}
function mount(){if(active)return;const host=document.querySelector('.arena-frame');if(!host)return;try{
 scene=new THREE.Scene();scene.background=new THREE.Color(0x9fbbc1);scene.fog=new THREE.Fog(0x9fbbc1,42,100);
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 canvas=renderer.domElement;canvas.id='world3d';host.insertBefore(canvas,host.firstChild);host.classList.add('using-3d');
 camera=new THREE.OrthographicCamera(-range*.8,range*.8,range*.45,-range*.45,.1,160);
 scene.add(new THREE.HemisphereLight(0xe6faff,0x596147,2.1));const light=new THREE.DirectionalLight(0xffefcf,3.6);light.position.set(-13,35,18);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-36;light.shadow.camera.right=36;light.shadow.camera.top=28;light.shadow.camera.bottom=-28;scene.add(light);
 terrain();active=true;canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('wheel',onWheel,{passive:false});window.addEventListener('keydown',onKey);
 resize();window.addEventListener('resize',resize);sync(window.IronBridge?.snapshot(),window.IronBridge?.selected());frameHandle=requestAnimationFrame(loop);
 }catch(e){console.error('3D init failed',e);unmount();window.IronBridge?.notify('3D renderer unavailable; 2D fallback active')}}
function unmount(){if(!active)return;active=false;cancelAnimationFrame(frameHandle);window.removeEventListener('resize',resize);window.removeEventListener('keydown',onKey);for(const o of objects.values())scene.remove(o.g);objects.clear();for(const o of decor)scene.remove(o);decor=[];
 renderer.dispose();canvas.remove();document.querySelector('.arena-frame')?.classList.remove('using-3d');canvas=null;scene=null;camera=null;renderer=null}
function resize(){if(!active)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const aspect=rect.width/rect.height;
 camera.left=-range*aspect/2;camera.right=range*aspect/2;camera.top=range/2;camera.bottom=-range/2;camera.updateProjectionMatrix();renderer.setSize(rect.width,rect.height,false)}
function center(x,y){cameraTarget.x=THREE.MathUtils.clamp(toX(x),-16,16);cameraTarget.z=THREE.MathUtils.clamp(toZ(y),-9,9)}
function zoom(d){range=Math.max(16,Math.min(78,range-d*19));resize()}
function onWheel(e){e.preventDefault();zoom(-Math.sign(e.deltaY)*.16)}
function onKey(e){if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 let v=1.4;if(e.key==='ArrowLeft'&&e.shiftKey)cameraTarget.x-=v;else if(e.key==='ArrowRight'&&e.shiftKey)cameraTarget.x+=v;else if(e.key==='ArrowUp'&&e.shiftKey)cameraTarget.z-=v;else if(e.key==='ArrowDown'&&e.shiftKey)cameraTarget.z+=v;
 else if(e.key.toLowerCase()==='r')rot+=.25;
}
function fromPointer(e){if(!canvas||!camera)return null;const rect=canvas.getBoundingClientRect();const ndc=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
 const raycaster=new THREE.Raycaster();raycaster.setFromCamera(ndc,camera);const horizontal=new THREE.Plane(new THREE.Vector3(0,1,0),0),point=new THREE.Vector3();if(!raycaster.ray.intersectPlane(horizontal,point))return null;
 return {x:THREE.MathUtils.clamp(point.x*S+W/2,0,W),y:THREE.MathUtils.clamp(point.z*S+H/2,0,H)} }
function down(e){e.preventDefault();canvas.setPointerCapture(e.pointerId);pan={startX:e.clientX,startY:e.clientY,moved:false,button:e.button,shift:e.shiftKey,alt:e.altKey};}
function move(e){if(!pan||!(e.buttons))return;const dx=e.clientX-pan.startX,dy=e.clientY-pan.startY;
 if(Math.hypot(dx,dy)>6)pan.moved=true;
 if(pan.button===1||pan.alt||e.pointerType==='touch'&&pan.moved&&e.buttons===1){const factor=range/Math.max(canvas.clientHeight,1);
 cameraTarget.x-=dx*factor*.9;cameraTarget.z-=dy*factor*.75;cameraTarget.x=THREE.MathUtils.clamp(cameraTarget.x,-16,16);cameraTarget.z=THREE.MathUtils.clamp(cameraTarget.z,-9,9);
 pan.startX=e.clientX;pan.startY=e.clientY;}}
function up(e){if(!pan)return;const old=pan;pan=null;if(old.moved)return;const p=fromPointer(e);if(p)window.IronBridge?.handle(p,old.button===2,old.shift)}
function loop(t){if(!active)return;frameHandle=requestAnimationFrame(loop);
 camera.position.set(cameraTarget.x+Math.sin(rot)*24, cameraTarget.y+33, cameraTarget.z+34*Math.cos(rot));camera.lookAt(cameraTarget.x,0,cameraTarget.z);
 const snap=snapshot;if(snap){for(const ent of objects.values()){const e=ent.last,g=ent.g,p=loc(e);g.position.x+=(p.x-g.position.x)*.35;g.position.z+=(p.z-g.position.z)*.35;
 if(ent.kind==='unit'){g.rotation.y=-(e.angle||0);g.userData.ring.rotation.x=Math.PI/2;}
 if(ent.kind==='blast'){const phase=Math.max(0,Math.min(1,(e.age-e.delay)/.9));g.userData.fire.visible=e.age>=e.delay;g.userData.fire.scale.setScalar(Math.max(.1,e.radius/30*(.35+phase)));g.userData.fire.material.opacity=Math.max(0,.8-phase*.8)}
 if(ent.kind==='node'){g.children[0].rotation.z+=.01;}
 }}renderer.render(scene,camera)}
window.Iron3D={mount,unmount,sync,zoom,center,active:()=>active};window.dispatchEvent(new Event('iron3d-ready'));