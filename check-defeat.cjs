const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function checkDefeat(root){
 function boot(failImages=false){
  const elements=new Map(),globalEvents=new Map(),draws=[],loaded=[];let created=0;
  function element(id){if(elements.has(id))return elements.get(id);
   const alphaStack=[],calls=new Map(),canvas=new Proxy({globalAlpha:1,save(){alphaStack.push(this.globalAlpha);},restore(){this.globalAlpha=alphaStack.pop();},createLinearGradient:()=>({addColorStop(){}}),drawImage(...args){draws.push(Object.assign([id,'image',...args],{alpha:this.globalAlpha}));},fillText(value){draws.push(Object.assign([id,'text',value],{alpha:this.globalAlpha}));}},{get:(o,k)=>k in o?o[k]:(()=>{})});
   const el={id,hidden:false,style:{},classList:{toggle(){}},tagName:'DIV',addEventListener:(name,fn)=>{if(!calls.has(name))calls.set(name,[]);calls.get(name).push(fn);},calls,getContext:()=>canvas,querySelector:()=>element(id+' child'),querySelectorAll:()=>[],blur(){}};elements.set(id,el);return el;
  }
  const saved=new Map();let seed=12345;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const box=vm.createContext({Math:math,document:{getElementById:element,createElement:tag=>element('created '+tag+(created++)),querySelectorAll:()=>[],activeElement:element('focus')},window:{},innerWidth:1280,innerHeight:720,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},addEventListener:(name,fn)=>{if(!globalEvents.has(name))globalEvents.set(name,[]);globalEvents.get(name).push(fn);},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},Audio:class{addEventListener(){}play(){return {catch(){}};}pause(){}},Image:class{constructor(){this.naturalWidth=1680;this.naturalHeight=940;}set src(value){this.source=value;loaded.push(value);if(failImages)this.onerror();else this.onload();}}});
  const html=fs.readFileSync(root+'/index.html','utf8');for(const [,attrs,code]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){const src=attrs.match(/src="([^"]+)"/)?.[1];vm.runInContext(src?fs.readFileSync(root+'/'+src,'utf8'):code,box);}
  const run=code=>vm.runInContext(code,box);
  const send=(scope,name,event={})=>{const value={target:element('body'),currentTarget:element('body'),preventDefault(){},repeat:false,...event};for(const fn of (scope==='global'?globalEvents:element(scope).calls).get(name)||[])fn(value);};
  return {run,send,elements,draws,loaded,saved};
 }
 for(const tier of [0,1,2])for(const cause of ['player','base']){
  const b=boot();assert.equal(b.loaded.length,4,'Preload all three images');b.run(`muted=true;CFG.mapMode='original';startGame();grid.fill(EMPTY);enemies=[];toSpawn=['soldier'];setPlayerUpgrade(player,${tier});score=5555;player.inv=0;player.pw.shield=0;keys.Enter=true;mouse.down=true;${cause==='player'?"hitPlayer({x:player.x,y:player.y,dmg:99});":"hitBase(99);"}`);
  assert.equal(b.run('defeatTier'),tier);
  assert.notEqual(b.run('state'),'over','Let blasts finish before the illustration');
  for(let i=0;i<900&&b.run('state')!=='over';i++){
   if(!b.run('defeatBlastsFinished()'))assert.notEqual(b.run('state'),'over');
   b.run('hitstop=0;update(.025)');
  }
  assert.equal(b.run('state'),'over');assert.equal(b.run('defeatBlastsFinished()'),true);assert.equal(b.run('overT'),0);
  assert.equal(b.run('best'),5555);assert.equal(+b.saved.get('ecotank-best'),5555);
  b.run('player=null;syncUI()');b.draws.length=0;b.run('draw()');
  const rendered=b.draws.find(d=>d[1]==='image'&&d[2].source);assert.equal(rendered[2].source,b.loaded[tier],'Captured tier survives cleared player');
  assert.deepEqual(b.draws.filter(d=>d[1]==='text').map(d=>d[2]),['ПОРАЖЕНИЕ'],'No HUD, score, wave, scrap or best');
  assert.equal(b.elements.get('defeatScreen').hidden,false);assert.equal(b.elements.get('defeatRestart').hidden,true);
  b.send('global','keydown',{code:'Enter'});assert.equal(b.run('state'),'over');
  b.send('global','keyup',{code:'Enter'});b.send('global','mouseup');
  assert.equal(b.run('defeatOpacity()'),0);
  assert.equal(b.draws.find(d=>d[0]==='defeatCanvas'&&d[1]==='image'&&d[2]===b.run('defeatArtworkCanvas')).alpha,0);
  const frozen=b.run('defeatFrame');b.draws.length=0;
  b.run('update(.5);draw();syncUI()');assert.equal(b.run('defeatOpacity()'),.5);
  assert.equal(b.draws.find(d=>d[0]==='defeatCanvas'&&d[1]==='image'&&d[2]===b.run('defeatArtworkCanvas')).alpha,.5);
  assert.equal(b.draws.find(d=>d[1]==='image'&&d[2].source).alpha,1,'Artwork is composed opaquely before group fade');
  assert.equal(b.run('defeatFrame'),frozen,'Reuse one frozen frame');
  b.run('innerWidth=390;innerHeight=844;draw()');assert.equal(b.run('defeatFrame'),frozen,'Resize must not capture a new battlefield');
  assert(!b.draws.some(d=>d[0]==='c'||d[0]==='hudCanvas'),'Do not redraw battle or HUD beneath the transition');
  b.run('update(.5);draw();syncUI()');assert.equal(b.run('defeatOpacity()'),1);
  assert.equal(b.elements.get('defeatRestart').hidden,true,'Delay begins AFTER fade');
  b.run('update(1.99);syncUI()');assert.equal(b.elements.get('defeatRestart').hidden,true);
  b.send('global','keydown',{code:'Enter'});assert.equal(b.run('state'),'over');
  b.run('update(.01);syncUI()');assert.equal(b.elements.get('defeatRestart').hidden,false);
  b.send('global','keydown',{code:'Enter',repeat:true});assert.equal(b.run('state'),'over','Held Enter must not restart');
  b.send('defeatRestart','click',{detail:0});assert.equal(b.run('state'),'over','Native repeat click cannot bypass key gate');
  b.send('global','keyup',{code:'Enter'});b.send('global','keydown',{code:'Enter'});assert.equal(b.run('state'),'play');assert.equal(b.run('player.upgrade'),0);assert.equal(b.run('score'),0);assert.equal(b.run('best'),5555);assert.equal(b.run('mouse.down||keys.Space||keys.Enter'),false);
 }
 const HUD_GAP=11.99,layout=boot();
 for(const [width,height]of [[320,568],[390,844],[800,450],[960,640],[1280,720],[1920,1080]])for(const cols of [30,45,60]){
  layout.run('innerWidth='+width+';innerHeight='+height+';CFG.mapSize='+cols+';startGame();fit();');
  const positions=JSON.parse(layout.run('JSON.stringify(gameLayout)')),f=positions.field,h=positions.hud;
  for(const r of [f,h])assert(r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=width+.001&&r.y+r.height<=height+.001,'Layout inside viewport');
  assert(Math.abs(f.width/f.height-1.5)<1e-9,'Keep map aspect');
  if(h.compact)assert(h.y>=f.y+f.height+HUD_GAP,'Panel below map');else assert(h.x>=f.x+f.width+HUD_GAP,'Panel right of map');
  for(const [u,v]of [[0,0],[.5,.5],[1,1]]){
   const point=JSON.parse(layout.run('JSON.stringify(pointerToWorld('+ (f.x+f.width*u) +','+ (f.y+f.height*v) +','+JSON.stringify({left:f.x,top:f.y,width:f.width,height:f.height})+'))'));
   assert(Math.abs(point.x-cols*32*u)<1e-6&&Math.abs(point.y-cols*2/3*32*v)<1e-6,'Pointer matches moved/scaled map');
  }
 }
 layout.run('toMenu();fit()');assert.equal(layout.run('gameLayout.hud'),null);
 layout.run('startGame();editorOpen=true;fit()');assert.equal(layout.run('gameLayout.hud'),null);
 layout.run('editorOpen=false;mapEdOpen=true;fit()');assert.equal(layout.run('gameLayout.hud'),null);
 layout.run('mapEdOpen=false;innerWidth=1280;innerHeight=720;startGame();setPlayerUpgrade(player,2);player.rail=2;player.pw.shield=6;player.pw.rapid=4;score=123;scrap=45;');
 layout.draws.length=0;layout.run('draw()');
 for(const label of ['Боевая сводка','ИС-2-II','ХП','Очки','Металлолом','Рельсотрон','Щит','Скорострел','Ускорение','123','45']){
  assert(layout.draws.some(d=>d[0]==='hudCanvas'&&d[1]==='text'&&d[2]===label),'HUD value/label '+label);
  assert(!layout.draws.some(d=>d[0]==='c'&&d[1]==='text'&&d[2]===label),'HUD must not paint on battlefield');
 }
 const pointer=boot();pointer.run("muted=true;startGame();rememberDefeatTier();enterDefeat();overT=2.99;syncUI();");
 pointer.send('defeatScreen','mousedown',{button:0});assert.equal(pointer.run('state'),'over');pointer.run('update(.02)');pointer.send('defeatScreen','mousedown',{button:0});assert.equal(pointer.run('state'),'over','Held pointer cannot start after timeout');pointer.send('global','mouseup');
 pointer.send('defeatScreen','mousedown',{button:0,target:pointer.elements.get('defeatRestart')});pointer.send('global','mouseup');pointer.send('defeatRestart','click',{detail:1});assert.equal(pointer.run('state'),'play','Actual button restarts');
 pointer.run('rememberDefeatTier();enterDefeat();overT=3;mouse.down=false');pointer.send('defeatScreen','mousedown',{button:0});assert.equal(pointer.run('state'),'play','Fresh background click restarts');
 const camp=boot();camp.run("muted=true;CFG.mapMode='campaign';unlockCampaign(2);CFG.campaignStart=1;startGame();const failedId=activeMap.id;const failedWave=wave;hitBase(99);for(let i=0;i<900&&state!=='over';i++){hitstop=0;update(.025);}overT=3;requestDefeatRestart(false);");
 assert.equal(camp.run("state==='play'&&wave===failedWave&&activeMap.id===failedId&&!victory"),true,'Retry the failed campaign level');
 camp.run('winCampaign();update(2);syncUI()');assert.equal(camp.elements.get('defeatScreen').hidden,true);assert.equal(camp.elements.get('victoryScreen').hidden,false,'Campaign victory uses new screen');
 const failed=boot(true);failed.run('muted=true;startGame();enterDefeat();overT=3;syncUI()');failed.draws.length=0;failed.run('draw()');assert(!failed.draws.some(d=>d[1]==='image'&&d[2].source),'Missing image uses fallback');assert(failed.draws.some(d=>d[2]==='ПОРАЖЕНИЕ'));assert.equal(failed.elements.get('defeatRestart').hidden,false);
 console.log('PASS: defeat art tiers, fatal snapshots, frozen frame, 1-second fade, 2-second post-fade gate, held inputs, button/canvas restart, campaign retry, victory, image fallback, HUD geometry/values/pointer');
};
if(require.main===module)module.exports(__dirname);
