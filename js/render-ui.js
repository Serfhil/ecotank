'use strict';
// Canvas-интерфейс: текст, HUD, сообщения, затемнение, пауза и экран результата.
// Баннеры используют UI_W/UI_H; отдельный HUD — CSS-пиксели из layout.js.
// Читает общее состояние и UI_TEXT/CFG/ITEMS. DOM-меню и обработчики остаются в игре.
// Подключение не обращается к DOM или Canvas и не меняет состояние игры.

function text(str, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(str, x + 1, y + 2);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

// Three independent, click-through panels on a transparent viewport canvas.
function drawNiiIcon(c,x,y,size) {
  if(niiIcon&&niiIcon.complete&&niiIcon.naturalWidth){c.drawImage(niiIcon,x,y,size,size);return;}
  c.save();c.translate(x,y);c.scale(size/64,size/64);c.strokeStyle='#27eee5';c.lineWidth=3;
  c.strokeRect(7,7,50,50);c.beginPath();c.arc(32,32,28,0,Math.PI*2);c.stroke();c.beginPath();c.arc(32,32,21,0,Math.PI*2);c.stroke();
  c.beginPath();c.moveTo(17,44);c.bezierCurveTo(45,9,12,17,27,34);c.bezierCurveTo(46,57,53,16,30,28);c.stroke();c.restore();
}
function drawHud(force = false) {
  if (!player || !hudCanvas || !gameLayout || !gameLayout.hud || !gameHasHud() || !force&&state==='over') return;
  const h=gameLayout.hud,ratio=typeof devicePixelRatio==='number'?Math.min(2,devicePixelRatio):1;
  if(hudCanvas.width!==Math.round(h.width*ratio)||hudCanvas.height!==Math.round(h.height*ratio)){hudCanvas.width=Math.round(h.width*ratio);hudCanvas.height=Math.round(h.height*ratio);}
  const c=hudCanvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.globalAlpha=1;c.clearRect(0,0,h.width,h.height);
  const panel=(key,paint)=>{const p=h.panels[key];c.save();c.globalAlpha=hudOpacity[key];c.translate(p.x,p.y);c.fillStyle='#2b1018e8';roundRect(c,0,0,p.w,p.h,7);c.fill();c.strokeStyle='#bb794b';c.lineWidth=1;c.stroke();paint(p);c.restore();};
  c.textBaseline='middle';c.textAlign='left';
  panel('left',p=>{
    drawNiiIcon(c,10,8,30);if(player.railArmed){c.strokeStyle='#c58cff';c.lineWidth=2;c.strokeRect(7,5,36,36);}c.fillStyle='#53f6e8';c.font='700 19px "Segoe UI",sans-serif';c.fillText(String(player.rail),46,24);
    const gap=3,w=Math.min(19,(p.w-20-gap*(player.maxHp-1))/player.maxHp);
    for(let i=0;i<player.maxHp;i++){c.fillStyle=i<player.hp?'#ed3d43':'#58212c';c.fillRect(10+i*(w+gap),p.h-31,w,18);c.strokeStyle='#ee868255';c.strokeRect(10+i*(w+gap),p.h-31,w,18);}
  });
  panel('right',p=>{
    c.fillStyle='#f6db9a';c.font='600 '+(p.w<170?11:13)+'px "Segoe UI",sans-serif';
    c.fillText(UI_TEXT.hudLevelShort+' '+wave,10,19);c.fillText(UI_TEXT.hudEnemiesShort+' '+(raseiniai ? raseiniaiEnemyCount() : toSpawn.length+enemies.filter(e=>!e.dead).length),10,44);
    c.fillText(UI_TEXT.metallolom_5+': '+scrap,10,69);
    c.fillText('★ '+(player.upgrade>=2?UI_TEXT.is_2_ii:player.upgrade?UI_TEXT.is_2:UI_TEXT.hudBaseTank)+' · '+machineGun(player).name,10,96);
    let x=12;for(const k of ['shield','rapid'])if(player.pw[k]>0){c.fillStyle=ITEMS[k].color;c.font='700 23px "Segoe UI",sans-serif';c.fillText(ITEMS[k].glyph,x,128);x+=30;}
  });
  panel('score',()=>{c.fillStyle='#f6db9a';c.font='700 15px "Segoe UI",sans-serif';c.fillText(UI_TEXT.ochki.trim()+' '+score,10,23);});
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
    [UI_TEXT.pkm, UI_TEXT.kursovoy_pulemet],
    [UI_TEXT.klavisha_c, UI_TEXT.zaryadit_snaryad_iz_nii],
    ['P / Esc', UI_TEXT.pauza],
    ['M', UI_TEXT.zvuk],
  ];
  lines.forEach(([k, v], i) => { text(k, UI_W / 2 - 20, 250 + i * 23, 16, '#ffe08a', 'right'); text(v, UI_W / 2, 250 + i * 23, 16, '#dde6d8', 'left', '400'); });
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
  if (state === 'over') return;
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

}

// Compose opaque artwork separately, then fade the whole layer once.
// Applying alpha to each primitive separately would darken the frozen field twice.
let defeatArtworkCanvas = null;
// Full viewport, separate from the scaled battlefield: never crop Marx or the tank.
function drawDefeatScreen() {
  if (!defeatCanvas) return;
  const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
  const ratio = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1;
  const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
  if (defeatCanvas.width !== pixelWidth || defeatCanvas.height !== pixelHeight) {
    defeatCanvas.width = pixelWidth; defeatCanvas.height = pixelHeight;
  }
  const output = defeatCanvas.getContext('2d');
  output.setTransform(ratio, 0, 0, ratio, 0, 0);
  output.globalAlpha = 1;
  const c = output;
  c.fillStyle = '#14181c'; c.fillRect(0, 0, width, height);
  if (defeatFrame) {
    const scale = Math.min(width / defeatFrame.width, height / defeatFrame.height);
    const w = defeatFrame.width * scale, h = defeatFrame.height * scale;
    c.drawImage(defeatFrame, (width - w) / 2, (height - h) / 2, w, h);
  }
  c.globalAlpha=defeatDarkness(); c.fillStyle='#000'; c.fillRect(0,0,width,height);
  if (!defeatArtworkCanvas) defeatArtworkCanvas = document.createElement('canvas');
  if (defeatArtworkCanvas.width !== pixelWidth || defeatArtworkCanvas.height !== pixelHeight) {
    defeatArtworkCanvas.width = pixelWidth; defeatArtworkCanvas.height = pixelHeight;
  }
  paintDefeatArtwork(defeatArtworkCanvas.getContext('2d'), width, height, ratio);
  output.globalAlpha = defeatOpacity();
  output.drawImage(defeatArtworkCanvas, 0, 0, width, height);
  output.globalAlpha = 1;
}

function paintDefeatArtwork(c, width, height, ratio) {
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.globalAlpha = 1;
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

// Victory presentation. UI text remains DOM-readable; the background is a viewport canvas.
function buildVictoryCredits() {
  const s = victoryStats;
  const rows = [[UI_TEXT.victoryEnemies, Object.values(s.enemies).reduce((a,b)=>a+b,0)],
    ...STAT_ENEMY_TYPES.map(k => [KIND_NAMES[k], s.enemies[k], k]),
    [UI_TEXT.victoryBricks,s.bricks],[UI_TEXT.victoryFoliage,s.foliage],
    [UI_TEXT.victoryFlocks,s.flocks],[UI_TEXT.victoryDeaths,s.deaths],[UI_TEXT.victoryAllies,s.allies]];
  document.getElementById('victoryCredits').innerHTML = rows.map(([label,value,kind]) =>
    '<div class="victoryRow">'+(kind?'<canvas id="victoryModel-'+kind+'" width="132" height="160" aria-hidden="true"></canvas>':'')+
    '<span>'+label+'</span><strong>'+value+'</strong></div>').join('');
  for (const kind of STAT_ENEMY_TYPES) {
    const c = document.getElementById('victoryModel-'+kind).getContext('2d');
    c.save(); c.clearRect(0,0,132,160); c.translate(66,92); c.scale(1.8,1.8);
    drawPlayerModel({kind,x:0,y:0,angle:-Math.PI/2,turret:-Math.PI/2,tread:0,recoil:0,flash:0,dead:true},c);
    c.restore();
  }
}
function renderVictoryContent() {
  const g = victoryCreditsGeometry();
  document.getElementById('victoryCreditsWindow').style.top = g.top+'px';
  document.getElementById('victoryCreditsWindow').style.height = g.height+'px';
  document.getElementById('victoryCredits').style.transform = 'translateY('+
    (g.height-Math.max(0,victoryTime-victoryRevealEnd())*VICTORY_CONFIG.creditsSpeed)+'px)';
  document.getElementById('victoryAward').style.opacity = victoryAwardTime === null ? 0 : clamp((victoryTime-victoryAwardTime)/VICTORY_CONFIG.awardFade,0,1);
}
function drawVictoryScreen() {
  if (!victoryCanvas) return;
  const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight),ratio=typeof devicePixelRatio==='number'?Math.min(2,devicePixelRatio):1;
  if(victoryCanvas.width!==Math.round(w*ratio)||victoryCanvas.height!==Math.round(h*ratio)){
    victoryCanvas.width=Math.round(w*ratio);victoryCanvas.height=Math.round(h*ratio);
  }
  const c=victoryCanvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.globalAlpha=1;
  c.fillStyle='#20070d';c.fillRect(0,0,w,h);
  if(victoryTime<VICTORY_CONFIG.darken){
    if(victoryFrame){const s=Math.min(w/victoryFrame.width,h/victoryFrame.height);c.drawImage(victoryFrame,(w-victoryFrame.width*s)/2,(h-victoryFrame.height*s)/2,victoryFrame.width*s,victoryFrame.height*s);}
    c.fillStyle='rgba(0,0,0,'+clamp(victoryTime/VICTORY_CONFIG.darken,0,1)+')';c.fillRect(0,0,w,h);
  }else{
    if(victoryImageLoaded){const s=Math.min(w/victoryImage.naturalWidth,h/victoryImage.naturalHeight);c.drawImage(victoryImage,(w-victoryImage.naturalWidth*s)/2,(h-victoryImage.naturalHeight*s)/2,victoryImage.naturalWidth*s,victoryImage.naturalHeight*s);}
    c.fillStyle='rgba(0,0,0,'+(1-clamp((victoryTime-VICTORY_CONFIG.darken)/VICTORY_CONFIG.reveal,0,1))+')';c.fillRect(0,0,w,h);
  }
}
