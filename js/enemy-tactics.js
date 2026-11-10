'use strict';
// Тактика обычных вражеских танков (scout, soldier, heavy).
// Марш группой по исходному маршруту с проверкой опасных точек; общий контакт с ролями
// (до трёх машин в прямом бою, остальные — одна или две обходящие группы); поиск у последней
// известной позиции не дальше 10 клеток от маршрута; цикл перестрелки «остановка — выстрел — укрытие».
// Артиллерия, РСЗО и мотобригады живут по своим правилам (enemy-ai.js, sappers.js).
// Применяется к видам с KINDS[kind].ai === 'tactic'. Использует routeField/los/coverClear/blockingBrick
// из enemy-ai.js, физику корпуса из tanks.js, fire() из weapons.js и разметку карт (maps-ai.js или
// разметку сценария). Подключение только определяет функции.

const TACTICS = Object.freeze({
  foliageSight: 3, // клеток: дальше враг не видит сквозь зелень (и цель в зелени)
  directMax: 3, // машин в прямом бою; остальные — кандидаты в обход
  searchLimit: 10, // клеток от исходного маршрута при поиске
  gap: 0.5, // клетки между корпусами обычных танков
  coverReach: 1, // клетка вбок от линии огня
  contactReach: 32, // стоимость пути (≈ клеток), с которой машина успевает в бой
  lostAfter: 1.2, // с без наблюдения — контакт потерян
  searchAfter: 3, // с без наблюдения — проверка выходов
  searchTime: 16, // с на проверку выходов
  flankAngle: Math.PI / 3, // направление обхода отличается от прямого
  engageAngle: Math.PI / 4, // угол, под которым обход вступает в бой
  flankRing: [3, 8], // клеток от последней известной позиции
  flankShare: 0.4, // доля общих клеток, при которой маршруты обходов не считаются отдельными
  replanInterval: 0.6,
  recruitInterval: 1,
  groupSize: 3,
  groupJoin: 6,
  dangerReach: 3,
  dangerAhead: 6,
  checkTime: 5,
  lookTime: 0.7,
  respondHold: 1.5,
  interceptRange: 6,
  aimTolerance: 0.06,
});

let tacClock = 0,
  tacUid = 0,
  tacGroups = [],
  tacContacts = [],
  tacGrid = null,
  tacMarkup = null;
function resetTactics() {
  tacGroups = [];
  tacContacts = [];
  tacGrid = grid;
  tacMarkup = null;
}
// Новая карта (новый массив grid) — новые маршруты, группы и контакты.
function syncTactics() {
  if (tacGrid !== grid) resetTactics();
}

const cellOf = v => Math.floor(v / T);
const cellCenter = i => ({ x: (i % COLS) * T + T / 2, y: ((i / COLS) | 0) * T + T / 2, c: i % COLS, r: (i / COLS) | 0 });
const cellIndex = (x, y) => clamp(cellOf(y), 0, ROWS - 1) * COLS + clamp(cellOf(x), 0, COLS - 1);
const isTacticKind = e => KINDS[e.kind].ai === 'tactic';
function isTactical(e) {
  return e && isTacticKind(e) && !e.dead && !e.entering && !(e.spawnT > 0) && !e.storyLeaving && enemies.includes(e);
}

// ---------- обзор ----------
// Зелень на луче (кроме клетки наблюдателя), включая клетку цели.
function foliageOnRay(x0, y0, x1, y1) {
  const own = cellOf(y0) * COLS + cellOf(x0),
    n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
  for (let i = 1; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n,
      y = y0 + ((y1 - y0) * i) / n,
      c = cellOf(x),
      r = cellOf(y);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS || r * COLS + c === own) continue;
    if (grid[r * COLS + c] === TREE) return true;
  }
  return false;
}
// Видит ли экипаж цель: дальность обзора, геометрия, задерживающая снаряды, и не дальше трёх клеток сквозь зелень.
function enemySees(e, t, d = Math.hypot(t.x - e.x, t.y - e.y)) {
  if (d >= CFG.enemySight) return false;
  if (d > TACTICS.foliageSight * T && foliageOnRay(e.x, e.y, t.x, t.y)) return false;
  return los(e.x, e.y, t.x, t.y);
}
function visibleFoe(e) {
  let foe = null,
    best = Infinity;
  for (const t of [player, ...allies]) {
    if (!t || t.dead) continue;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d < best && enemySees(e, t, d)) {
      foe = t;
      best = d;
    }
  }
  return foe;
}

// ---------- поля маршрутов ----------
// Поля берутся из общего кэша routeField() (enemy-ai.js): своё поле на каждую клетку-цель.
// Клетки пути по полю (без стартовой), null — цель недостижима.
function flowPath(f, c, r, max = COLS * ROWS) {
  let i = r * COLS + c;
  if (!(f[i] < 1e9)) return null;
  const path = [];
  while (f[i] > 0 && path.length < max) {
    const ic = i % COLS,
      ir = (i / COLS) | 0;
    let best = -1,
      bv = f[i];
    for (const [dc, dr] of DIRS) {
      const nc = ic + dc,
        nr = ir + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || routeBlocked(nc, nr, ic, ir, TANK_RADIUS)) continue;
      const j = nr * COLS + nc;
      if (f[j] < bv) {
        bv = f[j];
        best = j;
      }
    }
    if (best < 0) break;
    path.push(best);
    i = best;
  }
  return path;
}
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    l = dx * dx + dy * dy;
  const k = l ? clamp(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - ax - dx * k, py - ay - dy * k);
}
// Расстояние до ближайшего участка маршрута, включая отрезки между точками.
function routeDistance(route, x, y) {
  if (!route || !route.length) return Infinity;
  if (route.length === 1) return Math.hypot(x - route[0].x, y - route[0].y);
  let best = Infinity;
  for (let k = 1; k < route.length; k++)
    best = Math.min(best, segmentDistance(x, y, route[k - 1].x, route[k - 1].y, route[k].x, route[k].y));
  return best;
}
function nearestRouteIndex(route, x, y) {
  let best = 0,
    bd = Infinity;
  for (let k = 0; k < route.length; k++) {
    const d = Math.hypot(route[k].x - x, route[k].y - y);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return bd < T * 0.5 ? Math.min(best + 1, route.length) : best;
}

// ---------- разметка карты ----------
// Необязательная: разметка сценария (scenario.aiMarkup) или maps-ai.js (window.ECOTANK_AI_MARKUP по id карты).
// routes — ломаные из клеток [c,r] по строкам/столбцам, danger — опасные точки, zones — [c0,r0,c1,r1] районы
// поиска позиции для обхода, passes — проходы (выходы для поиска). Неверные элементы отбрасываются.
function normalizeTacticMarkup(m, cols = COLS, rows = ROWS) {
  if (!m || typeof m !== 'object') return null;
  const cell = p =>
    Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) && p[0] >= 0 && p[1] >= 0 && p[0] < cols && p[1] < rows;
  const routes = (Array.isArray(m.routes) ? m.routes : []).filter(
    r => Array.isArray(r) && r.length >= 2 && r.every(cell) && r.every((p, k) => !k || p[0] === r[k - 1][0] || p[1] === r[k - 1][1]),
  );
  const points = list => (Array.isArray(list) ? list : []).filter(cell).map(([c, r]) => ({ c, r, x: c * T + T / 2, y: r * T + T / 2 }));
  const zones = (Array.isArray(m.zones) ? m.zones : []).filter(
    z => Array.isArray(z) && z.length === 4 && cell([z[0], z[1]]) && cell([z[2], z[3]]) && z[0] <= z[2] && z[1] <= z[3],
  );
  return { routes, danger: points(m.danger), zones, passes: points(m.passes) };
}
function tacticMarkup() {
  if (tacMarkup && tacMarkup.grid === grid) return tacMarkup.data;
  let src = scenario.aiMarkup ? scenario.aiMarkup() : null;
  if (!src && mapMode === 'map' && activeMap && activeMap.id && typeof window !== 'undefined' && window.ECOTANK_AI_MARKUP)
    src = window.ECOTANK_AI_MARKUP[activeMap.id];
  tacMarkup = { grid, data: normalizeTacticMarkup(src) };
  return tacMarkup.data;
}
function expandMarkedRoute(route) {
  const cells = [];
  for (let k = 0; k < route.length; k++) {
    const [c, r] = route[k];
    if (!k) {
      cells.push(r * COLS + c);
      continue;
    }
    const [pc, pr] = route[k - 1],
      n = Math.abs(c - pc) + Math.abs(r - pr);
    for (let s = 1; s <= n; s++) cells.push((pr + Math.sign(r - pr) * s) * COLS + pc + Math.sign(c - pc) * s);
  }
  return cells.every(i => !blocksRoute(grid[i])) ? cells : null;
}

// ---------- маршрут марша ----------
function tacticGoal(e) {
  if (e.storyExit !== undefined) return { c: e.storyExit, r: ROWS - 1, story: true };
  const g = base && !base.dead ? base : enemyGoal(e);
  return { c: clamp(cellOf(g.x), 0, COLS - 1), r: clamp(cellOf(g.y), 0, ROWS - 1), mobile: g !== base };
}
// Сначала размеченный маршрут, начинающийся рядом с танком и ведущий к цели; иначе кратчайший доступный.
function planRoute(e, goal) {
  const c = clamp(cellOf(e.x), 0, COLS - 1),
    r = clamp(cellOf(e.y), 0, ROWS - 1),
    markup = tacticMarkup();
  let cells = null;
  if (markup) {
    const near = (i, cc, rr, d) => Math.max(Math.abs((i % COLS) - cc), Math.abs(((i / COLS) | 0) - rr)) <= d;
    const fits = markup.routes
      .map(expandMarkedRoute)
      .filter(rc => rc && near(rc[0], c, r, 3) && near(rc[rc.length - 1], goal.c, goal.r, 2))
      .sort((a, b) => Math.hypot((a[0] % COLS) - c, ((a[0] / COLS) | 0) - r) - Math.hypot((b[0] % COLS) - c, ((b[0] / COLS) | 0) - r));
    for (const rc of fits) {
      const s = cellCenter(rc[0]),
        head = s.c === c && s.r === r ? [] : flowPath(routeField(s.c, s.r, e.r), c, r);
      const last = cellCenter(rc[rc.length - 1]),
        tail = last.c === goal.c && last.r === goal.r ? [] : flowPath(routeField(goal.c, goal.r, e.r), last.c, last.r);
      if (head && tail) {
        cells = [...head, ...(head.length ? rc.slice(1) : rc), ...tail];
        break;
      }
    }
  }
  if (!cells) cells = flowPath(routeField(goal.c, goal.r, e.r), c, r) || [];
  return cells.map(cellCenter);
}
// Опасные точки: из разметки — рядом с маршрутом; без разметки — заметные куртины зелени и заборы
// в пределах трёх клеток от маршрута (по видимой местности, не по скрытым координатам игрока).
function dangerAlong(route) {
  const markup = tacticMarkup(),
    out = [],
    reach = TACTICS.dangerReach;
  const idxOf = p => {
    let best = 0,
      bd = Infinity;
    route.forEach((q, k) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) {
        bd = d;
        best = k;
      }
    });
    return best;
  };
  if (markup && markup.danger.length) {
    for (const p of markup.danger) if (routeDistance(route, p.x, p.y) <= reach * T) out.push({ ...p, idx: idxOf(p) });
    return out;
  }
  const onRoute = new Set(route.map(p => p.r * COLS + p.c));
  for (let k = 3; k < route.length; k++) {
    const p = route[k];
    for (let dr = -reach; dr <= reach; dr++)
      for (let dc = -reach; dc <= reach; dc++) {
        const c = p.c + dc,
          r = p.r + dr,
          t = tileAt(c, r);
        if ((t !== TREE && t !== FENCE) || onRoute.has(r * COLS + c)) continue;
        // одиночный куст или столбик не прячет танк: нужна куртина хотя бы из двух клеток
        if (!DIRS.some(([x, y]) => tileAt(c + x, r + y) === t)) continue;
        const x = c * T + T / 2,
          y = r * T + T / 2;
        if (out.some(q => Math.hypot(q.x - x, q.y - y) < 4 * T)) continue;
        out.push({ c, r, x, y, idx: k });
      }
    if (out.length >= 16) break;
  }
  return out;
}

// ---------- группы ----------
function newGroup(e) {
  const goal = tacticGoal(e),
    route = planRoute(e, goal);
  const g = {
    id: ++tacUid,
    goal,
    route,
    route0: route,
    members: [],
    checked: new Set(),
    danger: dangerAlong(route),
    check: null,
    geo: geoVersion,
    planAt: tacClock,
    story: e.storyColumn || null,
  };
  tacGroups.push(g);
  return g;
}
function joinGroup(e, g) {
  if (!g.members.includes(e)) g.members.push(e);
  e.tac.group = g;
  e.tac.routeIdx = nearestRouteIndex(g.route, e.x, e.y);
  e.tac.wp = null;
}
function ensureTactic(e) {
  syncTactics();
  if (!e.tac)
    e.tac = { uid: ++tacUid, role: 'march', group: null, contact: null, routeIdx: 0, fs: null, wait: 0, stuck: 0, detour: 0, wp: null };
  const tac = e.tac;
  if (!tac.group || !tacGroups.includes(tac.group)) {
    const goal = tacticGoal(e);
    const g = tacGroups.find(g =>
      e.storyColumn
        ? g.story === e.storyColumn
        : !g.story &&
          !goal.story &&
          g.goal.c === goal.c &&
          g.goal.r === goal.r &&
          g.members.length < TACTICS.groupSize &&
          g.members.every(m => m.tac.role === 'march') &&
          g.members.some(m => Math.hypot(m.x - e.x, m.y - e.y) < TACTICS.groupJoin * T) &&
          g.route0.length &&
          Math.hypot(g.route0[0].x - e.x, g.route0[0].y - e.y) < 4 * T,
    );
    joinGroup(e, g || newGroup(e));
  }
  return tac;
}
// Проходимость изменилась: путь впереди перекрыт — новый маршрут от головной машины (исходный сохраняется для поиска).
function revalidateGroup(g) {
  g.geo = geoVersion;
  g.planAt = tacClock;
  const from = Math.min(...g.members.map(m => m.tac.routeIdx));
  if (g.route.slice(from).some(p => blocksRoute(tileAt(p.c, p.r))) || (g.goal.mobile && moveGoal(g))) {
    const head = g.members.reduce((a, b) => (b.tac.routeIdx > a.tac.routeIdx ? b : a));
    g.route = planRoute(head, g.goal);
    g.danger = dangerAlong(g.route);
    for (const m of g.members) {
      m.tac.routeIdx = nearestRouteIndex(g.route, m.x, m.y);
      m.tac.wp = null;
    }
  }
}
// Подвижная цель режима без базы (игрок/союзник): маршрут обновляется, когда цель ушла на 3+ клетки.
function moveGoal(g) {
  const head = g.members[0],
    goal = tacticGoal(head);
  if (Math.max(Math.abs(goal.c - g.goal.c), Math.abs(goal.r - g.goal.r)) < 3) return false;
  g.goal = goal;
  return true;
}

// ---------- безопасность движения ----------
function regularTanks(except) {
  return enemies.filter(o => o !== except && !o.dead && isTacticKind(o) && !o.entering);
}
const gapFor = (a, b) => a.r + b.r + TACTICS.gap * T;
// Место свободно: до корпусов и занятых позиций (огневых, укрытий, обходов) других танков не меньше зазора.
function posFree(e, x, y) {
  for (const o of regularTanks(e)) {
    const min = gapFor(e, o) - 0.5;
    if (Math.hypot(o.x - x, o.y - y) < min) return false;
    const f = o.tac && o.tac.fs,
      slot = o.tac && o.tac.slot;
    for (const q of [f && f.pos, f && f.cover, slot]) if (q && Math.hypot(q.x - x, q.y - y) < min) return false;
  }
  return true;
}
// Кто окажется ближе зазора, если продолжить ход: задняя машина ждёт.
function gapBlocker(e, x, y) {
  const back = (e.speedCur || 0) < -1,
    dx = back ? -Math.cos(e.angle) : x - e.x,
    dy = back ? -Math.sin(e.angle) : y - e.y,
    d = Math.hypot(dx, dy) || 1;
  const look = Math.max(Math.abs(e.speedCur || 0), 10) * PLAYER_INERTIA.move * 1.5 + 4,
    px = e.x + (dx / d) * look,
    py = e.y + (dy / d) * look;
  for (const o of regularTanks(e)) {
    if ((o.x - e.x) * dx + (o.y - e.y) * dy <= 0) continue;
    // ждать, только если ход сближает корпуса ближе зазора; отъезд и движение вдоль соседа не мешают
    const next = Math.hypot(o.x - px, o.y - py);
    if (next < gapFor(e, o) && next < Math.hypot(o.x - e.x, o.y - e.y) - 0.5) return o;
  }
  return null;
}
function startDetour(e, avoid) {
  const c = cellOf(e.x),
    r = cellOf(e.y),
    opts = [];
  for (const [dc, dr] of [...DIRS, [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const x = (c + dc) * T + T / 2,
      y = (r + dr) * T + T / 2;
    if (!coverClear(x, y, e.r, true) || !posFree(e, x, y)) continue;
    opts.push({ x, y, score: avoid ? -Math.hypot(avoid.x - x, avoid.y - y) : Math.random() });
  }
  if (!opts.length) return;
  opts.sort((a, b) => a.score - b.score);
  e.tac.detour = 1.6;
  e.tac.detourPt = opts[0];
  e.tac.wait = 0;
  e.tac.wp = null;
  e.tac.stuck = 0;
}
// Общий ход: физика игрока, зазор между корпусами, объезд при застревании или долгом ожидании.
function tacticDrive(e, x, y, speed, dt, brake = true) {
  const tac = e.tac;
  // объезд: короткий шаг в свободную соседнюю клетку, затем движение к прежней цели
  if (tac.detour > 0) {
    tac.detour -= dt;
    if (driveHullInertial(e, tac.detourPt.x, tac.detourPt.y, speed, dt).arrived) tac.detour = 0;
    tac.wp = null;
    return { arrived: false, detour: true };
  }
  const blocker = gapBlocker(e, x, y);
  tac.blockedBy = blocker;
  if (blocker) {
    tac.wait += dt;
    driveHullInertial(e, x, y, speed, dt, brake, true);
    // встречные в узком месте: уступает машина с большим номером; иначе — объезд после долгого ожидания
    const mutual = blocker.tac && blocker.tac.blockedBy === e;
    if (tac.wait > 1.2 && ((mutual && tac.uid > blocker.tac.uid) || tac.wait > 3)) startDetour(e, blocker);
    return { arrived: false, waiting: true };
  }
  tac.wait = 0;
  const res = driveHullInertial(e, x, y, speed, dt, brake);
  if (res.step > 5 * dt && res.moved < res.step * 0.1) tac.stuck += dt;
  else tac.stuck = Math.max(0, tac.stuck - dt);
  if (tac.stuck > 1) startDetour(e, null);
  return res;
}
// Следующая клетка к цели по полю; кирпич на пути — стена, которую надо пробить.
function nextWaypoint(e, gx, gy) {
  const gc = clamp(cellOf(gx), 0, COLS - 1),
    gr = clamp(cellOf(gy), 0, ROWS - 1),
    c = cellOf(e.x),
    r = cellOf(e.y);
  if (c === gc && r === gr) return { x: gx, y: gy, gc, gr, brake: true, final: true };
  const f = routeField(gc, gr, e.r);
  let best = null,
    bv = f[r * COLS + c] < 1e9 ? f[r * COLS + c] : Infinity;
  for (const [dc, dr] of DIRS) {
    const nc = c + dc,
      nr = r + dr;
    if (routeBlocked(nc, nr, c, r, e.r)) continue;
    const v = f[nr * COLS + nc];
    if (v < bv) {
      bv = v;
      best = { c: nc, r: nr, dc, dr };
    }
  }
  if (!best) return { x: gx, y: gy, gc, gr, brake: true, final: true };
  const p = { x: best.c * T + T / 2, y: best.r * T + T / 2, gc, gr, brake: true };
  if (tileAt(best.c, best.r) === BRICK) return { ...p, brick: true };
  // без поворота за следующей клеткой можно не тормозить
  const nn = { c: best.c + best.dc, r: best.r + best.dr };
  if (!routeBlocked(nn.c, nn.r, best.c, best.r, e.r) && f[nn.r * COLS + nn.c] < bv && tileAt(nn.c, nn.r) !== BRICK) p.brake = false;
  return p;
}
// Едет к точке по своему полю маршрута. Возвращает true по прибытии.
function navTo(e, gx, gy, speed, dt) {
  const tac = e.tac;
  if (Math.hypot(gx - e.x, gy - e.y) < 3) {
    holdHull(e, null, dt);
    return true;
  }
  let wp = tac.wp;
  const gc = clamp(cellOf(gx), 0, COLS - 1),
    gr = clamp(cellOf(gy), 0, ROWS - 1);
  if (
    !wp ||
    wp.gc !== gc ||
    wp.gr !== gr ||
    (wp.final && (wp.x !== gx || wp.y !== gy)) ||
    (!wp.brick && Math.hypot(wp.x - e.x, wp.y - e.y) < (wp.brake ? 3 : T * 0.4)) ||
    (wp.brick && tileAt(cellOf(wp.x), cellOf(wp.y)) !== BRICK)
  )
    wp = tac.wp = nextWaypoint(e, gx, gy);
  if (wp.brick) {
    shootObstacle(e, wp, dt);
    return false;
  }
  tacticDrive(e, wp.x, wp.y, speed, dt, wp.brake);
  return false;
}

// ---------- стрельба ----------
function turnTurret(e, aim, dt) {
  e.turret = turnTo(e.turret, aim, dt * KINDS[e.kind].turretSpeed);
  return Math.abs(angDiff(e.turret, aim));
}
// Линия огня: геометрия не задерживает снаряд и на пути нет своих машин (зелень снаряд пропускает).
function lineClear(e, x, y, geometry = true, ox = e.x, oy = e.y) {
  if (geometry && !los(ox, oy, x, y)) return false;
  const len = Math.hypot(x - ox, y - oy);
  for (const o of enemies) {
    if (o === e || o.dead || o.entering) continue;
    const along = ((o.x - ox) * (x - ox) + (o.y - oy) * (y - oy)) / (len || 1);
    if (along > 0 && along < len && segmentDistance(o.x, o.y, ox, oy, x, y) < o.r + 3) return false;
  }
  return true;
}
function fireTank(e) {
  fire(e);
  e.cd = enemyInterval(e.kind);
  const tac = e.tac;
  if (tac) tac.shots = (tac.shots || 0) + 1;
}
// Выстрел разрешён только стоящему танку: ход погашен, корпус не поворачивается, перезарядка завершена,
// орудие в пределах допуска наведения.
function readyToFire(e, aim) {
  return e.cd <= 0 && hullStopped(e) && Math.abs(angDiff(e.turret, aim)) < TACTICS.aimTolerance;
}
// Препятствие на маршруте (кирпич): встать, навести и пробить по обычным правилам стрельбы.
function shootObstacle(e, p, dt) {
  holdHull(e, null, dt);
  const aim = Math.atan2(p.y - e.y, p.x - e.x);
  turnTurret(e, aim, dt);
  if (readyToFire(e, aim) && lineClear(e, p.x, p.y, false)) fireTank(e);
}
function leadPoint(e, foe) {
  const d = Math.hypot(foe.x - e.x, foe.y - e.y),
    lead = (d / KINDS[e.kind].bulletSpeed) * 0.6;
  return { x: foe.x + (foe.vx || 0) * lead, y: foe.y + (foe.vy || 0) * lead };
}

// ---------- марш и проверка опасных точек ----------
function marchUpdate(e, dt, speed) {
  const tac = e.tac,
    g = tac.group,
    chk = g.check,
    route = g.route;
  if (chk && chk.checker === e) {
    checkUpdate(e, dt, chk);
    return;
  }
  // база в пределах обзора: танк встаёт только к готовому выстрелу, во время перезарядки идёт дальше
  if (base && !base.dead && Math.hypot(base.x - e.x, base.y - e.y) < CFG.enemySight && los(e.x, e.y, base.x, base.y)) {
    const aim = Math.atan2(base.y - e.y, base.x - e.x);
    turnTurret(e, aim, dt);
    if (e.cd <= 0.15) {
      holdHull(e, null, dt);
      if (readyToFire(e, aim) && lineClear(e, base.x, base.y, false)) fireTank(e);
      return;
    }
  } else turnTurret(e, e.angle, dt);
  if (chk) {
    holdHull(e, null, dt);
    return;
  }
  while (tac.routeIdx < route.length) {
    const p = route[tac.routeIdx],
      straight =
        tac.routeIdx + 1 < route.length &&
        tac.routeIdx > 0 &&
        route[tac.routeIdx + 1].c - p.c === p.c - route[tac.routeIdx - 1].c &&
        route[tac.routeIdx + 1].r - p.r === p.r - route[tac.routeIdx - 1].r;
    if (Math.hypot(p.x - e.x, p.y - e.y) < (straight ? T * 0.4 : 3)) tac.routeIdx++;
    else break;
  }
  if (tac.routeIdx >= route.length) {
    // маршрут пройден: у цели режима (база) — стоим и бьём по ней; без маршрута — идём к цели по полю
    const goal = { x: g.goal.c * T + T / 2, y: g.goal.r * T + T / 2 };
    if (!route.length || Math.hypot(goal.x - e.x, goal.y - e.y) > T) navTo(e, goal.x, goal.y, speed, dt);
    else holdHull(e, null, dt);
    return;
  }
  const p = route[tac.routeIdx];
  // машина с breaksWalls пробивает кирпич на прямой к цели марша, если стена рядом
  if (KINDS[e.kind].breaksWalls) {
    const wall = blockingBrick(e, { x: g.goal.c * T + T / 2, y: g.goal.r * T + T / 2 });
    if (wall && Math.hypot(wall.x - e.x, wall.y - e.y) < 4 * T) {
      e.brick = wall;
      shootObstacle(e, wall, dt);
      return;
    }
  }
  e.brick = null;
  if (tileAt(p.c, p.r) === BRICK) {
    if (Math.hypot(p.x - e.x, p.y - e.y) < T * 1.3 + e.r || tac.stuck > 0.3) {
      e.brick = p;
      shootObstacle(e, p, dt);
      return;
    }
  }
  // сошёл с маршрута (объезд, бой, присоединение) — возвращается к ближайшей точке по полю
  if (tac.detour > 0 || routeDistance(route.slice(Math.max(0, tac.routeIdx - 1), tac.routeIdx + 1), e.x, e.y) > T * 1.2) {
    navTo(e, p.x, p.y, speed, dt);
    return;
  }
  const next = route[tac.routeIdx + 1],
    brake =
      !next ||
      tac.routeIdx === 0 ||
      next.c - p.c !== p.c - route[tac.routeIdx - 1].c ||
      next.r - p.r !== p.r - route[tac.routeIdx - 1].r ||
      tileAt(next.c, next.r) === BRICK;
  tacticDrive(e, p.x, p.y, speed, dt, brake);
}
// Опасная точка впереди: группа ждёт, машина с подходящим сектором осматривает её
// (зелень ближе трёх клеток просматривается) или делает один проверочный выстрел.
function updateGroupCheck(g) {
  const marchers = g.members.filter(m => m.tac.role === 'march');
  if (g.check) {
    const c = g.check;
    if (c.done || !marchers.includes(c.checker)) {
      g.checked.add(c.p);
      g.check = null;
    }
    return;
  }
  if (!marchers.length) return;
  const head = marchers.reduce((a, b) => (b.tac.routeIdx > a.tac.routeIdx ? b : a));
  for (const p of g.danger) {
    if (g.checked.has(p)) continue;
    if (p.idx < head.tac.routeIdx - 2) {
      g.checked.add(p);
      continue;
    }
    if (Math.hypot(p.x - head.x, p.y - head.y) > TACTICS.dangerAhead * T) continue;
    const tile = tileAt(p.c, p.r);
    if (tile !== TREE && tile !== FENCE) {
      g.checked.add(p);
      continue;
    }
    let best = null,
      bd = Infinity;
    for (const m of marchers) {
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d < bd && sightToPoint(m, p)) {
        best = m;
        bd = d;
      }
    }
    if (!best) continue;
    g.check = { p, checker: best, t: 0, look: 0, fired: false, mode: tile === TREE && bd <= TACTICS.foliageSight * T ? 'look' : 'shot' };
    return;
  }
}
// Сектор до точки свободен (саму клетку точки — зелень или забор — не учитываем).
function sightToPoint(e, p) {
  const d = Math.hypot(p.x - e.x, p.y - e.y);
  if (d < 1) return true;
  const k = Math.max(0, d - T * 0.6) / d;
  return los(e.x, e.y, e.x + (p.x - e.x) * k, e.y + (p.y - e.y) * k);
}
function checkUpdate(e, dt, chk) {
  chk.t += dt;
  holdHull(e, null, dt);
  const aim = Math.atan2(chk.p.y - e.y, chk.p.x - e.x),
    off = turnTurret(e, aim, dt);
  if (chk.mode === 'look') {
    if (off < 0.1) chk.look += dt;
    if (chk.look >= TACTICS.lookTime) chk.done = true;
  } else if (!chk.fired && readyToFire(e, aim) && lineClear(e, chk.p.x, chk.p.y, false)) {
    fireTank(e);
    chk.fired = true;
    chk.after = 0.3;
  }
  if (chk.fired && (chk.after -= dt) <= 0) chk.done = true;
  if (chk.t > TACTICS.checkTime + enemyInterval(e.kind)) chk.done = true;
}
// Попадание от невидимого стрелка: проверить место, откуда пришёл снаряд (первую зелень или забор на обратном луче).
function alarmFromHit(e) {
  const h = e.lastHit,
    v = Math.hypot(h.vx, h.vy) || 1,
    dx = -h.vx / v,
    dy = -h.vy / v;
  let p = null,
    lastFree = { x: e.x, y: e.y };
  for (let s = T; s <= 12 * T; s += 8) {
    const x = h.x + dx * s,
      y = h.y + dy * s,
      c = cellOf(x),
      r = cellOf(y),
      t = tileAt(c, r);
    if (t === TREE || t === FENCE) {
      p = { c, r, x: c * T + T / 2, y: r * T + T / 2 };
      break;
    }
    if (bulletBlocked(x, y) || x < 0 || y < 0 || x >= W || y >= H) break;
    lastFree = { x, y };
  }
  if (!p) p = { x: lastFree.x, y: lastFree.y, c: cellOf(lastFree.x), r: cellOf(lastFree.y) };
  const g = e.tac.group;
  g.check = {
    p,
    checker: e,
    t: 0,
    look: 0,
    fired: false,
    mode: tileAt(p.c, p.r) === TREE || tileAt(p.c, p.r) === FENCE ? 'shot' : 'look',
    alarm: true,
  };
}

// ---------- контакт и роли ----------
function contactFor(target) {
  return tacContacts.find(C => C.target === target) || null;
}
function setRole(e, role) {
  if (e.tac.role !== role) {
    e.tac.role = role;
    e.tac.fs = null;
    e.tac.wp = null;
    e.tac.approach = null;
    e.tac.approachT = 0;
    e.tac.flankBest = undefined;
    e.tac.flankStall = 0;
  }
}
function leaveFlank(e) {
  const F = e.tac.flank;
  if (F) F.members = F.members.filter(m => m !== e);
  e.tac.flank = null;
  e.tac.slot = null;
}
function leaveContact(e) {
  const tac = e.tac,
    C = tac.contact;
  leaveFlank(e);
  if (C) C.members = C.members.filter(m => m !== e);
  tac.contact = null;
  tac.searchPt = null;
  tac.searchDone = false;
  tac.lostDone = false;
  setRole(e, 'march');
  e.brick = null;
  if (tac.group) {
    tac.routeIdx = nearestRouteIndex(tac.group.route, e.x, e.y);
    if (tac.group.check && tac.group.check.checker === e) tac.group.check.done = true;
  }
}
function dissolveContact(C) {
  for (const m of C.members.slice()) if (m.tac && m.tac.contact === C) leaveContact(m);
  tacContacts = tacContacts.filter(c => c !== C);
}
// Направление атаки контактной группы: от последней известной позиции к прямой группе.
function directAngle(C) {
  const d = C.members.filter(m => m.tac.role === 'direct' || m.tac.role === 'support');
  const src = d.length ? { x: d.reduce((s, m) => s + m.x, 0) / d.length, y: d.reduce((s, m) => s + m.y, 0) / d.length } : C.reporter || C;
  return Math.atan2(src.y - C.y, src.x - C.x);
}
function reportContact(e, foe) {
  let C = contactFor(foe);
  const fresh = !C;
  if (!C) {
    C = {
      id: ++tacUid,
      target: foe,
      x: foe.x,
      y: foe.y,
      seenAt: tacClock,
      phase: 'fight',
      members: [],
      flanks: [],
      geo: geoVersion,
      planAt: -Infinity,
      recruitAt: tacClock,
      count: 0,
    };
    tacContacts.push(C);
  }
  C.x = foe.x;
  C.y = foe.y;
  C.seenAt = tacClock;
  C.reporter = e;
  if (C.phase !== 'fight') {
    C.phase = 'fight';
    for (const m of C.members) {
      m.tac.searchPt = null;
      m.tac.searchDone = false;
      m.tac.lostDone = false;
    }
  }
  if (fresh || !e.tac.contact) planContact(C);
}
// Машины, которые могут участвовать: обычные танки на поле без другого контакта,
// с доступным маршрутом к последней известной позиции не длиннее contactReach.
function contactPool(C) {
  const f = routeField(cellOf(C.x), cellOf(C.y), 14);
  return enemies
    .filter(t => isTactical(t) && (!t.tac || !t.tac.contact || t.tac.contact === C))
    .map(t => ({ t, cost: f[cellIndex(t.x, t.y)] }))
    .filter(o => o.cost <= TACTICS.contactReach || o.t === C.reporter)
    .sort((a, b) => a.cost - b.cost);
}
// Роли сохраняются; пересмотр — при создании контакта, потерях, новых машинах и изменении проезда.
function planContact(C) {
  C.planAt = tacClock;
  const geoChanged = C.geo !== geoVersion;
  C.geo = geoVersion;
  const pool = contactPool(C),
    members = pool.map(o => o.t);
  // доложивший танк участвует всегда
  if (
    C.reporter &&
    !C.reporter.dead &&
    !members.includes(C.reporter) &&
    (!C.reporter.tac || !C.reporter.tac.contact || C.reporter.tac.contact === C)
  )
    members.unshift(C.reporter);
  for (const m of members) {
    const tac = ensureTactic(m);
    if (tac.contact !== C) {
      if (tac.group && tac.group.check && tac.group.check.checker === m) tac.group.check.done = true;
      tac.contact = C;
      tac.role = 'new';
      tac.fs = null;
      tac.wp = null;
    }
  }
  for (const m of C.members) if (!members.includes(m) && m.tac.contact === C && !m.dead) members.push(m);
  C.members = members;
  C.count = members.length;
  const cost = new Map(pool.map(o => [o.t, o.cost]));
  // обходы: убрать выбывших; при изменении проезда — проверить маршруты ещё не вступивших
  for (const F of C.flanks) {
    F.members = F.members.filter(m => members.includes(m) && m.tac.flank === F);
    if (geoChanged)
      for (const m of F.members.slice())
        if (m.tac.role === 'flank' && !flankRoute(m, m.tac.slot || F.site, C)) {
          leaveFlank(m);
          setRole(m, 'new');
        }
  }
  C.flanks = C.flanks.filter(F => F.members.length);
  const inFlank = m => m.tac.flank && C.flanks.includes(m.tac.flank);
  const direct = members.filter(m => m.tac.role === 'direct').slice(0, TACTICS.directMax);
  const rest = members.filter(m => !direct.includes(m) && !inFlank(m));
  // прямая группа пополняется сначала свободными машинами, затем ещё не вступившими в бой обходящими
  while (direct.length < TACTICS.directMax && rest.length) direct.push(rest.shift());
  if (direct.length < TACTICS.directMax) {
    const spare = members.filter(m => inFlank(m) && m.tac.role === 'flank').sort((a, b) => (cost.get(a) || 0) - (cost.get(b) || 0));
    while (direct.length < TACTICS.directMax && spare.length) {
      const m = spare.shift();
      leaveFlank(m);
      direct.push(m);
    }
    C.flanks = C.flanks.filter(F => F.members.length);
  }
  for (const m of direct) setRole(m, 'direct');
  if (rest.length) assignFlanks(C, rest);
}
function flankSites(C, dirAng, avoid = []) {
  const markup = tacticMarkup(),
    pc = cellOf(C.x),
    pr = cellOf(C.y),
    [r0, r1] = TACTICS.flankRing,
    out = [];
  const zoned = (c, r) => markup && markup.zones.some(z => c >= z[0] && c <= z[2] && r >= z[1] && r <= z[3]);
  for (let r = pr - r1; r <= pr + r1; r++)
    for (let c = pc - r1; c <= pc + r1; c++) {
      const d = Math.hypot(c - pc, r - pr);
      if (d < r0 || d > r1 || c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      const x = c * T + T / 2,
        y = r * T + T / 2,
        ang = Math.atan2(y - C.y, x - C.x);
      if (Math.abs(angDiff(ang, dirAng)) < TACTICS.flankAngle || avoid.some(a => Math.abs(angDiff(ang, a)) < TACTICS.flankAngle)) continue;
      if (!coverClear(x, y, 14, true) || !los(x, y, C.x, C.y)) continue;
      // при прочих равных — позиция в зелени; размеченная зона манёвра — район поиска позиции
      out.push({ x, y, c, r, ang, score: Math.abs(d - 5) - (grid[r * COLS + c] === TREE ? 1.5 : 0) - (zoned(c, r) ? 1 : 0) });
    }
  return out.sort((a, b) => a.score - b.score);
}
// Пригодный маршрут обхода: доступен, не проходит через последнюю известную позицию и не слишком длинный.
function flankRoute(m, site, C) {
  const f = routeField(site.c, site.r, m.r),
    c = cellOf(m.x),
    r = cellOf(m.y),
    cost = f[r * COLS + c];
  if (!(cost <= 48)) return null;
  const path = flowPath(f, c, r, 120);
  if (!path) return null;
  for (const i of path) {
    const p = cellCenter(i);
    if (Math.hypot(p.x - C.x, p.y - C.y) < 2.5 * T) return null;
  }
  return path;
}
const pathShare = (a, b) => {
  const s = new Set(b);
  return a.length ? a.filter(i => s.has(i)).length / a.length : 1;
};
function flankSlot(F, m, C) {
  const taken = F.members
    .filter(o => o !== m)
    .map(o => o.tac.slot)
    .filter(Boolean);
  const free = (x, y) => taken.every(q => Math.hypot(q.x - x, q.y - y) >= gapFor(m, m)) && posFree(m, x, y);
  if (free(F.site.x, F.site.y)) return F.site;
  let best = null,
    bd = Infinity;
  for (let r = F.site.r - 2; r <= F.site.r + 2; r++)
    for (let c = F.site.c - 2; c <= F.site.c + 2; c++) {
      const x = c * T + T / 2,
        y = r * T + T / 2,
        d = Math.hypot(x - F.site.x, y - F.site.y);
      if (d >= bd || !coverClear(x, y, m.r, true) || !free(x, y) || !los(x, y, C.x, C.y)) continue;
      if (Math.abs(angDiff(Math.atan2(y - C.y, x - C.x), F.site.ang)) > Math.PI / 6) continue;
      best = { x, y, c, r, ang: F.site.ang };
      bd = d;
    }
  return best;
}
function addToFlank(m, F, C) {
  const slot = flankSlot(F, m, C);
  if (!slot) return false;
  F.members.push(m);
  m.tac.flank = F;
  m.tac.slot = slot;
  setRole(m, 'flank');
  m.tac.fs = null;
  return true;
}
// Дополнительные машины: одна или две обходящие группы. Вторая — только при отдельном маршруте
// и другом направлении атаки. Без доступного обхода — поддержка прямого боя.
function assignFlanks(C, extras) {
  const dirAng = directAngle(C);
  extras = extras.slice();
  for (const m of extras.slice()) {
    const F = C.flanks.find(F => F.members.length < TACTICS.groupSize && flankRoute(m, F.site, C));
    if (F && addToFlank(m, F, C)) extras.splice(extras.indexOf(m), 1);
  }
  while (extras.length && C.flanks.length < 2) {
    const sites = flankSites(
      C,
      dirAng,
      C.flanks.map(F => F.site.ang),
    );
    let pick = null;
    for (const s of sites.slice(0, 24)) {
      const lead = extras.slice().sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
      const path = flankRoute(lead, s, C);
      if (!path || C.flanks.some(F => pathShare(path, F.path) > TACTICS.flankShare)) continue;
      pick = { s, path, lead };
      break;
    }
    if (!pick) break;
    const F = { id: ++tacUid, site: pick.s, path: pick.path, anchor: { x: C.x, y: C.y }, planAt: tacClock, members: [] };
    C.flanks.push(F);
    if (addToFlank(pick.lead, F, C)) extras.splice(extras.indexOf(pick.lead), 1);
    else C.flanks.pop();
    if (!F.members.length) break;
  }
  for (const m of extras) {
    const F = C.flanks
      .filter(F => F.members.length < TACTICS.groupSize && flankRoute(m, F.site, C))
      .sort((a, b) => Math.hypot(a.site.x - m.x, a.site.y - m.y) - Math.hypot(b.site.x - m.x, b.site.y - m.y))[0];
    if (!F || !addToFlank(m, F, C)) setRole(m, 'support');
  }
}
// Цель ушла от позиции, под которую выбирался обход: новая позиция обхода с тем же правилом направлений.
function resiteFlank(C, F) {
  F.planAt = tacClock;
  const others = C.flanks.filter(o => o !== F).map(o => o.site.ang),
    sites = flankSites(C, directAngle(C), others);
  const lead = F.members[0];
  for (const s of sites.slice(0, 24)) {
    const path = lead && flankRoute(lead, s, C);
    if (!path || C.flanks.some(o => o !== F && pathShare(path, o.path) > TACTICS.flankShare)) continue;
    F.site = s;
    F.path = path;
    F.anchor = { x: C.x, y: C.y };
    const ms = F.members.slice();
    F.members = [];
    for (const m of ms)
      if (!addToFlank(m, F, C)) {
        m.tac.flank = null;
        setRole(m, 'support');
      }
    return;
  }
  for (const m of F.members.slice()) {
    leaveFlank(m);
    setRole(m, 'support');
  }
}
// Ближайшие выходы от последней известной позиции: проходы из разметки и концы свободных направлений.
function searchExits(C) {
  const pc = cellOf(C.x),
    pr = cellOf(C.y),
    pts = [],
    markup = tacticMarkup();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    let last = 0;
    for (let k = 1; k <= 5; k++) {
      const t = tileAt(pc + dx * k, pr + dy * k);
      if (blocksCrusher(t)) break;
      last = k;
    }
    if (last >= 2) pts.push({ x: (pc + dx * last) * T + T / 2, y: (pr + dy * last) * T + T / 2 });
  }
  if (markup) for (const p of markup.passes) if (Math.hypot(p.x - C.x, p.y - C.y) <= 7 * T) pts.push({ x: p.x, y: p.y });
  const out = [];
  for (const p of pts.sort((a, b) => Math.hypot(a.x - C.x, a.y - C.y) - Math.hypot(b.x - C.x, b.y - C.y)))
    if (out.every(q => Math.hypot(q.x - p.x, q.y - p.y) >= 2 * T)) out.push(p);
  return out.slice(0, 4);
}
// Точка поиска не дальше searchLimit клеток от исходного маршрута марша.
function withinSearch(e, p) {
  return routeDistance(e.tac.group && e.tac.group.route0, p.x, p.y) <= TACTICS.searchLimit * T;
}
function clampToSearch(e, p) {
  const route = e.tac.group && e.tac.group.route0;
  if (!route || !route.length || withinSearch(e, p)) return p;
  let q = route[0],
    bd = Infinity;
  for (let k = 1; k < route.length; k++) {
    const a = route[k - 1],
      b = route[k],
      dx = b.x - a.x,
      dy = b.y - a.y,
      l = dx * dx + dy * dy,
      s = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0;
    const x = a.x + dx * s,
      y = a.y + dy * s,
      d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      q = { x, y };
    }
  }
  const lim = TACTICS.searchLimit * T * 0.95,
    x = q.x + ((p.x - q.x) * lim) / bd,
    y = q.y + ((p.y - q.y) * lim) / bd;
  return { x: clamp(x, T / 2, W - T / 2), y: clamp(y, T / 2, H - T / 2) };
}
function startSearch(C) {
  C.phase = 'search';
  C.searchAt = tacClock;
  C.exits = searchExits(C);
  C.visited = new Set();
  for (const m of C.members) {
    m.tac.searchPt = null;
    m.tac.searchDone = false;
    m.tac.fs = null;
  }
}
function claimSearchPoint(e, C) {
  const claimed = new Set(C.members.map(m => m !== e && m.tac.searchPt).filter(Boolean));
  const pts = C.exits
    .filter(p => !C.visited.has(p) && !claimed.has(p) && withinSearch(e, p))
    .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y));
  e.tac.searchPt = pts[0] || null;
  e.tac.searchT = 0;
  return e.tac.searchPt;
}
function updateContact(C) {
  C.members = C.members.filter(m => !m.dead && enemies.includes(m) && m.tac && m.tac.contact === C);
  if (!C.target || C.target.dead || !C.members.length) {
    dissolveContact(C);
    return;
  }
  const lost = C.members.length < C.count,
    since = tacClock - C.seenAt;
  C.count = C.members.length;
  if (C.phase === 'fight' && since > TACTICS.lostAfter) C.phase = 'lost';
  if (
    C.phase === 'lost' &&
    since > TACTICS.searchAfter &&
    (C.members.every(m => !(m.tac.role === 'direct' || m.tac.role === 'support') || m.tac.lostDone) || since > TACTICS.searchAfter + 6)
  )
    startSearch(C);
  if (C.phase === 'search' && (C.members.every(m => m.tac.searchDone) || tacClock - C.searchAt > TACTICS.searchTime)) {
    dissolveContact(C);
    return;
  }
  // значимые события: потери, изменение проезда, новые доступные машины, цель ушла от позиции обхода
  const geo = C.geo !== geoVersion && tacClock - C.planAt >= TACTICS.replanInterval;
  let recruits = false;
  if (C.phase === 'fight' && tacClock - C.recruitAt >= TACTICS.recruitInterval) {
    C.recruitAt = tacClock;
    recruits = contactPool(C).some(o => !o.t.tac || o.t.tac.contact !== C);
  }
  if (lost || geo || recruits) planContact(C);
  for (const F of C.flanks)
    if (C.phase === 'fight' && Math.hypot(F.anchor.x - C.x, F.anchor.y - C.y) > 4 * T && tacClock - F.planAt > 2) resiteFlank(C, F);
  C.flanks = C.flanks.filter(F => F.members.length);
}

// ---------- бой ----------
function combatUpdate(e, dt, speed, foe) {
  const tac = e.tac,
    C = tac.contact;
  if (C.phase === 'search') {
    searchUpdate(e, dt, speed, foe);
    return;
  }
  if (tac.role === 'new') setRole(e, 'support');
  if (tac.role === 'flank') {
    if (foe) {
      const ang = Math.atan2(e.y - foe.y, e.x - foe.x),
        hit = tac.hitAt !== undefined && tacClock - tac.hitAt < 2;
      // обход вступает в бой, только когда с новой позиции может стрелять под отличающимся углом
      if (Math.abs(angDiff(ang, directAngle(C))) >= TACTICS.engageAngle && lineClear(e, foe.x, foe.y)) setRole(e, 'flankFire');
      // перехват: игрок рядом или уже попал — остановиться и ответить
      else if (hit || Math.hypot(foe.x - e.x, foe.y - e.y) < TACTICS.interceptRange * T) {
        setRole(e, 'respond');
        tac.respondLost = 0;
        tac.respondShots = tac.shots || 0;
      }
    }
    if (tac.role === 'flank') {
      const s = tac.slot || (tac.flank && tac.flank.site);
      if (!s) {
        setRole(e, 'support');
        return;
      }
      turnTurret(e, Math.atan2(C.y - e.y, C.x - e.x), dt);
      // обход без продвижения (проход занят своими, позиция недоступна) — машина поддерживает прямой бой
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (!(tac.flankBest <= d + T * 0.5)) {
        tac.flankBest = d;
        tac.flankStall = 0;
      } else if (d > 3) tac.flankStall = (tac.flankStall || 0) + dt;
      if (tac.flankStall > 6) {
        tac.flankStall = 0;
        tac.flankBest = undefined;
        leaveFlank(e);
        setRole(e, 'support');
        return;
      }
      if (navTo(e, s.x, s.y, speed, dt)) tac.lostDone = true;
      return;
    }
  }
  if (tac.role === 'respond') {
    tac.respondLost = foe ? 0 : (tac.respondLost || 0) + dt;
    if (tac.respondLost > TACTICS.respondHold) {
      // ответил — решает, продолжать ли обход: позиция обхода ещё даёт другое направление и путь к ней есть
      const F = tac.flank,
        s = tac.slot || (F && F.site);
      const keep =
        F && s && Math.abs(angDiff(Math.atan2(s.y - C.y, s.x - C.x), directAngle(C))) >= TACTICS.flankAngle && flankRoute(e, s, C);
      if (keep) setRole(e, 'flank');
      else {
        leaveFlank(e);
        setRole(e, 'support');
      }
      return;
    }
  }
  fightUpdate(e, dt, speed, foe, C);
}
function searchUpdate(e, dt, speed, foe) {
  const tac = e.tac,
    C = tac.contact;
  if (tac.searchDone) {
    holdHull(e, null, dt);
    turnTurret(e, Math.atan2(C.y - e.y, C.x - e.x), dt);
    return;
  }
  const p = tac.searchPt || claimSearchPoint(e, C);
  if (!p) {
    tac.searchDone = true;
    return;
  }
  tac.searchT += dt;
  turnTurret(e, Math.atan2(p.y - e.y, p.x - e.x), dt);
  if (navTo(e, p.x, p.y, speed, dt) || Math.hypot(p.x - e.x, p.y - e.y) < T * 0.6 || tac.searchT > 8) {
    C.visited.add(p);
    tac.searchPt = null;
  }
}
// Огневая позиция: текущее место, если отсюда видна цель, линия огня свободна и место ничьё; иначе соседняя клетка.
function pickFirePos(e, foe) {
  if (lineClear(e, foe.x, foe.y) && posFree(e, e.x, e.y)) return { x: e.x, y: e.y };
  const c = cellOf(e.x),
    r = cellOf(e.y);
  let best = null,
    bd = Infinity;
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const x = (c + dc) * T + T / 2,
        y = (r + dr) * T + T / 2,
        d = Math.hypot(x - e.x, y - e.y);
      if (
        d >= bd ||
        !coverClear(x, y, e.r, true) ||
        !posFree(e, x, y) ||
        Math.hypot(foe.x - x, foe.y - y) >= CFG.enemySight ||
        !lineClear(e, foe.x, foe.y, true, x, y)
      )
        continue;
      best = { x, y };
      bd = d;
    }
  return best;
}
// Клетка для выдвижения прямой группы: свободна, с неё простреливается последняя известная позиция,
// путь к ней обходит стоящие свои машины не ближе зазора (поиск в ширину по текущей геометрии).
function approachSpot(e, C) {
  const c0 = clamp(cellOf(e.x), 0, COLS - 1),
    r0 = clamp(cellOf(e.y), 0, ROWS - 1),
    parked = regularTanks(e).filter(o => hullStopped(o));
  const n = COLS * ROWS,
    dist = new Int16Array(n).fill(-1),
    prev = new Int32Array(n).fill(-1),
    q = [r0 * COLS + c0];
  const near = i => {
    const p = cellCenter(i);
    return parked.some(o => Math.hypot(o.x - p.x, o.y - p.y) < gapFor(e, o) - 4);
  };
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h],
      c = i % COLS,
      r = (i / COLS) | 0;
    if (dist[i] >= 24) continue;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc,
        nr = r + dr,
        j = nr * COLS + nc;
      if (routeBlocked(nc, nr, c, r, e.r) || dist[j] >= 0 || tileAt(nc, nr) === BRICK || near(j)) continue;
      dist[j] = dist[i] + 1;
      prev[j] = i;
      q.push(j);
    }
  }
  let best = null,
    bs = Infinity;
  for (const i of q) {
    const p = cellCenter(i),
      dp = Math.hypot(C.x - p.x, C.y - p.y),
      score = dist[i] * T + dp * 0.5;
    if (score >= bs || dp < 3 * T || dp > CFG.enemySight * 0.9 || !coverClear(p.x, p.y, e.r, true) || !posFree(e, p.x, p.y)) continue;
    if (!lineClear(e, C.x, C.y, true, p.x, p.y) || (foliageOnRay(p.x, p.y, C.x, C.y) && dp > TACTICS.foliageSight * T)) continue;
    best = { x: p.x, y: p.y, i };
    bs = score;
  }
  if (!best) return null;
  const path = [];
  for (let i = best.i; i !== q[0] && i >= 0; i = prev[i]) path.unshift(cellCenter(i));
  best.path = path;
  best.k = 0;
  return best;
}
// Едет по готовому списку клеток (без поля маршрута): тормозит на поворотах и в конце.
function followCells(e, way, speed, dt) {
  while (way.k < way.path.length - 1 && Math.hypot(way.path[way.k].x - e.x, way.path[way.k].y - e.y) < T * 0.4) way.k++;
  const p = way.path[way.k];
  if (!p) {
    holdHull(e, null, dt);
    return true;
  }
  const last = way.k === way.path.length - 1,
    a = way.path[way.k - 1],
    b = way.path[way.k + 1];
  const brake = last || !a || !b || b.c - p.c !== p.c - a.c || b.r - p.r !== p.r - a.r;
  const res = tacticDrive(e, p.x, p.y, speed, dt, brake);
  return last && (res.arrived || Math.hypot(p.x - e.x, p.y - e.y) < 3);
}
// Укрытие сбоку: не дальше клетки по перпендикуляру к линии огня, доезжаемо и перекрывает ответный выстрел.
function coverBlocks(x, y, from, r) {
  const a = Math.atan2(y - from.y, x - from.x),
    nx = -Math.sin(a),
    ny = Math.cos(a);
  return [0, 0.6, -0.6].every(k => !los(from.x, from.y, x + nx * r * k, y + ny * r * k));
}
function findCover(e, from) {
  const a = Math.atan2(from.y - e.y, from.x - e.x),
    nx = -Math.sin(a),
    ny = Math.cos(a),
    reach = TACTICS.coverReach * T;
  for (const s of [reach * 0.5, -reach * 0.5, reach * 0.75, -reach * 0.75, reach, -reach]) {
    const x = e.x + nx * s,
      y = e.y + ny * s;
    if (!coverClear(x, y, e.r) || !posFree(e, x, y) || !coverBlocks(x, y, from, e.r)) continue;
    let clear = true;
    for (let k = 1; k <= 4 && clear; k++) clear = coverClear(e.x + (nx * s * k) / 4, e.y + (ny * s * k) / 4, e.r);
    if (clear) return { x, y };
  }
  return null;
}
function fightUpdate(e, dt, speed, foe, C) {
  const tac = e.tac,
    fs = tac.fs || (tac.fs = { pos: null, phase: 'hold', cover: null, hullAim: null, hullCycle: -1, cycle: 0, blind: 0 });
  const seen = tac.seen || C;
  const aimPt = foe ? leadPoint(e, foe) : { x: C.x, y: C.y },
    aim = Math.atan2(aimPt.y - e.y, aimPt.x - e.x);
  turnTurret(e, aim, dt);
  // укрытие перестало закрывать (пролом, другая позиция цели) — нужна новая огневая позиция
  if ((fs.phase === 'toCover' || fs.phase === 'hide') && !coverBlocks(fs.cover.x, fs.cover.y, seen, e.r)) {
    fs.phase = 'hold';
    fs.cover = null;
    fs.pos = null;
  }
  if (fs.phase === 'toCover') {
    fs.coverT = (fs.coverT || 0) + dt;
    if (tacticDrive(e, fs.cover.x, fs.cover.y, speed, dt).arrived || Math.hypot(fs.cover.x - e.x, fs.cover.y - e.y) < 3) {
      fs.phase = 'hide';
      fs.coverT = 0;
    }
    // до укрытия не доехать за время перезарядки — назад на огневую позицию
    else if (fs.coverT > Math.max(2.5, enemyInterval(e.kind) * 0.6)) {
      fs.phase = 'return';
      fs.coverT = 0;
    }
    return;
  }
  if (fs.phase === 'hide') {
    holdHull(e, null, dt);
    const back = Math.hypot(fs.pos.x - fs.cover.x, fs.pos.y - fs.cover.y) / Math.max(1, speed * HULL_REVERSE_SPEED) + 0.6;
    if (e.cd <= back) fs.phase = 'return';
    return;
  }
  if (fs.phase === 'return') {
    fs.returnT = (fs.returnT || 0) + dt;
    // проход к огневой позиции занят — огонь с того места, куда удалось вернуться, если оттуда видно цель
    if (fs.returnT > 3) fs.pos = { x: e.x, y: e.y };
    else if (!(tacticDrive(e, fs.pos.x, fs.pos.y, speed, dt).arrived || Math.hypot(fs.pos.x - e.x, fs.pos.y - e.y) < 3)) return;
    fs.phase = 'hold';
    fs.cover = null;
    fs.returnT = 0;
    // вернулся — заново проверяет линию огня
    if (!foe || !lineClear(e, foe.x, foe.y)) fs.pos = null;
  }
  if (!fs.pos && foe) fs.pos = pickFirePos(e, foe);
  if (!fs.pos) {
    // цель не видна: в бою — к ближайшей свободной клетке, откуда простреливается последняя известная позиция
    // (не сквозь стоящих своих); после потери контакта — к самой позиции в пределах поиска
    if (C.phase === 'lost') {
      const p = clampToSearch(e, C);
      if (navTo(e, p.x, p.y, speed, dt) || Math.hypot(p.x - e.x, p.y - e.y) < T * 0.8) tac.lostDone = true;
      return;
    }
    const ap = tac.approach,
      following = ap && ap.path && !ap.done && tac.wait < 1.5;
    if (((tac.approachT = (tac.approachT || 0) - dt) <= 0 && !following) || (ap && !posFree(e, ap.x, ap.y))) {
      // свободной клетки с прострелом нет: вне обзора — сближаться, иначе ждать, не протискиваясь между своими
      tac.approach = approachSpot(e, C) || (Math.hypot(C.x - e.x, C.y - e.y) > CFG.enemySight * 0.9 ? { x: C.x, y: C.y } : null);
      tac.approachT = 1.5;
    }
    if (tac.approach && tac.approach.path) {
      if (followCells(e, tac.approach, speed, dt)) tac.approach.done = true;
    } else if (tac.approach) navTo(e, tac.approach.x, tac.approach.y, speed, dt);
    else holdHull(e, null, dt);
    return;
  }
  if (Math.hypot(fs.pos.x - e.x, fs.pos.y - e.y) > 4) {
    // к выбранной позиции не пробиться за 4 с — выбрать заново
    if ((fs.moveT = (fs.moveT || 0) + dt) > 4) {
      fs.moveT = 0;
      fs.pos = null;
      tac.approach = null;
      tac.approachT = 0;
      return;
    }
    tacticDrive(e, fs.pos.x, fs.pos.y, speed, dt);
    return;
  }
  fs.moveT = 0;
  // доворот корпуса лбом к последней наблюдавшейся позиции — один раз за перезарядку, до следующего цикла угол фиксирован
  if (fs.hullCycle !== fs.cycle) {
    fs.hullAim = Math.atan2(seen.y - e.y, seen.x - e.x);
    fs.hullCycle = fs.cycle;
  }
  holdHull(e, fs.hullAim, dt);
  if (!foe) {
    if ((fs.blind += dt) > 1.5) {
      fs.pos = null;
      fs.blind = 0;
    }
    return;
  }
  fs.blind = 0;
  // линию огня перекрыл свой танк или стена: после короткого ожидания — другая огневая позиция рядом
  const clear = lineClear(e, aimPt.x, aimPt.y);
  fs.masked = clear || e.cd > 0 ? 0 : (fs.masked || 0) + dt;
  if (fs.masked > 1) {
    fs.masked = 0;
    const p = pickFirePos(e, foe) || approachSpot(e, foe);
    if (p && Math.hypot(p.x - e.x, p.y - e.y) > 2) {
      fs.pos = { x: p.x, y: p.y };
      return;
    }
  }
  if (readyToFire(e, aim) && clear) {
    fireTank(e);
    fs.cycle++;
    const cover = findCover(e, foe);
    if (cover) {
      fs.cover = cover;
      fs.phase = 'toCover';
    }
  }
}

// ---------- кадр ----------
function updateTacticalTank(e, dt) {
  const K = KINDS[e.kind],
    speed = K.speed * (1 + Math.min(wave, 10) * CFG.enemySpeedPerWave),
    tac = ensureTactic(e);
  if (e.lastHit && e.lastHit.at === undefined) {
    e.lastHit.at = tacClock;
    tac.hitAt = tacClock;
    tac.hitNew = true;
  }
  const foe = visibleFoe(e);
  e.engaged = !!foe;
  if (foe) {
    tac.seen = { x: foe.x, y: foe.y };
    tac.seenAt = tacClock;
  }
  // сценарный выезд: у выезда танк уходит с поля, если не видит цель
  if (e.storyExit !== undefined && (e.storyLeaving || !foe) && driveExit(e, e.storyExit, speed, dt)) return;
  if (tac.contact && (!tac.contact.target || tac.contact.target.dead || !tacContacts.includes(tac.contact))) leaveContact(e);
  if (foe) reportContact(e, foe);
  else if (tac.hitNew && !tac.contact) alarmFromHit(e);
  tac.hitNew = false;
  if (tac.contact) combatUpdate(e, dt, speed, foe);
  else marchUpdate(e, dt, speed);
}
// Координация групп раз в кадр (из игрового цикла, после formColumns): состав групп, контакты, роли, проверки.
function updateEnemyTactics(dt) {
  syncTactics();
  tacClock += dt;
  for (const g of tacGroups) g.members = g.members.filter(m => !m.dead && enemies.includes(m) && m.tac && m.tac.group === g);
  tacGroups = tacGroups.filter(g => g.members.length);
  for (const e of enemies) if (isTactical(e)) ensureTactic(e);
  for (const g of tacGroups)
    if ((g.geo !== geoVersion || g.goal.mobile) && tacClock - g.planAt >= TACTICS.replanInterval) revalidateGroup(g);
  for (const C of tacContacts.slice()) updateContact(C);
  for (const g of tacGroups) updateGroupCheck(g);
}
