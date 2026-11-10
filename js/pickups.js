'use strict';
// Бонусы: каталог ITEMS, подбор, появление по таймеру и сбор оставшегося металлолома.
// Массив items принадлежит этому файлу по смыслу: менять его состав можно только функциями отсюда.
// Использует состояние игры (player/allies/wrecks/scrap), конфигурацию, геометрию мира,
// улучшение танка, артподготовку, подкрепление и стены базы. При подключении ничего не создаёт.

// ---------- каталог бонусов ----------
// Одна запись — один бонус. Новый бонус добавляется только сюда (и подписью в ui-text.js).
//   color, glyph, name — вид на поле и подпись при подборе.
//   useful(t)   — нужен ли бонус получателю t (игроку или союзнику). Ненужный бонус не подбирается.
//   apply(t,it) — действие при подборе.
//   timed       — временный эффект: счётчик t.pw[тип] на CFG.powerupTime секунд (useful/apply не нужны).
//   spawnable() — может ли бонус появляться сейчас; без поля — всегда.
// Порядок записей влияет на выбор случайного бонуса при одном и том же зерне.
const ITEMS = {
  upgrade: {
    color: '#ffd45c',
    glyph: '★',
    name: UI_TEXT.uluchshenie_tanka,
    spawnable: () => !player || player.upgrade < MAX_TIER,
    useful: t => t.upgrade < MAX_TIER,
    apply: t => beginPlayerUpgrade(t),
  },
  barrage: { color: '#ffab52', glyph: '✹', name: UI_TEXT.artpodgotovka, useful: () => true, apply: () => callBarrage() },
  repair: {
    color: '#e5484d',
    glyph: '+',
    name: UI_TEXT.remont,
    useful: t => t.hp < t.maxHp,
    apply: t => {
      t.hp = Math.min(t.maxHp, t.hp + CFG.repairAmount);
    },
  },
  rapid: { color: '#f2c94c', glyph: '»', name: UI_TEXT.skorostrel, timed: true },
  shield: { color: '#7be38a', glyph: '◯', name: UI_TEXT.shchit, timed: true },
  rail: {
    color: '#c58cff',
    glyph: '⌁',
    name: UI_TEXT.relsotron,
    useful: t => t.rail < CFG.railMax,
    apply: t => {
      t.rail = Math.min(CFG.railMax, t.rail + 1);
    },
  },
  reinforce: { color: '#9be36f', glyph: '+', name: UI_TEXT.podkreplenie, useful: () => true, apply: () => queueReinforcements(2) },
  stroybat: {
    color: '#d0844f',
    glyph: '▦',
    name: UI_TEXT.stroybat,
    useful: () => !!base && !base.dead && baseWallsNeed('brick'),
    apply: () => {
      fortifyBase('brick', cellOccupied);
      burst(base.x, base.y - T, 14, ['#d08a5c', '#b3633a'], 120, 0.45, 4, 'debris');
    },
  },
  curtain: {
    color: '#b9c3ca',
    glyph: '▣',
    name: UI_TEXT.zheleznyy_zanaves,
    useful: () => !!base && !base.dead && baseWallsNeed('steel'),
    apply: () => {
      fortifyBase('steel', cellOccupied);
      burst(base.x, base.y - T, 14, ['#dfe6ea', '#9aa6af'], 120, 0.45, 4, 'debris');
    },
  },
};

const itemSpawnable = type => !ITEMS[type].spawnable || ITEMS[type].spawnable();
function availableItemTypes() {
  return Object.keys(ITEMS).filter(itemSpawnable);
}
function dropUnavailableItems() {
  items = items.filter(it => itemSpawnable(it.type));
}

function itemUseful(t, it) {
  const item = ITEMS[it.type];
  if (!item || !t || t.dead || t.upgradeT > 0 || t.entering || it.life <= 0) return false;
  if (item.timed) return t.pw[it.type] < CFG.powerupTime;
  return item.useful(t, it);
}

// Занята ли клетка техникой или пешим смертником: стену в такую клетку ставить нельзя.
function cellOccupied(c, r) {
  const x0 = c * T,
    y0 = r * T,
    hits = t => Math.hypot(t.x - clamp(t.x, x0, x0 + T), t.y - clamp(t.y, y0, y0 + T)) < t.r;
  return [player, ...allies, ...enemies].some(t => t && !t.dead && hits(t)) || bombers.some(b => b.state === 'lit' && hits(b));
}

function applyItem(t, it) {
  if (!itemUseful(t, it)) return false;
  const item = ITEMS[it.type];
  if (item.timed) t.pw[it.type] = CFG.powerupTime;
  else item.apply(t, it);
  it.life = 0;
  floatText(it.x, it.y - 12, item.name, item.color);
  sfx('pick');
  return true;
}

// Игрок имеет приоритет при одновременном подборе; один предмет расходуется один раз.
function updateItems(dt) {
  const recipients = [player, ...allies];
  for (const it of items) {
    it.life -= dt;
    if (it.life <= 0) continue;
    for (const t of recipients) if (t && Math.hypot(t.x - it.x, t.y - it.y) < 24 && applyItem(t, it)) break;
  }
  items = items.filter(it => it.life > 0);
}

function collectRemainingScrap() {
  let collected = 0;
  for (const w of wrecks)
    if (!w.taken && w.kind !== 'player') {
      collected += KINDS[w.kind].scrap;
      w.taken = true;
    }
  scrap += collected;
  return collected;
}

// Бонусы появляются только по таймеру: в свободной клетке не дальше ITEM_SPAWN_RANGE от живого
// игрока или союзника. Стены, вода, зелень, база с контуром и занятые бонусами клетки исключены;
// если подходящих клеток нет, это появление пропускается.
const ITEM_SPAWN_RANGE = 10 * T,
  ITEM_SPAWN_PERIOD = 10,
  ITEM_LIFE = 24;
function updateRandomItems(dt) {
  if (state !== 'play' || !player || player.dead || (base && base.dead)) return;
  itemSpawnTimer -= dt;
  if (itemSpawnTimer > 0) return;
  itemSpawnTimer += ITEM_SPAWN_PERIOD;
  const friends = [player, ...allies].filter(t => t && !t.dead && !t.entering),
    candidates = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (tileAt(c, r) !== EMPTY || baseWall(c, r)) continue;
      const { x, y } = cellMid(c, r);
      if (base && Math.hypot(x - base.x, y - base.y) <= 50) continue;
      if (items.some(it => Math.hypot(x - it.x, y - it.y) < 30)) continue;
      if (!friends.some(t => Math.hypot(t.x - x, t.y - y) <= ITEM_SPAWN_RANGE)) continue;
      candidates.push({ x, y });
    }
  if (candidates.length) {
    const spot = candidates[ri(0, candidates.length - 1)],
      types = availableItemTypes();
    items.push({ ...spot, type: types[ri(0, types.length - 1)], life: ITEM_LIFE });
  }
}
