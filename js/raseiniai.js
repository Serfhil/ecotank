'use strict';
// The story mission owns its phases, reinforcement queues and evacuation.
const RASEINIAI_ASSETS = 'assets/raseiniai/';
const RASEINIAI_EXITS = [8, 21];
const RASEINIAI_FIRST_SPAWN = [1.4, 2];
const RASEINIAI_TRANSLATION_DELAY = .5;
const RASEINIAI_REPAIR_COST = 2;
const RASEINIAI_TITLE = 'Расейняй, Литва';
const RASEINIAI_SUBTITLE = 'Приграничные танковые бои — июнь 1941';
const RASEINIAI_ESTIMATES = ['9–12 тыс. солдат', '10–14 тыс. человек', '746'];
const RASEINIAI_RADIO = {
  order: 'Товарищ, против нас 4-я танковая группа под командованием генерал-полковника Эриха Гёпнера. Приказываю продержаться до эвакуации гражданских!',
  retreat: 'Мы закончили эвакуацию! Противника слишком много! Мы должны сохранить войска! Приказываю отступать!!!',
  fire: ['Feuer frei!', 'Огонь!'],
  german: [
    ['Oberst, melden Sie sich!', 'Полковник, доложите!'],
    ['Was ist mit Ihrer Truppe los?!', 'Что у вас там с войсками?!'],
    ['WAS HEISST DAS, EIN EINZIGER PANZER HAT IHRE BRIGADE ZERSCHLAGEN?!', 'ЧТО ЗНАЧИТ ОДИН ТАНК РАЗБИЛ ВАШУ БРИГАДУ?!'],
    ['ICH HABE DEN ANGRIFF BEFOHLEN!', 'Я ПРИКАЗАЛ АТАКОВАТЬ!'],
  ],
};
const raseiniaiGroup = (kind, lanes, column = false) => ({kind, lanes, column});
const raseiniaiSingles = (kind, count) => raseiniaiGroup(kind, Array(count).fill(null));
const raseiniaiColumn = (kind, lane) => raseiniaiGroup(kind, [lane, lane, lane], true);
const RASEINIAI_WAVES = [
  [raseiniaiSingles('scout', 10)],
  [raseiniaiColumn('scout', 2), raseiniaiColumn('scout', 4), raseiniaiSingles('scout', 4), raseiniaiSingles('moto', 5)],
  [raseiniaiColumn('scout', 2), raseiniaiColumn('scout', 4), raseiniaiGroup('moto', [3, 3, 2, 4]), raseiniaiColumn('moto', 1), raseiniaiColumn('moto', 5)],
  [[1,2].map(lane=>raseiniaiColumn('scout',lane)), [3,4].map(lane=>raseiniaiColumn('scout',lane)), raseiniaiColumn('scout',5), raseiniaiGroup('moto', [2, 3, 4, 2, 3, 4]), raseiniaiSingles('scout', 5)],
];

let raseiniai = null, raseiniaiMill = null, raseiniaiScreen = null;

function initRaseiniai() {
  raseiniaiScreen = document.getElementById('raseiniaiScreen');
  raseiniaiScreen.addEventListener('click', e => {
    const action = e.target.dataset && e.target.dataset.raseiniai;
    if (!raseiniai || !action) return;
    if (action === 'home') toMenu();
    else if (action === 'continue') advanceRaseiniai();
  });
  raseiniaiMill = document.getElementById('raseiniaiMill');
}

function startRaseiniai() {
  resetStatistics(); resetVictory(); resetDefeat(); resetArtillery(); resetReinforcements();
  raseiniai = {phase:'civilians', age:0, tracks:[], breaches:0, firstKills:0, evac:[], dirty:true, dialogue:null};
  state = 'story'; campaign = null; victory = false; base = null; player = null;
  activeMap = RASEINIAI_MAP; mapMode = 'map'; configureMap(activeMap.cols); genMap(1,true);
  setBaseWall((ROWS-1)*COLS+15,BRICK);
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (raseiniaiMillCell(c,r)) grid[r*COLS+c]=MILL;
  buildMillContour();
  devOpen = false;
  enemies = []; allies = []; bullets = []; items = []; parts = []; wrecks = []; rails = []; toSpawn = [];
  bombers = []; mines = []; mineFx = []; score = wave = shake = hitstop = flowTimer = 0;
  scrap = 4;
  banner.t = 0; hudOpacity = {left:1,right:1,score:1};
  mouse.down = mouse.right = false;
  evacuateRaseiniai(7);
  raseiniaiDialogue('civilian', [['НЕМЦЫ! Немецкие танки наступают!!!']], () => {});
  syncMusic();
}

function repairRaseiniaiTank() {
  if (!player || player.dead || player.hp>=player.maxHp || scrap<RASEINIAI_REPAIR_COST) return;
  scrap-=RASEINIAI_REPAIR_COST;
  player.hp=Math.min(player.maxHp,player.hp+1);
  sfx('pick');
}

function raseiniaiPhase(phase) {
  raseiniai.phase = phase;
  raseiniai.age = 0;
  raseiniai.dirty = true;
}

function evacuateRaseiniai(count, trucks = false) {
  const cells = [];
  for (let r = ROWS - 4; r < ROWS; r++) {
    for (const c of RASEINIAI_EXITS) if (road[r * COLS + c]) cells.push({c,r});
  }
  for (let i = 0; i < count; i++) {
    if (trucks) {
      const side=i%2;
      raseiniai.evac.push({x:side?W+24:-24,y:(ROWS-4)*T+T/2,turnX:RASEINIAI_EXITS[side]*T+T/2,delay:i*.64,speed:118,truck:true,step:0});
    } else {
      const {c,r}=cells[i%cells.length];
      raseiniai.evac.push({x:c*T+T/2+rnd(-7,7),y:r*T+T/2,delay:i*.12,speed:rnd(48,78),step:rnd(0,6),coat:['#79633d','#654450','#525944'][i%3]});
    }
  }
}

function raseiniaiDialogue(kind, lines, done) {
  raseiniai.dialogue = {kind, lines, done, index:0, elapsed:0, shown:0, complete:false, translationWait:0};
  raseiniai.dirty = true;
}

function advanceRaseiniai() {
  const d = raseiniai.dialogue;
  if (d) {
    if (!d.complete) finishRaseiniaiLine(d);
    else if (d.translationWait>0) return;
    else if (++d.index < d.lines.length) { d.elapsed = d.shown = d.translationWait = 0; d.complete = false; }
    else { raseiniai.dialogue = null; d.done(); }
    raseiniai.dirty = true;
  } else if (raseiniai.phase === 'newspaper') raseiniaiPhase('timeline');
  else if (raseiniai.phase === 'timeline') raseiniaiPhase('farewell');
}

function raseiniaiStoryInput(e) {
  if (!raseiniai || state !== 'story') return false;
  if (e.code === 'Space' && raseiniai.phase !== 'newspaper') {
    e.preventDefault();
    const fresh = !e.repeat && !keys.Space;
    keys.Space = true;
    if (fresh && raseiniai.phase==='farewell' && e.target?.dataset?.raseiniai==='home') toMenu();
    else if (fresh) advanceRaseiniai();
    return true;
  }
  return e.code !== 'Tab' && e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'KeyM';
}

function raseiniaiBombardment() {
  const targets = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < COLS; c++) {
    if (raseiniaiMillCell(c,r) || r<3 && SPAWNS.some(s=>Math.abs(s.c-c)<=1)) continue;
    targets.push([c*T+T/2,r*T+T/2]);
  }
  raseiniai.bombardment = Array.from({length:15}, () => targets.splice(ri(0,targets.length-1),1)[0]);
  raseiniai.bombardmentAt = 0;
  raseiniaiPhase('bombardment');
}

function updateRaseiniaiEvacuation(dt) {
  const s = raseiniai;
  for (const unit of s.evac) {
    unit.delay -= dt;
    if (unit.delay > 0) continue;
    let distance = unit.speed*dt;
    if (unit.truck && unit.x!==unit.turnX) {
      const dx = unit.turnX-unit.x;
      const step = Math.min(distance,Math.abs(dx));
      unit.x = step===Math.abs(dx) ? unit.turnX : unit.x+Math.sign(dx)*step;
      distance -= step;
    }
    unit.y += distance;
    unit.step += dt*13;
  }
  s.evac = s.evac.filter(unit => unit.y < H + 22);
}

function finishRaseiniaiLine(d) {
  d.complete=true;
  d.translationWait=d.lines[d.index][1] ? RASEINIAI_TRANSLATION_DELAY : 0;
}

function updateRaseiniaiStory(dt) {
  const s = raseiniai;
  s.age += dt;
  updateRaseiniaiEvacuation(dt);
  const d = s.dialogue;
  if (d && !d.complete) {
    d.elapsed += dt;
    const pause = d.kind==='civilian' && d.elapsed>.2 ? Math.min(.38,d.elapsed-.2) : 0;
    d.shown = Math.floor((d.elapsed-pause)*35);
    if (d.shown >= d.lines[d.index][0].length) finishRaseiniaiLine(d);
  } else if (d) d.translationWait=d.translationWait-dt>1e-9 ? d.translationWait-dt : 0;
  if (s.phase === 'civilians' && !s.evac.length && !s.dialogue) {
    raseiniaiPhase('fireOrder');
    raseiniaiDialogue('german',[RASEINIAI_RADIO.fire],raseiniaiBombardment);
  }
  if (s.phase === 'bombardment') {
    updateArtilleryShells(dt);
    s.bombardmentAt -= dt;
    if (s.bombardment.length && s.bombardmentAt <= 0) {
      const [x,y] = s.bombardment.shift();
      launchArtillery(x+rnd(-36,36),-T,x,y,false,{delay:2,speed:3000});
      s.bombardmentAt = s.bombardment.length%5===0 ? .9 : .15;
    }
    if (!s.bombardment.length && !artilleryShells.length) raseiniaiPhase('title');
  }
  if (s.phase === 'title' && s.age >= 6) {
    player = makeTank(RASEINIAI_EXITS[0]*T+T/2,H+26,'player');
    raseiniaiPhase('arrival');
  }
  if (s.phase === 'arrival') {
    const step=Math.min(player.y-(H-2.5*T),dt*KINDS.player.speed);
    player.y-=step; player.tread=(player.tread+step)%6;
    if (player.y === H-2.5*T) {
      raseiniaiPhase('orders');
      raseiniaiDialogue('soviet', [[RASEINIAI_RADIO.order]], () => {
        startRaseiniaiWave(1);
        resumeRaseiniaiBattle();
      });
    }
  }
  if (s.phase === 'evacuation' && !s.evac.length) {
    if (s.nextWave === 4) {
      raseiniaiPhase('german');
      raseiniaiDialogue('german', RASEINIAI_RADIO.german, () => {
        startRaseiniaiWave(4); resumeRaseiniaiBattle();
      });
    } else if (s.nextWave === 0) {
      raseiniaiPhase('retreat');
      raseiniaiDialogue('soviet', [[RASEINIAI_RADIO.retreat]], () => {
        raseiniaiPhase('victory'); sfx('wave');
      });
    }
  }
  if (s.phase === 'victory' && s.age >= 2.5) raseiniaiPhase('newspaper');
}

function resumeRaseiniaiBattle() {
  // Dialog input is consumed, including autorepeat and the held closing press.
  raseiniai.blockSpace = !!keys.Space;
  mouse.down = mouse.right = false;
  raseiniaiPhase('battle');
  state = 'play';
}

function startRaseiniaiWave(number) {
  wave = number;
  const batches = RASEINIAI_WAVES[number-1].map(batch=>[].concat(batch).map(group=>({...group,slot:0,entered:[],timer:.65})));
  const pending = batches.flat().reduce((total,group)=>total+group.lanes.length,0);
  raseiniai.tracks.push({number,batches,pending});
  banner = {text:number===4?'4-я волна. Штурм':number+'-я волна',sub:number===1?'R · ремонт 1 HP за 2 металлолома':'',t:2.2};
  sfx('wave');
}

function raseiniaiEnemyCount() {
  return enemies.filter(e=>!e.dead).length + raseiniai.tracks.reduce((total,track)=>total+track.pending,0);
}

function raseiniaiSpawnFree(s) {
  const x = s.c*T+T/2, y = s.r*T+T/2;
  return ![...enemies,player].some(t=>t&&!t.dead&&
    (t.entering&&t.x===x || Math.hypot(t.x-x,t.y-y)<t.r+13));
}

function raseiniaiBatchCleared(batch) {
  return batch.every(group=>group.slot===group.lanes.length && !group.entered.some(t=>!t.dead&&t.entering));
}

function updateRaseiniaiSpawns(dt) {
  if (wave === 1 && (raseiniai.firstKills >= 6 || !raseiniaiEnemyCount())) {
    evacuateRaseiniai(3,true);
    startRaseiniaiWave(2);
  }
  for (const track of raseiniai.tracks) {
    if (!track.batches.length) continue;
    if (raseiniaiBatchCleared(track.batches[0])) {
      track.batches.shift();
      for (const group of track.batches[0] || []) group.timer = 0;
    }
    for (const group of track.batches[0] || []) {
      group.timer -= dt;
      if (group.slot===group.lanes.length || group.timer>0) continue;
      const lane = group.lanes[group.slot];
      const available = (lane ? [SPAWNS[lane-1]] : SPAWNS).filter(raseiniaiSpawnFree);
      if (!available.length) continue;
      const spawn = available[ri(0,available.length-1)];
      const e = makeTank(spawn.c*T+T/2,-32,group.kind);
      e.angle = e.turret = Math.PI/2; e.entering = true; e.storyWave = track.number;
      if (group.kind==='scout') e.storyExit = raseiniaiRoadPath({x:e.x,y:spawn.r*T+T/2}).exit;
      if (group.column) e.storyColumn = group.entered;
      group.entered.push(e); enemies.push(e); group.slot++; track.pending--;
      group.timer = group.column ? .55 : track.number===1 ? rnd(...RASEINIAI_FIRST_SPAWN) : rnd(.6,1.1);
    }
  }
}

function raseiniaiFormColumns() {
  for (const e of enemies) {
    if (!e.storyColumn || e.kind==='moto' || e.entering) continue;
    const ready = e.storyColumn.filter(t=>!t.dead&&!t.entering);
    const slot = ready.indexOf(e);
    e.leader = slot>0 ? ready[0] : null;
    e.columnSlot = Math.max(0,slot);
  }
}

function finishRaseiniaiBattle() {
  if (raseiniai.nextWave===3) {
    if (!raseiniai.evac.length) { raseiniai.nextWave=null; startRaseiniaiWave(3); }
    return;
  }
  if (wave<2 || raseiniaiEnemyCount() || raseiniai.tracks.some(t=>t.batches.length) || wrecks.some(w=>w.exploded===false)) return;
  collectRemainingScrap();
  if (wave===2) {
    evacuateRaseiniai(2,true);
    raseiniai.nextWave=3;
    return;
  }
  bullets = [];
  raseiniai.nextWave = wave===4 ? 0 : wave+1;
  if (wave===4 && score>best) {
    best=score;
    try { localStorage.setItem('ecotank-best', best); } catch (e) {}
  }
  evacuateRaseiniai(wave===4?3:2,true);
  raseiniaiPhase('evacuation');
  state = 'story';
}

function raseiniaiRoadPath(e) {
  const start = Math.floor(e.y/T)*COLS+Math.floor(e.x/T), queue = [start];
  const previous = new Int32Array(grid.length).fill(-1);
  previous[start] = start;
  const exits = RASEINIAI_EXITS.map(c=>(ROWS-1)*COLS+c);
  for (let j=0;j<queue.length;j++) {
    let i = queue[j];
    if (exits.includes(i)) {
      const path = [];
      while (i!==start) { path.push(i); i=previous[i]; }
      return {path:path.reverse(),exit:queue[j]%COLS};
    }
    const c=i%COLS,r=Math.floor(i/COLS);
    for (const [dc,dr] of DIRS) {
      const x=c+dc,y=r+dr,n=y*COLS+x;
      if (x>=0&&x<COLS&&y>=0&&y<ROWS&&road[n]&&previous[n]<0) {
        previous[n]=i; queue.push(n);
      }
    }
  }
  return null;
}

function updateRaseiniaiMoto(e,dt) {
  if (!e.storyRoute) {
    e.storyRoute = raseiniaiRoadPath(e);
    e.storyMile = 0;
    if (!e.storyRoute) return;
  }
  const {path,exit} = e.storyRoute;
  if (e.dropT>0) {
    e.vx = e.vy = 0;
    e.dropT -= dt;
    if (!e.dropped && e.dropT<=MOTO_DROP_TIME/2) { e.dropped=true; plantCharge(e,e.dropWhat); }
    return;
  }
  if (!path.length && driveRaseiniaiExit(e,exit,motoSpeed(),dt)) return;
  const i = path[0] ?? (ROWS-1)*COLS+exit;
  e.tx=(i%COLS)*T+T/2; e.ty=Math.floor(i/COLS)*T+T/2;
  if (path.length && Math.hypot(e.tx-e.x,e.ty-e.y)<1) {
    path.shift(); e.storyMile++;
    if (e.minesLeft>0 && e.storyMile%4===0 && path.length>2) startDrop(e,{kind:'mine'});
  } else {
    const distance = Math.hypot(e.tx-e.x,e.ty-e.y);
    const queued = enemies.some(other=>other!==e && !other.dead && other.kind==='moto' && other.storyRoute?.path[0]===i &&
      Math.hypot(other.x-e.x,other.y-e.y)<e.r+other.r+4 &&
      Math.hypot(e.tx-other.x,e.ty-other.y)<distance-1);
    if (queued) e.vx = e.vy = 0;
    else driveMoto(e,dt);
  }
}

function driveRaseiniaiExit(e,exit,speed,dt) {
  const x=exit*T+T/2;
  if (!e.storyLeaving && (Math.abs(e.x-x)>=2 || e.y<H-T/2-2)) return false;
  e.storyLeaving=true;
  e.x=x; e.angle=turnTo(e.angle,Math.PI/2,dt*8);
  const distance=speed*surfaceFactor(e,dt)*dt;
  e.y+=distance; e.vx=0; e.vy=distance/dt;
  e.tread=(e.tread+distance)%6;
  // Wait for the full sprite, including a turret that may still point north.
  if (e.y>=H+Math.max(e.r,T*tankScale(e))) { e.dead=true; e.escaped=true; raseiniai.breaches++; }
  return true;
}

function raseiniaiMillCell(c,r) {
  const m = RASEINIAI_MILL;
  return c>=m.c&&c<m.c+m.size&&r>=m.r&&r<m.r+m.size;
}

function buildMillContour() {
  const m = RASEINIAI_MILL, step = m.size*T/m.mask.length;
  raseiniai.mill = Array.from({length:m.size*m.size},()=>[]);
  for (let j=0;j<m.mask.length;j++) {
    const row=m.mask[j], y=j*step, r=Math.floor(y/T);
    for (let k=0;k<row.length;k+=2) {
      const end=row[k+1]*step;
      for (let x=row[k]*step;x<end;) {
        const c=Math.floor(x/T), right=Math.min(end,(c+1)*T);
        raseiniai.mill[r*m.size+c].push({x:x+m.c*T,y:y+m.r*T,w:right-x,h:step});
        x=right;
      }
    }
  }
  raseiniai.millOutline = raseiniai.mill.flat();
}

function millRects(c,r) {
  const m = RASEINIAI_MILL;
  return raseiniai.mill[(r-m.r)*m.size+c-m.c];
}

function millNear(x,y,radius) {
  const m = RASEINIAI_MILL;
  for (let r=Math.max(m.r,Math.floor((y-radius)/T));r<=Math.min(m.r+m.size-1,Math.floor((y+radius)/T));r++) {
    for (let c=Math.max(m.c,Math.floor((x-radius)/T));c<=Math.min(m.c+m.size-1,Math.floor((x+radius)/T));c++) {
      if (millRects(c,r).some(b=>rectNear(x,y,b.x,b.y,b.w,b.h,radius*radius))) return true;
    }
  }
  return false;
}

function millRayLimit(x,y,dx,dy,range) {
  const m = RASEINIAI_MILL;
  const endX=x+dx*range,endY=y+dy*range;
  if (Math.max(x,endX)<m.c*T || Math.min(x,endX)>(m.c+m.size)*T ||
      Math.max(y,endY)<m.r*T || Math.min(y,endY)>(m.r+m.size)*T) return range;
  for (const box of raseiniai.millOutline) {
    let near=0, far=range;
    for (const [origin,direction,min,max] of [[x,dx,box.x,box.x+box.w],[y,dy,box.y,box.y+box.h]]) {
      if (Math.abs(direction)<1e-10) {
        if (origin<min || origin>max) { far=-1; break; }
      } else {
        const a=(min-origin)/direction, b=(max-origin)/direction;
        near=Math.max(near,Math.min(a,b)); far=Math.min(far,Math.max(a,b));
      }
      if (near>far) break;
    }
    if (near<=far) range=near;
  }
  return range;
}

function raseiniaiResults(n) {
  return [(3000+126*n)+'–'+(5000+126*n),(4000+143*n)+'–'+(6000+143*n),String(211+2*n)];
}
