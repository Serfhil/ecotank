const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const makeContext=()=>{const c=new Proxy({}, {get:(o,k)=>k in o?o[k]:(()=>c)});return c;},context=makeContext();
const element={style:{},addEventListener(){},getContext:()=>context,querySelector:()=>element,querySelectorAll:()=>[],blur(){}};
const store=new Map([['ecotank-dev',JSON.stringify({KINDS:{player:{speed:999}},CFG:{brickHp:2}})]]);
const box={console,document:{getElementById:()=>({...element}),createElement:()=>({...element,getContext:makeContext}),activeElement:element},window:{},innerWidth:960,innerHeight:640,addEventListener(){},requestAnimationFrame(){},performance:{now:()=>0},setTimeout(){},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
box.Audio=class {play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}};
vm.createContext(box);vm.runInContext(fs.readFileSync(__dirname+'/maps.js','utf8'),box);vm.runInContext(code,box);
vm.runInContext(`
muted=true;
// очередь поиска маршрутов работает по кадрам; в проверках дожидаемся появления
const spawnWait=(n=600)=>{const before=enemies.length;for(let k=0;k<n&&enemies.length===before;k++){navStep();updateSpawns(.05);}};
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
state='pause';syncMusic();if(!musicWanted||music.paused||Math.abs(music.volume-.066)>1e-6)throw Error('Music duck');state='play';musicOff=true;syncMusic();if(musicWanted)throw Error('Music disabled');
drawPlayerModel(player);drawTank(player);drawTrees();
muted=true;grid.fill(EMPTY);player=makeTank(400,400,'player');enemies=[];items=[{x:400,y:400,type:'armor',life:5}];updateItems(.01);
if(!player.armor)throw Error('AP pickup');bullets=[];fire(player);const apShot=bullets[0];
if(Math.abs(Math.hypot(apShot.vx,apShot.vy)-KINDS.player.bulletSpeed*1.5)>1e-6||apShot.dmg!==KINDS.player.dmg*2||!apShot.armor)throw Error('AP stats');
updateBullets(.01);if(!apShot.trail.length)throw Error('AP tracer');nextWave();if(!player.armor)throw Error('AP wave persistence');
items=[{x:player.x,y:player.y,type:'armor',life:5}];updateItems(.01);bullets=[];fire(player);if(bullets[0].dmg!==2)throw Error('AP non stacking');
grid.fill(EMPTY);enemies=[];player.hp=1;player.inv=0;player.pw.shield=0;hitPlayer({x:player.x,y:player.y,dmg:1});if(!player.dead||player.armor)throw Error('AP death reset');
musicOff=false;muted=false;state='play';syncMusic();if(music.paused||Math.abs(music.volume-.066)>1e-6)throw Error('Death music');
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
if(enemyInterval('scout')!==1/.33||enemyInterval('soldier')!==2||enemyInterval('heavy')!==5)throw Error('Enemy rates');
enemies=[];toSpawn=['scout'];spawnTimer=0;spawnWait();if(enemies.length!==1||enemies[0].y>=0||!enemies[0].entering)throw Error('Offscreen entrance');
const entrant=enemies[0];updateEnemy(entrant,.2);if(entrant.y<=-32||entrant.spawnT)throw Error('Rolling entrance');
grid.fill(EMPTY);navReset();enemies=[];squads=[];base=null;player=makeTank(300,176,'player');grid[5*COLS+5]=STEEL;
const ambusher=makeTank(144,176,'soldier'),ambushSquad=soloSquad(ambusher),cover=findCover(ambusher,ambushSquad,player);
if(!cover||los(cover.x,cover.y,player.x,player.y)||!los(cover.px,cover.py,player.x,player.y)||!segFree(cover.x,cover.y,cover.px,cover.py,navR(ambusher)))throw Error('Corner cover');
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
grid.fill(EMPTY);parts=[];const apSpark={x:400,y:300,vx:100,vy:0,r:3,armor:true,dmg:2,trail:[],owner:'p'},regularSpark={x:401,y:300,vx:-100,vy:0,r:3,dmg:1,owner:'e'};bullets=[apSpark,regularSpark];updateBullets(.001);if(!parts.some(p=>p.kind==='spark'&&p.size>2))throw Error('Shell sparks');
const randomBirds=Math.random;Math.random=()=>.01;grid[100]=TREE;foliageMask[100]=31;parts=[];hitFoliage(10,3,336,112,{});Math.random=randomBirds;const flock=parts.filter(p=>p.kind==='bird'),whites=flock.filter(p=>p.color==='#f0f0e5');if(whites.length<1||whites.length>2||!flock.some(p=>p.color==='#1c2927'))throw Error('White birds');
grid.fill(EMPTY);player=makeTank(600,400,'player');drawTank(player);drawParts();
player.boostLeft=2;if(boostProgress(player)!==1)throw Error('Full active boost');player.boostLeft=1;if(boostProgress(player)!==.5)throw Error('Boost consumption');player.boostLeft=0;player.boostCooldown=10;if(boostProgress(player)!==0)throw Error('Boost empty cooldown');
startGame();grid.fill(EMPTY);enemies=[];base=null;parts=[];player.hp=1;player.inv=0;player.pw.shield=0;hitPlayer({x:player.x,y:player.y,dmg:1});
const dyingPlayer=wrecks[0],fuse=dyingPlayer.detonateAt;updateWrecks(fuse+.001);if(dyingPlayer.blastCount!==1||dyingPlayer.exploded!==false)throw Error('First player blast');
updateWrecks(.5);if(dyingPlayer.blastCount!==2)throw Error('Second player blast');updateWrecks(.5);if(dyingPlayer.blastCount!==3||!dyingPlayer.exploded)throw Error('Third player blast');
const playerFlashes=parts.filter(p=>p.kind==='flash');if(playerFlashes.length!==3||playerFlashes.some(p=>p.size!==70))throw Error('Normal player blast size');
const initialCols=COLS;CFG.mapSize=45;if(COLS!==initialCols)throw Error('Immediate map resize');
for(const size of [45,60,30]) {
  CFG.mapSize=size;startGame();
  if(COLS!==size||ROWS!==size*2/3||W!==size*T||cv.width!==W||cv.height!==H)throw Error('Map dimensions');
  for(const arr of [grid,brickHp,brickMask,brickVariant,foliageMask,foliageShake,sand])if(arr.length!==COLS*ROWS)throw Error('Map arrays');
  if(!connected()||base.y+16!==H||Math.abs(base.x-W/2)>T||player.y!==H-48)throw Error('Dynamic map layout');
  const bc=Math.floor(COLS/2);if(grid[(ROWS-2)*COLS+bc]!==BRICK||grid[(ROWS-1)*COLS+bc]!==EMPTY)throw Error('Dynamic base walls');
  toSpawn=['scout'];enemies=[];spawnTimer=0;spawnWait();if(!enemies.length||enemies[0].x>=W)throw Error('Dynamic spawns');
  nextWave();if(COLS!==size||grid.length!==size*(size*2/3))throw Error('Map wave persistence');
  draw();
}
const curves=[];roundedPolygon({moveTo(){},lineTo(){},closePath(){},quadraticCurveTo(...args){curves.push(args);}},[[-5,-12],[5,-12],[11,4],[7,12],[-7,12],[-11,4]],.22);if(curves.length!==6)throw Error('Rounded hexagon');
grid.fill(EMPTY);const fragmentWall=5*COLS+5;grid[fragmentWall]=BRICK;brickHp[fragmentWall]=4;brickMask[fragmentWall]=1023;parts=[];
hitBrick(5,5,1,160,161);const removed=1023^brickMask[fragmentWall],chunks=parts.filter(p=>p.brickFragment);
const removedBricks=masonry(0).filter((b,q)=>removed&(1<<q));
if(chunks.length!==removedBricks.length*4)throw Error('Fragments per removed brick');
for(const p of chunks)if(!removedBricks.some(b=>p.x>=160+b.x&&p.x<=160+b.x+b.w&&p.y>=160+b.y&&p.y<=168+b.y))throw Error('Fragment origin');
updateParts(.2);if(chunks.some(p=>p.life>=p.max||p.life<=0))throw Error('Fragment fade');drawParts();updateParts(2);if(parts.some(p=>p.brickFragment))throw Error('Fragment cleanup');
for(const size of [30,45,60]){CFG.mapSize=size;startGame();if(SPAWNS.length!==5||new Set(SPAWNS.map(s=>s.c)).size!==5||SPAWNS.some(s=>s.r!==1||s.c<1||s.c>COLS-2)||!connected())throw Error('Five spawn lanes');
const randomSpawn=Math.random;for(let k=0;k<5;k++){enemies=[];pendingSpawn=null;toSpawn=['scout'];spawnTimer=0;Math.random=()=>(k+.1)/5;spawnWait();if(enemies[0].x!==SPAWNS[k].c*T+16||enemies[0].y>=0)throw Error('All top lanes usable');}Math.random=randomSpawn;}
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
// Enemy navigation: hull-aware passages and turns, planned breach, persistent columns, squad detection, cover, hunters, route lines.
if(CFG.enemySightCells!==20||CFG.columnRatio!==2||CFG.hunterEvery!==10||CFG.showRoutes)throw Error('Enemy defaults');
const carve=cells=>{grid.fill(STEEL);brickHp.fill(0);brickMask.fill(0);sand.fill(0);for(const [c,r] of cells)grid[r*COLS+c]=EMPTY;navReset();};
const plan=(kind,from,to,soft=false)=>{navBudget=1e9;const it=astar(from.x,from.y,kindR(kind),KINDS[kind].speed,kind,soft,nodeGoal(nodeAt(to.x,to.y)));let r;do r=it.next();while(!r.done);return r.value;};
const cellPt=(c,r)=>({x:c*T+16,y:r*T+16});
const pathFits=(path,R)=>path.every((n,k)=>navStatus(n,R)!==3&&(!k||circleStatus((nodeXY(n).x+nodeXY(path[k-1]).x)/2,(nodeXY(n).y+nodeXY(path[k-1]).y)/2,R)!==3));
base=null;enemies=[];squads=[];bullets=[];player=makeTank(W-16,H-16,'player');
// L-shaped corridor one cell wide: light and medium tanks fit, the heavy hull does not; two cells wide fits all.
const narrow=[];for(let c=2;c<=20;c++)narrow.push([c,5]);for(let r=5;r<=12;r++)narrow.push([20,r]);carve(narrow);
for(const kind of ['scout','soldier']){const path=plan(kind,cellPt(2,5),cellPt(20,12));if(!path||!pathFits(path,kindR(kind))||path.some(n=>navStatus(n,kindR(kind))!==1))throw Error('Narrow turn '+kind);}
if(plan('heavy',cellPt(2,5),cellPt(20,12)))throw Error('Heavy must not fit one cell');
const wide=[];for(let c=2;c<=21;c++)wide.push([c,5],[c,6]);for(let r=5;r<=12;r++)wide.push([20,r],[21,r]);carve(wide);
const widePath=plan('heavy',{x:3*T,y:6*T},{x:21*T,y:12*T});if(!widePath||!pathFits(widePath,kindR('heavy')))throw Error('Heavy two-cell turn');
// Brick wall across the corridor: route only as a planned breach, cost grows with remaining masonry.
const wallCells=[[10,5],[10,6]];for(const [c,r] of wallCells){const i=r*COLS+c;grid[i]=BRICK;brickHp[i]=4;brickMask[i]=1023;}navReset();
if(plan('soldier',cellPt(3,5),cellPt(16,5)))throw Error('Wall blocks without breach');
const breachPath=plan('soldier',cellPt(3,5),cellPt(16,5),true);if(!breachPath||!breachPath.some(n=>navStatus(n,kindR('soldier'))===2))throw Error('Planned breach route');
if(!(breakTime(5*COLS+10,'soldier')>breakTime(5*COLS+10,'heavy')))throw Error('Breach cost by weapon');
let breacher=makeTank(cellPt(3,5).x,cellPt(3,5).y,'soldier');let bq=soloSquad(breacher);bq.route=makeRoute(breachPath);breacher.angle=0;breacher.cd=0;enemies=[breacher];state='play';
let sawBreach=false;for(let t=0;t<60*40&&breacher.x<12*T;t++){hitstop=0;update(1/60);if(breacher.mode==='breach'){sawBreach=true;if(Math.abs(breacher.wall.x-10*T-16)>16)throw Error('Breach target');}}
if(!sawBreach||breacher.x<12*T||grid[5*COLS+10]===BRICK&&grid[6*COLS+10]===BRICK)throw Error('Breach and continue');
// A wall destroyed before arrival is skipped.
carve(wide);for(const [c,r] of wallCells){const i=r*COLS+c;grid[i]=BRICK;brickHp[i]=4;brickMask[i]=1023;}navReset();
const oldWall=plan('soldier',cellPt(3,5),cellPt(16,5),true);for(const [c,r] of wallCells)hitBrick(c,r,99);
squads=[];bullets=[];breacher=makeTank(cellPt(3,5).x,cellPt(3,5).y,'soldier');bq=soloSquad(breacher);bq.route=makeRoute(oldWall);breacher.angle=0;enemies=[breacher];
for(let t=0;t<60*20&&breacher.x<12*T;t++){hitstop=0;update(1/60);if(breacher.mode==='breach'||bullets.length)throw Error('Skip destroyed wall');}if(breacher.x<12*T)throw Error('Drive through opened wall');
// Spawn events: two columns per single by default, the ratio counts events; hunters every N-th column.
CFG.mapSize=30;startGame();enemies=[];squads=[];spawnSeq=0;columnSeq=0;
const events=[];toSpawn=Array(7).fill('scout');while(toSpawn.length){const p=prepareSpawn();p.task.cancel=true;events.push(p.n);toSpawn.splice(-p.n);}
if(events.join()!=='3,3,1')throw Error('Column to single ratio');
CFG.columnRatio=0;spawnSeq=0;toSpawn=['scout','scout'];const solo=prepareSpawn();solo.task.cancel=true;if(solo.n!==1)throw Error('Ratio zero singles');CFG.columnRatio=2;pendingSpawn=null;
// Column: strongest leads, order kept, no overlap on entry, full size counts against the limit.
grid.fill(EMPTY);brickMask.fill(0);brickHp.fill(0);sand.fill(0);const bc=Math.floor(COLS/2);
for(let r=ROWS-2;r<ROWS;r++)for(let c=bc-1;c<=bc+1;c++){const i=r*COLS+c,wall=r===ROWS-2||c!==bc;grid[i]=wall?BRICK:EMPTY;brickHp[i]=wall?4:0;brickMask[i]=wall?1023:0;}
navReset();player.x=-400;player.y=-400;spawnSeq=0;columnSeq=0;toSpawn=['scout','heavy','soldier'];spawnTimer=0;spawnWait();
if(enemies.length!==3||squads.length!==1)throw Error('Column spawn');const col=squads[0];
if(col.members.map(e=>e.kind).join()!=='heavy,soldier,scout'||leaderOf(col)!==col.members[0]||new Set(enemies.map(e=>e.x)).size!==1)throw Error('Column order');
toSpawn=['scout','scout','scout'];spawnTimer=0;const limitBefore=CFG.maxAliveBase;CFG.maxAliveBase=4;wave=1;for(let k=0;k<60;k++){navStep();updateSpawns(.05);}if(enemies.length!==3)throw Error('Column counts fully against limit');CFG.maxAliveBase=limitBefore;toSpawn=[];pendingSpawn=null;
for(let t=0;t<60*12;t++){hitstop=0;player.x=-400;player.y=-400;update(1/60);
  for(let i=0;i<enemies.length;i++)for(let j=i+1;j<enemies.length;j++){const a=enemies[i],b=enemies[j];if((a.entering||b.entering)&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r)throw Error('Entry overlap');}}
const [lead,f1,f2]=col.members;if(lead.entering||f1.entering||f2.entering||!(lead.rp.s>f1.rp.s&&f1.rp.s>f2.rp.s))throw Error('Column follows one route in order');
if(f1.rp.s>lead.rp.s-(lead.r+f1.r+10)||f2.rp.s>f1.rp.s-(f1.r+f2.r+10))throw Error('Column spacing');
if(lead.mode==='fire'||lead.rp.s<7*T)throw Error('Column still on route after 12 s');
f2.x=col.route.pts[0].x;f2.y=col.route.pts[0].y;f2.rp={s:0,wp:0,off:0};const s0=lead.rp.s;for(let t=0;t<10;t++){player.x=-400;player.y=-400;update(1/60);}if(lead.mode!=='wait'||Math.abs(lead.rp.s-s0)>3)throw Error('Leader waits for laggard');
hitEnemy(lead,{x:lead.x,y:lead.y,dmg:99});update(1/60);if(leaderOf(col)!==f1||queueOf(col)[1]!==f2)throw Error('Strongest survivor leads');
for(let t=0;t<60*40&&f1.mode!=='fire';t++){hitstop=0;player.x=-400;player.y=-400;update(1/60);}
if(f1.mode!=='fire'||Math.hypot(f1.x-base.x,f1.y-base.y)>6*T+8||!hardLos(f1.x,f1.y,base.x,base.y))throw Error('Firing position near base, not inside it');
// Detection: one member seeing the player switches the whole column to combat; walls and foliage hide; last known position kept.
grid.fill(EMPTY);navReset();wrecks=[];bullets=[];enemies=[];squads=[];base=null;
const d1=makeTank(5*T+16,5*T+16,'soldier'),d2=makeTank(5*T+16,9*T+16,'soldier'),dq=soloSquad(d1);joinSquad(d2,dq);dq.members=[d1,d2];enemies=[d1,d2];
for(let r=8;r<=10;r++)grid[r*COLS+7]=STEEL;navReset();
player=makeTank(24*T+16,5*T+16,'player');dq.thinkT=0;thinkSquad(dq,.01);if(!dq.combat||!d1.sees||d2.sees||!COMBAT.has(d1.mode)||!COMBAT.has(d2.mode))throw Error('Column combat from one sighting');
player.x=(5+21)*T+16;const far=makeTank(5*T+16,5*T+16,'scout'),fq=soloSquad(far);fq.thinkT=0;thinkSquad(fq,.01);if(fq.combat)throw Error('Sight 20 cells');
player.x=(5+19)*T;fq.thinkT=0;thinkSquad(fq,.01);if(!fq.combat)throw Error('Sight within 20 cells');
grid[5*COLS+20]=TREE;player.x=20*T+16;const hid=makeTank(5*T+16,5*T+16,'scout'),hq=soloSquad(hid);hq.thinkT=0;thinkSquad(hq,.01);if(hq.combat)throw Error('Foliage stealth');grid[5*COLS+20]=EMPTY;
const seenAt={...dq.last};player.x=24*T+16;player.y=15*T+16;grid.fill(EMPTY);for(let c=0;c<COLS;c++)grid[12*COLS+c]=STEEL;navReset();dq.thinkT=0;thinkSquad(dq,.01);
if(dq.last.x!==seenAt.x||dq.last.y!==seenAt.y||!dq.combat)throw Error('Hold last known position');
d2.cd=0;d2.turret=Math.atan2(dq.last.y-d2.y,dq.last.x-d2.x);d2.sees=false;bullets=[];updateEnemy(d2,.01);if(bullets.length)throw Error('No shot without own line of fire');
for(let t=0;t<Math.ceil(ENEMY_MEMORY/THINK)+2;t++){dq.thinkT=0;thinkSquad(dq,THINK);}if(dq.combat||d1.mode!=='return')throw Error('Return after combat');
dq.route=makeRoute(Array.from({length:19},(_,k)=>(4+k)*NC+11));d2.x+=80;
for(let t=0;t<60*6&&(d1.mode!=='route'||d2.mode!=='route');t++){navStep();for(const e of [d1,d2])updateEnemy(e,1/60);}if(d1.mode!=='route'||d2.mode!=='route')throw Error('Back on route');
// Hunters: closed patrol inside a reachable 10x10 area, never target the base.
CFG.mapSize=30;startGame();grid.fill(EMPTY);brickMask.fill(0);sand.fill(0);navReset();enemies=[];squads=[];player.x=-400;player.y=-400;
CFG.hunterEvery=1;spawnSeq=0;columnSeq=0;toSpawn=['soldier','soldier'];spawnTimer=0;spawnWait();CFG.hunterEvery=10;
const hunt=squads[0];if(!hunt||!hunt.hunter||!hunt.loop||!hunt.area)throw Error('Hunter column');
const lp=hunt.loop.pts,ha=hunt.area;if(lp[0].x!==lp.at(-1).x||lp[0].y!==lp.at(-1).y||lp.some(p=>p.x<ha.x0||p.x>ha.x1||p.y<ha.y0||p.y>ha.y1)||ha.x1-ha.x0!==10*T||ha.y1-ha.y0!==10*T)throw Error('Hunter patrol loop');
const entryEnd=hunt.route.pts[hunt.entryEnd];if(entryEnd.x!==lp[0].x||entryEnd.y!==lp[0].y)throw Error('Hunter area reachable');
const baseHp=base.hp;for(let t=0;t<60*60;t++){hitstop=0;player.x=-400;player.y=-400;update(1/60);if(hunt.members.some(e=>e.shot))throw Error('Hunters ignore base');}
if(base.hp!==baseHp||!(hunt.members[0].rp.s>hunt.loop.len.at(-1)+hunt.route.len[hunt.entryEnd]))throw Error('Hunters keep patrolling');
// Route lines show the data the tanks drive along: one shared line per column, the hunter loop, local connectors.
CFG.showRoutes=true;const lines=routeLines();if(lines.length<2||lines[0].pts[0]!==hunt.route.pts[0]||lines[1].pts!==hunt.loop.pts)throw Error('Route lines');draw();CFG.showRoutes=false;
// Planning goes through a per-frame budget, reuses cached routes, and the cache follows map changes.
startGame();const expandedBefore=navStats.expanded;navRequest(planMain(["heavy"],[0],kindR("heavy")));navStep(50);if(navStats.expanded-expandedBefore>51)throw Error('Navigation budget');navStep(1e9);
const hits=navStats.cacheHits,cached=navRequest(planMain(['heavy'],[0],kindR('heavy')));navStep(1e9);if(navStats.cacheHits!==hits+1||!cached.result)throw Error('Route cache');
const bi=grid.findIndex(t=>t===BRICK);hitBrick(bi%COLS,bi/COLS|0,1);if(routeCache.size)throw Error('Cache follows map changes');
startGame();
// Projectile collisions: continuous sweep, radius, time order, relative motion, no tunnelling, no double damage.
CFG.mapSize=30;startGame();grid.fill(EMPTY);brickMask.fill(0);brickHp.fill(0);navReset();buildTileLayer();base=null;enemies=[];squads=[];wrecks=[];player=makeTank(900,600,'player');player.pw.shield=0;player.inv=0;
const setBrick=(c,r)=>{const i=r*COLS+c;grid[i]=BRICK;brickHp[i]=4;brickMask[i]=1023;};
const shell=o=>({life:2,r:3,dmg:1,owner:'p',trail:[],...o});
// a 6000 px/s shell crosses 300 px per frame and still stops at a single fence rail or masonry row
grid[5*COLS+10]=FENCE;shapeFences();bullets=[shell({x:10*T+16,y:2*T,vx:0,vy:6000})];updateBullets(.05);if(grid[5*COLS+10]===FENCE||bullets.length)throw Error('Fast shell vs fence');
setBrick(10,5);bullets=[shell({x:10*T+16,y:2*T,vx:0,vy:6000})];updateBullets(.05);if(brickHp[5*COLS+10]!==3||bullets.length)throw Error('Fast shell vs brick');
grid.fill(EMPTY);
let target=makeTank(10*T+16,8*T,'soldier');enemies=[target];bullets=[shell({x:10*T+16,y:T,vx:0,vy:8000})];updateBullets(.05);if(target.hp!==KINDS.soldier.hp-1||bullets.length)throw Error('Fast shell vs tank');
const sx={x:5*T,y:5*T,vx:7000,vy:0},sy={x:5*T+300,y:5*T,vx:-7000,vy:0};enemies=[];bullets=[shell(sx),shell({...sy,owner:'e'})];updateBullets(.05);if(bullets.length)throw Error('Fast head-on shells');
// paths that cross at different moments do not collide
bullets=[shell({x:100,y:300,vx:4000,vy:0}),shell({x:200,y:100,vx:0,vy:4000,owner:'e'})];updateBullets(.05);if(bullets.length!==2)throw Error('Crossing at different times');
bullets=[shell({x:100,y:300,vx:4000,vy:0}),shell({x:200,y:200,vx:0,vy:4000,owner:'e'})];updateBullets(.05);if(bullets.length)throw Error('Crossing at the same time');
// radius counts: grazing contact hits, a slightly wider pass does not
setBrick(10,5);const edge=5*T;bullets=[shell({x:8*T,y:edge-3,vx:900,vy:0})];updateBullets(.1);if(bullets.length||brickHp[5*COLS+10]!==3)throw Error('Grazing contact');
setBrick(10,5);bullets=[shell({x:8*T,y:edge-3.2,vx:900,vy:0})];updateBullets(.1);if(!bullets.length||brickHp[5*COLS+10]!==4)throw Error('Near miss');
// nearest first: a tank behind a brick is safe, a tank in front of it is hit and the brick stays intact
grid.fill(EMPTY);setBrick(10,5);target=makeTank(13*T,5*T+16,'soldier');enemies=[target];bullets=[shell({x:6*T,y:5*T+16,vx:3000,vy:0})];updateBullets(.1);
if(target.hp!==KINDS.soldier.hp||brickHp[5*COLS+10]!==3)throw Error('Brick before tank');
setBrick(10,5);target.x=8*T;bullets=[shell({x:6*T,y:5*T+16,vx:3000,vy:0})];updateBullets(.1);if(target.hp!==KINDS.soldier.hp-1||brickHp[5*COLS+10]!==4)throw Error('Tank before brick');
// several events in one frame, in order: fence passed, first brick pierced, second brick takes one normal hit
grid.fill(EMPTY);grid[5*COLS+6]=FENCE;shapeFences();setBrick(9,5);setBrick(12,5);enemies=[];
const ap=shell({x:3*T,y:5*T+16,vx:9000,vy:0,armor:true,dmg:2});bullets=[ap];updateBullets(.1);
if(grid[5*COLS+6]!==EMPTY||grid[5*COLS+9]!==EMPTY||brickHp[5*COLS+12]!==3||bullets.length)throw Error('Ordered multi-hit AP');
// two shells hitting one tank in the same frame each deal damage once; a shell is not counted twice
target=makeTank(20*T,10*T,'heavy');enemies=[target];bullets=[shell({x:20*T-200,y:10*T,vx:4000,vy:0}),shell({x:20*T+200,y:10*T,vx:-4000,vy:0})];updateBullets(.1);
if(target.hp!==KINDS.heavy.hp-2||bullets.length)throw Error('Two hits once each');
// after an AP shell is downgraded mid-frame the rest of its path uses the new speed
grid.fill(EMPTY);enemies=[];const apMid=shell({x:100,y:300,vx:1500,vy:0,armor:true,dmg:2}),reg=shell({x:200,y:300,vx:0,vy:0,owner:'e'});bullets=[apMid,reg];updateBullets(.1);
const tHit=(200-8-100)/1500;if(!reg.dead||apMid.armor||Math.abs(apMid.x-(100+1500*tHit+1000*(.1-tHit)))>1e-6)throw Error('Recompute after speed change');
// a tank that crosses the shell path during the frame is hit (tank motion over the same interval)
target=makeTank(400,200,'soldier');target.px=400;target.py=100;enemies=[target];bullets=[shell({x:300,y:150,vx:2000,vy:0})];tankMotion=true;updateBullets(.1);tankMotion=false;
if(target.hp!==KINDS.soldier.hp-1)throw Error('Moving tank');
target=makeTank(400,200,'soldier');target.px=400;target.py=100;enemies=[target];bullets=[shell({x:300,y:150,vx:2000,vy:0})];updateBullets(.1);if(target.hp!==KINDS.soldier.hp)throw Error('Static tank outside update');
// Map cache: static layer reused, dirty cells merged per frame, shaking bricks moved out of the cache without duplicates.
CFG.mapSize=30;startGame();draw();const calls=[];const wrap=n=>{const f=globalThis[n];globalThis[n]=function(g,...a){calls.push({n,cache:g===tctx,x:a[0],y:a[1]});return f.call(this,g,...a);};return f;};
const realBrick=wrap('drawBrick'),realSteel=wrap('drawSteel'),realFence=wrap('drawFence');let paints=0;const realPaint=paintTiles;paintTiles=function(...a){paints++;return realPaint.apply(this,a);};
draw();if(calls.length||paints)throw Error('No full map redraw per frame');
grid.fill(EMPTY);const ci=8*COLS+12;setBrick(12,8);buildTileLayer();paints=0;calls.length=0;
hitBrick(12,8,1);hitBrick(12,8,1);draw();
const own=calls.filter(c=>c.n==='drawBrick'&&c.x===12*T&&c.y===8*T);if(paints!==1||own.length!==1||own[0].cache)throw Error('Shaking brick drawn once, outside cache');
calls.length=0;paints=0;draw();if(paints||calls.filter(c=>c.n==='drawBrick').length!==1)throw Error('Shake keeps dynamic only');
updateParts(1);calls.length=0;draw();const back=calls.filter(c=>c.n==='drawBrick'&&c.x===12*T&&c.y===8*T);if(paints!==1||back.length!==1||!back[0].cache)throw Error('Brick returns to cache');
hitBrick(12,8,99);calls.length=0;draw();if(calls.some(c=>c.n==='drawBrick'&&c.x===12*T))throw Error('Destroyed brick gone');
const ground=groundCanvas;hitBrick(12,8,1);draw();if(groundCanvas!==ground)throw Error('Track marks layer kept');
drawBrick=realBrick;drawSteel=realSteel;drawFence=realFence;paintTiles=realPaint;
for(const size of [45,60,30]){CFG.mapSize=size;startGame();if(tileCanvas.width!==W||tileCanvas.height!==H||waterCells.some(i=>grid[i]!==WATER))throw Error('Cache rebuilt for map size');draw();}
startGame();
`,box);
assert(!code.includes("tone(420, 110"));
console.log('PASS: screenshot defaults, storage migration, turret rate/wrap, four-hit brick damage, density, 20 dense connected maps, asymmetry, render calls, settings persistence');
