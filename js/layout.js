'use strict';
// Geometry in CSS pixels. No DOM access until fit/applyGameLayout is called.
let gameLayout = null, hudCanvas = null, gameHud = null, layoutKey = '';

function calculateGameLayout(width, height, mapWidth, mapHeight, withHud) {
  const pad = HUD_LAYOUT.padding, gap = HUD_LAYOUT.gap;
  const top = withHud ? HUD_LAYOUT.toolbarHeight : pad;
  const availableWidth = Math.max(1, width - pad * 2);
  const availableHeight = Math.max(1, height - top - pad);
  const scale = Math.min(availableWidth / mapWidth, availableHeight / mapHeight);
  const field = { x: pad + (availableWidth - mapWidth * scale) / 2, y: top + (availableHeight - mapHeight * scale) / 2,
    width: mapWidth * scale, height: mapHeight * scale };
  const hud = withHud ? { x:0, y:0, width, height, panels:calculateHudPanels(width,height) } : null;
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
  if (gameHud) gameHud.hidden = !withHud || (state === 'over');
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


let hudOpacity = {left:1,right:1,score:1};
let niiIcon = null;
function initHud() {
  if (typeof Image === 'function') { niiIcon = new Image(); niiIcon.onload = () => {}; niiIcon.onerror = () => {}; niiIcon.src = 'assets/nii-shell.svg'; }
}
function calculateHudPanels(width,height) {
  const pad=12,rightWidth=Math.min(210,(width-pad*3)*.60),leftWidth=Math.min(180,width-pad*3-rightWidth);
  return {left:{x:pad,y:height-100,w:leftWidth,h:88},right:{x:width-pad-rightWidth,y:height-166,w:rightWidth,h:154},
    score:{x:width-pad-Math.min(164,width-pad*2),y:width<600?88:58,w:Math.min(164,width-pad*2),h:44}};
}
// Bounds of hull and independently aimed turret, projected into viewport CSS pixels.
function tankHudBounds(t) {
  const s=tankScale(t),points=[],friendly=t.kind==='player'||t.ally;
  const add=(x,y,angle,ox=t.x,oy=t.y)=>points.push({x:ox+(x*Math.cos(angle)-y*Math.sin(angle))*s,y:oy+(x*Math.sin(angle)+y*Math.cos(angle))*s});
  for(const x of [-20,20])for(const y of [-19,19])add(x,y,t.angle+Math.PI/2);
  const ox=t.x+(friendly?Math.cos(t.angle)*5*s:0),oy=t.y+(friendly?Math.sin(t.angle)*5*s:0);
  for(const x of [-8,8])for(const y of [-(friendly?playerGunLength(t):38),14])add(x,y,t.turret+Math.PI/2,ox,oy);
  const f=gameLayout.field,xs=points.map(p=>f.x+p.x/W*f.width),ys=points.map(p=>f.y+p.y/H*f.height);
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
function updateHud(dt) {
  if (!gameLayout || !gameLayout.hud || state!=='play'&&state!=='between') return;
  const bounds=[player,...enemies,...allies].filter(t=>t&&!t.dead&&t.spawnT<=0).map(tankHudBounds);
  for(const [key,p]of Object.entries(gameLayout.hud.panels)) {
    const covered=bounds.some(b=>b.x<p.x+p.w&&b.x+b.w>p.x&&b.y<p.y+p.h&&b.y+b.h>p.y),target=covered?.2:1;
    hudOpacity[key]+=Math.sign(target-hudOpacity[key])*Math.min(Math.abs(target-hudOpacity[key]),.8*dt);
  }
}
