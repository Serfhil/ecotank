'use strict';
// Общие примитивы Canvas, бонусы, снаряды и сборка кадра в исходном порядке слоёв.
// Вызывает render-world/render-tanks/effects/render-ui; ctx и состояние принадлежат игре.
// Обычные относительные скрипты сохраняют запуск открытием index.html.
// Здесь только определения функций: Canvas и цикл не создаются при подключении.

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function roundedPolygon(c, points, amount) {
  points.forEach(([x, y], i) => {
    const prev = points[(i + points.length - 1) % points.length],
      next = points[(i + 1) % points.length];
    const ax = x + (prev[0] - x) * amount,
      ay = y + (prev[1] - y) * amount,
      bx = x + (next[0] - x) * amount,
      by = y + (next[1] - y) * amount;
    if (!i) c.moveTo(ax, ay);
    else c.lineTo(ax, ay);
    c.quadraticCurveTo(x, y, bx, by);
  });
  c.closePath();
}

function drawItems() {
  for (const it of items) {
    if (it.life < 3 && Math.floor(time * 8) % 2) continue;
    const I = ITEMS[it.type],
      y = it.y + Math.sin(time * 4 + it.x) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(it.x, it.y + 12, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2226';
    roundRect(ctx, it.x - 12, y - 12, 24, 24, 6);
    ctx.fill();
    ctx.strokeStyle = I.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = I.color;
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (it.type === 'rail') drawNiiIcon(ctx, it.x - 10, y - 10, 20);
    else if (!drawItemIcon(ctx, it.type, it.x, y, I.color)) ctx.fillText(I.glyph, it.x, y + 1);
  }
}

// Значки новых бонусов: силуэт бойца с плюсом, кладка, стальная плита. false — рисуется глиф.
function drawItemIcon(c, type, x, y, color) {
  if (type === 'reinforce') {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x - 3, y - 4, 3.2, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(x - 9, y + 8);
    c.quadraticCurveTo(x - 9, y - 0.5, x - 3, y - 0.5);
    c.quadraticCurveTo(x + 3, y - 0.5, x + 3, y + 8);
    c.closePath();
    c.fill();
    c.fillRect(x + 3, y - 6, 8, 2.4);
    c.fillRect(x + 5.8, y - 8.8, 2.4, 8);
    return true;
  }
  if (type === 'stroybat') {
    c.fillStyle = color;
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 3; k++) {
        const off = row % 2 ? 3 : 0,
          bx = x - 9 + k * 6 + off;
        if (bx + 5 > x + 9) continue;
        c.fillRect(bx, y - 7 + row * 5, 5, 4);
      }
    return true;
  }
  if (type === 'curtain') {
    c.fillStyle = '#6f7b85';
    c.fillRect(x - 8, y - 8, 16, 16);
    c.fillStyle = color;
    c.fillRect(x - 6, y - 6, 12, 12);
    c.fillStyle = '#5b666f';
    for (const [ox, oy] of [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ]) {
      c.beginPath();
      c.arc(x + ox, y + oy, 1.3, 0, Math.PI * 2);
      c.fill();
    }
    return true;
  }
  return false;
}

function drawBullets() {
  for (const b of bullets) {
    if (b.mg) {
      const l = Math.hypot(b.vx, b.vy) || 1;
      ctx.strokeStyle = '#ffe08acc';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - (b.vx / l) * 7, b.y - (b.vy / l) * 7);
      ctx.stroke();
      continue;
    }
    if (b.armor && b.trail && b.trail.length) {
      ctx.strokeStyle = '#ffe4a7aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      b.trail.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = b.owner === 'p' ? 'rgba(200,255,170,.35)' : 'rgba(255,170,140,.35)';
    ctx.lineWidth = b.r * 1.4;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.025, b.y - b.vy * 0.025);
    ctx.stroke();
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(Math.atan2(b.vy, b.vx));
    const width = b.r,
      length = b.armor ? 12 : 10;
    ctx.fillStyle = b.armor ? '#ffce78' : b.owner === 'p' ? '#cfe4ba' : '#d8b5a1';
    ctx.beginPath();
    ctx.moveTo(length * 0.6, 0);
    ctx.quadraticCurveTo(length * 0.2, -width, -length * 0.55, -width);
    ctx.lineTo(-length * 0.55, width);
    ctx.quadraticCurveTo(length * 0.2, width, length * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#645543';
    ctx.fillRect(-length * 0.55, -width, 2, width * 2);
    ctx.strokeStyle = '#fff3c3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-length * 0.3, -width * 0.4);
    ctx.lineTo(length * 0.25, -width * 0.25);
    ctx.stroke();
    ctx.restore();
  }
}

function draw() {
  fit();
  if (state === 'over' && victory) {
    if (!victoryFrame) {
      drawBattleFrame();
      captureVictoryFrame();
    }
    drawVictoryScreen();
    return;
  }
  if (state === 'over' && !victory) {
    if (!defeatFrame) {
      drawBattleFrame();
      drawHud(true);
      captureDefeatFrame();
    }
    drawDefeatScreen();
    return;
  }
  if (scenario.drawFrame && scenario.drawFrame()) return;
  drawBattleFrame();
  drawHud();
}

function drawBattleFrame() {
  ctx.save();
  const zoom = scenario.cameraZoom ? scenario.cameraZoom() : 1;
  if (zoom > 1) {
    ctx.translate(clamp(W / 2 - player.x * zoom, W * (1 - zoom), 0), clamp(H / 2 - player.y * zoom, H * (1 - zoom), 0));
    ctx.scale(zoom, zoom);
  }
  const sk = shake * CFG.shake * 0.5;
  if (sk > 0) ctx.translate(rnd(-sk, sk), rnd(-sk, sk));
  ctx.drawImage(groundCanvas, 0, 0);
  drawTiles();
  if (scenario.draw) scenario.draw('ground');
  if (state !== 'menu') drawBase();
  if (state !== 'menu') {
    drawWrecks();
    drawItems();
    drawMines();
    for (const e of enemies) drawTank(e);
    for (const a of allies) if (!a.dead) drawTank(a);
    if (player && !player.dead) drawTank(player);
    drawBombers();
    if (scenario.draw) scenario.draw('units');
    drawBullets();
    drawArtilleryShells();
    drawRocketZones();
    drawRockets();
    drawRails();
    drawParts();
    drawMineFx();
  }
  drawTrees();
  ctx.restore();

  ctx.save();
  ctx.scale(W / UI_W, H / UI_H);
  drawUI();
  ctx.restore();

  if (scenario.draw) scenario.draw('overlay');
}

// Пульсирующая зона удара: общая для артиллерии и РСЗО. appear 0..1 — проявление новой метки.
function drawWarningZone(x, y, radius, appear = 1) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 7);
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.fillStyle = `rgba(255,208,45,${0.07 + pulse * 0.1})`;
  ctx.strokeStyle = `rgba(255,218,65,${0.5 + pulse * 0.5})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(x, y, radius * (0.6 + 0.4 * appear), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y + 8);
  ctx.stroke();
  ctx.restore();
}

function drawRocketZones() {
  for (const p of rocketZones()) drawWarningZone(p.x, p.y, ROCKET_CONFIG.radius, clamp((simTime - p.markedAt) / 0.25, 0, 1));
}

// Ракета и инверсионный след: не больше ROCKET_CONFIG.trail точек, прозрачность — по возрасту точки.
function drawRocketTrail(trail, head) {
  ctx.lineCap = 'round';
  for (let k = 1; k < trail.length + (head ? 1 : 0); k++) {
    const a = trail[k - 1],
      b = trail[k] || head,
      fade = clamp(1 - (rocketClock - a.t) / ROCKET_CONFIG.trailLife, 0, 1);
    if (!fade) continue;
    ctx.strokeStyle = `rgba(226,222,210,${0.55 * fade})`;
    ctx.lineWidth = 1.5 + 2.5 * fade;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
function drawRockets() {
  for (const trail of rocketTrails) drawRocketTrail(trail, null);
  for (const r of rockets) {
    drawRocketTrail(r.trail, r);
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = 'rgba(255,170,60,.85)';
    ctx.beginPath();
    ctx.ellipse(-7, 0, 4 + Math.random() * 2, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#57543f';
    ctx.fillRect(-5, -1.6, 9, 3.2);
    ctx.fillStyle = '#2b2a22';
    ctx.beginPath();
    ctx.moveTo(4, -1.6);
    ctx.lineTo(7, 0);
    ctx.lineTo(4, 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawArtilleryShells() {
  for (const shell of artilleryShells) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 7),
      p = clamp((shell.age - shell.delay) / shell.duration, 0, 1);
    drawWarningZone(shell.tx, shell.ty, shell.radius);
    ctx.save();
    if (shell.pending || shell.age < shell.delay) {
      ctx.restore();
      continue;
    }
    const x = shell.sx + shell.dx * p,
      y = shell.sy + shell.dy * p - Math.sin(p * Math.PI) * 65;
    ctx.fillStyle = 'rgba(235,45,35,0.2)';
    ctx.beginPath();
    ctx.arc(x, y, 10 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(shell.angle);
    ctx.fillStyle = '#d8b5a1';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.quadraticCurveTo(2, -3, -5.5, -3);
    ctx.lineTo(-5.5, 3);
    ctx.quadraticCurveTo(2, 3, 6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#645543';
    ctx.fillRect(-5.5, -3, 2, 6);
    ctx.strokeStyle = '#fff3c3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -1.2);
    ctx.lineTo(2.5, -0.75);
    ctx.stroke();
    ctx.restore();
  }
}
