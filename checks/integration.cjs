// Deterministic integration smoke test. Uses only Node built-ins; no browser or network.
const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
function boot(html) {
  const canvas = new Proxy({ globalAlpha: 1 }, { get: (o, k) => (k in o ? o[k] : () => canvas) }),
    saved = new Map();
  const element = {
    style: {},
    classList: { toggle() {} },
    addEventListener() {},
    getContext: () => canvas,
    querySelector: () => element,
    querySelectorAll: () => [],
    blur() {},
  };
  let seed = 654321;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const box = vm.createContext({
    Math: math,
    Date: class extends Date {
      static now() {
        return 123456789;
      }
    },
    document: {
      getElementById: () => ({ ...element }),
      createElement: () => ({ ...element }),
      querySelectorAll: () => [],
      activeElement: element,
    },
    window: {},
    innerWidth: 960,
    innerHeight: 640,
    addEventListener() {},
    requestAnimationFrame() {},
    performance: { now: () => 0 },
    setTimeout() {},
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
    Audio: class {
      addEventListener() {}
      play() {
        return { catch() {} };
      }
      pause() {}
    },
  });
  for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = attrs.match(/src="([^"]+)"/)?.[1];
    vm.runInContext(src ? fs.readFileSync(src, 'utf8') : code, box);
  }
  return box;
}

const box = boot(fs.readFileSync('index.html', 'utf8'));
const result = vm.runInContext(
  `
muted=true;CFG.bomberChance=0;const summaries=[];
const profiles=[['original',30],['original',45],['original',60],['preset01',30],['preset01',45],['preset01',60],['map',30],['campaign',30]];
for(const [mode,size]of profiles){
 PREFS.mapMode=mode;PREFS.mapSize=size;PREFS.mapPick=claudeMaps()[0].id;PREFS.campaignStart=0;startGame();base.hp=99999;
 let seen=0,peak=0,shellPeak=0,rocketPeak=0,launchers=0,allyPeak=0;keys.Space=true;mouse.x=W/2;mouse.y=0;
 for(let f=0;f<1800;f++){
  player.inv=99;keys.KeyW=f%300<100;keys.KeyD=f%120<20;keys.ShiftLeft=f%400===0;
  if(f===100)beginPlayerUpgrade(player);if(f===200)beginPlayerUpgrade(player);if(f===600||f===1200)callBarrage();
  if(f===30)toSpawn.push('rocket');if(f===400)applyItem(player,{type:'reinforce',x:player.x,y:player.y,life:5});if(f===900)applyItem(player,{type:'stroybat',x:player.x,y:player.y,life:5});if(f===1000)applyItem(player,{type:'curtain',x:player.x,y:player.y,life:5});
  const before=enemies.length;update(1/30);seen+=Math.max(0,enemies.length-before);peak=Math.max(peak,enemies.length);shellPeak=Math.max(shellPeak,artilleryShells.length);rocketPeak=Math.max(rocketPeak,rockets.length);launchers=Math.max(launchers,enemies.filter(e=>e.kind==='rocket').length);allyPeak=Math.max(allyPeak,allies.length);
  for(const e of [player,...enemies,...allies,...bullets,...parts,...rockets])for(const k of ['x','y','vx','vy','life','angle','turret'])if(e[k]!==undefined&&!Number.isFinite(e[k]))throw Error(mode+' nonfinite '+k);
  if(f%60===0)draw();
  if(state==='over')throw Error(mode+' unexpected defeat');
 }
 if(!seen||player.upgrade!==2)throw Error('Scenario did not exercise enemies/upgrades');
 if(!launchers)throw Error(mode+' rocket launcher did not appear');if(allyPeak<2)throw Error(mode+" reinforcements did not arrive");
 summaries.push({mode,size:COLS+'x'+ROWS,frames:1800,enemiesSpawned:seen,peakEnemies:peak,peakArtillery:shellPeak,peakRockets:rocketPeak,reinforcements:allyPeak});
 keys.Space=keys.KeyW=keys.KeyD=keys.ShiftLeft=false;toMenu();
}
PREFS.mapMode='original';PREFS.mapSize=30;startGame();setPlayerUpgrade(player,2);player.inv=0;hitPlayer({x:player.x,y:player.y,dmg:99});for(let f=0;f<600;f++){update(1/30);draw();}if(state!=='over'||!player.dead)throw Error('Maximum upgrade death sequence');
startGame();hitBase(999);for(let f=0;f<600;f++){update(1/30);draw();}if(state!=='over'||!base.dead||base.collapseCount!==3)throw Error('Base collapse sequence');
JSON.stringify(summaries);
`,
  box,
);
console.log(
  'PASS: 14,400 simulation frames (8 minutes), 240 sampled draws, all four modes, both upgrade tiers, barrages, Panzerwerfer 42, reinforcements and base bonuses.',
);
console.log('PASS: fully upgraded player death and base collapse, 1200 additional frames/draws.');
console.log(result);
