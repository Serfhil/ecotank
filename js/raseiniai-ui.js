'use strict';

const RASEINIAI_ARTICLE_TITLE = 'ТАНКИСТЫ ПРИКРЫЛИ ЭВАКУАЦИЮ ПОД РАСЕЙНЯЕМ';
const RASEINIAI_ARTICLE = [
  'После артиллерийского обстрела немецкие танки двинулись к развилке близ Расейняя. По южной дороге в это время вывозили жителей окрестных деревень. По словам очевидцев, у развилки занял позицию тяжёлый советский танк. Он подпустил головные машины противника и открыл огонь. Следовавшая за ними колонна остановилась.',
  'Противник несколько раз возобновлял атаку. Когда немецкие мотоциклисты попытались обойти развилку по просёлкам, танк сменил позицию. Как рассказали жители, пока у крайних домов шёл бой, по южной дороге один за другим уходили грузовики. Те, кому не хватило места в машинах, покидали деревню пешком.',
  'Противник потерял несколько машин и продолжал подтягивать резервы. По свидетельству эвакуированных жителей, советский танк оставался у развилки, пока из деревни не вышел последний грузовик. По завершении эвакуации командование приказало частям отойти на новый рубеж, чтобы сохранить людей и технику. Имена танкистов редакции пока неизвестны.',
];
const RASEINIAI_CAPTION = 'Тяжёлый советский танк у развилки под Расейняем. Рисунок художника „Правды“ по рассказам очевидцев.';

function drawRaseiniaiMill() {
  if (!raseiniai) return;
  const {c,r,size}=RASEINIAI_MILL;
  if (raseiniaiMill && raseiniaiMill.naturalWidth) ctx.drawImage(raseiniaiMill,c*T,r*T,size*T,size*T);
  else {
    ctx.fillStyle='#62564b';
    for (const b of raseiniai.millOutline) ctx.fillRect(b.x,b.y,b.w,b.h);
  }
}

function drawRaseiniaiEvacuation() {
  if (!raseiniai) return;
  for (const unit of raseiniai.evac) {
    if (unit.delay>0) continue;
    ctx.save(); ctx.translate(unit.x,unit.y);
    if (unit.x!==unit.turnX) ctx.rotate(unit.x<unit.turnX?-Math.PI/2:Math.PI/2);
    if (unit.truck) {
      ctx.fillStyle='#23211b'; ctx.fillRect(-11,-17,22,32);
      ctx.fillStyle='#776948'; ctx.fillRect(-9,-17,18,21);
      ctx.fillStyle='#536043'; ctx.fillRect(-8,4,16,13);
      ctx.fillStyle='#b1b9a0'; ctx.fillRect(-7,10,14,3);
      ctx.fillStyle='#f4c975'; ctx.fillRect(-8,16,3,2); ctx.fillRect(5,16,3,2);
    } else {
      const stride = Math.sin(unit.step)*5;
      ctx.fillStyle='#302525'; ctx.fillRect(-3,stride,2,6); ctx.fillRect(1,-stride,2,6);
      ctx.fillStyle=unit.coat; ctx.fillRect(-4,-5,8,8);
      ctx.fillStyle='#dcb28d'; ctx.fillRect(-2,-7,4,4);
    }
    ctx.restore();
  }
}

function raseiniaiLossTable(revised = null) {
  const labels=['Убитыми','Пропавшими без вести','Потеряно танков'];
  const head=revised?`<thead><tr><th scope="col">Категория</th><th scope="col">Исходные оценки</th><th scope="col" class="storyRevision">Изменённая хронология</th></tr></thead>`:'';
  return `<table class="storyLosses">${head}<tbody>${RASEINIAI_ESTIMATES.map((value,i)=>
    `<tr><th scope="row">${labels[i]}</th><td>${revised?`<span class="storyStrike" style="--strike-delay:${.85+i*.45}s">${value}</span>`:value}</td>${revised?`<td class="storyRevision">${revised[i]}</td>`:''}</tr>`
  ).join('')}</tbody></table>`;
}

function raseiniaiLosses(revised = null) {
  return `<h2>Потери СССР <span${revised?' class="storyStrike"':''}>(исторические данные, приближенные)</span></h2>
    ${raseiniaiLossTable(revised)}`;
}

function raseiniaiOpeningTitle() {
  return `<div class="storyFull storyTitle"><div class="storySheet">
    <h1>${RASEINIAI_TITLE}</h1><p class="storySubtitle">Приграничные танковые бои. Июнь 1941</p>
    <div class="storyTitleLosses">${raseiniaiLosses()}</div>
  </div></div>`;
}

function raseiniaiNewspaper() {
  return `<div class="storyNewspaper">
    <figure class="storyPaper">
      <img src="${RASEINIAI_ASSETS}pravda.png" alt="Макет газеты «Правда» с иллюстрацией тяжёлого танка">
      <article><h1>${RASEINIAI_ARTICLE_TITLE}</h1><p><em>От специального корреспондента. Северо-Западный фронт, июнь 1941 года.</em></p>
        ${RASEINIAI_ARTICLE.map(line=>`<p>${line}</p>`).join('')}
      </article>
      <figcaption>${RASEINIAI_CAPTION}</figcaption>
    </figure>
    <button data-raseiniai="continue">Продолжить</button>
  </div>`;
}

function raseiniaiTimeline() {
  const n=raseiniai.breaches, stats=snapshotStatistics();
  const destroyed=[
    ['scout','Танки',stats.enemies.scout+stats.enemies.soldier+stats.enemies.heavy],
    ['moto','Мотобригады',stats.enemies.moto], ['brick','Кирпичные блоки',stats.bricks], ['fence','Заборы',stats.fences],
  ];
  return `<div class="storyFull storyTimeline"><div class="storySheet"><h1>${RASEINIAI_TITLE}</h1><p class="storySubtitle">${RASEINIAI_SUBTITLE}</p>
    ${raseiniaiLosses(raseiniaiResults(n))}
    <h2>Уничтожено</h2>
    <ul class="storyDestroyed">${destroyed.map(([kind,label,count])=>
      `<li><canvas data-story-model="${kind}" width="64" height="64" aria-hidden="true"></canvas><span>${label}</span><strong>${count}</strong></li>`
    ).join('')}</ul>
    <p>Пропущено машин — ${n}. ${n===0?'Непревзойденный уровень.':'Потери могли быть меньше.'}</p>
    <button data-raseiniai="continue" aria-label="Продолжить, пробел">Пробел</button>
  </div></div>`;
}

function drawRaseiniaiStatModels() {
  for (const canvas of raseiniaiScreen.querySelectorAll('[data-story-model]')) {
    const c=canvas.getContext('2d'), kind=canvas.dataset.storyModel;
    c.save(); c.translate(32,32);
    if (kind==='brick') {
      for(const b of MASONRY) detailBrick(c,b.x-16,b.y-16,b.w,0,4);
    } else if (kind==='fence') {
      paintFence(c,-16,-16,FENCE_H,[{x:-16,y:-3,w:32,h:6}]);
    } else {
      drawPlayerModel({kind,x:0,y:4,angle:-Math.PI/2,turret:-Math.PI/2,tread:0,recoil:0,flash:0,dead:true},c);
    }
    c.restore();
  }
}

function syncRaseiniaiUI() {
  if (!raseiniaiScreen) return;
  raseiniaiScreen.hidden = !raseiniai || state !== 'story';
  if (raseiniaiScreen.hidden) return;
  const s = raseiniai, d = s.dialogue;
  if (s.dirty) {
    s.dirty = false;
    if (d) {
      const side = d.kind==='german'?'left':'right';
      const asset = d.kind==='civilian'?'civilian':d.kind==='german'?'german-radio':'soviet-radio';
      raseiniaiScreen.innerHTML = `<div class="storyDialogue storyDialogue--${side} storyDialogue--${d.kind}">
        <img src="${RASEINIAI_ASSETS}${asset}.png" alt="">
        <div class="storySpeech"><div class="storySpeechLines"><p data-story-line${d.kind==='german'?' lang="de"':''}></p><p data-story-translation hidden></p></div><button data-raseiniai="continue" aria-label="Продолжить реплику">Пробел</button></div></div>`;
    } else if (s.phase==='title') raseiniaiScreen.innerHTML = raseiniaiOpeningTitle();
    else if (s.phase==='victory') raseiniaiScreen.innerHTML = '<div class="storyFull storyVictory"><h1>ПОБЕДА</h1></div>';
    else if (s.phase==='newspaper') raseiniaiScreen.innerHTML = raseiniaiNewspaper();
    else if (s.phase==='timeline') {
      raseiniaiScreen.innerHTML = raseiniaiTimeline();
      drawRaseiniaiStatModels();
    } else if (s.phase==='farewell') {
      raseiniaiScreen.innerHTML = `<div class="storyFull storyFarewell"><div class="storySheet">
        <h1>Пока все, ребятки! ТАРИ ДОБАВЬ УЖЕ ОВЕРКУКЕД, БЛЕАТЬ!!!</h1>
        <button data-raseiniai="home">${UI_TEXT.menuHome}</button></div>
        <img class="storyFarewellCharacter" src="${RASEINIAI_ASSETS}farewell-character.png" alt=""></div>`;
    }
    else raseiniaiScreen.innerHTML = '';
  }
  if (d) {
    const [line,translation] = d.lines[d.index];
    const target = raseiniaiScreen.querySelector('[data-story-line]');
    const translated = raseiniaiScreen.querySelector('[data-story-translation]');
    const visible = d.complete ? line : line.slice(0,d.shown);
    if (target && target.textContent!==visible) target.textContent=visible;
    if (s.phase==='orders') {
      const button=raseiniaiScreen.querySelector('[data-raseiniai="continue"]');
      const confirmation=d.complete && d.index===d.lines.length-1;
      const label=confirmation?'Есть, держаться до окончания эвакуации!':'Пробел';
      if (button && button.textContent!==label) {
        button.textContent=label;
        button.setAttribute('aria-label',confirmation?label:'Продолжить реплику');
      }
    }
    if (translated && translation && d.complete && !d.translationWait && translated.hidden) {
      translated.textContent=translation;
      translated.hidden=false;
      target.classList.add('storySpeechOriginal');
      target.setAttribute('aria-hidden','true');
    }
  }
}
