// Целевые проверки тактики обычных вражеских танков (js/enemy-tactics.js). Только встроенные модули Node.
const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
module.exports = function checkTactics(root) {
  const canvas = new Proxy({ globalAlpha: 1 }, { get: (o, k) => (k in o ? o[k] : () => canvas) }),
    saved = new Map();
  const element = {
    style: {},
    classList: { toggle() {} },
    addEventListener() {},
    getContext: () => canvas,
    querySelector: () => element,
    querySelectorAll: () => [],
    blur() {},
  };
  let seed = 24680;
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const box = vm.createContext({
    Math: math,
    document: {
      getElementById: () => ({ ...element }),
      createElement: () => ({ ...element }),
      querySelectorAll: () => [],
      activeElement: element,
    },
    window: {},
    innerWidth: 960,
    innerHeight: 640,
    addEventListener() {},
    requestAnimationFrame() {},
    performance: { now: () => 0 },
    setTimeout() {},
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
    Audio: class {
      addEventListener() {}
      play() {
        return { catch() {} };
      }
      pause() {}
    },
  });
  const html = fs.readFileSync(root + '/index.html', 'utf8');
  for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const src = attrs.match(/src="([^"]+)"/)?.[1];
    vm.runInContext(src ? fs.readFileSync(root + '/' + src, 'utf8') : code, box, { filename: src || 'index.html' });
  }
  // каждый фрагмент — свой блок: const не копятся между фрагментами; общее — через globalThis
  const run = code => vm.runInContext('{' + code + '\n}', box);
  // Поле без препятствий, без базы и союзников; игрок неуязвим. step — кадр ИИ так же, как в игровом цикле.
  run(`muted=true;CFG.bomberChance=0;CFG.allies=false;PREFS.mapMode='original';PREFS.mapSize=30;startGame();
  globalThis.arena=(cells={})=>{grid.fill(EMPTY);foliageMask.fill(31);brickHp.fill(0);brickMask.fill(0);for(const [i,t] of Object.entries(cells)){grid[+i]=t;if(t===BRICK){brickHp[+i]=4;brickMask[+i]=1023;}}
   shapeFences();resetTactics();geoVersion++;base=null;allies=[];bullets=[];toSpawn=[];enemies=[];wave=1;player.dead=false;player.pw.shield=1e9;player.inv=1e9;player.vx=player.vy=0;};
  globalThis.tank=(kind,c,r)=>{const e=makeTank(c*T+T/2,r*T+T/2,kind);e.spawnT=0;e.cd=9;enemies.push(e);return e;};
  globalThis.step=(dt=1/30)=>{updateEnemyTactics(dt);for(const e of enemies)updateEnemy(e,dt);enemies=enemies.filter(e=>!e.dead);separate();updateBullets(dt);bullets=bullets.filter(b=>!b.dead);};
  globalThis.roles=()=>enemies.map(e=>e.tac&&e.tac.role);`);

  // 1. Две и три машины — прямой бой без обхода; четыре — три в прямом бою, четвёртая обходит.
  for (const n of [2, 3, 4]) {
    run(`arena();player.x=15*T+16;player.y=12*T+16;for(let k=0;k<${n};k++)tank('soldier',12+2*k,4);step();`);
    const r = run('roles()');
    assert.equal(r.filter(x => x === 'direct').length, Math.min(3, n), n + ' tanks: direct group');
    assert.equal(r.filter(x => x === 'flank').length, Math.max(0, n - 3), n + ' tanks: flank only beyond three');
  }
  // ни одной общей огневой позиции или позиции обхода
  run(`for(let i=0;i<60;i++)step();`);
  assert(
    run(
      `(()=>{const p=enemies.map(e=>e.tac.slot||e.tac.fs&&e.tac.fs.pos).filter(Boolean);return p.every((a,i)=>p.every((b,j)=>i===j||Math.hypot(a.x-b.x,a.y-b.y)>=26+T/2-1));})()`,
    ),
    'Distinct firing positions',
  );

  // 2. Два обхода дают разные направления атаки, отличные от прямого.
  run(`arena();player.x=15*T+16;player.y=11*T+16;for(let k=0;k<6;k++)tank('soldier',10+2*k,3);step();
  globalThis.C=contactFor(player);`);
  assert.equal(run('C.flanks.length'), 2, 'Two flank groups');
  const angles = run(`JSON.stringify([directAngle(C),...C.flanks.map(F=>F.site.ang)])`);
  const [direct, a1, a2] = JSON.parse(angles),
    diff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  assert(
    diff(a1, a2) >= Math.PI / 3 - 1e-9 && diff(a1, direct) >= Math.PI / 3 - 1e-9 && diff(a2, direct) >= Math.PI / 3 - 1e-9,
    'Distinct attack directions',
  );
  assert(run('pathShare(C.flanks[0].path,C.flanks[1].path)<=TACTICS.flankShare'), 'Separate flank routes');
  // перехваченная обходящая машина останавливается и отвечает, затем решает, продолжать ли обход
  run(`globalThis.F=C.flanks[0].members[0];F.x=player.x+3*T;F.y=player.y-3*T;F.cd=0;F.turret=Math.atan2(player.y-F.y,player.x-F.x);F.tac.hitAt=tacClock;
  const dirAng=directAngle(C);F.x=player.x+Math.cos(dirAng)*4*T+20;F.y=player.y+Math.sin(dirAng)*4*T;
  bullets=[];for(let i=0;i<90&&!bullets.some(b=>b.owner==='e'&&Math.hypot(b.x-F.x,b.y-F.y)<60);i++){step();}`);
  assert.equal(run('F.tac.role'), 'respond', 'Intercepted flank responds');
  assert(run('F.tac.shots>0'), 'Intercepted flank fires back');
  run(
    `player.x=1*T;player.y=18*T;for(let k=12;k<19;k++)for(let r=14;r<20;r++)if(k===12||r===14)grid[r*COLS+k-10]=STEEL;geoVersion++;for(let i=0;i<70;i++)step();`,
  );
  assert(
    run(`['flank','support','direct'].includes(F.tac.role)||F.tac.contact&&F.tac.contact.phase!=='fight'`),
    'Flank decides after the interception',
  );

  // 3. Видимость: зелень скрывает дальше трёх клеток (и цель в зелени), снаряды проходят.
  run(`arena({[10*COLS+20]:TREE});globalThis.obs=tank('scout',15,10);player.x=20*T+16;player.y=10*T+16;`);
  assert.equal(run('enemySees(obs,player)'), false, 'Tank in foliage hidden beyond three cells');
  run(`obs.x=18*T+16;`);
  assert.equal(run('enemySees(obs,player)'), true, 'Visible within three cells');
  run(`grid[10*COLS+20]=EMPTY;grid[10*COLS+17]=TREE;obs.x=12*T+16;`);
  assert.equal(run('enemySees(obs,player)'), false, 'Foliage between limits sight');
  run(`obs.x=17*T+24;grid[10*COLS+17]=TREE;`);
  assert.equal(run('enemySees(obs,player)'), true, 'Sees through foliage within three cells');
  run(`bullets=[{x:12*T+16,y:10*T+16,vx:600,vy:0,life:2,r:3,dmg:1,owner:'e'}];updateBullets(.35);`);
  assert(run('bullets.length===1&&bullets[0].x>18*T'), 'Shell passes through foliage');
  // после контакта игрок ушёл в зелень — танк помнит последнюю известную позицию
  run(`arena({[10*COLS+22]:TREE});obs=tank('scout',12,10);player.x=18*T+16;player.y=10*T+16;step();const C2=contactFor(player);
  player.x=22*T+16;step();globalThis.memo=[C2.x,C2.y,obs.engaged];`);
  assert.equal(run('JSON.stringify(memo)'), JSON.stringify([18 * 32 + 16, 10 * 32 + 16, false]), 'Last known position kept');

  // 4. Поиск ограничен 10 клетками от исходного маршрута (считая отрезки между точками).
  run(`arena();base={x:27*T+16,y:2*T+16,hp:99,maxHp:99,r:16,dead:false};globalThis.s=tank('soldier',5,2);step();
  s.tac.group.route0=Array.from({length:20},(_,k)=>({x:(5+k)*T+16,y:2*T+16,c:5+k,r:2}));s.tac.group.route=s.tac.group.route0;
  for(const [dc,dr] of [[-1,-1],[0,-1],[1,-1],[-1,0],[1,-1],[1,0],[-1,1],[0,1],[1,1]])grid[(18+dr)*COLS+28+dc]=STEEL;
  player.x=14*T+16;player.y=10*T+16;reportContact(s,player);player.x=28*T+16;player.y=18*T+16;
  globalThis.far=0;globalThis.phases=new Set();globalThis.exitsOut=0;
  for(let i=0;i<900;i++){step();const C=s.tac.contact,t=s.tac.searchPt;if(C){phases.add(C.phase);if(C.exits)exitsOut=C.exits.filter(p=>!withinSearch(s,p)).length;}
   far=Math.max(far,routeDistance(s.tac.group.route0,s.x,s.y));if(t)far=Math.max(far,routeDistance(s.tac.group.route0,t.x,t.y));}`);
  assert(run('phases.has("lost")&&phases.has("search")'), 'Lost contact leads to a search of exits');
  assert(run('exitsOut>0'), 'Some exits lie beyond the search limit');
  assert(run('far<=TACTICS.searchLimit*T+1'), 'Search stays within ten cells: ' + run('far/T'));
  assert.equal(run('s.tac.role'), 'march', 'Returns to the march after the search');

  // 5. Выстрел только после остановки хода и поворота корпуса; доворот один раз за перезарядку.
  run(`arena();globalThis.g=tank('soldier',15,4);player.x=15*T+16;player.y=12*T+16;g.angle=Math.PI/2;g.turret=Math.PI/2;g.cd=0;g.speedCur=40;
  bullets=[];globalThis.shotAt=null;for(let i=0;i<60&&!bullets.length;i++){globalThis.wasMoving=Math.abs(g.speedCur)>=HULL_STOP_SPEED;step();if(bullets.length)shotAt={speed:g.speedCur,turn:g.turnRate,i};}`);
  assert(
    run('shotAt&&shotAt.i>0&&Math.abs(shotAt.speed)<HULL_STOP_SPEED&&Math.abs(shotAt.turn)<HULL_STOP_TURN'),
    'Fires only after the hull stopped',
  );
  run(
    `const cyc=g.tac.fs.cycle;player.x=19*T+16;for(let i=0;i<10;i++)step();globalThis.h1=g.tac.fs.hullAim;player.x=11*T+16;for(let i=0;i<10;i++)step();globalThis.h2=g.tac.fs.hullAim;`,
  );
  assert.equal(run('h1'), run('h2'), 'Hull heading fixed until the next reload cycle');
  assert(
    run('Math.abs(angDiff(h1,Math.atan2(player.y-g.y,19*T+16-g.x)))<.05'),
    'Hull heading picked once toward the last observed position',
  );
  // укрытие в пределах клетки: сталь сбоку перекрывает ответный выстрел
  run(`arena({[5*COLS+16]:STEEL});globalThis.c=tank('soldier',15,4);player.x=15*T+16;player.y=12*T+16;c.angle=c.turret=Math.PI/2;c.cd=0;bullets=[];
  globalThis.trace=[];for(let i=0;i<150;i++){step();trace.push(c.tac.fs&&c.tac.fs.phase);}`);
  assert(run(`trace.includes('hide')&&c.tac.shots>0`), 'Uses side cover after the shot');
  assert(
    run(
      `(()=>{const f=c.tac.fs;return Math.hypot(f.cover.x-f.pos.x,f.cover.y-f.pos.y)<=T+1e-6&&!los(player.x,player.y,f.cover.x,f.cover.y);})()`,
    ),
    'Cover within one cell blocks the return shot',
  );
  // без укрытия танк остаётся на позиции
  run(
    `arena();globalThis.o=tank('soldier',15,4);player.x=15*T+16;player.y=12*T+16;o.angle=o.turret=Math.PI/2;o.cd=0;const x0=o.x,y0=o.y;for(let i=0;i<150;i++)step();globalThis.stay=Math.hypot(o.x-x0,o.y-y0);`,
  );
  assert(run('stay<2&&o.tac.shots>0&&o.tac.fs.phase==="hold"'), 'Stays on the position without cover');

  // 6. Разрушение: потеря укрытия — новая позиция; пролом открывает обход.
  run(`arena({[5*COLS+16]:BRICK});c=tank('soldier',15,4);player.x=15*T+16;player.y=12*T+16;c.angle=c.turret=Math.PI/2;c.cd=0;
  for(let i=0;i<150&&!(c.tac&&c.tac.fs&&c.tac.fs.phase==='hide');i++)step();globalThis.hid=c.tac.fs.phase;hitBrick(16,5,99);step();`);
  assert.equal(run('hid'), 'hide');
  assert(run(`c.tac.fs.phase==='hold'&&!c.tac.fs.cover`), 'Destroyed cover forces a new position');
  run(`const cells={};for(let r=12;r<=18;r++)for(let k=12;k<=18;k++){if(Math.max(Math.abs(r-15),Math.abs(k-15))!==3)continue;if(r===12&&k>=14&&k<=16)continue;cells[r*COLS+k]=k===18&&r>=14&&r<=16?BRICK:STEEL;}
  arena(cells);player.x=15*T+16;player.y=15*T+16;for(let k=0;k<4;k++)tank('soldier',13+k,8);step();`);
  assert.equal(run(`roles().filter(r=>r==='support').length`), 1, 'No flank without a passage');
  run(`for(let r=14;r<=16;r++)hitBrick(18,r,99);for(let i=0;i<30;i++)step();`);
  assert.equal(run(`roles().filter(r=>r==='flank'||r==='flankFire').length`), 1, 'Breach opens a flank');

  // 7. Узкий проход: зазор не меньше половины клетки, обе машины продвигаются.
  run(`const cells={};for(let r=0;r<ROWS;r++)for(let k=0;k<COLS;k++)cells[r*COLS+k]=STEEL;for(let k=2;k<=26;k++)delete cells[5*COLS+k];for(let r=5;r<=18;r++)delete cells[r*COLS+26];
  arena(cells);player.x=26*T+16;player.y=18*T+16;player.dead=false;grid[18*COLS+26]=EMPTY;grid[17*COLS+26]=EMPTY;
  for(let r=8;r<=17;r++)grid[r*COLS+26]=EMPTY;for(let k=25;k<=27;k++)grid[12*COLS+k]=k===26?TREE:STEEL;
  globalThis.lead=tank('soldier',6,5);globalThis.tail=tank('soldier',4,5);const sx=tail.x;globalThis.minGap=Infinity;
  player.x=26*T+16;player.y=19*T+16;
  for(let i=0;i<300;i++){step();minGap=Math.min(minGap,Math.hypot(lead.x-tail.x,lead.y-tail.y)-lead.r-tail.r);}globalThis.progress=tail.x-sx;`);
  assert(run('lead.tac.group===tail.tac.group'), 'Column shares one march group');
  assert(run('minGap>=TACTICS.gap*T-1'), 'Half-cell gap in the narrow pass: ' + run('minGap'));
  assert(run('progress>4*T'), 'Rear tank keeps moving');

  // 8. Опасная точка: один проверочный выстрел по зелени, затем марш продолжается.
  run(`arena({[8*COLS+13]:TREE,[8*COLS+12]:TREE,[9*COLS+12]:TREE});base={x:15*T+16,y:19*T+16,hp:5,maxHp:5,r:16,dead:false};player.x=2*T;player.y=19*T;
  for(let r=14;r<19;r++)for(let k=0;k<6;k++)grid[r*COLS+k]=k===5||r===14?STEEL:EMPTY;
  globalThis.d=tank('soldier',15,2);d.cd=0;bullets=[];globalThis.probes=[];globalThis.probe=null;
  for(let i=0;i<300;i++){const before=bullets.length,chk=d.tac&&d.tac.group.check;step();
   if(bullets.length>before&&chk&&chk.mode==='shot'){const b=bullets[bullets.length-1];probes.push(Math.abs(angDiff(Math.atan2(b.vy,b.vx),Math.atan2(chk.p.y-d.y,chk.p.x-d.x))));if(!probe)probe={idx:d.tac.routeIdx};}}`);
  assert(run('d.tac.group.danger.length>0&&probe'), 'Danger point triggers a check');
  assert(run('probes.length===1&&probes[0]<.1'), 'Exactly one probe shot, aimed at the foliage');
  assert(run('d.tac.group.checked.size>=1&&d.tac.routeIdx>probe.idx'), 'March continues after the check');

  // 9. Обычные режимы: карта без разметки, разметка готовых карт, база, специальная техника.
  run(`PREFS.mapMode='original';startGame();`);
  assert.equal(run('tacticMarkup()'), null, 'Random map has no markup');
  assert(
    run(`(()=>{const g=newGroup(Object.assign(makeTank(SPAWNS[0].c*T+16,48,'scout'),{tac:{routeIdx:0}}));return g.route.length>0;})()`),
    'Route from current geometry without markup',
  );
  for (const id of run('JSON.stringify(Object.keys(window.ECOTANK_AI_MARKUP))').match(/claude-[\w-]+/g)) {
    run(`PREFS.mapMode='map';PREFS.mapPick='${id}';startGame();globalThis.mk=tacticMarkup();`);
    assert(run('mk&&mk.routes.length===window.ECOTANK_AI_MARKUP[activeMap.id].routes.length'), 'Valid markup ' + id);
    assert(
      run(`mk.routes.every(r=>expandMarkedRoute(r)!==null||r.some(([c,rr])=>blocksRoute(tileAt(c,rr))))`),
      'Routes follow passable cells ' + id,
    );
    run(`globalThis.sp=makeTank(SPAWNS[0].c*T+16,48,'soldier');sp.tac={routeIdx:0};globalThis.gr=newGroup(sp);`);
    assert(
      run(`gr.route.length>0&&Math.hypot(gr.route[gr.route.length-1].x-base.x,gr.route[gr.route.length-1].y-base.y)<2*T`),
      'Marked route reaches the base ' + id,
    );
  }
  run(`PREFS.mapMode='original';startGame();arena();base={x:15*T+16,y:19*T+16,hp:5,maxHp:5,r:16,dead:false};player.x=2*T;player.y=2*T;
  for(const [k,r] of [[1,1],[2,1],[3,1],[1,2],[1,3],[3,2],[3,3],[2,3]])grid[r*COLS+k]=STEEL;
  globalThis.b=tank('soldier',15,12);b.cd=0;b.angle=b.turret=Math.PI/2;bullets=[];for(let i=0;i<60&&!bullets.length;i++)step();`);
  assert(run(`bullets.some(x=>x.owner==='e')`), 'Marching tank shells the base in sight');
  run(`arena();base={x:15*T+16,y:19*T+16,hp:5,maxHp:5,r:16,dead:false};player.x=5*T;player.y=10*T;
  for(const k of ['artillery','rocket','moto'])tank(k,10,3);for(let i=0;i<90;i++)step();`);
  assert(run(`enemies.filter(e=>!isTacticKind(e)).every(e=>!e.tac)`), 'Special vehicles keep their own logic');
  assert(run(`enemies.some(e=>e.kind==='artillery'&&e.deployed)`), 'Artillery still deploys');
  // Тяжёлый танк на въезде: стреляет по видимой цели (как раньше), но не сквозь зелень дальше трёх клеток;
  // после въезда переходит к тактике и стреляет только стоя.
  run(`arena({[5*COLS+15]:TREE});player.x=15*T+16;player.y=5*T+16;globalThis.hv=makeTank(15*T+16,-32,'heavy');hv.entering=true;hv.angle=hv.turret=Math.PI/2;hv.cd=0;enemies=[hv];bullets=[];
  for(let i=0;i<20;i++)updateEnemy(hv,.04);globalThis.hiddenShots=bullets.length;grid[5*COLS+15]=EMPTY;for(let i=0;i<80&&hv.entering;i++)updateEnemy(hv,.04);globalThis.openShots=bullets.length;
  globalThis.moving=[];for(let i=0;i<240;i++){const n=hv.tac?hv.tac.shots||0:0;step();if((hv.tac.shots||0)>n)moving.push(hullStopped(hv));}`);
  assert.equal(run('hiddenShots'), 0, 'Entering heavy does not see through foliage beyond three cells');
  assert(run('openShots>0'), 'Entering heavy fires at a visible target');
  assert(run('!hv.entering&&moving.length>0&&moving.every(Boolean)'), 'After entry the heavy fires only when stopped');
  // Расейняй: сценарный танк идёт к своему выходу по дорожному маршруту из разметки.
  run(`startRaseiniai();state='play';player=makeTank(15*T+16,H-80,'player');for(const lane of [2,4]){const sp=SPAWNS[lane-1],e=makeTank(sp.c*T+16,sp.r*T+16,'scout');
   e.storyWave=1;e.storyExit=raseiniaiRoadPath(e).exit;enemies=[e];ensureTactic(e);globalThis['ras'+lane]=e;}`);
  for (const lane of [2, 4])
    assert(
      run(
        `(()=>{const e=ras${lane},rt=e.tac.group.route;return rt.length>5&&rt.every(p=>road[p.r*COLS+p.c])&&rt[rt.length-1].c===e.storyExit&&rt[rt.length-1].r===ROWS-1;})()`,
      ),
      'Raseiniai lane ' + lane + ' follows the marked road route to its exit',
    );
  run('toMenu()');
  console.log(
    'PASS: enemy tactics — direct/flank roles, two flank directions, interception, foliage sight, ten-cell search, stop-to-fire, hull heading per reload, side cover, destruction replanning, narrow-pass gap, danger probe, markup and special vehicles',
  );
};
if (require.main === module) module.exports(require('node:path').join(__dirname, '..'));
