'use strict';
// Танки: создание, движение, столкновения, управление игроком и улучшения.
// Конфигурация — config.js, геометрия окружения — world/destruction.js.
// Функции читают общее состояние игры, keys/mouse и используют её утилиты и эффекты следов.
// Отрисовка и ИИ остаются отдельно. Подключение не запускает игру или обработчики.

function makeTank(x, y, kind) {
  const K = KINDS[kind];
  return {
    x, y, kind, r: 13 * K.scale*(kind==='player'?.9:1), angle: -Math.PI / 2, turret: -Math.PI / 2,
    hp: K.hp, maxHp: K.hp, cd: rnd(.6, 1.4), vx: 0, vy: 0, tread: 0, trackAcc: 0, recoil: 0, flash: 0,
    tx: x, ty: y, stuck: 0, decideT: 0, brick: null, spawnT: 0, inv: 0, rail: 0, armor: false, boostLeft:0, boostCooldown:0, shiftHeld:false,
    upgrade:0, pw: { rapid: 0, shield: 0 },
    // инерция корпуса игрока и плавный коэффициент покрытия; у нового танка всё с нуля
    speedCur:0, turnRate:0, terrainK:1, terrainTarget:1, terrainRate:0,
  };
}

function collideTiles(t) {
  const c0=Math.floor((t.x-t.r)/T),c1=Math.floor((t.x+t.r)/T),r0=Math.floor((t.y-t.r)/T),r1=Math.floor((t.y+t.r)/T);
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++) {
    const type=tileAt(c,r);if(!blocksTank(type))continue;
    const rects=tileRects(c,r,type);
    for(const b of rects){const px=clamp(t.x,b.x,b.x+b.w),py=clamp(t.y,b.y,b.y+b.h),dx=t.x-px,dy=t.y-py,d=Math.hypot(dx,dy);
      if(d>=t.r)continue;
      if(d===0){const sides=[{v:t.x-b.x,dx:-1,dy:0},{v:b.x+b.w-t.x,dx:1,dy:0},{v:t.y-b.y,dx:0,dy:-1},{v:b.y+b.h-t.y,dx:0,dy:1}].sort((a,b)=>a.v-b.v);t.x+=sides[0].dx*(sides[0].v+t.r);t.y+=sides[0].dy*(sides[0].v+t.r);}
      else {t.x+=dx/d*(t.r-d);t.y+=dy/d*(t.r-d);}
    }
  }
}

// Покрытие под центром машины: дорога и песок; мотоцикл на дороге быстрее танка.
function surfaceTarget(t) {
  const c=Math.floor(t.x/T),r=Math.floor(t.y/T);
  if(c<0||r<0||c>=COLS||r>=ROWS)return 1;
  const i=r*COLS+c,who=t.kind==='moto'?'moto':'tank';
  return road&&road[i]?SURFACE_SPEED.road[who]:sand&&sand[i]?SURFACE_SPEED.sand[who]:1;
}
// Линейный переход: от обычной земли к покрытию и обратно — SURFACE_SPEED.blend секунд.
// Скорость перехода задаётся в момент смены покрытия, поэтому смена посреди перехода продолжает с текущего значения.
function surfaceFactor(t,dt) {
  const target=surfaceTarget(t);
  if(t.terrainK===undefined)t.terrainK=1;
  if(target!==t.terrainTarget){t.terrainTarget=target;t.terrainRate=Math.max(Math.abs(target-1),Math.abs(t.terrainK-1))/SURFACE_SPEED.blend;}
  const gap=target-t.terrainK,step=(t.terrainRate||0)*dt;
  t.terrainK=Math.abs(gap)<=step?target:t.terrainK+Math.sign(gap)*step;
  return t.terrainK;
}
// Забор давят танки; мотобригада сохраняет его как препятствие (минирует), смертники ходят через collideTiles.
const crushesFence=t=>t.kind!=='moto';
function crushFences(t) {
  if(!crushesFence(t))return;
  const c0=Math.floor((t.x-t.r)/T),c1=Math.floor((t.x+t.r)/T),r0=Math.floor((t.y-t.r)/T),r1=Math.floor((t.y+t.r)/T);
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++){
    if(c<0||r<0||c>=COLS||r>=ROWS||grid[r*COLS+c]!==FENCE)continue;
    if(fenceRects(c,r).some(b=>Math.hypot(t.x-clamp(t.x,b.x,b.x+b.w),t.y-clamp(t.y,b.y,b.y+b.h))<t.r))hitFence(c,r,t.x,t.y);
  }
}
// limit — наибольший шаг (расстояние до точки маршрута), чтобы ускорение на дороге не проскакивало цель.
function moveTank(t, dx, dy, dt, limit = Infinity) {
  const terrain=surfaceFactor(t,dt);dx*=terrain;dy*=terrain;
  const len=Math.hypot(dx,dy);if(len>limit){dx*=limit/len;dy*=limit/len;}
  const ox = t.x, oy = t.y;
  t.x += dx; crushFences(t); collideTiles(t);
  t.y += dy; crushFences(t); collideTiles(t);
  if(base && !base.dead) {
    const bx=t.x-base.x,by=t.y-base.y,d=Math.hypot(bx,by),min=t.r+base.r;
    if(d<min) {t.x=base.x+(d?bx/d:1)*min;t.y=base.y+(d?by/d:0)*min;}
  }
  const m = Math.hypot(t.x - ox, t.y - oy);
  t.vx = (t.x - ox) / dt; t.vy = (t.y - oy) / dt;
  t.tread = (t.tread + m) % 6;
  t.trackAcc += m;
  if (t.trackAcc > 6) { t.trackAcc = 0; trackMark(t); }
  return m;
}

// ---------- привод корпуса вражеской техники ----------
// Танк ездит только вдоль оси корпуса. Чтобы сменить направление, он разворачивается
// со скоростью KINDS[kind].hullTurn (рад/с): при большом рассогласовании — на месте, при малом — плавно в движении.
// Цель позади и близко (отход из укрытия, сдвиг на клетку назад) — задний ход вместо разворота.
const HULL_ALIGN = .35, HULL_REVERSE = 2, HULL_REVERSE_DIST = 2.2 * T, HULL_REVERSE_SPEED = .6;
const hullTurnRate = t => KINDS[t.kind].hullTurn || 2;

// Поворачивает корпус к углу want; гусеницы проворачиваются и при развороте на месте.
function turnHull(t, want, dt) {
  const before = t.angle;
  t.angle = turnTo(t.angle, want, dt * hullTurnRate(t));
  t.tread = (t.tread + Math.abs(angDiff(before, t.angle)) * t.r) % 6;
  return Math.abs(angDiff(t.angle, want));
}

// Едет к (tx,ty). Возвращает {step, moved}: step — сколько пытался проехать (0 при развороте на месте).
function driveHull(t, tx, ty, speed, dt, allowReverse = true) {
  const dx = tx - t.x, dy = ty - t.y, d = Math.hypot(dx, dy);
  if (d <= .5) { t.vx = t.vy = 0; return { step: 0, moved: 0 }; }
  // последние пиксели до центра клетки — без доворота, иначе танк крутится на месте из-за погрешности
  if (d < 2) { const step = Math.min(d, speed * dt); return { step, moved: moveTank(t, dx / d * step, dy / d * step, dt, d) }; }
  const heading = Math.atan2(dy, dx);
  const reverse = allowReverse && d < HULL_REVERSE_DIST && Math.abs(angDiff(t.angle, heading)) > HULL_REVERSE;
  const off = turnHull(t, reverse ? heading + Math.PI : heading, dt);
  if (off > HULL_ALIGN) { t.vx = t.vy = 0; return { step: 0, moved: 0 }; }
  const dir = reverse ? -1 : 1, step = Math.min(d, speed * dt * (reverse ? HULL_REVERSE_SPEED : 1)) * Math.cos(off);
  return { step, moved: moveTank(t, Math.cos(t.angle) * dir * step, Math.sin(t.angle) * dir * step, dt, d) };
}

function trackMark(t) {
  const s = KINDS[t.kind].scale;
  gctx.save(); gctx.translate(t.x, t.y); gctx.rotate(t.angle);
  gctx.fillStyle = 'rgba(35,28,15,.12)';
  gctx.fillRect(-2, -13 * s, 4, 5 * s); gctx.fillRect(-2, 8 * s, 4, 5 * s);
  gctx.restore();
}

function separate() {
  const all = enemies.filter(e => !e.dead);
  if (player && !player.dead) all.push(player);
  for (const a of allies) if (!a.dead) all.push(a);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
    if (a.dead || b.dead || d >= min) continue;
    // Scripted motorcyclists yield along their road route instead of pushing each other off it.
    if (a.storyWave && b.storyWave && a.kind==='moto' && b.kind==='moto') continue;
    // Наезд игрока или союзника убивает мотобригаду до раздвигания моделей; вражеская техника её не давит.
    const moto=a.kind==='moto'?a:b.kind==='moto'?b:null,other=moto===a?b:a;
    if(moto&&(other===player||other.ally)){hitEnemy(moto,{x:moto.x,y:moto.y,dmg:Infinity,crushed:true});if(moto.dead)continue;}
    if (d === 0) continue;
    const push = (min - d) / 2, nx = dx / d, ny = dy / d;
    const fixedA=a.upgradeT>0||a.entering||a.storyLeaving,fixedB=b.upgradeT>0||b.entering||b.storyLeaving;
    if(!fixedA){a.x-=nx*push*(fixedB?2:1);a.y-=ny*push*(fixedB?2:1);collideTiles(a);}
    if(!fixedB){b.x+=nx*push*(fixedA?2:1);b.y+=ny*push*(fixedA?2:1);collideTiles(b);}
  }
}

function playerMaxHp(tier){return tier>=2?7:tier===1?5:KINDS.player.hp;}

function tankScale(t){return KINDS[t.kind].scale*(t.kind==='player'?(t.upgrade>=2?1.15:t.upgrade>0?1:.9):t.ally&&t.upgrade>=2?1.15:1);}

function setPlayerUpgrade(p,tier,heal=true){p.upgrade=clamp(tier,0,2);p.armor=p.upgrade>0;p.maxHp=p.ally&&p.upgrade===0?KINDS.ally.hp:playerMaxHp(p.upgrade);p.r=13*tankScale(p);if(heal)p.hp=p.maxHp;else p.hp=Math.min(p.hp,p.maxHp);if(p===player&&p.upgrade>=2)items=items.filter(it=>it.type!=='upgrade');}

function beginPlayerUpgrade(p){
  if(p.upgrade>=2||p.upgradeT>0)return;
  p.upgradeFrom=p.upgrade||0;setPlayerUpgrade(p,p.upgradeFrom+1);p.upgradeT=UPGRADE_DURATION;p.upgradeFx=0;p.inv=Math.max(p.inv,UPGRADE_DURATION);p.vx=p.vy=0;p.speedCur=p.turnRate=0;
}

function playerGunLength(t){return (t.upgrade>0?35:30)*(t.upgrade>=2?.8:1);}

function updateTankUpgrade(p,dt) {
  if(!(p.upgradeT>0))return false;
  p.upgradeT=Math.max(0,p.upgradeT-dt);p.inv=Math.max(p.upgradeT,p.inv-dt);p.vx=p.vy=0;p.speedCur=p.turnRate=0;p.upgradeFx-=dt;
  if(p.upgradeFx<=0){p.upgradeFx=.12;burst(p.x,p.y,5,['#fff4bf','#ffd65d','#b2e8ff'],60,.5,2,'spark');}
  return true;
}
function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;
  if(updateTankUpgrade(p,dt))return;
  p.boostCooldown=Math.max(0,p.boostCooldown-dt);
  if(p.boostLeft>0){p.boostLeft=Math.max(0,p.boostLeft-dt);if(!p.boostLeft)p.boostCooldown=10;}
  const shift=!!(keys.ShiftLeft||keys.ShiftRight);
  if((p.boostQueued||(shift&&!p.shiftHeld))&&p.boostLeft<=0&&p.boostCooldown<=0){p.boostLeft=2;sfx('pick');}
  p.boostQueued=false;
  p.shiftHeld=shift;
  const steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  // Корпус разгоняется, тормозит и поворачивается с лёгкой инерцией (PLAYER_INERTIA); башня наводится как прежде.
  // Башня сидит на корпусе: поворот шасси поворачивает и её, а наведение догоняет со своей скоростью.
  p.turnRate=(p.turnRate||0)+(steer*2.2-(p.turnRate||0))*(1-Math.exp(-dt/PLAYER_INERTIA.turn));
  if(!steer&&Math.abs(p.turnRate)<1e-3)p.turnRate=0;
  const hullTurn = p.turnRate * dt;
  p.angle += hullTurn; p.turret += hullTurn;
  const targetSpeed=throttle*KINDS.player.speed*(p.boostLeft>0?2:1);
  p.speedCur=(p.speedCur||0)+(targetSpeed-(p.speedCur||0))*(1-Math.exp(-dt/PLAYER_INERTIA.move));
  if(!throttle&&Math.abs(p.speedCur)<.05)p.speedCur=0;
  p.vx = p.vy = 0;
  if (p.speedCur) {
    const fx=Math.cos(p.angle),fy=Math.sin(p.angle),ox=p.x,oy=p.y;
    moveTank(p,fx*p.speedCur*dt,fy*p.speedCur*dt,dt);
    // после столкновения остаётся только скорость, которую корпус реально прошёл вдоль своей оси
    const along=((p.x-ox)*fx+(p.y-oy)*fy)/((p.terrainK||1)*dt);
    if(Math.sign(along)!==Math.sign(p.speedCur))p.speedCur=0;else if(Math.abs(along)<Math.abs(p.speedCur))p.speedCur=along;
  }
  p.turret = turnTo(p.turret, Math.atan2(mouse.y - p.y, mouse.x - p.x), dt * KINDS.player.turretSpeed);
  p.cd -= dt; p.inv -= dt; p.recoil=(p.recoilMax||5)*(1-reloadProgress(p));
  for (const k in p.pw) p.pw[k] = Math.max(0, p.pw[k] - dt);
  if ((mouse.down || keys.Space && !(raseiniai && raseiniai.blockSpace)) && p.cd <= 0) {
    if (p.railArmed && p.rail > 0) { p.railArmed = false; fireRail(p); }
    else {
      p.railArmed = false;
      fire(p);
      p.cd = p.reloadDuration = KINDS.player.fireRate * (p.pw.rapid > 0 ? .45 : 1);
    }
  }
  p.mgCd = Math.max(0, (p.mgCd || 0) - dt);
  if (mouse.right && p.mgCd <= 0) { fireMachineGun(p, mouse.x, mouse.y); p.mgCd = machineGun(p).interval; }
}
