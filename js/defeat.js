'use strict';
// Defeat lifecycle and input gate. Rendering lives in render-ui.js.
// Like the other classic scripts, loading this file has no DOM or image side effects.
let defeatTier = null, defeatScreen = null, defeatCanvas = null, defeatRestart = null;
let defeatImages = [], defeatButtonArmed = false;
let defeatFrame = null, defeatCause = null, defeatTip = '', defeatTipEl = null;

function initDefeat() {
  if (defeatScreen) return;
  defeatScreen = document.getElementById('defeatScreen');
  defeatCanvas = document.getElementById('defeatCanvas');
  defeatRestart = document.getElementById('defeatRestart');
  defeatTipEl = document.getElementById('defeatTip');
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
  defeatCause = null; defeatTip = '';
  if (defeatTipEl) defeatTipEl.hidden = true;
  defeatFrame = null;
  defeatButtonArmed = false;
  if (defeatScreen) defeatScreen.hidden = true;
  if (defeatRestart) defeatRestart.hidden = true;
}

function defeatReady() {
  return state === 'over' && !victory && overT >= DEFEAT_FADE_DURATION + DEFEAT_RESTART_DELAY;
}

function defeatBlastsFinished() {
  return !(base && base.dead && base.collapseCount < 3) && !wrecks.some(w => w.exploded === false);
}

function enterDefeat() {
  rememberDefeatTier();
  const tips=DEFEAT_TIPS[defeatCause];
  defeatTip=tips ? tips[ri(0,tips.length-1)] : '';
  if (defeatTipEl) defeatTipEl.textContent=defeatTip;
  state = 'over'; overT = 0; banner.t = 0; devOpen = false;
  defeatFrame = null;
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
  startGame(!!campaign || !!raseiniai);
  return true;
}

function syncDefeatUI() {
  const visible = state === 'over' && !victory;
  if (defeatScreen) defeatScreen.hidden = !visible;
  // Prevent Tab/Enter from reaching controls hidden behind the full-screen overlay.
  document.getElementById('musicControls').inert = visible;
  document.getElementById('menuHome').inert = visible;
  if (defeatRestart) defeatRestart.hidden = !defeatReady();
  if (defeatTipEl) defeatTipEl.hidden = !visible || !defeatTip || overT<DEFEAT_FADE_DURATION;
}

// Called only for defeat: victory keeps its existing timer/effects behaviour.
function updateDefeat(dt) { overT += dt; }

function defeatDarkness() { return clamp(overT/DEFEAT_DARKEN_DURATION,0,1); }
function defeatOpacity() { return clamp((overT-DEFEAT_DARKEN_DURATION)/(DEFEAT_FADE_DURATION-DEFEAT_DARKEN_DURATION),0,1); }

// Snapshot the final battlefield and the separate HUD after their last render.
// The stored image is independent of later resize/layout changes.
function captureDefeatFrame() {
  const ratio = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1;
  defeatFrame = document.createElement('canvas');
  defeatFrame.width = Math.max(1, Math.round(innerWidth * ratio));
  defeatFrame.height = Math.max(1, Math.round(innerHeight * ratio));
  const c = defeatFrame.getContext('2d');
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.fillStyle = '#14181c'; c.fillRect(0, 0, innerWidth, innerHeight);
  const f = gameLayout.field;
  c.drawImage(cv, f.x, f.y, f.width, f.height);
  const h = gameLayout.hud;
  if (h && hudCanvas && player) c.drawImage(hudCanvas, h.x, h.y, h.width, h.height);
}
