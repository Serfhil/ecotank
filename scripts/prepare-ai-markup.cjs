// Готовит тактическую разметку готовых карт для ИИ врагов: маршруты от точек появления к цели режима
// (по дорогам, если они есть), опасные точки (куртины зелени и заборы у маршрута), зоны манёвра
// (зелень и открытые районы по сторонам маршрута) и проходы (узкие места на маршруте).
// Запуск из папки игры: node scripts/prepare-ai-markup.cjs — переписывает maps-ai.js и разметку
// в js/raseiniai-map.js. Только встроенные модули Node; карта читается так же, как её строит игра.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const box = { window: {} };
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(root, 'maps.js'), 'utf8'), box);
vm.runInContext(fs.readFileSync(path.join(root, 'js/raseiniai-map.js'), 'utf8').replace(/\/\/ AI-MARKUP[\s\S]*$/, '') + ';this.RASEINIAI_MAP=RASEINIAI_MAP;', box);

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const spawnCols = cols => Array.from({ length: 5 }, (_, i) => 1 + Math.round((cols - 3) * i / 4));
function reservedCell(cols, c, r) {
  const rows = cols * 2 / 3, center = Math.floor(cols / 2);
  if (r >= rows - 4 && c >= center - 3 && c <= center + 2) return true;
  return r <= 2 && spawnCols(cols).some(s => Math.abs(c - s) <= 1);
}
// Клетки так, как их видит игра в бою: резерв расчищен, контур базы — кирпич, b/t — худший случай.
function cells(map, story) {
  const cols = map.cols, rows = cols * 2 / 3, center = Math.floor(cols / 2);
  const g = map.rows.map(r => [...r.replace(/ /g, '.')]);
  if (!story) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (reservedCell(cols, c, r)) g[r][c] = '.';
    for (let r = rows - 2; r < rows; r++) for (let c = center - 1; c <= center + 1; c++) if (r === rows - 2 || c !== center) g[r][c] = 'B';
  }
  return { cols, rows, at: (c, r) => c < 0 || r < 0 || c >= cols || r >= rows ? 'S' : g[r][c] };
}
const blocked = ch => ch === 'S' || ch === 'W';
const tree = ch => ch === 'T' || ch === 't' || ch === 'L';
const fence = ch => ch === 'F';
const brick = ch => ch === 'B' || ch === 'b' || ch === 'D';
// Дейкстра от цели: дороги дешевле, песок дороже, кирпич — пролом (как в buildFlow).
function field(m, gc, gr, roadOnly = false) {
  const n = m.cols * m.rows, d = new Float64Array(n).fill(Infinity), done = new Uint8Array(n);
  d[gr * m.cols + gc] = 0;
  for (;;) {
    let i = -1, best = Infinity;
    for (let k = 0; k < n; k++) if (!done[k] && d[k] < best) { best = d[k]; i = k; }
    if (i < 0) break;
    done[i] = 1;
    const c = i % m.cols, r = (i / m.cols) | 0;
    for (const [dc, dr] of DIRS) {
      const nc = c + dc, nr = r + dr, ch = m.at(nc, nr);
      if (blocked(ch) || roadOnly && ch !== 'R') continue;
      const w = ch === 'R' ? .7 : ch === 'P' ? 1.6 : brick(ch) ? 4 : 1, j = nr * m.cols + nc;
      if (d[i] + w < d[j]) d[j] = d[i] + w;
    }
  }
  return d;
}
function descend(m, d, c, r) {
  if (!Number.isFinite(d[r * m.cols + c])) return null;
  const out = [[c, r]];
  while (d[r * m.cols + c] > 0) {
    let best = null, bv = d[r * m.cols + c];
    for (const [dc, dr] of DIRS) { const nc = c + dc, nr = r + dr; if (m.at(nc, nr) === 'S' && (nc < 0 || nr < 0 || nc >= m.cols || nr >= m.rows)) continue; const v = d[nr * m.cols + nc]; if (v < bv) { bv = v; best = [nc, nr]; } }
    if (!best) return null;
    [c, r] = best; out.push(best);
  }
  return out;
}
// Ломаная: только точки поворота (соседние точки лежат на одной строке или столбце).
const compress = path => path.filter((p, k) => !k || k === path.length - 1 || (path[k - 1][0] === p[0]) !== (path[k + 1][0] === p[0]));
function clusters(m, test) {
  const seen = new Uint8Array(m.cols * m.rows), out = [];
  for (let r = 0; r < m.rows; r++) for (let c = 0; c < m.cols; c++) {
    if (seen[r * m.cols + c] || !test(m.at(c, r))) continue;
    const q = [[c, r]], list = [];
    seen[r * m.cols + c] = 1;
    while (q.length) { const [x, y] = q.pop(); list.push([x, y]); for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < m.cols && ny < m.rows && !seen[ny * m.cols + nx] && test(m.at(nx, ny))) { seen[ny * m.cols + nx] = 1; q.push([nx, ny]); } } }
    out.push(list);
  }
  return out;
}
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
function markup(map, routes) {
  const m = cells(map, !!map.story), routeCells = routes.flatMap(r => r.cells);
  const distTo = p => Math.min(...routeCells.map(q => cheb(p, q)));
  const danger = [];
  for (const list of clusters(m, ch => tree(ch) || fence(ch))) {
    if (list.length < 2) continue;
    const near = list.map(p => ({ p, d: distTo(p) })).filter(o => o.d >= 1 && o.d <= 3).sort((a, b) => a.d - b.d);
    for (const { p } of near) if (danger.every(q => cheb(q, p) >= 4)) danger.push(p);
  }
  danger.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const zones = [];
  for (const list of clusters(m, tree)) {
    if (list.length < 3 || Math.min(...list.map(distTo)) > 9) continue;
    const xs = list.map(p => p[0]), ys = list.map(p => p[1]);
    zones.push([Math.max(0, Math.min(...xs) - 1), Math.max(0, Math.min(...ys) - 1), Math.min(m.cols - 1, Math.max(...xs) + 1), Math.min(m.rows - 1, Math.max(...ys) + 1)]);
  }
  const passes = [];
  for (const r of routes) r.cells.forEach((p, k) => {
    if (k < 3 || k > r.cells.length - 3) return;
    const prev = r.cells[k - 1], vertical = prev[0] === p[0], side = vertical ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    const tight = side.every(([dx, dy]) => { const ch = m.at(p[0] + dx, p[1] + dy); return blocked(ch) || brick(ch); });
    if (tight && passes.every(q => cheb(q, p) >= 3)) passes.push(p);
  });
  return { routes: routes.map(r => compress(r.cells)), danger: danger.slice(0, 24), zones: zones.slice(0, 14), passes: passes.slice(0, 16) };
}
function claudeMarkup(map) {
  const m = cells(map, false), gc = Math.floor(m.cols / 2), gr = m.rows - 1, d = field(m, gc, gr);
  const routes = spawnCols(m.cols).map(c => ({ cells: descend(m, d, c, 1) })).filter(r => r.cells);
  return markup(map, routes);
}
function raseiniaiMarkup(map) {
  const m = cells(map, true), routes = [];
  for (const exit of [8, 21]) {
    const d = field(m, exit, m.rows - 1, true);
    for (const c of spawnCols(m.cols)) { const cells = descend(m, d, c, 1); if (cells) routes.push({ cells }); }
  }
  return markup({ ...map, story: true }, routes);
}
const json = v => JSON.stringify(v);
const entry = mk => `{routes:${json(mk.routes)},\n    danger:${json(mk.danger)},\n    zones:${json(mk.zones)},\n    passes:${json(mk.passes)}}`;
const maps = box.window.ECOTANK_MAPS;
let out = '// Тактическая разметка готовых карт для ИИ обычных вражеских танков (необязательная).\n' +
  '// Подготовлена scripts/prepare-ai-markup.cjs по геометрии карт из maps.js; ключ — id карты.\n' +
  '// routes — маршруты марша от точек появления к базе (ломаные из клеток [столбец, строка], по дорогам, где они есть);\n' +
  '// danger — опасные точки у маршрута (зелень, заборы) для осмотра или проверочного выстрела;\n' +
  '// zones — [c0, r0, c1, r1] районы поиска позиции для обхода; passes — проходы (узкие места, выходы для поиска).\n' +
  '// Карты без разметки (свои, случайные) работают по маршрутам и укрытиям из текущей геометрии.\n' +
  'window.ECOTANK_AI_MARKUP = {\n';
for (const map of maps) out += `  '${map.id}': ${entry(claudeMarkup(map))},\n`;
out += '};\n';
fs.writeFileSync(path.join(root, 'maps-ai.js'), out);
const rasFile = path.join(root, 'js/raseiniai-map.js');
const ras = fs.readFileSync(rasFile, 'utf8').replace(/\n\/\/ AI-MARKUP[\s\S]*$/, '\n');
fs.writeFileSync(rasFile, ras.replace(/\n*$/, '\n') + '\n// AI-MARKUP: тактическая разметка Расейняя (scripts/prepare-ai-markup.cjs): маршруты по дорогам\n' +
  '// от пяти полос появления к обоим выходам, опасные точки, зоны манёвра и проходы.\nconst RASEINIAI_AI_MARKUP = ' + entry(raseiniaiMarkup(box.RASEINIAI_MAP)) + ';\n');
console.log('AI markup: ' + maps.length + ' maps + Raseiniai');
