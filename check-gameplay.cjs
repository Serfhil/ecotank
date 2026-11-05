const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function checkGameplay(root){
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
 const hud=boot(),run=hud.run;
 run("muted=true;innerWidth=960;innerHeight=720;startGame();enemies=[];allies=[];setPlayerUpgrade(player,2);player.hp=7;draw()");
 assert.equal(hud.draws.filter(d=>d[0]==='hudCanvas'&&d[1]==='fill'&&d[2]==='#ed3d43').length,7,'Seven distinct filled health cells');
 run("{const p=gameLayout.hud.panels.left,f=gameLayout.field;player.x=(p.x+p.w*.7-f.x)/f.width*W;player.y=(p.y+p.h/2-f.y)/f.height*H;}hudOpacity={left:1,right:1,score:1};updateHud(.5)");
 assert(Math.abs(run('hudOpacity.left')-.6)<1e-9);assert.equal(run('hudOpacity.right'),1);
 run('updateHud(.5)');assert(Math.abs(run('hudOpacity.left')-.2)<1e-9);
 run('player.x=W/2;player.y=H/2;updateHud(.5)');assert(Math.abs(run('hudOpacity.left')-.6)<1e-9);
 run('updateHud(.5)');assert.equal(run('hudOpacity.left'),1);
 for(const kind of ['soldier','ally']){
  run(`player.x=W/2;player.y=H/2;{const p=gameLayout.hud.panels.right,f=gameLayout.field,t=makeTank((p.x+p.w*.3-f.x)/f.width*W,(p.y+p.h/2-f.y)/f.height*H,'${kind}');enemies=[];allies=[];${kind==='ally'?'allies':'enemies'}=[t];}updateHud(1)`);
  assert(Math.abs(run('hudOpacity.right')-.2)<1e-9,kind+' fades HUD');
 }
 const steel=boot(),sr=steel.run;
 sr("muted=true;startGame();grid.fill(EMPTY);for(let r=2;r<12;r++)for(let c=2;c<12;c++)grid[r*COLS+c]=STEEL;");
 for(const [x0,y0,x1,y1,x,y]of [[64,176,384,176,160,176],[176,64,176,384,176,160],[64,64,384,384,176,176]]) {
   sr(`steelDamage.clear();carveSteelRay(${x0},${y0},${x1},${y1});`);
   assert.equal(sr(`bulletBlocked(${x},${y},3)`),false,'Shell fits through channel');
   assert.equal(sr(`bulletBlocked(${x},${y},9)`),true,'Oversized shell hits remaining steel');
   assert.equal(sr('blocksTank(STEEL)'),true);
 }
 sr('steelDamage.clear();carveSteelRay(64,176,384,176);carveSteelRay(176,64,176,384)');
 assert.equal(sr('bulletBlocked(176,176,3)'),false);assert.equal(sr('bulletBlocked(150,150,3)'),true);
 sr("player.x=40;player.y=176;player.angle=player.turret=0;player.rail=1;enemies=[];fireRail(player)");
 assert.equal(sr('player.rail'),0);assert.equal(sr('bulletBlocked(320,176,3)'),false,'NII traverses multiple adjacent steel cells');
 sr("bullets=[{x:70,y:176,vx:200,vy:0,r:3,dmg:1,owner:'p',life:3}];base=null;updateBullets(1)");assert.equal(sr('bullets.length'),1,'Ordinary shell traverses hole');
 sr('genMap(1)');assert.equal(sr('steelDamage.size'),0,'New map resets steel damage');
 const bonus=boot(),ar=bonus.run;
 ar("muted=true;CFG.allies=true;startGame();grid.fill(EMPTY);enemies=[];toSpawn=[];allies=[makeTank(100,200,'ally')];allies[0].ally=true;const a=allies[0];const originalHp=player.hp;items=[];");
 ar("const item=type=>({type,x:a.x,y:a.y,life:10});");
 assert.equal(ar("applyItem(a,item('repair'))"),false,'Full-health ally leaves repair');
 ar("applyItem(a,item('upgrade'))");assert.equal(ar('a.maxHp'),5);assert.equal(ar('a.upgradeT'),ar('UPGRADE_DURATION'));assert.equal(ar('player.upgrade'),0);
 ar('updateAlly(a,UPGRADE_DURATION);a.inv=0;a.hp=2;');ar("applyItem(a,item('repair'))");assert.equal(ar('a.hp'),4);assert.equal(ar('player.hp'),ar('originalHp'));
 ar("applyItem(a,item('shield'));hitAlly(a,{x:a.x,y:a.y,dmg:99})");assert.equal(ar('a.hp'),4,'Shield protects ally');
 ar("applyItem(a,item('rapid'));const timer=a.pw.rapid;updateAlly(a,.25)");assert(ar('a.pw.rapid<timer'),'Own bonus timer runs');
 ar("items=[item('upgrade')];applyItem(a,items[0]);updateAlly(a,UPGRADE_DURATION);a.inv=0;bullets=[];fire(a)");assert.equal(ar('a.maxHp'),7);assert.equal(ar('bullets.length'),2);assert(ar('bullets.every(b=>b.armor)'));
 assert.equal(ar("applyItem(a,item('upgrade'))"),false,'Max upgrade not consumed');
 ar("applyItem(a,item('rail'));a.turret=0;a.cd=0;enemies=[makeTank(a.x+100,a.y,'heavy')];updateAlly(a,.01)");assert.equal(ar('a.rail'),0,'AI uses its NII shell');assert(ar('enemies[0].dead'));
 ar("applyItem(a,item('barrage'))");assert(ar('hasPendingBarrage()'),'Ally calls friendly barrage');
 ar("a.upgradeT=0;a.pw.shield=0;const b=makeTank(a.x,a.y,'ally');b.ally=true;allies.push(b);player.x=500;player.y=500;items=[item('shield')];updateItems(0)");assert.equal(ar('items.length'),0);assert.equal(ar('a.pw.shield>0&&b.pw.shield===0'),true,'One recipient per item');
 ar("grid.fill(EMPTY);a.x=100;a.y=200;a.tx=a.x;a.ty=a.y;a.pw.shield=0;for(let r=0;r<ROWS;r++)grid[r*COLS+5]=WATER;items=[{type:'shield',x:200,y:200,life:10},{type:'shield',x:130,y:200,life:10}];a.itemScanT=0;updateAlly(a,.1)");assert.equal(ar('a.itemGoal===items[1]'),true,'Choose reachable pickup instead of closer blocked route');
 ar('items=[];updateAlly(a,.1)');assert.equal(ar('a.itemGoal'),null,'Forget removed item');
 ar("grid.fill(EMPTY);items=[{type:'shield',x:a.x+5*T+1,y:a.y,life:10}];a.itemScanT=0;updateAlly(a,.1)");assert.equal(ar('a.itemGoal'),null,'Respect five-cell radius');
 // More gameplay checks below.
 console.log('PASS: corner HUD, steel channels, shared pickup effects, allied upgrades/AI and reachability');
};
if(require.main===module)module.exports(__dirname);
