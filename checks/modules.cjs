const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');

module.exports = function checkModules(root) {
  const html = fs.readFileSync(root + '/index.html', 'utf8');
  const sources = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m => m[1]);
  assert.deepEqual(sources, [
    'js/util.js',
    'js/ui-text.js',
    'js/config.js',
    'js/scenarios.js',
    'js/statistics.js',
    'js/audio.js',
    'maps.js',
    'maps-ai.js',
    'js/world.js',
    'js/destruction.js',
    'js/tanks.js',
    'js/weapons.js',
    'js/damage.js',
    'js/pickups.js',
    'js/enemy-ai.js',
    'js/enemy-tactics.js',
    'js/allies.js',
    'js/waves.js',
    'js/sappers.js',
    'js/render-world.js',
    'js/render-detail.js',
    'js/vehicle-sprites.js',
    'js/render-tanks.js',
    'js/effects.js',
    'js/layout.js',
    'js/defeat.js',
    'js/victory.js',
    'js/render-ui.js',
    'js/renderer.js',
    'js/editor-common.js',
    'js/preset-editor.js',
    'js/map-editor.js',
    'js/settings.js',
    'js/menu.js',
    'js/game.js',
    'js/scenario-waves.js',
    'js/raseiniai-map.js',
    'js/raseiniai.js',
    'js/raseiniai-ui.js',
  ]);
  assert(!/<script\b[^>]*type="module"/.test(html), 'Direct file opening must not require ES-module loading');
  // Catalog and parameters must be usable without the browser, audio or stored settings.
  const context = vm.createContext({});
  for (const src of sources.slice(0, 4)) vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  // World definitions also load without creating a canvas, reading storage or starting a game.
  for (const src of ['js/world.js', 'js/destruction.js'])
    vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  // Combat definitions must not need DOM, game state, audio or a running loop at load time.
  for (const src of [
    'js/statistics.js',
    'js/tanks.js',
    'js/weapons.js',
    'js/damage.js',
    'js/pickups.js',
    'js/enemy-ai.js',
    'js/enemy-tactics.js',
    'js/allies.js',
    'js/waves.js',
    'js/sappers.js',
  ])
    vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  // Rendering/effects definitions load without Canvas, DOM, audio or game state.
  for (const src of [
    'js/render-world.js',
    'js/render-detail.js',
    'js/vehicle-sprites.js',
    'js/render-tanks.js',
    'js/effects.js',
    'js/layout.js',
    'js/defeat.js',
    'js/victory.js',
    'js/render-ui.js',
    'js/renderer.js',
  ])
    vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  // Editor modules define state and functions without reading storage or touching the DOM.
  for (const src of ['js/editor-common.js', 'js/preset-editor.js', 'js/map-editor.js'])
    vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  // Core, settings, menu and scenarios only define state and functions: bootGame() starts everything.
  for (const src of sources.slice(sources.indexOf('js/settings.js')))
    vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1].replace(/'use strict';/, '').trim());
  assert.deepEqual(inline, ['bootGame();'], 'index.html must contain no game code besides the boot call');
  const catalog = vm.runInContext('UI_TEXT', context);
  for (const [, key] of html.matchAll(/data-ui-(?:text|leading|aria-label|alt|placeholder|title)="([^"]+)"/g)) {
    assert.equal(typeof catalog[key], 'string', 'Missing static interface text: ' + key);
  }
  const label = { dataset: { uiText: 'startBattle' } },
    subtitle = { textContent: 'Случайная карта' };
  const mode = {
    dataset: { uiLeading: 'modeOriginal' },
    firstChild: subtitle,
    insertions: [],
    insertBefore(node, before) {
      assert.equal(before, subtitle);
      this.insertions.push(node);
    },
  };
  const aria = {
    getAttribute: () => 'glavnoe_menyu_ecotank',
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const document = {
    createTextNode: text => ({ textContent: text }),
    querySelectorAll(selector) {
      return selector === '[data-ui-text]'
        ? [label]
        : selector === '[data-ui-leading]'
          ? [mode]
          : selector === '[data-ui-aria-label]'
            ? [aria]
            : [];
    },
  };
  context.document = document;
  vm.runInContext('applyInterfaceTexts();applyInterfaceTexts();', context);
  assert.equal(label.textContent, 'В бой, товарищ!');
  assert.equal(mode.insertions.length, 1, 'Repeated initialization must not duplicate a mode label');
  assert.equal(mode.insertions[0].textContent, 'Манёвры');
  assert.equal(subtitle.textContent, 'Случайная карта', 'Mode subtitle must survive text initialization');
  assert.equal(aria['aria-label'], 'Главное меню EcoTank');
  vm.runInContext('KINDS.player.speed=65;PREFS.mapSize=45;', context);
  // Single sources of truth stay consistent.
  vm.runInContext(
    `{
    const fields=new Set(CFG_FIELDS.flatMap(([,list])=>list.map(f=>f[0])));
    for(const key in CFG)if(!fields.has(key))throw Error('CFG.'+key+' has no CFG_FIELDS row');
    for(const key of fields)if(!(key in CFG))throw Error('CFG_FIELDS row without CFG value: '+key);
    for(const [kind,K] of Object.entries(KINDS)){
      if(typeof K.name!=='string'||!K.name)throw Error('KINDS.'+kind+' has no name');
      if(K.side!=='enemy'&&K.side!=='friend')throw Error('KINDS.'+kind+' has no side');
      if(K.side==='enemy'&&!ENEMY_AI[K.ai])throw Error('KINDS.'+kind+' has no known ai');
    }
    for(const m of [...WAVE_MIX,...WAVE_EXTRAS])if(!KINDS[m.kind]||KINDS[m.kind].side!=='enemy')throw Error('Wave rule for unknown kind '+m.kind);
    for(const [type,item] of Object.entries(ITEMS))if(!item.name||!(item.timed||typeof item.useful==='function'&&typeof item.apply==='function'))throw Error('ITEMS.'+type+' is incomplete');
    for(const tier of PLAYER_TIERS)for(const key of ['name','sprite','scale','gun','barrels','deathBlasts','defeatImage','mg'])if(tier[key]===undefined)throw Error('PLAYER_TIERS entry without '+key);
    for(const [id,s] of Object.entries(SCENARIOS))if(typeof s.start!=='function')throw Error('Scenario '+id+' has no start');
  }`,
    context,
  );
  for (const ch of vm.runInContext('Object.keys(CELL_CATALOG)', context)) {
    assert(html.includes('.t-' + (ch === '.' ? 'clear' : ch)), 'Editor cell ' + ch + ' needs a CSS class in index.html');
  }
  assert.equal(vm.runInContext('KINDS.player.speed', context), 65, 'Developer parameters must remain mutable');
  assert.equal(vm.runInContext('PREFS.mapSize', context), 45);
};

if (require.main === module) {
  module.exports(require('node:path').join(__dirname, '..'));
  console.log('PASS: classic script order, static labels, subtitles, accessibility and mutable configuration');
}
