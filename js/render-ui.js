'use strict';
// Canvas-интерфейс: текст, HUD, сообщения, затемнение, пауза и экран результата.
// Координаты UI_W/UI_H постоянны; масштабирование выполняет renderer.js.
// Читает общее состояние и UI_TEXT/CFG/ITEMS. DOM-меню и обработчики остаются в игре.
// Подключение не обращается к DOM или Canvas и не меняет состояние игры.

function text(str, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(str, x + 1, y + 2);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

function drawHud() {
  if(player) text(player.boostLeft>0?UI_TEXT.shift_uskorenie:player.boostCooldown>0?'SHIFT · '+Math.ceil(player.boostCooldown)+UI_TEXT.s:UI_TEXT.shift_gotov,12,UI_H-15,12,'#e5cd88');
  if(player && player.armor) text('★ '+(player.upgrade>=2?UI_TEXT.is_2_ii:UI_TEXT.is_2)+UI_TEXT.broneboynye,UI_W/2,42,12,'#ffc477','center');
  ctx.fillStyle = 'rgba(12,16,14,.6)';
  roundRect(ctx, 8, 8, 570, 32, 8); ctx.fill();
  const maxHp = player.maxHp;
  if (maxHp <= 5) {
    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < player.hp ? '#e5484d' : '#3a3f44';
      roundRect(ctx, 18 + i * 18, 17, 13, 14, 3); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#3a3f44'; roundRect(ctx, 18, 16, 86, 16, 4); ctx.fill();
    ctx.fillStyle = '#e5484d'; roundRect(ctx, 18, 16, 86 * clamp(player.hp / maxHp, 0, 1), 16, 4); ctx.fill();
    text(`${player.hp}/${maxHp}`, 61, 24, 11, '#fff', 'center', '700');
  }
  text(`${UI_TEXT.ochki}${score}`, 118, 24, 15, '#eef5e8');
  text(campaign ? `${UI_TEXT.ur}${wave}/${campaign.length}` : `${UI_TEXT.volna}${wave}`, 230, 24, 15, '#eef5e8');
  text(`${UI_TEXT.vragi}${toSpawn.length + enemies.length}`, 320, 24, 15, '#eef5e8');
  text(`${UI_TEXT.metallolom_3}${scrap}`, 425, 24, 15, '#d9c27a');

  let x = UI_W - 12;
  if (player.rail > 0) {
    const I = ITEMS.rail;
    ctx.fillStyle = 'rgba(12,16,14,.6)'; roundRect(ctx, x - 150, 8, 150, 32, 8); ctx.fill();
    text(`${I.glyph} ${I.name} ×${player.rail}`, x - 140, 20, 13, I.color);
    text(UI_TEXT.pkm_e, x - 140, 33, 10, '#b9a6d6', 'left', '400');
    x -= 158;
  }
  for (const k of ['shield', 'rapid']) {
    const v = player.pw[k];
    if (v <= 0) continue;
    const I = ITEMS[k];
    ctx.fillStyle = 'rgba(12,16,14,.6)'; roundRect(ctx, x - 120, 8, 120, 32, 8); ctx.fill();
    text(I.glyph + ' ' + I.name, x - 110, 21, 13, I.color);
    ctx.fillStyle = '#3a3f44'; ctx.fillRect(x - 110, 31, 100, 3);
    ctx.fillStyle = I.color; ctx.fillRect(x - 110, 31, Math.min(100, v / CFG.powerupTime * 100), 3);
    x -= 128;
  }
  if (muted) text(UI_TEXT.zvuk_vykl_m, UI_W - 12, UI_H - 14, 12, '#aab', 'right', '400');
}

function overlay(alpha) { ctx.fillStyle = `rgba(38,7,14,${alpha})`; ctx.fillRect(0, 0, UI_W, UI_H); }

function drawMenu() {
  overlay(.72);
  text('EcoTank', UI_W / 2, 150, 72, '#8be06a', 'center', '800');
  text(UI_TEXT.zashchishchay_les_krushi_vrazheskuyu_tekhniku, UI_W / 2, 205, 18, '#cfe0c6', 'center', '400');
  const lines = [
    ['W/S · ↑/↓', UI_TEXT.vperyod_nazad], ['A/D · ←/→', UI_TEXT.povorot_korpusa],
    [UI_TEXT.mysh, UI_TEXT.pritsel_bashni],
    [UI_TEXT.lkm_probel, UI_TEXT.ogon],
    [UI_TEXT.pkm_e, UI_TEXT.relsotron_esli_est_zaryad],
    ['P / Esc', UI_TEXT.pauza],
    ['M', UI_TEXT.zvuk],
  ];
  lines.forEach(([k, v], i) => { text(k, UI_W / 2 - 20, 260 + i * 27, 16, '#ffe08a', 'right'); text(v, UI_W / 2, 260 + i * 27, 16, '#dde6d8', 'left', '400'); });
  text(UI_TEXT.zabor_lomaetsya_s_vystrela_kirpich_s_chetyryokh_stal_i_voda_net_v_kronakh_vragi_tebya, UI_W / 2, 438, 14, '#9fb39a', 'center', '400');
  text(UI_TEXT.proezzhay_po_oblomkam_vragov_chtoby_sobrat_metallolom, UI_W / 2, 460, 14, '#d9c27a', 'center', '400');
  const types = Object.entries(ITEMS);
  types.forEach(([k, I], i) => {
    const x = UI_W / 2 - 370 + i * 160, y = 505;
    ctx.fillStyle = '#1d2226'; roundRect(ctx, x - 12, y - 12, 24, 24, 6); ctx.fill();
    ctx.strokeStyle = I.color; ctx.lineWidth = 2; ctx.stroke();
    text(I.glyph, x, y + 1, 14, I.color, 'center', '700');
    text(I.name, x + 20, y, 14, '#dde6d8', 'left', '400');
  });
  if (Math.floor(time * 2) % 2 === 0) text(UI_TEXT.nazhmi_enter_ili_klikni_chtoby_nachat, UI_W / 2, 565, 20, '#fff', 'center');
  if (best) text(`${UI_TEXT.rekord}${best}`, UI_W / 2, 605, 15, '#ffe08a', 'center', '400');
}

function drawUI() {
  if(state==='menu')return;
  if (state === 'over' && !victory) { drawDefeatScreen(); return; }
  drawHud();
  if (banner.t > 0) {
    const a = clamp(banner.t, 0, 1);
    ctx.globalAlpha = a;
    text(banner.text, UI_W / 2, UI_H / 2 - 30, 48, '#fff', 'center', '800');
    if (banner.sub) text(banner.sub, UI_W / 2, UI_H / 2 + 15, 20, '#ffe08a', 'center');
    ctx.globalAlpha = 1;
  }
  if (state === 'pause') {
    overlay(.55);
    text(UI_TEXT.pause, UI_W / 2, UI_H / 2 - 50, 52, '#f0cc77', 'center', '800');
  }
  if (state === 'over') {
    overlay(clamp(overT * 1.5, 0, .7));
    if (overT > .3) {
      text(victory ? UI_TEXT.kampaniya_proydena : base && base.dead ? UI_TEXT.baza_unichtozhena : UI_TEXT.tank_unichtozhen, UI_W / 2, UI_H / 2 - 70, 52, victory ? '#f0cc77' : '#ef6452', 'center', '800');
      text(`${UI_TEXT.ochki_2}${score}   ·   ${campaign ? UI_TEXT.uroven_2 : UI_TEXT.volna_2}: ${campaign ? `${wave}${UI_TEXT.iz}${campaign.length}` : wave}${UI_TEXT.metallolom_4}${scrap}`, UI_W / 2, UI_H / 2 - 10, 22, '#fff', 'center');
      text(score >= best && score > 0 ? UI_TEXT.novyy_rekord : `${UI_TEXT.rekord}${best}`, UI_W / 2, UI_H / 2 + 25, 18, '#ffe08a', 'center');
      const again = !campaign ? UI_TEXT.enter_ili_klik_eshchyo_raz : victory ? UI_TEXT.enter_ili_klik_proyti_kampaniyu_zanovo : `${UI_TEXT.enter_ili_klik_povtorit_uroven}${wave}`;
      if (overT > .6 && Math.floor(time * 2) % 2 === 0) text(again, UI_W / 2, UI_H / 2 + 80, 18, '#f2d3b1', 'center', '400');
    }
  }
}

// Full viewport, separate from the scaled battlefield: never crop Marx or the tank.
function drawDefeatScreen() {
  if (!defeatCanvas) return;
  const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
  const ratio = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1;
  const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
  if (defeatCanvas.width !== pixelWidth || defeatCanvas.height !== pixelHeight) {
    defeatCanvas.width = pixelWidth; defeatCanvas.height = pixelHeight;
  }
  const c = defeatCanvas.getContext('2d');
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.fillStyle = '#18090d'; c.fillRect(0, 0, width, height);
  const entry = defeatImages[defeatTier === null ? 0 : defeatTier];
  if (entry && entry.loaded) {
    const image = entry.image, scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    c.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  }
  const shade = c.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(25,3,9,.85)'); shade.addColorStop(.24, 'rgba(25,3,9,0)');
  shade.addColorStop(.65, 'rgba(25,3,9,0)'); shade.addColorStop(1, 'rgba(25,3,9,.88)');
  c.fillStyle = shade; c.fillRect(0, 0, width, height);
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '800 ' + clamp(Math.min(width * .1, height * .14), 32, 108) + 'px "Segoe UI", sans-serif';
  c.shadowColor = '#630f20'; c.shadowBlur = 18; c.shadowOffsetY = 4;
  c.fillStyle = '#f1cc72'; c.fillText(UI_TEXT.defeat, width / 2, Math.max(44, height * .1));
  c.shadowBlur = 0; c.shadowOffsetY = 0;
}
