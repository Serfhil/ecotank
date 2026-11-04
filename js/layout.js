'use strict';
// Geometry in CSS pixels. No DOM access until fit/applyGameLayout is called.
let gameLayout = null, hudCanvas = null, gameHud = null, layoutKey = '';

function calculateGameLayout(width, height, mapWidth, mapHeight, withHud) {
  const pad = HUD_LAYOUT.padding, gap = HUD_LAYOUT.gap;
  const top = withHud ? HUD_LAYOUT.toolbarHeight : pad;
  const availableWidth = Math.max(1, width - pad * 2);
  const availableHeight = Math.max(1, height - top - pad);
  let fieldWidth = availableWidth, fieldHeight = availableHeight, hud = null;
  const compact = width < HUD_LAYOUT.breakpoint || height < 480;
  if (withHud && !compact) fieldWidth = Math.max(1, availableWidth - HUD_LAYOUT.width - gap);
  if (withHud && compact) {
    const panelHeight = Math.min(HUD_LAYOUT.compactHeight, height * .34);
    fieldHeight = Math.max(1, availableHeight - panelHeight - gap);
    hud = { x: pad, y: 0, width: availableWidth, height: panelHeight, compact: true };
  }
  const scale = Math.min(fieldWidth / mapWidth, fieldHeight / mapHeight);
  const field = { x: pad + (fieldWidth - mapWidth * scale) / 2, y: top + (availableHeight - mapHeight * scale) / 2,
    width: mapWidth * scale, height: mapHeight * scale };
  if (withHud && compact) {
    field.y = top + (availableHeight - field.height - gap - hud.height) / 2;
    hud.y = field.y + field.height + gap;
  } else if (withHud) {
    hud = { x: width - pad - HUD_LAYOUT.width, y: top, width: HUD_LAYOUT.width, height: availableHeight, compact: false };
  }
  return { field, hud };
}

function gameHasHud() {
  return state !== 'menu' && !editorOpen && !mapEdOpen;
}

function applyGameLayout() {
  if (!hudCanvas) {
    hudCanvas = document.getElementById('hudCanvas');
    gameHud = document.getElementById('gameHud');
  }
  const withHud = gameHasHud(), key = [innerWidth, innerHeight, W, H, withHud].join(':');
  if (gameHud) gameHud.hidden = !withHud || (state === 'over' && !victory);
  if (key === layoutKey) return;
  layoutKey = key;
  gameLayout = calculateGameLayout(innerWidth, innerHeight, W, H, withHud);
  const f = gameLayout.field;
  Object.assign(cv.style, { left: f.x + 'px', top: f.y + 'px', width: f.width + 'px', height: f.height + 'px' });
  if (gameLayout.hud && gameHud) {
    const h = gameLayout.hud;
    Object.assign(gameHud.style, { left: h.x + 'px', top: h.y + 'px', width: h.width + 'px', height: h.height + 'px' });
  }
}

function pointerToWorld(clientX, clientY, bounds) {
  return { x: (clientX - bounds.left) * W / bounds.width, y: (clientY - bounds.top) * H / bounds.height };
}
