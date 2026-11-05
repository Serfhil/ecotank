const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function checkSupport(root){
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
 run("muted=true;startGame();grid.fill(EMPTY);allies=[];player.x=300;player.y=200;base=null;const h=makeTank(300,-32,'heavy');h.entering=true;h.angle=h.turret=Math.PI/2;h.cd=.25;enemies=[h];bullets=[];");
 for(let i=0;i<90&&!run('bullets.length');i++)run('updateEnemy(h,1/60)');
 assert(run('bullets.length>0&&h.entering'),'Heavy fires before entry ends');assert(run('bullets.every(b=>b.y>=0)'),'No outside projectile');
 run('const previousCd=h.cd;h.y=47;updateEnemy(h,.04)');assert.equal(run('h.entering'),false);assert(Math.abs(run('h.cd')-run('previousCd')+.04)<1e-9,'No entry reload reset');
 for(const count of [0,1,4,5,9]){
  run(`resetArtillery();enemies=Array.from({length:${count}},(_,i)=>{const e=makeTank(100+i*30,i===0?-20:100,'scout');e.entering=i===0;return e;});callBarrage();`);
  assert.equal(run('barrageMarkers.length'),Math.max(5,count));
  if(count)assert.equal(run('barrageMarkers[0].ty'),8,'Entering target is included and clamped inside map');
  assert(run(`barrageMarkers.slice(${count}).every(p=>p.ty>=16&&p.ty<=H/2-16)`),'Extra targets stay in top half');
 }
 for(const fps of [30,60,144]){
  run("resetArtillery();enemies=[];callBarrage();globalThis.impacts=[];globalThis.savedExplosion=explosion;explosion=()=>impacts.push(supportClock);blastDamage=()=>{};");
  for(let i=0;i<fps*6;i++)run(`updateArtilleryShells(${1/fps})`);
  assert.equal(run('impacts.length'),5);assert(run('impacts.every((t,i)=>!i||t-impacts[i-1]>=.06-1e-9)'),'Impact intervals at '+fps+' FPS');
  assert.equal(run('hasPendingBarrage()'),0);assert.equal(run('artilleryShells.length'),0);run('explosion=savedExplosion');
 }
 run('resetArtillery()');assert.equal(run('supportClock'),0);
 // Support checks below.
 console.log('PASS: heavy aims/fires during entry, safe muzzle and continuous cooldown');
};if(require.main===module)module.exports(__dirname);
