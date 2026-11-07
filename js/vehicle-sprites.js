'use strict';
// Explicit physical pivots; PNGs are prepared layers with transparent backgrounds, not full-image sizing.
const VEHICLE_FILES={player0:'t34-player',player1:'is2-player',player2:'is2-ii-player',scout:'pzkpfw-iii-scout',soldier:'panther-soldier',heavy:'tiger-heavy',artillery:'ferdinand-artillery'};
// Листы кадров на одном корпусе: Panzerwerfer 42 — четыре положения пусковой установки
// (вперёд, вправо, назад, влево относительно корпуса), каждый кадр смотрит вверх, как слои танков.
const VEHICLE_SHEETS={rocket:{src:'assets/vehicles/panzerwerfer-42.png',frames:4,fw:64,fh:158,w:21,h:52}};
let vehicleLayers=null,vehicleSheets=null;
function initVehicleSprites(){
  if(vehicleLayers||typeof Image!=='function')return;
  vehicleLayers={};
  for(const [key,name]of Object.entries(VEHICLE_FILES)){
    const layers=vehicleLayers[key]={};
    for(const part of ['hull','tracks','gun',...(key==='artillery'?[]:['turret'])]){
      const entry=layers[part]={image:new Image(),loaded:false};
      entry.image.onload=()=>{entry.loaded=entry.image.naturalWidth>0;};entry.image.onerror=()=>{entry.loaded=false;};
      entry.image.src='assets/vehicles/'+name+'-'+part+'.png';
    }
  }
  vehicleSheets={};
  for(const [key,sheet]of Object.entries(VEHICLE_SHEETS)){
    const entry=vehicleSheets[key]={image:new Image(),loaded:false};
    entry.image.onload=()=>{entry.loaded=entry.image.naturalWidth>0;};entry.image.onerror=()=>{entry.loaded=false;};
    entry.image.src=sheet.src;
  }
}
// Кадр выбирается по направлению пусковой относительно корпуса; корпус повёрнут по движению. false — нет атласа.
function drawVehicleSheet(t,c){
  const sheet=VEHICLE_SHEETS[t.kind],entry=vehicleSheets&&vehicleSheets[t.kind];
  if(!sheet||!entry||!entry.loaded)return false;
  const rel=angDiff(t.angle,t.turret??t.angle),frame=((Math.round(rel/(Math.PI/2))%4)+4)%4,s=tankScale(t);
  c.save();if(t.flash>0)c.filter='brightness(0) invert(1)';
  c.translate(t.x,t.y);c.rotate(t.angle+Math.PI/2);c.scale(s,s);
  c.drawImage(entry.image,frame*sheet.fw,0,sheet.fw,sheet.fh,-sheet.w/2,-sheet.h/2,sheet.w,sheet.h);
  c.restore();return true;
}
function vehicleKey(t){return t.kind==='player'||t.kind==='ally'?'player'+Math.max(0,Math.min(2,t.upgrade||0)):t.kind;}
function vehicleMount(t){
  const friendly=t.kind==='player'||t.kind==='ally'&&t.upgrade>0,s=tankScale(t),forward=friendly?5:0;
  return {scale:s,length:friendly?playerGunLength(t):t.kind==='artillery'?35:30,
    x:t.x+Math.cos(t.angle)*forward*s,y:t.y+Math.sin(t.angle)*forward*s,offsets:friendly&&t.upgrade>=2?[-4*s,4*s]:[0]};
}
function vehicleMuzzle(t,offset=0){const m=vehicleMount(t);return {x:m.x+Math.cos(t.turret)*m.length*m.scale-Math.sin(t.turret)*offset,y:m.y+Math.sin(t.turret)*m.length*m.scale+Math.cos(t.turret)*offset};}
function drawVehicleSprite(t,c){
  const key=vehicleKey(t),layers=vehicleLayers&&vehicleLayers[key];
  if(!layers||Object.values(layers).some(l=>!l.loaded))return false;
  const m=vehicleMount(t),phase=Math.floor(((t.tread||0)%6+6)%6/6*4),wide=key==='player2'?1.15:1,trackWidth=key==='player0'?4.7:6;
  c.save();if(t.flash>0)c.filter='brightness(0) invert(1)';
  c.translate(t.x,t.y);c.rotate(t.angle+Math.PI/2);c.scale(m.scale*wide,m.scale);
  c.drawImage(layers.tracks.image,0,phase*224,24,224,-16,-17,trackWidth,35);
  c.save();c.scale(-1,1);c.drawImage(layers.tracks.image,0,phase*224,24,224,-16,-17,trackWidth,35);c.restore();
  c.drawImage(layers.hull.image,-16,-17,32,35);c.restore();
  c.save();if(t.flash>0)c.filter='brightness(0) invert(1)';c.translate(m.x,m.y);c.rotate(t.turret+Math.PI/2);c.scale(m.scale,m.scale);
  const recoil=t.dead?t.recoil||0:recoilOffset(t),offsets=m.offsets.map(o=>o/m.scale);
  for(const off of offsets)c.drawImage(layers.gun.image,off-3,-m.length+recoil,6,m.length+3);
  if(layers.turret){const width=key==='heavy'?27:key==='soldier'?25:key==='player2'?25:23;c.drawImage(layers.turret.image,-width/2,-12,width,24);}
  c.restore();return true;
}
