'use strict';
// Поле: размеры, типы клеток и правила проходимости, каталог символов карт, генерация,
// фигурные препятствия, контур базы, сохранения карт/пресетов и выбор кампании.
// Этот файл — единственный владелец массивов поля (grid, маски, покрытия) и правил «что проходимо».
// Зависит от config.js/ui-text.js и maps.js (данные). Загрузка не создаёт DOM/Canvas и не читает сохранения.

let COLS = 30,
  ROWS = 20,
  W = COLS * T,
  H = ROWS * T;

// Типы клеток. SOLID — неразрушимое препятствие с собственным контуром (см. «фигурные препятствия»).
const EMPTY = 0,
  BRICK = 1,
  STEEL = 2,
  WATER = 3,
  TREE = 4,
  FENCE = 5,
  SOLID = 6;

// ---------- правила проходимости ----------
// Все вопросы «можно ли проехать / прострелить клетку» решаются только этими предикатами.
// Новый тип клетки обязан быть учтён в каждом из них.

const blocksRoute = t => t === STEEL || t === WATER;
const blocksTank = t => t === BRICK || t === FENCE || t === SOLID || blocksRoute(t);

const blocksBullet = t => t === BRICK || t === STEEL || t === FENCE || t === SOLID;

// Танки давят забор при наезде, поэтому для их маршрутов он проходим; мотоцикл и пешеходы его объезжают или минируют.
const blocksCrusher = t => t === BRICK || t === SOLID || blocksRoute(t);

const ARM_N = 1,
  ARM_E = 2,
  ARM_S = 4,
  ARM_W = 8;

const FENCE_H = ARM_E | ARM_W,
  FENCE_V = ARM_N | ARM_S;

const FENCE_SHAPES = [FENCE_H, FENCE_V, ARM_N | ARM_E, ARM_E | ARM_S, ARM_S | ARM_W, ARM_W | ARM_N];

const SPAWNS = Array.from({ length: 5 }, (_, i) => ({ c: 1 + Math.round((27 * i) / 4), r: 1 }));

const PLAYER_START = { x: W / 2 - 80, y: H - 48 };

const BASE_POS = { x: W / 2 + 16, y: H - 16, r: 16 };

// ---------- карта ----------
let grid, brickHp, brickMask, brickVariant, fenceArms, foliageMask, foliageShake, brickShake, sand, road, groundCanvas, gctx;
// Время симуляции: идёт только в бою, без паузы и стоп-кадра (остывание прожигов стали).
let simTime = 0;
// Повреждённые клетки из редакторов: около четверти кладки (3 из 10 кирпичей, одно попадание до
// разрушения) и одна крона из пяти — ближайшее к четверти с учётом дискретности маски листвы.
const DAMAGED_BRICK_MASK = (1 << 5) | (1 << 7) | (1 << 8),
  DAMAGED_BRICK_HP = 1,
  DAMAGED_LEAF_MASK = 1 << 4;
let steelDamage = new Map();
// Номер версии проходимости: растёт при разрушении кирпича/забора и при установке стен базы.
// По нему тактика врагов пересчитывает поля маршрутов, обходы и укрытия только после значимых изменений.
let geoVersion = 0;
const tileAt = (c, r) => (c < 0 || r < 0 || c >= COLS || r >= ROWS ? STEEL : grid[r * COLS + c]);
// Центр клетки в мировых координатах.
const cellMid = (c, r) => ({ x: c * T + T / 2, y: r * T + T / 2 });

const spawnCols = cols => Array.from({ length: 5 }, (_, i) => 1 + Math.round(((cols - 3) * i) / 4));
// клетки, которые игра всегда расчищает: подъезд к базе и точки появления врагов
function reservedCell(cols, c, r) {
  const rows = (cols * 2) / 3,
    center = Math.floor(cols / 2);
  if (r >= rows - 4 && c >= center - 3 && c <= center + 2) return true;
  return r <= 2 && spawnCols(cols).some(s => Math.abs(c - s) <= 1);
}
function configureMap(size) {
  COLS = MAP_SIZES.includes(Number(size)) ? Number(size) : 30;
  ROWS = (COLS * 2) / 3;
  W = COLS * T;
  H = ROWS * T;
  const center = Math.floor(COLS / 2);
  SPAWNS.splice(0, SPAWNS.length, ...spawnCols(COLS).map(c => ({ c, r: 1 })));
  Object.assign(BASE_POS, { x: center * T + 16, y: H - 16 });
  Object.assign(PLAYER_START, { x: center * T - 80, y: H - 48 });
  cv.width = W;
  cv.height = H;
  fit();
}
// режим декораций фиксируется в начале игры, как и размер карты
let mapMode = PREFS.mapMode;
// группы декораций для «Пресет тест 0.1»: B кирпич, F забор, S сталь, W вода, T дерево, P песок, R дорога, . пусто,
// D — кирпич, разрушенный на 75%, L — зелень, разрушенная на 75%,
// b/t — кирпич/дерево с шансом 60% (старый формат, в палитрах больше нет), пробел — клетка не трогается
const PREFABS = [
  { name: UI_TEXT.post, rows: ['TBT'] },
  { name: UI_TEXT.ugol, rows: ['BB', 'B.'] },
  { name: UI_TEXT.izgorod, rows: ['FFFF'] },
  { name: UI_TEXT.pleten, rows: ['FFF', 'F  ', 'F  '] },
  { name: UI_TEXT.ogorod, rows: ['FF.FF', 'F.t.F', 'F...F', 'FFFFF'] },
  { name: UI_TEXT.khutor, rows: ['FFFF.FF', 'F.....F', 'F.BB..F', 'F.BB.tF', 'FFF.FFF'] },
  { name: UI_TEXT.kusty, rows: ['tTt', 'Tt '] },
  { name: UI_TEXT.blindazh, rows: ['BBB', 'BSB'] },
  { name: UI_TEXT.okop, rows: ['BBb.BBB'] },
  { name: UI_TEXT.ruiny, rows: ['BBb.', 'B...', 'b..B', '.bBB'] },
  { name: UI_TEXT.roshcha, rows: [' tT ', 'tTTt', '.TTt', ' t  '] },
  { name: UI_TEXT.prud, rows: [' tt ', 'tWWt', 'WWWW', ' WWt'] },
  { name: UI_TEXT.sklad, rows: ['BBBBB', 'B...B', 'B.S.B', 'BB.BB'] },
  { name: UI_TEXT.pereprava, rows: ['tt...tt', 'WWW.WWW', 'WWW.WWW', 'tt...tt'] },
  { name: UI_TEXT.fort, rows: ['BB..BB', 'B....B', '..SS..', 'B....B', 'BB..BB'] },
  { name: UI_TEXT.derevnya, rows: ['BBB..t.', 'B.b.BBB', '....B.B', 't......', '.BBB.tt', '.B.B.t.'] },
  { name: UI_TEXT.karer, rows: [' PPP ', 'PPBPP', 'PbPPP', ' PPP '] },
];
// ---------- каталог символов карт и пресетов ----------
// Единственное место, где символ карты получает смысл. Новая клетка редактора — новая запись здесь
// плюс CSS-класс .t-<символ> в index.html (проверяется check-modules.cjs).
//   tile    — тип клетки; surface — покрытие под пустой клеткой ('sand' | 'road'): меняет скорость, а не тип;
//   damaged — клетка с заранее заданной маской разрушения (около 75%);
//   chance  — вероятность появления (старый формат b/t: читается, но в палитрах его нет — legacy);
//   label   — подпись кисти в редакторах; color — основа клетки на миниатюрах карт.
const CELL_CATALOG = {
  B: { tile: BRICK, label: UI_TEXT.kirpich, color: '#b3633a' },
  F: { tile: FENCE, label: UI_TEXT.zabor, color: '#56693f' },
  S: { tile: STEEL, label: UI_TEXT.broneplita, color: '#9aa6af' },
  W: { tile: WATER, label: UI_TEXT.voda, color: '#2c6d96' },
  T: { tile: TREE, label: UI_TEXT.lesoposadka, color: '#56693f' },
  P: { tile: EMPTY, surface: 'sand', label: UI_TEXT.pesok, color: '#b59e64' },
  R: { tile: EMPTY, surface: 'road', label: UI_TEXT.doroga, color: '#7d7f7a' },
  D: { tile: BRICK, damaged: true, label: UI_TEXT.kirpich_75, color: '#56693f' },
  L: { tile: TREE, damaged: true, label: UI_TEXT.zelen_75, color: '#56693f' },
  '.': { tile: EMPTY, label: UI_TEXT.raschistit, color: '#56693f' },
  b: { tile: BRICK, chance: 0.6, legacy: true, color: '#b3633a' },
  t: { tile: TREE, chance: 0.6, legacy: true, color: '#56693f' },
};
// Кисти редактора пресетов: клетки каталога и пробел — «не трогать».
const BRUSHES = [
  ...Object.entries(CELL_CATALOG)
    .filter(([, cell]) => !cell.legacy)
    .map(([ch, cell]) => [ch, cell.label]),
  [' ', UI_TEXT.ne_trogat],
];
const CELL_CHARS = Object.keys(CELL_CATALOG).join('');
const validCells = (row, extra = '') =>
  typeof row === 'string' && row.length > 0 && [...row].every(ch => CELL_CHARS.includes(ch) || extra.includes(ch));
// Ставит клетку по символу каталога. marks: sand/road/damage для genMap.
function placeCell(set, marks, c, r, ch) {
  const cell = CELL_CATALOG[ch],
    t = cell.chance === undefined || Math.random() < cell.chance ? cell.tile : EMPTY;
  set(c, r, t);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return t;
  const i = r * COLS + c;
  marks.sand[i] = cell.surface === 'sand' ? 1 : 0;
  marks.road[i] = cell.surface === 'road' ? 1 : 0;
  marks.damage[i] = cell.damaged ? 1 : 0;
  return t;
}
// пресеты живут в паках, паки хранятся в браузере; PREFABS — исходное содержимое пака «Пресеты Клода»
const PACKS_KEY = 'ecotank-packs-v1',
  OLD_PRESETS_KEY = 'ecotank-presets-v1';
const CLAUDE_PACK = 'claude',
  CLAUDE_PACK_NAME = UI_TEXT.presety_kloda;
const validPreset = p =>
  p &&
  typeof p.name === 'string' &&
  p.name.trim() &&
  Array.isArray(p.rows) &&
  p.rows.length >= 1 &&
  p.rows.length <= PRESET_MAX &&
  p.rows.every(r => typeof r === 'string' && r.length === p.rows[0].length && r.length <= PRESET_MAX && validCells(r, ' ')) &&
  p.rows.some(r => r.trim());
const defaultClaudePack = () => ({
  id: CLAUDE_PACK,
  name: CLAUDE_PACK_NAME,
  enabled: true,
  presets: PREFABS.map(p => ({ name: p.name, rows: [...p.rows] })),
});
function loadPacks() {
  let packs = null;
  try {
    packs = JSON.parse(localStorage.getItem(PACKS_KEY));
  } catch (e) {}
  if (!Array.isArray(packs)) {
    packs = [defaultClaudePack()];
    // пресеты из первой версии редактора переезжают в отдельный пак
    try {
      const old = JSON.parse(localStorage.getItem(OLD_PRESETS_KEY));
      if (Array.isArray(old) && old.some(validPreset))
        packs.push({ id: 'mine', name: UI_TEXT.moi_presety, enabled: true, presets: old.filter(validPreset) });
    } catch (e) {}
  }
  packs = packs
    .filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.presets))
    .map(p => ({
      id: p.id,
      name: p.id === CLAUDE_PACK ? CLAUDE_PACK_NAME : p.name.trim() || UI_TEXT.bez_imeni,
      enabled: p.enabled !== false,
      presets: p.presets.filter(validPreset),
    }));
  if (!packs.some(p => p.id === CLAUDE_PACK)) packs.unshift(defaultClaudePack());
  return packs;
}
function savePacks(packs) {
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(packs));
  } catch (e) {}
}
const activePresets = () =>
  loadPacks()
    .filter(p => p.enabled)
    .flatMap(p => p.presets);
// частота пока зависит только от площади: чем больше группа, тем реже
const prefabWeight = p => 9 / Math.sqrt(p.rows.length * p.rows[0].length);
function pickPrefab(list) {
  let roll = Math.random() * list.reduce((s, p) => s + prefabWeight(p), 0);
  return list.find(p => (roll -= prefabWeight(p)) < 0) || list[0];
}
// клетки шаблона со случайным поворотом на 90°·k и отражением
function prefabCells(p) {
  let w = p.rows[0].length,
    h = p.rows.length,
    cells = [];
  p.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== ' ') cells.push([x, y, ch]);
    }),
  );
  if (Math.random() < 0.5) cells = cells.map(([x, y, ch]) => [w - 1 - x, y, ch]);
  for (let k = ri(0, 3); k > 0; k--) {
    cells = cells.map(([x, y, ch]) => [h - 1 - y, x, ch]);
    [w, h] = [h, w];
  }
  return { w, h, cells };
}
function placeOriginal(set) {
  const n = Math.round((CFG.mapElements * COLS * ROWS) / 600);
  for (let i = 0; i < n; i++) {
    const roll = Math.random();
    const type = roll < 0.47 ? BRICK : roll < 0.55 ? FENCE : roll < 0.7 ? STEEL : roll < 0.82 ? WATER : TREE;
    let cw = ri(1, 3),
      ch = ri(1, 3);
    if (type === FENCE || (type !== TREE && Math.random() < 0.25)) {
      if (Math.random() < 0.5) {
        cw = ri(3, 6);
        ch = 1;
      } else {
        cw = 1;
        ch = ri(3, 5);
      }
    }
    if (type === STEEL) {
      cw = Math.min(cw, 3);
      ch = Math.min(ch, 3);
    }
    const c0 = ri(0, COLS - 1),
      r0 = ri(2, ROWS - 3);
    for (let y = r0; y < r0 + ch; y++) for (let x = c0; x < c0 + cw && x < COLS; x++) set(x, y, type);
  }
}
// группы не перекрываются и держат проход в клетку между собой
function placePresets(set, marks) {
  const occ = new Uint8Array(COLS * ROWS),
    budget = Math.round(((CFG.mapElements * COLS * ROWS) / 600) * 3);
  const list = activePresets();
  if (!list.length) return;
  let filled = 0;
  for (let tries = 0; tries < 400 && filled < budget; tries++) {
    const { w, h, cells } = prefabCells(pickPrefab(list));
    if (w > COLS || ROWS - 2 - h < 2) continue;
    const c0 = ri(0, COLS - w),
      r0 = ri(2, ROWS - 2 - h);
    let free = true;
    for (let y = r0 - 1; y <= r0 + h && free; y++)
      for (let x = c0 - 1; x <= c0 + w; x++)
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS && occ[y * COLS + x]) {
          free = false;
          break;
        }
    if (!free) continue;
    for (let y = r0; y < r0 + h; y++) for (let x = c0; x < c0 + w; x++) occ[y * COLS + x] = 1;
    for (const [x, y, ch] of cells) if (placeCell(set, marks, c0 + x, r0 + y, ch) !== EMPTY || CELL_CATALOG[ch].surface) filled++;
  }
}
// ---------- готовые карты ----------
// карта — строки из тех же символов, что и пресеты (кроме пробела): размер 30/45/60 в ширину, высота = 2/3 ширины.
// «Карты Клода» лежат в maps.js (window.ECOTANK_MAPS), свои карты пользователя — в браузере
const MAPS_KEY = 'ecotank-maps-v1';
function normalizeMap(m) {
  if (
    !m ||
    typeof m.name !== 'string' ||
    !m.name.trim() ||
    !MAP_SIZES.includes(m.cols) ||
    !Array.isArray(m.rows) ||
    m.rows.length !== (m.cols * 2) / 3
  )
    return null;
  const rows = m.rows.map(r => (typeof r === 'string' ? r.replace(/ /g, '.') : ''));
  if (rows.some(r => r.length !== m.cols || !validCells(r))) return null;
  return { id: typeof m.id === 'string' ? m.id : '', name: m.name.trim(), cols: m.cols, rows };
}
const claudeMaps = () =>
  (Array.isArray(window.ECOTANK_MAPS) ? window.ECOTANK_MAPS : [])
    .map(normalizeMap)
    .filter(m => m && m.id)
    .map(m => ({ ...m, claude: true }));
function loadUserMaps() {
  try {
    const list = JSON.parse(localStorage.getItem(MAPS_KEY));
    return Array.isArray(list) ? list.map(normalizeMap).filter(m => m && m.id) : [];
  } catch (e) {
    return [];
  }
}
function saveUserMaps(list) {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(list.map(({ id, name, cols, rows }) => ({ id, name, cols, rows }))));
  } catch (e) {}
}
const allMaps = () => [...claudeMaps(), ...loadUserMaps()];
const findMap = id => allMaps().find(m => m.id === id) || null;
// есть ли проезд от каждой точки появления врагов до базы (сталь и вода непроходимы, кирпич простреливается)
function mapPassable(cols, rows) {
  const h = (cols * 2) / 3,
    seen = new Uint8Array(cols * h),
    start = (h - 2) * cols + Math.floor(cols / 2),
    q = [start];
  const blocked = (c, r) => !reservedCell(cols, c, r) && blocksRoute(CELL_CATALOG[rows[r][c]].tile);
  seen[start] = 1;
  for (let k = 0; k < q.length; k++) {
    const c = q[k] % cols,
      r = (q[k] / cols) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc,
        nr = r + dr,
        j = nr * cols + nc;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= h || seen[j] || blocked(nc, nr)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return spawnCols(cols).every(c => seen[cols + c]);
}
function placeMap(set, marks, map) {
  map.rows.forEach((row, r) => [...row].forEach((ch, c) => placeCell(set, marks, c, r, ch)));
}
// ---------- кампания ----------
// уровни — карты Клода в порядке window.ECOTANK_CAMPAIGN (без него — все карты из maps.js по порядку);
// номер уровня служит номером волны, поэтому врагов с каждым уровнем больше
const CAMPAIGN_KEY = 'ecotank-campaign-v1';
function campaignMaps() {
  const maps = claudeMaps(),
    order = Array.isArray(window.ECOTANK_CAMPAIGN) ? window.ECOTANK_CAMPAIGN : [];
  const listed = order.map(id => maps.find(m => m.id === id)).filter(Boolean);
  return listed.length ? listed : maps;
}
// сколько уровней открыто для старта (первый открыт всегда)
function campaignUnlocked() {
  let n = 1;
  try {
    n = Math.max(1, +localStorage.getItem(CAMPAIGN_KEY) || 1);
  } catch (e) {}
  return Math.min(n, Math.max(1, campaignMaps().length));
}
function unlockCampaign(level) {
  if (level <= campaignUnlocked()) return;
  try {
    localStorage.setItem(CAMPAIGN_KEY, String(level));
  } catch (e) {}
}

// режим, размер и карта фиксируются в начале игры; удалённая карта откатывает режим к оригинальному
let activeMap = null,
  campaign = null,
  victory = false;
function applyMapChoice() {
  campaign = null;
  if (PREFS.mapMode === 'campaign') {
    const levels = campaignMaps();
    if (levels.length) {
      campaign = levels;
      PREFS.campaignStart = clamp(Math.floor(+PREFS.campaignStart || 0), 0, campaignUnlocked() - 1);
      activeMap = levels[PREFS.campaignStart];
      mapMode = 'map';
      configureMap(activeMap.cols);
      return;
    }
  }
  activeMap = PREFS.mapMode === 'map' ? findMap(PREFS.mapPick) : null;
  mapMode = PREFS.mapMode === 'map' && !activeMap ? 'original' : PREFS.mapMode === 'campaign' ? 'original' : PREFS.mapMode;
  configureMap(activeMap ? activeMap.cols : PREFS.mapSize);
}

// форма забора по соседним заборам: прямая или один из четырёх углов, без свободного вращения
function shapeFences() {
  fenceArms = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r * COLS + c] !== FENCE) continue;
      const n = tileAt(c, r - 1) === FENCE,
        s = tileAt(c, r + 1) === FENCE,
        e = tileAt(c + 1, r) === FENCE,
        w = tileAt(c - 1, r) === FENCE;
      const vert = n || s,
        horiz = e || w;
      fenceArms[r * COLS + c] = vert && horiz ? (n ? ARM_N : ARM_S) | (e ? ARM_E : ARM_W) : vert ? FENCE_V : FENCE_H;
    }
}
function genMap(w, authored = false) {
  steelDamage.clear();
  pendingBaseWalls.clear();
  clearSolids();
  const center = Math.floor(COLS / 2);
  let marks;
  for (let tries = 0; tries < 60; tries++) {
    grid = new Uint8Array(COLS * ROWS);
    marks = { sand: new Uint8Array(COLS * ROWS), road: new Uint8Array(COLS * ROWS), damage: new Uint8Array(COLS * ROWS) };
    foliageMask = new Uint8Array(COLS * ROWS);
    foliageMask.fill(31);
    foliageShake = new Float32Array(COLS * ROWS);
    const set = (c, r, t) => {
      if (c >= 0 && r >= 0 && c < COLS && r < ROWS) {
        grid[r * COLS + c] = t;
      }
    };
    if (mapMode === 'map') placeMap(set, marks, activeMap);
    else if (mapMode === 'preset01') placePresets(set, marks);
    else placeOriginal(set);
    if (authored) break;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (reservedCell(COLS, c, r)) grid[r * COLS + c] = EMPTY;
    if (connected()) break;
    // At extreme density, clear guaranteed routes rather than return a sealed map.
    if (tries === 59)
      for (const spawn of SPAWNS) {
        for (let r = spawn.r; r <= ROWS - 2; r++) set(spawn.c, r, EMPTY);
        for (let c = Math.min(spawn.c, center); c <= Math.max(spawn.c, center); c++) set(c, ROWS - 2, EMPTY);
      }
  }
  brickHp = new Uint8Array(COLS * ROWS);
  brickMask = new Uint16Array(COLS * ROWS);
  brickVariant = new Uint8Array(COLS * ROWS);
  brickShake = new Float32Array(COLS * ROWS);
  for (let i = 0; i < grid.length; i++)
    if (grid[i] === BRICK) {
      brickHp[i] = 4;
      brickMask[i] = 1023;
      brickVariant[i] = ri(0, 2);
    }
  // D/L из редакторов становятся обычными BRICK/TREE с заранее заданными масками
  for (let i = 0; i < grid.length; i++)
    if (marks.damage[i]) {
      if (grid[i] === BRICK) {
        brickHp[i] = DAMAGED_BRICK_HP;
        brickMask[i] = DAMAGED_BRICK_MASK;
      } else if (grid[i] === TREE) foliageMask[i] = DAMAGED_LEAF_MASK;
    }
  shapeFences();
  sand = new Uint8Array(COLS * ROWS);
  road = new Uint8Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (grid[i] === EMPTY && marks.road[i]) {
        road[i] = 1;
        continue;
      }
      if (![EMPTY, TREE].includes(tileAt(c, r))) continue;
      const near = DIRS.some(([dx, dy]) => tileAt(c + dx, r + dy) === WATER);
      // на готовой карте песок только нарисованный, без случайного
      sand[i] = marks.sand[i] || (mapMode !== 'map' && Math.random() < (near ? 0.7 : 0.035)) ? 1 : 0;
    }
  buildGround();
}

// ---------- контур базы ----------
// Зона базы — клетка базы и её контур (3×2 клетки у нижнего края). Союзники не ломают её и не считают проходом,
// бонусы в ней не появляются. Действует, только когда в игре есть база.
const baseZone = (c, r) => r >= ROWS - 2 && Math.abs(c - Math.floor(COLS / 2)) <= 1;
const baseWall = (c, r) => !!base && baseZone(c, r);
// Штатный контур: три клетки над базой и по клетке слева и справа; клетка самой базы остаётся свободной.
function baseWallCells() {
  const center = Math.floor(COLS / 2),
    cells = [];
  for (let r = ROWS - 2; r < ROWS; r++)
    for (let c = center - 1; c <= center + 1; c++) if (r === ROWS - 2 || c !== center) cells.push(r * COLS + c);
  return cells;
}

// ---------- фигурные препятствия ----------
// Клетка SOLID — неразрушимое препятствие с собственным контуром (например, мельница сценария).
// Контур — прямоугольники в мировых координатах на каждую клетку; по нему считаются столкновения танков,
// снарядов, видимость и маршруты. Сценарий ставит препятствие через addSolid() после genMap();
// genMap() препятствия сбрасывает.
let solidCells = new Map(),
  solidOutline = [],
  solidBounds = null;
function clearSolids() {
  solidCells = new Map();
  solidOutline = [];
  solidBounds = null;
}
// rectsByCell: Map «индекс клетки → прямоугольники {x,y,w,h}». Клетки становятся SOLID.
function addSolid(rectsByCell) {
  for (const [i, rects] of rectsByCell) {
    grid[i] = SOLID;
    solidCells.set(i, rects);
    solidOutline.push(...rects);
    const c = i % COLS,
      r = (i / COLS) | 0,
      b = solidBounds || (solidBounds = { c0: c, r0: r, c1: c, r1: r });
    b.c0 = Math.min(b.c0, c);
    b.r0 = Math.min(b.r0, r);
    b.c1 = Math.max(b.c1, c);
    b.r1 = Math.max(b.r1, r);
  }
  geoVersion++;
}
const solidRects = (c, r) => solidCells.get(r * COLS + c) || [];
// Задевает ли круг радиуса radius контур какого-либо препятствия.
function solidNear(x, y, radius) {
  const b = solidBounds;
  if (!b) return false;
  for (let r = Math.max(b.r0, Math.floor((y - radius) / T)); r <= Math.min(b.r1, Math.floor((y + radius) / T)); r++) {
    for (let c = Math.max(b.c0, Math.floor((x - radius) / T)); c <= Math.min(b.c1, Math.floor((x + radius) / T)); c++) {
      if (solidRects(c, r).some(q => rectNear(x, y, q.x, q.y, q.w, q.h, radius * radius))) return true;
    }
  }
  return false;
}
// Длина луча из (x, y) по единичному направлению (dx, dy) до первого препятствия, не больше range.
function solidRayLimit(x, y, dx, dy, range) {
  const b = solidBounds;
  if (!b) return range;
  const endX = x + dx * range,
    endY = y + dy * range;
  if (
    Math.max(x, endX) < b.c0 * T ||
    Math.min(x, endX) > (b.c1 + 1) * T ||
    Math.max(y, endY) < b.r0 * T ||
    Math.min(y, endY) > (b.r1 + 1) * T
  )
    return range;
  for (const box of solidOutline) {
    let near = 0,
      far = range;
    for (const [origin, direction, min, max] of [
      [x, dx, box.x, box.x + box.w],
      [y, dy, box.y, box.y + box.h],
    ]) {
      if (Math.abs(direction) < 1e-10) {
        if (origin < min || origin > max) {
          far = -1;
          break;
        }
      } else {
        const a = (min - origin) / direction,
          e = (max - origin) / direction;
        near = Math.max(near, Math.min(a, e));
        far = Math.min(far, Math.max(a, e));
      }
      if (near > far) break;
    }
    if (near <= far) range = near;
  }
  return range;
}
// Пустые клетки контура, занятые техникой: стена встаёт туда, когда машина уедет.
const pendingBaseWalls = new Map();
// Ставит целую стену и сбрасывает всё, от чего зависят коллизии, отрисовка и маршруты клетки.
function setBaseWall(i, material) {
  grid[i] = material;
  brickShake[i] = 0;
  foliageMask[i] = 31;
  fenceArms[i] = 0;
  steelDamage.delete(i);
  if (material === BRICK) {
    brickHp[i] = 4;
    brickMask[i] = 1023;
    brickVariant[i] = ri(0, 2);
  } else {
    brickHp[i] = 0;
    brickMask[i] = 0;
  }
  geoVersion++;
}
const baseWallReady = (i, material) =>
  grid[i] === material &&
  (material !== BRICK || (brickMask[i] === 1023 && brickHp[i] === 4)) &&
  (material !== STEEL || !steelDamage.has(i));
// mode: 'level' — кирпич на старте уровня; 'brick' — Стройбат (уже стоящую сталь не трогает);
// 'steel' — Железный занавес. occupied(c,r) — стоит ли в клетке машина: пустая клетка под ней откладывается.
function fortifyBase(mode, occupied = () => false) {
  let changed = 0;
  for (const i of baseWallCells()) {
    if (mode === 'brick' && grid[i] === STEEL) continue;
    const material = mode === 'steel' ? STEEL : BRICK;
    if (baseWallReady(i, material)) {
      pendingBaseWalls.delete(i);
      continue;
    }
    changed++;
    if (mode !== 'level' && !blocksTank(grid[i]) && occupied(i % COLS, (i / COLS) | 0)) {
      pendingBaseWalls.set(i, material);
      continue;
    }
    setBaseWall(i, material);
    pendingBaseWalls.delete(i);
  }
  return changed;
}
function updateBaseWalls(occupied) {
  for (const [i, material] of pendingBaseWalls)
    if (!occupied(i % COLS, (i / COLS) | 0)) {
      setBaseWall(i, material);
      pendingBaseWalls.delete(i);
    }
}
// Есть ли что восстанавливать этим бонусом (для itemUseful).
const baseWallsNeed = mode =>
  baseWallCells().some(
    i =>
      !(mode === 'brick' && grid[i] === STEEL) &&
      !baseWallReady(i, mode === 'steel' ? STEEL : BRICK) &&
      pendingBaseWalls.get(i) !== (mode === 'steel' ? STEEL : BRICK),
  );

function connected() {
  const seen = new Uint8Array(COLS * ROWS),
    start = (ROWS - 2) * COLS + Math.floor(COLS / 2),
    q = [start];
  seen[start] = 1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h] % COLS,
      r = (q[h] / COLS) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc,
        nr = r + dr,
        t = tileAt(nc, nr),
        j = nr * COLS + nc;
      if (blocksRoute(t) || seen[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return SPAWNS.every(s => seen[s.r * COLS + s.c]);
}

function buildGround() {
  groundCanvas = document.createElement('canvas');
  groundCanvas.width = W;
  groundCanvas.height = H;
  gctx = groundCanvas.getContext('2d');
  gctx.fillStyle = '#56693f';
  gctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 60; i++) {
    gctx.fillStyle = `rgba(115,92,55,${rnd(0.08, 0.22)})`;
    gctx.beginPath();
    gctx.ellipse(rnd(0, W), rnd(0, H), rnd(20, 70), rnd(12, 40), rnd(0, 3), 0, Math.PI * 2);
    gctx.fill();
  }
  for (let i = 0; i < 2600; i++) {
    gctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,.06)' : 'rgba(0,0,0,.08)';
    gctx.fillRect(rnd(0, W), rnd(0, H), 2, 2);
  }
  gctx.strokeStyle = 'rgba(140,180,90,.35)';
  gctx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = rnd(0, W),
      y = rnd(0, H);
    gctx.beginPath();
    gctx.moveTo(x, y);
    gctx.lineTo(x - 2, y - 5);
    gctx.moveTo(x, y);
    gctx.lineTo(x + 2, y - 4);
    gctx.stroke();
  }
  drawSandGround();
}

function drawSandGround() {
  detailGround(gctx);
}
