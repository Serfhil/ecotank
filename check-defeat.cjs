const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function checkDefeat(root){
 function boot(failImages=false){
  const elements=new Map(),globalEvents=new Map(),draws=[],loaded=[];
  function element(id){if(elements.has(id))return elements.get(id);
   const calls=new Map(),canvas=new Proxy({createLinearGradient:()=>({addColorStop(){}}),drawImage(...args){draws.push([id,'image',...args]);},fillText(value){draws.push([id,'text',value]);}},{get:(o,k)=>k in o?o[k]:(()=>{})});
   const el={id,hidden:false,style:{},classList:{toggle(){}},tagName:'DIV',addEventListener:(name,fn)=>{if(!calls.has(name))calls.set(name,[]);calls.get(name).push(fn);},calls,getContext:()=>canvas,querySelector:()=>element(id+' child'),querySelectorAll:()=>[],blur(){}};elements.set(id,el);return el;
  }
  const saved=new Map();let seed=12345;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const box=vm.createContext({Math:math,document:{getElementById:element,createElement:tag=>element('created '+tag),querySelectorAll:()=>[],activeElement:element('focus')},window:{},innerWidth:1280,innerHeight:720,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},addEventListener:(name,fn)=>{if(!globalEvents.has(name))globalEvents.set(name,[]);globalEvents.get(name).push(fn);},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},Audio:class{addEventListener(){}play(){return {catch(){}};}pause(){}},Image:class{constructor(){this.naturalWidth=1680;this.naturalHeight=940;}set src(value){this.source=value;loaded.push(value);if(failImages)this.onerror();else this.onload();}}});
  const html=fs.readFileSync(root+'/index.html','utf8');for(const [,attrs,code]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){const src=attrs.match(/src="([^"]+)"/)?.[1];vm.runInContext(src?fs.readFileSync(root+'/'+src,'utf8'):code,box);}
  const run=code=>vm.runInContext(code,box);
  const send=(scope,name,event={})=>{const value={target:element('body'),currentTarget:element('body'),preventDefault(){},repeat:false,...event};for(const fn of (scope==='global'?globalEvents:element(scope).calls).get(name)||[])fn(value);};
  return {run,send,elements,draws,loaded,saved};
 }
 for(const tier of [0,1,2])for(const cause of ['player','base']){
  const b=boot();assert.equal(b.loaded.length,3,'Preload all three images');b.run(`muted=true;CFG.mapMode='original';startGame();grid.fill(EMPTY);enemies=[];toSpawn=['soldier'];setPlayerUpgrade(player,${tier});score=5555;player.inv=0;player.pw.shield=0;keys.Enter=true;mouse.down=true;${cause==='player'?"hitPlayer({x:player.x,y:player.y,dmg:99});":"hitBase(99);"}`);
  assert.equal(b.run('defeatTier'),tier);
  assert.notEqual(b.run('state'),'over','Let blasts finish before the illustration');
  for(let i=0;i<900&&b.run('state')!=='over';i++){
   if(!b.run('defeatBlastsFinished()'))assert.notEqual(b.run('state'),'over');
   b.run('hitstop=0;update(.025)');
  }
  assert.equal(b.run('state'),'over');assert.equal(b.run('defeatBlastsFinished()'),true);assert.equal(b.run('overT'),0);
  assert.equal(b.run('best'),5555);assert.equal(+b.saved.get('ecotank-best'),5555);
  b.run('player=null;syncUI()');b.draws.length=0;b.run('draw()');
  const rendered=b.draws.find(d=>d[1]==='image');assert.equal(rendered[2].source,b.loaded[tier],'Captured tier survives cleared player');
  assert.deepEqual(b.draws.filter(d=>d[1]==='text').map(d=>d[2]),['ПОРАЖЕНИЕ'],'No HUD, score, wave, scrap or best');
  assert.equal(b.elements.get('defeatScreen').hidden,false);assert.equal(b.elements.get('defeatRestart').hidden,true);
  b.send('global','keydown',{code:'Enter'});assert.equal(b.run('state'),'over');
  b.send('global','keyup',{code:'Enter'});b.send('global','mouseup');
  b.run('update(1.99);syncUI()');assert.equal(b.elements.get('defeatRestart').hidden,true);
  b.send('global','keydown',{code:'Enter'});assert.equal(b.run('state'),'over');
  b.run('update(.01);syncUI()');assert.equal(b.elements.get('defeatRestart').hidden,false);
  b.send('global','keydown',{code:'Enter',repeat:true});assert.equal(b.run('state'),'over','Held Enter must not restart');
  b.send('defeatRestart','click',{detail:0});assert.equal(b.run('state'),'over','Native repeat click cannot bypass key gate');
  b.send('global','keyup',{code:'Enter'});b.send('global','keydown',{code:'Enter'});assert.equal(b.run('state'),'play');assert.equal(b.run('player.upgrade'),0);assert.equal(b.run('score'),0);assert.equal(b.run('best'),5555);assert.equal(b.run('mouse.down||keys.Space||keys.Enter'),false);
 }
 const pointer=boot();pointer.run("muted=true;startGame();rememberDefeatTier();enterDefeat();overT=1.99;syncUI();");
 pointer.send('defeatScreen','mousedown',{button:0});assert.equal(pointer.run('state'),'over');pointer.run('update(.02)');pointer.send('defeatScreen','mousedown',{button:0});assert.equal(pointer.run('state'),'over','Held pointer cannot start after timeout');pointer.send('global','mouseup');
 pointer.send('defeatScreen','mousedown',{button:0,target:pointer.elements.get('defeatRestart')});pointer.send('global','mouseup');pointer.send('defeatRestart','click',{detail:1});assert.equal(pointer.run('state'),'play','Actual button restarts');
 pointer.run('rememberDefeatTier();enterDefeat();overT=2;mouse.down=false');pointer.send('defeatScreen','mousedown',{button:0});assert.equal(pointer.run('state'),'play','Fresh background click restarts');
 const camp=boot();camp.run("muted=true;CFG.mapMode='campaign';unlockCampaign(2);CFG.campaignStart=1;startGame();const failedId=activeMap.id;const failedWave=wave;hitBase(99);for(let i=0;i<900&&state!=='over';i++){hitstop=0;update(.025);}overT=2;requestDefeatRestart(false);");
 assert.equal(camp.run('wave===failedWave&&activeMap.id===failedId&&!victory'),true,'Retry the failed campaign level');
 camp.run('winCampaign();overT=1;syncUI()');assert.equal(camp.elements.get('defeatScreen').hidden,true);camp.draws.length=0;camp.run('draw()');assert(camp.draws.some(d=>d[1]==='text'&&d[2]===camp.run('UI_TEXT.kampaniya_proydena')),'Preserve campaign victory');
 const failed=boot(true);failed.run('muted=true;startGame();enterDefeat();overT=2;syncUI()');failed.draws.length=0;failed.run('draw()');assert(!failed.draws.some(d=>d[1]==='image'),'Missing image uses fallback');assert(failed.draws.some(d=>d[2]==='ПОРАЖЕНИЕ'));assert.equal(failed.elements.get('defeatRestart').hidden,false);
 console.log('PASS: defeat art tiers, fatal snapshots, blast completion, 2-second gate, held inputs, button/canvas restart, campaign retry, victory, image fallback');
};
if(require.main===module)module.exports(__dirname);
