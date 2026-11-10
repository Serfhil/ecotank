'use strict';
// Союзные танки: появление в нижней четверти карты, собственные поля путей, выбор целей и стрельба.
// Включаются флагом CFG.allies из настроек разработчика. Используют геометрию world/destruction.js,
// движение tanks.js, оружие weapons.js и los/coverClear из enemy-ai.js; поля маршрутов у союзников свои.
// Массив allies объявлен в game.js, но его состав меняют только функции этого файла. Подключение файла ничего не создаёт.

// Зону базы (baseWall из world.js) союзники не ломают и не считают проходом.

// Клетки, достижимые танком от старта игрока: союзник не должен появиться в замкнутом кармане.
// Забор танк продавливает, поэтому он не отделяет карман.
function reachableFromStart() {
  const seen = new Uint8Array(COLS * ROWS),
    c0 = clamp(Math.floor(PLAYER_START.x / T), 0, COLS - 1),
    r0 = clamp(Math.floor(PLAYER_START.y / T), 0, ROWS - 1),
    q = [r0 * COLS + c0];
  seen[q[0]] = 1;
  for (let h = 0; h < q.length; h++) {
    const i = q[h],
      c = i % COLS,
      r = (i / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc,
        nr = r + dr;
      if (blocksCrusher(tileAt(nc, nr))) continue;
      const j = nr * COLS + nc;
      if (!seen[j]) {
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  return seen;
}

// Общее создание союзника: штатное появление, перенос между уровнями и подкрепление.
// tier применяется сразу, без анимации улучшения.
function makeAlly(x, y, tier = 0) {
  const a = makeTank(x, y, 'ally');
  a.ally = true;
  a.repathT = 0;
  a.cd = rnd(0.5, 1.2);
  if (tier > 0) setPlayerUpgrade(a, tier, true);
  return a;
}

// kept — ступени улучшения союзников, живых в конце прошлого уровня: они выезжают первыми и с теми же ступенями.
// Штатное появление (CFG.allies) добирает до allyCount новыми машинами; без него выезжают только сохранённые.
function spawnAllies(kept = []) {
  allies = [];
  const want = Math.max(kept.length, CFG.allies ? CFG.allyCount : 0);
  if (!want) return;
  const tiers = [...kept].sort((a, b) => b - a);
  while (tiers.length < want) tiers.push(0);
  const reach = reachableFromStart(),
    cells = [];
  for (let r = Math.floor((ROWS * 3) / 4); r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = c * T + 16,
        y = r * T + 16;
      if (!reach[r * COLS + c] || !coverClear(x, y, 14)) continue;
      if (Math.hypot(x - PLAYER_START.x, y - PLAYER_START.y) < 56 || (base && Math.hypot(x - base.x, y - base.y) < base.r + 40)) continue;
      cells.push({ x, y });
    }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  for (const q of cells) {
    if (allies.length >= want) break;
    if (allies.some(a => Math.hypot(a.x - q.x, a.y - q.y) < 56)) continue;
    allies.push(makeAlly(q.x, q.y, tiers[allies.length]));
  }
}

// ---------- подкрепление ----------
// Бонус «Подкрепление» ставит в очередь две машины; они выезжают снизу поля по одной в свободную безопасную точку.
// Если все точки заняты, очередь ждёт, поэтому в итоге выезжают обе. Работает и при выключенных союзниках.
let pendingReinforcements = 0,
  reinforceTimer = 0;
const REINFORCE_GAP = 0.6;
function queueReinforcements(n = 2) {
  pendingReinforcements += n;
  floatText(PLAYER_START.x, H - 40, UI_TEXT.podkreplenie_idet, '#9be36f');
}
function resetReinforcements() {
  pendingReinforcements = 0;
  reinforceTimer = 0;
}
function reinforcementEntries() {
  const reach = reachableFromStart(),
    entries = [],
    vehicles = [player, ...allies, ...enemies].filter(t => t && !t.dead);
  for (let c = 1; c < COLS - 1; c++) {
    const x = c * T + 16,
      y = H - 16;
    if (blocksCrusher(tileAt(c, ROWS - 1)) || blocksCrusher(tileAt(c, ROWS - 2)) || baseWall(c, ROWS - 1) || baseWall(c, ROWS - 2))
      continue;
    if (!reach[(ROWS - 1) * COLS + c] || !coverClear(x, y, 14, true)) continue;
    if (base && Math.hypot(x - base.x, y - base.y) < base.r + 40) continue;
    // безопасно: рядом нет машин, мин и подожжённых смертников
    if (vehicles.some(t => Math.hypot(t.x - x, t.y - y) < 44)) continue;
    if (
      mines.some(m => !m.done && Math.hypot(m.x - x, m.y - y) < 2 * T) ||
      bombers.some(b => b.state === 'lit' && Math.hypot(b.x - x, b.y - y) < 3 * T)
    )
      continue;
    entries.push({ x, y });
  }
  return entries;
}
function updateReinforcements(dt) {
  reinforceTimer -= dt;
  if (!pendingReinforcements || reinforceTimer > 0 || (state !== 'play' && state !== 'between')) return;
  const entries = reinforcementEntries();
  if (!entries.length) return;
  const q = entries[ri(0, entries.length - 1)],
    a = makeAlly(q.x, H + T * 0.75);
  a.angle = a.turret = -Math.PI / 2;
  a.entering = true;
  a.tx = q.x;
  a.ty = q.y;
  allies.push(a);
  pendingReinforcements--;
  reinforceTimer = REINFORCE_GAP;
}

// Поле расстояний союзника; без противника он не ломает стены, а обходит их.
// Клетки других союзников и их ближайшие цели дороже, чтобы пути расходились, а не шли гуськом.
function buildAllyFlow(a, tc, tr, breakWalls) {
  const busy = new Uint8Array(COLS * ROWS);
  for (const o of allies)
    if (o !== a && !o.dead)
      for (const [x, y] of [
        [o.x, o.y],
        [o.tx, o.ty],
      ]) {
        const c = Math.floor(x / T),
          r = Math.floor(y / T);
        if (c >= 0 && r >= 0 && c < COLS && r < ROWS) busy[r * COLS + c] = 1;
      }
  const f = a.flow && a.flow.length === COLS * ROWS ? a.flow : (a.flow = new Int32Array(COLS * ROWS));
  f.fill(1e9);
  const s = tr * COLS + tc,
    q = [s];
  f[s] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h],
      c = i % COLS,
      r = (i / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc,
        nr = r + dr,
        t = tileAt(nc, nr);
      // забор союзник продавливает без штрафа; ломать приходится только кирпич
      if (blocksRoute(t) || baseWall(nc, nr) || (!breakWalls && t === BRICK)) continue;
      const j = nr * COLS + nc,
        nd = f[i] + (t === BRICK ? 5 : 1) + busy[j] * 6;
      if (nd < f[j]) {
        f[j] = nd;
        q.push(j);
      }
    }
  }
}

function allyStep(a, random) {
  const c = Math.floor(a.x / T),
    r = Math.floor(a.y / T),
    f = a.flow,
    opts = [];
  for (const [dc, dr] of DIRS) {
    const nc = c + dc,
      nr = r + dr,
      t = tileAt(nc, nr),
      v = f[nr * COLS + nc];
    if (blocksRoute(t) || baseWall(nc, nr) || v >= 1e9 || (random && t === BRICK)) continue;
    opts.push({ nc, nr, t, v });
  }
  a.brick = null;
  if (!opts.length) {
    a.tx = c * T + 16;
    a.ty = r * T + 16;
    return;
  }
  const pick = random ? opts[ri(0, opts.length - 1)] : opts.reduce((p, q) => (q.v < p.v ? q : p));
  if (!random && pick.v >= f[r * COLS + c]) {
    a.tx = c * T + 16;
    a.ty = r * T + 16;
    return;
  }
  if (pick.t === BRICK) {
    a.brick = { x: pick.nc * T + 16, y: pick.nr * T + 16 };
    a.tx = c * T + 16;
    a.ty = r * T + 16;
  } else {
    a.tx = pick.nc * T + 16;
    a.ty = pick.nr * T + 16;
  }
}

const allyFoes = () => enemies.filter(e => !e.dead && !e.entering && e.spawnT <= 0);

// Цель движения: ближайший противник, причём уже выбранные другими союзниками цели
// считаются дальше — союзники расходятся по разным врагам. Без врагов союзник стоит на месте.
// Flood only traversable cell centres; no destructive routes to a pickup.
function findAllyItem(a) {
  const reach = new Uint8Array(COLS * ROWS),
    start = Math.floor(a.y / T) * COLS + Math.floor(a.x / T),
    q = [start];
  reach[start] = 1;
  for (let n = 0; n < q.length; n++) {
    const i = q[n],
      c = i % COLS,
      r = (i / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc,
        nr = r + dr,
        j = nr * COLS + nc;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || reach[j] || blocksCrusher(tileAt(nc, nr)) || baseWall(nc, nr)) continue;
      const x = nc * T + 16,
        y = nr * T + 16;
      if (!coverClear(x, y, a.r, true) || (base && !base.dead && Math.hypot(x - base.x, y - base.y) < base.r + a.r)) continue;
      reach[j] = 1;
      q.push(j);
    }
  }
  return (
    items
      .filter(
        it => itemUseful(a, it) && Math.hypot(it.x - a.x, it.y - a.y) <= 5 * T && reach[Math.floor(it.y / T) * COLS + Math.floor(it.x / T)],
      )
      .sort(
        (x, y) =>
          Math.hypot(x.x - a.x, x.y - a.y) +
          (allies.some(o => o !== a && !o.dead && o.itemGoal === x) ? 1000 : 0) -
          (Math.hypot(y.x - a.x, y.y - a.y) + (allies.some(o => o !== a && !o.dead && o.itemGoal === y) ? 1000 : 0)),
      )[0] || null
  );
}
function allyGoal(a, foes) {
  if (a.itemScanT <= 0 || a.itemScanT === undefined || (a.itemGoal && (!items.includes(a.itemGoal) || !itemUseful(a, a.itemGoal)))) {
    const old = a.itemGoal;
    a.itemGoal = findAllyItem(a);
    a.itemScanT = 0.5;
    if (old !== a.itemGoal) {
      a.repathT = 0;
      a.tx = a.x;
      a.ty = a.y;
    }
  }
  if (a.itemGoal) return { ...a.itemGoal, pickup: true };
  let best = null,
    bd = 1e9;
  for (const e of foes) {
    const taken = allies.some(o => o !== a && !o.dead && o.goal === e),
      d = Math.hypot(e.x - a.x, e.y - a.y) + (taken ? 200 : 0);
    if (d < bd) {
      best = e;
      bd = d;
    }
  }
  a.goal = best;
  return best || { x: a.x, y: a.y, idle: true };
}

// Не стрелять, если снаряд по линии ствола может попасть в свою базу.
function shotHitsBase(a) {
  if (!base || base.dead) return false;
  const dx = Math.cos(a.turret) * 900,
    dy = Math.sin(a.turret) * 900,
    l = dx * dx + dy * dy;
  const k = clamp(((base.x - a.x) * dx + (base.y - a.y) * dy) / l, 0, 1);
  return Math.hypot(a.x + dx * k - base.x, a.y + dy * k - base.y) < base.r + 8;
}

function updateAlly(a, dt) {
  if (a.dead) return;
  // подкрепление выезжает из-за нижнего края прямо вверх, без столкновений с границей поля
  if (a.entering) {
    const step = KINDS.ally.speed * dt;
    a.y -= step;
    a.tread = (a.tread + step) % 6;
    a.vx = 0;
    a.vy = -KINDS.ally.speed;
    a.flash -= dt;
    if (a.y <= a.ty) {
      a.y = a.ty;
      a.entering = false;
      a.vy = 0;
      a.decideT = 0;
      a.repathT = 0;
    }
    return;
  }
  if (updateTankUpgrade(a, dt)) return;
  for (const k in a.pw) a.pw[k] = Math.max(0, a.pw[k] - dt);
  a.itemScanT = (a.itemScanT || 0) - dt;
  const K = KINDS.ally;
  a.flash -= dt;
  a.cd -= dt;
  a.inv -= dt;
  a.decideT -= dt;
  a.repathT -= dt;
  a.recoil = (a.recoilMax || 5) * clamp(a.cd / K.fireRate, 0, 1);
  const foes = allyFoes();
  let foe = null,
    fd = 1e9;
  for (const e of foes) {
    const d = Math.hypot(e.x - a.x, e.y - a.y),
      hidden = tileAt(Math.floor(e.x / T), Math.floor(e.y / T)) === TREE && d > CFG.treeStealth;
    if (d < fd && !hidden && d < CFG.enemySight && los(a.x, a.y, e.x, e.y)) {
      foe = e;
      fd = d;
    }
  }
  const goal = allyGoal(a, foes);
  if (a.repathT <= 0 && !goal.idle) {
    a.repathT = 0.5;
    buildAllyFlow(a, clamp(Math.floor(goal.x / T), 0, COLS - 1), clamp(Math.floor(goal.y / T), 0, ROWS - 1), !goal.pickup);
  }

  if (a.stuck > 0.7 && !goal.idle) {
    a.stuck = 0;
    allyStep(a, true);
    a.decideT = 0.5;
  } else if (!goal.idle && Math.hypot(a.tx - a.x, a.ty - a.y) < 1.5 && a.decideT <= 0) {
    allyStep(a, false);
    a.decideT = a.brick ? 0.35 : 0;
  }
  if (goal.idle) a.brick = null;
  const hold = goal.idle || (!goal.pickup && foe && fd < K.hold);
  const mx = a.tx - a.x,
    my = a.ty - a.y,
    md = Math.hypot(mx, my);
  a.vx = a.vy = 0;
  if (!hold && md > 0.5) {
    const step = Math.min(md, K.speed * dt);
    a.angle = turnTo(a.angle, Math.atan2(my, mx), dt * 8);
    const moved = moveTank(a, (mx / md) * step, (my / md) * step, dt, md);
    if (step > 0.5 && moved < step * 0.3) a.stuck += dt;
    else a.stuck = Math.max(0, a.stuck - dt);
  }

  let target = null;
  if (foe) {
    const lead = (fd / K.bulletSpeed) * 0.6;
    target = { x: foe.x + (foe.vx || 0) * lead, y: foe.y + (foe.vy || 0) * lead };
  } else if (a.brick) target = a.brick;
  const aim = target ? Math.atan2(target.y - a.y, target.x - a.x) : a.angle;
  a.turret = turnTo(a.turret, aim, dt * K.turretSpeed);
  if (target && a.cd <= 0 && Math.abs(angDiff(a.turret, aim)) < 0.12 && !shotHitsBase(a)) {
    if (foe && a.rail > 0) fireRail(a);
    else {
      fire(a);
      a.cd = a.reloadDuration = K.fireRate * (a.pw.rapid > 0 ? 0.45 : 1);
    }
  }
}

function hitAlly(a, b) {
  if (a.dead || a.inv > 0 || a.upgradeT > 0) return;
  if (a.pw.shield > 0) {
    sfx('deflect');
    return;
  }
  a.hp -= b.dmg;
  a.flash = 0.13;
  burst(b.x, b.y, 14, ['#fff4bd', '#ffb650', '#d7e6ed'], 220, 0.3, 3, 'spark');
  if (a.hp > 0) {
    sfx('hit');
    return;
  }
  a.dead = true;
  recordStatistic('allies');
  shake = Math.max(shake, 4);
  floatText(a.x, a.y - 10, UI_TEXT.soyuznik_podbit, '#ff9a7a');
  wrecks.push({
    x: a.x,
    y: a.y,
    kind: 'ally',
    upgrade: a.upgrade,
    ally: true,
    angle: a.angle,
    turret: a.turret,
    tread: a.tread,
    recoil: a.recoil,
    flash: 0,
    age: 0,
    smokeT: 0,
    taken: true,
    detonateAt: rnd(0.5, 1.5) * (b.blast ? 0.5 : 1),
    exploded: false,
    burnOnly: tankBurnsOnly(),
  });
}
