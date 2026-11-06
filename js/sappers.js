'use strict';
// Мотоцикл-минёр, мины, подрывные заряды и смертники в зелени.
// Мотоцикл живёт в enemies (kind 'moto'): получает урон, очки и обломки как техника,
// но ведёт себя по updateMoto. Смертники и мины — отдельные массивы этого модуля.
// Использует flow/buildFlow/decide из enemy-ai.js, moveTank/collideTiles из tanks.js,
// blastDamage/hitBase из damage.js и explosion/burst из effects.js.
// Подключение не трогает DOM, Canvas или состояние игры; картинки грузит initSapperSprites.

let bombers=[],mines=[],mineFx=[];

const BOMBER_TRIGGER=5*T,BOMBER_RADIUS=6,MINE_DAMAGE=2,MINES_PER_MOTO=3;
const CHARGE_FUSE=2.5,MOTO_DROP_TIME=.8,MINE_FX_TIME=.7;

// ---------- спрайты ----------
const SAPPER_FILES={bomber:'assets/vehicles/suicide-bomber.png',moto:'assets/vehicles/motorcycle-miner.png',mine:'assets/vehicles/mine.png'};
let sapperImages=null;
function initSapperSprites(){
  if(sapperImages||typeof Image!=='function')return;
  sapperImages={};
  for(const [key,src]of Object.entries(SAPPER_FILES)){
    const entry=sapperImages[key]={image:new Image(),loaded:false};
    entry.image.onload=()=>{entry.loaded=entry.image.naturalWidth>0;};entry.image.onerror=()=>{entry.loaded=false;};
    entry.image.src=src;
  }
}
const sapperSprite=key=>sapperImages&&sapperImages[key]&&sapperImages[key].loaded?sapperImages[key].image:null;

// ---------- смертники ----------
// Вызывается после генерации карты: в каждой клетке зелени смертник сидит с шансом CFG.bomberChance.
// Клетки у старта игрока пропускаются, иначе засада срабатывала бы в первый же кадр волны.
function placeBombers(){
  bombers=[];mines=[];mineFx=[];
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
    if(grid[r*COLS+c]!==TREE)continue;
    const x=c*T+16,y=r*T+16;
    if(Math.hypot(x-PLAYER_START.x,y-PLAYER_START.y)<=BOMBER_TRIGGER+T)continue;
    if(Math.random()<CFG.bomberChance)bombers.push({x,y,r:BOMBER_RADIUS,c,row:r,state:'hidden',fuse:0,angle:Math.PI/2,walk:0,sparkT:0,pathT:0,path:null,target:null});
  }
}

const friendlyTanks=()=>[player,...allies].filter(t=>t&&!t.dead);

function igniteBomber(b){
  if(b.state!=='hidden')return;
  b.state='lit';b.fuse=CFG.bomberFuse;b.pathT=0;
  burst(b.x,b.y,10,['#6fa447','#9cba52','#355d2e'],90,.5,3,'leaf');sfx('leaves');sfx('fuse');
}

// Пешеход обходит стены, воду и сталь; зелень проходима.
function walkable(c,r){const t=tileAt(c,r);return t===EMPTY||t===TREE;}
function walkFlow(tc,tr){
  const dist=new Int32Array(COLS*ROWS).fill(1e9),start=tr*COLS+tc,q=[start];
  if(tc<0||tr<0||tc>=COLS||tr>=ROWS)return dist;
  dist[start]=0;
  for(let h=0;h<q.length;h++){const i=q[h],c=i%COLS,r=(i/COLS)|0;
    for(const [dc,dr]of DIRS){const nc=c+dc,nr=r+dr;if(!walkable(nc,nr))continue;const j=nr*COLS+nc;if(dist[j]>dist[i]+1){dist[j]=dist[i]+1;q.push(j);}}}
  return dist;
}

function updateBomber(b,dt){
  if(b.state==='hidden'){
    const exposed=grid[b.row*COLS+b.c]!==TREE;
    if(exposed||friendlyTanks().some(t=>Math.hypot(t.x-b.x,t.y-b.y)<=BOMBER_TRIGGER))igniteBomber(b);
    return;
  }
  b.fuse-=dt;
  if(b.fuse<=0){detonateBomber(b);return;}
  b.sparkT-=dt;
  if(b.sparkT<=0){b.sparkT=.06;const a=b.angle;parts.push({x:b.x+Math.cos(a)*3,y:b.y+Math.sin(a)*3,vx:rnd(-40,40),vy:rnd(-60,-10),life:.25,max:.25,size:rnd(1,2.2),color:'#ffd76a',kind:'spark'});}
  const targets=friendlyTanks();if(!targets.length)return;
  const target=targets.reduce((a,t)=>Math.hypot(t.x-b.x,t.y-b.y)<Math.hypot(a.x-b.x,a.y-b.y)?t:a);
  const d=Math.hypot(target.x-b.x,target.y-b.y);
  if(d<=target.r+b.r+2){detonateBomber(b);return;} // контакт с танком — взрыв сразу
  b.pathT-=dt;
  if(b.pathT<=0||b.target!==target){b.pathT=.3;b.target=target;b.path=walkFlow(Math.floor(target.x/T),Math.floor(target.y/T));}
  let gx=target.x,gy=target.y;
  const c=Math.floor(b.x/T),r=Math.floor(b.y/T),here=b.path[r*COLS+c];
  if(here>1&&here<1e9){
    let best=null;
    for(const [dc,dr]of DIRS){const v=b.path[(r+dr)*COLS+c+dc];if(walkable(c+dc,r+dr)&&v<here&&(!best||v<best.v))best={v,c:c+dc,r:r+dr};}
    if(best){gx=best.c*T+16;gy=best.r*T+16;}
  }
  const mx=gx-b.x,my=gy-b.y,md=Math.hypot(mx,my);if(md<.5)return;
  const step=Math.min(md,CFG.bomberSpeed*dt);
  b.angle=Math.atan2(my,mx);
  const ox=b.x,oy=b.y;b.x+=mx/md*step;b.y+=my/md*step;collideTiles(b);
  b.walk+=Math.hypot(b.x-ox,b.y-oy);
}

function detonateBomber(b,byPlayer=false){
  if(b.state==='dead'||b.state==='down')return;
  b.state='dead';
  if(byPlayer){score+=BOMBER_SCORE;floatText(b.x,b.y-10,'+'+BOMBER_SCORE,'#ffe08a');recordStatistic('enemies','bomber');}
  mineFx.push({x:b.x,y:b.y,age:0,size:44});
  explosion(b.x,b.y,false,'#7b2a20',1);
  blastDamage(b.x,b.y,30,{damage:MINE_DAMAGE});
}
const BOMBER_SCORE=150;

// Убитый выстрелом смертник падает, динамит не взрывается. Тело лежит BOMBER_BODY_TIME секунд.
const BOMBER_BODY_TIME=2;
function killBomber(b){
  b.state='down';b.age=0;
  score+=BOMBER_SCORE;floatText(b.x,b.y-10,'+'+BOMBER_SCORE,'#ffe08a');recordStatistic('enemies','bomber');
  burst(b.x,b.y,6,['#6b5e48','#4a4536'],70,.35,2,'debris');sfx('hit');
}

// Попадание снаряда или пули игрока либо союзника убивает видимого смертника.
function shootBomber(x,y,radius){
  for(const b of bombers)if(b.state==='lit'&&Math.hypot(b.x-x,b.y-y)<b.r+radius){killBomber(b);return true;}
  return false;
}
// Любой взрыв рядом подрывает динамит (в том числе у ещё не вышедших из зелени) и мины.
// Флаги dead/done ставятся до взрыва, поэтому цепочка конечна.
function sapperBlast(x,y,radius){
  for(const b of bombers)if((b.state==='hidden'||b.state==='lit')&&Math.hypot(b.x-x,b.y-y)<=radius)detonateBomber(b);
  for(const m of mines)if(!m.done&&m.kind==='mine'&&Math.hypot(m.x-x,m.y-y)<=radius)detonateMine(m);
}

// ---------- мотоцикл-минёр ----------
function initMoto(e){
  e.mode=base&&!base.dead&&Math.random()<.5?'base':'field';
  e.minesLeft=MINES_PER_MOTO;e.dropT=0;e.charge=null;e.mineSpot=null;e.leaving=false;
}

function motoSpeed(){return KINDS.moto.speed*(1+Math.min(wave,10)*CFG.enemySpeedPerWave);}

function driveMoto(e,dt,speed=motoSpeed()){
  const mx=e.tx-e.x,my=e.ty-e.y,md=Math.hypot(mx,my);
  if(md<=.5){e.vx=e.vy=0;return;}
  const step=Math.min(md,speed*dt);
  e.angle=turnTo(e.angle,Math.atan2(my,mx),dt*8);
  const moved=moveTank(e,mx/md*step,my/md*step,dt);
  if(step>.5&&moved<step*.3)e.stuck+=dt;else e.stuck=Math.max(0,e.stuck-dt);
}

// Точка для мины: свободная достижимая клетка в середине поля, не у базы и не рядом с другими минами.
function pickMineSpot(e){
  for(let attempt=0;attempt<40;attempt++){
    const c=ri(1,COLS-2),r=ri(3,ROWS-4),x=c*T+16,y=r*T+16;
    if(tileAt(c,r)!==EMPTY||reservedCell(COLS,c,r))continue;
    if(base&&Math.hypot(base.x-x,base.y-y)<4*T)continue;
    if(mines.some(m=>Math.hypot(m.x-x,m.y-y)<3*T))continue;
    buildFlow(c,r);
    if(flow[Math.floor(e.y/T)*COLS+Math.floor(e.x/T)]>=1e9)continue;
    return {c,r,x,y};
  }
  return null;
}

function startDrop(e,what){e.dropT=MOTO_DROP_TIME;e.dropWhat=what;e.dropped=false;e.vx=e.vy=0;}

function plantCharge(e,what){
  if(what.kind==='mine'){
    // Мина ложится у правого заднего колеса коляски, как на спрайте.
    const right=e.angle+Math.PI/2,x=e.x+Math.cos(right)*12-Math.cos(e.angle)*10,y=e.y+Math.sin(right)*12-Math.sin(e.angle)*10;
    mines.push({kind:'mine',x:clamp(x,8,W-8),y:clamp(y,8,H-8),age:0});e.minesLeft--;sfx('mineDrop');
    return;
  }
  const charge={kind:'charge',x:what.x,y:what.y,age:0,fuse:CHARGE_FUSE,target:what.target,c:what.c,r:what.r};
  mines.push(charge);e.charge=charge;sfx('fuse');
  // Отъезд на безопасное расстояние от заряда, обратно по направлению подъезда.
  const away=Math.atan2(e.y-what.y,e.x-what.x);
  for(const dist of [64,48,32]){const x=what.x+Math.cos(away)*dist,y=what.y+Math.sin(away)*dist;if(coverClear(x,y,e.r)){e.tx=x;e.ty=y;break;}}
}

function updateMoto(e,dt){
  if(e.mode===undefined)initMoto(e);
  if(e.dropT>0){
    e.dropT-=dt;e.vx=e.vy=0;
    if(!e.dropped&&e.dropT<=MOTO_DROP_TIME/2){e.dropped=true;plantCharge(e,e.dropWhat);}
    return;
  }
  if(e.charge){ // ждёт подрыва стены или базы на безопасном расстоянии
    if(e.charge.done){e.charge=null;e.decideT=0;e.tx=e.x;e.ty=e.y;if(e.mode==='base'&&(!base||base.dead||e.baseMined))e.leaving=true;}
    else {driveMoto(e,dt);return;}
  }
  if(e.mode==='base'&&(!base||base.dead))e.mode='field';
  if(e.mode==='field'&&e.minesLeft<=0)e.leaving=true;

  if(e.leaving){
    const exit=SPAWNS.reduce((a,s)=>Math.abs(s.c*T+16-e.x)<Math.abs(a.c*T+16-e.x)?s:a,SPAWNS[0]);
    // У точки появления уезжает за верхний край так же, как враги въезжают: без столкновений с границей.
    if(Math.floor(e.y/T)<=exit.r&&Math.abs(e.x-(exit.c*T+16))<8){e.x=exit.c*T+16;e.angle=turnTo(e.angle,-Math.PI/2,dt*8);e.y-=motoSpeed()*dt;e.tread=(e.tread+motoSpeed()*dt)%6;if(e.y<-24){e.dead=true;e.escaped=true;}return;}
    routeMoto(e,dt,exit.c,exit.r);return;
  }
  if(e.mode==='base'){
    if(Math.hypot(base.x-e.x,base.y-e.y)<base.r+e.r+12){
      e.baseMined=true;
      const a=Math.atan2(base.y-e.y,base.x-e.x);
      startDrop(e,{kind:'charge',target:'base',x:e.x+Math.cos(a)*(e.r+2),y:e.y+Math.sin(a)*(e.r+2)});return;
    }
    routeMoto(e,dt,Math.floor(base.x/T),Math.floor(base.y/T));return;
  }
  // field: ехать к точке и ставить мину
  if(!e.mineSpot||tileAt(e.mineSpot.c,e.mineSpot.r)!==EMPTY)e.mineSpot=pickMineSpot(e);
  if(!e.mineSpot){e.leaving=true;return;}
  if(Math.hypot(e.mineSpot.x-e.x,e.mineSpot.y-e.y)<6){e.mineSpot=null;startDrop(e,{kind:'mine'});return;}
  routeMoto(e,dt,e.mineSpot.c,e.mineSpot.r);
}

// Движение по полю расстояний; стена на пути минируется вместо обстрела.
function routeMoto(e,dt,tc,tr){
  buildFlow(clamp(tc,0,COLS-1),clamp(tr,0,ROWS-1));
  if(e.stuck>.7){e.stuck=0;decide(e,true);e.decideT=.5;}
  else if(Math.hypot(e.tx-e.x,e.ty-e.y)<1.5&&e.decideT<=0){decide(e,false);e.decideT=0;}
  e.decideT-=dt;
  if(e.brick){
    const c=Math.floor(e.brick.x/T),r=Math.floor(e.brick.y/T),a=Math.atan2(e.brick.y-e.y,e.brick.x-e.x);
    e.brick=null;
    if(breakable(tileAt(c,r))){startDrop(e,{kind:'charge',target:'wall',c,r,x:e.x+Math.cos(a)*(e.r+3),y:e.y+Math.sin(a)*(e.r+3)});return;}
  }
  driveMoto(e,dt);
}

// ---------- мины и заряды ----------
function detonateMine(m){
  if(m.done)return;
  m.done=true;
  mineFx.push({x:m.x,y:m.y,age:0,size:m.kind==='charge'?48:40});
  explosion(m.x,m.y,false,'#6b5a36',m.kind==='charge'?1:.8,false);
  if(m.target==='wall'){const t=tileAt(m.c,m.r);if(t===BRICK)hitBrick(m.c,m.r,99,m.x,m.y);else if(t===FENCE)hitFence(m.c,m.r,m.x,m.y);}
  if(m.target==='base'&&base&&!base.dead)hitBase(MINE_DAMAGE);
  blastDamage(m.x,m.y,20,{damage:MINE_DAMAGE});
}

// Снаряд игрока или союзника подрывает мину, в которую попал.
function shootMine(x,y,radius){
  for(const m of mines)if(!m.done&&m.kind==='mine'&&Math.hypot(m.x-x,m.y-y)<7+radius){detonateMine(m);return true;}
  return false;
}

function updateMines(dt){
  for(const m of mines){
    if(m.done)continue;
    m.age+=dt;
    if(m.kind==='charge'){if(m.age>=m.fuse)detonateMine(m);continue;}
    if(m.age<.5)continue; // мина взводится после установки
    if(friendlyTanks().some(t=>Math.hypot(t.x-m.x,t.y-m.y)<t.r+5))detonateMine(m);
  }
  mines=mines.filter(m=>!m.done);
  for(const f of mineFx)f.age+=dt;
  mineFx=mineFx.filter(f=>f.age<MINE_FX_TIME);
}

function updateSappers(dt){
  for(const b of bombers){
    if(b.state==='down'){b.age+=dt;if(b.age>=BOMBER_BODY_TIME)b.state='dead';}
    else if(b.state!=='dead')updateBomber(b,dt);
  }
  bombers=bombers.filter(b=>b.state!=='dead');
  updateMines(dt);
}

function sappersBusy(){return bombers.some(b=>b.state==='lit')||mines.some(m=>m.kind==='charge');}

// ---------- отрисовка ----------
function drawMoto(t,c=ctx){
  const image=sapperSprite('moto');
  const frame=t.dropT>0?4+Math.min(3,Math.floor((1-t.dropT/MOTO_DROP_TIME)*4)):Math.floor((t.tread||0)/1.5)%4;
  const s=tankScale(t);
  c.save();if(t.flash>0)c.filter='brightness(0) invert(1)';
  c.translate(t.x,t.y);c.rotate(t.angle+Math.PI/2);c.scale(s,s);
  if(image)c.drawImage(image,frame*80,0,80,100,-12.5,-15,30,37.5);
  else {c.fillStyle='#2a2622';c.fillRect(-5,-14,4,28);c.fillStyle='#c9a96a';c.fillRect(-7,-8,8,16);c.fillRect(3,-6,9,16);c.fillStyle='#6b5a36';c.beginPath();c.arc(-3,-2,3,0,Math.PI*2);c.arc(7,1,3,0,Math.PI*2);c.fill();}
  c.restore();
}

function drawBomberModel(t,c=ctx){
  const image=sapperSprite('bomber'),frame=Math.floor((t.walk||0)/5)%4;
  c.save();c.translate(t.x,t.y);c.rotate((t.angle??-Math.PI/2)+Math.PI/2);
  if(image)c.drawImage(image,frame*64,0,64,64,-9,-9,18,18);
  else {c.fillStyle='#4a5040';c.fillRect(-6,-4,12,8);c.fillStyle='#b8322a';c.fillRect(-6,0,12,3);c.fillStyle='#5f6264';c.beginPath();c.arc(0,-1,5,0,Math.PI*2);c.fill();}
  c.restore();
}

function drawBombers(){
  for(const b of bombers){
    if(b.state==='down'){ctx.save();ctx.globalAlpha=clamp(1-b.age/BOMBER_BODY_TIME,0,1);ctx.filter='brightness(55%)';drawBomberModel({...b,angle:b.angle+.5});ctx.restore();continue;}
    if(b.state!=='lit')continue;
    drawBomberModel(b);
    // Таймер фитиля: дуга над головой, к концу краснеет и мигает.
    const left=clamp(b.fuse/CFG.bomberFuse,0,1),blink=left<.3&&Math.floor(time*12)%2;
    ctx.strokeStyle=blink?'#ffffff':left<.3?'#ff4d3a':'#ffc94a';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(b.x,b.y,b.r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*left);ctx.stroke();
  }
}

function drawMines(){
  const image=sapperSprite('mine');
  for(const m of mines){
    if(image)ctx.drawImage(image,0,0,64,64,m.x-8,m.y-8,16,16);
    else {ctx.fillStyle='#5d5640';ctx.beginPath();ctx.arc(m.x,m.y,6,0,Math.PI*2);ctx.fill();}
    const blink=m.kind==='charge'?Math.floor(m.age*(m.age>m.fuse-1?14:6))%2:Math.floor(m.age*2)%2;
    if(blink){ctx.fillStyle=m.kind==='charge'?'#ff3b2b':'#ff8a5c';ctx.beginPath();ctx.arc(m.x,m.y-1,1.6,0,Math.PI*2);ctx.fill();}
  }
}

function drawMineFx(){
  const image=sapperSprite('mine');if(!image)return;
  for(const f of mineFx){
    const p=f.age/MINE_FX_TIME,frame=1+Math.min(2,Math.floor(p*3)),size=f.size*(frame===1?.6:1);
    ctx.save();ctx.globalAlpha=frame===3?clamp(1-(p-2/3)*3,0,1):1;
    ctx.drawImage(image,frame*64,0,64,64,f.x-size/2,f.y-size/2,size,size);ctx.restore();
  }
}
