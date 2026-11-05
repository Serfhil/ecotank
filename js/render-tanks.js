'use strict';
// Модели танков, башен, артиллерии, обломков и индикаторы под танками.
// Использует ctx, конфигурацию, tankScale/playerGunLength, drawFlames и утилиты игры.
// reloadProgress также используется управлением игрока; формулы сохранены.
// Общие player/wrecks/time остаются в игре. Подключение не создаёт модели или Canvas.

function boostProgress(p){return p.boostLeft>0?clamp(p.boostLeft/2,0,1):clamp(1-(p.boostCooldown||0)/10,0,1);}

function recoilOffset(t){if(!Number.isFinite(t.cd))return t.recoil||0;return (t.recoilMax||5)*(t===player?1-reloadProgress(t):clamp(t.cd/enemyInterval(t.kind),0,1));}

function reloadProgress(p) { return clamp(1-Math.max(0,p.cd)/(p.reloadDuration||KINDS.player.fireRate),0,1); }

function drawPlayerModel(t, context = ctx) {
  const ctx = context;
  if(t.kind==='artillery'){drawArtilleryModel(t, ctx);return;}
  const isP=t.kind==='player',ally=t.kind==='ally',heavy=t.kind==='heavy',panther=t.kind==='soldier';
  const base=isP?(t.upgrade>0?'#859053':'#7f8e3e'):ally?'#6f8a43':heavy?'#858c94':panther?'#7c8796':'#89939e';
  const dark=isP||ally?'#3f4c25':'#3e4651',light=isP||ally?'#bac47b':'#b3bac2',flash=t.flash>0;
  ctx.save();ctx.translate(t.x,t.y);ctx.scale(tankScale(t),tankScale(t));ctx.rotate(t.angle+Math.PI/2);if(isP&&t.upgrade>=2)ctx.scale(1.15,1);
  ctx.fillStyle='#161b1c';ctx.fillRect(-16,-17,32,35);
  for(const x of [-16,10]){ctx.fillStyle='#343a3d';ctx.fillRect(x,-16,6,33);for(let y=-16;y<17;y+=5){ctx.fillStyle='#81858b';ctx.fillRect(x,y+(t.tread%5),6,2);}}
  ctx.fillStyle=flash?'#fff':base;
  ctx.beginPath();ctx.moveTo(-9,-17);ctx.lineTo(9,-17);ctx.lineTo(13,-7);ctx.lineTo(12,16);ctx.lineTo(-12,16);ctx.lineTo(-13,-7);ctx.closePath();ctx.fill();
  ctx.fillStyle=light;ctx.fillRect(-12,-16,4,28);ctx.fillRect(8,-16,4,28);
  ctx.fillStyle=dark;ctx.fillRect(-7,5,14,10);ctx.fillRect(-7,-14,14,4);
  ctx.fillStyle=base;for(let y=6;y<15;y+=3)ctx.fillRect(-6,y,12,1);
  if(heavy){ctx.fillStyle='#20262d';for(let x=-7;x<8;x+=3)ctx.fillRect(x,6,1,8);ctx.strokeStyle=light;ctx.strokeRect(-3,9,6,5);}
  if(isP&&t.upgrade>0){ctx.fillStyle='#c3c994';ctx.fillRect(-7,-13,14,3);ctx.fillStyle='#354321';ctx.fillRect(-9,6,18,8);}
  if(isP){ctx.fillStyle='#24331c';ctx.fillRect(-12,10,6,9);ctx.fillRect(6,10,6,9);ctx.fillStyle='#879655';ctx.fillRect(-11,10,4,8);ctx.fillRect(7,10,4,8);ctx.fillStyle='#bfca85';ctx.fillRect(-11,10,4,2);ctx.fillRect(7,10,4,2);}
  ctx.restore();ctx.save();ctx.translate(t.x+(isP?Math.cos(t.angle)*5:0),t.y+(isP?Math.sin(t.angle)*5:0));ctx.scale(tankScale(t),tankScale(t));ctx.rotate(t.turret+Math.PI/2);
  const gunScale=isP&&t.upgrade>=2?.8:1,barrel=-(isP?playerGunLength(t):30)+(!t.dead?recoilOffset(t):t.recoil),offsets=isP&&t.upgrade>=2?[-4,4]:[0];
  for(const off of offsets){ctx.fillStyle='#171d20';ctx.fillRect(off-3,barrel,6,29*gunScale);ctx.fillRect(off-4,barrel-2,8,5);ctx.fillStyle=light;ctx.fillRect(off-1,barrel,3,27*gunScale);}

  const poly=heavy?[[-10,-10],[9,-10],[12,-5],[12,8],[7,12],[-9,12],[-13,6],[-13,-5]]:panther?[[-6,-12],[6,-12],[13,5],[9,12],[-9,12],[-13,5]]:isP?[[-5,-12],[5,-12],[11,4],[7,12],[-7,12],[-11,4]]:[[-7,-10],[7,-10],[11,8],[6,12],[-8,12],[-11,5]];
  ctx.fillStyle=flash?'#fff':base;ctx.strokeStyle='#161c20';ctx.lineWidth=2;ctx.beginPath();if(isP)roundedPolygon(ctx,t.upgrade>0?[[-8,-12],[8,-12],[12,-3],[10,10],[-10,10],[-12,-3]]:poly,.22);else{poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}ctx.fill();ctx.stroke();
  ctx.fillStyle=dark;ctx.fillRect(-6,-3,6,6);ctx.fillRect(3,1,5,5);ctx.fillStyle=light;ctx.fillRect(-5,-4,4,2);ctx.fillRect(4,2,3,2);
  if(isP||ally){ctx.fillStyle='#d55d43';ctx.fillRect(5,5,3,3);}else{ctx.fillStyle='#e0e3df';ctx.fillRect(-2,-7,5,1);ctx.fillRect(0,-9,1,5);}
  ctx.restore();
}

function drawTank(t) {
  const K = KINDS[t.kind], s = tankScale(t);
  ctx.save();
  if(t.spawnT>0)ctx.globalAlpha=clamp(1-t.spawnT,0,1);
  if(t===player && t.inv>0 && Math.floor(time*20)%2)ctx.globalAlpha=.45;
  if(t===player&&t.upgradeT>0){
    const progress=clamp(1-t.upgradeT/UPGRADE_DURATION,0,1),a=ctx.globalAlpha;
    ctx.globalAlpha=a*(1-progress);drawPlayerModel({...t,upgrade:t.upgradeFrom});
    ctx.globalAlpha=a*progress;drawPlayerModel(t);ctx.globalAlpha=a;
    ctx.strokeStyle='#ffe49b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(t.x,t.y,t.r+8+Math.sin(time*9)*3,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#8fdbff88';ctx.beginPath();ctx.arc(t.x,t.y,t.r+15,0,Math.PI*2*progress);ctx.stroke();
  }else drawPlayerModel(t);ctx.restore();
  if((t===player||t.kind==='soldier'||t.kind==='heavy') && t.hp<t.maxHp && t.spawnT<=0) {
    ctx.fillStyle='#282323aa';ctx.beginPath();ctx.ellipse(t.x-6,t.y-12,6,11,0,0,Math.PI*2);ctx.fill();
    drawFlames(t.x-6,t.y+2,t.hp/t.maxHp<=.5?1:.65);
  }
  if(t===player) {
    const progress=boostProgress(t),y=t.y+t.r+7;
    ctx.fillStyle='#0b151be0';ctx.fillRect(t.x-11,y,22,4);
    ctx.fillStyle=t.boostLeft>0?'#7cd6ed':progress>=1?'#a6e67a':'#f1c56b';ctx.fillRect(t.x-10,y+1,20*progress,2);
  }
  if (t === player && t.pw.shield > 0) {
    const a = t.pw.shield < 2 && Math.floor(time * 8) % 2 ? .15 : .5;
    ctx.strokeStyle = `rgba(140,240,160,${a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 7 + Math.sin(time * 6), 0, Math.PI * 2); ctx.stroke();
  }
  if (t.ally) {
    ctx.fillStyle = '#9be36f'; ctx.beginPath();
    ctx.moveTo(t.x - 5, t.y - t.r - 11); ctx.lineTo(t.x + 5, t.y - t.r - 11); ctx.lineTo(t.x, t.y - t.r - 5); ctx.closePath(); ctx.fill();
  }
  if (t !== player && t.spawnT <= 0 && t.hp < t.maxHp) {
    const w = 26 * s;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(t.x - w / 2, t.y - t.r - 9, w, 4);
    ctx.fillStyle = '#ff6b5a'; ctx.fillRect(t.x - w / 2, t.y - t.r - 9, w * t.hp / t.maxHp, 4);
  }
}

function drawWrecks() {
  for (const w of wrecks) {
    if(w.exploded===false) {
      ctx.save();ctx.filter='brightness(40%)';drawPlayerModel(w);ctx.restore();
      drawFlames(w.x,w.y,.9);
      continue;
    }
    const K = KINDS[w.kind], s = K.scale;
    ctx.save();
    ctx.translate(w.x, w.y);
    const pulse = .25 + .2 * Math.sin(time * 4 + w.x);
    ctx.strokeStyle = `rgba(217,194,122,${pulse})`; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, 19 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.scale(s, s);
    ctx.save();
    ctx.rotate(w.angle);
    ctx.fillStyle = '#1b1c1d';
    ctx.fillRect(-15, -15, 27, 7); ctx.fillRect(-13, 8, 30, 7);
    ctx.fillStyle = '#3a3532'; roundRect(ctx, -13, -9, 26, 18, 3); ctx.fill();
    ctx.fillStyle = K.dark; ctx.globalAlpha = .35; ctx.fillRect(-11, -7, 15, 9); ctx.globalAlpha = 1;
    ctx.restore();
    ctx.rotate(w.turret);
    ctx.translate(3, 2);
    ctx.fillStyle = '#2a2624'; ctx.fillRect(2, -2.5, 12, 5);
    ctx.fillStyle = '#423b36'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (w.exploded!==false && w.age-(w.blastAge||0) < 2) {
      const burnAge=Math.max(0,w.age-(w.blastAge||0));drawFlames(w.x,w.y,1-burnAge/2);
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(time * 13 + i * 2.1 + w.x) * .5 + .5;
        ctx.fillStyle = `rgba(255,${120 + f * 80 | 0},40,${clamp(1-burnAge/2,0,1)*f})`;
        ctx.beginPath(); ctx.arc(w.x + (i - 1) * 6, w.y + Math.sin(i * 3) * 5, 2 + f * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

function drawArtilleryModel(t, context = ctx){
  const ctx = context;
  ctx.save();ctx.translate(t.x,t.y);ctx.scale(tankScale(t),tankScale(t));ctx.rotate(t.angle+Math.PI/2);
  ctx.fillStyle='#171c1c';ctx.fillRect(-16,-19,32,40);ctx.fillStyle='#62676a';for(let y=-18;y<20;y+=5){ctx.fillRect(-16,y,5,2);ctx.fillRect(11,y,5,2);}
  ctx.fillStyle=t.flash>0?'#fff':'#d5be7d';ctx.fillRect(-11,-18,22,35);
  if(!(t.flash>0)){ctx.fillStyle='#566048';ctx.beginPath();ctx.moveTo(-11,-15);ctx.lineTo(-3,-18);ctx.lineTo(4,-9);ctx.lineTo(1,2);ctx.lineTo(-11,5);ctx.closePath();ctx.fill();ctx.fillStyle='#944b36';ctx.beginPath();ctx.moveTo(4,-18);ctx.lineTo(11,-18);ctx.lineTo(11,-3);ctx.lineTo(6,2);ctx.lineTo(2,-7);ctx.closePath();ctx.fill();ctx.fillStyle='#944b36';ctx.fillRect(-10,11,8,7);}
  ctx.fillStyle='#e7d49e';ctx.fillRect(-12,-18,24,3);
  // Open rear fighting compartment and exposed breech distinguish the Hummel-inspired silhouette.
  ctx.fillStyle='#3f3b30';ctx.fillRect(-9,-4,18,22);ctx.strokeStyle='#d0bc88';ctx.lineWidth=3;ctx.strokeRect(-10,-5,20,24);
  ctx.strokeStyle='#566048';ctx.beginPath();ctx.moveTo(-10,-3);ctx.lineTo(-10,7);ctx.moveTo(10,11);ctx.lineTo(10,18);ctx.stroke();ctx.strokeStyle='#944b36';ctx.beginPath();ctx.moveTo(-6,19);ctx.lineTo(3,19);ctx.moveTo(10,-3);ctx.lineTo(10,5);ctx.stroke();
  ctx.fillStyle='#77715a';ctx.fillRect(-4,-3,8,16);ctx.fillStyle='#dad3ac';ctx.fillRect(-8,10,3,6);ctx.fillRect(6,8,3,7);ctx.restore();
  ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.turret+Math.PI/2);const recoil=recoilOffset(t);ctx.fillStyle='#302f2b';ctx.fillRect(-4,-35+recoil,8,35);ctx.fillStyle='#d5be7d';ctx.fillRect(-2,-34+recoil,4,31);ctx.fillStyle='#566048';ctx.fillRect(-2,-29+recoil,4,7);ctx.fillStyle='#944b36';ctx.fillRect(-2,-18+recoil,4,5);ctx.fillStyle='#877a53';ctx.fillRect(-6,-5,12,10);ctx.restore();
}
