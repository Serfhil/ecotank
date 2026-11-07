'use strict';
// Музыка, громкость, эффекты, гусеницы и кэш звуковых буферов.
// Загрузка файла не создаёт Audio/AudioContext и не подписывается на события.
// initAudio() вызывается игрой; syncMusic()/updateTreadSound() читают state/player,
// pickLevelTrack() использует ri(). Конфигурация и подписи приходят из config/ui-text.
// Обычный script без import/fetch сохраняет запуск через file://.

// ---------- звук ----------
let actx = null, noiseBuf = null, muted = false, cannonNoiseLayers=null,heavyImpulse=null,heavyEcho=null,dshkEcho=null;

let music = null;
let musicOff=false,musicWanted=false,musicLevel=.22,musicScene='',musicTrack=MENU_TRACK,musicBlocked=false,audioUnlocked=false;
let gameVolume=.65,sfxVolume=1,masterGain=null;
function soundBus(){if(!masterGain){masterGain=actx.createGain();masterGain.gain.value=gameVolume*sfxVolume;masterGain.connect(actx.destination);}return masterGain;}
function pickLevelTrack(){const options=LEVEL_TRACKS.filter(t=>t!==musicTrack);return options[ri(0,options.length-1)];}
function syncMusic(){
  const scene=state==='menu'?'menu':'level';
  if(scene!==musicScene){musicScene=scene;musicTrack=scene==='menu'?MENU_TRACK:pickLevelTrack();music.src=musicTrack;music.loop=scene==='menu';musicWanted=false;}
  music.volume=gameVolume*musicLevel*((state==='pause'||state==='over'||player&&player.dead)?.3:1);
  const wanted=!muted&&!musicOff;
  if(wanted!==musicWanted&&(!musicBlocked||audioUnlocked||!wanted)){
    musicWanted=wanted;
    if(wanted)music.play().catch(e=>{if(e.name!=='AbortError'){musicWanted=false;musicBlocked=true;audioUnlocked=false;}});else music.pause();
  }
  document.getElementById('musicToggle').textContent=musicOff?UI_TEXT.radiotochka_vyklyuchena:musicBlocked?UI_TEXT.vklyuchit_radiotochku:UI_TEXT.musicToggle;
}
function effectsContext() {
  const Context=window.AudioContext||window.webkitAudioContext;
  if (!actx && Context) actx=new Context();
  if (actx?.state==='suspended') actx.resume().catch(()=>{});
  return actx;
}
function unlockAudio(){
  audioUnlocked=true; musicBlocked=false; syncMusic();
  // Unlock effects under the same user gesture as music, before the delayed barrage.
  try { effectsContext(); } catch (e) {}
}

let treadTimer=0;
function updateTreadSound(dt) {
  treadTimer-=dt;
  if(muted || !player || player.dead || !['play','between'].includes(state) || Math.hypot(player.vx,player.vy)<1 || treadTimer>0)return;
  treadTimer=.085;
  try { if(!effectsContext())return;
    noise(.10,.045,1100);tone(95,55,.08,'triangle',.035);
  } catch(e){}
}
function tone(f0, f1, dur, type, vol) {
  const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(soundBus()); o.start(t); o.stop(t + dur);
}
function noise(dur, vol, freq) {
  if (!noiseBuf) {
    noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(), t = actx.currentTime;
  s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f).connect(g).connect(soundBus()); s.start(t); s.stop(t + dur);
}
// Layered cannon transient, pressure wave and diffuse outdoor tail.
function cannonShot(volume) {
  const t = actx.currentTime, bus = actx.createGain(), comp = actx.createDynamicsCompressor();
  bus.gain.value = volume * .7; comp.threshold.value = -14; comp.ratio.value = 5;
  bus.connect(comp).connect(soundBus());
  const osc = actx.createOscillator(), sub = actx.createGain();
  osc.frequency.setValueAtTime(115, t); osc.frequency.exponentialRampToValueAtTime(28, t + .4);
  sub.gain.setValueAtTime(.7, t); sub.gain.exponentialRampToValueAtTime(.0001, t + .65);
  osc.connect(sub).connect(bus); osc.start(t); osc.stop(t + .7);
  if(!cannonNoiseLayers)cannonNoiseLayers=[[0,.07,9000,.65],[0,.38,900,.8],[.06,1.3,420,.45],[.14,.75,1800,.12]].map(([delay,duration,cutoff,gain])=>{
    const buffer=actx.createBuffer(1,Math.ceil(actx.sampleRate*duration),actx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*5);
    return {delay,cutoff,gain,buffer};
  });
  for (const {delay,cutoff,gain,buffer} of cannonNoiseLayers) {
    const src=actx.createBufferSource(), filter=actx.createBiquadFilter(), g=actx.createGain();
    src.buffer=buffer; filter.type='lowpass'; filter.frequency.value=cutoff; g.gain.value=gain;
    src.connect(filter).connect(g).connect(bus); src.start(t+delay);
  }
  // Release the output graph after the final tail.
  setTimeout(() => { bus.disconnect(); comp.disconnect(); }, 1800);
}
function sfx(n) {
  if (muted) return;
  try {
    if (!effectsContext())return;
    switch (n) {
      case 'shoot': cannonShot(1); break;
      case 'heavyShoot':heavyGunSound();break;
      case 'eshoot': cannonShot(.45); break;
      case 'leaves': noise(.18, .10, 6500); noise(.3,.05,1700); break;
      case 'hit': noise(.09,.23,5200);tone(1050,260,.13,'triangle',.11);noise(.18,.09,500);break;
      case 'brick': noise(.06, .08, 1300); break;
      case 'fence': noise(.07, .1, 2800); tone(260, 110, .08, 'square', .04); break;
      case 'deflect': tone(1500, 700, .07, 'triangle', .04); break;
      case 'boom': noise(.9, .5, 520); noise(.15, .3, 3500); tone(150, 25, .6, 'sawtooth', .1); break;
      case 'rail': tone(2200, 180, .4, 'sawtooth', .07); noise(.35, .3, 5000); break;
      case 'scrap': tone(900, 600, .06, 'square', .05); setTimeout(() => tone(1200, 800, .06, 'square', .05), 70); break;
      case 'hurt': tone(220, 60, .25, 'sawtooth', .1); noise(.2, .2, 900); break;
      case 'mg': noise(.05, .1, 3200); tone(190, 90, .04, 'square', .035); break;
      case 'dshk': dshkSound(); break;
      case 'rocket': noise(.55, .16, 2400); noise(.2, .12, 6000); tone(260, 820, .4, 'sawtooth', .03); break;
      case 'fuse': noise(.6, .05, 7000); noise(.12, .08, 2500); break;
      case 'mineDrop': tone(420, 230, .07, 'square', .05); noise(.08, .08, 900); break;
      case 'pick': tone(520, 1100, .16, 'triangle', .1); break;
      case 'wave': tone(330, 660, .2, 'triangle', .08); setTimeout(() => tone(440, 880, .25, 'triangle', .08), 150); break;
    }
  } catch (e) { /* звук недоступен — не страшно */ }
}

// Persistent effects bus per gun. Overlapping reports share one convolver and feedback loop.
function gunEcho(delayTime,feedbackLevel,wetLevel,reverbLevel) {
  if (!heavyImpulse) {
    heavyImpulse=actx.createBuffer(2,Math.floor(actx.sampleRate*1.8),actx.sampleRate);
    for(let channel=0;channel<2;channel++){
      const data=heavyImpulse.getChannelData(channel);
      for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3);
    }
  }
  const input=actx.createGain(),delay=actx.createDelay(2),feedback=actx.createGain(),
    wet=actx.createGain(),reverb=actx.createConvolver(),revGain=actx.createGain();
  delay.delayTime.value=delayTime;feedback.gain.value=feedbackLevel;wet.gain.value=wetLevel;
  reverb.buffer=heavyImpulse;revGain.gain.value=reverbLevel;
  input.connect(delay);delay.connect(feedback).connect(delay);delay.connect(wet).connect(soundBus());
  input.connect(reverb).connect(revGain).connect(soundBus());
  return input;
}

function heavyGunSound(){
  cannonShot(1.5);
  if(!noiseBuf)noise(.01,.001,100);
  if(!heavyEcho)heavyEcho=gunEcho(.34,.57,.65,.35);
  const t=actx.currentTime,source=actx.createBufferSource(),filter=actx.createBiquadFilter(),dry=actx.createGain();
  source.buffer=noiseBuf;filter.type='lowpass';filter.frequency.value=800;
  dry.gain.setValueAtTime(.5,t);dry.gain.exponentialRampToValueAtTime(.0001,t+.6);
  source.connect(filter).connect(dry);dry.connect(soundBus());dry.connect(heavyEcho);
  source.onended=()=>{source.disconnect();filter.disconnect();dry.disconnect();};
  source.start(t);source.stop(t+.65);
}

function dshkSound(){
  if(!noiseBuf)noise(.01,.001,100);
  if(!dshkEcho)dshkEcho=gunEcho(.19,.45,.55,.4);
  const t=actx.currentTime,src=actx.createBufferSource(),filter=actx.createBiquadFilter(),g=actx.createGain();
  src.buffer=noiseBuf;filter.type='lowpass';filter.frequency.value=1500;
  g.gain.setValueAtTime(.42,t);g.gain.exponentialRampToValueAtTime(.0001,t+.11);
  src.connect(filter).connect(g);g.connect(soundBus());g.connect(dshkEcho);src.start(t,Math.random()*.5);src.stop(t+.12);
  tone(130,42,.09,'square',.08);
}

// Вызывается один раз из index.html после создания DOM и базовых утилит.
function initAudio() {
  if (music) return;
  music = new Audio(MENU_TRACK);
  music.loop=false;music.volume=.22;music.preload='metadata';
  addEventListener('pointerdown',unlockAudio);addEventListener('keydown',unlockAudio);
  music.addEventListener('ended',()=>{if(musicScene==='level'){musicTrack=pickLevelTrack();music.src=musicTrack;musicWanted=false;syncMusic();}});
  document.getElementById('musicToggle').addEventListener('click',e=>{e.currentTarget.blur();if(musicBlocked){unlockAudio();return;}musicOff=!musicOff;syncMusic();});
  document.getElementById('musicVolume').addEventListener('input',e=>{musicLevel=Number(e.target.value);syncMusic();});
  document.getElementById('gameVolume').addEventListener('input',e=>{gameVolume=Number(e.target.value);if(masterGain)masterGain.gain.value=gameVolume*sfxVolume;syncMusic();});
}
