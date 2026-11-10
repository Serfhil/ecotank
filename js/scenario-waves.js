'use strict';
// Сценарий 'waves' — обычный бой: оборона базы от волн врагов. Он же ведёт кампанию: при
// PREFS.mapMode === 'campaign' каждая волна — следующий уровень (карта из maps.js), а победа в последнем
// завершает операцию. Режим расстановки поля (PREFS.mapMode) выбирается в меню.
// Состав волн — waves.js, генерация поля — world.js. Подключение только регистрирует сценарий.

const BASE_HP = 5,
  WAVE_SPAWN_DELAY = 1.2,
  WAVE_PAUSE = 2.8;

function startWaves(retry = false) {
  activateScenario('waves');
  if (!retry) resetStatistics();
  resetOperation();
  applyMapChoice();
  score = 0;
  scrap = 0;
  wave = campaign ? PREFS.campaignStart : 0;
  player = null;
  victory = false;
  base = { ...BASE_POS, hp: BASE_HP, maxHp: BASE_HP, dead: false };
  nextWave();
}

function winCampaign() {
  if (!campaign) return;
  enterVictory();
  PREFS.campaignStart = 0;
  saveDev();
  saveBestScore();
  sfx('wave');
}

function nextWave() {
  wave++;
  if (campaign) {
    if (wave > campaign.length) {
      wave = campaign.length;
      winCampaign();
      return;
    }
    // размер поля может смениться между уровнями: база и старт переезжают вместе с ним
    activeMap = campaign[wave - 1];
    if (activeMap.cols !== COLS) {
      configureMap(activeMap.cols);
      if (base) {
        base.x = BASE_POS.x;
        base.y = BASE_POS.y;
      }
    }
  }
  // каждая новая волна или уровень начинается с целой базой
  if (base) base.hp = base.maxHp;
  // ступени живых союзников переходят на следующий уровень (ниже allies пересоздаются)
  const keptAllies = allies.filter(a => !a.dead).map(a => a.upgrade || 0);
  genMap(wave);
  placeBombers();
  if (base) fortifyBase('level');
  // игрок переносит ступень, здоровье (с лечением между волнами), заряды и состояние ускорения
  const old = player,
    tier = old && !old.dead ? old.upgrade || 0 : 0,
    maxHp = playerMaxHp(tier);
  player = makeTank(PLAYER_START.x, PLAYER_START.y, 'player');
  setPlayerUpgrade(player, tier, false);
  player.hp = old ? Math.min(maxHp, old.hp + CFG.waveHeal) : maxHp;
  if (old)
    Object.assign(player, {
      rail: old.rail,
      boostLeft: old.boostLeft,
      boostCooldown: old.boostCooldown,
      shiftHeld: old.shiftHeld,
      railArmed: !!old.railArmed && old.rail > 0,
    });
  player.cd = 0.3;
  clearBattlefield();
  toSpawn = waveList(wave);
  spawnTimer = WAVE_SPAWN_DELAY;
  spawnAllies(keptAllies);
  banner = campaign
    ? {
        text: `${UI_TEXT.uroven}${wave}${UI_TEXT.iz}${campaign.length}`,
        sub: `${activeMap.name}${UI_TEXT.vragov}${toSpawn.length}`,
        t: 2.4,
      }
    : { text: `${UI_TEXT.volna}${wave}`, sub: `${UI_TEXT.vragov_2}${toSpawn.length}`, t: 2.2 };
  state = 'play';
  sfx('wave');
}

// Волна окончена, когда не осталось ни врагов, ни того, что ещё может взорваться.
function waveCleared() {
  return (
    !player.upgradeT &&
    !toSpawn.length &&
    !enemies.length &&
    !wrecks.some(w => w.exploded === false) &&
    !artilleryShells.length &&
    !rockets.length &&
    !hasPendingBarrage() &&
    !sappersBusy()
  );
}

defineScenario('waves', {
  start: startWaves,
  retryOnDefeat: () => !!campaign,
  updateBattle(dt) {
    updateRandomItems(dt);
    updateReinforcements(dt);
    updateBaseWalls(cellOccupied);
    if (state === 'play' && !player.dead && !(base && base.dead)) updateSpawns(dt);
    formColumns();
  },
  afterBattle(dt) {
    if (state === 'play' && waveCleared()) {
      const bonus = CFG.waveBonus * wave;
      score += bonus;
      const collected = collectRemainingScrap();
      if (campaign) unlockCampaign(Math.min(wave + 1, campaign.length));
      banner = {
        text: campaign ? (wave >= campaign.length ? UI_TEXT.posledniy_uroven_proyden : UI_TEXT.uroven_proyden) : UI_TEXT.volna_proydena,
        sub: `${UI_TEXT.bonus}${bonus}${UI_TEXT.metallolom_2}${collected}`,
        t: 2.5,
      };
      state = 'between';
      betweenT = WAVE_PAUSE;
      sfx('wave');
    } else if (state === 'between') {
      betweenT -= dt;
      if (betweenT <= 0) nextWave();
    }
  },
  skipWave() {
    nextWave();
    state = 'pause';
  },
});
