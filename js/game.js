'use strict';
// Ядро игры: общее состояние боя, ввод, игровой цикл, запуск и выход в меню.
// Этот файл владеет состоянием боя (state, player, enemies, allies, bullets, …): остальные модули читают его
// и меняют только через функции модуля-владельца (см. AGENTS.md, «Владение состоянием»).
// Ядро не знает сценариев по имени: всё, что зависит от режима игры, делает активный сценарий (scenarios.js).
// Подключение файла только определяет состояние и функции; игру запускает bootGame() из index.html.

// ---------- состояние боя ----------
let cv = null,
  ctx = null;
// state: 'menu' | 'play' | 'pause' | 'between' (пауза между волнами) | 'story' (сцена сценария) | 'over'.
let state = 'menu',
  player = null,
  enemies = [],
  allies = [],
  bullets = [],
  parts = [],
  items = [],
  wrecks = [],
  rails = [];
let base = null;
let artilleryShells = [],
  itemSpawnTimer = 10,
  barrageMarkers = [],
  barrageTrajectories = [],
  barrageSoundShots = 0,
  barrageFrame = 0;
let score = 0,
  scrap = 0,
  hitstop = 0,
  wave = 0,
  toSpawn = [],
  spawnTimer = 0,
  betweenT = 0,
  deadT = 0,
  overT = 0;
// time идёт всегда (анимации интерфейса); время симуляции — simTime из world.js.
let shake = 0,
  time = 0,
  banner = { text: '', sub: '', t: 0 };
let best = 0;
const BEST_KEY = 'ecotank-best';

function saveBestScore() {
  if (score <= best) return;
  best = score;
  try {
    localStorage.setItem(BEST_KEY, best);
  } catch (e) {}
}

// ---------- сброс ----------
// Всё, что живёт в пределах одной волны. Новый массив боевых объектов обязан сбрасываться здесь.
function clearBattlefield() {
  enemies = [];
  bullets = [];
  items = [];
  parts = [];
  wrecks = [];
  rails = [];
  resetArtillery();
  itemSpawnTimer = ITEM_SPAWN_PERIOD;
}
// Всё, что живёт в пределах операции: вызывается при старте сценария и при выходе в меню.
function resetOperation() {
  clearBattlefield();
  allies = [];
  toSpawn = [];
  resetReinforcements();
  resetSappers();
  banner.t = 0;
  hudOpacity = { left: 1, right: 1, score: 1 };
  resetVictory();
  resetDefeat();
}

// ---------- запуск и меню ----------
// Из меню стартует выбранный сценарий; перезапуск посреди игры повторяет текущий.
function startGame(retry = false) {
  const id = state === 'menu' || !scenario.id ? selectedScenario : scenario.id;
  (SCENARIOS[id] || SCENARIOS[DEFAULT_SCENARIO]).start(retry);
  syncMusic();
}

// Стартовый экран: фон-превью собирается из выбранных размера и режима карты.
function toMenu() {
  leaveScenario();
  resetOperation();
  state = 'menu';
  player = null;
  base = null;
  applyMapChoice();
  genMap(1);
}

// Сколько врагов осталось: для HUD.
function enemiesLeft() {
  return scenario.enemiesLeft ? scenario.enemiesLeft() : toSpawn.length + enemies.filter(e => !e.dead).length;
}

// ---------- ввод ----------
const keys = {};
const mouse = { x: W / 2, y: H / 2, down: false, right: false };

function onKeyDown(e) {
  if (e.code === 'Escape' && devOpen) {
    devOpen = false;
    document.activeElement.blur();
    return;
  }
  // в редакторе игра не слушает клавиатуру; Esc закрывает его только из списка, чтобы не потерять правки
  if (editorOpen) {
    if (e.code === 'Escape' && !edit) closeEditor();
    return;
  }
  if (mapEdOpen) {
    if (e.code === 'Escape' && !mapEd) closeMapEditor();
    else if (mapEd && mapStamp && (e.code === 'KeyR' || e.code === 'KeyF') && !['INPUT', 'SELECT'].includes(e.target.tagName)) {
      turnStamp(e.code === 'KeyR' ? 'turn' : 'flip');
      renderMapEditor();
    }
    return;
  }
  if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
  if (state === 'menu' && devOpen) return;
  const held = !!keys[e.code];
  if (scenario.keydown && scenario.keydown(e, held)) return;
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && player && !player.dead && state === 'play')
    player.boostQueued = true;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Enter' && state === 'over' && !victory) requestDefeatRestart(e.repeat || held);
  else if (e.code === 'Enter' && state === 'menu' && !e.repeat && !held) {
    if (e.target.tagName !== 'BUTTON' || e.target.id === 'menuStart') {
      e.preventDefault();
      startGame();
    }
  } else if ((e.code === 'KeyP' || e.code === 'Escape') && (state === 'play' || state === 'pause')) {
    state = state === 'play' ? 'pause' : 'play';
    devOpen = false;
  } else if (e.code === 'KeyM') {
    muted = !muted;
    syncMusic();
  } else if (e.code === 'KeyC' && (state === 'play' || state === 'between')) armRail(player);
}

function initInput() {
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', e => {
    keys[e.code] = false;
    if (scenario.keyup) scenario.keyup(e);
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouse.down = false;
    mouse.right = false;
    if (scenario.blur) scenario.blur();
    if (state === 'play') state = 'pause';
  });
  cv.addEventListener('mousemove', e => {
    const b = cv.getBoundingClientRect();
    Object.assign(mouse, pointerToWorld(e.clientX, e.clientY, b));
  });
  cv.addEventListener('mousedown', e => {
    if (e.button === 2) {
      mouse.right = state === 'play' || state === 'between';
      return;
    }
    if (e.button !== 0) return;
    const held = mouse.down;
    mouse.down = true;
    if (state === 'over' && !victory) {
      requestDefeatRestart(held);
      return;
    }
    // щелчок по полю в меню сразу начинает обычный бой; сюжетный сценарий стартует только кнопкой
    if (state === 'menu' && selectedScenario === DEFAULT_SCENARIO) startGame();
    else if (state === 'pause' && !devOpen) state = 'play';
  });
  addEventListener('mouseup', e => {
    if (e && e.button === 2) mouse.right = false;
    else mouse.down = false;
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('resize', fit);
}

function fit() {
  applyGameLayout();
}

// ---------- кадр ----------
// Логика знает время только через dt: никаких таймеров браузера и часов внутри update().
function update(dt) {
  time += dt;
  updateHud(dt);
  if (state === 'menu' || state === 'pause') return;
  if (state === 'over') {
    if (victory) updateVictory(dt);
    else updateDefeat(dt);
    return;
  }
  if (state === 'story') {
    updateParts(dt);
    shake = Math.max(0, shake - dt * 30);
    scenario.updateStory(dt);
    return;
  }
  updateBaseCollapse(dt);
  if (hitstop > 0) {
    hitstop -= dt;
    return;
  }
  simTime += dt;
  updateParts(dt);
  shake = Math.max(0, shake - dt * 30);
  banner.t -= dt;

  player.flash -= dt;
  updatePlayer(dt);
  updateTreadSound(dt);
  updateArtilleryShells(dt);
  updateRockets(dt);
  updateSappers(dt);
  if (scenario.updateBattle) scenario.updateBattle(dt);
  // координация групп обычных танков: состав, контакты, роли, проверки опасных точек
  updateEnemyTactics(dt);
  for (const e of enemies) updateEnemy(e, dt);
  enemies = enemies.filter(e => !e.dead);
  for (const a of allies) updateAlly(a, dt);
  separate();
  updateBullets(dt);
  enemies = enemies.filter(e => !e.dead);
  allies = allies.filter(a => !a.dead);
  updateItems(dt);
  updateWrecks(dt);

  if (player.dead || (base && base.dead)) {
    deadT -= dt;
    if (deadT <= 0 && defeatBlastsFinished()) enterDefeat();
  } else if (scenario.afterBattle) scenario.afterBattle(dt);
}

// ---------- запуск страницы ----------
function bootGame() {
  applyInterfaceTexts();
  cv = document.getElementById('c');
  ctx = cv.getContext('2d');
  initAudio();
  try {
    best = +localStorage.getItem(BEST_KEY) || 0;
  } catch (e) {}
  initInput();
  fit();
  loadSettings();
  initDevPanel();
  initPresetEditor();
  initMapEditor();
  initMenu();
  for (const s of Object.values(SCENARIOS)) if (s.init) s.init();
  initDefeat();
  initVehicleSprites();
  initSapperSprites();
  initVictory();
  initHud();
  renderMapPick();
  toMenu();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    syncUI();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
