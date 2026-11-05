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
 // More gameplay checks below.
 console.log('PASS: corner HUD cells, independent time-based fades and model overlap');
};
if(require.main===module)module.exports(__dirname);
