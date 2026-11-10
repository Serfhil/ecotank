'use strict';
// Урон танкам и базе, гибель, цепные взрывы и обновление обломков.
// Окружение повреждается через destruction.js, эффекты создаются существующими
// burst/explosion/floatText, звук — sfx. Состояние счёта, обломков и объектов остаётся
// в игровом цикле. Подключение файла само по себе не наносит урон и не создаёт эффекты.

function blastDamage(x, y, diameter = 30, options = {}) {
  const radius = diameter * 1.5,
    damage = options.damage || 1;
  damageTerrainFromBlast(x, y, radius, damage);
  sapperBlast(x, y, radius);
  // Marked-dead tanks are ignored, so chain explosions cannot award duplicate kills.
  for (const e of [...enemies])
    if (!e.dead && e.spawnT <= 0 && Math.hypot(e.x - x, e.y - y) <= radius) hitEnemy(e, { x, y, dmg: damage, blast: true });
  if (!options.safePlayer && player && !player.dead && Math.hypot(player.x - x, player.y - y) <= radius)
    hitPlayer({ x, y, dmg: damage, blast: true, cause: options.cause });
  if (!options.safePlayer)
    for (const a of [...allies]) if (!a.dead && Math.hypot(a.x - x, a.y - y) <= radius) hitAlly(a, { x, y, dmg: damage, blast: true });
}

function hitEnemy(e, b) {
  if (e.dead || e.spawnT > 0) return;
  e.hp -= b.dmg;
  e.flash = 0.13;
  shake = Math.max(shake, 2);
  // откуда пришёл снаряд — наблюдаемый признак угрозы для тактики врагов (без координат стрелка)
  if (Number.isFinite(b.vx) && Number.isFinite(b.vy)) e.lastHit = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
  // Дробный урон пулемёта (maxHp/hits) не должен требовать лишней пули из-за погрешности сложения.
  if (e.hp < 1e-6) e.hp = 0;
  burst(b.x, b.y, 18, ['#fff4bd', '#ffb650', '#d7e6ed'], 260, 0.35, 4, 'spark');
  if (e.hp > 0) {
    burst(b.x, b.y, 10, ['#fff', '#ffd76a'], 180, 0.3, 4);
    sfx('hit');
    return;
  }
  e.dead = true;
  if (scenario.onEnemyKilled) scenario.onEnemyKilled(e);
  recordStatistic('enemies', e.kind);
  const K = KINDS[e.kind];
  score += K.score;
  floatText(e.x, e.y - 10, '+' + K.score, '#ffe08a');

  // Серия взрывов при гибели задана видом техники (KINDS[kind].deathBlasts); малые взрывы срабатывают сразу.
  const D = K.deathBlasts,
    wreck = {
      x: e.x,
      y: e.y,
      kind: e.kind,
      angle: e.angle,
      turret: e.turret,
      tread: e.tread,
      recoil: e.recoil,
      flash: 0,
      age: 0,
      smokeT: 0,
      exploded: false,
    };
  if (D && D.small)
    wrecks.push({ ...wreck, recoil: 0, detonateAt: 0, blastTotal: D.count, blastGap: D.gap, blastScale: D.scale, blastSmall: true });
  else wrecks.push({ ...wreck, detonateAt: rnd(0.5, 1.5) * (b.blast ? 0.5 : 1), burnOnly: tankBurnsOnly(), blastTotal: D ? D.count : 0 });
}

// Подбитый танк взрывается лишь с шансом CFG.tankBlastChance; иначе он загорается и никому не наносит урона.
const TANK_BURN_TIME = 6;
function tankBurnsOnly() {
  return Math.random() >= CFG.tankBlastChance;
}
function igniteWreck(w) {
  w.exploded = true;
  w.blastAge = w.age;
  w.burnTime = TANK_BURN_TIME;
  burst(w.x, w.y, 16, ['#ffcf6a', '#ff8a3a', '#5a4a3a'], 120, 0.6, 4);
  sfx('hit');
}

// Число взрывов при гибели игрока задано ступенью (PLAYER_TIERS[n].deathBlasts); интервал между ними 0,5 с.
const DEATH_BLAST_GAP = 0.5;

function hitPlayer(b) {
  const p = player;
  if (!p || p.dead) return;
  if (p.pw.shield > 0 || CFG.godMode) {
    burst(b.x, b.y, 10, ['#9ff5aa', '#e0ffe4'], 160, 0.3, 3);
    sfx('deflect');
    return;
  }
  if (p.inv > 0 || p.upgradeT > 0) return;
  p.hp -= b.dmg;
  p.inv = CFG.invulnTime;
  p.flash = 0.15;
  shake = Math.max(shake, 10);
  sfx('hurt');
  if (p.hp <= 0) {
    rememberDefeatTier();
    if (!base?.dead) defeatCause = b.cause || null;
    recordStatistic('deaths');
    p.hp = 0;
    p.dead = true;
    p.armor = false;
    const delay = rnd(0.5, 1.5) * (b.blast ? 0.5 : 1),
      blasts = playerTier(p).deathBlasts;
    wrecks.push({
      x: p.x,
      y: p.y,
      kind: 'player',
      angle: p.angle,
      turret: p.turret,
      tread: p.tread,
      recoil: p.recoil,
      flash: 0,
      age: 0,
      smokeT: 0,
      taken: true,
      detonateAt: delay,
      exploded: false,
      blastTotal: blasts,
      upgrade: p.upgrade || 0,
    });
    // экран поражения ждёт последний фактический взрыв и ещё секунду
    deadT = delay + (blasts - 1) * DEATH_BLAST_GAP + 1;
  }
}

function hitBase(dmg) {
  if (!base || base.dead) return;
  base.hp = Math.max(0, base.hp - dmg);
  burst(base.x, base.y, 12, ['#ffd66b', '#e45638'], 100, 0.3, 3);
  if (!base.hp) {
    rememberDefeatTier();
    base.dead = true;
    deadT = Math.max(deadT, 2.5);
    base.collapseAge = 0;
    base.collapseCount = 0;
    updateBaseCollapse(0);
  }
}

function updateBaseCollapse(dt) {
  if (!base || !base.dead || base.collapseCount === undefined || base.collapseCount >= 3) return;
  base.collapseAge += dt;
  const offsets = [
    [-36, -22],
    [34, -9],
    [-3, 10],
  ];
  while (base.collapseCount < 3 && base.collapseAge >= base.collapseCount * 0.5) {
    const [dx, dy] = offsets[base.collapseCount++],
      x = base.x + dx,
      y = base.y + dy;
    explosion(x, y, true, '#d74432', 2);
    blastDamage(x, y, 60);
  }
}

function updateWrecks(dt) {
  for (const w of wrecks) {
    w.age += dt;
    w.smokeT -= dt;
    if (w.exploded === false && w.age >= w.detonateAt && w.burnOnly) igniteWreck(w);
    else if (w.exploded === false && w.age >= w.detonateAt) {
      if (w.blastTotal) {
        w.blastCount = w.blastCount || 0;
        const offsets = [
            [-9, -5],
            [9, -3],
            [0, 8],
            [-11, 5],
            [8, -8],
            [-4, -11],
            [11, 7],
          ],
          total = w.blastTotal || 3,
          gap = w.blastGap || DEATH_BLAST_GAP;
        while (w.blastCount < total && w.age >= w.detonateAt + w.blastCount * gap) {
          const [dx, dy] = offsets[w.blastCount++],
            s = w.blastScale || 1;
          if (w.blastSmall) {
            const x = w.x + dx * s,
              y = w.y + dy * s,
              radius = 45 * s;
            explosion(x, y, false, KINDS[w.kind].color, s, false);
            for (const e of enemies)
              if (!e.dead && KINDS[e.kind].light && Math.hypot(e.x - x, e.y - y) <= radius) hitEnemy(e, { x, y, dmg: 1, blast: true });
            for (const b of bombers)
              if ((b.state === 'hidden' || b.state === 'lit') && Math.hypot(b.x - x, b.y - y) <= radius) killBomber(b);
          } else {
            explosion(w.x + dx, w.y + dy, false, KINDS[w.kind].color);
            blastDamage(w.x + dx, w.y + dy, 30);
          }
        }
        if (w.blastCount === total) {
          w.exploded = true;
          w.blastAge = w.age;
        }
      } else {
        w.exploded = true;
        w.blastAge = w.age;
        explosion(w.x, w.y, false, KINDS[w.kind].color);
        blastDamage(w.x, w.y, 30 * KINDS[w.kind].scale);
      }
    }
    if (w.smokeT <= 0 && w.age < (w.burnTime ? w.blastAge + w.burnTime : 2)) {
      w.smokeT = 0.12 + w.age * 0.05;
      parts.push({
        x: w.x + rnd(-6, 6),
        y: w.y + rnd(-6, 6),
        vx: rnd(-8, 8),
        vy: rnd(-30, -15),
        life: 1.4,
        max: 1.4,
        size: rnd(5, 9),
        color: '#3d3d3d',
        kind: 'smoke',
      });
    }
    if (
      !w.taken &&
      w.kind !== 'player' &&
      w.exploded !== false &&
      w.age >= (w.blastAge || 0) + 2 &&
      player &&
      !player.dead &&
      Math.hypot(player.x - w.x, player.y - w.y) < 24
    ) {
      const n = KINDS[w.kind].scrap;
      scrap += n;
      w.taken = true;
      floatText(w.x, w.y - 12, `+${n}${UI_TEXT.metallolom}`, '#d9c27a');
      burst(w.x, w.y, 10, ['#8a8a8a', '#b5a27a', '#555'], 140, 0.5, 4, 'debris');
      sfx('scrap');
    }
  }
  wrecks = wrecks.filter(w => !w.taken || w.exploded === false || w.age < (w.blastAge || 0) + (w.burnTime || 2));
}
