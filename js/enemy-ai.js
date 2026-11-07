'use strict';
// ИИ противников: поле расстояний, видимость, выбор целей, колонны, укрытия и артиллерия.
// Использует геометрию world/destruction.js, движение tanks.js и оружие weapons.js.
// Общее состояние enemies/player/base/wave и утилиты остаются в index.html;
// массив flow принадлежит world.js. enemyInterval также используется отрисовкой.
// При подключении определяет функции, без DOM, событий и запуска симуляции.

// fenceCost: 1 — танки давят забор и едут через него без штрафа; мотобригада передаёт 2 и свой массив,
// чтобы её маршрут не затирал общий flow танков.
function buildFlow(tc, tr, fenceCost = 1, f = flow) {
  f.fill(1e9);
  const s = tr * COLS + tc, q = [s];
  f[s] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], c = i % COLS, r = (i / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr, t = tileAt(nc, nr);
      if (t === STEEL || t === WATER) continue;
      const j = nr * COLS + nc, nd = f[i] + (t === BRICK ? 4 : t === FENCE ? fenceCost : 1);
      if (nd < f[j]) { f[j] = nd; q.push(j); }
    }
  }
}

// Что участник ломает или минирует, а не проезжает: танки — только кирпич (забор давят), мотобригада — и забор.
const obstacleFor = (e, t) => t === BRICK || (t === FENCE && !crushesFence(e));

function los(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (bulletBlocked(x,y)) return false;
  }
  return true;
}

function decide(e, random, f = flow) {
  const K = KINDS[e.kind], c = Math.floor(e.x / T), r = Math.floor(e.y / T);
  const opts = [];
  for (const [dc, dr] of DIRS) {
    const nc = c + dc, nr = r + dr, t = tileAt(nc, nr);
    if (t === STEEL || t === WATER) continue;
    if (random && obstacleFor(e, t) && e.kind!=='heavy') continue;
    opts.push({ nc, nr, t, v: f[nr * COLS + nc] });
  }
  e.brick = null;
  if (!opts.length) { e.tx = c * T + 16; e.ty = r * T + 16; return; }
  let pick = opts.reduce((a, b) => b.v < a.v ? b : a);
  if (random || Math.random() < K.wander) pick = opts[ri(0, opts.length - 1)];
  if (obstacleFor(e, pick.t)) {
    e.brick = { x: pick.nc * T + 16, y: pick.nr * T + 16 };
    e.tx = c * T + 16; e.ty = r * T + 16;
  } else {
    e.tx = pick.nc * T + 16; e.ty = pick.nr * T + 16;
  }
}

const enemyInterval=kind=>({scout:1/.33,soldier:2,heavy:5,artillery:6,moto:1}[kind]??KINDS[kind].fireRate);

function enemyGoal(e) {
  const choices=[player,base,...allies].filter(t=>t&&!t.dead);
  return choices.sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0]||PLAYER_START;
}

function formColumns() {
  const rank={heavy:3,soldier:2,scout:1},eligible=enemies.filter(e=>!e.dead&&!e.entering&&!(e.detourTime>0)&&e.kind!=='moto'&&e.kind!=='rocket');
  const pool=eligible.filter(e=>e.kind!=='artillery').sort((a,b)=>rank[b.kind]-rank[a.kind]),guns=eligible.filter(e=>e.kind==='artillery'&&!e.deployed);
  for(const e of eligible){e.leader=null;e.columnSlot=0;}
  while(pool.length){const lead=pool.shift(),gun=guns.find(e=>Math.hypot(e.x-lead.x,e.y-lead.y)<260);
    const near=pool.filter(e=>Math.hypot(e.x-lead.x,e.y-lead.y)<220).sort((a,b)=>Math.hypot(a.x-lead.x,a.y-lead.y)-Math.hypot(b.x-lead.x,b.y-lead.y)).slice(0,gun?1:2);
    near.forEach((e,i)=>{e.leader=lead;e.columnSlot=i+1;pool.splice(pool.indexOf(e),1);});
    if(gun){gun.leader=lead;gun.columnSlot=near.length+1;guns.splice(guns.indexOf(gun),1);}
  }
}

// crush=true — забор не мешает (танк его продавит): для маршрутов союзников к бонусам и точек въезда.
function coverClear(x,y,r,crush=false) {
  const blocks=crush?blocksCrusher:blocksTank;
  return [[0,0],[-r,-r],[r,-r],[-r,r],[r,r]].every(([dx,dy])=>!blocks(tileAt(Math.floor((x+dx)/T),Math.floor((y+dy)/T))));
}

function updateCover(e,goal,dt) {
  e.coverSearch=(e.coverSearch||0)-dt;
  if(e.cover && (Math.hypot(goal.x-e.cover.gx,goal.y-e.cover.gy)>96 || e.stuck>.6))e.cover=null;
  if(!e.cover && e.coverSearch<=0 && !e.leader) {
    e.coverSearch=1.5;
    const c=Math.floor(e.x/T),r=Math.floor(e.y/T);
    outer:for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++) {
      const x=(c+dc)*T+16,y=(r+dr)*T+16;
      if(!coverClear(x,y,e.r)||los(x,y,goal.x,goal.y)||Math.hypot(x-e.x,y-e.y)>100)continue;
      for(const [dx,dy] of DIRS) {
        const px=x+dx*64,py=y+dy*64;
        if(!coverClear(px,py,e.r)||!coverClear((x+px)/2,(y+py)/2,e.r)||!los(px,py,goal.x,goal.y))continue;
        e.cover={x,y,px,py,gx:goal.x,gy:goal.y};e.retreat=false;break outer;
      }
    }
  }
  if(e.cover) {
    const q=e.cover;
    if(e.retreat&&Math.hypot(e.x-q.x,e.y-q.y)<5&&e.cd<.5)e.retreat=false;
    e.tx=e.retreat?q.x:q.px;e.ty=e.retreat?q.y:q.py;e.brick=null;
  }
}

function blockingBrick(e,goal) {
  const n=Math.ceil(Math.hypot(goal.x-e.x,goal.y-e.y)/6);
  for(let j=1;j<n;j++) {const x=e.x+(goal.x-e.x)*j/n,y=e.y+(goal.y-e.y)*j/n,c=Math.floor(x/T),r=Math.floor(y/T),t=tileAt(c,r);
    if(t===STEEL||t===WATER)return null;if(t===BRICK&&bulletBlocked(x,y))return {x,y};}
  return null;
}

function reconsiderRoute(e,dt) {
  if(e.watchX===undefined){e.watchX=e.x;e.watchY=e.y;e.idleTime=0;}
  if(Math.hypot(e.x-e.watchX,e.y-e.watchY)>6){e.watchX=e.x;e.watchY=e.y;e.idleTime=0;}
  else e.idleTime+=dt;
  e.detourTime=Math.max(0,(e.detourTime||0)-dt);
  if(e.idleTime>=5) {
    e.idleTime=0;e.watchX=e.x;e.watchY=e.y;e.cover=null;e.retreat=false;e.leader=null;e.stuck=0;
    const goal=enemyGoal(e);buildFlow(Math.floor(goal.x/T),Math.floor(goal.y/T));
    const c=Math.floor(e.x/T),r=Math.floor(e.y/T),options=DIRS.map(([dx,dy])=>({x:(c+dx)*T+16,y:(r+dy)*T+16})).filter(q=>coverClear(q.x,q.y,e.r));
    if(options.length){const q=options[ri(0,options.length-1)];e.tx=q.x;e.ty=q.y;e.brick=null;e.detourTime=1.5;e.decideT=1.5;}
    else {decide(e,false);e.detourTime=1.5;}
    e.repaths=(e.repaths||0)+1;
  }
}

function updateEnemy(e, dt) {
  const K = KINDS[e.kind];
  e.flash -= dt; e.recoil = (e.recoilMax||5)*clamp(e.cd/enemyInterval(e.kind),0,1);
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  if(e.entering) {
    e.y+=K.speed*dt;e.ty=e.y;e.tx=e.x;
    if(e.kind==='heavy'){
      e.cd-=dt;
      const sightY=Math.max(0,e.y),foes=[player,...(typeof allies!=='undefined'?allies:[])].filter(t=>t&&!t.dead);
      let target=null,nearest=Infinity;
      for(const t of foes){const d=Math.hypot(t.x-e.x,t.y-e.y),hidden=tileAt(Math.floor(t.x/T),Math.floor(t.y/T))===TREE&&d>CFG.treeStealth;
        if(d<nearest&&d<CFG.enemySight&&!hidden&&los(e.x,sightY,t.x,t.y)){nearest=d;const lead=d/3000*.6;target={x:t.x+(t.vx||0)*lead,y:t.y+(t.vy||0)*lead};}}
      if(!target&&base&&!base.dead&&los(e.x,sightY,base.x,base.y))target=base;
      const muzzle=vehicleMuzzle(e),mx=muzzle.x,my=muzzle.y;
      aimAndFireEnemy(e,target,dt,mx>=4&&mx<W-4&&my>=4&&my<H-4);
    }
    if(e.y>=48){e.y=48;e.entering=false;if(e.kind!=='heavy')e.cd=enemyInterval(e.kind);}
    return;
  }
  if(e.kind==='moto'){updateMoto(e,dt);return;}
  e.cd -= dt; e.decideT -= dt;reconsiderRoute(e,dt);
  if(e.kind==='artillery'){updateArtillery(e,dt);return;}
  if(e.kind==='rocket'){updateRocketLauncher(e,dt);return;}
  const goal=enemyGoal(e);
  if(!e.leader)buildFlow(Math.floor(goal.x/T),Math.floor(goal.y/T));

  // видимая цель: ближайший из игрока и союзников, не скрытый кронами
  let foe = null, dp = 1e9;
  for (const t of [player, ...allies]) {
    if (!t || t.dead) continue;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    const hidden = tileAt(Math.floor(t.x / T), Math.floor(t.y / T)) === TREE && d > CFG.treeStealth;
    if (d < dp && !hidden && d < CFG.enemySight && los(e.x, e.y, t.x, t.y)) { foe = t; dp = d; }
  }
  const sees = !!foe;
  e.engaged=sees;

  // движение от клетки к клетке по полю расстояний
  if (e.stuck > .7) { e.stuck = 0; decide(e, true); e.decideT = .5; }
  else if (Math.hypot(e.tx - e.x, e.ty - e.y) < 1.5 && e.decideT <= 0) { decide(e, false); e.decideT = e.brick ? .35 : 0; }

  if(e.detourTime<=0 && e.leader && !e.leader.dead && !e.brick) {
    const lead=e.leader, gap=48*e.columnSlot;
    const gx=lead.x-Math.cos(lead.angle)*gap,gy=lead.y-Math.sin(lead.angle)*gap;
    if(los(e.x,e.y,gx,gy)) {e.tx=clamp(gx,24,W-24);e.ty=clamp(gy,24,H-24);}
  }
  const pathWall=blockingBrick(e,goal);
  if(pathWall && (e.kind==='heavy'||e.stuck>.25||e.brick)) {e.brick=pathWall;e.cover=null;e.retreat=false;}
  else if(e.detourTime<=0)updateCover(e,goal,dt);
  const hold = e.detourTime<=0 && !e.cover && sees && dp < K.hold;
  const mx = e.tx - e.x, my = e.ty - e.y, md = Math.hypot(mx, my);
  if (!hold && md > .5) {
    const speed = K.speed * (1 + Math.min(wave, 10) * CFG.enemySpeedPerWave);
    const step = Math.min(md, speed * dt);
    e.angle = turnTo(e.angle, Math.atan2(my, mx), dt * 8);
    const moved = moveTank(e, mx / md * step, my / md * step, dt, md);
    if (step > .5 && moved < step * .3) e.stuck += dt; else e.stuck = Math.max(0, e.stuck - dt);
  }

  // башня и стрельба
  let target = null;
  if(e.brick)target=e.brick;
  else if (sees && goal!==base) {
    const lead = dp / (e.kind==='heavy'?3000:K.bulletSpeed) * .6;
    target = { x: foe.x + foe.vx * lead, y: foe.y + foe.vy * lead };
  } else if(base && !base.dead && los(e.x,e.y,base.x,base.y)) target=base;
  else if (e.brick) target = e.brick;
  aimAndFireEnemy(e,target,dt);
}
function aimAndFireEnemy(e,target,dt,canShoot=true) {
  const aim=target?Math.atan2(target.y-e.y,target.x-e.x):e.angle;
  e.turret=turnTo(e.turret,aim,dt*KINDS[e.kind].turretSpeed);
  if(target&&canShoot&&!e.retreat&&e.cd<=0&&Math.abs(angDiff(e.turret,aim))<.12){
    fire(e);e.cd=enemyInterval(e.kind);if(e.cover)e.retreat=true;
  }
}

function updateArtillery(e,dt){
  const alive=player&&!player.dead,range=20*T,playerInRange=alive&&Math.hypot(player.x-e.x,player.y-e.y)<=range;
  const baseInRange=base&&!base.dead&&Math.hypot(base.x-e.x,base.y-e.y)<=range;
  if(!e.deployed&&(playerInRange||(e.leader&&e.leader.engaged)||(base&&Math.hypot(base.x-e.x,base.y-e.y)<4*T)||(!e.leader&&baseInRange)))e.deployed=true;
  const goal=alive?player:base&&!base.dead?base:PLAYER_START;
  if(!e.deployed||(!playerInRange&&!baseInRange)){
    if(e.leader&&!e.leader.dead){e.tx=e.leader.x-Math.cos(e.leader.angle)*48*e.columnSlot;e.ty=e.leader.y-Math.sin(e.leader.angle)*48*e.columnSlot;}
    else {buildFlow(Math.floor(goal.x/T),Math.floor(goal.y/T));if(Math.hypot(e.tx-e.x,e.ty-e.y)<5||e.stuck>.6){decide(e,false);e.stuck=0;}}
    const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy),step=Math.min(d,KINDS.artillery.speed*dt);
    if(d>1){e.angle=turnTo(e.angle,Math.atan2(dy,dx),dt*2);const moved=moveTank(e,dx/d*step,dy/d*step,dt,d);if(moved<step*.3)e.stuck+=dt;}
  }else {e.vx=e.vy=0;const target=playerInRange?player:base;
    const aim=Math.atan2(target.y-e.y,target.x-e.x);e.turret=turnTo(e.turret,aim,dt*KINDS.artillery.turretSpeed);
    if(e.cd<=0&&Math.abs(angDiff(e.turret,aim))<.15){const muzzle=vehicleMuzzle(e);launchArtillery(muzzle.x,muzzle.y,target.x,target.y);e.cd=enemyInterval('artillery');e.recoilMax=e.recoil=8;}
  }
}

// ---------- Panzerwerfer 42 (РСЗО) ----------
// Цикл хранится на машине (e.salvo): за ROCKET_CONFIG.mark секунд последовательно отмечаются три точки,
// затем пауза ROCKET_CONFIG.wait и два залпа по три ракеты (пауза между залпами — CFG.rocketVolleyGap).
// Гибель машины удаляет её из enemies вместе с e.salvo: оставшиеся пуски отменяются, выпущенные долетают.
const ROCKET_RIPPLE=.12;
function rocketLaunchTime(n){const C=ROCKET_CONFIG;return C.mark+C.wait+Math.floor(n/C.points)*CFG.rocketVolleyGap+(n%C.points)*ROCKET_RIPPLE;}
// Цели: игрок и союзники (ещё не отмеченные), запасная — база; без отдельных целей точки разносятся вокруг доступной.
function pickRocketPoint(points) {
  const used=new Set(points.map(p=>p.src)),friends=[player,...allies].filter(t=>t&&!t.dead);
  const baseAlive=base&&!base.dead?base:null;
  const src=friends.find(t=>!used.has(t))||(baseAlive&&!used.has(baseAlive)?baseAlive:null);
  let x,y;
  if(src){x=src.x;y=src.y;}
  else {
    const anchors=[...friends,...(baseAlive?[baseAlive]:[])],anchor=anchors[points.length%Math.max(1,anchors.length)]||{x:W/2,y:H/2};
    for(let attempt=0;attempt<16;attempt++){
      const a=rnd(0,Math.PI*2),d=rnd(1.5,2.6)*T;x=clamp(anchor.x+Math.cos(a)*d,16,W-16);y=clamp(anchor.y+Math.sin(a)*d,16,H-16);
      if(points.every(p=>Math.hypot(p.x-x,p.y-y)>=ROCKET_CONFIG.radius*1.6))break;
    }
  }
  return {x:clamp(x,16,W-16),y:clamp(y,16,H-16),src,markedAt:simTime};
}
function rocketLauncherMuzzle(e){const s=tankScale(e);return {x:e.x-Math.cos(e.angle)*3*s+Math.cos(e.turret)*8*s,y:e.y-Math.sin(e.angle)*3*s+Math.sin(e.turret)*8*s};}
function driveRocketLauncher(e,dt) {
  const K=KINDS.rocket;
  e.turret=turnTo(e.turret,e.angle,dt*K.turretSpeed);
  // от базы держится на расстоянии: стрелять можно с любой дистанции
  if(base&&!base.dead&&Math.hypot(base.x-e.x,base.y-e.y)<6*T){e.vx=e.vy=0;return;}
  const goal=enemyGoal(e);buildFlow(Math.floor(goal.x/T),Math.floor(goal.y/T));
  if(e.stuck>.7){e.stuck=0;decide(e,true);e.decideT=.5;}
  else if(Math.hypot(e.tx-e.x,e.ty-e.y)<1.5&&e.decideT<=0){decide(e,false);e.decideT=0;}
  // РСЗО не стреляет по стенам: вместо пролома выбирает соседнюю свободную клетку
  if(e.brick){e.brick=null;decide(e,true);e.decideT=.5;}
  const mx=e.tx-e.x,my=e.ty-e.y,md=Math.hypot(mx,my);
  e.vx=e.vy=0;
  if(md>.5){
    const speed=K.speed*(1+Math.min(wave,10)*CFG.enemySpeedPerWave),step=Math.min(md,speed*dt);
    e.angle=turnTo(e.angle,Math.atan2(my,mx),dt*3);
    const moved=moveTank(e,mx/md*step,my/md*step,dt,md);
    if(step>.5&&moved<step*.3)e.stuck+=dt;else e.stuck=Math.max(0,e.stuck-dt);
  }
}
function updateRocketLauncher(e,dt) {
  const C=ROCKET_CONFIG,K=KINDS.rocket;
  if(!e.salvo){
    e.rocketCd=(e.rocketCd??C.firstDelay)-dt;
    if(e.rocketCd>0){driveRocketLauncher(e,dt);return;}
    e.salvo={t:0,points:[],launched:0};
  }
  const S=e.salvo,total=C.points*C.volleys;
  e.vx=e.vy=0;S.t+=dt;
  while(S.points.length<C.points&&S.t>=S.points.length*C.mark/C.points)S.points.push(pickRocketPoint(S.points));
  const aim=S.points[S.t<C.mark?S.points.length-1:S.launched%C.points];
  e.turret=turnTo(e.turret,Math.atan2(aim.y-e.y,aim.x-e.x),dt*K.turretSpeed);
  while(S.launched<total&&S.t>=rocketLaunchTime(S.launched)){
    const point=S.points[S.launched%C.points],m=rocketLauncherMuzzle(e);
    launchRocket(m.x,m.y,point,S.launched);S.launched++;e.recoilMax=e.recoil=3;
  }
  if(S.launched>=total){e.salvo=null;e.rocketCd=K.fireRate;}
}
// Зоны ударов: отмеченные точки живых РСЗО и точки, куда ещё летят ракеты (Set убирает повторы).
function rocketZones() {
  const zones=new Set();
  for(const e of enemies)if(!e.dead&&e.salvo)for(const p of e.salvo.points)zones.add(p);
  for(const r of rockets)zones.add(r.point);
  return zones;
}
