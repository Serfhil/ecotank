'use strict';
// Интерфейс редактора карт, рисование, штампы и импорт/экспорт.
// Данные и проверка проходимости — world.js; общие функции — editor-common.js.
// Игра вызывает initMapEditor() после создания DOM. Повторная инициализация инертна.
// renderMapPick() также заполняет выбор карты в меню; toMenu()/saveDev() остаются в игре.

// ---------- редактор карт ----------
// mapEd — открытая карта: { id: null у новой/копии, name, cols, cells: [[символ]] }
let mapEdOpen = false, mapEd = null, mapBrush = 'B', mapPaint = null, mapMirror = false, mapEdMsg = '';
// штамп — пресет из любого пака, который ставится на карту кликом: { pack, i, turns, flip }; mapHover — клетка под курсором
let mapStamp = null, mapHover = null;
let mapEditorEl = null, mapEditorPanel = null;
const MAP_BRUSHES = BRUSHES.filter(([ch]) => ch !== ' ').map(([ch, label]) => [ch, ch === '.' ? UI_TEXT.pusto : label]);
const MAP_COLORS = { '.': '#56693f', B: '#b3633a', b: '#b3633a', D: '#56693f', F: '#56693f', S: '#9aa6af', W: '#2c6d96', T: '#56693f', t: '#56693f', L: '#56693f', P: '#b59e64', R: '#7d7f7a' };
const blankMapRows = cols => Array.from({ length: cols * 2 / 3 }, () => '.'.repeat(cols));
// рисует карту по клеткам размером cs; marks — показать базу, точки появления врагов и запретные зоны
// alpha < 1 — полупрозрачное превью штампа; пробел («не трогать») не рисуется
function drawMapCells(g, rows, cs, marks, alpha = 1) {
  const cols = rows[0].length, h = rows.length, center = Math.floor(cols / 2), at = (c, r) => rows[r]?.[c];
  for (let r = 0; r < h; r++) for (let c = 0; c < cols; c++) {
    const ch = rows[r][c], x = c * cs, y = r * cs;
    if (ch === ' ') continue;
    g.globalAlpha = alpha;
    g.fillStyle = MAP_COLORS[ch]; g.fillRect(x, y, cs, cs);
    g.globalAlpha = (ch === 'b' || ch === 't' ? .5 : 1) * alpha;
    if (ch === 'B' || ch === 'b') { g.fillStyle = '#402b21'; g.fillRect(x, y + cs / 2, cs, Math.max(1, cs / 12)); g.fillRect(x, y, cs, Math.max(1, cs / 12)); }
    // разрушенный на 75% кирпич: остаётся нижний левый угол кладки, как маска DAMAGED_BRICK_MASK в игре
    else if (ch === 'D') { g.fillStyle = '#b3633a'; g.fillRect(x, y + cs / 2, cs / 2, cs / 4); g.fillRect(x, y + cs * .75, cs * .75, cs / 4); g.fillStyle = '#402b21'; g.fillRect(x, y + cs / 2, cs / 2, Math.max(1, cs / 12)); g.fillRect(x + cs / 4, y + cs * .75, Math.max(1, cs / 12), cs / 4); }
    else if (ch === 'R') { g.fillStyle = '#5a5c58'; const n = cs >= 12 ? 4 : 2, st = cs / n; for (let k = 0; k < n; k++) { g.fillRect(x, y + k * st, cs, Math.max(1, cs / 16)); g.fillRect(x + (k % 2 ? st / 2 : 0) + st / 2, y + k * st, Math.max(1, cs / 16), st); } }
    else if (ch === 'L') { g.fillStyle = '#3f8a3a'; g.beginPath(); g.arc(x + cs / 2, y + cs / 2, cs * .2, 0, Math.PI * 2); g.fill(); }
    else if (ch === 'S') { g.fillStyle = '#6f7b85'; g.fillRect(x, y, cs, cs); g.fillStyle = '#b9c3ca'; g.fillRect(x + cs * .18, y + cs * .18, cs * .64, cs * .64); }
    else if (ch === 'T' || ch === 't') { g.fillStyle = '#3f8a3a'; g.beginPath(); g.arc(x + cs / 2, y + cs / 2, cs * .42, 0, Math.PI * 2); g.fill(); }
    else if (ch === 'F') {
      // как в игре: перекладина тянется к соседним заборам, одиночный — горизонтальный
      const n = at(c, r - 1) === 'F', s = at(c, r + 1) === 'F', e = at(c + 1, r) === 'F', w = at(c - 1, r) === 'F', t = Math.max(1, cs * .2), m = cs / 2;
      g.fillStyle = '#a57a46';
      if (n) g.fillRect(x + m - t / 2, y, t, m); if (s) g.fillRect(x + m - t / 2, y + m, t, m);
      if (e || !(n || s)) g.fillRect(x + m, y + m - t / 2, m, t); if (w || !(n || s)) g.fillRect(x, y + m - t / 2, m, t);
    }
    g.globalAlpha = 1;
  }
  if (!marks) return;
  for (let r = 0; r < h; r++) for (let c = 0; c < cols; c++) if (reservedCell(cols, c, r)) {
    g.fillStyle = r <= 2 ? 'rgba(229,72,77,.38)' : 'rgba(255,208,90,.22)'; g.fillRect(c * cs, r * cs, cs, cs);
  }
  // кирпичные стены базы, сама база, точка старта игрока и точки появления врагов
  for (const [c, r] of [[center - 1, h - 2], [center, h - 2], [center + 1, h - 2], [center - 1, h - 1], [center + 1, h - 1]]) { g.fillStyle = '#b3633a'; g.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2); }
  g.fillStyle = '#ffd05a'; g.fillRect(center * cs + cs * .15, (h - 1) * cs + cs * .15, cs * .7, cs * .7);
  g.fillStyle = '#7be38a'; g.beginPath(); g.arc((center - 3) * cs + cs / 2, (h - 2) * cs + cs / 2, cs * .35, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e5484d';
  for (const c of spawnCols(cols)) { g.beginPath(); g.moveTo(c * cs + cs * .2, cs * 1.2); g.lineTo(c * cs + cs * .8, cs * 1.2); g.lineTo(c * cs + cs / 2, cs * 1.85); g.fill(); }
  if (cs >= 12) { g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1; g.beginPath(); for (let c = 1; c < cols; c++) { g.moveTo(c * cs + .5, 0); g.lineTo(c * cs + .5, h * cs); } for (let r = 1; r < h; r++) { g.moveTo(0, r * cs + .5); g.lineTo(cols * cs, r * cs + .5); } g.stroke(); }
}
const mapCellSize = cols => clamp(Math.floor(Math.min(1120, innerWidth - 80) / cols), 8, 28);
function openMapEditor() { mapEdOpen = true; mapEd = null; mapEdMsg = ''; renderMapEditor(); }
function closeMapEditor() { mapEdOpen = false; mapEd = null; mapPaint = null; renderMapPick(); if (state === 'menu') toMenu(); }
function startMapEdit(map, keep, cols = 30) {
  const rows = map ? map.rows : blankMapRows(cols);
  mapEd = { id: keep ? map.id : null, name: keep ? map.name : map ? map.name + UI_TEXT.kopiya : '', cols: rows[0].length, cells: rows.map(r => [...r]) };
  mapEdMsg = ''; renderMapEditor();
}
// смена размера держит низ и центр на месте — там база
function resizeMapEdit(cols) {
  if (!MAP_SIZES.includes(cols) || cols === mapEd.cols) return;
  const rows = cols * 2 / 3, dx = Math.floor(cols / 2) - Math.floor(mapEd.cols / 2), dy = rows - mapEd.cells.length;
  mapEd.cells = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) => mapEd.cells[y - dy]?.[x - dx] ?? '.'));
  mapEd.cols = cols;
}
function paintMapCell(c, r, ch) {
  const cols = mapEd.cols, rows = mapEd.cells.length;
  for (const x of mapMirror ? [c, cols - 1 - c] : [c]) if (x >= 0 && r >= 0 && x < cols && r < rows && !reservedCell(cols, x, r)) mapEd.cells[r][x] = ch;
}
// строки пресета с поворотом на 90°·turns по часовой и отражением, как их поставит штамп
function transformRows(rows, turns, flip) {
  let g = rows.map(r => [...r]);
  if (flip) g = g.map(r => r.reverse());
  for (let k = 0; k < turns % 4; k++) g = g[0].map((_, x) => g.map(r => r[x]).reverse());
  return g.map(r => r.join(''));
}
function stampRows() {
  const pack = mapStamp && loadPacks().find(p => p.id === mapStamp.pack), p = pack && pack.presets[mapStamp.i];
  return p ? transformRows(p.rows, mapStamp.turns, mapStamp.flip) : null;
}
// штамп центрируется на клетке под курсором; запретные зоны и «не трогать» карту не меняют
function placeStamp(c, r) {
  const rows = stampRows(); if (!rows) return;
  const c0 = c - Math.floor(rows[0].length / 2), r0 = r - Math.floor(rows.length / 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') paintMapCell(c0 + x, r0 + y, ch); }));
}
function saveMapEdit() {
  const name = mapEd.name.trim(), rows = mapEd.cells.map(r => r.join('')), list = loadUserMaps();
  if (!name) { mapEdMsg = UI_TEXT.vvedite_imya_karty; return renderMapEditor(); }
  if (list.some(m => m.name === name && m.id !== mapEd.id)) { mapEdMsg = UI_TEXT.karta_s_takim_imenem_uzhe_est; return renderMapEditor(); }
  if (!mapPassable(mapEd.cols, rows)) { mapEdMsg = UI_TEXT.vragi_ne_mogut_doekhat_do_bazy_khotya_by_ot_odnoy_tochki_poyavleniya_uberite_stal_ili; return renderMapEditor(); }
  const map = { id: mapEd.id || newPackId(), name, cols: mapEd.cols, rows }, i = list.findIndex(m => m.id === mapEd.id);
  if (i >= 0) list[i] = map; else list.push(map);
  saveUserMaps(list); mapEd = null; mapEdMsg = ''; renderMapPick(); renderMapEditor();
}
// импорт принимает одну карту или массив карт; повторяющиеся имена получают номер
function importMapText(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return 0; }
  const list = loadUserMaps(), found = (Array.isArray(data) ? data : [data]).map(normalizeMap).filter(Boolean);
  for (const m of found) {
    let name = m.name, k = 2;
    while (list.some(x => x.name === name)) name = `${m.name} (${k++})`;
    list.push({ ...m, id: newPackId() + list.length, name });
  }
  if (found.length) saveUserMaps(list);
  return found.length;
}
function exportMap(m) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ name: m.name, cols: m.cols, rows: m.rows }, null, 2)], { type: 'application/json' }));
  a.download = m.name.replace(/[\\/:*?"<>|]+/g, '_') + '.ecotank-map.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function mapRow(m, i, mine) {
  const k = `data-src="${mine ? 'mine' : 'claude'}" data-i="${i}"`;
  return `<div class="pe-row"><canvas class="me-thumb" width="120" height="80" ${k}></canvas><span class="pe-name">${escapeHtml(m.name)}</span><span class="pe-size">${m.cols}×${m.rows.length}</span>`
    + `<button data-act="play" ${k}>${UI_TEXT.nachat_operatsiyu}</button>` + (mine ? `<button data-act="edit" ${k} class="ghost">${UI_TEXT.edit}</button>` : '')
    + `<button data-act="copy" ${k} class="ghost">${UI_TEXT.copy}</button><button data-act="export" ${k} class="ghost">${UI_TEXT.peredat_dokumentatsiyu}</button>`
    + (mine ? `<button data-act="delete" ${k} class="ghost">${UI_TEXT.remove}</button>` : '') + '</div>';
}
function renderMapEditor() {
  let h = ("<div class=\"devHead\"><b>" + UI_TEXT.btnMapEditor + "</b>") + (mapEd ? '' : ("<button data-act=\"close\" class=\"ghost\">" + UI_TEXT.close + "</button>")) + '</div>';
  if (!mapEd) {
    const claude = claudeMaps(), mine = loadUserMaps();
    h += ("<div class=\"pe-tools\"><button data-act=\"new\">" + UI_TEXT.nachertit_plan_operatsii + "</button><select id=\"meNewSize\" aria-label=\"" + UI_TEXT.razmer_novoy_karty + "\">") + MAP_SIZES.map(s => `<option value="${s}">${s}×${s * 2 / 3}</option>`).join('') + '</select>'
      + ("<button data-act=\"import\" class=\"ghost\">" + UI_TEXT.poluchit_iz_arkhiva + "</button></div>");
    if (mapEdMsg) h += `<div class="pe-msg">${escapeHtml(mapEdMsg)}</div>`;
    h += ("<h3>" + UI_TEXT.karty_kloda + "</h3>") + (claude.length ? claude.map((m, i) => mapRow(m, i, false)).join('') : ("<p class=\"note\">" + UI_TEXT.fayl_maps_js_ne_nayden_ili_pust + "</p>"));
    h += ("<h3>" + UI_TEXT.moi_karty + "</h3>") + (mine.length ? mine.map((m, i) => mapRow(m, i, true)).join('') : ("<p class=\"note\">" + UI_TEXT.svoikh_kart_poka_net_sozdayte_novuyu_ili_skopiruyte_kartu_kloda + "</p>"));
    h += ("<p class=\"note\">" + UI_TEXT.karty_kloda_khranyatsya_v_fayle_maps_js_i_menyayutsya_tolko_v_nyom_kopiya_popadaet_v_ + "</p>");
  } else {
    h += `<div class="pe-tools"><label>${UI_TEXT.imya}<input id="meName" maxlength="40" value="${escapeHtml(mapEd.name)}"></label>`
      + ("<label>" + UI_TEXT.razmer + "<select id=\"meSize\">") + MAP_SIZES.map(s => `<option value="${s}"${s === mapEd.cols ? ' selected' : ''}>${s}×${s * 2 / 3}</option>`).join('') + '</select></label>'
      + `<label><input type="checkbox" id="meMirror"${mapMirror ? ' checked' : ''}>${UI_TEXT.zerkalno}</label><button data-act="clear" class="ghost">${UI_TEXT.clearArea}</button></div>`;
    h += '<div class="pe-palette">' + MAP_BRUSHES.map(([ch, label]) => `<button data-act="brush" data-ch="${ch}" class="ghost${!mapStamp && ch === mapBrush ? ' on' : ''}"><span class="${cellClass(ch)}"></span>${label}</button>`).join('') + '</div>';
    const packs = loadPacks(), stamp = stampRows(), sel = mapStamp ? `${mapStamp.pack}:${mapStamp.i}` : '';
    h += ("<div class=\"pe-tools\"><label>" + UI_TEXT.preset + "<select id=\"meStamp\"><option value=\"\">" + UI_TEXT.kist + "</option>")
      + packs.filter(p => p.presets.length).map(p => `<optgroup label="${escapeHtml(p.name)}">` + p.presets.map((pr, i) => { const v = escapeHtml(`${p.id}:${i}`); return `<option value="${v}"${v === escapeHtml(sel) ? ' selected' : ''}>${escapeHtml(pr.name)} · ${pr.rows[0].length}×${pr.rows.length}</option>`; }).join('') + '</optgroup>').join('')
      + '</select></label>'
      + (stamp ? `${miniGrid(stamp)}<button data-act="turn" class="ghost">${UI_TEXT.povernut_r}</button><button data-act="flip" class="ghost">${UI_TEXT.otrazit_f}</button><button data-act="unstamp" class="ghost">${UI_TEXT.ruchnaya_razmetka}</button>` : '')
      + '</div>';
    h += `<canvas id="meCanvas" class="me-canvas" width="${mapEd.cols * mapCellSize(mapEd.cols)}" height="${mapEd.cells.length * mapCellSize(mapEd.cols)}"></canvas>`;
    h += ("<div class=\"me-legend\"><span><i style=\"background:#e5484d\"></i>" + UI_TEXT.tochki_poyavleniya_vragov + "</span><span><i style=\"background:#ffd05a\"></i>" + UI_TEXT.baza_i_podezd_k_ney + "</span><span><i style=\"background:#7be38a;border-radius:50%\"></i>" + UI_TEXT.start_igroka + "</span><span>" + UI_TEXT.podsvechennye_zony_igra_vsegda_raschishchaet_risovat_tam_nelzya + "</span></div>");
    h += ("<p class=\"note\">" + UI_TEXT.lkm_risovat_pkm_steret_vybrannyy_preset_stavitsya_klikom_po_tsentru_pod_kursorom_r_po + "</p>");
    h += `<div class="pe-msg">${escapeHtml(mapEdMsg)}</div><div class="pe-actions"><button data-act="save">${UI_TEXT.saveProject}</button><button data-act="cancel" class="ghost">${UI_TEXT.cancel}</button></div>`;
  }
  mapEditorPanel.innerHTML = h;
  drawMapEditor();
}
function drawMapEditor() {
  if (mapEd) {
    const g = document.getElementById('meCanvas').getContext('2d'), cs = mapCellSize(mapEd.cols), stamp = mapHover && stampRows();
    drawMapCells(g, mapEd.cells.map(r => r.join('')), cs, true);
    if (stamp) {
      // превью штампа (и его зеркальной копии) под курсором
      const c0 = mapHover[0] - Math.floor(stamp[0].length / 2), r0 = mapHover[1] - Math.floor(stamp.length / 2);
      const spots = mapMirror ? [[c0, stamp], [mapEd.cols - c0 - stamp[0].length, stamp.map(r => [...r].reverse().join(''))]] : [[c0, stamp]];
      for (const [x0, rows] of spots) {
        g.save(); g.translate(x0 * cs, r0 * cs); drawMapCells(g, rows, cs, false, .7);
        g.strokeStyle = '#8be06a'; g.lineWidth = 2; g.strokeRect(1, 1, rows[0].length * cs - 2, rows.length * cs - 2); g.restore();
      }
    }
    return;
  }
  const claude = claudeMaps(), mine = loadUserMaps();
  for (const el of mapEditorPanel.querySelectorAll('canvas[data-src]')) {
    const m = (el.dataset.src === 'mine' ? mine : claude)[+el.dataset.i];
    if (m) drawMapCells(el.getContext('2d'), m.rows, 120 / m.cols, false);
  }
}
function renderMapPick() {
  const el = document.getElementById('mapPick'), claude = claudeMaps(), mine = loadUserMaps();
  const opt = m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)} · ${m.cols}×${m.rows.length}</option>`;
  el.innerHTML = (claude.length ? `<optgroup label="${UI_TEXT.karty_kloda}">${claude.map(opt).join('')}</optgroup>` : '')
    + (mine.length ? `<optgroup label="${UI_TEXT.moi_karty}">${mine.map(opt).join('')}</optgroup>` : '') || ("<option value=\"\">" + UI_TEXT.net_kart + "</option>");
  if (!findMap(CFG.mapPick)) CFG.mapPick = (claude[0] || mine[0] || { id: '' }).id;
}
function mapEdCell(e) {
  const b = e.target.getBoundingClientRect();
  return [Math.floor((e.clientX - b.left) / b.width * mapEd.cols), Math.floor((e.clientY - b.top) / b.height * mapEd.cells.length)];
}

// поворот по часовой и отражение по горизонтали того, что видно сейчас;
// transformRows сначала отражает, потом поворачивает, поэтому отражение обращает поворот
function turnStamp(act) {
  if (act === 'turn') mapStamp.turns = (mapStamp.turns + 1) % 4;
  else { mapStamp.turns = (4 - mapStamp.turns) % 4; mapStamp.flip = !mapStamp.flip; }
}

function initMapEditor() {
  if (mapEditorPanel) return;
  mapEditorEl = document.getElementById('mapEditor');
  mapEditorPanel = document.getElementById('mapEditorPanel');
  mapEditorPanel.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const act = btn.dataset.act, mine = loadUserMaps(), m = (btn.dataset.src === 'mine' ? mine : claudeMaps())[+btn.dataset.i];
    btn.blur(); mapEdMsg = '';
    if (act === 'close') closeMapEditor();
    else if (act === 'new') startMapEdit(null, false, +document.getElementById('meNewSize').value);
    else if (act === 'import') document.getElementById('mapImport').click();
    else if (act === 'play' && m) { CFG.mapMode = 'map'; CFG.mapPick = m.id; saveDev(); closeMapEditor(); }
    else if (act === 'edit' && m) startMapEdit(m, true);
    else if (act === 'copy' && m) startMapEdit(m, false);
    else if (act === 'export' && m) exportMap(m);
    else if (act === 'delete' && m && confirm(`${UI_TEXT.udalit_kartu}${m.name}»?`)) { saveUserMaps(mine.filter(x => x.id !== m.id)); renderMapPick(); renderMapEditor(); }
    else if (act === 'brush') { mapBrush = btn.dataset.ch; mapStamp = null; renderMapEditor(); }
    else if (act === 'unstamp') { mapStamp = null; renderMapEditor(); }
    else if ((act === 'turn' || act === 'flip') && mapStamp) { turnStamp(act); renderMapEditor(); }
    else if (act === 'clear') { mapEd.cells = blankMapRows(mapEd.cols).map(r => [...r]); renderMapEditor(); }
    else if (act === 'save') saveMapEdit();
    else if (act === 'cancel') { mapEd = null; renderMapEditor(); }
  });
  mapEditorPanel.addEventListener('input', e => { if (mapEd && e.target.id === 'meName') mapEd.name = e.target.value; });
  mapEditorPanel.addEventListener('change', e => {
    if (!mapEd) return;
    if (e.target.id === 'meSize') { resizeMapEdit(+e.target.value); renderMapEditor(); }
    else if (e.target.id === 'meMirror') mapMirror = e.target.checked;
    else if (e.target.id === 'meStamp') {
      const [pack, i] = e.target.value.split(':');
      mapStamp = e.target.value ? { pack, i: +i, turns: 0, flip: false } : null; renderMapEditor();
    }
  });
  mapEditorPanel.addEventListener('mousedown', e => {
    if (!mapEd || e.target.id !== 'meCanvas') return;
    e.preventDefault();
    if (mapStamp && e.button === 0) { placeStamp(...mapEdCell(e)); drawMapEditor(); return; }
    mapPaint = e.button === 2 ? '.' : mapBrush;
    paintMapCell(...mapEdCell(e), mapPaint); drawMapEditor();
  });
  mapEditorPanel.addEventListener('mousemove', e => {
    if (!mapEd || e.target.id !== 'meCanvas') return;
    if (mapStamp) { mapHover = mapEdCell(e); drawMapEditor(); }
    if (mapPaint === null) return;
    paintMapCell(...mapEdCell(e), mapPaint); drawMapEditor();
  });
  mapEditorPanel.addEventListener('mouseout', e => { if (mapHover && e.target.id === 'meCanvas') { mapHover = null; drawMapEditor(); } });
  mapEditorPanel.addEventListener('contextmenu', e => { if (e.target.id === 'meCanvas') e.preventDefault(); });
  addEventListener('mouseup', () => { mapPaint = null; });
  document.getElementById('mapImport').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    file.text().then(text => {
      const n = importMapText(text);
      mapEdMsg = n ? '' : UI_TEXT.v_fayle_net_podkhodyashchikh_kart_ecotank;
      renderMapPick(); renderMapEditor();
    });
  });
  document.getElementById('btnMapEditor').addEventListener('click', e => { e.currentTarget.blur(); openMapEditor(); });
}
