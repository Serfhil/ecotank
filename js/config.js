'use strict';
// Параметры игры и диапазоны настроек разработчика. KINDS и CFG остаются изменяемыми.
// Загружается после ui-text.js; не запускает игру, DOM, сохранения или звук.

const T=32;
const VICTORY_CONFIG = Object.freeze({ image: 'assets/victory-marx-earth.png', darken: 1, reveal: 1, creditsSpeed: 42, awardFade: 1 });

const KINDS = {
  player:  { hp: 3, speed: 60, turretSpeed: 1, fireRate: 1, color: '#6cc24a', dark: '#2e6b26', bulletSpeed: 1200, dmg: 1, scale: 1 },
  scout:   { hp: 1, speed: 80,  fireRate: 1/.33, color: '#e9b949', dark: '#8c6a1a', bulletSpeed: 380, dmg: 1, scale: .8415, score: 100, scrap: 1, wander: .25, hold: 0,   turretSpeed: 1 },
  soldier: { hp: 2, speed: 50,  fireRate: 2, color: '#e0603f', dark: '#7f2d1b', bulletSpeed: 420, dmg: 1, scale: 1,   score: 200, scrap: 2, wander: .12, hold: 150, turretSpeed: 1 },
  heavy:   { hp: 3, speed: 35,  fireRate: 5, color: '#9483d6', dark: '#463b80', bulletSpeed: 600, dmg: 2, scale: 1.357, score: 500, scrap: 4, wander: .05, hold: 260, turretSpeed: 1 },
};

KINDS.artillery={hp:2,speed:35,fireRate:6,turretSpeed:1,color:'#d5be7d',dark:'#566048',bulletSpeed:182,dmg:2,scale:1.1,score:400,scrap:3,wander:0,hold:640};
// Союзник выдерживает ровно одно попадание врага: hp 1 при любом уроне снаряда.
KINDS.ally={hp:1,speed:55,fireRate:1.6,turretSpeed:1.4,color:'#8fb45a',dark:'#3c5225',bulletSpeed:520,dmg:1,scale:1,hold:220};

const ITEMS = {
  upgrade:{color:'#ffd45c',glyph:'★',name:UI_TEXT.uluchshenie_tanka},
  barrage:{color:'#ffab52',glyph:'✹',name:UI_TEXT.artpodgotovka},
  repair: { color: '#e5484d', glyph: '+',  name: UI_TEXT.remont },
  rapid:  { color: '#f2c94c', glyph: '»',  name: UI_TEXT.skorostrel },
  shield: { color: '#7be38a', glyph: '◯',  name: UI_TEXT.shchit },
  rail:   { color: '#c58cff', glyph: '⌁',  name: UI_TEXT.relsotron },
};

const CFG = {
  dropChance: .22, heavyDropBonus: .3, powerupTime: 10, repairAmount: 2, railMax: 3,
  waveBase: 6, wavePerLevel: 2, maxAliveBase: 3, maxAliveCap: 7, enemySpeedPerWave: .02, waveBonus: 300, waveHeal: 1,
  mapSize:30, mapMode:'original', mapPick:'', campaignStart:0, mapElements: 42, brickHp: 4, invulnTime: .7, enemySight: 460, treeStealth: 90, shake: 1, hitstop: .06, godMode: false,
  allies: false, allyCount: 2,
};

const MENU_TRACK='assets/red-steel-menu.mp3',LEVEL_TRACKS=['assets/mehvod.mp3','assets/red-steel-1.mp3','assets/red-steel-2.mp3'];

const MAP_SIZES = [30, 45, 60];

const UPGRADE_DURATION=1.5;
const DEFEAT_FADE_DURATION = 1;
const DEFEAT_RESTART_DELAY = 2;
const HUD_LAYOUT = Object.freeze({ breakpoint: 900, width: 240, gap: 12, padding: 12, toolbarHeight: 52, compactHeight: 220 });
const DEFEAT_IMAGES = Object.freeze(['assets/defeat-t34.png', 'assets/defeat-is2.png', 'assets/defeat-is2-ii.png']);

const UI_W = 960, UI_H = 640;

const TANK_FIELDS = [
  ['hp', UI_TEXT.khp, 1, 99, 1],
  ['speed', UI_TEXT.skorost_tanka, 0, 400, 5],
  ['bulletSpeed', UI_TEXT.skorost_snaryada, 50, 2000, 10],
  ['fireRate', UI_TEXT.perezaryadka_s, .05, 10, .05],
  ['dmg', UI_TEXT.uron_snaryada, 0, 20, 1],
  ['turretSpeed', UI_TEXT.skorost_povorota_bashni_rad_s, .1, 20, .1],
  ['hold', UI_TEXT.distantsiya_stoyanki, 0, 600, 10],
  ['wander', UI_TEXT.sluchaynost_puti, 0, 1, .05],
  ['score', UI_TEXT.ochki_za_unichtozhenie, 0, 5000, 50],
  ['scrap', UI_TEXT.metallolom_5, 0, 50, 1],
];

const CFG_FIELDS = [
  [UI_TEXT.bonusy, [
    ['dropChance', UI_TEXT.shans_vypadeniya, 0, 1, .05],
    ['heavyDropBonus', UI_TEXT.dop_shans_s_tyazhyologo, 0, 1, .05],
    ['powerupTime', UI_TEXT.dlitelnost_bonusov_s, 1, 60, 1],
    ['repairAmount', UI_TEXT.remont_khp, 1, 20, 1],
    ['railMax', UI_TEXT.maks_zaryadov_relsotrona, 1, 20, 1],
  ]],
  [UI_TEXT.volny, [
    ['waveBase', UI_TEXT.vragov_v_1_y_volne, 1, 50, 1],
    ['wavePerLevel', UI_TEXT.prirost_vragov_za_volnu, 0, 20, 1],
    ['maxAliveBase', UI_TEXT.vragov_odnovremenno_baza, 1, 20, 1],
    ['maxAliveCap', UI_TEXT.vragov_odnovremenno_maks, 1, 30, 1],
    ['enemySpeedPerWave', UI_TEXT.uskorenie_vragov_za_volnu, 0, .2, .01],
    ['waveBonus', UI_TEXT.bonus_za_volnu_nomer, 0, 5000, 50],
    ['waveHeal', UI_TEXT.lechenie_mezhdu_volnami, 0, 20, 1],
  ]],
  [UI_TEXT.mir_i_effekty, [
    ['mapElements', UI_TEXT.grupp_elementov_na_30_20_plotnost, 0, 180, 1],
    ['invulnTime', UI_TEXT.neuyazvimost_posle_urona_s, 0, 5, .1],
    ['enemySight', UI_TEXT.dalnost_obzora_vragov, 50, 1500, 10],
    ['treeStealth', UI_TEXT.vidyat_v_kronakh_blizhe_chem, 0, 500, 10],
    ['shake', UI_TEXT.tryaska_ekrana, 0, 3, .1],
    ['hitstop', UI_TEXT.stop_kadr_pri_vzryve_s, 0, .3, .01],
    ['godMode', UI_TEXT.rezhim_boga, 'bool'],
  ]],
  [UI_TEXT.soyuzniki, [
    ['allies', UI_TEXT.soyuznye_tanki, 'bool'],
    ['allyCount', UI_TEXT.soyuznikov_na_karte, 1, 6, 1],
  ]],
];

const PRESET_MAX = 12;
