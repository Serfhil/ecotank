const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=function checkSappers(root){
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
 run("muted=true;startGame();state='play';toSpawn=[];enemies=[];allies=[];");
 // Засада: 10% клеток зелени, никого рядом со стартом игрока.
 run("grid.fill(EMPTY);for(let r=0;r<8;r++)for(let c=0;c<COLS;c++)grid[r*COLS+c]=TREE;CFG.bomberChance=.1;let total=0,trees=0;for(let n=0;n<40;n++){placeBombers();total+=bombers.length;trees+=grid.filter(t=>t===TREE).length;}var share=total/trees;");
 assert(Math.abs(run('share')-.1)<.02,'Bomber chance per foliage cell: '+run('share'));
 run("grid.fill(TREE);CFG.bomberChance=1;placeBombers();");
 assert(run('bombers.length>0&&bombers.every(q=>Math.hypot(q.x-PLAYER_START.x,q.y-PLAYER_START.y)>BOMBER_TRIGGER)'),'No ambush on the player start');
 // Невидим, пока танк дальше 5 клеток; ближе — выходит, поджигает фитиль и бежит к танку.
 run("grid.fill(EMPTY);grid[5*COLS+5]=TREE;CFG.bomberChance=0;placeBombers();bombers=[{x:5*T+16,y:5*T+16,r:BOMBER_RADIUS,c:5,row:5,state:'hidden',fuse:0,angle:0,walk:0,sparkT:0,pathT:0,path:null}];base=null;player.x=5*T+16+5*T+20;player.y=5*T+16;player.inv=0;player.pw.shield=0;player.hp=player.maxHp=5;updateSappers(.1);");
 assert.equal(run('bombers[0].state'),'hidden','Hidden beyond five cells');
 run("player.x-=30;updateSappers(.1);");
 assert.equal(run('bombers[0].state'),'lit','Lit within five cells');
 assert.equal(run('bombers[0].fuse'),2.5,'Fuse uses developer setting (2.5 s by default)');
 run("var x0=bombers[0].x;for(let i=0;i<30;i++)updateSappers(1/30);");
 assert(run('bombers[0].x>x0+30'),'Bomber runs toward the tank');
 run("player.x=bombers[0].x+15;player.y=bombers[0].y;var hp0=player.hp;updateSappers(1/30);");
 assert(run('bombers.length===0'),'Contact with a tank detonates instantly, long before the fuse ends');
 assert.equal(run('hp0-player.hp'),2,'Bomber blast deals 2 damage');
 run("CFG.bomberFuse=1.5;bombers=[{x:100,y:100,r:BOMBER_RADIUS,c:3,row:3,state:'hidden',fuse:0,angle:0,walk:0,sparkT:0,pathT:0,path:null}];player.x=110;player.y=500;igniteBomber(bombers[0]);for(let i=0;i<40;i++)updateSappers(1/30);var stillLit=bombers.length;for(let i=0;i<10;i++)updateSappers(1/30);");
 assert(run("stillLit===1&&bombers.length===0"),"Configurable fuse");
 run("applyDev({KINDS:{},CFG:{bomberFuse:5}});var oldFuse=CFG.bomberFuse;applyDev({KINDS:{},CFG:{bomberFuse:4},sapperVersion:2});");
 assert(run('oldFuse!==5&&CFG.bomberFuse===4'),'Old saved 5 s fuse is not carried over; new saves are');
 run("bombers=[{x:200,y:200,r:BOMBER_RADIUS,c:6,row:6,state:'lit',fuse:5,angle:0,walk:0,sparkT:0,pathT:0,path:null}];var sc=score;mineFx=[];player.x=215;player.y=200;player.inv=0;player.hp=player.maxHp=9;bullets=[{x:200,y:200,vx:0,vy:0,owner:'p',r:3,dmg:1,life:1,trail:[]}];updateBullets(1/60);updateSappers(1/60);");
 assert(run('bombers[0].state==="down"&&score>sc&&operationStats.enemies.bomber===1&&player.hp===9&&!mineFx.length'),'A shot kills a running bomber without an explosion');
 run("for(let i=0;i<150;i++)updateSappers(1/60);");assert.equal(run('bombers.length'),0,'The body disappears');
 // Мотоцикл в режиме минного поля ставит три мины и уезжает.
 run("CFG.bomberFuse=2.5;grid.fill(EMPTY);player.x=60;player.y=H-60;player.hp=player.maxHp=9;mines=[];var m=makeTank(14*T+16,48,'moto');enemies=[m];initMoto(m);m.mode='field';for(let i=0;i<60*60&&!m.dead;i++){updateEnemy(m,1/60);updateMines(1/60);}");
 assert(run('m.dead&&m.escaped&&m.minesLeft===0&&mines.length===3'),'Field miner lays three mines and leaves');
 run("var mine=mines[0];player.x=mine.x;player.y=mine.y;player.inv=0;var hp1=player.hp;updateMines(1/60);");
 assert(run('hp1-player.hp===2&&mines.length===2'),'Driving onto a mine deals 2 damage');
 // Режим базы: сначала подрывает стену у базы, потом саму базу.
 run("mines=[];player.x=60;player.y=60;const center=Math.floor(COLS/2);grid.fill(EMPTY);for(let r=ROWS-2;r<ROWS;r++)for(let c=center-1;c<=center+1;c++){const i=r*COLS+c,wall=r===ROWS-2||c!==center;grid[i]=wall?BRICK:EMPTY;brickHp[i]=wall?4:0;brickMask[i]=wall?1023:0;}base={...BASE_POS,hp:5,maxHp:5,dead:false};var m2=makeTank(center*T+16,8*T+16,'moto');enemies=[m2];initMoto(m2);m2.mode='base';var wallsGone=false,wallFirst=false;for(let i=0;i<60*60&&!m2.dead;i++){updateEnemy(m2,1/60);updateMines(1/60);if(base.hp<5&&!wallFirst)wallFirst=wallsGone;if(grid[(ROWS-2)*COLS+center]!==BRICK)wallsGone=true;}");
 assert(run('wallsGone&&wallFirst'),'Base miner breaches the wall before the base');
 assert(run('base.hp===3&&m2.dead&&m2.escaped'),'Base charge deals 2 damage, then the miner leaves; hp='+run('base.hp'));
 run("draw();");
 // Курсовой пулемёт: ПКМ стреляет сразу в сторону курсора, башня не участвует.
 run("grid.fill(EMPTY);base=null;mines=[];bombers=[];enemies=[];bullets=[];player=makeTank(300,300,'player');player.angle=-Math.PI/2;player.turret=-Math.PI/2;mouse.x=500;mouse.y=300;mouse.right=true;mouse.down=false;updatePlayer(1/60);");
 assert(run("bullets.length===1&&bullets[0].mg&&Math.abs(Math.atan2(bullets[0].vy,bullets[0].vx))<.1"),'Machine gun fires toward the cursor');
 assert(run("Math.abs(player.turret+Math.PI/2)<.05"),'Machine gun does not use the turret');
 run("updatePlayer(.05);var burst1=bullets.length;updatePlayer(.1);");assert(run("burst1===1&&bullets.length===2"),'Machine gun fire rate');
 run("mouse.right=false;bullets=[];var moto=makeTank(400,300,'moto');enemies=[moto];const shot=()=>bullets.push({x:moto.x-6,y:moto.y,vx:900,vy:0,owner:'p',mg:true,dmg:MG_CONFIG.damage,r:1.5,life:1,trail:[]});shot();updateBullets(1/60);var afterOne=moto.dead;bullets=[];shot();updateBullets(1/60);");
 assert(run("!afterOne&&moto.hp===0&&moto.dead"),'Two machine-gun hits destroy a motorcycle');
 run("bullets=[];var tank=makeTank(400,300,'scout');enemies=[tank];bullets.push({x:tank.x-12,y:tank.y,vx:900,vy:0,owner:'p',mg:true,dmg:MG_CONFIG.damage,r:1.5,life:1,trail:[]});updateBullets(1/60);");
 assert(run("!tank.dead&&tank.hp===tank.maxHp&&bullets.every(b=>b.dead||!bullets.length)"),'Machine gun bounces off tank armor');
 run("enemies=[];bombers=[{x:400,y:300,r:BOMBER_RADIUS,c:12,row:9,state:'lit',fuse:2,angle:0,walk:0,sparkT:0,pathT:0,path:null}];bullets=[{x:394,y:300,vx:900,vy:0,owner:'p',mg:true,dmg:MG_CONFIG.damage,r:1.5,life:1,trail:[]}];updateBullets(1/60);");
 assert(run("bombers[0].state==='down'"),'One machine-gun hit kills a bomber');
 run("grid[9*COLS+14]=BRICK;brickHp[9*COLS+14]=4;brickMask[9*COLS+14]=1023;bullets=[{x:14*T-6,y:9*T+16,vx:900,vy:0,owner:'p',mg:true,dmg:MG_CONFIG.damage,r:1.5,life:1,trail:[]}];updateBullets(1/60);");
 assert(run("brickHp[9*COLS+14]===4&&brickMask[9*COLS+14]===1023"),'Machine gun does not chip bricks');
 // «С»: надпись, следующий выстрел основного орудия — снаряд из НИИ.
 run("grid.fill(EMPTY);bullets=[];rails=[];parts=[];player.rail=2;player.cd=0;");
 b.send('global','keydown',{code:'KeyC'});
 assert(run("player.railArmed&&player.rail===2&&rails.length===0&&parts.some(p=>p.text===UI_TEXT.zaryazhayu_eksperimentalnym)"),'C arms the NII shell with a caption');
 run("keys.KeyC=false;mouse.down=true;updatePlayer(1/60);mouse.down=false;");
 assert(run("rails.length===1&&player.rail===1&&!player.railArmed&&!bullets.some(b=>!b.mg)"),'Next main-gun shot is the NII shell');
 run("player.cd=0;mouse.down=true;updatePlayer(1/60);mouse.down=false;");assert(run("rails.length===1&&bullets.length===1"),'Following shot is a regular shell');
 b.send('global','keydown',{code:'KeyE'});b.send('global','keyup',{code:'KeyE'});assert.equal(run('player.railArmed||rails.length!==1'),false,'E no longer fires NII');
 // Башня вращается вместе с корпусом.
 run("player.angle=0;player.turret=0;mouse.x=player.x;mouse.y=player.y+400;KINDS.player.turretSpeed=0.0001;keys.KeyD=true;updatePlayer(.5);keys.KeyD=false;KINDS.player.turretSpeed=1;");
 assert(run("Math.abs(player.turret-player.angle)<1e-3&&player.angle>1"),'Turning the hull turns the turret');
};
if(require.main===module){module.exports(__dirname);console.log('PASS: foliage ambush chance, five-cell trigger, configurable fuse, chase, blast and shot; field mines and base demolition; machine gun, NII arming on C, hull-carried turret');}
