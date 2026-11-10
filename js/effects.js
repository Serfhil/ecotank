'use strict';
// Создание, обновление и отрисовка визуальных эффектов: частицы, огонь, лучи и подписи.
// Работает с общими parts/rails/shake/hitstop/time, gctx из world.js и ctx игры.
// explosion сохраняет прежние следы на земле, тряску, остановку кадра и вызов sfx.
// Урон и цепные взрывы остаются в damage.js. Подключение не создаёт эффекты.

function burst(x, y, n, colors, speed, life, size, kind) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2),
      s = rnd(speed * 0.2, speed);
    const l = rnd(life * 0.5, life);
    const p = {
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: l,
      max: l,
      size: rnd(size * 0.5, size),
      color: colors[ri(0, colors.length - 1)],
      kind,
    };
    if (kind === 'debris') {
      p.rot = rnd(0, 6);
      p.vr = rnd(-12, 12);
    }
    parts.push(p);
  }
}

function explosion(x, y, big, color, sizeMultiplier = 1, withHitstop = true) {
  const k = (big ? 1.4 : 1) * sizeMultiplier;
  parts.push({ x, y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 70 * k, kind: 'flash' });
  parts.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: 80 * k, kind: 'ring' });
  burst(x, y, 50 * k, ['#fff3c0', '#ffe08a', '#ff9a3c', '#e8442c', '#ffcf5a'], 300 * k, 0.7, 9 * k, 'fire');
  burst(x, y, 26 * k, ['#fff', '#ffe9a0', '#ffb24a'], 560, 0.5, 2, 'spark');
  burst(x, y, 12 * k, [color || '#666', '#2a2a2a', '#4a4a4a'], 280, 1.1, 7, 'debris');
  burst(x, y, 22 * k, ['#2e2e2e', '#444', '#5a5a5a'], 90, 1.8, 13 * k, 'smoke');
  shake = Math.max(shake, big ? 20 : 13);
  if (withHitstop) hitstop = Math.max(hitstop, CFG.hitstop);
  gctx.fillStyle = 'rgba(20,15,10,.4)';
  gctx.beginPath();
  gctx.arc(x, y, 24 * k, 0, Math.PI * 2);
  gctx.fill();
  gctx.fillStyle = 'rgba(20,15,10,.2)';
  for (let i = 0; i < 8; i++) {
    const a = rnd(0, 6),
      d = rnd(18, 36) * k;
    gctx.beginPath();
    gctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, rnd(4, 9), 0, Math.PI * 2);
    gctx.fill();
  }
  sfx('boom');
}

function floatText(x, y, text, color) {
  const part = { x, y, vx: 0, vy: -40, life: 1, max: 1, text, color };
  parts.push(part);
  return part;
}

function updateParts(dt) {
  for (let i = 0; i < brickShake.length; i++) brickShake[i] = Math.max(0, brickShake[i] - dt);
  for (let i = 0; i < foliageShake.length; i++) foliageShake[i] = Math.max(0, foliageShake[i] - dt);
  const DRAG = { smoke: 0.3, spark: 0.15, debris: 0.08 };
  for (const p of parts) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = p.text ? 1 : Math.pow(DRAG[p.kind] || 0.05, dt);
    p.vx *= drag;
    p.vy *= drag;
    if (p.kind === 'smoke') p.vy -= 25 * dt;
    if (p.kind === 'debris') p.rot += p.vr * dt;
    p.life -= dt;
  }
  parts = parts.filter(p => p.life > 0);
  for (const r of rails) r.life -= dt;
  rails = rails.filter(r => r.life > 0);
}

function drawFlames(x, y, strength = 1) {
  strength = clamp(strength, 0, 1);
  if (!strength) return;
  for (let i = 0; i < 3; i++) {
    const f = 0.5 + 0.5 * Math.sin(time * 17 + i * 2 + x),
      h = (8 + 8 * f) * strength;
    ctx.fillStyle = '#ed542bdd';
    ctx.beginPath();
    ctx.ellipse(x + (i - 1) * 5, y - h / 2, 3.5 * strength, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd875';
    ctx.beginPath();
    ctx.ellipse(x + (i - 1) * 5, y - 2, 1.7 * strength, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRails() {
  ctx.lineCap = 'round';
  for (const r of rails) {
    const a = r.life / r.max;
    ctx.strokeStyle = `rgba(170,110,255,${a * 0.45})`;
    ctx.lineWidth = 16 * a + 2;
    ctx.beginPath();
    ctx.moveTo(r.x0, r.y0);
    ctx.lineTo(r.x1, r.y1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(240,225,255,${a})`;
    ctx.lineWidth = 4 * a + 1;
    ctx.beginPath();
    ctx.moveTo(r.x0, r.y0);
    ctx.lineTo(r.x1, r.y1);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawParts() {
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = p.kind === 'fire' || p.kind === 'spark' || p.kind === 'flash' ? 'lighter' : 'source-over';
    if (p.kind === 'bird') {
      const flap = Math.sin(time * 24 + p.phase) * 5;
      ctx.strokeStyle = p.color || '#1c2927';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y + flap);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + 6, p.y + flap);
      ctx.stroke();
    } else if (p.text) {
      ctx.fillStyle = p.color;
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === 'flash') {
      ctx.fillStyle = '#fff4d0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.2 - a * 0.4), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'ring') {
      ctx.strokeStyle = '#ffe3b0';
      ctx.lineWidth = 6 * a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - a * a), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(2, (p.size || 2) * 0.9);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.065, p.y - p.vy * 0.065);
      ctx.stroke();
    } else if (p.kind === 'debris') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const width = p.w || p.size,
        height = p.h || p.size * 0.66;
      ctx.fillStyle = p.color;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = a * 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (2 - a), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.kind === 'fire' ? 0.4 + 0.6 * a : a), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
