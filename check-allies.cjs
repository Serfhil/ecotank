const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

// Союзные танки: выключены по умолчанию, появляются в нижней четверти, гибнут от одного выстрела врага,
// бьют только противников и не ломают симуляцию на всех размерах карт.
module.exports=function checkAllies(root){
  const canvas=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:(()=>canvas)}),saved=new Map();
  const element={style:{},classList:{toggle(){}},addEventListener(){},getContext:()=>canvas,querySelector:()=>element,querySelectorAll:()=>[],blur(){}};
  let seed=24680;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const box=vm.createContext({Math:math,document:{getElementById:()=>({...element}),createElement:()=>({...element}),querySelectorAll:()=>[],createTextNode:text=>({textContent:text}),activeElement:element},window:{},innerWidth:960,innerHeight:640,addEventListener(){},requestAnimationFrame(){},performance:{now:()=>0},setTimeout(){},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},Audio:class{addEventListener(){}play(){return {catch(){}};}pause(){}}});
  const html=fs.readFileSync(root+'/index.html','utf8');
  for(const [,attrs,code]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){const src=attrs.match(/src="([^"]+)"/)?.[1];vm.runInContext(src?fs.readFileSync(root+'/'+src,'utf8'):code,box);}
  const run=code=>vm.runInContext(code,box);
  run('muted=true');
  assert.equal(run('CFG.allies'),false,'Allies are off by default');
  assert(run("CFG_FIELDS.some(([,f])=>f.some(([k,,t])=>k==='allies'&&t==='bool'))"),'Developer checkbox for allies');
  run("CFG.mapMode='original';CFG.mapSize=30;startGame()");
  assert.equal(run('allies.length'),0,'No allies while the checkbox is off');

  for(const size of [30,45,60]){
    run(`CFG.allies=true;CFG.allyCount=3;CFG.mapSize=${size};startGame();`);
    assert.equal(run('allies.length'),3,'Allies spawn on map start '+size);
    assert(run('allies.every(a=>a.y>=Math.floor(ROWS*3/4)*T&&coverClear(a.x,a.y,a.r))'),'Allies spawn on free cells in the bottom quarter');
  }

  // Одно попадание вражеского снаряда уничтожает союзника; снаряды союзника бьют врагов, но не игрока.
  run(`startGame();grid.fill(EMPTY);enemies=[];const a=allies[0];a.x=300;a.y=300;
    bullets=[{x:300,y:270,vx:0,vy:300,life:1,r:3,dmg:1,owner:'e'}];updateBullets(.1);`);
  assert.equal(run('allies[0].dead'),true,'One enemy shell destroys an ally');
  run(`allies=allies.filter(a=>!a.dead);const shooter=allies[0];shooter.x=200;shooter.y=300;shooter.turret=0;
    const foe=makeTank(400,300,'soldier');foe.spawnT=0;enemies=[foe];player.x=300;player.y=300;player.inv=0;const hp=player.hp;
    fire(shooter);updateBullets(.5);globalThis.__hp=hp;`);
  assert.equal(run('enemies[0].hp'),1,'Ally shell damages enemies');
  assert.equal(run('player.hp'),run('__hp'),'Ally shells pass through the player');

  // Союзник сам находит и обстреливает видимого противника.
  run(`grid.fill(EMPTY);bullets=[];const g=allies[0];g.x=300;g.y=400;g.cd=0;g.turret=-Math.PI/2;
    const target=makeTank(300,200,'scout');target.spawnT=0;enemies=[target];for(let i=0;i<60&&!bullets.length;i++)updateAlly(g,1/30);`);
  assert(run("bullets.some(b=>b.owner==='p')"),'Ally engages a visible enemy');
  // Враг видит союзника и стреляет в него, если тот ближе базы и игрока.
  run(`bullets=[];const scout=enemies[0];scout.cd=0;scout.turret=Math.PI/2;player.x=60;player.y=60;for(let i=0;i<60&&!bullets.some(b=>b.owner==='e');i++)updateEnemy(scout,1/30);`);
  assert(run("bullets.some(b=>b.owner==='e')"),'Enemies target allies');

  for(const size of [30,60]){
    run(`CFG.mapSize=${size};startGame();base.hp=99999;`);
    for(let f=0;f<1200;f++){
      run('player.inv=99;update(1/30)');
      if(f%120===0)run('draw()');
    }
    assert(run("allies.every(a=>['x','y','angle','turret'].every(k=>Number.isFinite(a[k])))"),'Allies stay finite');
    assert.notEqual(run('state'),'over');
  }
  run('CFG.allies=false;toMenu()');
  assert.equal(run('allies.length'),0,'Menu clears allies');
};

if(require.main===module){module.exports(__dirname);console.log('PASS: allies off by default, bottom-quarter spawn, one-shot armour, friendly fire, targeting and simulation');}
