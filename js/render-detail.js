'use strict';
// Cosmetic-only details. All randomness is coordinate based; cached sprites never change physics.
const detailSprites = new Map();
function detailSprite(key, w, h, paint) {
  if (!detailSprites.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    paint(canvas.getContext('2d'));
    detailSprites.set(key, canvas);
  }
  return detailSprites.get(key);
}
function detailGround(c) {
  // Static terrain lives on groundCanvas, including continuous sand/water shores.
  for (let r = 0; r < ROWS; r++)
    for (let x = 0; x < COLS; x++) {
      const i = r * COLS + x,
        px = x * T,
        py = r * T,
        water = grid[i] === WATER;
      if (sand[i] || water) {
        c.fillStyle = water ? '#285b70' : '#b5a16b';
        c.fillRect(px, py, T, T);
      }
      if (water || sand[i]) {
        for (let k = 0; k < 8; k++) {
          const h = tileHash(x * 13 + k, r * 7 + k);
          c.fillStyle = water ? '#6ab3bf25' : k % 2 ? '#ecda9d66' : '#75634233';
          c.fillRect(px + h * 29, py + tileHash(x + k, r - k) * 30, water ? 4 : 2, 1);
        }
        if (sand[i] && !water) {
          c.strokeStyle = '#e5cc903d';
          c.lineWidth = 1;
          for (let y = 6; y < 32; y += 11) {
            c.beginPath();
            for (let xx = 0; xx <= 32; xx += 4) {
              const yy = py + y + Math.sin((px + xx) * 0.09 + py) * 1.6;
              if (!xx) c.moveTo(px + xx, yy);
              else c.lineTo(px + xx, yy);
            }
            c.stroke();
          }
        }
      } else if (road && road[i]) {
        detailRoad(c, px, py, x, r);
      } else {
        for (let k = 0; k < 5; k++) {
          const dx = tileHash(x * 7 + k, r) * 30,
            dy = tileHash(x, r * 7 + k) * 30;
          c.strokeStyle = k % 2 ? '#a6b66f55' : '#263d2355';
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(px + dx, py + dy);
          c.lineTo(px + dx - 1, py + dy - 3);
          c.lineTo(px + dx + 2, py + dy - 1);
          c.stroke();
        }
      }
    }
  for (let r = 0; r < ROWS; r++)
    for (let x = 0; x < COLS; x++) {
      const i = r * COLS + x,
        type = grid[i] === WATER ? 'water' : sand[i] ? 'sand' : null;
      if (!type) continue;
      for (const [dc, dr] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const nc = x + dc,
          nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const j = nr * COLS + nc,
          other = grid[j] === WATER ? 'water' : sand[j] ? 'sand' : null;
        if (type === other || (type === 'sand' && other === 'water')) continue; // exactly one shared shoreline
        const ax = x * T + (dc === 1 ? T : 0),
          ay = r * T + (dr === 1 ? T : 0),
          vertical = dc !== 0;
        for (const [lineWidth, alpha] of [
          [9, 0.12],
          [5, 0.22],
          [2, 0.5],
        ]) {
          c.lineWidth = lineWidth;
          c.strokeStyle =
            type === 'water'
              ? other === 'sand'
                ? `rgba(210,191,139,${alpha})`
                : `rgba(102,135,99,${alpha})`
              : `rgba(116,128,76,${alpha})`;
          c.beginPath();
          for (let k = 0; k <= 8; k++) {
            const d = k * 4,
              wave = (Math.sin((vertical ? ay : ax) + d) * 0.8 + Math.sin(((vertical ? ay : ax) + d) * 0.43)) * 1.1;
            const px = vertical ? ax + wave : ax + d,
              py = vertical ? ay + d : ay + wave;
            if (k) c.lineTo(px, py);
            else c.moveTo(px, py);
          }
          c.stroke();
        }
      }
    }
}
// Дорога: серая брусчатка рядами со смещением, швы и случайный оттенок камня по координатам.
function detailRoad(c, px, py, col, row) {
  c.fillStyle = '#4d4f4c';
  c.fillRect(px, py, T, T);
  for (let ry = 0; ry < 4; ry++) {
    const shift = (ry + row * 4) % 2 ? 4 : 0;
    for (let rx = -1; rx < 4; rx++) {
      const sx = px + rx * 8 + shift,
        sy = py + ry * 8,
        h = tileHash(col * 5 + rx, row * 5 + ry),
        x0 = Math.max(px, sx + 1),
        x1 = Math.min(px + T, sx + 8);
      if (x1 <= x0) continue;
      c.fillStyle = ['#8a8b86', '#7c7e7a', '#969690', '#85837c'][Math.floor(h * 4)];
      c.fillRect(x0, sy + 1, x1 - x0, 6);
      c.fillStyle = '#b7b6ad55';
      c.fillRect(x0, sy + 1, x1 - x0, 1);
      c.fillStyle = '#2f312f55';
      c.fillRect(x0, sy + 6, x1 - x0, 1);
    }
  }
}
function detailBrick(c, x, y, width, seed, hp) {
  const v = seed % 4,
    key = 'brick' + width + ':' + v + ':' + hp;
  const sprite = detailSprite(key, width, 8, g => {
    g.fillStyle = '#3c2c22';
    g.fillRect(0, 0, width, 8);
    g.fillStyle = ['#ac6545', '#bb7650', '#995239', '#b16b48'][v];
    g.fillRect(1, 1, width - 1, 6);
    g.fillStyle = '#e1aa775f';
    g.fillRect(1, 1, width - 2, 1);
    g.fillStyle = '#562e294d';
    g.fillRect(1, 6, width - 1, 1);
    for (let k = 0; k < 5; k++) {
      g.fillStyle = k % 2 ? '#e9b0864d' : '#38241d40';
      g.fillRect(1 + ((k * 7 + v) % Math.max(1, width - 2)), 2 + ((k * 3 + v) % 4), 1, 1);
    }
    if (hp < 4) {
      g.strokeStyle = '#422e28';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(width * 0.35, 1);
      g.lineTo(width * 0.6, 4);
      g.lineTo(width * 0.48, 7);
      g.stroke();
    }
  });
  c.drawImage(sprite, x, y);
}
function detailLeaf(c, x, y, radius, variant) {
  const size = radius * 2 + 2,
    key = 'leaf' + radius + ':' + variant;
  const sprite = detailSprite(key, size, size, g => {
    const mid = radius + 1;
    g.fillStyle = '#234b26';
    g.beginPath();
    g.arc(mid, mid, radius, 0, Math.PI * 2);
    g.fill();
    for (let k = 0; k < 12; k++) {
      const a = k * 2.399 + variant,
        d = radius * Math.sqrt((k + 0.5) / 12) * 0.75,
        px = mid + Math.cos(a) * d,
        py = mid + Math.sin(a) * d;
      g.fillStyle = ['#477e37', '#609642', '#35672d', '#7da34a'][(k + variant) % 4];
      g.beginPath();
      g.ellipse(px, py, 3, 2, a, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#b6c27044';
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(px - 1, py);
      g.lineTo(px + 1, py - 1);
      g.stroke();
    }
  });
  c.drawImage(sprite, x - radius - 1, y - radius - 1);
}
function detailHull(c, t) {
  if (t.flash > 0) return;
  const friendly = t.kind === 'player' || t.kind === 'ally',
    arty = t.kind === 'artillery',
    key = 'hull' + t.kind + ':' + (t.upgrade || 0);
  const sprite = detailSprite(key, 32, 38, g => {
    g.strokeStyle = friendly ? '#cad29b88' : arty ? '#eee0aa88' : '#d2d9db88';
    g.lineWidth = 0.65;
    for (const x of [1, 28])
      for (let y = 4; y < 34; y += 6) {
        g.fillStyle = '#101718aa';
        g.fillRect(x, y, 3, 3);
        g.strokeRect(x, y, 3, 3);
      }
    g.fillStyle = '#18251f88';
    g.fillRect(10, 26, 12, 7);
    g.strokeStyle = '#c6c4a177';
    for (let x = 11; x < 23; x += 2) {
      g.beginPath();
      g.moveTo(x, 27);
      g.lineTo(x, 32);
      g.stroke();
    }
    for (const [x, y] of [
      [8, 4],
      [24, 4],
      [7, 21],
      [25, 21],
      [9, 34],
      [23, 34],
    ]) {
      g.fillStyle = '#dde0b477';
      g.fillRect(x, y, 1, 1);
    }
    g.strokeStyle = '#17221c66';
    g.beginPath();
    g.moveTo(7, 10);
    g.lineTo(25, 10);
    g.moveTo(9, 22);
    g.lineTo(23, 22);
    g.stroke();
    if (arty) {
      g.fillStyle = '#c6ab68';
      for (let k = 0; k < 4; k++) g.fillRect(8 + k * 4, 22, 2, 7);
    }
  });
  c.drawImage(sprite, -16, -18);
}
function detailTurret(c, t) {
  if (t.flash > 0) return;
  const sprite = detailSprite('turret' + t.kind + ':' + (t.upgrade || 0), 26, 26, g => {
    g.strokeStyle = '#111c1d88';
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(10, 13, 3, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#d6dfb477';
    g.beginPath();
    g.arc(10, 12, 2.5, Math.PI, Math.PI * 1.7);
    g.stroke();
    g.fillStyle = '#d6dfb499';
    for (const [x, y] of [
      [9, 4],
      [17, 5],
      [5, 18],
      [20, 18],
    ])
      g.fillRect(x, y, 1, 1);
    g.strokeStyle = '#14201d99';
    g.beginPath();
    g.moveTo(17, 15);
    g.lineTo(20, 17);
    g.stroke();
  });
  c.drawImage(sprite, -13, -13);
}

// A small repeating wave atlas avoids rebuilding hundreds of paths every frame.
function detailWater(c, x, y, col) {
  const frame = Math.floor(time * 8) % 24,
    phase = (frame * Math.PI) / 12,
    parity = col % 2;
  const sprite = detailSprite('water' + parity + ':' + frame, T, T, g => {
    g.strokeStyle = '#b9e5e64d';
    g.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      g.beginPath();
      for (let xx = 0; xx <= T; xx += 2) {
        const yy = 8 + k * 16 + Math.sin(phase) * 1.3 + Math.sin(((parity * T + xx) * Math.PI) / 32 + phase) * 1.2;
        if (!xx) g.moveTo(xx, yy);
        else g.lineTo(xx, yy);
      }
      g.stroke();
    }
  });
  c.drawImage(sprite, x, y);
}
