'use strict';
// Общие операции редакторов. Без DOM, сохранений и обработчиков при подключении.
// newPackId() использует игровой ri(); остальные функции работают только с аргументами.

const cellClass = ch => 'pe-cell t-' + (ch === ' ' ? 'none' : ch === '.' ? 'clear' : ch);

const escapeHtml = s => s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function miniGrid(rows) {
  return (
    `<div class="pe-thumb"><div class="pe-mini" style="grid-template-columns:repeat(${rows[0].length},7px)">` +
    rows.map(r => [...r].map(ch => `<div class="${cellClass(ch)}"></div>`).join('')).join('') +
    '</div></div>'
  );
}

const newPackId = () => 'p' + Date.now().toString(36) + ri(0, 1e6).toString(36);
