'use strict';
const W=1600,H=900, BOUNDS={left:105,right:1495,top:85,bottom:815};
const UNITS={
 rifle:{label:'Rifle Squad',short:'RIFLE',cost:60,hp:86,speed:94,range:138,damage:10,fireRate:0.65,bulletSpeed:670,splash:0,radius:12,supply:1},
 tank:{label:'Siege Tank',short:'TANK',cost:165,hp:305,speed:56,range:196,damage:41,fireRate:1.65,bulletSpeed:460,splash:31,radius:20,supply:3},
 rocket:{label:'Rocket Battery',short:'ROCKET',cost:130,hp:118,speed:66,range:270,damage:29,fireRate:2.35,bulletSpeed:340,splash:63,radius:16,supply:2},
 engineer:{label:'Engineer Vehicle',short:'ENGINEER',cost:120,hp:180,speed:72,range:96,damage:5,fireRate:1.1,bulletSpeed:540,splash:0,radius:18,supply:2},
 patrol:{label:'Protected Patrol',short:'PATROL',cost:145,hp:250,speed:76,range:175,damage:26,fireRate:1.1,bulletSpeed:590,splash:14,radius:20,supply:3}
};
const STRUCTURES={
 barricade:{label:'Protective Barricade',cost:55,buildTime:4,hp:520,radius:34,role:'Blocks hostile vehicles and protects a lane'},
 watchtower:{label:'Defensive Watchtower',cost:110,buildTime:7,hp:430,radius:31,range:245,damage:22,fireRate:.78,role:'Automatically engages nearby threats'},
 barracks:{label:'Response Barracks',cost:145,buildTime:8,hp:620,radius:43,role:'Trains community response infantry'},
 workshop:{label:'Vehicle Workshop',cost:180,buildTime:10,hp:720,radius:48,role:'Produces protected patrol vehicles'},
 clinic:{label:'Field Clinic',cost:135,buildTime:8,hp:560,radius:40,heal:9,role:'Restores nearby friendly units'}
};
const START_CREDITS=350, MAX_SUPPLY=50, MAX_TIME=360, WIN_SCORE=600;
const NODES=[{x:800,y:200,name:'NORTH RIDGE'},{x:800,y:450,name:'CENTRAL RELAY'},{x:800,y:700,name:'SOUTH PASS'}];
module.exports={W,H,BOUNDS,UNITS,STRUCTURES,START_CREDITS,MAX_SUPPLY,MAX_TIME,WIN_SCORE,NODES};
