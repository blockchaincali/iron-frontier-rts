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
 };
 const ids=Object.freeze(Object.keys(maps));
 const get=id=>maps[id]||maps.coastal;
 return Object.freeze({maps:Object.freeze(maps),ids,get,defaultId:'coastal'});
});
