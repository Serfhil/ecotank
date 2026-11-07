'use strict';
// Параметры игры и диапазоны настроек разработчика. KINDS и CFG остаются изменяемыми.
// Загружается после ui-text.js; не запускает игру, DOM, сохранения или звук.

const T=32;
// Курсовой пулемёт: общие параметры пули. Скорострельность, звук и цели зависят от ступени танка (MG_TIERS).
const MG_CONFIG=Object.freeze({speed:900,life:.6,spread:.03});
// hits — сколько попаданий нужно по цели с полным здоровьем; урон пули = maxHp/hits. Остальную технику пулемёт не берёт.
// Смертника любой пулемёт убивает с одного попадания (shootBomber), забор ломает с одного попадания.
const MG_TIERS=Object.freeze([
  Object.freeze({name:UI_TEXT.mg_dt29,interval:.12,sound:'mg',hits:Object.freeze({moto:2})}),
  Object.freeze({name:UI_TEXT.mg_dt29x2,interval:.06,sound:'mg',twin:true,hits:Object.freeze({moto:2})}),
  Object.freeze({name:UI_TEXT.mg_dshk,interval:.12,sound:'dshk',heavy:true,hits:Object.freeze({scout:7,moto:1,rocket:10})}),
]);
// Инерция корпуса игрока: постоянные времени разгона/торможения и поворота, с. Башня мышью не инерционна.
const PLAYER_INERTIA=Object.freeze({move:.18,turn:.15});
// Множители скорости на покрытии и время плавного перехода от обычной земли к покрытию и обратно.
const SURFACE_SPEED=Object.freeze({sand:Object.freeze({tank:.5,moto:.5}),road:Object.freeze({tank:1.25,moto:1.4}),blend:1});
// Panzerwerfer 42: разметка трёх зон за mark секунд, пауза wait, затем два залпа по три ракеты.
const ROCKET_CONFIG=Object.freeze({points:3,mark:3,wait:3,volleys:2,radius:30,damage:1,trail:14,trailLife:.5,firstDelay:2.5});
const SUPPORT_CONFIG=Object.freeze({interval:.06,warning:2,speed:3000});
const VICTORY_CONFIG = Object.freeze({ image: 'assets/victory-marx-earth.png', darken: 1, reveal: 1, creditsSpeed: 42, awardFade: 1 });

const KINDS = {
  player:  { hp: 3, speed: 60, turretSpeed: 1, fireRate: 1, color: '#6cc24a', dark: '#2e6b26', bulletSpeed: 1200, dmg: 1, scale: 1 },
  scout:   { hp: 1, speed: 80,  fireRate: 1/.33, color: '#e9b949', dark: '#8c6a1a', bulletSpeed: 380, dmg: 1, scale: .8415, score: 100, scrap: 1, wander: .25, hold: 0,   turretSpeed: 1 },
  soldier: { hp: 2, speed: 50,  fireRate: 2, color: '#e0603f', dark: '#7f2d1b', bulletSpeed: 420, dmg: 1, scale: 1,   score: 200, scrap: 2, wander: .12, hold: 150, turretSpeed: 1 },
  heavy:   { hp: 3, speed: 35,  fireRate: 5, color: '#9483d6', dark: '#463b80', bulletSpeed: 600, dmg: 2, scale: 1.357, score: 500, scrap: 4, wander: .05, hold: 260, turretSpeed: 1 },
};

KINDS.artillery={hp:2,speed:35,fireRate:6,turretSpeed:1,color:'#d5be7d',dark:'#566048',bulletSpeed:182,dmg:2,scale:1.1,score:400,scrap:3,wander:0,hold:640};
// Мотоцикл-минёр не стреляет: минирует стены и базу или ставит мины на поле (js/sappers.js).
KINDS.moto={hp:1,speed:90,color:'#c9a96a',dark:'#6b5a36',scale:.85,score:250,scrap:1,wander:0,hold:0};
// Союзник выдерживает ровно одно попадание врага: hp 1 при любом уроне снаряда.
// Panzerwerfer 42 (РСЗО): bulletSpeed — скорость ракет, fireRate — пауза между циклами залпов, с.
KINDS.rocket={hp:2,speed:40,fireRate:7,turretSpeed:1.6,color:'#b9a27a',dark:'#5d5038',bulletSpeed:1200,dmg:1,scale:1.1,score:450,scrap:3,wander:0,hold:0};
KINDS.ally={hp:1,speed:55,fireRate:1.6,turretSpeed:1.4,color:'#8fb45a',dark:'#3c5225',bulletSpeed:520,dmg:1,scale:1,hold:220};

const ITEMS = {
  upgrade:{color:'#ffd45c',glyph:'★',name:UI_TEXT.uluchshenie_tanka},
  barrage:{color:'#ffab52',glyph:'✹',name:UI_TEXT.artpodgotovka},
  repair: { color: '#e5484d', glyph: '+',  name: UI_TEXT.remont },
  rapid:  { color: '#f2c94c', glyph: '»',  name: UI_TEXT.skorostrel },
  shield: { color: '#7be38a', glyph: '◯',  name: UI_TEXT.shchit },
  rail:   { color: '#c58cff', glyph: '⌁',  name: UI_TEXT.relsotron },
  reinforce:{color:'#9be36f',glyph:'+',name:UI_TEXT.podkreplenie},
  stroybat:{color:'#d0844f',glyph:'▦',name:UI_TEXT.stroybat},
  curtain:{color:'#b9c3ca',glyph:'▣',name:UI_TEXT.zheleznyy_zanaves},
};

const CFG = {
  powerupTime: 10, repairAmount: 2, railMax: 3,
  waveBase: 6, wavePerLevel: 2, maxAliveBase: 3, maxAliveCap: 7, enemySpeedPerWave: .02, waveBonus: 300, waveHeal: 1,
  mapSize:30, mapMode:'original', mapPick:'', campaignStart:0, mapElements: 42, brickHp: 4, invulnTime: .7, enemySight: 460, treeStealth: 90, shake: 1, hitstop: .06, godMode: false,
  allies: false, allyCount: 2,
  bomberChance: .1, bomberFuse: 2.5, bomberSpeed: 75,
  rocketChance: .06, rocketVolleyGap: .8,
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
  [UI_TEXT.miny_i_smertniki, [
    ['bomberChance', UI_TEXT.shans_smertnika_v_zeleni, 0, 1, .01],
    ['bomberFuse', UI_TEXT.vzryv_smertnika_cherez_s, .5, 30, .5],
    ['bomberSpeed', UI_TEXT.skorost_smertnika, 10, 300, 5],
  ]],
  [UI_TEXT.rszo, [
    ['rocketChance', UI_TEXT.shans_rszo_v_volne, 0, 1, .01],
    ['rocketVolleyGap', UI_TEXT.pauza_mezhdu_zalpami_s, .1, 5, .1],
  ]],
];

const PRESET_MAX = 12;
