// HOMESTAND platform adapter. The standalone web build implements every hook locally.
// A distribution partner (for example a Lagos Life integration) can replace this object
// before game.js runs, after its official SDK requirements have been reviewed. The game
// never assumes accounts, payments or partner APIs exist. See docs/PLATFORM_INTEGRATION.md.
(function(root){
 'use strict';
 if(root.HomestandPlatform)return;
 const listeners=new Map();
 root.HomestandPlatform={
  id:'standalone',
  // Display identity only. Partners may supply a verified name; standalone uses local storage.
  player(){return {name:localStorage.getItem('iron-frontier-name')||'Commander',verified:false}},
  // Lifecycle notifications a host shell can observe (analytics, pause UI, achievements).
  emit(event,detail={}){for(const fn of listeners.get(event)||[])try{fn(detail)}catch(error){console.warn('Platform listener failed',event,error)}},
  on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return ()=>listeners.get(event)?.delete(fn)},
  // Commerce is intentionally absent: no purchases, currencies or pay-to-win hooks exist.
  capabilities:Object.freeze({accounts:false,purchases:false,leaderboards:false,share:typeof navigator!=='undefined'&&Boolean(navigator.share)})
 };
})(typeof globalThis!=='undefined'?globalThis:this);
