const fs = require('node:fs'),
  vm = require('node:vm'),
  assert = require('node:assert/strict');

module.exports = function checkAudio(root) {
  // Loading the classic module is inert, even without DOM or browser audio APIs.
  const context = vm.createContext({});
  for (const src of ['js/ui-text.js', 'js/config.js', 'js/audio.js'])
    vm.runInContext(fs.readFileSync(root + '/' + src, 'utf8'), context, { filename: src });
  assert.equal(vm.runInContext('music', context), null);
  assert.equal(vm.runInContext('actx', context), null);
  const controls = new Map(),
    globalListeners = new Map();
  let createdMusic = 0;
  for (const id of ['musicToggle', 'musicVolume', 'gameVolume'])
    controls.set(id, {
      listeners: new Map(),
      blur() {},
      addEventListener(name, fn) {
        assert(!this.listeners.has(name), 'Duplicate control listener');
        this.listeners.set(name, fn);
      },
    });
  context.document = {
    getElementById: id => {
      assert(controls.has(id));
      return controls.get(id);
    },
  };
  context.addEventListener = (name, fn) => {
    assert(!globalListeners.has(name), 'Duplicate global audio listener');
    globalListeners.set(name, fn);
  };
  context.Audio = class {
    constructor(src) {
      createdMusic++;
      this.src = src;
      this.paused = true;
      this.listeners = new Map();
    }
    addEventListener(name, fn) {
      assert(!this.listeners.has(name), 'Duplicate music listener');
      this.listeners.set(name, fn);
    }
    play() {
      this.paused = false;
      return { catch() {} };
    }
    pause() {
      this.paused = true;
    }
  };
  context.state = 'menu';
  context.player = null;
  context.ri = a => a;
  vm.runInContext('initAudio();initAudio();syncMusic();', context);
  const music = vm.runInContext('music', context);
  assert.equal(createdMusic, 1);
  assert.equal(globalListeners.size, 2);
  assert.equal(music.listeners.size, 1);
  assert.equal(music.paused, false);
  assert.equal(music.src, vm.runInContext('MENU_TRACK', context));
  context.state = 'play';
  vm.runInContext('syncMusic()', context);
  const firstTrack = music.src;
  music.listeners.get('ended')();
  assert.notEqual(music.src, firstTrack, 'Level playlist must advance without an immediate repeat');
  const toggle = controls.get('musicToggle');
  controls.get('musicVolume').listeners.get('input')({ target: { value: '0.5' } });
  vm.runInContext('masterGain={gain:{value:1}};', context);
  controls.get('gameVolume').listeners.get('input')({ target: { value: '0.4' } });
  assert.equal(music.volume, 0.2);
  assert.equal(vm.runInContext('masterGain.gain.value', context), 0.4, 'Master volume must affect effects as well');
  context.state = 'pause';
  vm.runInContext('syncMusic()', context);
  assert.equal(music.paused, false, 'Pause must duck rather than stop music');
  assert.equal(music.volume, 0.06);
  context.state = 'play';
  context.player = { dead: true };
  vm.runInContext('syncMusic()', context);
  assert.equal(music.volume, 0.06);
  context.player = null;
  toggle.listeners.get('click')({ currentTarget: toggle });
  assert.equal(music.paused, true);
  assert.equal(toggle.textContent, '♫ Радиоточка выключена');
  toggle.listeners.get('click')({ currentTarget: toggle });
  assert.equal(music.paused, false);
  assert.equal(toggle.textContent, '♫ Радио «Союз»');
  vm.runInContext('muted=true;syncMusic()', context);
  assert.equal(music.paused, true);
  vm.runInContext('muted=false;syncMusic()', context);
  assert.equal(music.paused, false);
  // Treads remain gated by motion, game state, life and their own interval.
  context.treadCalls = [];
  context.window = {
    AudioContext: class {
      constructor() {
        this.state = 'running';
      }
    },
  };
  vm.runInContext('tone=()=>treadCalls.push("tone");noise=()=>treadCalls.push("noise");', context);
  context.player = { dead: false, vx: 0, vy: 0 };
  vm.runInContext('updateTreadSound(.1)', context);
  assert.equal(context.treadCalls.length, 0);
  context.player.vx = 60;
  vm.runInContext('updateTreadSound(.1)', context);
  assert.equal(context.treadCalls.length, 2);
  vm.runInContext('updateTreadSound(.01)', context);
  assert.equal(context.treadCalls.length, 2);
  vm.runInContext('updateTreadSound(.1)', context);
  assert.equal(context.treadCalls.length, 4);
  context.state = 'pause';
  vm.runInContext('updateTreadSound(.1)', context);
  assert.equal(context.treadCalls.length, 4);
  context.state = 'play';
  context.player.dead = true;
  vm.runInContext('updateTreadSound(.1)', context);
  assert.equal(context.treadCalls.length, 4);
  // Unsupported Web Audio must not break the game.
  context.window = {};
  vm.runInContext('actx=null;sfx("shoot")', context);
};

if (require.main === module) {
  module.exports(require('node:path').join(__dirname, '..'));
  console.log('PASS: audio lifecycle, playlist, controls, ducking, mute and treads');
}
