'use strict';
// Victory lifecycle; classic script, explicit initialization only.
let victoryScreen = null, victoryCanvas = null, victoryImage = null, victoryImageLoaded = false;
let victoryFrame = null, victoryStats = null, victoryTime = 0, victoryAwardTime = null;
let victoryArmed = null, victoryReleased = false;
function initVictory() {
  if (victoryScreen) return;
  victoryScreen = document.getElementById('victoryScreen');
  victoryCanvas = document.getElementById('victoryCanvas');
  if (typeof Image === 'function') {
    victoryImage = new Image();
    victoryImage.onload = () => { victoryImageLoaded = victoryImage.naturalWidth > 0; };
    victoryImage.onerror = () => { victoryImageLoaded = false; };
    victoryImage.src = VICTORY_CONFIG.image;
  }
  for (const [id, action] of [['victorySkip','award'],['victoryNew','new'],['victoryHome','home']]) {
    const button = document.getElementById(id);
    button.addEventListener('mousedown', e => {
      victoryArmed = e.button === 0 && !mouse.down && victoryCanAct(action) ? action : null;
      mouse.down = true;
    });
    button.addEventListener('keydown', e => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault(); e.stopPropagation();
      if (!e.repeat && !keys[e.code] && victoryCanAct(action)) victoryArmed = action;
      keys[e.code] = true;
    });
    button.addEventListener('keyup', e => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault(); e.stopPropagation(); keys[e.code] = false;
      const fresh = victoryArmed === action; victoryArmed = null;
      if (fresh) requestVictoryAction(action);
    });
    button.addEventListener('click', e => {
      const fresh = e.detail === 0 ? victoryReleased && !keys.Enter && !keys.Space && !mouse.down : victoryArmed === action;
      victoryArmed = null;
      if (fresh) requestVictoryAction(action);
    });
  }
}
function resetVictory() {
  victoryFrame = null; victoryStats = null; victoryTime = 0; victoryAwardTime = null;
  victoryArmed = null; victoryReleased = false;
  if (victoryScreen) victoryScreen.hidden = true;
}
function enterVictory() {
  victory = true; state = 'over'; overT = 0; banner.t = 0; devOpen = false;
  victoryStats = snapshotStatistics(); victoryFrame = null; victoryTime = 0;
  victoryAwardTime = null; victoryArmed = null; victoryReleased = false;
  buildVictoryCredits();
  if (victoryScreen && typeof victoryScreen.focus === 'function') victoryScreen.focus();
}
function victoryRevealEnd() { return VICTORY_CONFIG.darken + VICTORY_CONFIG.reveal; }
function victoryCanAct(action) {
  if (state !== 'over' || !victory || victoryTime < victoryRevealEnd()) return false;
  return action === 'award' ? victoryAwardTime === null :
    (action === 'new' || action === 'home') && victoryAwardTime !== null && victoryTime - victoryAwardTime >= VICTORY_CONFIG.awardFade;
}
function requestVictoryAction(action) {
  if (!victoryCanAct(action)) return false;
  if (action === 'award') { victoryAwardTime = victoryTime; victoryArmed = null; return true; }
  for (const key in keys) keys[key] = false;
  mouse.down = false;
  if (action === 'new') { CFG.campaignStart = 0; saveDev(); startGame(); }
  else { toMenu(); syncMusic(); }
  return true;
}
function victoryCreditRows() {
  return 1 + STAT_ENEMY_TYPES.length + 5;
}
function victoryCreditsGeometry() {
  const height = Math.max(80, Math.min(innerHeight * .58, 480));
  return { height, rowHeight: innerWidth < 600 ? 94 : 100 };
}
function updateVictory(dt) {
  victoryTime += dt; overT = victoryTime;
  if (!keys.Enter && !keys.Space && !mouse.down) victoryReleased = true;
  const g = victoryCreditsGeometry();
  if (victoryAwardTime === null && victoryTime >= victoryRevealEnd() + (g.height + victoryCreditRows() * g.rowHeight) / VICTORY_CONFIG.creditsSpeed) victoryAwardTime = victoryTime;
}
function syncVictoryUI() {
  const visible = state === 'over' && victory;
  if (victoryScreen) victoryScreen.hidden = !visible;
  // Defeat synchronizes these first; victory only adds its own blocking.
  if (visible) for (const id of ['musicControls','menuHome']) document.getElementById(id).inert = true;
  document.getElementById('victoryContent').hidden = !visible || victoryTime < VICTORY_CONFIG.darken;
  document.getElementById('victoryContent').style.opacity = clamp((victoryTime-VICTORY_CONFIG.darken)/VICTORY_CONFIG.reveal,0,1);
  document.getElementById('victoryCreditsWindow').hidden = victoryAwardTime !== null || victoryTime < victoryRevealEnd();
  document.getElementById('victoryAward').hidden = victoryAwardTime === null;
  document.getElementById('victorySkip').hidden = !victoryCanAct('award');
  document.getElementById('victoryNew').hidden = !victoryCanAct('new');
  document.getElementById('victoryHome').hidden = !victoryCanAct('home');
  if (visible) renderVictoryContent();
}
function captureVictoryFrame() {
  victoryFrame = document.createElement('canvas');
  victoryFrame.width = Math.max(1, innerWidth); victoryFrame.height = Math.max(1, innerHeight);
  const c = victoryFrame.getContext('2d'), f = gameLayout.field;
  c.fillStyle = '#14181c'; c.fillRect(0,0,innerWidth,innerHeight);
  c.drawImage(cv, f.x, f.y, f.width, f.height);
}
