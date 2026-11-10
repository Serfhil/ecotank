// Автоматическая часть правил проекта (AGENTS.md). Нарушение — ошибка с номером правила.
// Проверка читает исходники как текст и загружает только данные конфигурации.
const fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path'),
  assert = require('node:assert/strict');

module.exports = function checkRules(root) {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8');
  const jsFiles = fs
    .readdirSync(path.join(root, 'js'))
    .filter(f => f.endsWith('.js'))
    .sort();
  const sources = Object.fromEntries(jsFiles.map(f => [f, read('js/' + f)]));
  const html = read('index.html');
  // Код без комментариев: правила относятся к тому, что исполняется.
  const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
  const code = Object.fromEntries(jsFiles.map(f => [f, stripComments(sources[f])]));
  const each = (files, fn) => {
    for (const f of files) code[f].split(/\r?\n/).forEach((line, i) => fn(f, line, i + 1));
  };

  const context = vm.createContext({});
  for (const f of ['util.js', 'ui-text.js', 'config.js', 'scenarios.js']) vm.runInContext(sources[f], context, { filename: f });
  const kinds = vm.runInContext('KINDS', context),
    texts = vm.runInContext('UI_TEXT', context),
    defaultScenario = vm.runInContext('DEFAULT_SCENARIO', context);

  // Файлы сценариев: файл, который регистрирует сценарий, и файлы с тем же префиксом (данные и интерфейс сценария).
  const scenarios = [],
    scenarioFiles = new Set();
  for (const f of jsFiles) for (const m of code[f].matchAll(/defineScenario\(\s*'([a-z0-9-]+)'/g)) scenarios.push({ id: m[1], file: f });
  for (const { file } of scenarios) {
    const prefix = file.replace(/\.js$/, '');
    for (const g of jsFiles) if (g.startsWith(prefix)) scenarioFiles.add(g);
  }
  const isRender = f => /^render-|^vehicle-sprites\.js$|^effects\.js$|^layout\.js$/.test(f);
  const isData = f => /^(ui-text|config|raseiniai-map)\.js$/.test(f);
  const core = jsFiles.filter(f => !scenarioFiles.has(f) && f !== 'scenarios.js');

  // П1. Каждый файл — строгий режим и шапка с назначением.
  for (const f of jsFiles) {
    assert(/^'use strict';\r?\n\/\//.test(sources[f]), `П1: js/${f} должен начинаться с 'use strict' и комментария о назначении файла`);
  }

  // П2. index.html не содержит кода игры, обработчиков в разметке и модулей ES; мёртвых файлов в js/ нет.
  assert(!/\son[a-z]+\s*=\s*"/i.test(html), 'П2: обработчики событий в разметке index.html запрещены');
  assert(!/<script\b[^>]*type="module"/.test(html), 'П2: игра должна открываться с file:// — модули ES запрещены');
  const listed = [...html.matchAll(/<script\b[^>]*\bsrc="js\/([^"]+)"/g)].map(m => m[1]);
  for (const f of jsFiles) assert(listed.includes(f), `П2: js/${f} не подключён в index.html (мёртвый файл или забытый <script>)`);

  // П3. Ядро не знает сценариев по имени.
  for (const { id, file } of scenarios) {
    if (id === defaultScenario) continue;
    const word = new RegExp(id, 'i');
    each(
      core.filter(f => f !== 'ui-text.js'),
      (f, line, n) => {
        assert(
          !word.test(line),
          `П3: js/${f}:${n} упоминает сценарий «${id}». Ядро обращается к сценарию только через функции из scenarios.js (владелец — js/${file})`,
        );
      },
    );
  }
  each(core, (f, line, n) =>
    assert(!/(scenario\.id|selectedScenario)\s*[!=]==?\s*'/.test(line), `П3: js/${f}:${n} сравнивает сценарий с именем`),
  );

  // П4. Особенности вида техники — поля KINDS, а не сравнения kind с именем врага.
  const enemyKinds = Object.keys(kinds)
    .filter(k => kinds[k].side === 'enemy')
    .join('|');
  const kindLiteral = new RegExp(`kind\\s*[!=]==?\\s*'(${enemyKinds})'`);
  each(
    core.filter(f => !isRender(f)),
    (f, line, n) => {
      assert(!kindLiteral.test(line), `П4: js/${f}:${n} сравнивает kind с именем вида. Добавьте поле в KINDS (config.js) и проверяйте его`);
    },
  );

  // П5. Номер ступени не сравнивается с числами: всё берётся из PLAYER_TIERS.
  each(jsFiles, (f, line, n) => {
    assert(
      !/upgrade\s*(>=|>|<=|<|===|==|!==|!=)\s*[1-9]/.test(line),
      `П5: js/${f}:${n} сравнивает ступень с числом. Используйте playerTier(t), usesTier(t) и MAX_TIER`,
    );
  });

  // П6. Время и случайность: логика знает время только через dt, случайность — только Math.random.
  const clockAllowed = new Set(['audio.js', 'settings.js', 'editor-common.js', 'map-editor.js', 'preset-editor.js']);
  each(
    jsFiles.filter(f => !clockAllowed.has(f)),
    (f, line, n) => {
      if (f === 'game.js' && /performance\.now\(\)/.test(line)) return; // игровой цикл bootGame() — единственный источник dt
      assert(
        !/\b(setTimeout|setInterval|Date\.now|performance\.now|new Date)\b/.test(line),
        `П6: js/${f}:${n} использует таймер или часы. Игровые события считаются счётчиком, уменьшаемым на dt`,
      );
      assert(!/\bcrypto\b/.test(line), `П6: js/${f}:${n} использует другой источник случайности`);
    },
  );

  // П7. Хранилище браузера — только у владельцев сохранений.
  const storageOwners = new Set(['settings.js', 'world.js', 'game.js', 'preset-editor.js']);
  each(
    jsFiles.filter(f => !storageOwners.has(f)),
    (f, line, n) => {
      assert(!/\b(localStorage|sessionStorage|indexedDB)\b/.test(line), `П7: js/${f}:${n} обращается к хранилищу браузера напрямую`);
    },
  );

  // П8. Тексты интерфейса — только в ui-text.js; сюжетные тексты — в файлах своего сценария.
  each(
    core.filter(f => !isData(f)),
    (f, line, n) => {
      assert(
        !/(['"`])(?:(?!\1).)*[А-Яа-яЁё](?:(?!\1).)*\1/.test(line),
        `П8: js/${f}:${n} содержит текст для игрока. Перенесите его в UI_TEXT (ui-text.js)`,
      );
    },
  );
  const catalogStart = sources['ui-text.js'].indexOf('const UI_TEXT'),
    catalogEnd = sources['ui-text.js'].indexOf('});', catalogStart);
  const users =
    jsFiles
      .filter(f => f !== 'ui-text.js')
      .map(f => code[f])
      .join('\n') +
    sources['ui-text.js'].slice(catalogEnd) +
    html;
  for (const key of Object.keys(texts)) {
    assert(new RegExp(`UI_TEXT\\.${key}\\b|"${key}"`).test(users), `П8: текст UI_TEXT.${key} нигде не используется — удалите его`);
  }
  for (const f of jsFiles) {
    for (const m of code[f].matchAll(/UI_TEXT\.([A-Za-z_0-9]+)/g)) {
      assert(typeof texts[m[1]] === 'string', `П8: js/${f} ссылается на отсутствующий текст UI_TEXT.${m[1]}`);
    }
  }

  // П9. Глобальные имена объявляются один раз: у каждого состояния и каждой функции один владелец.
  const declared = new Map();
  for (const f of jsFiles) {
    for (const m of code[f].matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)) {
      assert(!declared.has(m[1]), `П9: имя ${m[1]} объявлено и в js/${declared.get(m[1])}, и в js/${f}`);
      declared.set(m[1], f);
    }
  }

  // П11. Правила лежат в AGENTS.md, CLAUDE.md только подключает его; у каждой задачи в prompts/ есть статус.
  assert(/^@AGENTS\.md$/m.test(read('CLAUDE.md')), 'П11: CLAUDE.md должен подключать правила строкой @AGENTS.md');
  assert(!/^##\s+\d+\./m.test(read('CLAUDE.md')), 'П11: правила записываются только в AGENTS.md, не в CLAUDE.md');
  for (const f of fs.readdirSync(path.join(root, 'prompts')).filter(f => f.endsWith('.md') && f !== 'README.md')) {
    assert(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/.test(f), `П11: prompts/${f} — имя задачи должно быть ГГГГ-ММ-ДД-краткое-имя.md`);
    const head = read('prompts/' + f)
      .split(/\r?\n/)
      .slice(0, 6)
      .join('\n');
    assert(
      /^\*\*Статус:\*\* (новая|в работе|выполнено|отложено)/m.test(head),
      `П11: prompts/${f} — в начале файла нужна строка «**Статус:** …»`,
    );
    if (/^\*\*Статус:\*\* (выполнено|отложено)/m.test(head)) {
      assert(/^## Итог\s*$/m.test(read('prompts/' + f)), `П11: prompts/${f} — у завершённой задачи должен быть раздел «## Итог»`);
    }
  }

  // П10. Плотный стиль не возвращается: ширина кода без строк и комментариев ограничена.
  const MAX_CODE_WIDTH = 150;
  const bare = line => line.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""');
  // шаблонные строки (в том числе многострочная разметка) в ширину кода не входят
  const withoutTemplates = text => text.replace(/`[^`]*`/g, m => m.replace(/[^\n]/g, ''));
  for (const f of jsFiles.filter(f => !isData(f))) {
    withoutTemplates(code[f])
      .split(/\r?\n/)
      .forEach((line, i) => {
        const width = bare(line).trimEnd().length;
        assert(
          width <= MAX_CODE_WIDTH,
          `П10: js/${f}:${i + 1} шире ${MAX_CODE_WIDTH} символов (${width}). Отформатируйте: npx prettier --write js`,
        );
      });
  }
};

if (require.main === module) {
  module.exports(path.join(__dirname, '..'));
  console.log('PASS: project rules');
}
