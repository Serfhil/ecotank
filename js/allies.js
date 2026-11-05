'use strict';
// Союзные танки: появление в нижней четверти карты, собственные поля путей, выбор целей и стрельба.
// Включаются флагом CFG.allies из настроек разработчика. Используют геометрию world/destruction.js,
// движение tanks.js, оружие weapons.js и los/coverClear из enemy-ai.js; общий flow врагов не трогают.
// Массив allies принадлежит состоянию игры в index.html. Подключение файла ничего не создаёт.

// Кирпичи обороны базы союзники не ломают и не считают проходом.
const baseWall=(c,r)=>!!base&&r>=ROWS-2&&Math.abs(c-Math.floor(COLS/2))<=1;

// Клетки, достижимые танком от старта игрока: союзник не должен появиться в замкнутом кармане.
function reachableFromStart() {
  const seen=new Uint8Array(COLS*ROWS),c0=clamp(Math.floor(PLAYER_START.x/T),0,COLS-1),r0=clamp(Math.floor(PLAYER_START.y/T),0,ROWS-1),q=[r0*COLS+c0];
  seen[q[0]]=1;
  for(let h=0;h<q.length;h++){
    const i=q[h],c=i%COLS,r=(i/COLS)|0;
    for(const [dc,dr] of DIRS){const nc=c+dc,nr=r+dr;if(blocksTank(tileAt(nc,nr)))continue;const j=nr*COLS+nc;if(!seen[j]){seen[j]=1;q.push(j);}}
  }
  return seen;
}

function spawnAllies() {
  allies=[];
  if(!CFG.allies)return;
  const reach=reachableFromStart(),cells=[];
  for(let r=Math.floor(ROWS*3/4);r<ROWS;r++)for(let c=0;c<COLS;c++){
    const x=c*T+16,y=r*T+16;
    if(!reach[r*COLS+c]||!coverClear(x,y,14))continue;
    if(Math.hypot(x-PLAYER_START.x,y-PLAYER_START.y)<56||(base&&Math.hypot(x-base.x,y-base.y)<base.r+40))continue;
    cells.push({x,y});
  }
  for(let i=cells.length-1;i>0;i--){const j=ri(0,i);[cells[i],cells[j]]=[cells[j],cells[i]];}
  for(const q of cells){
    if(allies.length>=CFG.allyCount)break;
    if(allies.some(a=>Math.hypot(a.x-q.x,a.y-q.y)<56))continue;
    const a=makeTank(q.x,q.y,'ally');
    a.ally=true;a.repathT=0;a.cd=rnd(.5,1.2);
    allies.push(a);
  }
}

// Поле расстояний союзника; без противника он не ломает стены, а обходит их.
// Клетки других союзников и их ближайшие цели дороже, чтобы пути расходились, а не шли гуськом.
function buildAllyFlow(a,tc,tr,breakWalls) {
  const busy=new Uint8Array(COLS*ROWS);
  for(const o of allies)if(o!==a&&!o.dead)for(const [x,y] of [[o.x,o.y],[o.tx,o.ty]]){
    const c=Math.floor(x/T),r=Math.floor(y/T);if(c>=0&&r>=0&&c<COLS&&r<ROWS)busy[r*COLS+c]=1;
  }
  const f=a.flow&&a.flow.length===COLS*ROWS?a.flow:(a.flow=new Int32Array(COLS*ROWS));
  f.fill(1e9);
  const s=tr*COLS+tc,q=[s];
  f[s]=0;
  for(let h=0;h<q.length;h++){
    const i=q[h],c=i%COLS,r=(i/COLS)|0;
    for(const [dc,dr] of DIRS){
      const nc=c+dc,nr=r+dr,t=tileAt(nc,nr);
      if(t===STEEL||t===WATER||baseWall(nc,nr)||(!breakWalls&&breakable(t)))continue;
      const j=nr*COLS+nc,nd=f[i]+(t===BRICK?5:t===FENCE?3:1)+busy[j]*6;
      if(nd<f[j]){f[j]=nd;q.push(j);}
    }
  }
}

function allyStep(a,random) {
  const c=Math.floor(a.x/T),r=Math.floor(a.y/T),f=a.flow,opts=[];
  for(const [dc,dr] of DIRS){
    const nc=c+dc,nr=r+dr,t=tileAt(nc,nr),v=f[nr*COLS+nc];
    if(t===STEEL||t===WATER||baseWall(nc,nr)||v>=1e9||(random&&breakable(t)))continue;
    opts.push({nc,nr,t,v});
  }
  a.brick=null;
  if(!opts.length){a.tx=c*T+16;a.ty=r*T+16;return;}
  const pick=random?opts[ri(0,opts.length-1)]:opts.reduce((p,q)=>q.v<p.v?q:p);
  if(!random&&pick.v>=f[r*COLS+c]){a.tx=c*T+16;a.ty=r*T+16;return;}
  if(breakable(pick.t)){a.brick={x:pick.nc*T+16,y:pick.nr*T+16};a.tx=c*T+16;a.ty=r*T+16;}
  else {a.tx=pick.nc*T+16;a.ty=pick.nr*T+16;}
}

const allyFoes=()=>enemies.filter(e=>!e.dead&&!e.entering&&e.spawnT<=0);

// Цель движения: ближайший противник, причём уже выбранные другими союзниками цели
// считаются дальше — союзники расходятся по разным врагам. Без врагов союзник стоит на месте.
function allyGoal(a,foes) {
  let best=null,bd=1e9;
  for(const e of foes){
    const taken=allies.some(o=>o!==a&&!o.dead&&o.goal===e),d=Math.hypot(e.x-a.x,e.y-a.y)+(taken?200:0);
    if(d<bd){best=e;bd=d;}
  }
  a.goal=best;
  return best||{x:a.x,y:a.y,idle:true};
}

// Не стрелять, если снаряд по линии ствола может попасть в свою базу.
function shotHitsBase(a) {
  if(!base||base.dead)return false;
  const dx=Math.cos(a.turret)*900,dy=Math.sin(a.turret)*900,l=dx*dx+dy*dy;
  const k=clamp(((base.x-a.x)*dx+(base.y-a.y)*dy)/l,0,1);
  return Math.hypot(a.x+dx*k-base.x,a.y+dy*k-base.y)<base.r+8;
}

function updateAlly(a,dt) {
  const K=KINDS.ally;
  a.flash-=dt;a.cd-=dt;a.inv-=dt;a.decideT-=dt;a.repathT-=dt;
  a.recoil=(a.recoilMax||5)*clamp(a.cd/K.fireRate,0,1);
  const foes=allyFoes();
  let foe=null,fd=1e9;
  for(const e of foes){
    const d=Math.hypot(e.x-a.x,e.y-a.y),hidden=tileAt(Math.floor(e.x/T),Math.floor(e.y/T))===TREE&&d>CFG.treeStealth;
    if(d<fd&&!hidden&&d<CFG.enemySight&&los(a.x,a.y,e.x,e.y)){foe=e;fd=d;}
  }
  const goal=allyGoal(a,foes);
  if(a.repathT<=0&&!goal.idle){a.repathT=.5;buildAllyFlow(a,clamp(Math.floor(goal.x/T),0,COLS-1),clamp(Math.floor(goal.y/T),0,ROWS-1),true);}

  if(a.stuck>.7&&!goal.idle){a.stuck=0;allyStep(a,true);a.decideT=.5;}
  else if(!goal.idle&&Math.hypot(a.tx-a.x,a.ty-a.y)<1.5&&a.decideT<=0){allyStep(a,false);a.decideT=a.brick?.35:0;}
  if(goal.idle)a.brick=null;
  const hold=goal.idle||(foe&&fd<K.hold);
  const mx=a.tx-a.x,my=a.ty-a.y,md=Math.hypot(mx,my);
  a.vx=a.vy=0;
  if(!hold&&md>.5){
    const step=Math.min(md,K.speed*dt);
    a.angle=turnTo(a.angle,Math.atan2(my,mx),dt*8);
    const moved=moveTank(a,mx/md*step,my/md*step,dt);
    if(step>.5&&moved<step*.3)a.stuck+=dt;else a.stuck=Math.max(0,a.stuck-dt);
  }

  let target=null;
  if(foe){const lead=fd/K.bulletSpeed*.6;target={x:foe.x+(foe.vx||0)*lead,y:foe.y+(foe.vy||0)*lead};}
  else if(a.brick)target=a.brick;
  const aim=target?Math.atan2(target.y-a.y,target.x-a.x):a.angle;
  a.turret=turnTo(a.turret,aim,dt*K.turretSpeed);
  if(target&&a.cd<=0&&Math.abs(angDiff(a.turret,aim))<.12&&!shotHitsBase(a)){fire(a);a.cd=K.fireRate;}
}

function hitAlly(a,b) {
  if(a.dead||a.inv>0)return;
  a.hp-=b.dmg;a.flash=.13;
  burst(b.x,b.y,14,['#fff4bd','#ffb650','#d7e6ed'],220,.3,3,'spark');
  if(a.hp>0){sfx('hit');return;}
  a.dead=true;shake=Math.max(shake,4);
  floatText(a.x,a.y-10,UI_TEXT.soyuznik_podbit,'#ff9a7a');
  wrecks.push({x:a.x,y:a.y,kind:'ally',angle:a.angle,turret:a.turret,tread:a.tread,recoil:a.recoil,flash:0,age:0,smokeT:0,taken:true,detonateAt:rnd(.5,1.5)*(b.blast?.5:1),exploded:false});
}
