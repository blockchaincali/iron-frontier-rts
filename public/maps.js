(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 else root.IronMaps=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const maps={
  coastal:{id:'coastal',name:'Coastal Frontier',tagline:'Tropical command coast',description:'Fight from fortified shores through palms, relay roads, and a deep-water naval frontier.',seed:0x43a91f2d,colors:{ground:'#536348',road:'#4d5150',water:'#0d7086',accent:'#49d5c9',minimap:'#315d48'},atmosphere:{fog:0x718a8b,skyTop:'#183541',skyMid:'#53747a',skyLow:'#d4ae7b',sun:0xffd09a}},
  desert:{id:'desert',name:'Desert Front',tagline:'Canyon strike corridor',description:'Command armored columns between wind-cut mesas, dunes, dusty outposts, and sparse desert scrub.',seed:0xd35e7a11,colors:{ground:'#ad824c',road:'#655341',water:'#8f673d',accent:'#ffbb66',minimap:'#a47745'},atmosphere:{fog:0xc28d5e,skyTop:'#53382f',skyMid:'#c27d55',skyLow:'#f1c98b',sun:0xffbd78}},
  frozen:{id:'frozen',name:'Frozen Territory',tagline:'Glacial relay basin',description:'Advance across snowfields, frozen rivers, black-rock cliffs, winter pines, and isolated polar facilities.',seed:0xf20a6e91,colors:{ground:'#c5d5d7',road:'#58646a',water:'#83c7d8',accent:'#9cecff',minimap:'#a8c8cf'},atmosphere:{fog:0xa9c5ce,skyTop:'#233b55',skyMid:'#6f91a4',skyLow:'#dcecf0',sun:0xd9efff}}
  ,'safe-haven':{id:'safe-haven',name:'Operation Safe Haven',tagline:'Civilian protection mission',description:'Fortify a fictional Nigerian town, protect community facilities, and secure the evacuation road.',seed:0x9a17e2c4,colors:{ground:'#8b754f',road:'#b08d59',water:'#4d8b91',accent:'#49d5c9',minimap:'#7d7a4f'},atmosphere:{fog:0xc9a77c,skyTop:'#4a7b8f',skyMid:'#a9c2b4',skyLow:'#ecc58a',sun:0xffd9a0}}
 };
 // Authored district plan for Kachia, the fictional Safe Haven town. World units match the
 // 2400 x 1350 simulation. The renderer, cinematic homepage, minimap and server build
 // validation all read this one plan, so scenery and blocked ground can never disagree.
 const layouts={
  'safe-haven':{
   zones:[
    {id:'base',name:'Response Base',x:430,y:600,r:260},
    {id:'residential',name:'Kachia Residential',x:1250,y:190,r:260},
    {id:'market',name:'Unity Market',x:1060,y:960,r:170},
    {id:'clinic',name:'Clinic Quarter',x:790,y:470,r:130},
    {id:'school',name:'School & Community',x:1360,y:470,r:190},
    {id:'evacuation',name:'Evacuation Corridor',x:1820,y:1060,r:220},
    {id:'staging',name:'Hostile Staging Area',x:2140,y:660,r:240}
   ],
   roads:[
    {id:'highway',surface:'asphalt',width:74,points:[[60,682],[700,680],[1120,676],[1700,672],[2340,668]]},
    {id:'avenue',surface:'asphalt',width:54,points:[[940,150],[940,676],[940,1240]]},
    {id:'evacuation',surface:'asphalt',width:52,evacuation:true,points:[[1120,676],[1400,850],[1780,1030],[2340,1140]]},
    {id:'school-road',surface:'laterite',width:44,points:[[940,330],[1250,330],[1570,320],[1900,250],[2340,232]]},
    {id:'market-street',surface:'laterite',width:42,points:[[560,830],[760,860],[940,880],[1250,930],[1400,850]]},
    {id:'compound-lane',surface:'laterite',width:36,points:[[150,262],[600,250],[825,335],[940,330]]},
    {id:'forest-track',surface:'laterite',width:30,points:[[560,830],[620,960],[650,1050],[520,1240]]},
    {id:'base-track',surface:'laterite',width:36,points:[[250,680],[300,520],[330,262]]}
   ],
   compounds:[
    {x:240,y:178,w:150,d:118,rot:.05,style:0},{x:410,y:168,w:140,d:118,rot:-.04,style:1},{x:575,y:162,w:150,d:112,rot:.02,style:2},
    {x:1060,y:192,w:150,d:118,rot:0,style:3,storeys:2},{x:1215,y:204,w:140,d:112,rot:.06,style:4},{x:1375,y:186,w:150,d:118,rot:-.03,style:5},{x:1740,y:160,w:150,d:116,rot:.04,style:1,storeys:2},
    {x:1090,y:470,w:122,d:100,rot:-.02,style:2},{x:1830,y:470,w:140,d:108,rot:.05,style:0},
    {x:820,y:1064,w:140,d:108,rot:.03,style:4},{x:1180,y:1122,w:150,d:112,rot:.03,style:5},{x:1340,y:1142,w:140,d:112,rot:-.05,style:0,storeys:2},{x:1500,y:1172,w:150,d:106,rot:.02,style:3},{x:1660,y:1190,w:140,d:98,rot:-.03,style:1},
    {x:230,y:962,w:150,d:118,rot:-.03,style:3},{x:242,y:1142,w:150,d:112,rot:.04,style:2},{x:1960,y:1205,w:140,d:96,rot:.02,style:4}
   ],
   market:{x:1070,y:1005,w:250,d:96},
   field:{x:1460,y:540,w:200,d:112},
   checkpoints:[{x:1540,y:674,rot:0},{x:2140,y:1112,rot:.18}],
   staging:{x:2150,y:675,w:230,d:760},
   forests:[{x:430,y:1135,r:190},{x:2160,y:225,r:140},{x:1975,y:880,r:110},{x:150,y:440,r:80},{x:705,y:1240,r:110}],
   evacuationPoint:{x:2200,y:1128}
  }
 };
 // Circles of authored scenery that construction may not overlap.
 function blockers(id){
  const layout=layouts[id];if(!layout)return [];
  const list=layout.compounds.map(c=>({x:c.x,y:c.y,radius:Math.max(c.w,c.d)*.5}));
  const m=layout.market;list.push({x:m.x-m.w*.25,y:m.y,radius:m.d*.62},{x:m.x+m.w*.25,y:m.y,radius:m.d*.62});
  for(const c of layout.checkpoints)list.push({x:c.x,y:c.y-56,radius:26},{x:c.x,y:c.y+56,radius:26});
  return list;
 }
 const ids=Object.freeze(['coastal','desert','frozen']);
 const get=id=>maps[id]||maps.coastal;
 return Object.freeze({maps:Object.freeze(maps),layouts:Object.freeze(layouts),blockers,ids,get,defaultId:'coastal'});
});
