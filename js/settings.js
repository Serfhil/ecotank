'use strict';
// Настройки: сохранение в браузере, выгрузка/загрузка файлом и панель разработчика.
// Источник значений по умолчанию — только config.js. В браузере хранятся выбор игрока (PREFS) и те значения
// баланса, которые изменены в панели относительно config.js. Поэтому правка числа в config.js доходит
// до всех игроков, кроме тех, кто сам поменял именно это число.
// Настраиваемые значения — ключи TANK_FIELDS у KINDS и все ключи CFG; остальное в сохранения не попадает.
// Подключение не читает сохранения и не трогает DOM: это делают loadSettings() и initDevPanel().

const SETTINGS_KEY = 'ecotank-settings-v3';
// Прежний формат хранил KINDS и CFG целиком и перекрывал config.js; из него переносится только выбор игрока.
const LEGACY_SETTINGS_KEY = 'ecotank-dev-v2';
const SETTINGS_FILE_FORMAT = 'ecotank-dev-settings';
const TANK_FIELD_KEYS = TANK_FIELDS.map(([key]) => key);

function tunableSnapshot() {
  const kinds = {};
  for (const kind in KINDS) {
    kinds[kind] = {};
    for (const key of TANK_FIELD_KEYS) if (key in KINDS[kind]) kinds[kind][key] = KINDS[kind][key];
  }
  return { KINDS: kinds, CFG: { ...CFG } };
}
// Значения config.js на момент загрузки страницы.
const DEV_DEFAULTS = JSON.stringify(tunableSnapshot());

// Оставляет только известные настраиваемые ключи верного типа; числа приводит к пределам полей панели.
function sanitizeSettings(s) {
  const out = { KINDS: {}, CFG: {} };
  if (!s || typeof s !== 'object') return out;
  const tankLimits = Object.fromEntries(TANK_FIELDS.map(([key, , min, max]) => [key, [min, max]]));
  const cfgLimits = Object.fromEntries(CFG_FIELDS.flatMap(([, list]) => list).map(([key, , min, max]) => [key, [min, max]]));
  const accept = (target, limits, key, value) => {
    if (!(key in target) || typeof value !== typeof target[key]) return undefined;
    if (typeof value !== 'number') return value;
    if (!Number.isFinite(value)) return undefined;
    return limits[key] && limits[key][0] !== 'bool' ? clamp(value, ...limits[key]) : value;
  };
  for (const kind in s.KINDS && typeof s.KINDS === 'object' ? s.KINDS : {}) {
    if (!KINDS[kind] || !s.KINDS[kind] || typeof s.KINDS[kind] !== 'object') continue;
    out.KINDS[kind] = {};
    for (const key of TANK_FIELD_KEYS) {
      const value = accept(KINDS[kind], tankLimits, key, s.KINDS[kind][key]);
      if (value !== undefined) out.KINDS[kind][key] = value;
    }
  }
  for (const key in s.CFG && typeof s.CFG === 'object' ? s.CFG : {}) {
    const value = accept(CFG, cfgLimits, key, s.CFG[key]);
    if (value !== undefined) out.CFG[key] = value;
  }
  return out;
}

// Применяет значения баланса поверх текущих. Неизвестные и испорченные значения отбрасываются.
function applyDev(s) {
  const clean = sanitizeSettings(s);
  for (const kind in clean.KINDS) Object.assign(KINDS[kind], clean.KINDS[kind]);
  Object.assign(CFG, clean.CFG);
}

function applyPrefs(p) {
  if (!p || typeof p !== 'object') return;
  if (MAP_SIZES.includes(p.mapSize)) PREFS.mapSize = p.mapSize;
  if (MAP_MODES.includes(p.mapMode)) PREFS.mapMode = p.mapMode;
  if (typeof p.mapPick === 'string') PREFS.mapPick = p.mapPick;
  if (Number.isFinite(p.campaignStart)) PREFS.campaignStart = Math.max(0, Math.floor(p.campaignStart));
}

// Только отличия от config.js.
function settingsOverrides() {
  const defaults = JSON.parse(DEV_DEFAULTS),
    now = tunableSnapshot(),
    out = { KINDS: {}, CFG: {} };
  for (const kind in now.KINDS)
    for (const key in now.KINDS[kind]) {
      if (now.KINDS[kind][key] !== defaults.KINDS[kind][key]) (out.KINDS[kind] || (out.KINDS[kind] = {}))[key] = now.KINDS[kind][key];
    }
  for (const key in now.CFG) if (now.CFG[key] !== defaults.CFG[key]) out.CFG[key] = now.CFG[key];
  return out;
}

function saveDev() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 3, prefs: { ...PREFS }, ...settingsOverrides() }));
  } catch (e) {}
}

function loadSettings() {
  const read = key => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  };
  const saved = read(SETTINGS_KEY);
  if (saved) {
    applyPrefs(saved.prefs);
    applyDev(saved);
    return;
  }
  const legacy = read(LEGACY_SETTINGS_KEY);
  if (!legacy) return;
  applyPrefs(legacy.CFG);
  saveDev();
  try {
    localStorage.removeItem(LEGACY_SETTINGS_KEY);
  } catch (e) {}
}

// После изменения параметров игрока его здоровье и размеры пересчитываются по текущей ступени.
function refreshPlayerStats() {
  if (player) setPlayerUpgrade(player, player.upgrade || 0, false);
}

function resetDevSettings() {
  applyDev(JSON.parse(DEV_DEFAULTS));
  saveDev();
  refreshPlayerStats();
}

// ---------- выгрузка и загрузка файлом (папка settings/ проекта) ----------
function devSettingsFile() {
  return { format: SETTINGS_FILE_FORMAT, version: 1, savedAt: new Date().toISOString(), ...tunableSnapshot() };
}

async function exportDevSettings() {
  const text = JSON.stringify(devSettingsFile(), null, 2) + '\n';
  const name = 'ecotank-settings-' + new Date().toISOString().slice(0, 10) + '.json';
  // Chrome/Edge: системный диалог запоминает выбранную папку (например, settings/ проекта).
  if (typeof showSaveFilePicker === 'function') {
    try {
      const handle = await showSaveFilePicker({
        id: 'ecotank-settings',
        suggestedName: name,
        types: [{ description: 'EcoTank JSON', accept: { 'application/json': ['.json'] } }],
      });
      const out = await handle.createWritable();
      await out.write(text);
      await out.close();
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Файл обязан содержать объекты KINDS и CFG и, если указан формат, быть файлом настроек EcoTank.
function importDevSettingsText(text) {
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (e) {}
  if (!data || typeof data !== 'object' || !data.KINDS || typeof data.KINDS !== 'object' || !data.CFG || typeof data.CFG !== 'object')
    return false;
  if (data.format !== undefined && data.format !== SETTINGS_FILE_FORMAT) return false;
  applyDev(data);
  saveDev();
  refreshPlayerStats();
  return true;
}

// ---------- панель разработчика ----------
let devOpen = false,
  pauseMenu = null,
  devEl = null,
  devBody = null;

function numInput(obj, key, min, max, step, value) {
  return `<input type="number" data-obj="${obj}" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">`;
}

function buildDev() {
  const kinds = Object.keys(KINDS);
  let h =
    '<h3>' +
    UI_TEXT.tanki +
    '</h3><table><tr><th></th>' +
    kinds.map(k => `<th style="color:${KINDS[k].color}">${KINDS[k].name}</th>`).join('') +
    '</tr>';
  for (const [key, label, min, max, step] of TANK_FIELDS) {
    h +=
      `<tr><td>${label}</td>` +
      kinds.map(k => (key in KINDS[k] ? `<td>${numInput(k, key, min, max, step, KINDS[k][key])}</td>` : '<td class="na">—</td>')).join('') +
      '</tr>';
  }
  h += '</table>';
  for (const [title, fields] of CFG_FIELDS) {
    h += `<h3>${title}</h3><div class="grid">`;
    for (const [key, label, min, max, step] of fields) {
      h +=
        `<label>${label}` +
        (min === 'bool'
          ? `<input type="checkbox" data-obj="CFG" data-key="${key}"${CFG[key] ? ' checked' : ''}>`
          : numInput('CFG', key, min, max, step, CFG[key])) +
        '</label>';
    }
    h += '</div>';
  }
  devBody.innerHTML = h;
}

// Инструменты тестирования из шапки панели.
function devAction(act) {
  const alive = player && !player.dead;
  if (act === 'heal' && alive) player.hp = player.maxHp;
  else if (act === 'rail' && alive) player.rail = Math.min(CFG.railMax, player.rail + 1);
  else if (act === 'powerups' && alive) {
    for (const k in player.pw) player.pw[k] = CFG.powerupTime;
    setPlayerUpgrade(player, MAX_TIER);
  } else if (act === 'kill') {
    for (const e of enemies) if (e.spawnT <= 0) hitEnemy(e, { x: e.x, y: e.y, dmg: 999 });
    enemies = enemies.filter(e => !e.dead);
  } else if (act === 'skip' && alive && scenario.skipWave) scenario.skipWave();
  else if (act === 'export') exportDevSettings();
  else if (act === 'import') document.getElementById('devImport').click();
  else if (act === 'reset') {
    resetDevSettings();
    buildDev();
  }
}

function initDevPanel() {
  pauseMenu = document.getElementById('pauseMenu');
  devEl = document.getElementById('dev');
  devBody = document.getElementById('devBody');
  devBody.addEventListener('input', e => {
    const el = e.target,
      k = el.dataset.obj,
      obj = k === 'CFG' ? CFG : KINDS[k];
    if (!obj) return;
    if (el.type === 'checkbox') obj[el.dataset.key] = el.checked;
    else {
      const v = parseFloat(el.value);
      if (isNaN(v)) return;
      obj[el.dataset.key] = clamp(v, +el.min, +el.max);
    }
    if (k === 'player' && el.dataset.key === 'hp') refreshPlayerStats();
    saveDev();
  });
  devEl.querySelector('.devActions').addEventListener('click', e => {
    if (e.target.dataset.act) devAction(e.target.dataset.act);
  });
  document.getElementById('devImport').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(text => {
      const ok = importDevSettingsText(text);
      if (ok) buildDev();
      document.getElementById('devMsg').textContent = ok ? UI_TEXT.nastroyki_zagruzheny : UI_TEXT.nastroyki_ne_zagruzheny;
    });
  });
  document.getElementById('btnDev').addEventListener('click', e => {
    e.currentTarget.blur();
    devOpen = true;
    document.getElementById('devMsg').textContent = '';
    buildDev();
  });
  document.getElementById('btnDevClose').addEventListener('click', e => {
    e.currentTarget.blur();
    devOpen = false;
  });
}
