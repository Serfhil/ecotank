'use strict';
// Отрисовка окружения: клетки, база, кладка, заборы, вода и листва.
// Читает данные world/destruction.js и общее состояние base/time; рисует через ctx.
// Изменение коллизий и разрушение остаются в destruction.js. Подключение не рисует кадр.

function drawBase() {
  if(!base)return;
  ctx.save();ctx.translate(base.x,base.y);
  ctx.fillStyle=base.dead?'#38332c':'#a52e25';ctx.fillRect(-16,-16,32,32);
  ctx.strokeStyle='#e5b75d';ctx.lineWidth=2;ctx.strokeRect(-15,-15,30,30);
  if(!base.dead) {
    ctx.save();ctx.scale(.058,.058);ctx.translate(-220,-220);ctx.fillStyle='#ffdc65';
    ctx.beginPath();ctx.moveTo(155,54);ctx.bezierCurveTo(320,20,460,172,383,306);ctx.bezierCurveTo(312,423,154,413,95,328);ctx.lineTo(114,302);ctx.bezierCurveTo(193,378,300,355,345,264);ctx.bezierCurveTo(395,158,274,55,155,54);ctx.fill();
    ctx.beginPath();ctx.moveTo(167,98);ctx.lineTo(230,101);ctx.lineTo(244,116);ctx.lineTo(198,162);ctx.lineTo(396,363);ctx.quadraticCurveTo(406,378,391,391);ctx.quadraticCurveTo(377,405,362,391);ctx.lineTo(174,190);ctx.lineTo(128,226);ctx.lineTo(79,180);ctx.closePath();ctx.fill();
    ctx.lineWidth=35;ctx.lineCap='round';ctx.strokeStyle='#ffdc65';ctx.beginPath();ctx.moveTo(113,304);ctx.lineTo(59,371);ctx.stroke();ctx.restore();
  } else {ctx.strokeStyle='#111';ctx.beginPath();ctx.moveTo(-12,-10);ctx.lineTo(10,12);ctx.moveTo(11,-11);ctx.lineTo(-9,10);ctx.stroke();}
  for(let i=0;i<5;i++){ctx.fillStyle=i<base.hp?'#ffcf60':'#382e28';ctx.fillRect(-15+i*6,-23,5,4);}
  ctx.restore();
}

function tileHash(c, r) { let h = (c * 73856093) ^ (r * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return (h >>> 0) / 4294967296; }

function drawTiles() {
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = grid[r * COLS + c];
    if (t === STEEL) for(const b of steelRects(c,r))ctx.fillRect(b.x+4,b.y+4,b.w,b.h);
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const t = grid[r * COLS + c], x = c * T, y = r * T;
    if (t === BRICK) drawBrick(x, y, brickHp[r * COLS + c], brickMask[r * COLS + c], brickVariant[r * COLS + c]);
    else if (t === FENCE) drawFence(c, r);
    else if (t === STEEL) drawSteel(x, y);
    else if (t === WATER) drawWater(x, y, c, r);
  }
}

function drawBrick(x,y,hp,mask,variant) {
  const i=Math.floor(y/T)*COLS+Math.floor(x/T),jolt=brickShake[i]*5;
  ctx.save();ctx.translate(Math.sin(time*65+i)*jolt,Math.cos(time*59+i)*jolt*.5);
  MASONRY.forEach((b,q)=>{
    if(!(mask & (1<<q)))return;
    detailBrick(ctx,x+b.x,y+b.y,b.w,Math.abs(Math.floor((x+b.x)/16)+Math.floor((y+b.y)/8)),hp);
  });
  ctx.restore();
}

function drawFence(c, r) {
  paintFence(ctx,c*T,r*T,fenceArms[r*COLS+c],fenceRects(c,r));
}

function paintFence(ctx,x,y,arms,rects) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  for (const b of rects) ctx.fillRect(b.x + 2, b.y + 3, b.w, b.h);
  for (const b of rects) {
    ctx.fillStyle = '#5a3d22'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#a57a46'; ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = '#c49a62'; b.w > b.h ? ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 1) : ctx.fillRect(b.x + 1, b.y + 1, 1, b.h - 2);
  }
  const posts = [[16, 16]];
  if (arms & ARM_N) posts.push([16, 3]); if (arms & ARM_S) posts.push([16, 29]);
  if (arms & ARM_E) posts.push([29, 16]); if (arms & ARM_W) posts.push([3, 16]);
  for (const [px, py] of posts) {
    ctx.fillStyle = '#3f2a17'; ctx.fillRect(x + px - 4, y + py - 4, 8, 8);
    ctx.fillStyle = '#7a5531'; ctx.fillRect(x + px - 3, y + py - 3, 6, 6);
    ctx.fillStyle = '#5a3d22'; ctx.fillRect(x + px - 1, y + py - 1, 2, 2);
  }
}

function drawSteel(x, y) {
  ctx.save();ctx.beginPath();for(const b of steelRects(Math.floor(x/T),Math.floor(y/T)))ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
  ctx.fillStyle = '#6f7b85'; ctx.fillRect(x, y, T, T);
  ctx.fillStyle = '#9aa6af'; ctx.fillRect(x + 3, y + 3, T - 6, T - 6);
  ctx.fillStyle = '#b9c3ca'; ctx.fillRect(x + 3, y + 3, T - 6, 3);
  ctx.fillStyle = '#5b666f';
  for (const [ox, oy] of [[7, 7], [25, 7], [7, 25], [25, 25]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 2, 0, Math.PI * 2); ctx.fill(); }
  drawSteelBurn(Math.floor(x/T),Math.floor(y/T));
  ctx.restore();
}

// Оплавленный край прорези (destruction.js, heatSteelEdge): у прорези жёлтый, глубже в металл красный;
// за STEEL_BURN.cool секунд времени симуляции темнеет до черноты. Остывшая клетка рисуется из кэша.
const BURN_HOT=[[255,232,110],[255,146,40],[205,52,26]],BURN_COLD=[[16,13,12],[32,28,27],[56,54,56]];
function paintSteelBurn(g,b,x0,y0) {
  for(let k=0;k<b.idx.length;k++){
    const p=b.idx[k],h=BURN_HOT[b.depth[k]-1],cold=BURN_COLD[b.depth[k]-1];
    const t=clamp((simTime-b.heat[k])/STEEL_BURN.cool,0,1),e=t*t*(3-2*t);
    g.fillStyle=`rgb(${h[0]+(cold[0]-h[0])*e|0},${h[1]+(cold[1]-h[1])*e|0},${h[2]+(cold[2]-h[2])*e|0})`;
    g.fillRect(x0+p%T,y0+((p/T)|0),1,1);
  }
}
function drawSteelBurn(c,r) {
  const d=steelDamage.get(r*COLS+c),b=d&&d.burn;
  if(!b||!b.idx.length)return;
  if(simTime<b.hotUntil){paintSteelBurn(ctx,b,c*T,r*T);return;}
  if(!b.cache){const canvas=document.createElement('canvas');canvas.width=canvas.height=T;paintSteelBurn(canvas.getContext('2d'),b,0,0);b.cache=canvas;}
  ctx.drawImage(b.cache,c*T,r*T);
}

function drawWater(x,y,c,r) { detailWater(ctx,x,y,c); }

function drawTrees() {
  for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++) {
    const i=r*COLS+c;if(grid[i]!==TREE)continue;
    const x=c*T+16,y=r*T+16,shake=foliageShake[i]*7;
    const sway=Math.sin(time*1.5+tileHash(c,r)*10)+Math.sin(time*42+i)*shake;
    LEAF_BLOBS.forEach(([ox,oy,rr],q)=>{
      if(!(foliageMask[i]&(1<<q)))return;
      ctx.fillStyle='#13291155';ctx.beginPath();ctx.arc(x+ox+3,y+oy+4,rr,0,Math.PI*2);ctx.fill();
      detailLeaf(ctx,x+ox+sway,y+oy,rr,Math.floor(tileHash(c+q,r)*4));
    });
  }
}
