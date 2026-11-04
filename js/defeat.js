'use strict';
// Defeat lifecycle and input gate. Rendering lives in render-ui.js.
// Like the other classic scripts, loading this file has no DOM or image side effects.
let defeatTier = null, defeatScreen = null, defeatCanvas = null, defeatRestart = null;
let defeatImages = [], defeatButtonArmed = false;

function initDefeat() {
  if (defeatScreen) return;
  defeatScreen = document.getElementById('defeatScreen');
  defeatCanvas = document.getElementById('defeatCanvas');
  defeatRestart = document.getElementById('defeatRestart');
  if (typeof Image === 'function') {
    defeatImages = DEFEAT_IMAGES.map(src => {
      const entry = { image: new Image(), loaded: false };
      entry.image.onload = () => { entry.loaded = entry.image.naturalWidth > 0; };
      entry.image.onerror = () => { entry.loaded = false; };
      entry.image.src = src;
      return entry;
    });
  }
  defeatScreen.addEventListener('mousedown', e => {
    if (e.button !== 0 || state !== 'over' || victory) return;
    const held = mouse.down;
    mouse.down = true;
    if (e.target === defeatRestart) defeatButtonArmed = defeatReady() && !held;
    else requestDefeatRestart(held);
  });
  defeatRestart.addEventListener('click', e => {
    // Native keyboard clicks are accepted on release; held Enter is handled by input.
    const allowed = e.detail === 0 ? !keys.Enter && !keys.Space : defeatButtonArmed;
    defeatButtonArmed = false;
    if (allowed) requestDefeatRestart(false);
  });
}

function rememberDefeatTier() {
  if (defeatTier === null) defeatTier = Math.max(0, Math.min(2, player ? player.upgrade || 0 : 0));
}

function resetDefeat() {
  defeatTier = null;
  defeatButtonArmed = false;
  if (defeatScreen) defeatScreen.hidden = true;
  if (defeatRestart) defeatRestart.hidden = true;
}

function defeatReady() {
  return state === 'over' && !victory && overT >= DEFEAT_RESTART_DELAY;
}

function defeatBlastsFinished() {
  return !(base && base.dead && base.collapseCount < 3) && !wrecks.some(w => w.exploded === false);
}

function enterDefeat() {
  rememberDefeatTier();
  state = 'over'; overT = 0; banner.t = 0; devOpen = false;
  defeatButtonArmed = false;
  if (defeatScreen && typeof defeatScreen.focus === 'function') defeatScreen.focus();
  if (score > best) {
    best = score;
    try { localStorage.setItem('ecotank-best', best); } catch (e) {}
  }
  if (campaign) { CFG.campaignStart = wave - 1; saveDev(); }
}

function requestDefeatRestart(repeated) {
  if (repeated || !defeatReady()) return false;
  for (const key in keys) keys[key] = false;
  mouse.down = false;
  startGame();
  return true;
}

function syncDefeatUI() {
  const visible = state === 'over' && !victory;
  if (defeatScreen) defeatScreen.hidden = !visible;
  // Prevent Tab/Enter from reaching controls hidden behind the full-screen overlay.
  document.getElementById('musicControls').inert = visible;
  document.getElementById('menuHome').inert = visible;
  if (defeatRestart) defeatRestart.hidden = !defeatReady();
}
