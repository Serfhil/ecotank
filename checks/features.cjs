const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');
// Целевые сценарии: база и подкрепление, пулемёты и заборы, прожиги, бонусы, покрытия и инерция,
// новые клетки редакторов и полный цикл Panzerwerfer 42.
module.exports = function checkFeatures(root) {
  function boot() {
    const draws = [],
      loaded = [];
    let created = 0;
    function element(id) {
      const canvas = new Proxy(
        {
          globalAlpha: 1,
          save() {},
          restore() {},
          fillRect(...a) {
            draws.push([id, 'fill', this.fillStyle, ...a]);
          },
          drawImage(...a) {
            draws.push([id, 'image', ...a]);
          },
          createLinearGradient: () => ({ addColorStop() {} }),
          fillText(v) {
            draws.push([id, 'text', v]);
          },
        },
        { get: (o, k) => (k in o ? o[k] : () => {}) },
      );
      return {
        id,
        hidden: false,
        style: {},
        classList: { toggle() {} },
        tagName: 'DIV',
        addEventListener() {},
        getContext: () => canvas,
        querySelector: () => element(id + ' child'),
        querySelectorAll: () => [],
        blur() {},
      };
    }
    const saved = new Map();
    let seed = 4242;
    const math = Object.create(Math);
    math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const box = vm.createContext({
      Math: math,
      document: {
        getElementById: element,
        createElement: tag => element('created ' + tag + created++),
        querySelectorAll: () => [],
        activeElement: element('focus'),
      },
      window: {},
      innerWidth: 1280,
      innerHeight: 720,
      performance: { now: () => 0 },
      requestAnimationFrame() {},
      setTimeout() {},
      addEventListener() {},
      localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) },
      Audio: class {
        addEventListener() {}
        play() {
          return { catch() {} };
        }
        pause() {}
      },
      Image: class {
        constructor() {
          this.naturalWidth = 256;
          this.naturalHeight = 158;
        }
        set src(v) {
          this.source = v;
          loaded.push(v);
          this.onload();
        }
      },
    });
    const html = fs.readFileSync(root + '/index.html', 'utf8');
    for (const [, attrs, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      const src = attrs.match(/src="([^"]+)"/)?.[1];
      vm.runInContext(src ? fs.readFileSync(root + '/' + src, 'utf8') : code, box);
    }
    const run = code => vm.runInContext(code, box);
    run("muted=true;CFG.bomberChance=0;CFG.allies=false;PREFS.mapMode='original';PREFS.mapSize=30;");
    return { run, draws, loaded };
  }
  const { run, draws, loaded } = boot();
  // Чистое поле без врагов и союзников; база на месте.
  const clean =
    "startGame();state='play';grid.fill(EMPTY);sand.fill(0);road.fill(0);steelDamage.clear();toSpawn=[];enemies=[];allies=[];bullets=[];items=[];wrecks=[];mines=[];bombers=[];parts=[];resetArtillery();resetReinforcements();fortifyBase('level');player.inv=99;player.pw.shield=0;hitstop=0;";

  // ---------- 1. база ----------
  run(clean + 'hitBase(3);nextWave();');
  assert.equal(run('base.hp'), run('base.maxHp'), 'Base is restored on every new wave/level');
  run(clean);
  const center = run('Math.floor(COLS/2)'),
    cells = run('JSON.stringify(baseWallCells())');
  assert.equal(JSON.parse(cells).length, 5, 'Base contour has five cells');
  assert(
    run(`grid[(ROWS-1)*COLS+${center}]===EMPTY&&baseWallCells().every(i=>grid[i]===BRICK&&brickHp[i]===4&&brickMask[i]===1023)`),
    'Level start builds the brick contour and keeps the base cell free',
  );
  // Стройбат: восстанавливает кирпич, сталь не трогает.
  run(
    '{const cs=baseWallCells();hitBrick(cs[0]%COLS,(cs[0]/COLS)|0,99);grid[cs[1]]=EMPTY;brickHp[cs[2]]=1;brickMask[cs[2]]=1;grid[cs[3]]=STEEL;}',
  );
  assert(
    run("itemUseful(player,{type:'stroybat',life:5})&&itemUseful(player,{type:'curtain',life:5})"),
    'Base bonuses are useful when walls are damaged',
  );
  run("player.x=60;player.y=60;applyItem(player,{type:'stroybat',x:player.x,y:player.y,life:5});");
  assert(
    run(
      '{const cs=baseWallCells();cs.filter((_,k)=>k!==3).every(i=>grid[i]===BRICK&&brickMask[i]===1023&&brickHp[i]===4)&&grid[cs[3]]===STEEL}',
    ),
    'Stroybat restores bricks and keeps installed steel',
  );
  assert(!run("itemUseful(player,{type:'stroybat',life:5})"), 'Nothing left for Stroybat');
  run('{const cs=baseWallCells();carveSteelRay(cs[3]%COLS*T,((cs[3]/COLS)|0)*T+16,cs[3]%COLS*T+32,((cs[3]/COLS)|0)*T+16);}');
  run("applyItem(player,{type:'curtain',x:player.x,y:player.y,life:5});");
  assert(
    run('baseWallCells().every(i=>grid[i]===STEEL&&!steelDamage.has(i))&&grid[(ROWS-1)*COLS+Math.floor(COLS/2)]===EMPTY'),
    'Iron curtain fills the whole contour with intact steel',
  );
  // Клетка под машиной откладывается до освобождения.
  run(
    clean +
      "{const i=baseWallCells()[0];grid[i]=EMPTY;brickMask[i]=0;brickHp[i]=0;player.x=i%COLS*T+16;player.y=((i/COLS)|0)*T+16;var wallCell=i;}var geoBefore=geoVersion;applyItem(player,{type:'stroybat',x:player.x,y:player.y,life:5});",
  );
  assert(run('grid[wallCell]===EMPTY&&pendingBaseWalls.has(wallCell)'), 'Occupied cell waits');
  run('player.x=200;player.y=200;updateBaseWalls(cellOccupied);');
  assert(
    run('grid[wallCell]===BRICK&&brickMask[wallCell]===1023&&!pendingBaseWalls.size&&geoVersion>geoBefore'),
    'Wall appears once free and invalidates routes',
  );

  // ---------- 1. подкрепление и союзники ----------
  run(clean + "CFG.allies=false;player.x=100;player.y=100;applyItem(player,{type:'reinforce',x:100,y:100,life:5});");
  assert.equal(run('pendingReinforcements'), 2, 'Reinforcement queues two allies');
  run('for(let f=0;f<240;f++){updateReinforcements(1/30);for(const a of allies)updateAlly(a,1/30);}');
  assert(
    run('allies.length===2&&allies.every(a=>a.ally&&!a.entering&&a.y<=H-16+1e-9&&a.y>H-T*1.5)'),
    'Two allies drive in from below with allies disabled',
  );
  // Все точки заняты — очередь ждёт, затем выезжают обе.
  run(
    clean +
      "allies=[];var blockers=[];for(let c=0;c<COLS;c++){const e=makeTank(c*T+16,H-16,'scout');e.spawnT=0;blockers.push(e);}enemies=blockers;queueReinforcements(2);for(let f=0;f<60;f++)updateReinforcements(1/30);",
  );
  assert(run('allies.length===0&&pendingReinforcements===2'), 'Occupied entries keep the queue');
  run('enemies=[];for(let f=0;f<240;f++){updateReinforcements(1/30);for(const a of allies)updateAlly(a,1/30);}');
  assert(run('allies.length===2&&pendingReinforcements===0'), 'Both allies arrive after entries free up');
  // Ступени живых союзников (в том числе из подкрепления) переходят на следующий уровень, погибшие — нет.
  run(
    'setPlayerUpgrade(allies[0],2,true);setPlayerUpgrade(allies[1],1,true);var extra=makeAlly(300,300,2);extra.dead=true;allies.push(extra);nextWave();',
  );
  assert(
    run("allies.length===2&&allies.map(a=>a.upgrade).sort().join()==='1,2'&&allies.every(a=>!a.upgradeT&&a.hp===a.maxHp&&a.armor)"),
    'Both tiers persist without animation',
  );
  run('CFG.allies=true;CFG.allyCount=3;allies[1].dead=true;nextWave();');
  assert(
    run('allies.length===3&&allies.filter(a=>a.upgrade===2||a.upgrade===1).length===1&&allies.filter(a=>!a.upgrade).length===2'),
    'Dead ally is replaced by a fresh tank',
  );
  run('startGame();');
  assert(run('allies.every(a=>!a.upgrade)'), 'New operation resets ally tiers');
  run('CFG.allies=false;startGame();');
  assert.equal(run('allies.length'), 0, 'No kept allies after a new operation');

  // ---------- 1. взрывы гибели игрока ----------
  for (const tier of [0, 1, 2]) {
    run(clean + `setPlayerUpgrade(player,${tier});player.hp=1;player.inv=0;hitPlayer({x:player.x,y:player.y,dmg:1});var dw=wrecks[0];`);
    assert.equal(run('dw.blastTotal'), 3 + tier, 'Death blasts per tier');
    assert(Math.abs(run('deadT-(dw.detonateAt+(dw.blastTotal-1)*.5+1)')) < 1e-9, 'Defeat waits for the actual last blast');
  }

  // ---------- 2. пулемёты ----------
  run(clean + 'mouse.right=true;mouse.down=false;keys.Space=false;mouse.x=player.x+300;mouse.y=player.y;');
  for (const [tier, interval] of [
    [0, 0.12],
    [1, 0.06],
    [2, 0.12],
  ]) {
    run(`setPlayerUpgrade(player,${tier});player.upgradeT=0;bullets=[];player.mgCd=0;for(let k=0;k<120;k++)updatePlayer(.01);`);
    const shots = run('bullets.filter(b=>b.mg).length');
    assert(Math.abs(shots - Math.round(1.2 / interval)) <= 1, `MG tier ${tier} interval ${interval}: ${shots} shots`);
  }
  run('mouse.right=false;');
  assert.equal(run('PLAYER_TIERS.map(t=>t.mg.name).join()'), 'ДТ-29,ДТ-29 ×2,ДШК');
  const hitsToKill = (kind, tier) =>
    run(
      `{bullets=[];const e=makeTank(400,300,'${kind}');e.spawnT=0;enemies=[e];let n=0;while(!e.dead&&n<40){bullets.push({x:e.x-e.r-1,y:e.y,vx:900,vy:0,owner:'p',mg:true,mgTier:${tier},dmg:0,r:1.5,life:1,trail:[]});updateBullets(1/120);n++;}e.dead?n:-1}`,
    );
  run(clean + 'player.x=60;player.y=60;');
  assert.equal(hitsToKill('scout', 2), 7, 'DShK: light tank in 7 hits');
  assert.equal(hitsToKill('moto', 2), 1, 'DShK: motorcycle in 1 hit');
  assert.equal(hitsToKill('rocket', 2), 10, 'DShK: Panzerwerfer in 10 hits');
  assert.equal(hitsToKill('moto', 0), 2, 'DT-29 keeps two hits on a motorcycle');
  assert.equal(hitsToKill('scout', 0), -1, 'DT-29 still bounces off tanks');
  assert.equal(hitsToKill('heavy', 2), -1, 'DShK bounces off heavy armor');
  run(
    "bombers=[{x:400,y:300,r:BOMBER_RADIUS,c:12,row:9,state:'lit',fuse:2,angle:0,walk:0,sparkT:0,pathT:0,path:null}];enemies=[];bullets=[{x:394,y:300,vx:900,vy:0,owner:'p',mg:true,mgTier:2,dmg:0,r:2,life:1,trail:[]}];updateBullets(1/60);",
  );
  assert(run("bombers[0].state==='down'"), 'DShK: bomber in 1 hit');

  // ---------- 2. заборы ----------
  run(
    clean +
      "player.x=60;player.y=60;{const i=9*COLS+14;grid[i]=FENCE;shapeFences();}bullets=[{x:14*T-6,y:9*T+16,vx:900,vy:0,owner:'p',mg:true,mgTier:0,dmg:0,r:1.5,life:1,trail:[]}];for(let k=0;k<10;k++)updateBullets(1/120);",
  );
  assert(run('grid[9*COLS+14]===EMPTY'), 'Machine gun breaks a fence by its geometry');
  run(
    clean +
      "{for(let c=5;c<10;c++)grid[9*COLS+c]=FENCE;shapeFences();}const tank=makeTank(7*T+16,8*T+16,'soldier');var crushX=tank;for(let k=0;k<60;k++)moveTank(tank,0,2,1/30);",
  );
  assert(run('grid[9*COLS+7]===EMPTY&&crushX.y>9*T+16'), 'A tank crushes a fence and keeps moving');
  run(
    "{for(let c=5;c<10;c++)grid[11*COLS+c]=FENCE;shapeFences();}const moto=makeTank(7*T+16,10*T+16,'moto');var motoT=moto;for(let k=0;k<60;k++)moveTank(moto,0,2,1/30);",
  );
  assert(run('grid[11*COLS+7]===FENCE&&motoT.y<=11*T+13-motoT.r+1e-6'), 'A motorcycle is stopped by the fence');
  run(
    'grid.fill(EMPTY);for(let r=0;r<ROWS;r++)grid[r*COLS+10]=FENCE;shapeFences();var tf=routeField(15,5);var tankCost=tf[5*COLS+5];var mf=motoField(15,5);',
  );
  assert.equal(run('tankCost'), 10, 'Fence costs nothing extra for tanks');
  assert.equal(run('mf[5*COLS+5]'), 11, 'Motorcycle flow keeps the fence penalty');
  run("var et=makeTank(9*T+16,5*T+16,'soldier');decide(et,false,tf);var mt=makeTank(9*T+16,5*T+16,'moto');decide(mt,false,mf);");
  assert(
    run('!et.brick&&et.tx===10*T+16&&mt.brick&&mt.brick.x===10*T+16'),
    'Tank drives into the fence; motorcycle treats it as an obstacle',
  );
  run('var al=makeAlly(9*T+16,5*T+16);allies=[al];buildAllyFlow(al,15,5,false);allyStep(al,false);');
  assert(run('!al.brick&&al.tx===10*T+16&&al.flow[5*COLS+9]===6'), 'Allies route through fences without penalty');
  run("items=[{type:'shield',x:12*T+16,y:5*T+16,life:10}];al.itemScanT=0;var found=findAllyItem(al);");
  assert(run('found===items[0]'), 'Pickup search passes through fences');
  // Наезд на мотобригаду.
  run(
    clean +
      "var sc0=score,st0=operationStats.enemies.moto;const mc=makeTank(300,300,'moto');mc.spawnT=0;enemies=[mc];player.x=310;player.y=300;player.inv=0;var hp0=player.hp;separate();",
  );
  assert(
    run('enemies[0].dead&&score===sc0+KINDS.moto.score&&operationStats.enemies.moto===st0+1'),
    'Player running over a motorcycle kills it once',
  );
  run('separate();hitEnemy(enemies[0],{x:0,y:0,dmg:9});');
  assert(run('score===sc0+KINDS.moto.score&&operationStats.enemies.moto===st0+1'), 'Score/statistics once');
  run("var al2=makeAlly(500,300);allies=[al2];const m2=makeTank(510,300,'moto');m2.spawnT=0;enemies=[m2];separate();");
  assert(run('enemies[0].dead'), 'Ally running over a motorcycle kills it');
  run("allies=[];const m3=makeTank(600,300,'moto');m3.spawnT=0;const ht=makeTank(612,300,'heavy');ht.spawnT=0;enemies=[m3,ht];separate();");
  assert(run('!enemies[0].dead'), 'Enemy vehicles do not crush motorcycles');
  // Три визуальных взрыва 0.3 без урона, мин и стоп-кадра.
  run(
    clean +
      "wrecks=[];const m4=makeTank(300,300,'moto');m4.spawnT=0;enemies=[m4];player.x=320;player.y=300;player.inv=0;var hp4=player.hp;mines=[{kind:'mine',x:310,y:310,age:5}];parts=[];hitstop=0;hitEnemy(m4,{x:300,y:300,dmg:9});for(let k=0;k<30;k++)updateWrecks(1/30);",
  );
  assert(
    run("parts.filter(p=>p.kind==='flash').length===3&&parts.filter(p=>p.kind==='flash').every(p=>Math.abs(p.size-70*.3)<1e-9)"),
    'Motorcycle death: three 0.3 explosions',
  );
  assert(run('player.hp===hp4&&mines.length===1&&!mines[0].done&&hitstop===0'), 'No blast damage, mine chain or hitstop');

  // ---------- 3. прожиги стали ----------
  run(clean + 'grid[5*COLS+5]=STEEL;simTime=100;carveSteelRay(5*T-20,5*T+16,5*T+60,5*T+16);var sd=steelDamage.get(5*COLS+5);');
  assert(
    run('sd.burn&&sd.burn.idx.length>0&&sd.burn.idx.every(p=>!sd.mask[p])&&[...sd.burn.depth].every(d=>d>=1&&d<=3)'),
    'Burn edge lies on remaining steel',
  );
  const burnColors = () => {
    draws.length = 0;
    run('drawSteelBurn(5,5)');
    return draws.filter(d => d[1] === 'fill' && /^rgb\(/.test(d[2])).map(d => d[2]);
  };
  let colors = burnColors();
  assert(colors.includes('rgb(255,232,110)') && colors.includes('rgb(205,52,26)'), 'Hot edge: yellow at the cut, red deeper');
  run('simTime+=1.5');
  colors = burnColors();
  assert(!colors.includes('rgb(255,232,110)'), 'Edge is cooling');
  run('simTime+=1.6');
  draws.length = 0;
  run('drawSteelBurn(5,5)');
  assert(draws.some(d => d[1] === 'image') && run('sd.burn.cache!==null'), 'Cooled edge is cached as charred metal');
  run('carveSteelRay(5*T+16,5*T-20,5*T+16,5*T+60);sd=steelDamage.get(5*COLS+5);');
  assert(
    run('sd.burn.hotUntil===simTime+STEEL_BURN.cool&&sd.burn.cache===null&&[...sd.burn.heat].some(h=>h===simTime)'),
    'Second cut reheats the area',
  );
  run('genMap(1)');
  assert.equal(run('steelDamage.size'), 0, 'Map change resets burns with steelDamage');

  // ---------- 3. появление бонусов ----------
  run(clean + "const sco=makeTank(300,300,'scout');sco.spawnT=0;enemies=[sco];items=[];hitEnemy(sco,{x:300,y:300,dmg:9});");
  assert.equal(run('items.length'), 0, 'No drops from killed enemies');
  for (let n = 0; n < 12; n++) {
    run(clean + 'player.x=5*T+16;player.y=10*T+16;allies=[makeAlly(25*T+16,4*T+16)];items=[];itemSpawnTimer=0;updateRandomItems(.01);');
    assert(
      run(
        'items.length===1&&[player,...allies].some(t=>Math.hypot(t.x-items[0].x,t.y-items[0].y)<=10*T)&&grid[Math.floor(items[0].y/T)*COLS+Math.floor(items[0].x/T)]===EMPTY',
      ),
      'Item within 10 cells of a friendly tank',
    );
  }
  run(clean + 'allies=[];grid.fill(WATER);player.x=300;player.y=300;items=[];itemSpawnTimer=0;updateRandomItems(.01);');
  assert(run('items.length===0&&itemSpawnTimer>0'), 'No free cell — spawn skipped');
  assert(run("!('dropChance' in CFG)&&!('heavyDropBonus' in CFG)"), 'Drop settings removed');
  run('applyDev({KINDS:{},CFG:{dropChance:.5,heavyDropBonus:.2,powerupTime:12}});');
  assert(run("!('dropChance' in CFG)&&CFG.powerupTime===12"), 'Unknown settings are dropped, known ones apply');
  run('CFG.powerupTime=10;');

  // ---------- 4. покрытия и инерция ----------
  run(
    clean +
      "enemies=[];const rt=makeTank(10*T+16,5*T+16,'soldier');var rT=rt;road[5*COLS+10]=1;for(let k=0;k<15;k++)moveTank(rt,0,0,1/30);var half=rt.terrainK;for(let k=0;k<20;k++)moveTank(rt,0,0,1/30);",
  );
  assert(Math.abs(run('half') - 1.125) < 0.01, 'Half-way after 0.5 s: ' + run('half'));
  assert.equal(run('rT.terrainK'), 1.25, 'Road x1.25 for tanks after 1 s');
  run("const rm=makeTank(10*T+16,5*T+16,'moto');for(let k=0;k<31;k++)moveTank(rm,0,0,1/30);var rmK=rm.terrainK;");
  assert.equal(run('rmK'), 1.4, 'Road x1.40 for motorcycles');
  run('road.fill(0);sand[5*COLS+10]=1;for(let k=0;k<6;k++)moveTank(rT,0,0,1/30);var mid=rT.terrainK;');
  assert(run('mid<1.25&&mid>1'), 'Surface change mid-transition continues from the current value');
  run('for(let k=0;k<90;k++)moveTank(rT,0,0,1/30);');
  assert.equal(run('rT.terrainK'), 0.5, 'Reaches sand');
  run('sand.fill(0);for(let k=0;k<30;k++)moveTank(rT,0,0,1/30);');
  assert.equal(run('rT.terrainK'), 1, 'Back to ground in 1 s');
  run('road[5*COLS+10]=1;rT.terrainK=rT.terrainTarget=1.25;rT.x=10*T+16;const x0=rT.x;moveTank(rT,10,0,1/30,4);var stepped=rT.x-x0;');
  assert(Math.abs(run('stepped') - 4) < 1e-9, 'Road bonus never overshoots the route point');
  run("road.fill(0);bombers=[{x:100,y:100,r:BOMBER_RADIUS,c:3,row:3,state:'lit',fuse:9,angle:0,walk:0,sparkT:0,pathT:0,path:null}];");
  // Инерция корпуса
  run(
    clean +
      "enemies=[];player=makeTank(400,400,'player');player.angle=0;keys.KeyW=true;updatePlayer(1/60);var v1=player.speedCur;for(let k=0;k<60;k++)updatePlayer(1/60);var v2=player.speedCur;",
  );
  assert(run('v1>0&&v1<KINDS.player.speed*.2&&Math.abs(v2-KINDS.player.speed)<1'), 'Gradual acceleration to full speed');
  run('keys.KeyW=false;for(let k=0;k<6;k++)updatePlayer(1/60);var v3=player.speedCur;');
  assert(run('v3>0&&v3<v2'), 'Gradual braking');
  run(
    'player.speedCur=60;grid[12*COLS+14]=STEEL;player.angle=0;player.x=14*T-player.r;player.y=12*T+16;keys.KeyW=true;updatePlayer(1/60);',
  );
  assert(run('player.speedCur<1'), 'Collision removes velocity toward the obstacle');
  run(
    'keys.KeyW=false;keys.KeyD=true;player.turnRate=0;updatePlayer(1/60);var tr1=player.turnRate;for(let k=0;k<60;k++)updatePlayer(1/60);keys.KeyD=false;',
  );
  assert(run('tr1>0&&tr1<1&&Math.abs(player.turnRate-2.2)<.05'), 'Hull turn has inertia');
  run('player.turret=0;player.angle=0;player.turnRate=0;mouse.x=player.x;mouse.y=player.y+500;const tb=player.turret;updatePlayer(.1);');
  assert(Math.abs(run('player.turret') - 0.1) < 1e-9, 'Mouse turret response unchanged');
  run('nextWave();');
  assert(run('player.speedCur===0&&player.turnRate===0'), 'New tank resets accumulated motion');

  // ---------- 5. клетки редакторов ----------
  assert.deepEqual(
    JSON.parse(run('JSON.stringify(BRUSHES.map(b=>b[0]))')),
    ['B', 'F', 'S', 'W', 'T', 'P', 'R', 'D', 'L', '.', ' '],
    'Brush palette: road and 75% cells, no 60% brushes',
  );
  assert(run("MAP_BRUSHES.every(([ch])=>ch!=='b'&&ch!=='t')"), 'Map palette has no 60% brushes');
  const rows30 = Array.from({ length: 20 }, (_, r) =>
    r === 8 ? 'RRRRRRRRRRDDDDDDDDDDLLLLLLLLLL' : r === 12 ? 'bbbbbbbbbbbbbbbbbbbbtttttttttt' : '.'.repeat(30),
  );
  run(`var nm=normalizeMap({id:'x',name:'Новые клетки',cols:30,rows:${JSON.stringify(rows30)}});`);
  assert(run('nm&&nm.rows[8].startsWith("RRR")'), 'Map format accepts R/D/L');
  assert(run("validPreset({name:'p',rows:['RDL','bt.']})"), 'Preset format accepts R/D/L and old b/t');
  run("PREFS.mapMode='map';mapMode='map';activeMap=nm;configureMap(30);genMap(1);");
  assert(run('[...Array(10).keys()].every(c=>road[8*COLS+c]===1&&grid[8*COLS+c]===EMPTY)'), 'Road loads as passable surface');
  assert(
    run('[...Array(10).keys()].every(c=>{const i=8*COLS+10+c;return grid[i]===BRICK&&brickMask[i]===DAMAGED_BRICK_MASK&&brickHp[i]===1;})'),
    'D loads as damaged brick',
  );
  assert(
    run('[...Array(10).keys()].every(c=>{const i=8*COLS+20+c;return grid[i]===TREE&&foliageMask[i]===DAMAGED_LEAF_MASK;})'),
    'L loads as thinned foliage',
  );
  const bits = n => run(`(${n}).toString(2).replace(/0/g,'').length`);
  assert.equal(bits('DAMAGED_BRICK_MASK'), 3, 'About a quarter of the masonry (3 of 10 bricks, 40 of 160 px)');
  run('{const c=10,r=8;hitBrick(c,r,1);var dGone=grid[r*COLS+c]===EMPTY;}');
  assert(run('dGone'), 'One ordinary hit destroys a 75% brick');
  assert(
    run('{const i=8*COLS+11,ox=11*T,oy=8*T;!bulletBlocked(ox+24,oy+4)&&bulletBlocked(ox+4,oy+20)}'),
    'Remaining bricks keep collision',
  );
  let total = 0,
    brick = 0,
    tree = 0;
  for (let k = 0; k < 20; k++) {
    run('genMap(1)');
    brick += run('[...Array(20).keys()].filter(c=>grid[12*COLS+c]===BRICK).length');
    tree += run('[...Array(10).keys()].filter(c=>grid[12*COLS+20+c]===TREE).length');
    total++;
  }
  assert(Math.abs(brick / (total * 20) - 0.6) < 0.08 && Math.abs(tree / (total * 10) - 0.6) < 0.1, 'Old b/t keep their 60% probability');
  assert(run('campaignMaps().every(m=>normalizeMap(m))'), 'Built-in campaign still reads');
  run("PREFS.mapMode='original';");
  // превью, миниатюры и палитра рисуют новые клетки
  run("{const g=document.createElement('canvas').getContext('2d');drawMapCells(g,['RDL.'],10,false);}");
  assert(
    run("miniGrid(['RDL']).includes('t-R')&&miniGrid(['RDL']).includes('t-D')&&miniGrid(['RDL']).includes('t-L')"),
    'Thumbnails use the new cell classes',
  );
  const css = fs.readFileSync(root + '/index.html', 'utf8');
  for (const ch of 'RDL') assert(css.includes('.t-' + ch + ' '), 'Palette style for ' + ch);

  // ---------- 6. Panzerwerfer 42 ----------
  assert(loaded.includes('assets/vehicles/panzerwerfer-42.png'), 'Rocket launcher sheet is preloaded');
  assert.equal(run('KINDS.rocket.hp'), 2);
  assert.equal(run('KINDS.rocket.bulletSpeed'), 1200);
  assert.equal(run('KIND_NAMES.rocket'), 'Panzerwerfer 42 (РСЗО)');
  run(
    clean +
      "CFG.rocketVolleyGap=.8;player.x=5*T+16;player.y=15*T+16;player.inv=0;player.hp=player.maxHp=99;var ally1=makeAlly(20*T+16,15*T+16);ally1.inv=0;ally1.hp=ally1.maxHp=99;allies=[ally1];const L=makeTank(15*T+16,3*T+16,'rocket');L.spawnT=0;L.entering=false;L.rocketCd=0;enemies=[L];var RL=L;var log=[];",
  );
  const step = n =>
    run(
      `for(let k=0;k<${n};k++){updateEnemy(RL,1/60);updateRockets(1/60);simTime+=1/60;log.push([RL.salvo?RL.salvo.points.length:-1,rockets.length]);}`,
    );
  step(1);
  assert.equal(run('RL.salvo.points.length'), 1, 'First zone at once');
  step(58);
  assert.equal(run('RL.salvo.points.length'), 1);
  step(3);
  assert.equal(run('RL.salvo.points.length'), 2, 'Second zone after 1 s');
  step(60);
  assert.equal(run('RL.salvo.points.length'), 3, 'Third zone after 2 s');
  assert(
    run('RL.salvo.points[0].src===player&&RL.salvo.points[1].src===ally1&&RL.salvo.points[2].src===base'),
    'Targets: player, ally, then base',
  );
  assert(run('RL.salvo.points.every(p=>Number.isFinite(p.x))&&rocketZones().size===3'), 'Three zones visible');
  run('var pts0=JSON.stringify(RL.salvo.points.map(p=>[p.x,p.y]));player.x+=60;');
  step(170);
  assert.equal(run('rockets.length'), 0, 'No launch during the 3 s wait');
  assert.equal(run('JSON.stringify(RL.salvo.points.map(p=>[p.x,p.y]))'), run('pts0'), 'Marked points stay in place');
  run('player.x-=60;');
  step(86);
  assert.equal(run('rockets.length+0'), 3, 'First volley: three rockets at 6 s');
  assert(run('new Set(rockets.map(r=>r.point)).size===3'), 'One rocket per zone');
  run('var hp0=player.hp,hpA=ally1.hp,base0=base.hp;CFG.invulnTime=0;');
  step(60);
  assert.equal(run('RL.salvo'), null, 'Cycle state cleared after the second volley');
  step(120);
  assert.equal(run('rockets.length'), 0, 'All rockets landed');
  assert.equal(run('hp0-player.hp'), 2, 'Player zone: two rockets x 1 damage');
  assert(run('ally1.dead||ally1.hp<hpA'), 'Ally zone hit');
  assert.equal(run('base0-base.hp'), 2, 'Base zone: two rockets x 1 damage');
  run('CFG.invulnTime=.7;');
  // Траектории: разные кривые, конец точно в точке, длина кривой задаёт время полёта.
  run('resetArtillery();var tp={x:600,y:500};launchRocket(100,100,tp,0);launchRocket(100,100,tp,1);launchRocket(100,100,tp,2);');
  assert(run('rockets.every(r=>r.pts[ROCKET_SAMPLES].x===600&&r.pts[ROCKET_SAMPLES].y===500)'), 'Curves end exactly at the target');
  assert(
    run('new Set(rockets.map(r=>Math.round(r.length))).size===3&&rockets.some(r=>r.length>Math.hypot(500,400)*1.3)'),
    'Different curves, some looping',
  );
  run(
    'var t1=rockets[0].length/rockets[0].speed;KINDS.rocket.bulletSpeed=600;resetArtillery();launchRocket(100,100,tp,0);var t2=rockets[0].length/rockets[0].speed;KINDS.rocket.bulletSpeed=1200;',
  );
  assert(run('t2>t1*1.5'), 'Speed setting changes flight time');
  run('for(let k=0;k<200;k++){updateRockets(1/60);}');
  assert(run('rocketTrails.length===0&&rockets.length===0'), 'Trails fade out');
  run('launchRocket(100,100,tp,0);for(let k=0;k<30;k++)updateRockets(1/60);');
  assert(run('rockets[0].trail.length<=ROCKET_CONFIG.trail'), 'Trail points are capped');
  // Гибель до второго залпа отменяет оставшиеся пуски, выпущенные ракеты долетают.
  run(
    clean +
      "player.x=5*T+16;player.y=15*T+16;player.hp=player.maxHp=99;const L2=makeTank(15*T+16,3*T+16,'rocket');L2.spawnT=0;L2.rocketCd=0;enemies=[L2];RL=L2;log=[];",
  );
  run('var launches=0;const launchOriginal=launchRocket;launchRocket=(...a)=>{launches++;return launchOriginal(...a);};');
  step(6 * 60 + 20);
  assert.equal(run('rockets.length'), 3, 'First volley in flight');
  run('var statBefore=operationStats.enemies.rocket;hitEnemy(RL,{x:RL.x,y:RL.y,dmg:99});var landed=0;');
  // обычный цикл игры: мёртвая РСЗО убирается из enemies, второй залп больше не стартует
  run(
    'for(let k=0;k<180;k++){enemies=enemies.filter(e=>!e.dead);for(const e of enemies)updateEnemy(e,1/60);const n=rockets.length;updateRockets(1/60);landed+=n-rockets.length;simTime+=1/60;}launchRocket=launchOriginal;',
  );
  assert(run('launches===3&&landed===3&&rockets.length===0'), 'Second volley cancelled, launched rockets land after the launcher dies');
  assert.equal(run('operationStats.enemies.rocket-statBefore'), 1, 'Statistics count the launcher once');
  assert(run("wrecks.some(w=>w.kind==='rocket')"), 'Launcher leaves a wreck');
  // Пауза и смена карты; завершение уровня ждёт ракеты.
  run(
    clean +
      "launchRocket(100,100,{x:600,y:500},0);state='pause';const age=rockets[0].age;update(.1);var paused=rockets[0].age===age;state='play';",
  );
  assert(run('paused'), 'Pause stops flight');
  run('toSpawn=[];enemies=[];wrecks=[];player.upgradeT=0;update(1/60);');
  assert.equal(run('state'), 'play', 'Level does not end while rockets fly');
  run('nextWave();');
  assert(run('rockets.length===0&&rocketTrails.length===0&&rocketZones().size===0'), 'Map change clears rockets, trails and zones');
  // Отрисовка: атлас по кадрам пусковой, зоны, ракеты, титры победы.
  draws.length = 0;
  run("const L3=makeTank(300,300,'rocket');L3.turret=L3.angle+Math.PI/2;drawPlayerModel(L3);");
  const frameDraw = draws.find(d => d[1] === 'image' && d[2].source === 'assets/vehicles/panzerwerfer-42.png');
  assert(frameDraw && frameDraw[3] === 64, 'Launcher aimed right uses frame 1');
  run('vehicleSheets.rocket.loaded=false;');
  draws.length = 0;
  run("drawPlayerModel(makeTank(300,300,'rocket'))");
  assert(!draws.some(d => d[1] === 'image'), 'Fallback model without the sheet');
  run('vehicleSheets.rocket.loaded=true;');
  run('launchRocket(100,100,{x:600,y:500},0);for(let k=0;k<5;k++)updateRockets(1/60);drawRocketZones();drawRockets();draw();');
  run('enterVictory();');
  assert(run("STAT_ENEMY_TYPES.includes('rocket')"), 'Victory credits include the launcher');
  assert(run("waveList(1).every(k=>k!=='rocket')"), 'No launchers in the first wave');
  run('CFG.rocketChance=1;var wl=waveList(3);CFG.rocketChance=.06;');
  assert(run("wl.filter(k=>k==='rocket').length===CFG.waveBase+2*CFG.wavePerLevel"), 'Launchers are added on top of the wave');
};
if (require.main === module) {
  module.exports(require('node:path').join(__dirname, '..'));
  console.log('PASS: features');
}
