'use strict';
// Оружие: обычные и бронебойные снаряды, рельсотрон, артиллерийские полёты и очереди залпа.
// Функции используют общие bullets/rails/artilleryShells и очереди из состояния игры,
// геометрию окружения, модули tanks/damage и sfx/burst/floatText из звука и эффектов.
// Порядок вызовов задаёт игровой цикл; ИИ артиллерии и отрисовка остаются в игре.

let supportClock=0,supportLaunch=-Infinity,supportImpact=-Infinity,supportSoundAt=0;
function resetArtillery(){supportClock=0;supportLaunch=supportImpact=-Infinity;supportSoundAt=0;artilleryShells=[];barrageMarkers=[];barrageTrajectories=[];barrageSoundShots=0;barrageFrame=0;}

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

function fireRail(p) {
  if (!p || p.dead || p.upgradeT>0 || p.rail <= 0) return;
  p.rail--;
  const dx = Math.cos(p.turret), dy = Math.sin(p.turret);
  const muzzle=vehicleMuzzle(p,vehicleMount(p).offsets[0]),x0=muzzle.x,y0=muzzle.y,hit=new Set();
  carveSteelRay(x0,y0,x0+dx*1400,y0+dy*1400);
  let len = 0; const foliageRay = {};
  for (; len < 1400; len += 4) {
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
    const a=bullets[i],b=bullets[j];if(a.dead||b.dead||(a.owner===b.owner&&!!a.armor===!!b.armor))continue;
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
      if(t===TREE)hitFoliage(c,r,nx,ny,b);
      const impact=bulletBlockingCell(nx,ny,b.r);
      if(impact) {
        const {c,r,type:t}=impact;
        // бронебойный пролетает забор насквозь, не тратя пробитие кирпича
        if(t===FENCE&&b.armor){hitFence(c,r,nx,ny);}
        else if(t===FENCE){hitFence(c,r,nx,ny);b.dead=true;continue;}
        else if(t===BRICK&&b.armor&&!b.brickPierced){hitBrick(c,r,99,nx,ny);b.brickPierced=true;}
        else {if(t===BRICK)hitBrick(c,r,1,nx,ny);else burst(nx,ny,6,['#e8eef2'],120,.25,2);b.dead=true;continue;}
      }
      b.x=nx;b.y=ny;
      if(base&&!base.dead&&Math.hypot(b.x-base.x,b.y-base.y)<base.r+b.r){hitBase(b.dmg);b.dead=true;continue;}
      if(b.owner==='p'){for(const e of enemies){if(!e.dead&&e.spawnT<=0&&Math.hypot(e.x-b.x,e.y-b.y)<e.r+b.r){hitEnemy(e,b);b.dead=true;break;}}}
      else if(player&&!player.dead&&Math.hypot(player.x-b.x,player.y-b.y)<player.r+b.r){hitPlayer(b);b.dead=true;}
      else for(const a of allies){if(!a.dead&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r){hitAlly(a,b);b.dead=true;break;}}
    }
    collideShells();
  }
  bullets=bullets.filter(b=>!b.dead);
}

function launchArtillery(sx,sy,tx,ty,friendly=false){
  const speed=friendly?3000:KINDS.artillery.bulletSpeed;
  const shell={sx,sy,tx:clamp(tx,0,W),ty:clamp(ty,0,H),age:0,delay:friendly?2:0,speed,friendly,radius:45,damage:2};
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

function updateArtilleryShells(dt){
  processBarrageFrame(dt);
  for(const shell of artilleryShells){shell.age=shell.friendly&&shell.createdAt!==undefined?supportClock-shell.createdAt:shell.age+dt;if(!shell.pending&&shell.age>=shell.delay+shell.duration){shell.done=true;explosion(shell.tx,shell.ty,false,'#d6b56c',1,!shell.friendly);
    blastDamage(shell.tx,shell.ty,30,{safePlayer:shell.friendly,damage:shell.damage});
    if(!shell.friendly&&base&&!base.dead&&Math.hypot(base.x-shell.tx,base.y-shell.ty)<=shell.radius)hitBase(shell.damage);
  }}artilleryShells=artilleryShells.filter(s=>!s.done);
}
