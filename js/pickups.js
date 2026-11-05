'use strict';
// Бонусы: доступность, подбор, случайное появление и сбор оставшегося металлолома.
// Использует состояние player/items/wrecks/scrap, конфигурацию, геометрию мира,
// функции улучшения танка и артподготовки. Таймер обновляется вызовом из игрового
// цикла; при подключении нет генерации бонусов или обработчиков событий.

function availableItemTypes(){return Object.keys(ITEMS).filter(k=>k!=='upgrade'||!player||player.upgrade<2);}

function itemUseful(t,it) {
  if(!t||t.dead||t.upgradeT>0||it.life<=0)return false;
  if(it.type==='repair')return t.hp<t.maxHp;
  if(it.type==='upgrade')return t.upgrade<2;
  if(it.type==='rail')return t.rail<CFG.railMax;
  if(it.type==='barrage')return true;
  return it.type in t.pw && t.pw[it.type]<CFG.powerupTime;
}
function applyItem(t,it) {
  if(!itemUseful(t,it))return false;
  if(it.type==='repair')t.hp=Math.min(t.maxHp,t.hp+CFG.repairAmount);
  else if(it.type==='upgrade')beginPlayerUpgrade(t);
  else if(it.type==='barrage')callBarrage();
  else if(it.type==='rail')t.rail=Math.min(CFG.railMax,t.rail+1);
  else t.pw[it.type]=CFG.powerupTime;
  it.life=0;floatText(it.x,it.y-12,ITEMS[it.type].name,ITEMS[it.type].color);sfx('pick');return true;
}
function updateItems(dt) {
  const recipients=[player,...allies];
  for(const it of items){it.life-=dt;if(it.life<=0)continue;
    for(const t of recipients)if(t&&Math.hypot(t.x-it.x,t.y-it.y)<24&&applyItem(t,it))break;
  }
  items=items.filter(it=>it.life>0);
}

function collectRemainingScrap() {
  let collected=0;
  for(const w of wrecks)if(!w.taken && w.kind!=='player'){collected+=KINDS[w.kind].scrap;w.taken=true;}
  scrap+=collected;
  return collected;
}

function updateRandomItems(dt){
  if(state!=='play'||!player||player.dead||base&&base.dead)return;
  itemSpawnTimer-=dt;if(itemSpawnTimer>0)return;itemSpawnTimer+=10;
  const candidates=[];for(let r=2;r<ROWS-2;r++)for(let c=1;c<COLS-1;c++)if(!blocksTank(tileAt(c,r))) {
    const x=c*T+16,y=r*T+16;if((!base||Math.hypot(x-base.x,y-base.y)>50)&&!items.some(it=>Math.hypot(x-it.x,y-it.y)<30))candidates.push({x,y});
  }
  if(candidates.length){const spot=candidates[ri(0,candidates.length-1)],types=availableItemTypes();items.push({...spot,type:types[ri(0,types.length-1)],life:24});}
}
