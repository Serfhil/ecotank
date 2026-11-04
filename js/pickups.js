'use strict';
// Бонусы: доступность, подбор, случайное появление и сбор оставшегося металлолома.
// Использует состояние player/items/wrecks/scrap, конфигурацию, геометрию мира,
// функции улучшения танка и артподготовки. Таймер обновляется вызовом из игрового
// цикла; при подключении нет генерации бонусов или обработчиков событий.

function availableItemTypes(){return Object.keys(ITEMS).filter(k=>k!=='upgrade'||!player||player.upgrade<2);}

function updateItems(dt) {
  for (const it of items) {
    it.life -= dt;
    if (player && !player.dead && !(player.upgradeT>0) && Math.hypot(player.x - it.x, player.y - it.y) < 24) {
      it.life = 0;
      if (it.type === 'repair') player.hp = Math.min(player.maxHp, player.hp + CFG.repairAmount);
      else if(it.type==='upgrade')beginPlayerUpgrade(player);
      else if(it.type==='barrage')callBarrage();
      else if (it.type === 'rail') player.rail = Math.min(CFG.railMax, player.rail + 1);
      else player.pw[it.type] = CFG.powerupTime;
      floatText(it.x, it.y - 12, ITEMS[it.type].name, ITEMS[it.type].color);
      sfx('pick');
    }
  }
  items = items.filter(it => it.life > 0);
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
