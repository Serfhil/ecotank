'use strict';
// Состав волн, ограничение числа врагов и появление танков сверху.
// Использует CFG, точки SPAWNS из world.js, makeTank из tanks.js и утилиты игры.
// Очередь toSpawn, таймер spawnTimer, номер wave и enemies/player остаются
// в общем состоянии index.html. Смена уровня и кампании остаётся в игровом цикле.
// Подключение файла не создаёт врагов и не запускает таймеры.

function waveList(w) {
  const n = CFG.waveBase + (w - 1) * CFG.wavePerLevel, list = [], pH = Math.min(.07 * w, .35), pM = w >= 2 ? .12 : 0;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    list.push(r < pH ? 'heavy' : r < pH + .38 ? 'scout' : r < pH + .38 + pM ? 'moto' : 'soldier');
    if((i+1)%5===0)list.push('artillery');
    // РСЗО добавляется сверх обычного состава со второй волны и никого не вытесняет
    if(w>=2&&Math.random()<CFG.rocketChance)list.push('rocket');
  }
  return list;
}

const maxAlive = () => Math.min(CFG.maxAliveBase + Math.floor(wave / 2), CFG.maxAliveCap);

function updateSpawns(dt) {
  spawnTimer -= dt;
  if (!toSpawn.length || spawnTimer > 0 || enemies.length >= maxAlive()) return;
  const free = SPAWNS.filter(s => {
    const x = s.c * T + 16, y = s.r * T + 16;
    return !enemies.concat(allies, player && !player.dead ? [player] : []).some(t => Math.hypot(t.x - x, t.y - y) < 40);
  });
  if (!free.length) return;
  const s = free[ri(0, free.length - 1)];
  const e = makeTank(s.c * T + 16, -32, toSpawn.pop());
  e.angle = e.turret = Math.PI / 2; e.spawnT = 0; e.entering=true;
  enemies.push(e);
  spawnTimer = rnd(1.2, 2.4);
}
