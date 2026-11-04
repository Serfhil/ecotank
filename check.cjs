const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
require('./check-modules.cjs')(__dirname);
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(([,attrs,inline])=>({src:attrs.match(/\bsrc="([^"]+)"/)?.[1],inline}));
const code=scripts.filter(s=>!s.src).map(s=>s.inline).join('\n');
const context=new Proxy({}, {get:(o,k)=>k in o?o[k]:(()=>context)});
context.globalAlpha=1;
context.arc=(x,y,r)=>{if(!Number.isFinite(r)||r<0)throw Error('Invalid Canvas arc radius '+r);};
context.ellipse=(x,y,rx,ry)=>{if(!Number.isFinite(rx)||!Number.isFinite(ry)||rx<0||ry<0)throw Error('Invalid Canvas ellipse radius');};
const element={style:{},classList:{toggle(){}},addEventListener(){},getContext:()=>context,querySelector:()=>element,querySelectorAll:()=>[],blur(){}};
const store=new Map([['ecotank-dev',JSON.stringify({KINDS:{player:{speed:999}},CFG:{brickHp:2}})]]);
const box={console,document:{getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],createTextNode:text=>({textContent:text}),activeElement:element},window:{},innerWidth:960,innerHeight:640,addEventListener(){},requestAnimationFrame(){},performance:{now:()=>0},setTimeout(){},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
box.Audio=class {constructor(){this.handlers={};} addEventListener(name,fn){this.handlers[name]=fn;} play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}};
vm.createContext(box);
// Use the same classic-script order as index.html, including file://-compatible modules.
for(const script of scripts)vm.runInContext(script.src?fs.readFileSync(__dirname+'/'+script.src,'utf8'):script.inline,box,{filename:script.src||'index.html'});
vm.runInContext(`
muted=true;
if(KINDS.player.speed!==60||KINDS.player.bulletSpeed!==1200||KINDS.heavy.hp!==3)throw Error('Defaults or legacy settings');
player=makeTank(480,592,'player');player.turret=0;mouse.x=480;mouse.y=100;updatePlayer(.1);
if(Math.abs(player.turret+.1)>1e-8)throw Error('Turret rate');
if(Math.abs(turnTo(3.13,-3.13,.01)-3.14)>1e-8)throw Error('Angular wrap');
grid.fill(EMPTY);grid[100]=BRICK;brickHp[100]=4;brickMask[100]=1023;
for(let n=1;n<=4;n++){hitBrick(10,3,2,321,97);if(brickHp[100]!==4-n)throw Error('Four shells');if(n<4&&grid[100]!==BRICK)throw Error('Early destruction');}
if(grid[100]!==EMPTY||brickMask[100]!==0)throw Error('Final destruction');
CFG.mapElements=0;genMap(1);if(grid.some(t=>t!==EMPTY))throw Error('Empty density');
CFG.mapElements=180;for(let n=0;n<20;n++){genMap(1);if(!connected())throw Error('Disconnected dense map');}
CFG.mapElements=42;genMap(1);if(!grid.some((t,i)=>t!==grid[Math.floor(i/COLS)*COLS+COLS-1-i%COLS]))throw Error('Symmetry');
buildDev();draw();saveDev();if(!localStorage.getItem('ecotank-dev-v2'))throw Error('Persistence');
grid.fill(EMPTY);player=makeTank(400,400,'player');player.angle=Math.PI/2;keys.KeyW=true;
updatePlayer(.1);if(Math.abs(player.x-400)>1e-6||player.y<=400)throw Error('Body-relative forward');
keys.KeyW=false;keys.KeyS=true;const fy=player.y;updatePlayer(.1);if(player.y>=fy)throw Error('Reverse');
keys.KeyS=false;keys.ArrowRight=true;const a=player.angle,x=player.x,y=player.y;updatePlayer(.1);
if(player.angle<=a||player.x!==x||player.y!==y)throw Error('Turn in place');keys.ArrowRight=false;
if(new Set([0,1,2].map(v=>JSON.stringify(masonry(v)))).size!==3)throw Error('Masonry variants');
for(let v=0;v<3;v++){grid[100]=BRICK;brickHp[100]=4;brickMask[100]=1023;brickVariant[100]=v;
let count=10;for(let n=1;n<=4;n++){hitBrick(10,3,1,321,97);const next=brickMask[100].toString(2).replace(/0/g,'').length;if(next>=count)throw Error('Masonry destruction');count=next;}}
player=makeTank(400,400,'player');player.inv=0;const hp=player.hp;
grid.fill(EMPTY);grid[12*COLS+13]=BRICK;brickHp[12*COLS+13]=4;brickMask[12*COLS+13]=1023;
blastDamage(420,400,30);if(player.hp!==hp-1||brickHp[12*COLS+13]!==3)throw Error('Blast damage');
player.inv=0;player.x=500;const safe=player.hp;blastDamage(420,400,30);if(player.hp!==safe)throw Error('Blast radius');
wrecks=[{x:400,y:400,kind:'soldier',age:0,smokeT:0},{x:600,y:400,kind:'heavy',age:0,smokeT:0}];
player.x=400;updateWrecks(1);if(wrecks[0].taken)throw Error('Burn before pickup');
const before=scrap;if(collectRemainingScrap()!==6||scrap!==before+6||collectRemainingScrap()!==0)throw Error('Auto salvage once');
updateWrecks(.5);if(wrecks.length!==2)throw Error('Keep burning after auto salvage');updateWrecks(.6);if(wrecks.length)throw Error('Burn cleanup');
player.cd=.5;player.reloadDuration=1;if(reloadProgress(player)!==.5)throw Error('Reload half');player.cd=-1;if(reloadProgress(player)!==1)throw Error('Reload ready');
grid.fill(EMPTY);const leafIndex=5*COLS+5;grid[leafIndex]=TREE;foliageMask[leafIndex]=31;
const shot={x:160,y:176,vx:600,vy:0,life:2,r:2,dmg:1,owner:'p'};enemies=[];bullets=[shot];updateBullets(.05);
if(shot.dead||shot.x<=160||foliageMask[leafIndex]===31)throw Error('Unimpeded foliage hit');
const leafMask=foliageMask[leafIndex];hitFoliage(5,5,176,176,shot);if(foliageMask[leafIndex]!==leafMask)throw Error('One damage per projectile per crown');
for(let i=0;i<4;i++)hitFoliage(5,5,176,176,{});if(grid[leafIndex]!==EMPTY)throw Error('Full foliage destruction');
grid.fill(EMPTY);player=makeTank(700,500,'player');
const a1=makeTank(300,300,'scout'),a2=makeTank(326,300,'scout'),a3=makeTank(352,300,'scout'),safeTank=makeTank(550,300,'heavy');
for(const e of [a1,a2,a3,safeTank])e.spawnT=0;enemies=[a1,a2,a3,safeTank];wrecks=[];const oldScore=score;
hitEnemy(a1,{x:300,y:300,dmg:1});if(a2.dead||wrecks.length!==1||wrecks[0].detonateAt<.5||wrecks[0].detonateAt>1.5)throw Error('Delayed blast');
if(wrecks[0].angle!==a1.angle||wrecks[0].turret!==a1.turret||wrecks[0].tread!==a1.tread)throw Error('Dying model pose');drawWrecks();
updateWrecks(3.1);if(!a2.dead||!a3.dead||safeTank.hp!==KINDS.heavy.hp||wrecks.length!==3)throw Error('Chain blast');
if(score!==oldScore+300)throw Error('Chain kill score');hitEnemy(a1,{x:0,y:0,dmg:1});if(wrecks.length!==3)throw Error('Duplicate kill');
state='play';musicOff=false;muted=false;syncMusic();if(!musicWanted||music.paused)throw Error('Music start');
state='pause';syncMusic();if(!musicWanted||music.paused||Math.abs(music.volume-.066*gameVolume)>1e-6)throw Error('Music duck');state='play';musicOff=true;syncMusic();if(musicWanted)throw Error('Music disabled');
drawPlayerModel(player);drawTank(player);drawTrees();
muted=true;grid.fill(EMPTY);player=makeTank(400,400,'player');enemies=[];items=[{x:400,y:400,type:'upgrade',life:5}];updateItems(.01);
if(!player.armor)throw Error('AP pickup');bullets=[];fire(player);const apShot=bullets[0];
if(Math.abs(Math.hypot(apShot.vx,apShot.vy)-KINDS.player.bulletSpeed*1.5)>1e-6||apShot.dmg!==KINDS.player.dmg*2||!apShot.armor)throw Error('AP stats');
updateBullets(.01);if(!apShot.trail.length)throw Error('AP tracer');nextWave();if(!player.armor)throw Error('AP wave persistence');
items=[{x:player.x,y:player.y,type:'upgrade',life:5}];updateItems(.01);bullets=[];fire(player);if(bullets[0].dmg!==2||bullets.length!==2)throw Error('AP upgrade damage');
grid.fill(EMPTY);enemies=[];updatePlayer(3.01);player.hp=1;player.inv=0;player.pw.shield=0;hitPlayer({x:player.x,y:player.y,dmg:1});if(!player.dead||player.armor)throw Error('AP death reset');
musicOff=false;muted=false;state='play';syncMusic();if(music.paused||Math.abs(music.volume-.066*gameVolume)>1e-6)throw Error('Death music');
state='over';syncMusic();if(music.paused)throw Error('Game over music');muted=true;
grid[100]=BRICK;brickHp[100]=4;brickMask[100]=1023;hitBrick(10,3,1);if(brickShake[100]<=0)throw Error('Brick shake');updateParts(.3);if(brickShake[100]!==0)throw Error('Brick shake decay');
startGame();if(player.armor)throw Error('New game reset');draw();
if(Math.abs(KINDS.heavy.scale-1.18*1.15)>1e-8||Math.abs(KINDS.scout.scale-.85*.9*1.1)>1e-8)throw Error('Tank scales');
grid.fill(EMPTY);enemies=[];base=null;
for(const c of [5,6]){const i=5*COLS+c;grid[i]=BRICK;brickHp[i]=4;brickMask[i]=1023;}
const piercing={x:150,y:176,vx:1200,vy:0,life:2,r:3,dmg:2,armor:true,trail:[],owner:'p'};
bullets=[piercing];updateBullets(.06);
if(grid[5*COLS+5]!==EMPTY||brickHp[5*COLS+6]!==3||!piercing.dead)throw Error('AP one block penetration');
startGame();if(base.hp!==5||grid[18*COLS+15]!==BRICK||Math.hypot(player.x-base.x,player.y-base.y)<50)throw Error('Base layout');
hitBase(1);nextWave();if(base.hp!==4)throw Error('Base wave persistence');
grid.fill(EMPTY);player.x=100;player.y=100;enemies=[];
bullets=[{x:base.x,y:base.y-25,vx:0,vy:300,life:1,r:3,dmg:1,owner:'e'}];updateBullets(.1);
if(base.hp!==3||bullets.length)throw Error('Base projectile collision');
hitBase(3);toSpawn=[];hitstop=0;for(let t=0;t<240;t++)update(.033);if(state!=='over'||!base.dead)throw Error('Base defeat');
startGame();if(base.hp!==5||base.dead)throw Error('Base restart');draw();
grid.fill(EMPTY);player.x=100;player.y=100;enemies=[];
bullets=[{x:base.x,y:base.y-25,vx:0,vy:300,life:1,r:3,dmg:1,owner:'p'}];updateBullets(.1);if(base.hp!==4)throw Error('Friendly base damage');
const h=makeTank(400,200,'heavy');bullets=[];fire(h);if(!bullets[0].armor||bullets[0].dmg!==2||Math.abs(Math.hypot(bullets[0].vx,bullets[0].vy)-3000)>1e-8)throw Error('Heavy AP');
enemies=[h,makeTank(410,250,'scout'),makeTank(420,280,'soldier'),makeTank(440,300,'scout')];formColumns();if(enemies.filter(e=>e.leader===h).length!==2||h.leader)throw Error('Columns');
if(enemyInterval('scout')!==1/.33||enemyInterval('soldier')!==2||enemyInterval('heavy')!==5)throw Error('Enemy rates');
enemies=[];toSpawn=['scout'];spawnTimer=0;updateSpawns(.1);if(enemies.length!==1||enemies[0].y>=0||!enemies[0].entering)throw Error('Offscreen entrance');
const entrant=enemies[0];updateEnemy(entrant,.2);if(entrant.y<=-32||entrant.spawnT)throw Error('Rolling entrance');
grid.fill(EMPTY);enemies=[];base=null;player=makeTank(300,176,'player');grid[5*COLS+5]=STEEL;
const ambusher=makeTank(144,176,'soldier');updateCover(ambusher,player,.1);
if(!ambusher.cover||los(ambusher.cover.x,ambusher.cover.y,player.x,player.y)||!los(ambusher.cover.px,ambusher.cover.py,player.x,player.y))throw Error('Corner cover');
ambusher.retreat=true;ambusher.cd=2;updateCover(ambusher,player,.1);if(ambusher.tx!==ambusher.cover.x||ambusher.ty!==ambusher.cover.y)throw Error('Cover retreat');
updateEnemy(ambusher,.1);drawTank(player);
// Boost timing, release-to-rearm, and sand apply to both sides.
grid.fill(EMPTY);sand.fill(0);base=null;enemies=[];player=makeTank(400,400,'player');player.angle=0;keys.KeyW=true;keys.ShiftLeft=true;updatePlayer(.1);
if(Math.abs(player.x-412)>1e-6||player.boostLeft!==2)throw Error('Boost x2');
keys.KeyW=false;updatePlayer(2);if(player.boostLeft!==0||player.boostCooldown!==10)throw Error('Boost duration/cooldown');
updatePlayer(10);if(player.boostLeft)throw Error('Boost hold retrigger');keys.ShiftLeft=false;updatePlayer(.01);keys.ShiftLeft=true;updatePlayer(.01);if(player.boostLeft!==2)throw Error('Boost rearm');
keys.ShiftLeft=false;keys.KeyW=false;player.boostLeft=0;player.boostCooldown=0;
player.x=400;player.y=400;sand[12*COLS+12]=1;moveTank(player,10,0,.1);if(player.x!==405)throw Error('Sand player');
const sandyEnemy=makeTank(400,400,'soldier');moveTank(sandyEnemy,10,0,.1);if(sandyEnemy.x!==405)throw Error('Sand enemy');
// Surviving masonry defines bullet and tank collision, not the old tile rectangle.
sand.fill(0);grid.fill(EMPTY);const wall=5*COLS+5;grid[wall]=BRICK;brickHp[wall]=3;brickMask[wall]=1<<9;
if(bulletBlocked(164,164,1)||!bulletBlocked(188,188,1))throw Error('Masonry holes');
const smallTank={x:164,y:164,r:2};collideTiles(smallTank);if(smallTank.x!==164||smallTank.y!==164)throw Error('Tank hole collision');
player.x=600;player.y=400;bullets=[{x:140,y:164,vx:300,vy:0,life:2,r:1,dmg:1,owner:'p'}];updateBullets(.2);if(!bullets.length||bullets[0].x<195)throw Error('Shoot through hole');
grid.fill(EMPTY);grid[5*COLS+5]=BRICK;brickMask[5*COLS+5]=1023;brickHp[5*COLS+5]=4;
const clearing=makeTank(144,176,'heavy');player.x=300;player.y=176;clearing.cd=0;clearing.turret=0;enemies=[clearing];updateEnemy(clearing,.01);if(!clearing.brick||!bullets.some(b=>b.owner==='e'))throw Error('Heavy wall clearing');
// AP wins against a regular shell, then loses AP state and bonuses.
grid.fill(EMPTY);enemies=[];player.x=700;player.y=500;
for(const owner of ['p','e']){const ap={x:400,y:300,vx:1500,vy:0,r:3,dmg:2,armor:true,trail:[],life:2,owner};const normal={x:450,y:300,vx:-300,vy:0,r:3,dmg:1,life:2,owner:owner==='p'?'e':'p'};bullets=[ap,normal];updateBullets(.06);if(bullets.length!==1||ap.dead||ap.armor||ap.dmg!==1||ap.vx!==1000||!normal.dead)throw Error('AP shell intercept');}
const originalRandom=Math.random;Math.random=()=>.5;wrecks=[];
let victim=makeTank(400,300,'scout');hitEnemy(victim,{x:400,y:300,dmg:99});const regularDelay=wrecks[0].detonateAt;
victim=makeTank(400,300,'scout');hitEnemy(victim,{x:400,y:300,dmg:99,blast:true});if(wrecks[1].detonateAt!==regularDelay/2)throw Error('Chain fuse half');
grid[100]=TREE;foliageMask[100]=31;Math.random=()=>.01;parts=[];hitFoliage(10,3,336,112,{});if(!parts.some(p=>p.kind==='bird'))throw Error('Bird chance');Math.random=originalRandom;
drawParts();drawBase();drawTank(player);keys.KeyW=false;
player.boostLeft=0;player.boostCooldown=10;if(boostProgress(player)!==0)throw Error('Boost bar empty');player.boostCooldown=5;if(boostProgress(player)!==.5)throw Error('Boost bar half');player.boostCooldown=0;if(boostProgress(player)!==1)throw Error('Boost bar ready');
player.cd=1;player.reloadDuration=1;player.recoilMax=5;if(recoilOffset(player)!==5)throw Error('Full recoil');player.cd=.5;if(recoilOffset(player)!==2.5)throw Error('Reload recoil half');player.cd=0;if(recoilOffset(player)!==0)throw Error('Reload recoil ready');
startGame();grid.fill(EMPTY);enemies=[];player.x=100;player.y=100;parts=[];
if(base.y+16!==H||grid[19*COLS+15]!==EMPTY)throw Error('Base bottom');
hitBase(5);if(base.collapseCount!==1)throw Error('First base explosion');const firstFlash=parts.find(p=>p.kind==='flash');if(!firstFlash||firstFlash.size!==196)throw Error('Double base radius');
updateBaseCollapse(.49);if(base.collapseCount!==1)throw Error('Base explosion too early');updateBaseCollapse(.01);if(base.collapseCount!==2)throw Error('Second base explosion');updateBaseCollapse(.5);if(base.collapseCount!==3)throw Error('Third base explosion');
const flashes=parts.filter(p=>p.kind==='flash');if(flashes.length!==3||new Set(flashes.map(p=>p.x+','+p.y)).size!==3)throw Error('Offset base explosions');updateBaseCollapse(10);if(base.collapseCount!==3||parts.filter(p=>p.kind==='flash').length!==3)throw Error('Base explosion count');
base=null;grid.fill(EMPTY);grid[100]=TREE;foliageMask[100]=31;const oldLeaves=foliageMask[100];blastDamage(336,112,30);if(foliageMask[100]===oldLeaves)throw Error('Blast foliage');
grid.fill(EMPTY);parts=[];const apSpark={x:400,y:300,vx:100,vy:0,r:3,armor:true,dmg:2,trail:[],owner:'p'},regularSpark={x:401,y:300,vx:-100,vy:0,r:3,dmg:1,owner:'e'};bullets=[apSpark,regularSpark];collideShells();if(!parts.some(p=>p.kind==='spark'&&p.size>2))throw Error('Shell sparks');
const randomBirds=Math.random;Math.random=()=>.01;grid[100]=TREE;foliageMask[100]=31;parts=[];hitFoliage(10,3,336,112,{});Math.random=randomBirds;const flock=parts.filter(p=>p.kind==='bird'),whites=flock.filter(p=>p.color==='#f0f0e5');if(whites.length<1||whites.length>2||!flock.some(p=>p.color==='#1c2927'))throw Error('White birds');
grid.fill(EMPTY);player=makeTank(600,400,'player');const idle=makeTank(400,300,'soldier');idle.cover={};idle.leader={};idle.retreat=true;
reconsiderRoute(idle,4.9);if(idle.repaths)throw Error('Early repath');reconsiderRoute(idle,.11);if(idle.repaths!==1||idle.cover||idle.leader||idle.retreat||idle.detourTime<=0||Math.hypot(idle.tx-idle.x,idle.ty-idle.y)<10)throw Error('Idle repath');
idle.x+=10;reconsiderRoute(idle,.1);if(idle.idleTime!==0)throw Error('Idle move reset');drawTank(player);drawParts();
player.boostLeft=2;if(boostProgress(player)!==1)throw Error('Full active boost');player.boostLeft=1;if(boostProgress(player)!==.5)throw Error('Boost consumption');player.boostLeft=0;player.boostCooldown=10;if(boostProgress(player)!==0)throw Error('Boost empty cooldown');
startGame();grid.fill(EMPTY);enemies=[];base=null;parts=[];player.hp=1;player.inv=0;player.pw.shield=0;hitPlayer({x:player.x,y:player.y,dmg:1});
const dyingPlayer=wrecks[0],fuse=dyingPlayer.detonateAt;updateWrecks(fuse+.001);if(dyingPlayer.blastCount!==1||dyingPlayer.exploded!==false)throw Error('First player blast');
updateWrecks(.5);if(dyingPlayer.blastCount!==2)throw Error('Second player blast');updateWrecks(.5);if(dyingPlayer.blastCount!==3||!dyingPlayer.exploded)throw Error('Third player blast');
const playerFlashes=parts.filter(p=>p.kind==='flash');if(playerFlashes.length!==3||playerFlashes.some(p=>p.size!==70))throw Error('Normal player blast size');
const initialCols=COLS;CFG.mapSize=45;if(COLS!==initialCols)throw Error('Immediate map resize');
for(const size of [45,60,30]) {
  CFG.mapSize=size;startGame();
  if(COLS!==size||ROWS!==size*2/3||W!==size*T||cv.width!==W||cv.height!==H)throw Error('Map dimensions');
  for(const arr of [grid,brickHp,brickMask,brickVariant,foliageMask,foliageShake,sand,flow])if(arr.length!==COLS*ROWS)throw Error('Map arrays');
  if(!connected()||base.y+16!==H||Math.abs(base.x-W/2)>T||player.y!==H-48)throw Error('Dynamic map layout');
  const bc=Math.floor(COLS/2);if(grid[(ROWS-2)*COLS+bc]!==BRICK||grid[(ROWS-1)*COLS+bc]!==EMPTY)throw Error('Dynamic base walls');
  toSpawn=['scout'];enemies=[];spawnTimer=0;updateSpawns(.1);if(!enemies.length||enemies[0].x>=W)throw Error('Dynamic spawns');
  nextWave();if(COLS!==size||grid.length!==size*(size*2/3))throw Error('Map wave persistence');
  buildFlow(Math.floor(base.x/T),Math.floor(base.y/T));draw();
}
const curves=[];roundedPolygon({moveTo(){},lineTo(){},closePath(){},quadraticCurveTo(...args){curves.push(args);}},[[-5,-12],[5,-12],[11,4],[7,12],[-7,12],[-11,4]],.22);if(curves.length!==6)throw Error('Rounded hexagon');
grid.fill(EMPTY);const fragmentWall=5*COLS+5;grid[fragmentWall]=BRICK;brickHp[fragmentWall]=4;brickMask[fragmentWall]=1023;parts=[];
hitBrick(5,5,1,160,161);const removed=1023^brickMask[fragmentWall],chunks=parts.filter(p=>p.brickFragment);
const removedBricks=masonry(0).filter((b,q)=>removed&(1<<q));
if(chunks.length!==removedBricks.length*4)throw Error('Fragments per removed brick');
for(const p of chunks)if(!removedBricks.some(b=>p.x>=160+b.x&&p.x<=160+b.x+b.w&&p.y>=160+b.y&&p.y<=168+b.y))throw Error('Fragment origin');
updateParts(.2);if(chunks.some(p=>p.life>=p.max||p.life<=0))throw Error('Fragment fade');drawParts();updateParts(2);if(parts.some(p=>p.brickFragment))throw Error('Fragment cleanup');
for(const size of [30,45,60]){CFG.mapSize=size;startGame();if(SPAWNS.length!==5||new Set(SPAWNS.map(s=>s.c)).size!==5||SPAWNS.some(s=>s.r!==1||s.c<1||s.c>COLS-2)||!connected())throw Error('Five spawn lanes');
const randomSpawn=Math.random;for(let k=0;k<5;k++){enemies=[];toSpawn=['scout'];spawnTimer=0;Math.random=()=>(k+.1)/5;updateSpawns(.1);if(enemies[0].x!==SPAWNS[k].c*T+16||enemies[0].y>=0)throw Error('All top lanes usable');}Math.random=randomSpawn;}
CFG.mapSize=30;startGame();
grid.fill(STEEL);grid[5*COLS+5]=EMPTY;grid[5*COLS+4]=EMPTY;grid[5*COLS+3]=EMPTY;
for(let n=0;n<15;n++){const exit=fragmentEscape(176,176,1.4);if(Math.cos(exit.angle)>-.9||exit.clearance<60)throw Error('Fragments choose left opening');}
grid[5*COLS+4]=STEEL;grid[5*COLS+3]=STEEL;grid[5*COLS+6]=EMPTY;grid[5*COLS+7]=EMPTY;
for(let n=0;n<15;n++){const exit=fragmentEscape(176,176,1.4);if(Math.cos(exit.angle)<.9||exit.clearance<60)throw Error('Fragments choose right opening');}
grid[5*COLS+5]=BRICK;brickMask[5*COLS+5]=1023;brickHp[5*COLS+5]=4;parts=[];hitBrick(5,5,1,160,161);
const escapingChunks=parts.filter(p=>p.brickFragment);for(const chunk of escapingChunks){const clearance=fragmentEscape(chunk.x,chunk.y,1).clearance;if(Math.hypot(chunk.vx,chunk.vy)>clearance*2+10)throw Error('Fragment confined speed');}
startGame();
// Preset mode places whole groups, keeps the map passable and only switches on a new game.
CFG.mapMode='preset01';if(mapMode!=='original')throw Error('Mode waits for new game');
for(const size of [30,45,60]){CFG.mapSize=size;startGame();if(mapMode!=='preset01'||!connected()||!grid.some(t=>t!==EMPTY))throw Error('Preset map');}
CFG.mapSize=30;startGame();CFG.mapElements=0;genMap(1);if(grid.some(t=>t!==EMPTY))throw Error('Preset empty density');
CFG.mapElements=180;for(let n=0;n<20;n++){genMap(1);if(!connected())throw Error('Disconnected dense preset map');}
for(const p of PREFABS){if(p.rows.some(r=>r.length!==p.rows[0].length||/[^BFSWTPbt. ]/.test(r)))throw Error('Prefab shape '+p.name);
for(let n=0;n<8;n++){const {w,h,cells}=prefabCells(p);if(cells.some(([x,y])=>x<0||y<0||x>=w||y>=h)||w*h!==p.rows.length*p.rows[0].length)throw Error('Prefab transform '+p.name);}}
CFG.mapElements=42;CFG.mapMode='original';startGame();
// Pause "new game" returns to the start screen with a preview of the chosen map.
CFG.mapSize=45;toMenu();if(state!=='menu'||player||base||COLS!==45)throw Error('Back to menu');draw();CFG.mapSize=30;startGame();
// Fence: auto shape (straight or one of four corners), narrow collision, one-hit destruction, AP passes through.
grid.fill(EMPTY);enemies=[];base=null;player.x=700;player.y=500;
const fence=(c,r)=>{grid[r*COLS+c]=FENCE;};
fence(5,5);fence(6,5);fence(7,5);fence(5,6);fence(5,7);fence(10,10);shapeFences();
if(fenceArms[5*COLS+5]!==(ARM_E|ARM_S)||fenceArms[5*COLS+6]!==FENCE_H||fenceArms[6*COLS+5]!==FENCE_V||fenceArms[10*COLS+10]!==FENCE_H)throw Error('Fence shapes');
if(!FENCE_SHAPES.includes(fenceArms[5*COLS+7]))throw Error('Fence shape set');
if(!bulletBlocked(6*T+16,5*T+16)||bulletBlocked(6*T+16,5*T+4))throw Error('Fence narrow');
const nearFence={x:6*T+16,y:5*T+4,r:4};collideTiles(nearFence);if(nearFence.y!==5*T+4)throw Error('Fence passable beside rail');
const rammer={x:6*T+16,y:5*T+10,r:8};collideTiles(rammer);if(rammer.y>=5*T+10)throw Error('Fence blocks tank');
bullets=[{x:6*T+16,y:5*T-20,vx:0,vy:300,life:2,r:2,dmg:1,owner:'p'}];updateBullets(.2);if(grid[5*COLS+6]!==EMPTY||bullets.length)throw Error('Fence one hit');
const apFence={x:7*T+16,y:5*T-20,vx:0,vy:1500,life:2,r:3,dmg:2,armor:true,trail:[],owner:'p'};bullets=[apFence];updateBullets(.04);
if(grid[5*COLS+7]!==EMPTY||apFence.dead||apFence.brickPierced)throw Error('AP through fence');
blastDamage(5*T+16,6*T+16,30);if(grid[6*COLS+5]!==EMPTY)throw Error('Blast fence');draw();
// Preset editor: trimmed save, unique names, weight by size, saved presets used by preset mode.
// Preset packs: Claude's pack by default, legacy presets migrate, packs toggle, presets edit/move between packs.
localStorage.removeItem(PACKS_KEY);localStorage.setItem(OLD_PRESETS_KEY,JSON.stringify([{name:'Старый',rows:['BB']},{name:'bad',rows:['BX']}]));
let packs=loadPacks();if(packs[0].id!==CLAUDE_PACK||packs[0].name!=='Пресеты Клода'||packs[0].presets.length!==PREFABS.length||packs[1].presets.length!==1)throw Error('Default and migrated packs');
localStorage.removeItem(OLD_PRESETS_KEY);savePacks([{id:'x',name:'Чужой',presets:[{name:'ok',rows:['B','BB']}]}]);packs=loadPacks();
if(packs[0].id!==CLAUDE_PACK||packs[1].presets.length)throw Error('Claude pack restored, invalid presets filtered');
savePacks([defaultClaudePack(),{id:'mine',name:'Мой',enabled:true,presets:[]}]);
openEditor();startEdit('mine',null,false);edit.cells[1][2]='W';edit.cells[3][2]='F';saveEdit();if(!edit||!editorMsg)throw Error('Editor requires name');
edit.name='  Тест  ';saveEdit();let mine=loadPacks()[1].presets;if(edit||mine.length!==1||mine[0].name!=='Тест'||JSON.stringify(mine[0].rows)!==JSON.stringify(['W',' ','F']))throw Error('Editor trimmed save');
startEdit('mine',null,false);edit.name='Тест';edit.cells[0][0]='B';saveEdit();if(!edit||loadPacks()[1].presets.length!==1)throw Error('Editor duplicate name');
startEdit(CLAUDE_PACK,null,false);edit.name='Тест';edit.cells[0][0]='B';saveEdit();if(edit||loadPacks()[0].presets.length!==PREFABS.length+1)throw Error('Same name in other pack');
startEdit(CLAUDE_PACK,loadPacks()[0].presets[0],true);edit.cells[0][0]='S';saveEdit();packs=loadPacks();if(packs[0].presets[0].rows[0][0]!=='S'||packs[0].presets[0].name!==PREFABS[0].name||packs[0].presets.length!==PREFABS.length+1)throw Error('Edit Claude preset in place');
startEdit('mine',mine[0],true);edit.target=CLAUDE_PACK;saveEdit();if(!edit)throw Error('Move name clash');edit.name='Перенос';saveEdit();packs=loadPacks();
if(packs[1].presets.length||packs[0].presets.at(-1).name!=='Перенос')throw Error('Move preset between packs');
startEdit('mine',null,false);edit.name='Пусто';saveEdit();if(!edit)throw Error('Editor empty preset');
resizeEdit(99,0);if(edit.cells.length!==1||edit.cells[0].length!==PRESET_MAX)throw Error('Editor size clamp');edit=null;renderEditor();
setFolded('mine',true);if(!JSON.parse(localStorage.getItem(FOLD_KEY)).includes('mine'))throw Error('Fold persistence');renderEditor();
startEdit('mine',null,false);edit.name='Свёрнутый';edit.cells[0][0]='B';saveEdit();if(foldedPacks.has('mine'))throw Error('Unfold after save');closeEditor();
if(!(prefabWeight({rows:['B']})>prefabWeight({rows:['BB','BB']})))throw Error('Weight by size');
savePacks([{...defaultClaudePack(),enabled:false},{id:'canal',name:'Каналы',enabled:true,presets:[{name:'Канал',rows:['WWWWWWWWWWWW']}]}]);
if(activePresets().length!==1)throw Error('Only enabled packs');CFG.mapMode='preset01';CFG.mapSize=60;let canal=false;
for(let n=0;n<5&&!canal;n++){startGame();for(let r=0;r<ROWS&&!canal;r++)for(let c=0;c<COLS&&!canal;c++){let hRun=0,vRun=0;while(tileAt(c+hRun,r)===WATER)hRun++;while(tileAt(c,r+vRun)===WATER)vRun++;canal=hRun>=12||vRun>=12;}}
if(!canal)throw Error('Pack preset on map');
savePacks([{...defaultClaudePack(),enabled:false}]);genMap(1);if(grid.some(t=>t!==EMPTY))throw Error('No enabled packs');
// Sand brush: passable empty tile with sand ground, counted toward map fill.
savePacks([{...defaultClaudePack(),enabled:false},{id:'dune',name:'Дюны',enabled:true,presets:[{name:'Дюна',rows:['PPPPPPPPPPPP']}]}]);genMap(1);
if(grid.some(t=>t!==EMPTY)||!connected())throw Error('Sand keeps tiles empty');let sandRun=false;
for(let r=0;r<ROWS&&!sandRun;r++)for(let c=0;c<COLS&&!sandRun;c++){let hRun=0,vRun=0;while(sand[r*COLS+c+hRun]&&c+hRun<COLS)hRun++;while(r+vRun<ROWS&&sand[(r+vRun)*COLS+c])vRun++;sandRun=hRun>=12||vRun>=12;}
if(!sandRun)throw Error('Preset sand on map');
localStorage.removeItem(PACKS_KEY);CFG.mapMode='original';CFG.mapSize=30;
// Claude's maps from maps.js: valid, unique ids, passable.
const cm=claudeMaps();if(cm.length<3||new Set(cm.map(m=>m.id)).size!==cm.length||cm.length!==window.ECOTANK_MAPS.length)throw Error('Claude maps valid');
for(const m of cm)if(!mapPassable(m.cols,m.rows))throw Error('Claude map passable '+m.name);
if(new Set(spawnCols(30)).size!==5||!reservedCell(30,15,19)||!reservedCell(30,1,0)||reservedCell(30,5,5))throw Error('Reserved layout');
// Map mode: size and tiles come from the map, every wave restores it, reserved zones stay clear.
for(const m of cm){CFG.mapMode='map';CFG.mapPick=m.id;startGame();
  if(COLS!==m.cols||mapMode!=='map'||!connected())throw Error('Map mode '+m.name);
  const center=Math.floor(COLS/2),baseWall=(c,r)=>r>=ROWS-2&&c>=center-1&&c<=center+1;
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){const ch=m.rows[r][c],t=grid[r*COLS+c];
    if(baseWall(c,r))continue;
    if(reservedCell(COLS,c,r)){if(t!==EMPTY)throw Error('Reserved cleared '+m.name);continue;}
    if('BFSWT.P'.includes(ch)&&t!==PREFAB_TILES[ch])throw Error('Map tile '+m.name+' '+c+','+r);
    if(!!sand[r*COLS+c]!==(ch==='P'))throw Error('Map sand exactly as drawn');}
  const bi=grid.findIndex((t,i)=>t===BRICK&&m.rows[(i/COLS)|0][i%COLS]==='B'&&!reservedCell(COLS,i%COLS,(i/COLS)|0));
  if(bi>=0){hitBrick(bi%COLS,(bi/COLS)|0,99);nextWave();if(grid[bi]!==BRICK)throw Error('Map restored each wave');}draw();}
CFG.mapPick='missing';startGame();if(mapMode!=='original'||activeMap)throw Error('Missing map fallback');
// Map editor: reserved cells locked, mirror, resize anchored at the base, passability and name checks, import.
localStorage.removeItem(MAPS_KEY);openMapEditor();startMapEdit(null,false,30);
paintMapCell(15,19,'S');paintMapCell(1,1,'S');if(mapEd.cells[19][15]!=='.'||mapEd.cells[1][1]!=='.')throw Error('Reserved locked');
mapMirror=true;paintMapCell(5,6,'B');mapMirror=false;if(mapEd.cells[6][5]!=='B'||mapEd.cells[6][24]!=='B')throw Error('Mirror paint');
saveMapEdit();if(!mapEd||!mapEdMsg)throw Error('Map name required');mapEd.name='Стена';
for(let c=0;c<30;c++)paintMapCell(c,8,'S');saveMapEdit();if(!mapEd||!mapEdMsg.includes('доехать'))throw Error('Impassable map rejected');
paintMapCell(10,8,'B');saveMapEdit();if(mapEd||loadUserMaps().length!==1)throw Error('Map saved');
const saved=loadUserMaps()[0];startMapEdit(saved,true);resizeMapEdit(45);if(mapEd.cols!==45||mapEd.cells.length!==30||mapEd.cells[16][12]!=='B'||mapEd.cells[18][17]!=='B')throw Error('Resize anchored');
mapEd.name='Копия стены';mapEd.id=null;saveMapEdit();startMapEdit(loadUserMaps()[0],false);mapEd.name='Стена';saveMapEdit();if(!mapEd)throw Error('Duplicate map name');mapEd=null;renderMapEditor();
const exported=JSON.stringify({name:saved.name,cols:saved.cols,rows:saved.rows});
if(importMapText(exported)!==1||!loadUserMaps().some(m=>m.name==='Стена (2)'))throw Error('Import renames');
if(importMapText('{"name":"x","cols":31,"rows":[]}')!==0||importMapText('not json')!==0)throw Error('Import rejects');
// Preset stamps in the map editor: transforms, placement centred on the cursor, "untouched" cells, mirror, reserved zones.
if(JSON.stringify(transformRows(['BS','T '],1,false))!==JSON.stringify(['TB',' S'])||JSON.stringify(transformRows(['BS'],0,true))!==JSON.stringify(['SB']))throw Error('Stamp transform');
savePacks([defaultClaudePack(),{id:'st',name:'Штампы',enabled:false,presets:[{name:'Г',rows:['SS','S ']}]}]);
startMapEdit(null,false,30);mapStamp={pack:'st',i:0,turns:0,flip:false};
mapEd.cells[8][10]='W';placeStamp(10,8);if(mapEd.cells[7][9]!=='S'||mapEd.cells[7][10]!=='S'||mapEd.cells[8][9]!=='S'||mapEd.cells[8][10]!=='W')throw Error('Stamp placement');
mapMirror=true;placeStamp(5,10);mapMirror=false;if(mapEd.cells[9][4]!=='S'||mapEd.cells[9][25]!=='S'||mapEd.cells[9][24]!=='S')throw Error('Stamp mirror');
placeStamp(15,19);if(mapEd.cells[18][14]!=='.')throw Error('Stamp reserved');
const shape=()=>stampRows().join('|');turnStamp('turn');if(shape()!=='SS| S')throw Error('Stamp turn');turnStamp('flip');if(shape()!=='SS|S ')throw Error('Stamp flip visible');
turnStamp('turn');if(shape()!=='SS| S')throw Error('Stamp turn after flip');turnStamp('turn');if(shape()!==' S|SS')throw Error('Stamp second turn after flip');
mapHover=[10,10];drawMapEditor();renderMapEditor();mapStamp=null;mapHover=null;mapEd=null;localStorage.removeItem(PACKS_KEY);
renderMapPick();CFG.mapMode='map';CFG.mapPick=saved.id;state='menu';closeMapEditor();if(activeMap.id!==saved.id||COLS!==30)throw Error('Play user map');
localStorage.removeItem(MAPS_KEY);CFG.mapMode='original';CFG.mapPick='';CFG.mapSize=30;
// Campaign: ordered levels, locked starts, size change between levels, unlock on clear, victory, retry from the lost level.
const realCampaign=window.ECOTANK_CAMPAIGN;
if(!Array.isArray(realCampaign)||new Set(realCampaign).size!==realCampaign.length||realCampaign.some(id=>!cm.some(m=>m.id===id))||campaignMaps().length!==realCampaign.length)throw Error('maps.js campaign order');window.ECOTANK_CAMPAIGN=['claude-swamp','missing','claude-crossing'];
if(campaignMaps().map(m=>m.id).join()!=='claude-swamp,claude-crossing')throw Error('Campaign order');
localStorage.removeItem(CAMPAIGN_KEY);CFG.mapMode='campaign';CFG.campaignStart=1;startGame();
if(!campaign||CFG.campaignStart!==0||wave!==1||activeMap.id!=='claude-swamp'||COLS!==45||mapMode!=='map')throw Error('Campaign locked start');
const clearLevel=()=>{toSpawn=[];enemies=[];wrecks=[];hitstop=0;update(.01);if(state!=='between')throw Error('Level clear');for(let t=0;t<40&&state==='between';t++)update(.1);};
player.inv=99;clearLevel();
if(campaignUnlocked()!==2||wave!==2||activeMap.id!=='claude-crossing'||COLS!==30||grid.length!==600||base.x!==BASE_POS.x||base.y!==H-16||player.y!==H-48)throw Error('Campaign next level');
if(!connected())throw Error('Campaign level passable');draw();player.inv=99;clearLevel();
if(state!=='over'||!victory||wave!==2||CFG.campaignStart!==0)throw Error('Campaign victory');draw();
CFG.campaignStart=1;startGame();if(wave!==2||activeMap.id!=='claude-crossing'||victory)throw Error('Campaign start from unlocked level');
toSpawn=[];enemies=[];player.inv=0;player.pw.shield=0;player.hp=1;hitPlayer({x:player.x,y:player.y,dmg:1});
for(let t=0;t<200&&state!=='over';t++){hitstop=0;update(.05);}if(state!=='over'||victory||CFG.campaignStart!==1)throw Error('Campaign retry level');draw();
window.ECOTANK_CAMPAIGN=undefined;if(campaignMaps().length!==claudeMaps().length)throw Error('Campaign fallback order');
window.ECOTANK_CAMPAIGN=realCampaign;localStorage.removeItem(CAMPAIGN_KEY);CFG.mapMode='original';CFG.campaignStart=0;
startGame();
if(KINDS.player.hp!==3||ITEMS.armor||ITEMS.triple||!ITEMS.upgrade||!ITEMS.barrage)throw Error('New defaults and pickup catalog');
applyDev({KINDS:{player:{hp:5}},CFG:{}});if(KINDS.player.hp!==3)throw Error('Legacy HP migration');
CFG.mapMode='original';startGame();grid.fill(EMPTY);base=null;enemies=[];
if(player.hp!==3||player.maxHp!==3)throw Error('Initial player health');
items=[{x:player.x,y:player.y,type:'upgrade',life:10}];updateItems(.01);if(player.upgrade!==1||player.hp!==5||player.maxHp!==5||!player.armor)throw Error('IS-2 upgrade');
nextWave();if(player.upgrade!==1||player.hp!==5)throw Error('IS-2 persists');
items=[{x:player.x,y:player.y,type:'upgrade',life:10}];updateItems(.01);if(player.upgrade!==2||player.hp!==7||Math.abs(tankScale(player)-1.15)>1e-8||Math.abs(player.r-14.95)>1e-8)throw Error('IS-2-II upgrade');
bullets=[];fire(player);if(bullets.length!==2||bullets.some(b=>!b.armor||b.dmg!==2)||Math.hypot(bullets[0].x-bullets[1].x,bullets[0].y-bullets[1].y)<7)throw Error('Double AP fire');
nextWave();if(player.upgrade!==2||player.maxHp!==7)throw Error('IS-2-II persists');
for(const tier of [0,1,2]){startGame();grid.fill(EMPTY);base=null;enemies=[];setPlayerUpgrade(player,tier);player.hp=1;player.inv=0;player.pw.shield=0;parts=[];hitPlayer({x:player.x,y:player.y,dmg:1});const w=wrecks[0];updateWrecks(w.detonateAt+4);if(w.blastCount!==3+tier*2||parts.filter(p=>p.kind==='flash').length!==3+tier*2)throw Error('Tier death explosions');}
startGame();grid.fill(EMPTY);base=null;enemies=[];parts=[];
grid[5*COLS+8]=TREE;foliageMask[5*COLS+8]=31;grid[6*COLS+8]=BRICK;brickHp[6*COLS+8]=4;brickMask[6*COLS+8]=1023;
blastDamage(176,176,30);if(foliageMask[5*COLS+8]===31||brickHp[6*COLS+8]!==4)throw Error('Double foliage-only blast radius');
const list=waveList(5);if(list.filter(k=>k==='artillery').length!==Math.floor(list.filter(k=>k!=='artillery').length/5))throw Error('Artillery one per five tanks');
const lead=makeTank(400,150,'heavy'),follower=makeTank(400,185,'soldier'),gun=makeTank(400,220,'artillery');enemies=[lead,follower,gun];formColumns();if(gun.leader!==lead||gun.columnSlot<=follower.columnSlot)throw Error('Artillery last in column');
grid.fill(EMPTY);artilleryShells=[];base={x:450,y:220,hp:5,r:16,dead:false};player=makeTank(700,220,'player');gun.cd=0;gun.turret=0;grid[6*COLS+16]=STEEL;updateEnemy(gun,.01);
if(artilleryShells.length!==1||artilleryShells[0].tx!==player.x||artilleryShells[0].ty!==player.y||Math.abs(artilleryShells[0].duration-Math.hypot(player.x-gun.x,player.y-gun.y)/KINDS.artillery.bulletSpeed)>1e-6)throw Error('Artillery sees player through walls and prioritizes player');
const committed=artilleryShells[0].tx;player.x-=50;if(artilleryShells[0].tx!==committed)throw Error('Artillery target snapshot');drawArtilleryShells();
artilleryShells=[];base=null;enemies=[makeTank(400,300,'scout'),makeTank(700,350,'heavy')];callBarrage();for(let i=0;i<10;i++)updateArtilleryShells(0);if(artilleryShells.length!==2||artilleryShells.some(s=>!s.friendly||s.sy<=H))throw Error('Barrage volley from bottom');
const positions=artilleryShells.map(s=>s.tx);enemies[0].x+=30;if(artilleryShells[0].tx!==positions[0])throw Error('Barrage fixed positions');
artilleryShells=[];grid.fill(EMPTY);enemies=[];player=makeTank(300,300,'player');launchArtillery(300,100,300,300);const duration=artilleryShells[0].duration;bullets=[{x:300,y:300,vx:0,vy:100,owner:'p',dmg:1,r:3,life:1}];updateBullets(.01);if(artilleryShells.length!==1)throw Error('Artillery immune to bullet collisions');updateArtilleryShells(duration+.01);if(artilleryShells.length||player.hp!==1)throw Error('Hostile artillery impact');
player.inv=0;const hpSafe=player.hp;launchArtillery(300,H+24,300,300,true);updateArtilleryShells(10);if(player.hp!==hpSafe)throw Error('Friendly support direct safety');
items=[];itemSpawnTimer=10;state='play';updateRandomItems(9.99);if(items.length)throw Error('Early random pickup');updateRandomItems(.02);if(items.length!==1||!ITEMS[items[0].type])throw Error('Ten-second pickup');state='pause';updateRandomItems(20);if(items.length!==1)throw Error('Pause freezes pickup timer');
musicOff=false;muted=false;toMenu();syncMusic();if(musicTrack!==MENU_TRACK||music.paused)throw Error('Menu music');startGame();syncMusic();if(!LEVEL_TRACKS.includes(musicTrack))throw Error('Level playlist');const trackBefore=musicTrack;music.handlers.ended();if(musicTrack===trackBefore||!LEVEL_TRACKS.includes(musicTrack))throw Error('Random next music');state='pause';syncMusic();if(Math.abs(music.volume-gameVolume*musicLevel*.3)>1e-8||music.paused)throw Error('Music duck continues');muted=true;
drawArtilleryModel(makeTank(400,400,'artillery'));setPlayerUpgrade(player,2);drawTank(player);syncUI();
// Regression: long death sequences must render every frame, including the late post-blast flames.
muted=true;
for(const tier of [0,1,2]){
  startGame();grid.fill(EMPTY);base=null;enemies=[];toSpawn=['soldier'];setPlayerUpgrade(player,tier);player.hp=1;hitPlayer({x:player.x,y:player.y,dmg:1});
  for(let i=0;i<400&&state!=='over';i++){hitstop=0;update(.025);draw();}
  if(state!=='over')throw Error('Death sequence did not finish at tier '+tier);
}
startGame();grid.fill(EMPTY);base=null;enemies=[];parts=[];const doomedHeavy=makeTank(400,300,'heavy');enemies=[doomedHeavy];hitEnemy(doomedHeavy,{x:400,y:300,dmg:99});
const heavyWreck=wrecks[0];updateWrecks(heavyWreck.detonateAt+1.01);if(heavyWreck.blastCount!==3||!heavyWreck.exploded||parts.filter(p=>p.kind==='flash').length!==3)throw Error('Heavy triple explosion');drawWrecks();
startGame();grid.fill(EMPTY);base=null;enemies=[];toSpawn=['soldier'];
if(Math.abs(tankScale(player)-.9)>1e-8)throw Error('Base tank scale');
const frozenX=player.x,frozenY=player.y;beginPlayerUpgrade(player);keys.KeyW=true;keys.Space=true;bullets=[];const upgradingHp=player.hp;
enemies=[makeTank(player.x+5,player.y,'soldier')];separate();if(player.x!==frozenX||player.y!==frozenY)throw Error('Transforming tank cannot be pushed');enemies=[];
for(let i=0;i<14;i++){updatePlayer(.1);hitPlayer({x:player.x,y:player.y,dmg:99});drawTank(player);}
if(player.x!==frozenX||player.y!==frozenY||player.hp!==upgradingHp||player.dead||bullets.length||player.upgradeT<=0)throw Error('1.5-second upgrade freeze and invulnerability');
updatePlayer(.11);if(player.upgradeT!==0)throw Error('Transformation completion');player.cd=0;updatePlayer(.01);if(!bullets.length)throw Error('Controls restored after transformation');keys.KeyW=keys.Space=false;
items=[{x:100,y:100,type:'upgrade',life:20}];beginPlayerUpgrade(player);if(player.upgrade!==2||items.some(it=>it.type==='upgrade')||availableItemTypes().includes('upgrade'))throw Error('Max tier excludes stars');
for(let i=0;i<30;i++){itemSpawnTimer=0;updateRandomItems(.01);}if(items.some(it=>it.type==='upgrade'))throw Error('No random stars at max tier');
const savedRandom=Math.random;Math.random=()=>0;const dropVictim=makeTank(400,300,'soldier');hitEnemy(dropVictim,{x:400,y:300,dmg:99});Math.random=savedRandom;if(items.some(it=>it.type==='upgrade'))throw Error('No dropped stars at max tier');
artilleryShells=[];enemies=[makeTank(400,200,'heavy')];resetArtillery();callBarrage();for(let i=0;i<5;i++)updateArtilleryShells(0);const support=artilleryShells[0];if(support.delay!==2||support.speed!==3000||support.damage!==2)throw Error('Barrage timing and damage');
updateArtilleryShells(1.99);if(support.done||support.age>=support.delay)throw Error('Premature support launch');drawArtilleryShells();updateArtilleryShells(.02);if(support.done)throw Error('Premature support impact');
updateArtilleryShells(support.duration);if(enemies[0].hp!==1)throw Error('Support damage 2');
applyDev({KINDS:{artillery:{bulletSpeed:140,dmg:1}},CFG:{},balanceVersion:2});if(KINDS.artillery.bulletSpeed!==182||KINDS.artillery.dmg!==2)throw Error('Saved artillery defaults migration');
applyDev(JSON.parse(DEV_DEFAULTS));if(KINDS.artillery.bulletSpeed!==182||KINDS.artillery.dmg!==2)throw Error('Reset artillery defaults');saveDev();applyDev(JSON.parse(localStorage.getItem('ecotank-dev-v2')));if(KINDS.artillery.bulletSpeed!==182)throw Error('Artillery migration is not repeated');
musicOff=false;muted=false;state='menu';gameVolume=0;syncMusic();if(music.volume!==0)throw Error('Master volume mutes music');gameVolume=.5;musicLevel=.4;syncMusic();if(Math.abs(music.volume-.2)>1e-8)throw Error('Master volume scales music');muted=true;
// The support volley does bounded work each simulation frame, independent of target count.
const realSfx=sfx;
for(const count of [0,1,12]){
  resetArtillery();enemies=Array.from({length:count},(_,i)=>makeTank(100+i*30,200,'heavy'));
  const shots=[];sfx=name=>{if(name==='heavyShoot')shots.push(barrageFrame);};callBarrage();
  if(artilleryShells.length)throw Error('Barrage creates no shells in pickup frame');
  if(enemies.length)enemies[0].x+=80;
  for(let f=1;f<=Math.max(10,count*5);f++){
    updateArtilleryShells(0);
    if(artilleryShells.length!==Math.min(count,f))throw Error('One marker per frame');
    if(artilleryShells.filter(s=>!s.pending).length!==Math.min(count,Math.floor(f/5)))throw Error('One trajectory per five frames');
    drawArtilleryShells();
  }
  if(shots.join()!=='1,3,5,7,9')throw Error('Five fixed artillery reports spaced two frames apart');
  if(count&&artilleryShells[0].tx!==100)throw Error('Queued barrage preserves pickup-time positions');
}
sfx=realSfx;resetArtillery();state='play';enemies=[makeTank(300,200,'heavy')];callBarrage();state='pause';update(.1);if(artilleryShells.length||barrageMarkers.length!==1)throw Error('Pause freezes queued support');toMenu();if(hasPendingBarrage()||artilleryShells.length)throw Error('Menu clears deferred support');
if(Math.abs(playerGunLength({upgrade:2})/playerGunLength({upgrade:1})-.8)>1e-8)throw Error('Maximum upgrade gun length reduced 20 percent');
// Gun noise and reverb data are generated once, then reused for subsequent reports.
let createdAudioBuffers=0;
const audioNode=()=>({gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},threshold:{value:0},ratio:{value:0},delayTime:{value:0},connect(other){return other;},disconnect(){},start(){},stop(){}});
actx={sampleRate:2000,currentTime:0,destination:audioNode(),createGain:audioNode,createOscillator:audioNode,createDynamicsCompressor:audioNode,createBiquadFilter:audioNode,createBufferSource:audioNode,createDelay:audioNode,createConvolver:audioNode,createBuffer(channels,length){createdAudioBuffers++;const data=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:c=>data[c]};}};
cannonNoiseLayers=heavyImpulse=noiseBuf=masterGain=null;heavyGunSound();const initialAudioBuffers=createdAudioBuffers;for(let i=0;i<4;i++)heavyGunSound();if(createdAudioBuffers!==initialAudioBuffers||!heavyImpulse||cannonNoiseLayers.length!==4)throw Error('Artillery reports reuse audio buffers');
actx=noiseBuf=masterGain=cannonNoiseLayers=heavyImpulse=null;
`,box);
assert(!code.includes("tone(420, 110"));
console.log('PASS: screenshot defaults, storage migration, turret rate/wrap, four-hit brick damage, density, 20 dense connected maps, asymmetry, render calls, settings persistence');
