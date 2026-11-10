'use strict';
// Главное меню, меню паузы и синхронизация DOM с состоянием игры.
// Обычный бой (сценарий 'waves') настраивается режимом расстановки PREFS.mapMode; остальные сценарии
// выбираются своей кнопкой (поле menuButton сценария). Подключение не трогает DOM: это делает initMenu().

const byId = id => document.getElementById(id);
// Кнопки режимов обычного боя: id кнопки — 'mode-' + режим.
const MENU_MAP_MODES = ['preset01', 'map', 'campaign'];

function selectMapMode(mode) {
  selectedScenario = DEFAULT_SCENARIO;
  PREFS.mapMode = MAP_MODES.includes(mode) ? mode : 'original';
  saveDev();
  if (state === 'menu') toMenu();
}

// список уровней кампании: закрытые уровни видны, но недоступны для старта
let campaignPickKey = '';
function renderCampaignPick() {
  const levels = campaignMaps(),
    open = campaignUnlocked(),
    key = levels.map(m => m.id).join() + ':' + open;
  if (key === campaignPickKey) return;
  campaignPickKey = key;
  byId('campaignPick').innerHTML = levels.length
    ? levels
        .map(
          (m, i) =>
            `<option value="${i}"${i >= open ? ' disabled' : ''}>${i >= open ? '🔒 ' : ''}${UI_TEXT.uroven}${i + 1} · ${escapeHtml(m.name)} · ${m.cols}×${m.rows.length}</option>`,
        )
        .join('')
    : '<option value="0">' + UI_TEXT.net_kart_kampanii + '</option>';
}

function initMenu() {
  byId('btnResume').addEventListener('click', e => {
    e.currentTarget.blur();
    state = 'play';
  });
  byId('btnNewGame').addEventListener('click', e => {
    e.currentTarget.blur();
    devOpen = false;
    saveBestScore();
    toMenu();
  });
  byId('campaignPick').addEventListener('change', e => {
    PREFS.campaignStart = +e.target.value || 0;
    saveDev();
    e.target.blur();
    if (state === 'menu') toMenu();
  });
  byId('mapPick').addEventListener('change', e => {
    PREFS.mapPick = e.target.value;
    saveDev();
    e.target.blur();
    if (state === 'menu') toMenu();
  });
  byId('mapSize').value = String(PREFS.mapSize);
  byId('mapSize').addEventListener('change', e => {
    PREFS.mapSize = MAP_SIZES.includes(Number(e.target.value)) ? Number(e.target.value) : MAP_SIZES[0];
    saveDev();
    e.target.blur();
    if (state === 'menu') toMenu();
  });
  // в выпадающем списке значение — режим расстановки обычного боя либо id сценария
  byId('mapMode').addEventListener('change', e => {
    e.target.blur();
    if (SCENARIOS[e.target.value] && e.target.value !== DEFAULT_SCENARIO) selectedScenario = e.target.value;
    else selectMapMode(e.target.value);
  });
  byId('menuStart').addEventListener('click', () => startGame());
  byId('menuSettings').addEventListener('click', () => {
    devOpen = true;
    buildDev();
  });
  byId('menuHome').addEventListener('click', () => {
    devOpen = false;
    toMenu();
    syncMusic();
  });
  for (const mode of MENU_MAP_MODES) byId('mode-' + mode).addEventListener('click', () => selectMapMode(mode));
  for (const s of Object.values(SCENARIOS)) {
    if (s.menuButton)
      byId(s.menuButton).addEventListener('click', e => {
        e.currentTarget.blur();
        selectedScenario = s.id;
      });
  }
}

function syncUI() {
  fit();
  syncDefeatUI();
  syncVictoryUI();
  for (const s of Object.values(SCENARIOS)) if (s.syncUI) s.syncUI();
  const mapPick = byId('mapPick'),
    campaignPick = byId('campaignPick');
  const waves = selectedScenario === DEFAULT_SCENARIO,
    fixed = waves && PREFS.mapMode === 'map',
    camp = waves && PREFS.mapMode === 'campaign';
  byId('mapSize').value = String(PREFS.mapSize);
  byId('mapSize').hidden = !waves || fixed || camp;
  byId('mapMode').value = waves ? PREFS.mapMode : selectedScenario;
  if (mapPick.hidden === fixed) mapPick.hidden = !fixed;
  if (fixed && mapPick.value !== PREFS.mapPick) mapPick.value = PREFS.mapPick;
  if (campaignPick.hidden === camp) campaignPick.hidden = !camp;
  if (camp) {
    renderCampaignPick();
    if (campaignPick.value !== String(PREFS.campaignStart)) campaignPick.value = String(PREFS.campaignStart);
  }
  byId('mapControl').hidden = editorOpen || mapEdOpen || state !== 'menu';
  byId('mainMenu').hidden = state !== 'menu' || editorOpen || mapEdOpen;
  byId('menuHome').hidden = state === 'menu' || editorOpen || mapEdOpen;
  for (const mode of MENU_MAP_MODES) byId('mode-' + mode).classList.toggle('selected', waves && PREFS.mapMode === mode);
  for (const s of Object.values(SCENARIOS)) {
    if (!s.menuButton) continue;
    const button = byId(s.menuButton);
    button.classList.toggle('selected', selectedScenario === s.id);
    if (button.setAttribute) button.setAttribute('aria-pressed', String(selectedScenario === s.id));
  }
  if (editorEl.hidden === editorOpen) editorEl.hidden = !editorOpen;
  if (mapEditorEl.hidden === mapEdOpen) mapEditorEl.hidden = !mapEdOpen;
  syncMusic();
  const pm = state === 'pause' && !devOpen,
    dv = (state === 'pause' || state === 'menu') && devOpen;
  if (pauseMenu.hidden === pm) pauseMenu.hidden = !pm;
  if (devEl.hidden === dv) devEl.hidden = !dv;
}
