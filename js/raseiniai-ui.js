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
    if (unit.truck) {
      if (unit.x!==unit.turnX) ctx.rotate(unit.x<unit.turnX?-Math.PI/2:Math.PI/2);
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

function raseiniaiLossTable(values, strike = false) {
  const labels=['Убитыми','Пропавшими без вести','Потеряно танков'];
  return `<table class="storyLosses"><tbody>${values.map((value,i)=>{
    const cell=strike?`<span class="storyOld" style="--strike:${1+i*.45}s">${value}</span>`:value;
    return `<tr><th scope="row">${labels[i]}</th><td>${cell}</td></tr>`;
  }).join('')}</tbody></table>`;
}

function raseiniaiSummary() {
  return `<h1>${RASEINIAI_TITLE}</h1><p class="storySubtitle">${RASEINIAI_SUBTITLE}</p>
    <h2>Потери СССР <span class="storyOld">(исторические данные, приблизительные)</span></h2>
    ${raseiniaiLossTable(RASEINIAI_ESTIMATES,true)}
    <p class="storyCaveat">Рабочие оценки для игры. Диапазоны людских потерь для этого сражения не проверены.</p>`;
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
  const n = raseiniai.breaches;
  return `<div class="storyFull storyTimeline"><div class="storySheet">${raseiniaiSummary()}
    <div class="storyRevised"><h2>Потери СССР (изменённая хронология)</h2>
      ${raseiniaiLossTable(raseiniaiResults(n))}
      <p>Пропущено машин — ${n}. Потери могли быть меньше.</p>
      <p>Пока всё, но ждите продолжения</p><button data-raseiniai="home">${UI_TEXT.menuHome}</button>
    </div></div></div>`;
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
        <div class="storySpeech"><p data-story-line></p><button data-raseiniai="continue" aria-label="Продолжить реплику">Пробел</button></div></div>`;
    } else if (s.phase==='title') raseiniaiScreen.innerHTML = '<div class="storyFull storyTitle"><div class="storySheet">'+raseiniaiSummary()+'</div></div>';
    else if (s.phase==='victory') raseiniaiScreen.innerHTML = '<div class="storyFull storyVictory"><h1>ПОБЕДА</h1></div>';
    else if (s.phase==='newspaper') raseiniaiScreen.innerHTML = raseiniaiNewspaper();
    else if (s.phase==='timeline') raseiniaiScreen.innerHTML = raseiniaiTimeline();
    else raseiniaiScreen.innerHTML = '';
  }
  if (d) {
    const [line,translation] = d.lines[d.index];
    const target = raseiniaiScreen.querySelector('[data-story-line]');
    const visible = d.complete ? translation || line : line.slice(0,d.shown);
    if (target && target.textContent!==visible) target.textContent=visible;
  }
}
