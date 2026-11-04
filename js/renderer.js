'use strict';
// Общие примитивы Canvas, бонусы, снаряды и сборка кадра в исходном порядке слоёв.
// Вызывает render-world/render-tanks/effects/render-ui; ctx и состояние принадлежат игре.
// Обычные относительные скрипты сохраняют запуск открытием index.html.
// Здесь только определения функций: Canvas и цикл не создаются при подключении.

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function roundedPolygon(c,points,amount) {
  points.forEach(([x,y],i)=>{
    const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
    const ax=x+(prev[0]-x)*amount,ay=y+(prev[1]-y)*amount,bx=x+(next[0]-x)*amount,by=y+(next[1]-y)*amount;
    if(!i)c.moveTo(ax,ay);else c.lineTo(ax,ay);
    c.quadraticCurveTo(x,y,bx,by);
  });c.closePath();
}

function drawItems() {
  for (const it of items) {
    if (it.life < 3 && Math.floor(time * 8) % 2) continue;
    const I = ITEMS[it.type], y = it.y + Math.sin(time * 4 + it.x) * 3;
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(it.x, it.y + 12, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2226'; roundRect(ctx, it.x - 12, y - 12, 24, 24, 6); ctx.fill();
    ctx.strokeStyle = I.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = I.color; ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(I.glyph, it.x, y + 1);
  }
}

function drawBullets() {
  for (const b of bullets) {
    if(b.armor && b.trail && b.trail.length){ctx.strokeStyle='#ffe4a7aa';ctx.lineWidth=2;ctx.beginPath();b.trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(b.x,b.y);ctx.stroke();}
    ctx.strokeStyle = b.owner === 'p' ? 'rgba(200,255,170,.35)' : 'rgba(255,170,140,.35)';
    ctx.lineWidth = b.r * 1.4;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .025, b.y - b.vy * .025); ctx.stroke();
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));
    const width=b.r, length=b.armor?12:10;
    ctx.fillStyle=b.armor?'#ffce78':b.owner==='p'?'#cfe4ba':'#d8b5a1';
    ctx.beginPath();ctx.moveTo(length*.6,0);ctx.quadraticCurveTo(length*.2,-width,-length*.55,-width);ctx.lineTo(-length*.55,width);ctx.quadraticCurveTo(length*.2,width,length*.6,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#645543';ctx.fillRect(-length*.55,-width,2,width*2);
    ctx.strokeStyle='#fff3c3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-length*.3,-width*.4);ctx.lineTo(length*.25,-width*.25);ctx.stroke();ctx.restore();
  }
}

function draw() {
  ctx.save();
  const sk = shake * CFG.shake * .5;
  if (sk > 0) ctx.translate(rnd(-sk, sk), rnd(-sk, sk));
  ctx.drawImage(groundCanvas, 0, 0);
  drawTiles();
  if(state!=='menu')drawBase();
  if (state !== 'menu') {
    drawWrecks();
    drawItems();
    for (const e of enemies) drawTank(e);
    if (player && !player.dead) drawTank(player);
    drawBullets();drawArtilleryShells();
    drawRails();
    drawParts();
  }
  drawTrees();
  ctx.restore();

  ctx.save();
  ctx.scale(W / UI_W, H / UI_H);
  drawUI();
  ctx.restore();
}

function drawArtilleryShells(){
  for(const shell of artilleryShells){
    const pulse=.5+.5*Math.sin(time*7),p=clamp((shell.age-shell.delay)/shell.duration,0,1);
    ctx.save();ctx.fillStyle=`rgba(255,208,45,${.07+pulse*.1})`;ctx.strokeStyle=`rgba(255,218,65,${.5+pulse*.5})`;ctx.lineWidth=2;ctx.setLineDash([6,4]);
    ctx.beginPath();ctx.arc(shell.tx,shell.ty,shell.radius,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(shell.tx-8,shell.ty);ctx.lineTo(shell.tx+8,shell.ty);ctx.moveTo(shell.tx,shell.ty-8);ctx.lineTo(shell.tx,shell.ty+8);ctx.stroke();
    if(shell.pending||shell.age<shell.delay){ctx.restore();continue;}
    const x=shell.sx+shell.dx*p,y=shell.sy+shell.dy*p-Math.sin(p*Math.PI)*65;
    ctx.fillStyle='rgba(235,45,35,0.2)';ctx.beginPath();ctx.arc(x,y,10+pulse*5,0,Math.PI*2);ctx.fill();
    ctx.translate(x,y);ctx.rotate(shell.angle);ctx.fillStyle='#d8b5a1';
    ctx.beginPath();ctx.moveTo(6,0);ctx.quadraticCurveTo(2,-3,-5.5,-3);ctx.lineTo(-5.5,3);ctx.quadraticCurveTo(2,3,6,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#645543';ctx.fillRect(-5.5,-3,2,6);ctx.strokeStyle='#fff3c3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-3,-1.2);ctx.lineTo(2.5,-.75);ctx.stroke();ctx.restore();
  }
}
