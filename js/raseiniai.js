'use strict';
// Сценарий 'raseiniai' — сюжетная миссия «Расейняй, Литва»: фазы сюжета, сценарные волны и эвакуация.
// Всё состояние миссии живёт в объекте raseiniai и используется только файлами raseiniai*.js;
// ядро обращается к миссии через функции сценария, зарегистрированные в конце файла (см. scenarios.js).
// Тексты реплик и сюжета — содержание сценария и лежат здесь, а не в ui-text.js.
const RASEINIAI_ASSETS = 'assets/raseiniai/';
const RASEINIAI_EXITS = [8, 21];
const RASEINIAI_FIRST_SPAWN = [1.4, 2];
const RASEINIAI_TRANSLATION_DELAY = 0.5;
const RASEINIAI_REPAIR_COST = 2;
const RASEINIAI_START_SCRAP = 4;
const RASEINIAI_WAVE2_LEFT = 2;
const RASEINIAI_TITLE_STEP = 1.3;
const RASEINIAI_TITLE_FADE = 0.65;
const RASEINIAI_TITLE_END = 2 * RASEINIAI_TITLE_STEP + RASEINIAI_TITLE_FADE;
const RASEINIAI_MAP_REVEAL = 1.2;
const RASEINIAI_CIVILIAN_DELAY = 2;
const RASEINIAI_RADIO_BLIP_INTERVAL = 0.055;
const RASEINIAI_CAMERA = { zoom: 1.6, approach: 0.8, return: 0.55 };
const RASEINIAI_TITLE = 'Расейняй, Литва';
const RASEINIAI_SUBTITLE = 'Приграничные танковые бои — июнь 1941';
const RASEINIAI_ESTIMATES = ['9–12 тыс. солдат', '10–14 тыс. человек', '746'];
const RASEINIAI_RADIO = {
  order: [
    ['Товарищ, не знаю как вы здесь оказались, но должен доложить.'],
    ['Против нас выступает четвертая танковая группа Вермахта под командованием Эриха Гёпнера.'],
    ['Приказываю продержаться до окончания эвакуации гражданских!'],
  ],
  retreat: 'Мы закончили эвакуацию! Противников слишком много! Приказываю отступать!!!',
  fire: ['Feuer frei!', 'Огонь!'],
  german: [
    ['Herr Oberst, hier spricht Generaloberst Erich Hoepner.', 'Полковник, с вами говорит генерал-полковник Эрих Гёпнер'],
    ['Was ist mit Ihrer Truppe los?!', 'Что у вас там с войсками?!'],
    ['WAS HEISST DAS, EIN EINZIGER PANZER HAT IHRE BRIGADE ZERSCHLAGEN?!', 'ЧТО ЗНАЧИТ ОДИН ТАНК РАЗБИЛ ВАШУ БРИГАДУ?!'],
    ['ICH HABE DEN ANGRIFF BEFOHLEN!', 'Я ПРИКАЗАЛ АТАКОВАТЬ!'],
  ],
};
const raseiniaiGroup = (kind, lanes, column = false) => ({ kind, lanes, column });
const raseiniaiSingles = (kind, count) => raseiniaiGroup(kind, Array(count).fill(null));
const raseiniaiColumn = (kind, lane) => raseiniaiGroup(kind, [lane, lane, lane], true);
const RASEINIAI_WAVES = [
  [raseiniaiSingles('scout', 10)],
  [raseiniaiColumn('scout', 2), raseiniaiColumn('scout', 4), raseiniaiSingles('scout', 4), raseiniaiSingles('moto', 5)],
  [
    raseiniaiColumn('scout', 2),
    raseiniaiColumn('scout', 4),
    raseiniaiGroup('moto', [3, 3, 2, 4]),
    raseiniaiColumn('moto', 1),
    raseiniaiColumn('moto', 5),
  ],
  [
    [1, 2].map(lane => raseiniaiColumn('scout', lane)),
    [3, 4].map(lane => raseiniaiColumn('scout', lane)),
    raseiniaiColumn('scout', 5),
    raseiniaiGroup('moto', [2, 3, 4, 2, 3, 4]),
    raseiniaiSingles('scout', 5),
  ],
];

let raseiniai = null,
  raseiniaiMill = null,
  raseiniaiScreen = null;

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
  activateScenario('raseiniai');
  resetStatistics();
  resetOperation();
  raseiniai = { phase: 'civilians', age: 0, tracks: [], breaches: 0, firstKills: 0, evac: [], dirty: true, dialogue: null };
  state = 'story';
  campaign = null;
  victory = false;
  base = null;
  player = null;
  activeMap = RASEINIAI_MAP;
  mapMode = 'map';
  configureMap(activeMap.cols);
  genMap(1, true);
  setBaseWall((ROWS - 1) * COLS + 15, BRICK);
  buildMillContour();
  devOpen = false;
  score = wave = shake = hitstop = 0;
  scrap = RASEINIAI_START_SCRAP;
  mouse.down = mouse.right = false;
  evacuateRaseiniai(7);
  syncMusic();
}

function repairRaseiniaiTank() {
  if (!player || player.dead || player.hp >= player.maxHp) return;
  if (scrap < RASEINIAI_REPAIR_COST) {
    const x = player.x,
      y = player.y - player.r - 16;
    const notice = raseiniai.repairNotice;
    if (parts.includes(notice)) Object.assign(notice, { x, y, life: notice.max });
    else raseiniai.repairNotice = floatText(x, y, UI_TEXT.raseiniaiNoScrap, '#ffc37a');
    sfx('repairDenied');
    return;
  }
  scrap -= RASEINIAI_REPAIR_COST;
  player.hp = Math.min(player.maxHp, player.hp + 1);
  sfx('pick');
}

function raseiniaiPhase(phase) {
  raseiniai.phase = phase;
  raseiniai.age = 0;
  raseiniai.dirty = true;
}

function evacuateRaseiniai(count, trucks = false) {
  const roadY = (ROWS - 3.5) * T;
  for (let i = 0; i < count; i++) {
    const side = i % 2,
      margin = trucks ? 24 : 10;
    raseiniai.evac.push({
      x: side ? W + margin : -margin,
      y: roadY + (trucks ? 0 : rnd(-7, 7)),
      turnX: RASEINIAI_EXITS[side] * T + T / 2,
      delay: trucks ? i * 0.64 : Math.floor(i / 2) * 0.22,
      speed: trucks ? 118 : rnd(96, 128),
      truck: trucks,
      step: 0,
      coat: ['#79633d', '#654450', '#525944'][i % 3],
    });
  }
}

function raseiniaiDialogue(kind, lines, done) {
  raseiniai.dialogue = { kind, lines, done, index: 0, elapsed: 0, shown: 0, complete: false, translationWait: 0, blipAt: 0 };
  raseiniai.dirty = true;
}

function advanceRaseiniai() {
  const d = raseiniai.dialogue;
  if (d) {
    if (!d.complete) finishRaseiniaiLine(d);
    else if (d.translationWait > 0) return;
    else if (++d.index < d.lines.length) {
      d.elapsed = d.shown = d.translationWait = d.blipAt = 0;
      d.complete = false;
    } else {
      raseiniai.dialogue = null;
      d.done();
    }
    raseiniai.dirty = true;
  } else if (raseiniai.phase === 'title' && raseiniaiTankInPosition() && raseiniaiTitleRevealed()) startRaseiniaiOrders();
  else if (raseiniai.phase === 'newspaper') raseiniaiPhase('timeline');
  else if (raseiniai.phase === 'timeline') raseiniaiPhase('farewell');
}

function raseiniaiStoryInput(e) {
  if (!raseiniai || state !== 'story') return false;
  if (e.code === 'Space' && raseiniai.phase !== 'newspaper') {
    e.preventDefault();
    const fresh = !e.repeat && !keys.Space;
    keys.Space = true;
    if (fresh && raseiniai.phase === 'farewell' && e.target?.dataset?.raseiniai === 'home') toMenu();
    else if (fresh) advanceRaseiniai();
    return true;
  }
  return e.code !== 'Tab' && e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'KeyM';
}

function raseiniaiBombardment() {
  const targets = [];
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < COLS; c++) {
      if (raseiniaiMillCell(c, r) || (r < 3 && SPAWNS.some(s => Math.abs(s.c - c) <= 1))) continue;
      targets.push([c * T + T / 2, r * T + T / 2]);
    }
  raseiniai.bombardment = Array.from({ length: 15 }, () => targets.splice(ri(0, targets.length - 1), 1)[0]);
  raseiniai.bombardmentAt = 0;
  raseiniaiPhase('bombardment');
}

function updateRaseiniaiEvacuation(dt) {
  const s = raseiniai;
  for (const unit of s.evac) {
    unit.delay -= dt;
    if (unit.delay > 0) continue;
    let distance = unit.speed * dt;
    if (unit.x !== unit.turnX) {
      const dx = unit.turnX - unit.x;
      const step = Math.min(distance, Math.abs(dx));
      unit.x = step === Math.abs(dx) ? unit.turnX : unit.x + Math.sign(dx) * step;
      distance -= step;
    }
    unit.y += distance;
    unit.step += dt * 13;
  }
  s.evac = s.evac.filter(unit => unit.y < H + 22);
}

function finishRaseiniaiLine(d) {
  d.complete = true;
  const delay = raseiniai.phase === 'german' ? RASEINIAI_TRANSLATION_DELAY / 1.5 : RASEINIAI_TRANSLATION_DELAY;
  d.translationWait = d.lines[d.index][1] ? delay : 0;
}

function raseiniaiReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function raseiniaiTitleRevealed() {
  return raseiniai.age >= RASEINIAI_TITLE_END || raseiniaiReducedMotion();
}

function raseiniaiMapShade() {
  if (!raseiniai || raseiniai.phase !== 'civilians' || raseiniai.age >= RASEINIAI_MAP_REVEAL || raseiniaiReducedMotion()) return 0;
  const progress = clamp(raseiniai.age / RASEINIAI_MAP_REVEAL, 0, 1);
  return 1 - progress * progress * (3 - 2 * progress);
}

function updateRaseiniaiStory(dt) {
  const s = raseiniai;
  s.age += dt;
  updateRaseiniaiEvacuation(dt);
  if (s.phase === 'civilians' && !s.civilianWarned) {
    if (s.civilianSeenAt === undefined && s.evac.some(unit => unit.delay <= 0 && unit.x >= 0 && unit.x <= W)) {
      s.civilianSeenAt = s.age;
    }
    if (s.age - s.civilianSeenAt >= RASEINIAI_CIVILIAN_DELAY) {
      s.civilianWarned = true;
      raseiniaiDialogue('civilian', [['НЕМЦЫ! Немецкие танки наступают!!!']], () => {});
    }
  }
  const d = s.dialogue;
  if (d && !d.complete) {
    d.elapsed += dt;
    const pause = d.kind === 'civilian' && d.elapsed > 0.2 ? Math.min(0.38, d.elapsed - 0.2) : 0;
    const line = d.lines[d.index][0],
      previous = d.shown;
    d.shown = Math.min(line.length, Math.floor((d.elapsed - pause) * 35));
    if (d.kind !== 'civilian' && d.elapsed >= d.blipAt && /\p{L}/u.test(line.slice(previous, d.shown))) {
      sfx(d.kind === 'german' ? 'radioGerman' : 'radioSoviet');
      d.blipAt = d.elapsed + RASEINIAI_RADIO_BLIP_INTERVAL;
    }
    if (d.shown === line.length) finishRaseiniaiLine(d);
  } else if (d) d.translationWait = d.translationWait - dt > 1e-9 ? d.translationWait - dt : 0;
  if (s.phase === 'civilians' && s.civilianWarned && !s.evac.length && !s.dialogue) {
    raseiniaiPhase('fireOrder');
    raseiniaiDialogue('german', [RASEINIAI_RADIO.fire], raseiniaiBombardment);
  }
  if (s.phase === 'bombardment') {
    updateArtilleryShells(dt);
    s.bombardmentAt -= dt;
    if (s.bombardment.length && s.bombardmentAt <= 0) {
      const [x, y] = s.bombardment.shift();
      launchArtillery(x + rnd(-36, 36), -T, x, y, false, { delay: 2, speed: 3000 });
      s.bombardmentAt = s.bombardment.length % 5 === 0 ? 0.9 : 0.15;
    }
    if (!s.bombardment.length && !artilleryShells.length) {
      player = makeTank(RASEINIAI_EXITS[0] * T + T / 2, H + 26, 'player');
      raseiniaiPhase('title');
    }
  }
  if (s.phase === 'title') {
    const step = Math.min(player.y - (H - 2.5 * T), dt * KINDS.player.speed);
    player.y -= step;
    player.tread = (player.tread + step) % 6;
  }
  if (s.phase === 'ordersOut' && s.age >= RASEINIAI_CAMERA.return) {
    startRaseiniaiWave(1);
    resumeRaseiniaiBattle();
  }
  if (s.phase === 'german' && !s.evac.length && !s.dialogue) {
    startRaseiniaiWave(4);
    resumeRaseiniaiBattle();
  }
  if (s.phase === 'evacuation' && !s.evac.length) {
    raseiniaiPhase('retreat');
    raseiniaiDialogue('soviet', [[RASEINIAI_RADIO.retreat]], () => {
      s.victoryZoom = raseiniaiCameraScale();
      raseiniaiPhase('victory');
      sfx('wave');
    });
  }
  if (s.phase === 'victory' && s.age >= 2.5) raseiniaiPhase('newspaper');
}

function raseiniaiTankInPosition() {
  return player && player.y === H - 2.5 * T;
}

function startRaseiniaiOrders() {
  raseiniaiPhase('orders');
  raseiniaiDialogue('soviet', RASEINIAI_RADIO.order, () => {
    raseiniai.returnZoom = raseiniaiCameraScale();
    raseiniaiPhase('ordersOut');
  });
}

function raseiniaiCameraScale() {
  if (!raseiniai || !player) return 1;
  const { phase, age, returnZoom } = raseiniai;
  if (phase === 'victory' || phase === 'newspaper') return raseiniai.victoryZoom ?? 1;
  if (phase !== 'orders' && phase !== 'ordersOut' && phase !== 'retreat') return 1;
  const returning = phase === 'ordersOut';
  const progress = clamp(age / (returning ? RASEINIAI_CAMERA.return : RASEINIAI_CAMERA.approach), 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  return returning ? 1 + (returnZoom - 1) * (1 - eased) : 1 + (RASEINIAI_CAMERA.zoom - 1) * eased;
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
  const batches = RASEINIAI_WAVES[number - 1].map(batch =>
    [].concat(batch).map(group => ({ ...group, slot: 0, entered: [], timer: number === 3 ? 0 : 0.65 })),
  );
  const pending = batches.flat().reduce((total, group) => total + group.lanes.length, 0);
  raseiniai.tracks.push({ number, batches, pending });
  banner = { text: number === 4 ? '4-я волна. Штурм' : number + '-я волна', sub: '', t: 2.2 };
  sfx('wave');
}

function raseiniaiEnemyCount() {
  return enemies.filter(e => !e.dead).length + raseiniai.tracks.reduce((total, track) => total + track.pending, 0);
}

function raseiniaiSpawnFree(s) {
  const x = s.c * T + T / 2,
    y = s.r * T + T / 2;
  return ![...enemies, player].some(t => t && !t.dead && ((t.entering && t.x === x) || Math.hypot(t.x - x, t.y - y) < t.r + 13));
}

function raseiniaiBatchCleared(batch) {
  return batch.every(group => group.slot === group.lanes.length && !group.entered.some(t => !t.dead && t.entering));
}

function updateRaseiniaiSpawns(dt) {
  // Вторая волна — когда от первой (живые и ещё не въехавшие) осталось не больше двух танков.
  if (wave === 1 && raseiniaiEnemyCount() <= RASEINIAI_WAVE2_LEFT) {
    evacuateRaseiniai(3, true);
    startRaseiniaiWave(2);
  }
  for (const track of raseiniai.tracks) {
    if (!track.batches.length || (track.number === 3 && banner.t > 0)) continue;
    if (raseiniaiBatchCleared(track.batches[0])) {
      track.batches.shift();
      for (const group of track.batches[0] || []) group.timer = 0;
    }
    for (const group of track.batches[0] || []) {
      group.timer -= dt;
      if (group.slot === group.lanes.length || group.timer > 0) continue;
      const lane = group.lanes[group.slot];
      const available = (lane ? [SPAWNS[lane - 1]] : SPAWNS).filter(raseiniaiSpawnFree);
      if (!available.length) continue;
      const spawn = available[ri(0, available.length - 1)];
      const e = makeTank(spawn.c * T + T / 2, -32, group.kind);
      e.angle = e.turret = Math.PI / 2;
      e.entering = true;
      e.storyWave = track.number;
      if (group.kind === 'scout') e.storyExit = raseiniaiRoadPath({ x: e.x, y: spawn.r * T + T / 2 }).exit;
      if (group.column) e.storyColumn = group.entered;
      group.entered.push(e);
      enemies.push(e);
      group.slot++;
      track.pending--;
      group.timer = group.column ? 0.55 : track.number === 1 ? rnd(...RASEINIAI_FIRST_SPAWN) : rnd(0.6, 1.1);
    }
  }
}

function raseiniaiFormColumns() {
  for (const e of enemies) {
    if (!e.storyColumn || e.kind === 'moto' || e.entering) continue;
    const ready = e.storyColumn.filter(t => !t.dead && !t.entering);
    const slot = ready.indexOf(e);
    e.leader = slot > 0 ? ready[0] : null;
    e.columnSlot = Math.max(0, slot);
  }
}

function finishRaseiniaiBattle() {
  if (wave < 2 || raseiniaiEnemyCount() || raseiniai.tracks.some(t => t.batches.length) || wrecks.some(w => w.exploded === false)) return;
  collectRemainingScrap();
  if (wave === 2) {
    evacuateRaseiniai(2, true);
    startRaseiniaiWave(3);
    return;
  }
  bullets = [];
  if (wave === 4) saveBestScore();
  evacuateRaseiniai(wave === 4 ? 3 : 2, true);
  state = 'story';
  if (wave === 3) {
    raseiniaiPhase('german');
    raseiniaiDialogue('german', RASEINIAI_RADIO.german, () => {});
  } else raseiniaiPhase('evacuation');
}

function raseiniaiRoadPath(e) {
  const start = Math.floor(e.y / T) * COLS + Math.floor(e.x / T),
    queue = [start];
  const previous = new Int32Array(grid.length).fill(-1);
  previous[start] = start;
  const exits = RASEINIAI_EXITS.map(c => (ROWS - 1) * COLS + c);
  for (let j = 0; j < queue.length; j++) {
    let i = queue[j];
    if (exits.includes(i)) {
      const path = [];
      while (i !== start) {
        path.push(i);
        i = previous[i];
      }
      return { path: path.reverse(), exit: queue[j] % COLS };
    }
    const c = i % COLS,
      r = Math.floor(i / COLS);
    for (const [dc, dr] of DIRS) {
      const x = c + dc,
        y = r + dr,
        n = y * COLS + x;
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS && road[n] && previous[n] < 0) {
        previous[n] = i;
        queue.push(n);
      }
    }
  }
  return null;
}

function updateRaseiniaiMoto(e, dt) {
  if (!e.storyRoute) {
    e.storyRoute = raseiniaiRoadPath(e);
    e.storyMile = 0;
    if (!e.storyRoute) return;
  }
  const { path, exit } = e.storyRoute;
  if (e.dropT > 0) {
    e.vx = e.vy = 0;
    e.dropT -= dt;
    if (!e.dropped && e.dropT <= MOTO_DROP_TIME / 2) {
      e.dropped = true;
      plantCharge(e, e.dropWhat);
    }
    return;
  }
  if (!path.length && driveExit(e, exit, motoSpeed(), dt)) return;
  const i = path[0] ?? (ROWS - 1) * COLS + exit;
  e.tx = (i % COLS) * T + T / 2;
  e.ty = Math.floor(i / COLS) * T + T / 2;
  if (path.length && Math.hypot(e.tx - e.x, e.ty - e.y) < 1) {
    path.shift();
    e.storyMile++;
    if (e.minesLeft > 0 && e.storyMile % 4 === 0 && path.length > 2) startDrop(e, { kind: 'mine' });
  } else {
    const distance = Math.hypot(e.tx - e.x, e.ty - e.y);
    const queued = enemies.some(
      other =>
        other !== e &&
        !other.dead &&
        other.kind === 'moto' &&
        other.storyRoute?.path[0] === i &&
        Math.hypot(other.x - e.x, other.y - e.y) < e.r + other.r + 4 &&
        Math.hypot(e.tx - other.x, e.ty - other.y) < distance - 1,
    );
    if (queued) e.vx = e.vy = 0;
    else driveMoto(e, dt);
  }
}

function raseiniaiMillCell(c, r) {
  const m = RASEINIAI_MILL;
  return c >= m.c && c < m.c + m.size && r >= m.r && r < m.r + m.size;
}

// Мельница — фигурное препятствие (SOLID) с контуром по маске RASEINIAI_MILL: столкновения,
// видимость и маршруты считает world.js по этому контуру.
function buildMillContour() {
  const m = RASEINIAI_MILL,
    step = (m.size * T) / m.mask.length,
    cells = new Map();
  for (let r = m.r; r < m.r + m.size; r++) for (let c = m.c; c < m.c + m.size; c++) cells.set(r * COLS + c, []);
  for (let j = 0; j < m.mask.length; j++) {
    const row = m.mask[j],
      y = j * step,
      r = Math.floor(y / T);
    for (let k = 0; k < row.length; k += 2) {
      const end = row[k + 1] * step;
      for (let x = row[k] * step; x < end;) {
        const c = Math.floor(x / T),
          right = Math.min(end, (c + 1) * T);
        cells.get((m.r + r) * COLS + m.c + c).push({ x: x + m.c * T, y: y + m.r * T, w: right - x, h: step });
        x = right;
      }
    }
  }
  addSolid(cells);
  raseiniai.millOutline = [...cells.values()].flat();
}

function raseiniaiResults(n) {
  return [3000 + 126 * n + '–' + (5000 + 126 * n), 4000 + 143 * n + '–' + (6000 + 143 * n), String(211 + 2 * n)];
}

// ---------- регистрация сценария ----------
// Единственная связь миссии с ядром. Назначение каждой функции описано в scenarios.js.
defineScenario('raseiniai', {
  menuButton: 'mode-story',
  start: startRaseiniai,
  stop() {
    raseiniai = null;
  },
  init: initRaseiniai,
  syncUI: () => syncRaseiniaiUI(),
  retryOnDefeat: () => true,
  updateStory: updateRaseiniaiStory,
  updateBattle(dt) {
    updateRaseiniaiEvacuation(dt);
    if (!player.dead) updateRaseiniaiSpawns(dt);
    raseiniaiFormColumns();
  },
  afterBattle: finishRaseiniaiBattle,
  keydown(e, held) {
    if (raseiniaiStoryInput(e)) return true;
    if (e.code === 'KeyR' && !e.repeat && !held && state === 'play') repairRaseiniaiTank();
    return false;
  },
  keyup(e) {
    if (raseiniai && e.code === 'Space') raseiniai.blockSpace = false;
  },
  blur() {
    if (raseiniai) raseiniai.blockSpace = false;
  },
  fireBlocked: () => !!(raseiniai && raseiniai.blockSpace),
  onEnemyKilled(e) {
    if (raseiniai && e.storyWave === 1 && e.kind === 'scout') raseiniai.firstKills++;
  },
  onEnemyEscaped() {
    raseiniai.breaches++;
  },
  updateMoto(e, dt) {
    if (!e.storyWave) return false;
    updateRaseiniaiMoto(e, dt);
    return true;
  },
  aiMarkup: () => RASEINIAI_AI_MARKUP,
  enemiesLeft: raseiniaiEnemyCount,
  hudHint: () => UI_TEXT.raseiniaiRepair,
  countsStatistics: () => !!raseiniai && raseiniai.phase === 'bombardment',
  cameraZoom: raseiniaiCameraScale,
  draw(layer) {
    if (layer === 'ground') drawRaseiniaiMill();
    else if (layer === 'units') drawRaseiniaiEvacuation();
    else if (layer === 'overlay') drawRaseiniaiShade();
  },
  drawFrame: () => drawRaseiniaiFinalFrame(),
});
