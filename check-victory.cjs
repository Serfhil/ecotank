const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function checkVictory(root){
 function boot(failImages=false){
  const elements=new Map(),globalEvents=new Map(),draws=[],loaded=[];let created=0;
  function element(id){if(elements.has(id))return elements.get(id);
   const alphaStack=[],calls=new Map(),canvas=new Proxy({globalAlpha:1,save(){alphaStack.push(this.globalAlpha);},restore(){this.globalAlpha=alphaStack.pop();},fillRect(...args){draws.push([id,"fill",this.fillStyle,...args]);},createLinearGradient:()=>({addColorStop(){}}),drawImage(...args){draws.push(Object.assign([id,'image',...args],{alpha:this.globalAlpha}));},fillText(value){draws.push(Object.assign([id,'text',value],{alpha:this.globalAlpha}));}},{get:(o,k)=>k in o?o[k]:(()=>{})});
   const el={id,hidden:false,style:{},classList:{toggle(){}},tagName:'DIV',addEventListener:(name,fn)=>{if(!calls.has(name))calls.set(name,[]);calls.get(name).push(fn);},calls,getContext:()=>canvas,querySelector:()=>element(id+' child'),querySelectorAll:()=>[],blur(){}};elements.set(id,el);return el;
  }
  const saved=new Map();let seed=12345;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const box=vm.createContext({Math:math,document:{getElementById:element,createElement:tag=>element('created '+tag+(created++)),querySelectorAll:()=>[],activeElement:element('focus')},window:{},innerWidth:1280,innerHeight:720,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){},addEventListener:(name,fn)=>{if(!globalEvents.has(name))globalEvents.set(name,[]);globalEvents.get(name).push(fn);},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},Audio:class{addEventListener(){}play(){return {catch(){}};}pause(){}},Image:class{constructor(){this.naturalWidth=1680;this.naturalHeight=940;}set src(value){this.source=value;loaded.push(value);if(failImages)this.onerror();else this.onload();}}});
  const html=fs.readFileSync(root+'/index.html','utf8');for(const [,attrs,code]of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){const src=attrs.match(/src="([^"]+)"/)?.[1];vm.runInContext(src?fs.readFileSync(root+'/'+src,'utf8'):code,box);}
  const run=code=>vm.runInContext(code,box);
  const send=(scope,name,event={})=>{const value={target:element('body'),currentTarget:element('body'),preventDefault(){},repeat:false,...event};for(const fn of (scope==='global'?globalEvents:element(scope).calls).get(name)||[])fn(value);};
  return {run,send,elements,draws,loaded,saved};
 }
 const b=boot(),run=b.run;
 run("muted=true;CFG.mapMode='campaign';CFG.campaignStart=0;startGame();grid.fill(EMPTY);enemies=[];toSpawn=[];");
 for(const kind of ['scout','soldier','heavy','artillery']) {
   run(`{const e=makeTank(200,100,'${kind}');e.spawnT=0;enemies.push(e);hitEnemy(e,{x:e.x,y:e.y,dmg:999});hitEnemy(e,{x:e.x,y:e.y,dmg:999});}`);
   assert.equal(run(`operationStats.enemies.${kind}`),1);
 }
 run("{const i=3*COLS+3;grid[i]=BRICK;brickHp[i]=4;brickMask[i]=1023;hitBrick(3,3,1);}");
 assert.equal(run('operationStats.bricks'),0);
 run('for(let n=0;n<8;n++)hitBrick(3,3,1)');assert.equal(run('operationStats.bricks'),1);
 run("{const i=4*COLS+4;grid[i]=TREE;foliageMask[i]=31;}");
 run('for(let n=0;n<4;n++)hitFoliage(4,4,144,144,{})');assert.equal(run('operationStats.foliage'),0);
 run('hitFoliage(4,4,144,144,{});hitFoliage(4,4,144,144,{})');assert.equal(run('operationStats.foliage'),1);
 const before=run('operationStats.flocks');run("{const i=5*COLS+5;grid[i]=TREE;foliageMask[i]=31;const random=Math.random;Math.random=()=>0;hitFoliage(5,5,176,176,{});Math.random=random;}");assert.equal(run('operationStats.flocks'),before+1,'Count a flock once, not each bird');
 run("{const a=makeTank(100,100,'ally');a.inv=0;hitAlly(a,{x:100,y:100,dmg:9});hitAlly(a,{x:100,y:100,dmg:9});}player.inv=0;player.pw.shield=0;hitPlayer({x:player.x,y:player.y,dmg:99});hitPlayer({x:0,y:0,dmg:99});");
 assert.equal(run('operationStats.allies'),1);assert.equal(run('operationStats.deaths'),1);
 run("for(let i=0;i<900&&state!=='over';i++){hitstop=0;update(.025);}overT=3;requestDefeatRestart(false);");
 assert.equal(run('operationStats.deaths'),1,'Retry preserves deaths');assert.equal(run('operationStats.enemies.heavy'),1,'Retry preserves kills');
 run('nextWave()');assert.equal(run('operationStats.bricks'),1,'Next level preserves counters');
 run('keys.Enter=true;mouse.down=true;score=9876;winCampaign();syncUI();draw()');
 assert.equal(run('victoryStats.deaths'),1);assert.equal(run('Object.isFrozen(victoryStats)&&Object.isFrozen(victoryStats.enemies)'),true);
 assert.equal(run('best'),9876);assert.equal(+b.saved.get('ecotank-best'),9876);assert.equal(run('CFG.campaignStart'),0);
 assert.equal(run("requestVictoryAction('new')||requestVictoryAction('award')"),false);
 assert.equal(b.elements.get('gameHud').hidden,true);
 const frame=run('victoryFrame');run('update(.5);draw()');assert(b.draws.some(d=>d[0]==='victoryCanvas'&&d[1]==='fill'&&d[2]==='rgba(0,0,0,0.5)'));assert.equal(run('victoryTime'),.5);assert.equal(run('victoryFrame'),frame);
 run('update(.5);draw()');assert.equal(run('victoryTime'),1);assert(b.draws.some(d=>d[0]==='victoryCanvas'&&d[1]==='fill'&&d[2]==='rgba(0,0,0,1)'));
 run('update(.5);draw()');assert.equal(run('victoryTime'),1.5);
 run('update(.5);syncUI();draw()');assert.equal(run("victoryCanAct('award')"),true);assert.equal(b.elements.get('victorySkip').hidden,false);
 b.send('victorySkip','click',{detail:0});assert.equal(run('victoryAwardTime'),null,'Held combat input cannot skip');
 b.send('global','keyup',{code:'Enter'});b.send('global','mouseup');run('update(.01)');
 b.send('victorySkip','keydown',{code:'Enter',stopPropagation(){}});b.send('victorySkip','keyup',{code:'Enter',stopPropagation(){}});
 assert.notEqual(run('victoryAwardTime'),null,'Fresh keyboard activation skips');assert.equal(run("requestVictoryAction('new')"),false,'Let award fade finish');
 run('update(1);syncUI()');assert.equal(b.elements.get('victoryAward').hidden,false);assert.equal(b.elements.get('victoryNew').hidden,false);
 assert.equal(run('requestVictoryAction("new")'),true);assert.equal(run('wave'),1);assert.equal(run('operationStats.deaths'),0);assert.equal(run('state'),'play');
 run('winCampaign();update(100);update(1);requestVictoryAction("home")');assert.equal(run('state'),'menu');
 run("CFG.mapMode='original';startGame();winCampaign()");assert.equal(run('victory'),false,'No campaign victory in infinite mode');
 for(const [w,h]of [[1280,720],[390,844]]) {run(`innerWidth=${w};innerHeight=${h};CFG.mapMode='campaign';startGame();winCampaign();update(2);draw();syncUI();`);assert.equal(run('victoryCanvas.width'),w);assert.equal(run('victoryCanvas.height'),h);}
 const natural=boot();natural.run("muted=true;CFG.mapMode='campaign';startGame();wave=campaign.length;enemies=[];toSpawn=[];artilleryShells=[];resetArtillery();wrecks=[{kind:'scout',x:100,y:100,age:0,detonateAt:.5,exploded:false,smokeT:1,taken:true}];update(.1)");
 assert.equal(natural.run('victory'),false,'Wait for wreck detonation');
 natural.run("wrecks=[];state='between';betweenT=.01;update(.02)");assert.equal(natural.run('victory'),true,'Last campaign level reaches victory through main loop');
 natural.run('draw();update(.5)');natural.draws.length=0;natural.run('draw()');assert(!natural.draws.some(d=>d[0]==='c'||d[0]==='hudCanvas'),'Battle remains frozen during transition');
 const fallback=boot(true);fallback.run("CFG.mapMode='campaign';startGame();winCampaign();update(100);update(1);draw();syncUI()");assert.equal(fallback.run('victoryImageLoaded'),false);assert.equal(fallback.elements.get('victoryNew').hidden,false);
 assert.equal(run('STAT_ENEMY_TYPES.length'),4);
 for(const kind of ['scout','soldier','heavy','artillery'])assert(b.elements.has('victoryModel-'+kind));
 console.log('PASS: victory transitions, event statistics, retries/reset, immutable totals, held input, keyboard, award, campaign restart, fallback and responsive canvas');
};
if(require.main===module)module.exports(__dirname);
