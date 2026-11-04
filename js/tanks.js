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

function moveTank(t, dx, dy, dt) {
  const terrain=sand[Math.floor(t.y/T)*COLS+Math.floor(t.x/T)]?.5:1;dx*=terrain;dy*=terrain;
  const ox = t.x, oy = t.y;
  t.x += dx; collideTiles(t);
  t.y += dy; collideTiles(t);
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
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
    if (d >= min || d === 0) continue;
    const push = (min - d) / 2, nx = dx / d, ny = dy / d;
    const fixedA=a===player&&a.upgradeT>0,fixedB=b===player&&b.upgradeT>0;
    if(!fixedA){a.x-=nx*push*(fixedB?2:1);a.y-=ny*push*(fixedB?2:1);collideTiles(a);}
    if(!fixedB){b.x+=nx*push*(fixedA?2:1);b.y+=ny*push*(fixedA?2:1);collideTiles(b);}
  }
}

function playerMaxHp(tier){return tier>=2?7:tier===1?5:KINDS.player.hp;}

function tankScale(t){return KINDS[t.kind].scale*(t.kind==='player'?(t.upgrade>=2?1.15:t.upgrade>0?1:.9):1);}

function setPlayerUpgrade(p,tier,heal=true){p.upgrade=clamp(tier,0,2);p.armor=p.upgrade>0;p.maxHp=playerMaxHp(p.upgrade);p.r=13*tankScale(p);if(heal)p.hp=p.maxHp;else p.hp=Math.min(p.hp,p.maxHp);if(p.upgrade>=2)items=items.filter(it=>it.type!=='upgrade');}

function beginPlayerUpgrade(p){
  if(p.upgrade>=2||p.upgradeT>0)return;
  p.upgradeFrom=p.upgrade||0;setPlayerUpgrade(p,p.upgradeFrom+1);p.upgradeT=UPGRADE_DURATION;p.upgradeFx=0;p.inv=Math.max(p.inv,UPGRADE_DURATION);p.vx=p.vy=0;
}

function playerGunLength(t){return (t.upgrade>0?35:30)*(t.upgrade>=2?.8:1);}

function updatePlayer(dt) {
  const p = player;
  if (p.dead) return;
  if(p.upgradeT>0){
    p.upgradeT=Math.max(0,p.upgradeT-dt);p.inv=Math.max(p.upgradeT,p.inv-dt);p.vx=p.vy=0;p.upgradeFx-=dt;
    if(p.upgradeFx<=0){p.upgradeFx=.12;burst(p.x,p.y,5,['#fff4bf','#ffd65d','#b2e8ff'],60,.5,2,'spark');}
    return;
  }
  p.boostCooldown=Math.max(0,p.boostCooldown-dt);
  if(p.boostLeft>0){p.boostLeft=Math.max(0,p.boostLeft-dt);if(!p.boostLeft)p.boostCooldown=10;}
  const shift=!!(keys.ShiftLeft||keys.ShiftRight);
  if((p.boostQueued||(shift&&!p.shiftHeld))&&p.boostLeft<=0&&p.boostCooldown<=0){p.boostLeft=2;sfx('pick');}
  p.boostQueued=false;
  p.shiftHeld=shift;
  const steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  p.angle += steer * 2.2 * dt;
  p.vx = p.vy = 0;
  if (throttle) moveTank(p, Math.cos(p.angle)*throttle*KINDS.player.speed*(p.boostLeft>0?2:1)*dt, Math.sin(p.angle)*throttle*KINDS.player.speed*(p.boostLeft>0?2:1)*dt, dt);
  p.turret = turnTo(p.turret, Math.atan2(mouse.y - p.y, mouse.x - p.x), dt * KINDS.player.turretSpeed);
  p.cd -= dt; p.inv -= dt; p.recoil=(p.recoilMax||5)*(1-reloadProgress(p));
  for (const k in p.pw) p.pw[k] = Math.max(0, p.pw[k] - dt);
  if ((mouse.down || keys.Space) && p.cd <= 0) {
    fire(p);
    p.cd = p.reloadDuration = KINDS.player.fireRate * (p.pw.rapid > 0 ? .45 : 1);
  }
}
