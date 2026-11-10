'use strict';
// Интерфейс и состояние редактора типовых проектов. Данные — через world.js,
// подписи — ui-text.js, общие функции — editor-common.js. Игра вызывает initPresetEditor()
// после создания DOM; повторный вызов не дублирует обработчики и чтение сохранений.
// При закрытии используется toMenu() из игры. Загрузка файла сама по себе инертна.

// ---------- редактор пресетов ----------
// edit — открытый на редактирование пресет: { packId/orig — откуда он (null у нового или копии),
// target — пак для сохранения, name, cells: [[символ]] }
let editorOpen = false,
  edit = null,
  brush = 'B',
  painting = null,
  editorMsg = '';
// свёрнутые паки — удобство конкретного браузера, без них редактор просто открывается развёрнутым
const FOLD_KEY = 'ecotank-packs-folded';
let foldedPacks = new Set();

function setFolded(id, folded) {
  if (folded) foldedPacks.add(id);
  else foldedPacks.delete(id);
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...foldedPacks]));
  } catch (e) {}
}
let editorEl = null,
  editorPanel = null;

function openEditor() {
  editorOpen = true;
  edit = null;
  editorMsg = '';
  renderEditor();
}
function closeEditor() {
  editorOpen = false;
  edit = null;
  painting = null;
  if (state === 'menu') toMenu();
}
// keep=true — правка существующего пресета, иначе новый (p=null) или копия p
function startEdit(packId, p, keep) {
  const rows = p ? p.rows : Array.from({ length: 5 }, () => ' '.repeat(5));
  edit = {
    packId: keep ? packId : null,
    orig: keep ? p.name : null,
    target: packId,
    name: keep ? p.name : p ? p.name + UI_TEXT.kopiya : '',
    cells: rows.map(r => [...r]),
  };
  editorMsg = '';
  renderEditor();
}

function resizeEdit(w, h) {
  w = clamp(Math.round(w) || 1, 1, PRESET_MAX);
  h = clamp(Math.round(h) || 1, 1, PRESET_MAX);
  edit.cells = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => edit.cells[y]?.[x] ?? ' '));
}
// обрезает пустые («не трогать») края, чтобы вес и размещение считались по реальной группе
function trimRows(cells) {
  const used = (y0, y1, x0, x1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (cells[y][x] !== ' ') return true;
    return false;
  };
  let top = 0,
    bottom = cells.length - 1,
    left = 0,
    right = cells[0].length - 1;
  while (top <= bottom && !used(top, top, left, right)) top++;
  if (top > bottom) return [];
  while (!used(bottom, bottom, left, right)) bottom--;
  while (!used(top, bottom, left, left)) left++;
  while (!used(top, bottom, right, right)) right--;
  return cells.slice(top, bottom + 1).map(r => r.slice(left, right + 1).join(''));
}
function saveEdit() {
  const name = edit.name.trim(),
    rows = trimRows(edit.cells),
    packs = loadPacks();
  const target = packs.find(p => p.id === edit.target),
    source = packs.find(p => p.id === edit.packId);
  if (!name) {
    editorMsg = UI_TEXT.vvedite_imya_preseta;
    return renderEditor();
  }
  if (!rows.length) {
    editorMsg = UI_TEXT.preset_pust_narisuyte_khotya_by_odnu_kletku;
    return renderEditor();
  }
  if (!target) {
    editorMsg = UI_TEXT.vybrannyy_pak_ne_nayden;
    return renderEditor();
  }
  if (target.presets.some(p => p.name === name && !(target === source && p.name === edit.orig))) {
    editorMsg = `${UI_TEXT.v_pake}${target.name}${UI_TEXT.uzhe_est_preset_s_takim_imenem}`;
    return renderEditor();
  }
  const preset = { name, rows },
    i = source ? source.presets.findIndex(p => p.name === edit.orig) : -1;
  // правка на месте сохраняет порядок; смена пака переносит пресет в конец нового
  if (i >= 0 && source === target) target.presets[i] = preset;
  else {
    if (i >= 0) source.presets.splice(i, 1);
    target.presets.push(preset);
  }
  savePacks(packs);
  setFolded(target.id, false);
  edit = null;
  editorMsg = '';
  renderEditor();
}
function renderEditor() {
  const packs = loadPacks();
  let h =
    '<div class="devHead"><b>' +
    UI_TEXT.btnEditor +
    '</b>' +
    (edit ? '' : '<button data-act="close" class="ghost">' + UI_TEXT.close + '</button>') +
    '</div>';
  if (!edit) {
    h +=
      '<div class="pe-actions" style="margin-top:0"><button data-act="newPack">' +
      UI_TEXT.otkryt_proektnoe_delo +
      '</button><button data-act="foldAll" class="ghost">' +
      UI_TEXT.svernut_sborniki +
      '</button><button data-act="unfoldAll" class="ghost">' +
      UI_TEXT.razvernut_sborniki +
      '</button></div>';
    if (!packs.some(p => p.enabled && p.presets.length))
      h += '<p class="pe-warn">' + UI_TEXT.ni_odin_pak_s_presetami_ne_vklyuchyon_v_rezhime_preset_test_0_1_karta_budet_pustoy + '</p>';
    for (const pack of packs) {
      const id = escapeHtml(pack.id),
        claude = pack.id === CLAUDE_PACK,
        folded = foldedPacks.has(pack.id);
      h +=
        `<div class="pe-pack${folded ? ' folded' : ''}"><div class="pe-packhead">` +
        `<button data-act="fold" data-pack="${id}" class="ghost pe-fold" aria-expanded="${!folded}" aria-label="${folded ? UI_TEXT.otkryt : UI_TEXT.zakryt}${UI_TEXT.delo}">▾</button>` +
        (claude
          ? `<b>${CLAUDE_PACK_NAME}</b>`
          : `<input class="pe-packname" data-pack="${id}" maxlength="40" value="${escapeHtml(pack.name)}" aria-label="${UI_TEXT.imya_paka}">`) +
        `<span class="pe-size">${pack.presets.length}${UI_TEXT.sht}</span>` +
        `<label><input type="checkbox" data-act="toggle" data-pack="${id}"${pack.enabled ? ' checked' : ''}>${UI_TEXT.v_igre}</label>` +
        `<button data-act="new" data-pack="${id}">${UI_TEXT.novyy_tipovoy_proekt}</button>` +
        (claude
          ? `<button data-act="resetPack" data-pack="${id}" class="ghost">${UI_TEXT.vernutsya_k_normativu}</button>`
          : `<button data-act="deletePack" data-pack="${id}" class="ghost">${UI_TEXT.spisat_proektnoe_delo}</button>`) +
        '</div>';
      if (folded) {
        h += '</div>';
        continue;
      }
      h += pack.presets.length
        ? pack.presets
            .map(
              (p, i) =>
                `<div class="pe-row">${miniGrid(p.rows)}<span class="pe-name">${escapeHtml(p.name)}</span><span class="pe-size">${p.rows[0].length}×${p.rows.length}</span>` +
                `<button data-act="edit" data-pack="${id}" data-i="${i}" class="ghost">${UI_TEXT.edit}</button><button data-act="copy" data-pack="${id}" data-i="${i}" class="ghost">${UI_TEXT.copy}</button><button data-act="delete" data-pack="${id}" data-i="${i}" class="ghost">${UI_TEXT.remove}</button></div>`,
            )
            .join('')
        : '<p class="note" style="margin:4px 0 8px">' + UI_TEXT.pak_pust + '</p>';
      h += '</div>';
    }
    h += '<p class="note">' + UI_TEXT.v_rezhime_preset_test_0_1_na_kartu_stavyatsya_presety_vsekh_pakov_otmechennykh_v_igre + '</p>';
  } else {
    const w = edit.cells[0].length,
      hh = edit.cells.length;
    h +=
      `<div class="pe-tools"><label>${UI_TEXT.imya}<input id="peName" maxlength="40" value="${escapeHtml(edit.name)}"></label>` +
      `<label>${UI_TEXT.pak}<select id="pePack">${packs.map(p => `<option value="${escapeHtml(p.id)}"${p.id === edit.target ? ' selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select></label>` +
      `<label>${UI_TEXT.shirina}<input type="number" id="peW" min="1" max="${PRESET_MAX}" value="${w}"></label>` +
      `<label>${UI_TEXT.vysota}<input type="number" id="peH" min="1" max="${PRESET_MAX}" value="${hh}"></label>` +
      ('<button data-act="clear" class="ghost">' + UI_TEXT.clearArea + '</button></div>');
    h +=
      '<div class="pe-palette">' +
      BRUSHES.map(
        ([ch, label]) =>
          `<button data-act="brush" data-ch="${ch}" class="ghost${ch === brush ? ' on' : ''}"><span class="${cellClass(ch)}"></span>${label}</button>`,
      ).join('') +
      '</div>';
    h +=
      `<div class="pe-grid" style="grid-template-columns:repeat(${w},30px)">` +
      edit.cells.map((r, y) => r.map((ch, x) => `<div class="${cellClass(ch)}" data-x="${x}" data-y="${y}"></div>`).join('')).join('') +
      '</div>';
    h += '<p class="note">' + UI_TEXT.lkm_risovat_vybrannoy_kistyu_pkm_steret_ne_trogat_raschistit_osvobozhdaet_kletku_na_k + '</p>';
    h += `<div class="pe-msg">${escapeHtml(editorMsg)}</div><div class="pe-actions"><button data-act="save">${UI_TEXT.saveProject}</button><button data-act="cancel" class="ghost">${UI_TEXT.cancel}</button></div>`;
  }
  editorPanel.innerHTML = h;
}
function paintCell(el) {
  if (!edit || painting === null || !el || el.dataset.x === undefined) return;
  const x = +el.dataset.x,
    y = +el.dataset.y;
  edit.cells[y][x] = painting;
  el.className = cellClass(painting);
}

function initPresetEditor() {
  if (editorPanel) return;
  try {
    const f = JSON.parse(localStorage.getItem(FOLD_KEY));
    if (Array.isArray(f)) foldedPacks = new Set(f);
  } catch (e) {}
  editorEl = document.getElementById('editor');
  editorPanel = document.getElementById('editorPanel');
  editorPanel.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act,
      packs = loadPacks(),
      pack = packs.find(p => p.id === btn.dataset.pack),
      i = +btn.dataset.i,
      preset = pack && pack.presets[i];
    btn.blur();
    if (act === 'close') closeEditor();
    else if (act === 'fold' && pack) {
      setFolded(pack.id, !foldedPacks.has(pack.id));
      renderEditor();
    } else if (act === 'foldAll' || act === 'unfoldAll') {
      for (const p of packs) setFolded(p.id, act === 'foldAll');
      renderEditor();
    } else if (act === 'newPack') {
      packs.push({ id: newPackId(), name: UI_TEXT.novyy_pak + packs.length, enabled: true, presets: [] });
      savePacks(packs);
      renderEditor();
    } else if (
      act === 'deletePack' &&
      pack &&
      pack.id !== CLAUDE_PACK &&
      (!pack.presets.length || confirm(`${UI_TEXT.udalit_pak}${pack.name}${UI_TEXT.vmeste_s}${pack.presets.length}${UI_TEXT.presetami}`))
    ) {
      packs.splice(packs.indexOf(pack), 1);
      savePacks(packs);
      renderEditor();
    } else if (
      act === 'resetPack' &&
      pack &&
      confirm(`${UI_TEXT.vernut}${CLAUDE_PACK_NAME}${UI_TEXT.k_iskhodnym_pravki_v_etom_pake_propadut}`)
    ) {
      packs[packs.indexOf(pack)] = { ...defaultClaudePack(), enabled: pack.enabled };
      savePacks(packs);
      renderEditor();
    } else if (act === 'new' && pack) startEdit(pack.id, null, false);
    else if (act === 'edit' && preset) startEdit(pack.id, preset, true);
    else if (act === 'copy' && preset) startEdit(pack.id, preset, false);
    else if (act === 'delete' && preset && confirm(`${UI_TEXT.udalit_preset}${preset.name}»?`)) {
      pack.presets.splice(i, 1);
      savePacks(packs);
      renderEditor();
    } else if (act === 'brush') {
      brush = btn.dataset.ch;
      renderEditor();
    } else if (act === 'clear') {
      edit.cells = edit.cells.map(r => r.map(() => ' '));
      renderEditor();
    } else if (act === 'save') saveEdit();
    else if (act === 'cancel') {
      edit = null;
      editorMsg = '';
      renderEditor();
    }
  });
  editorPanel.addEventListener('input', e => {
    if (!edit) return;
    if (e.target.id === 'peName') edit.name = e.target.value;
  });
  editorPanel.addEventListener('change', e => {
    const el = e.target;
    if (!edit && (el.dataset.act === 'toggle' || el.classList.contains('pe-packname'))) {
      const packs = loadPacks(),
        pack = packs.find(p => p.id === el.dataset.pack);
      if (!pack) return;
      if (el.dataset.act === 'toggle') pack.enabled = el.checked;
      else if (el.value.trim()) pack.name = el.value.trim();
      savePacks(packs);
      renderEditor();
      return;
    }
    if (!edit) return;
    if (el.id === 'pePack') edit.target = el.value;
    else if (el.id === 'peW' || el.id === 'peH') {
      resizeEdit(+document.getElementById('peW').value, +document.getElementById('peH').value);
      renderEditor();
    }
  });
  editorPanel.addEventListener('mousedown', e => {
    if (!e.target.closest('.pe-grid')) return;
    e.preventDefault();
    painting = e.button === 2 ? ' ' : brush;
    paintCell(e.target);
  });
  editorPanel.addEventListener('mouseover', e => paintCell(e.target));
  editorPanel.addEventListener('contextmenu', e => {
    if (e.target.closest('.pe-grid')) e.preventDefault();
  });
  addEventListener('mouseup', () => {
    painting = null;
  });
  document.getElementById('btnEditor').addEventListener('click', e => {
    e.currentTarget.blur();
    openEditor();
  });
}
