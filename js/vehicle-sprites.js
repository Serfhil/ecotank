'use strict';
// Спрайты техники: слои PNG (корпус, траки, орудие, башня) и атласы кадров.
// Что и откуда грузить, задаёт config.js: KINDS[kind].sprite / .sheet и PLAYER_TIERS[n].sprite.
// Точки крепления и дульные срезы согласуют повороты, отдачу и появление снарядов с картинкой.
// При незагруженном слое рисуется процедурная модель (render-tanks.js). Подключение ничего не грузит.

const VEHICLE_DIR = 'assets/vehicles/';
let vehicleLayers = null,
  vehicleSheets = null;

function loadVehicleImage(src) {
  const entry = { image: new Image(), loaded: false };
  entry.image.onload = () => {
    entry.loaded = entry.image.naturalWidth > 0;
  };
  entry.image.onerror = () => {
    entry.loaded = false;
  };
  entry.image.src = src;
  return entry;
}

function initVehicleSprites() {
  if (vehicleLayers || typeof Image !== 'function') return;
  vehicleLayers = {};
  vehicleSheets = {};
  const layered = (key, name, turretless) => {
    vehicleLayers[key] = {};
    for (const part of ['hull', 'tracks', 'gun', ...(turretless ? [] : ['turret'])])
      vehicleLayers[key][part] = loadVehicleImage(VEHICLE_DIR + name + '-' + part + '.png');
  };
  PLAYER_TIERS.forEach((tier, n) => layered('player' + n, tier.sprite));
  for (const [kind, K] of Object.entries(KINDS)) {
    if (K.sprite) layered(kind, K.sprite, K.turretless);
    if (K.sheet) vehicleSheets[kind] = loadVehicleImage(K.sheet.src);
  }
}

// Кадр атласа выбирается по направлению башни (пусковой) относительно корпуса. false — атласа нет.
function drawVehicleSheet(t, c) {
  const sheet = KINDS[t.kind] && KINDS[t.kind].sheet,
    entry = vehicleSheets && vehicleSheets[t.kind];
  if (!sheet || !entry || !entry.loaded) return false;
  const rel = angDiff(t.angle, t.turret ?? t.angle),
    frame = ((Math.round(rel / (Math.PI / 2)) % sheet.frames) + sheet.frames) % sheet.frames,
    s = tankScale(t);
  c.save();
  if (t.flash > 0) c.filter = 'brightness(0) invert(1)';
  c.translate(t.x, t.y);
  c.rotate(t.angle + Math.PI / 2);
  c.scale(s, s);
  c.drawImage(entry.image, frame * sheet.fw, 0, sheet.fw, sheet.fh, -sheet.w / 2, -sheet.h / 2, sheet.w, sheet.h);
  c.restore();
  return true;
}

// Игрок и союзник рисуются спрайтом своей ступени; остальные — спрайтом вида.
const friendlyKind = t => t.kind === 'player' || t.kind === 'ally';
function vehicleKey(t) {
  return friendlyKind(t) ? 'player' + clamp(t.upgrade || 0, 0, MAX_TIER) : t.kind;
}

function vehicleMount(t) {
  const tiered = usesTier(t),
    tier = playerTier(t),
    s = tankScale(t),
    forward = tiered ? 5 : 0;
  return {
    scale: s,
    length: tiered ? tier.gun : KINDS[t.kind].gunLength || 30,
    x: t.x + Math.cos(t.angle) * forward * s,
    y: t.y + Math.sin(t.angle) * forward * s,
    offsets: tiered && tier.barrels === 2 ? [-4 * s, 4 * s] : [0],
  };
}

function vehicleMuzzle(t, offset = 0) {
  const m = vehicleMount(t);
  return {
    x: m.x + Math.cos(t.turret) * m.length * m.scale - Math.sin(t.turret) * offset,
    y: m.y + Math.sin(t.turret) * m.length * m.scale + Math.cos(t.turret) * offset,
  };
}

function drawVehicleSprite(t, c) {
  const key = vehicleKey(t),
    layers = vehicleLayers && vehicleLayers[key];
  if (!layers || Object.values(layers).some(l => !l.loaded)) return false;
  // размеры деталей спрайта: у дружественной техники — от ступени, у остальных — от вида
  const look = friendlyKind(t) ? playerTier(t) : KINDS[t.kind];
  const m = vehicleMount(t),
    phase = Math.floor((((((t.tread || 0) % 6) + 6) % 6) / 6) * 4),
    wide = look.hullWide || 1,
    trackWidth = look.trackWidth || 6;
  c.save();
  if (t.flash > 0) c.filter = 'brightness(0) invert(1)';
  c.translate(t.x, t.y);
  c.rotate(t.angle + Math.PI / 2);
  c.scale(m.scale * wide, m.scale);
  c.drawImage(layers.tracks.image, 0, phase * 224, 24, 224, -16, -17, trackWidth, 35);
  c.save();
  c.scale(-1, 1);
  c.drawImage(layers.tracks.image, 0, phase * 224, 24, 224, -16, -17, trackWidth, 35);
  c.restore();
  c.drawImage(layers.hull.image, -16, -17, 32, 35);
  c.restore();
  c.save();
  if (t.flash > 0) c.filter = 'brightness(0) invert(1)';
  c.translate(m.x, m.y);
  c.rotate(t.turret + Math.PI / 2);
  c.scale(m.scale, m.scale);
  const recoil = t.dead ? t.recoil || 0 : recoilOffset(t),
    offsets = m.offsets.map(o => o / m.scale);
  for (const off of offsets) c.drawImage(layers.gun.image, off - 3, -m.length + recoil, 6, m.length + 3);
  if (layers.turret) {
    const width = look.turretWidth || 23;
    c.drawImage(layers.turret.image, -width / 2, -12, width, 24);
  }
  c.restore();
  return true;
}
