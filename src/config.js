'use strict';
const W=1600,H=900, BOUNDS={left:105,right:1495,top:85,bottom:815};
const UNITS={
 rifle:{label:'Rifle Squad',short:'RIFLE',cost:60,hp:86,speed:94,range:138,damage:10,fireRate:0.65,bulletSpeed:670,splash:0,radius:12,supply:1},
 tank:{label:'Siege Tank',short:'TANK',cost:165,hp:305,speed:56,range:196,damage:41,fireRate:1.65,bulletSpeed:460,splash:31,radius:20,supply:3},
 rocket:{label:'Rocket Battery',short:'ROCKET',cost:130,hp:118,speed:66,range:270,damage:29,fireRate:2.35,bulletSpeed:340,splash:63,radius:16,supply:2}
};
const START_CREDITS=350, MAX_SUPPLY=50, MAX_TIME=360, WIN_SCORE=600;
const NODES=[{x:800,y:200,name:'NORTH RIDGE'},{x:800,y:450,name:'CENTRAL RELAY'},{x:800,y:700,name:'SOUTH PASS'}];
module.exports={W,H,BOUNDS,UNITS,START_CREDITS,MAX_SUPPLY,MAX_TIME,WIN_SCORE,NODES};
