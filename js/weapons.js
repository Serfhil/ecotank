'use strict';
// Оружие: обычные и бронебойные снаряды, рельсотрон, артиллерийские полёты и очереди залпа.
// Функции используют общие bullets/rails/artilleryShells и очереди из состояния игры,
// геометрию окружения, модули tanks/damage и sfx/burst/floatText из звука и эффектов.
// Порядок вызовов задаёт игровой цикл; ИИ артиллерии и отрисовка остаются в игре.

let supportClock=0,supportLaunch=-Infinity,supportImpact=-Infinity,supportSoundAt=0;
// Ракеты РСЗО в полёте и следы уже разорвавшихся ракет; rocketClock — время их собственной анимации.
let rockets=[],rocketTrails=[],rocketClock=0;
function resetArtillery(){supportClock=0;supportLaunch=supportImpact=-Infinity;supportSoundAt=0;artilleryShells=[];barrageMarkers=[];barrageTrajectories=[];barrageSoundShots=0;barrageFrame=0;rockets=[];rocketTrails=[];rocketClock=0;}

function hasPendingBarrage(){return barrageMarkers.length||barrageTrajectories.length||barrageSoundShots;}

function fire(t) {
  const K = KINDS[t.kind], isP = t === player || t.ally&&t.upgrade>0;
  const ap = (isP && t.armor)||t.kind==='heavy', speed=t.kind==='heavy'?3000:K.bulletSpeed*(ap?1.5:1);
  const mount=vehicleMount(t),shotScale=mount.scale,barrels=mount.offsets;
  const muzzle=vehicleMuzzle(t),mx=muzzle.x,my=muzzle.y;
  for (const offset of barrels) {
    const a = t.turret;
    bullets.push({ x: mx-Math.sin(a)*offset, y: my+Math.cos(a)*offset, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      owner: isP || t.ally ? 'p' : 'e', armor: ap, trail: [], dmg: t.kind==='heavy'?2:K.dmg*(ap?2:1), r: t.kind === 'heavy' ? 4 : 3, life: 2.5 });
  }
  t.recoilMax = t.recoil = 5;
  for (let i = 0; i < 6; i++) {
    const a = t.turret + rnd(-.5, .5), s = rnd(40, 140);
    parts.push({ x: mx, y: my, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .15, max: .15, size: rnd(2, 4), color: '#ffd76a' });
  }
  sfx(isP?'shoot':t.kind==='heavy'?'heavyShoot':'eshoot');
}

// Пулемёт по ступени танка: Т-34 — ДТ-29, ИС-2 — спаренные ДТ-29, ИС-2-II — ДШК.
function machineGun(p){return MG_TIERS[clamp(p&&p.upgrade||0,0,MG_TIERS.length-1)];}
// Урон пули по цели — maxHp/hits ступени, поэтому число попаданий по целой цели точное; null — рикошет.
function mgDamage(b,e){const hits=MG_TIERS[b.mgTier||0].hits[e.kind];return hits?e.maxHp/hits:null;}

// Курсовой пулемёт стреляет из лобового листа сразу в сторону цели: башня и её поворот не участвуют.
function fireMachineGun(p,tx,ty) {
  if(!p||p.dead||p.upgradeT>0)return;
  const gun=machineGun(p),s=tankScale(p),fx=Math.cos(p.angle),fy=Math.sin(p.angle);
  // спаренные стволы ДТ-29 стреляют поочерёдно
  const side=6+(gun.twin?((p.mgSide=!p.mgSide)?-3:3):0);
  const x=p.x+fx*15*s-fy*side*s,y=p.y+fy*15*s+fx*side*s,a=Math.atan2(ty-y,tx-x)+rnd(-MG_CONFIG.spread,MG_CONFIG.spread);
  bullets.push({x,y,vx:Math.cos(a)*MG_CONFIG.speed,vy:Math.sin(a)*MG_CONFIG.speed,owner:'p',mg:true,mgTier:clamp(p.upgrade||0,0,MG_TIERS.length-1),heavyMg:!!gun.heavy,armor:false,trail:[],dmg:0,r:gun.heavy?2:1.5,life:MG_CONFIG.life});
  for(let i=0;i<(gun.heavy?4:2);i++){const d=a+rnd(-.4,.4),v=rnd(40,110);parts.push({x,y,vx:Math.cos(d)*v,vy:Math.sin(d)*v,life:.08,max:.08,size:rnd(1.5,gun.heavy?3.5:2.5),color:'#ffe08a'});}
  sfx(gun.sound);
}

// «С» заряжает снаряд из НИИ: следующий выстрел основного орудия уходит рельсотроном.
function armRail(p) {
  if(!p||p.dead||p.upgradeT>0||p.rail<=0||p.railArmed)return false;
  p.railArmed=true;floatText(p.x,p.y-p.r-16,UI_TEXT.zaryazhayu_eksperimentalnym,'#c58cff');sfx('pick');
  return true;
}

function fireRail(p) {
  if (!p || p.dead || p.upgradeT>0 || p.rail <= 0) return;
  p.rail--;
  const dx = Math.cos(p.turret), dy = Math.sin(p.turret);
  const muzzle=vehicleMuzzle(p,vehicleMount(p).offsets[0]),x0=muzzle.x,y0=muzzle.y,hit=new Set();
  const reach = raseiniai ? millRayLimit(x0,y0,dx,dy,1400) : 1400;
  carveSteelRay(x0,y0,x0+dx*reach,y0+dy*reach);
  let len = 0; const foliageRay = {};
  for (; len < reach; len = Math.min(reach,len+4)) {
    const x = x0 + dx * len, y = y0 + dy * len, c = Math.floor(x / T), r = Math.floor(y / T), t = tileAt(c, r);
    if (x<0||y<0||x>=W||y>=H) break;
    if (t === TREE) hitFoliage(c,r,x,y,foliageRay);
    if (t === BRICK && bulletBlocked(x,y)) hitBrick(c, r, 99);
    if (t === FENCE && bulletBlocked(x,y)) hitFence(c, r, x, y);
    for (const e of enemies) {
      if (e.dead || e.spawnT > 0 || hit.has(e)) continue;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < (e.r + 4) ** 2) { hit.add(e); hitEnemy(e, { x, y, dmg: 99 }); }
    }
    for (const b of bullets) if (b.owner === 'e' && (b.x - x) ** 2 + (b.y - y) ** 2 < 64) b.dead = true;
    shootBomber(x,y,4);shootMine(x,y,4);
    if (len % 24 === 0) parts.push({ x, y, vx: rnd(-40, 40) - dy * rnd(-60, 60), vy: rnd(-40, 40) + dx * rnd(-60, 60), life: .5, max: .5, size: rnd(2, 4), color: '#e2c4ff', kind: 'fire' });
  }
  rails.push({ x0, y0, x1: x0 + dx * len, y1: y0 + dy * len, life: .45, max: .45 });
  p.recoilMax = p.recoil = 9; p.cd = p.reloadDuration = .4;
  shake = Math.max(shake, 9);
  sfx('rail');
}

function downgradeShell(b) {
  if(!b.armor)return;
  b.armor=false;b.trail=[];b.brickPierced=true;b.dmg=Math.max(1,b.dmg/2);b.vx/=1.5;b.vy/=1.5;b.r=3;
}

function collideShells() {
  for(let i=0;i<bullets.length;i++)for(let j=i+1;j<bullets.length;j++) {
    const a=bullets[i],b=bullets[j];if(a.mg||b.mg||a.dead||b.dead||(a.owner===b.owner&&!!a.armor===!!b.armor))continue;
    if(Math.hypot(a.x-b.x,a.y-b.y)>a.r+b.r+2)continue;
    if(!!a.armor!==!!b.armor){const ap=a.armor?a:b,normal=a.armor?b:a;normal.dead=true;downgradeShell(ap);}
    else a.dead=b.dead=true;
    burst((a.x+b.x)/2,(a.y+b.y)/2,16,['#fff','#ffd76a','#ff9e38'],250,.35,4,'spark');
  }
}

function updateBullets(dt) {
  const steps=Math.max(3,Math.ceil(Math.max(0,...bullets.map(b=>Math.hypot(b.vx,b.vy)))*dt/3));
  for(const b of bullets){b.life-=dt;if(b.life<=0)b.dead=true;if(b.armor){b.trail=b.trail||[];b.trail.push({x:b.x,y:b.y});if(b.trail.length>9)b.trail.shift();}}
  for(let step=0;step<steps;step++) {
    collideShells();
    for(const b of bullets) {
      if(b.dead)continue;
      const nx=b.x+b.vx*dt/steps,ny=b.y+b.vy*dt/steps,c=Math.floor(nx/T),r=Math.floor(ny/T),t=tileAt(c,r);
      if(t===TREE&&!b.mg)hitFoliage(c,r,nx,ny,b);
      const impact=bulletBlockingCell(nx,ny,b.r);
      // Любой пулемёт ломает забор, попав в его фактическую геометрию (bulletBlockingCell учитывает fenceRects).
      if(impact&&b.mg){if(impact.type===FENCE)hitFence(impact.c,impact.r,nx,ny);else burst(nx,ny,3,['#ffe9a0','#e8eef2'],90,.15,1.5,'spark');b.dead=true;continue;}
      if(impact) {
        const {c,r,type:t}=impact;
        // бронебойный пролетает забор насквозь, не тратя пробитие кирпича
        if(t===FENCE&&b.armor){hitFence(c,r,nx,ny);}
        else if(t===FENCE){hitFence(c,r,nx,ny);b.dead=true;continue;}
        else if(t===BRICK&&b.armor&&!b.brickPierced){hitBrick(c,r,99,nx,ny);b.brickPierced=true;}
        else {if(t===BRICK)hitBrick(c,r,1,nx,ny);else burst(nx,ny,6,['#e8eef2'],120,.25,2);b.dead=true;continue;}
      }
      b.x=nx;b.y=ny;
      if(base&&!base.dead&&Math.hypot(b.x-base.x,b.y-base.y)<base.r+b.r){if(!b.mg)hitBase(b.dmg);b.dead=true;continue;}
      if(b.owner==='p'&&(shootBomber(b.x,b.y,b.r)||shootMine(b.x,b.y,b.r))){b.dead=true;continue;}
      if(b.owner==='p'){for(const e of enemies){if(!e.dead&&e.spawnT<=0&&Math.hypot(e.x-b.x,e.y-b.y)<e.r+b.r){
        // Пуля пулемёта рикошетит от брони, которую не берёт его ступень (MG_TIERS.hits).
        const mgDmg=b.mg?mgDamage(b,e):null;
        if(b.mg&&mgDmg===null){burst(b.x,b.y,4,['#fff4bd','#e8eef2'],140,.18,1.5,'spark');sfx('deflect');}else hitEnemy(e,b.mg?{x:b.x,y:b.y,dmg:mgDmg}:b);
        b.dead=true;break;}}}
      else if(player&&!player.dead&&Math.hypot(player.x-b.x,player.y-b.y)<player.r+b.r){hitPlayer(b);b.dead=true;}
      else for(const a of allies){if(!a.dead&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r){hitAlly(a,b);b.dead=true;break;}}
    }
    collideShells();
  }
  bullets=bullets.filter(b=>!b.dead);
}

function launchArtillery(sx,sy,tx,ty,friendly=false,options={}){
  const speed=options.speed ?? (friendly?3000:KINDS.artillery.bulletSpeed);
  const shell={sx,sy,tx:clamp(tx,0,W),ty:clamp(ty,0,H),age:0,delay:options.delay ?? (friendly?2:0),speed,friendly,radius:45,damage:2};
  prepareArtilleryTrajectory(shell);artilleryShells.push(shell);
  if(!friendly)sfx('heavyShoot');
}

function prepareArtilleryTrajectory(shell){
  shell.dx=shell.tx-shell.sx;shell.dy=shell.ty-shell.sy;shell.angle=Math.atan2(shell.dy,shell.dx);
  shell.duration=Math.max(.01,Math.hypot(shell.dx,shell.dy)/shell.speed);shell.pending=false;
}

function callBarrage(){
  const targets=enemies.filter(e=>!e.dead&&e.spawnT<=0).map(e=>({tx:clamp(e.x,16,W-16),ty:clamp(e.y,8,H-8)}));
  while(targets.length<5){
    let target=null;
    for(let attempt=0;attempt<20;attempt++){target={tx:rnd(16,W-16),ty:rnd(16,H/2-16)};if(!targets.some(p=>Math.hypot(p.tx-target.tx,p.ty-target.ty)<T*1.5))break;}
    targets.push(target);
  }
  barrageMarkers.push(...targets);barrageSoundShots+=5;
}
function processBarrageFrame(dt=1/60){
  supportClock+=dt;barrageFrame++;
  if(barrageSoundShots&&supportClock>=supportSoundAt){sfx('heavyShoot');barrageSoundShots--;supportSoundAt=supportClock+SUPPORT_CONFIG.interval;}
  if(barrageMarkers.length){
    const target=barrageMarkers.shift(),shell={...target,sx:clamp(target.tx+rnd(-40,40),16,W-16),sy:H+24,age:0,createdAt:supportClock,delay:SUPPORT_CONFIG.warning,speed:SUPPORT_CONFIG.speed,friendly:true,radius:45,damage:2,pending:true,duration:Infinity};
    artilleryShells.push(shell);barrageTrajectories.push(shell);
  }
  if(barrageFrame%5===0&&barrageTrajectories.length){
    const shell=barrageTrajectories.shift();prepareArtilleryTrajectory(shell);
    const tick=dt>0?dt:1/60,gap=Math.ceil(SUPPORT_CONFIG.interval/tick-1e-9)*tick+1e-6;
    const launch=Math.max(supportClock,shell.createdAt+SUPPORT_CONFIG.warning,supportLaunch+gap,supportImpact+gap-shell.duration);
    shell.delay=launch-shell.createdAt;supportLaunch=launch;supportImpact=launch+shell.duration;
  }
}

// ---------- ракеты РСЗО ----------
// Траектория — кубическая кривая Безье к отмеченной точке; часть кривых петляет (контрольные точки
// перекрещены). Кривая заранее разбита на отрезки: время полёта = длина кривой / скорость.
const ROCKET_SAMPLES=40;
function rocketPath(sx,sy,tx,ty,loop,side) {
  const dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy)||1,ux=dx/dist,uy=dy/dist,nx=-uy,ny=ux,L=Math.max(dist,160);
  const a=loop?{u:1.15,n:.55*side}:{u:.35,n:rnd(.15,.6)*side},b=loop?{u:1.15,n:.55*side}:{u:.35,n:rnd(-.4,.4)};
  const p1x=sx+(ux*a.u+nx*a.n)*L,p1y=sy+(uy*a.u+ny*a.n)*L,p2x=tx+(-ux*b.u+nx*b.n)*L,p2y=ty+(-uy*b.u+ny*b.n)*L;
  const pts=[],cum=[0];
  for(let k=0;k<=ROCKET_SAMPLES;k++){
    const t=k/ROCKET_SAMPLES,m=1-t,w0=m*m*m,w1=3*m*m*t,w2=3*m*t*t,w3=t*t*t;
    pts.push({x:w0*sx+w1*p1x+w2*p2x+w3*tx,y:w0*sy+w1*p1y+w2*p2y+w3*ty});
    if(k)cum.push(cum[k-1]+Math.hypot(pts[k].x-pts[k-1].x,pts[k].y-pts[k-1].y));
  }
  pts[ROCKET_SAMPLES]={x:tx,y:ty};
  return {pts,cum,length:cum[ROCKET_SAMPLES]};
}
// point — объект зоны {x,y}; ракета держит ссылку, поэтому зона видна, пока ракета летит, даже без пусковой.
function launchRocket(sx,sy,point,index=0) {
  const loop=index%3===1||Math.random()<.2,side=(index%2?-1:1)*(Math.random()<.5?-1:1);
  const path=rocketPath(sx,sy,point.x,point.y,loop,side);
  rockets.push({...path,point,age:0,speed:Math.max(1,KINDS.rocket.bulletSpeed),x:sx,y:sy,angle:Math.atan2(point.y-sy,point.x-sx),trail:[],trailT:0});
  sfx('rocket');
}
function rocketPosition(r) {
  const s=Math.min(r.length,r.age*r.speed);let k=1;
  while(k<ROCKET_SAMPLES&&r.cum[k]<s)k++;
  const a=r.pts[k-1],b=r.pts[k],seg=(r.cum[k]-r.cum[k-1])||1,f=clamp((s-r.cum[k-1])/seg,0,1);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
function rocketImpact(r) {
  const {x,y}=r.point;
  explosion(x,y,false,'#c9773a',.7,false);
  blastDamage(x,y,ROCKET_CONFIG.radius/1.5,{damage:ROCKET_CONFIG.damage});
  if(base&&!base.dead&&Math.hypot(base.x-x,base.y-y)<=ROCKET_CONFIG.radius+base.r)hitBase(ROCKET_CONFIG.damage);
}
function updateRockets(dt) {
  rocketClock+=dt;
  for(const r of rockets){
    r.age+=dt;Object.assign(r,rocketPosition(r));
    r.trailT-=dt;
    if(r.trailT<=0){r.trailT=.012;r.trail.push({x:r.x,y:r.y,t:rocketClock});if(r.trail.length>ROCKET_CONFIG.trail)r.trail.shift();}
    if(r.age*r.speed>=r.length){r.done=true;r.trail.push({x:r.point.x,y:r.point.y,t:rocketClock});rocketTrails.push(r.trail);rocketImpact(r);}
  }
  rockets=rockets.filter(r=>!r.done);
  rocketTrails=rocketTrails.filter(trail=>rocketClock-trail[trail.length-1].t<ROCKET_CONFIG.trailLife);
}

function updateArtilleryShells(dt){
  processBarrageFrame(dt);
  for(const shell of artilleryShells){shell.age=shell.friendly&&shell.createdAt!==undefined?supportClock-shell.createdAt:shell.age+dt;if(!shell.pending&&shell.age>=shell.delay+shell.duration){shell.done=true;explosion(shell.tx,shell.ty,false,'#d6b56c',1,!shell.friendly);
    blastDamage(shell.tx,shell.ty,30,{safePlayer:shell.friendly,damage:shell.damage});
    if(!shell.friendly&&base&&!base.dead&&Math.hypot(base.x-shell.tx,base.y-shell.ty)<=shell.radius)hitBase(shell.damage);
  }}artilleryShells=artilleryShells.filter(s=>!s.done);
}
