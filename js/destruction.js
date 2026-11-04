'use strict';
// Геометрия пробоин, разрушение окружения и направления разлёта обломков.
// Принимает данные поля из world.js. При попадании использует parts/flowTimer,
// burst и rnd/ri/clamp из игры и sfx из audio.js. Урон танкам и оркестрация взрыва
// остаются в боевой логике; damageTerrainFromBlast отвечает только за окружение.
// Файл не запускает обработчики и не изменяет карту при подключении.

function brickRects(c,r) {
  const i=r*COLS+c;
  return masonry(0).filter((b,q)=>brickMask[i]&(1<<q)).map(b=>({x:c*T+b.x,y:r*T+b.y,w:b.w,h:8}));
}

function fenceRects(c,r) {
  const arms=fenceArms[r*COLS+c],x=c*T,y=r*T,rects=[];
  if(arms&ARM_N)rects.push({x:x+13,y,w:6,h:19});
  if(arms&ARM_S)rects.push({x:x+13,y:y+13,w:6,h:19});
  if(arms&ARM_E)rects.push({x:x+13,y:y+13,w:19,h:6});
  if(arms&ARM_W)rects.push({x,y:y+13,w:19,h:6});
  return rects;
}

const tileRects=(c,r,type)=>type===BRICK?brickRects(c,r):type===FENCE?fenceRects(c,r):[{x:c*T,y:r*T,w:T,h:T}];

const breakable=t=>t===BRICK||t===FENCE;

function bulletBlocked(x,y,radius=0) {
  const c=Math.floor(x/T),r=Math.floor(y/T),type=tileAt(c,r);
  if(type===STEEL)return true;
  if(!breakable(type))return false;
  return tileRects(c,r,type).some(b=>Math.hypot(x-clamp(x,b.x,b.x+b.w),y-clamp(y,b.y,b.y+b.h))<=radius);
}

function fragmentBlocked(x,y,radius) {
  if(x-radius<0||y-radius<0||x+radius>W||y+radius>H)return true;
  for(let r=Math.floor((y-radius)/T);r<=Math.floor((y+radius)/T);r++)
    for(let c=Math.floor((x-radius)/T);c<=Math.floor((x+radius)/T);c++) {
      const tile=tileAt(c,r),rects=breakable(tile)||tile===STEEL?tileRects(c,r,tile):[];
      if(rects.some(b=>Math.hypot(x-clamp(x,b.x,b.x+b.w),y-clamp(y,b.y,b.y+b.h))<radius))return true;
    }
  return false;
}

function fragmentEscape(x,y,radius) {
  const rays=[];
  for(let k=0;k<32;k++) {
    const angle=k*Math.PI/16,dx=Math.cos(angle),dy=Math.sin(angle);
    let clearance=0;
    for(let d=2;d<=72;d+=2){if(fragmentBlocked(x+dx*d,y+dy*d,radius))break;clearance=d;}
    rays.push({angle,clearance});
  }
  const best=Math.max(...rays.map(ray=>ray.clearance));
  const choices=rays.filter(ray=>ray.clearance>=Math.max(2,best-2));
  return choices.length?choices[ri(0,choices.length-1)]:{angle:0,clearance:0};
}

function hitBrick(c, r, dmg, hx = c*T+16, hy = r*T+16) {
  const i = r * COLS + c;
  if (grid[i] !== BRICK) return;
  brickShake[i]=.25;
  const previousMask=brickMask[i];
  if (dmg >= 99) { brickHp[i] = 0; brickMask[i] = 0; }
  else {
    const bricks = masonry(0);
    const surviving = bricks.map((b,q)=>({b,q})).filter(({q})=>brickMask[i] & (1<<q));
    surviving.sort((a,b)=>Math.hypot(c*T+a.b.x+a.b.w/2-hx,r*T+a.b.y+4-hy)-Math.hypot(c*T+b.b.x+b.b.w/2-hx,r*T+b.b.y+4-hy)+(((a.q+brickVariant[i])%3)-((b.q+brickVariant[i])%3))*2);
    const count = Math.ceil(surviving.length / brickHp[i]);
    for(const {q} of surviving.slice(0,count)) brickMask[i] &= ~(1<<q);
    brickHp[i]--;
  }
  masonry(0).forEach((b,q)=>{
    if(!(previousMask&(1<<q))||(brickMask[i]&(1<<q)))return;
    // Fragments originate inside the specific bricks removed by this impact.
    for(let row=0;row<2;row++)for(let col=0;col<2;col++){
      const w=b.w/2,h=4,x=c*T+b.x+(col+.5)*w,y=r*T+b.y+(row+.5)*h;
      const escape=fragmentEscape(x,y,Math.min(w,h)*.35),angle=escape.angle;
      const speed=Math.min(rnd(45,135),escape.clearance*2),life=rnd(.9,1.7);
      parts.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life,max:life,w:w-.6,h:h-.5,size:w,rot:0,vr:rnd(-8,8),color:['#b3633a','#a95833','#bd7149'][(q+brickVariant[i])%3],kind:'debris',brickFragment:true});
    }
  });
  burst(hx, hy, 10, ['#b3633a', '#8c4a2b', '#d08a5c'], 120, .4, 4);
  if (brickHp[i] <= 0) {
    grid[i] = EMPTY; flowTimer = 0;
    burst(c*T+16, r*T+16, 14, ['#b3633a', '#8c4a2b'], 160, .6, 5);
  }
  sfx('brick');
}

// Забор ломается с одного попадания и разлетается щепой.
function hitFence(c, r, hx = c*T+16, hy = r*T+16) {
  const i = r * COLS + c;
  if (grid[i] !== FENCE) return;
  for (const b of fenceRects(c, r)) for (let k = 0; k < 4; k++) {
    const x = b.x + rnd(0, b.w), y = b.y + rnd(0, b.h), a = Math.atan2(y - hy, x - hx) + rnd(-.8, .8), s = rnd(60, 170), life = rnd(.7, 1.3);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, w: rnd(5, 9), h: 2, size: 6, rot: rnd(0, 6), vr: rnd(-10, 10), color: ['#8a6338', '#a57a46', '#6f4d2b'][k % 3], kind: 'debris' });
  }
  burst(hx, hy, 8, ['#c49a62', '#8a6338'], 110, .35, 3);
  grid[i] = EMPTY; fenceArms[i] = 0; flowTimer = 0;
  sfx('fence');
}

const LEAF_BLOBS=[[-6,-5,12],[7,-4,11],[-4,7,11],[7,7,10],[0,0,12]];

function hitFoliage(c,r,x,y,projectile) {
  const i=r*COLS+c;
  if(grid[i]!==TREE)return;
  if(projectile) { if(!projectile.leaves)projectile.leaves=new Set(); if(projectile.leaves.has(i))return; projectile.leaves.add(i); }
  const choices=LEAF_BLOBS.map((b,q)=>({b,q})).filter(({q})=>foliageMask[i]&(1<<q));
  choices.sort((a,b)=>Math.hypot(c*T+16+a.b[0]-x,r*T+16+a.b[1]-y)-Math.hypot(c*T+16+b.b[0]-x,r*T+16+b.b[1]-y));
  if(choices.length)foliageMask[i]&=~(1<<choices[0].q);
  foliageShake[i]=.45;
  if(Math.random()<.09){const count=ri(3,5),white=ri(1,2);for(let k=0;k<count;k++)parts.push({x,y,vx:rnd(-100,100),vy:rnd(-150,-80),life:1.4,max:1.4,kind:'bird',color:k<white?'#f0f0e5':'#1c2927',phase:rnd(0,6)});}
  burst(x,y,12,['#6fa447','#9cba52','#355d2e'],110,.65,3,'leaf');sfx('leaves');
  if(!foliageMask[i])grid[i]=EMPTY;
}

// Варианты кладки; повреждение удаляет целые кирпичи по швам.
function masonry(variant) {
  const bricks=[], offset=[8,6,11][variant];
  for(let row=0;row<4;row++) {
    const cuts=row%2?[0,offset,offset+16,32]:[0,16,32];
    for(let j=0;j<cuts.length-1;j++) bricks.push({x:cuts[j],y:row*8,w:cuts[j+1]-cuts[j]});
  }
  return bricks;
}

function damageTerrainFromBlast(x,y,radius,damage) {
  for(let r=Math.max(0,Math.floor((y-radius*2)/T));r<=Math.min(ROWS-1,Math.floor((y+radius*2)/T));r++)
    for(let c=Math.max(0,Math.floor((x-radius*2)/T));c<=Math.min(COLS-1,Math.floor((x+radius*2)/T));c++) {
      const hx=clamp(x,c*T,(c+1)*T),hy=clamp(y,r*T,(r+1)*T);
      const distance=Math.hypot(x-hx,y-hy),t=grid[r*COLS+c];
      if(t===TREE&&distance<=radius*2)hitFoliage(c,r,hx,hy,{});
      else if(distance<=radius){if(t===BRICK){for(let n=0;n<damage;n++)hitBrick(c,r,1,hx,hy);}else if(t===FENCE)hitFence(c,r,hx,hy);}
    }
}
