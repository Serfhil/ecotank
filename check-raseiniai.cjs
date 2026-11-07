const vm = require('node:vm');

module.exports = function checkRaseiniai(box) {
  vm.runInContext(`
    (() => {
      const check = (value,message) => { if (!value) throw Error('Расейняй: '+message); };
      const pressSpace = (repeat=false) => {
        check(raseiniaiStoryInput({code:'Space',repeat,preventDefault(){}}),'dialogue consumes Space');
      };
      const dismiss = () => { pressSpace(); keys.Space=false; pressSpace(); keys.Space=false; };
      const until = (predicate,limit=1400) => {
        for(let i=0;i<limit&&!predicate();i++) update(.025);
        check(predicate(),'stalled at '+raseiniai.phase+' / '+wave);
      };
      const originalRandom=Math.random;
      let seed=82487;
      Math.random=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
      startRaseiniai();
      check(state==='story' && !base && COLS===30 && ROWS===20,'scenario starts without HQ');
      const savedTiles=grid.slice();
      check(tileAt(15,19)===BRICK,'only HQ footprint is replaced by brick');
      const solid={x:5*T+4,y:2*T}, corner={x:3*T+6,y:6};
      check(bulletBlocked(solid.x,solid.y,2)&&!bulletBlocked(corner.x,corner.y,2),'mill collision follows the visible contour');
      check(coverClear(corner.x,16,4)&&!coverClear(solid.x,solid.y,10),'tank clearance follows the same contour');
      check(!routeBlocked(3,0,2,0,8)&&routeBlocked(4,1,3,1,8),'route clearance follows contour');
      carveSteelRay(0,16,8*T,16);
      damageTerrainFromBlast(5*T,T,60,99);
      check(!steelDamage.size&&tileAt(5,1)===MILL&&millRayLimit(0,16,1,0,400)>3*T&&millRayLimit(0,16,1,0,400)<7*T,'mill cannot be destroyed or pierced');
      check(los(80,6,112,6)&&!los(80,64,200,64),'line of sight across transparent and opaque mill');
      check(raseiniai.evac.every(p=>road[Math.floor(p.y/T)*COLS+Math.floor(p.x/T)]),'civilian spawns are on road');
      pressSpace();pressSpace(true);
      check(raseiniai.dialogue.complete&&raseiniai.dialogue.index===0,'hold does not skip civilian');
      keys.Space=false;pressSpace();keys.Space=false;
      until(()=>raseiniai.phase==='fireOrder');
      check(raseiniai.dialogue.lines[0].join('|')==='Feuer frei!|Огонь!'&&!artilleryShells.length,'German fire order precedes bombardment');
      dismiss();
      check(raseiniai.bombardment.length===15,'three volleys of five');
      check(raseiniai.bombardment.every(([x,y])=>y<15*T&&!raseiniaiMillCell(Math.floor(x/T),Math.floor(y/T))),'upper and middle target pool');
      const reported=[];
      const originalSfx=sfx;
      sfx=name=>{if(name==='heavyShoot')reported.push(raseiniai.age);};
      const shells=new Set();
      while(raseiniai.phase==='bombardment') {
        update(.01);
        for(const shell of artilleryShells) {
          if(shells.has(shell))continue;
          shells.add(shell);
          check(shell.speed===3000&&shell.delay===2&&shell.age===0,'shot sound starts 2-second delay before flight');
        }
      }
      sfx=originalSfx;
      check(shells.size===15&&reported.length===15&&[5,10].every(i=>Math.abs(reported[i]-reported[i-1]-.9)<.02),'report spacing and all 15 shells');
      check([...shells].every(shell=>shell.done)&&raseiniai.phase==='title','title waits for the last impact');
      until(()=>raseiniai.phase==='orders');
      fit();
      const dialogueLayout=JSON.stringify(gameLayout.field);
      check(savedTiles.some((tile,i)=>tile!==grid[i]) || brickHp.some((hp,i)=>savedTiles[i]===BRICK&&hp<4),'bombardment damages the map');
      check(raseiniai.phase==='orders'&&Math.floor(player.x/T)===8,'left road arrival');
      dismiss();
      check(state==='play'&&wave===1&&raseiniai.blockSpace,'orders release control and suppress closing press');
      raseiniai.blockSpace=false;
      fit();
      check(dialogueLayout===JSON.stringify(gameLayout.field),'combat and dialogue share field geometry');
      player.x=H-160;player.y=H-25;player.pw.shield=1e6;
      const spawned=new Set(), count={}, reachedExits=new Set(), columnStarts=new Map();
      const checkExit=(kind,exit)=>{
        const e=makeTank((exit+.5)*T,H-T/2,kind);
        e.storyWave=1;
        if(kind==='scout')e.storyExit=exit;
        else e.storyRoute={exit,path:[]};
        for(let i=0;i<50&&!e.escaped;i++)updateEnemy(e,.025);
        check(e.escaped&&e.y>=H+e.r,'exit '+exit+' for '+kind);
      };
      for(const kind of ['scout','moto'])for(const exit of RASEINIAI_EXITS)checkExit(kind,exit);
      check(raseiniai.breaches===4,'tanks and motorcycles share the same count');
      raseiniai.breaches=0;
      const e=makeTank(player.x-70,player.y,'scout');
      e.storyWave=1;e.storyExit=8;e.turret=0;e.cd=0;
      updateEnemy(e,.025);
      check(e.engaged&&bullets.length===1,'scout sees and shoots at player');
      player.dead=true;updateEnemy(e,.025);player.dead=false;bullets=[];
      check(!e.engaged&&flow[(ROWS-1)*COLS+8]===0,'scout returns to exit route');
      let threshold=0, killedMoto=null;
      for (let i=0;i<18000 && raseiniai.phase!=='retreat';i++) {
        if (raseiniai.phase==='german') {
          for(let j=0;j<4;j++){
            check(raseiniai.dialogue.index===j&&!raseiniai.dialogue.complete,'German phrase order');
            if(j===0)check(raseiniai.dialogue.lines[j].join('|')==='Oberst, melden Sie sich!|Полковник, доложите!','colonel replaces captain');
            pressSpace();keys.Space=false;
            check(raseiniai.dialogue.complete&&raseiniai.dialogue.lines[j][1],'phrase has translation');
            pressSpace();keys.Space=false;
          }
        }
        update(.025);
        for(const e of enemies){
          if(!spawned.has(e)){
            spawned.add(e);
            const key=e.storyWave+'-'+e.kind;
            count[key]=(count[key]||0)+1;
            if(e.storyWave===4&&e.storyColumn&&!columnStarts.has(e.storyColumn))columnStarts.set(e.storyColumn,i);
          }
          if(e.kind==='scout'&&!e.entering)hitEnemy(e,{x:e.x,y:e.y,dmg:99});
          if(!killedMoto&&e.kind==='moto'&&!e.entering){
            killedMoto=e;hitEnemy(e,{x:e.x,y:e.y,dmg:99});
          }
        }
        if(wave===2&&!threshold)threshold=raseiniai.firstKills;
        for(const e of spawned)if(e.escaped)reachedExits.add(e.storyRoute.exit);
      }
      check(raseiniai.phase==='retreat','all four waves finish');
      check(JSON.stringify(count)===JSON.stringify({'1-scout':10,'2-scout':10,'2-moto':5,'3-scout':6,'3-moto':10,'4-scout':20,'4-moto':6}),'46 tanks and 21 motorcycles');
      const starts=[...columnStarts.values()];
      check(starts.length===5&&starts[0]===starts[1]&&starts[2]===starts[3]&&starts[2]>starts[0]&&starts[4]>starts[3],'wave 4 paired entries');
      check(threshold===6&&reachedExits.has(8)&&reachedExits.has(21),'six kills trigger wave 2 and both exits work');
      check(killedMoto.dead&&!killedMoto.escaped&&raseiniai.breaches===[...spawned].filter(e=>e.escaped&&e.y>=H+e.r).length,'only fully exited crews count');
      check(!items.length&&!allies.length&&mines.length,'scripted army and working mines');
      dismiss();
      check(state==='story'&&raseiniai.phase==='victory','victory follows radio with no playable retreat');
      until(()=>raseiniai.phase==='newspaper');
      advanceRaseiniai();
      check(raseiniai.phase==='timeline'&&raseiniaiResults(1).join('|')==='3126–5126|4143–6143|213','newspaper and revised timeline');
      startRaseiniai();
      check(!raseiniai.breaches,'new launch resets breaches');
      player=makeTank(480,610,'player');raseiniai.evac=[];
      evacuateRaseiniai(2,true);
      const [west,east]=raseiniai.evac;
      check(west.x<0&&east.x>W&&west.y===east.y&&road[Math.floor(west.y/T)*COLS],'trucks enter from both sides of crossroad');
      updateRaseiniaiEvacuation(3);
      check(west.x===west.turnX&&east.x===east.turnX&&west.y>(ROWS-3.5)*T,'trucks turn into the southbound exits');
      startRaseiniaiWave(4);
      const firstLane=SPAWNS[0], guard=makeTank((firstLane.c+.5)*T,(firstLane.r+.5)*T,'scout');
      enemies=[guard];
      updateRaseiniaiSpawns(1);
      const pair=raseiniai.tracks[0].batches[0];
      check(pair[0].slot===0&&pair[1].slot===1,'blocked lane does not stall its partner');
      enemies.shift();
      updateRaseiniaiSpawns(.025);
      check(pair[0].slot===1&&pair[1].slot===1,'blocked column keeps its queued tank');
      startRaseiniai();startRaseiniaiWave(1);
      raseiniai.tracks[0].pending=0;raseiniai.tracks[0].batches=[];
      raseiniai.breaches=10;
      updateRaseiniaiSpawns(.025);
      check(wave===2&&raseiniai.firstKills===0,'all first-wave tanks can escape without stalling the mission');
      raseiniai.breaches=5;
      player=makeTank(272,H-80,'player');resumeRaseiniaiBattle();hitPlayer({x:player.x,y:player.y,dmg:999});
      until(()=>defeatReady());
      check(requestDefeatRestart(false)&&state==='story'&&!raseiniai.breaches,'death and retry reset mission');
      toMenu();
      check(!raseiniai&&state==='menu','story state does not leak into other modes');
      Math.random=originalRandom;
    })();
  `,box,{filename:'check-raseiniai.cjs'});
  console.log('PASS: Raseiniai intro, bombardment, Space, four waves, mines, both exits, defeat/retry and revised timeline');
};
