'use strict';
// Состав волн обычного боя, ограничение числа врагов и появление танков сверху.
// Использует CFG, точки SPAWNS из world.js и makeTank из tanks.js. Очередь toSpawn, таймер spawnTimer
// и номер wave принадлежат game.js. Подключение файла не создаёт врагов и не запускает таймеры.

// ---------- состав волны ----------
// Основной состав: для каждого места в волне виды проверяются по порядку, share(w) — доля вида в волне w.
// Последняя запись без share забирает остаток. Новый вид врага в обычном бою — новая строка здесь.
const WAVE_MIX = [
  { kind: 'heavy', share: w => Math.min(0.07 * w, 0.35) },
  { kind: 'scout', share: () => 0.38 },
  { kind: 'moto', share: w => (w >= 2 ? 0.12 : 0) },
  { kind: 'soldier' },
];
// Сверх основного состава (никого не вытесняют): every — после каждых N машин,
// chance() — после каждой машины с этой вероятностью; from — с какой волны.
const WAVE_EXTRAS = [
  { kind: 'artillery', every: 5 },
  { kind: 'rocket', from: 2, chance: () => CFG.rocketChance },
];

function waveList(w) {
  const n = CFG.waveBase + (w - 1) * CFG.wavePerLevel,
    list = [];
  for (let i = 0; i < n; i++) {
    let roll = Math.random();
    list.push(WAVE_MIX.find(m => !m.share || (roll -= m.share(w)) < 0).kind);
    for (const extra of WAVE_EXTRAS) {
      if (w < (extra.from || 1)) continue;
      if (extra.every ? (i + 1) % extra.every === 0 : Math.random() < extra.chance()) list.push(extra.kind);
    }
  }
  return list;
}

const maxAlive = () => Math.min(CFG.maxAliveBase + Math.floor(wave / 2), CFG.maxAliveCap);

// Враг выезжает из-за верхнего края в одной из свободных точек появления.
function updateSpawns(dt) {
  spawnTimer -= dt;
  if (!toSpawn.length || spawnTimer > 0 || enemies.length >= maxAlive()) return;
  const free = SPAWNS.filter(s => {
    const { x, y } = cellMid(s.c, s.r);
    return !enemies.concat(allies, player && !player.dead ? [player] : []).some(t => Math.hypot(t.x - x, t.y - y) < 40);
  });
  if (!free.length) return;
  const s = free[ri(0, free.length - 1)];
  const e = makeTank(cellMid(s.c, s.r).x, -T, toSpawn.pop());
  e.angle = e.turret = Math.PI / 2;
  e.spawnT = 0;
  e.entering = true;
  enemies.push(e);
  spawnTimer = rnd(1.2, 2.4);
}
