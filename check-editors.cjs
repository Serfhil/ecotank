const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');

module.exports=function checkEditors(root){
  // Definitions load with no DOM, storage, game state or running game loop.
  const context=vm.createContext({});
  for(const src of ['js/ui-text.js','js/config.js','js/editor-common.js','js/preset-editor.js','js/map-editor.js'])vm.runInContext(fs.readFileSync(root+'/'+src,'utf8'),context,{filename:src});
  assert.equal(vm.runInContext('editorPanel',context),null);
  assert.equal(vm.runInContext('mapEditorPanel',context),null);
  const elements=new Map(),globalListeners=new Map();let storageReads=0;
  for(const id of ['editor','editorPanel','btnEditor','mapEditor','mapEditorPanel','mapImport','btnMapEditor'])elements.set(id,{
    listeners:new Map(),blur(){},addEventListener(name,fn){assert(!this.listeners.has(name),'Duplicate editor listener: '+id+'/'+name);this.listeners.set(name,fn);}
  });
  context.document={getElementById:id=>{assert(elements.has(id),'Unexpected DOM lookup: '+id);return elements.get(id);}};
  context.localStorage={getItem(key){assert.equal(key,'ecotank-packs-folded');storageReads++;return '["mine"]';}};
  context.addEventListener=(name,fn)=>{if(!globalListeners.has(name))globalListeners.set(name,[]);globalListeners.get(name).push(fn);};
  vm.runInContext('initPresetEditor();initMapEditor();initPresetEditor();initMapEditor();',context);
  assert.equal(storageReads,1,'Repeated initialization must not reload folded state');
  assert.equal(vm.runInContext('foldedPacks.has("mine")',context),true);
  assert.equal(elements.get('editorPanel').listeners.size,6);
  assert.equal(elements.get('mapEditorPanel').listeners.size,7);
  assert.equal(globalListeners.get('mouseup').length,2,'Each editor must have exactly one mouse-release handler');
  vm.runInContext('painting="B";mapPaint="S";',context);
  for(const fn of globalListeners.get('mouseup'))fn();
  assert.equal(vm.runInContext('painting',context),null);
  assert.equal(vm.runInContext('mapPaint',context),null);
  context.renderCalls=[];context.state='menu';
  vm.runInContext('renderEditor=()=>renderCalls.push("preset");renderMapEditor=()=>renderCalls.push("map");renderMapPick=()=>renderCalls.push("picker");toMenu=()=>renderCalls.push("menu");',context);
  elements.get('btnEditor').listeners.get('click')({currentTarget:elements.get('btnEditor')});
  assert.equal(vm.runInContext('editorOpen',context),true);
  vm.runInContext('closeEditor()',context);assert.equal(vm.runInContext('editorOpen',context),false);
  elements.get('btnMapEditor').listeners.get('click')({currentTarget:elements.get('btnMapEditor')});
  assert.equal(vm.runInContext('mapEdOpen',context),true);
  vm.runInContext('closeMapEditor()',context);assert.equal(vm.runInContext('mapEdOpen',context),false);
  assert.deepEqual(context.renderCalls,['preset','menu','map','picker','menu']);
};

if(require.main===module){module.exports(__dirname);console.log('PASS: editor lifecycle, folded state, event registration and mouse release');}
