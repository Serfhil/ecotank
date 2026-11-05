const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

module.exports=function checkModules(root){
  const html=fs.readFileSync(root+'/index.html','utf8');
  const sources=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m=>m[1]);
  assert.deepEqual(sources,[
    'js/ui-text.js','js/config.js','js/statistics.js','js/audio.js','maps.js','js/world.js','js/destruction.js',
    'js/tanks.js','js/weapons.js','js/damage.js','js/pickups.js','js/enemy-ai.js','js/allies.js','js/waves.js',
    'js/render-world.js','js/render-detail.js','js/render-tanks.js','js/effects.js','js/layout.js','js/defeat.js','js/victory.js','js/render-ui.js','js/renderer.js',
    'js/editor-common.js','js/preset-editor.js','js/map-editor.js',
  ]);
  assert(!/<script\b[^>]*type="module"/.test(html),'Direct file opening must not require ES-module loading');
  // Catalog and parameters must be usable without the browser, audio or stored settings.
  const context=vm.createContext({});
  for(const src of sources.slice(0,2))vm.runInContext(fs.readFileSync(root+'/'+src,'utf8'),context,{filename:src});
  // World definitions also load without creating a canvas, reading storage or starting a game.
  for(const src of ['js/world.js','js/destruction.js'])vm.runInContext(fs.readFileSync(root+'/'+src,'utf8'),context,{filename:src});
  // Combat definitions must not need DOM, game state, audio or a running loop at load time.
  for(const src of ['js/statistics.js','js/tanks.js','js/weapons.js','js/damage.js','js/pickups.js','js/enemy-ai.js','js/allies.js','js/waves.js'])vm.runInContext(fs.readFileSync(root+'/'+src,'utf8'),context,{filename:src});
  // Rendering/effects definitions load without Canvas, DOM, audio or game state.
  for(const src of ['js/render-world.js','js/render-detail.js','js/render-tanks.js','js/effects.js','js/layout.js','js/defeat.js','js/victory.js','js/render-ui.js','js/renderer.js'])vm.runInContext(fs.readFileSync(root+'/'+src,'utf8'),context,{filename:src});
  // Editor modules define state and functions without reading storage or touching the DOM.
  for(const src of ['js/editor-common.js','js/preset-editor.js','js/map-editor.js'])vm.runInContext(fs.readFileSync(root+'/'+src,'utf8'),context,{filename:src});
  const catalog=vm.runInContext('UI_TEXT',context);
  for(const [,key]of html.matchAll(/data-ui-(?:text|leading|aria-label|alt|placeholder|title)="([^"]+)"/g)){
    assert.equal(typeof catalog[key],'string','Missing static interface text: '+key);
  }
  const label={dataset:{uiText:'startBattle'}},subtitle={textContent:'Случайная карта'};
  const mode={dataset:{uiLeading:'modeOriginal'},firstChild:subtitle,insertions:[],insertBefore(node,before){assert.equal(before,subtitle);this.insertions.push(node);}};
  const aria={getAttribute:()=> 'glavnoe_menyu_ecotank',setAttribute(name,value){this[name]=value;}};
  const document={createTextNode:text=>({textContent:text}),querySelectorAll(selector){
    return selector==='[data-ui-text]'?[label]:selector==='[data-ui-leading]'?[mode]:selector==='[data-ui-aria-label]'?[aria]:[];
  }};
  context.document=document;
  vm.runInContext('applyInterfaceTexts();applyInterfaceTexts();',context);
  assert.equal(label.textContent,'В бой, товарищ!');
  assert.equal(mode.insertions.length,1,'Repeated initialization must not duplicate a mode label');
  assert.equal(mode.insertions[0].textContent,'Манёвры');
  assert.equal(subtitle.textContent,'Случайная карта','Mode subtitle must survive text initialization');
  assert.equal(aria['aria-label'],'Главное меню EcoTank');
  vm.runInContext('KINDS.player.speed=65;CFG.mapSize=45;',context);
  assert.equal(vm.runInContext('KINDS.player.speed',context),65,'Developer parameters must remain mutable');
  assert.equal(vm.runInContext('CFG.mapSize',context),45);
};

if(require.main===module){module.exports(__dirname);console.log('PASS: classic script order, static labels, subtitles, accessibility and mutable configuration');}
