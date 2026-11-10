'use strict';
// Единственный источник чисел и описаний: техника (KINDS), ступени танка игрока (PLAYER_TIERS),
// баланс (CFG), выбор игрока (PREFS) и поля панели разработчика.
// Загружается после ui-text.js. Только данные: файл ничего не запускает и не читает сохранения.
// Правила изменения — в AGENTS.md, разделы «Источники правды» и «Рецепты».

const T = 32;

// ---------- техника ----------
// Одна запись — один вид техники. Всё, чем вид отличается от остальных, записано здесь,
// а не проверками kind === '...' в логике.
//   name        — название в интерфейсе.
//   side        — 'friend' или 'enemy'. Враги попадают в статистику и титры победы.
//   ai          — поведение врага, ключ таблицы ENEMY_AI (enemy-ai.js).
//   column      — место в колонне: число — ранг ведущего (старший едет первым), 'tail' — замыкающий.
//   shot        — особенности снаряда: ap — бронебойный, radius — радиус, sound — звук выстрела.
//   entryFire   — стреляет ещё на въезде из-за края поля.
//   deathBlasts — серия взрывов при гибели: { count, gap, scale, small }. Без поля — один взрыв.
//   burns       — повреждённая машина горит.
//   breaksWalls — на марше пробивает кирпич на прямой к цели, а не объезжает его.
//   light       — лёгкая колёсная техника: своя скорость на покрытиях (SURFACE_SPEED.*.light), не давит заборы,
//                 гибнет под гусеницами игрока и союзников, а малые взрывы (deathBlasts.small) бьют только по ней.
//   sprite      — имя набора слоёв в assets/vehicles (<sprite>-hull.png и т. д.); turretless — без слоя башни.
//   sheet       — атлас кадров вместо слоёв.
//   turretWidth, gunLength — размеры спрайта башни и орудия в пикселях модели.
// Числа из TANK_FIELDS меняются в панели разработчика; остальные поля — только в этом файле.
const KINDS = {
  player: {
    name: UI_TEXT.igrok,
    side: 'friend',
    burns: true,
    hp: 3,
    speed: 60,
    turretSpeed: 1,
    fireRate: 1,
    bulletSpeed: 1200,
    dmg: 1,
    scale: 1,
    color: '#6cc24a',
    dark: '#2e6b26',
  },
  scout: {
    name: UI_TEXT.razvedchik,
    side: 'enemy',
    ai: 'tactic',
    column: 1,
    sprite: 'pzkpfw-iii-scout',
    hp: 1,
    speed: 80,
    hullTurn: 2.4,
    fireRate: 1 / 0.33,
    turretSpeed: 1,
    bulletSpeed: 380,
    dmg: 1,
    scale: 0.8415,
    score: 100,
    scrap: 1,
    color: '#e9b949',
    dark: '#8c6a1a',
  },
  soldier: {
    name: UI_TEXT.soldat,
    side: 'enemy',
    ai: 'tactic',
    column: 2,
    burns: true,
    sprite: 'panther-soldier',
    turretWidth: 25,
    hp: 2,
    speed: 50,
    hullTurn: 2,
    fireRate: 2,
    turretSpeed: 1,
    bulletSpeed: 420,
    dmg: 1,
    scale: 1,
    score: 200,
    scrap: 2,
    color: '#e0603f',
    dark: '#7f2d1b',
  },
  heavy: {
    name: UI_TEXT.tyazhyolyy,
    side: 'enemy',
    ai: 'tactic',
    column: 3,
    burns: true,
    sprite: 'tiger-heavy',
    turretWidth: 27,
    shot: { ap: true, radius: 4, sound: 'heavyShoot' },
    entryFire: true,
    breaksWalls: true,
    deathBlasts: { count: 3 },
    hp: 3,
    speed: 35,
    hullTurn: 1.3,
    fireRate: 5,
    turretSpeed: 1,
    bulletSpeed: 3000,
    dmg: 2,
    scale: 1.357,
    score: 500,
    scrap: 4,
    color: '#9483d6',
    dark: '#463b80',
  },
  artillery: {
    name: UI_TEXT.artilleriya,
    side: 'enemy',
    ai: 'artillery',
    column: 'tail',
    sprite: 'ferdinand-artillery',
    turretless: true,
    gunLength: 35,
    hp: 2,
    speed: 35,
    hullTurn: 1.2,
    fireRate: 6,
    turretSpeed: 1,
    bulletSpeed: 182,
    dmg: 2,
    scale: 1.1,
    score: 400,
    scrap: 3,
    color: '#d5be7d',
    dark: '#566048',
  },
  // Panzerwerfer 42 (РСЗО): bulletSpeed — скорость ракет, fireRate — пауза между циклами залпов, с.
  rocket: {
    name: UI_TEXT.panzerwerfer,
    side: 'enemy',
    ai: 'rocket',
    sheet: { src: 'assets/vehicles/panzerwerfer-42.png', frames: 4, fw: 64, fh: 158, w: 21, h: 52 },
    hp: 2,
    speed: 40,
    hullTurn: 1.5,
    fireRate: 7,
    turretSpeed: 1.6,
    bulletSpeed: 1200,
    dmg: 1,
    scale: 1.1,
    score: 450,
    scrap: 3,
    color: '#b9a27a',
    dark: '#5d5038',
  },
  // Мотоцикл-минёр не стреляет: минирует стены и базу или ставит мины на поле (sappers.js).
  // Три малых взрыва при гибели поражают только мотобригады и подрывников.
  moto: {
    name: UI_TEXT.motocikl_miner,
    side: 'enemy',
    ai: 'moto',
    light: true,
    deathBlasts: { count: 3, gap: 0.15, scale: 0.3, small: true },
    hp: 1,
    speed: 90,
    scale: 0.85,
    score: 250,
    scrap: 1,
    color: '#c9a96a',
    dark: '#6b5a36',
  },
  // Неулучшенный союзник выдерживает одно попадание; hold — дистанция, с которой он стреляет стоя.
  ally: {
    name: UI_TEXT.soyuznik,
    side: 'friend',
    burns: true,
    hp: 1,
    speed: 55,
    fireRate: 1.6,
    turretSpeed: 1.4,
    bulletSpeed: 520,
    dmg: 1,
    scale: 1,
    hold: 220,
    color: '#8fb45a',
    dark: '#3c5225',
  },
};

// Названия для интерфейса выводятся из KINDS. Смертник — не техника, но считается в статистике.
const KIND_NAMES = Object.fromEntries(Object.entries(KINDS).map(([kind, K]) => [kind, K.name]));
KIND_NAMES.bomber = UI_TEXT.smertnik;

// ---------- ступени танка игрока ----------
// Звезда переводит танк на следующую ступень; союзники со звёздами используют те же ступени.
// Новая ступень — новая запись в конце массива: логика берёт всё отсюда и не сравнивает номер ступени с числами.
//   hp          — здоровье (null — KINDS.player.hp из панели разработчика).
//   scale       — множитель размера к KINDS[kind].scale; hullWide — дополнительное расширение корпуса.
//   gun         — длина орудия; barrels — число стволов; armor — бронебойные снаряды.
//   mg          — курсовой пулемёт: interval, sound, twin, heavy и hits — сколько попаданий нужно по целой
//                 цели данного вида (урон пули = maxHp / hits). Вида нет в hits — пуля рикошетит.
//   deathBlasts — число взрывов при гибели; defeatImage — иллюстрация экрана поражения.
const PLAYER_TIERS = Object.freeze([
  Object.freeze({
    name: UI_TEXT.hudBaseTank,
    sprite: 't34-player',
    hp: null,
    scale: 0.9,
    hullWide: 1,
    trackWidth: 4.7,
    turretWidth: 23,
    gun: 30,
    barrels: 1,
    armor: false,
    deathBlasts: 3,
    defeatImage: 'assets/defeat-t34.png',
    mg: Object.freeze({ name: UI_TEXT.mg_dt29, interval: 0.12, sound: 'mg', hits: Object.freeze({ moto: 2 }) }),
  }),
  Object.freeze({
    name: UI_TEXT.is_2,
    sprite: 'is2-player',
    hp: 5,
    scale: 1,
    hullWide: 1,
    trackWidth: 6,
    turretWidth: 23,
    gun: 35,
    barrels: 1,
    armor: true,
    deathBlasts: 4,
    defeatImage: 'assets/defeat-is2.png',
    mg: Object.freeze({ name: UI_TEXT.mg_dt29x2, interval: 0.06, sound: 'mg', twin: true, hits: Object.freeze({ moto: 2 }) }),
  }),
  Object.freeze({
    name: UI_TEXT.is_2_ii,
    sprite: 'is2-ii-player',
    hp: 7,
    scale: 1.15,
    hullWide: 1.15,
    trackWidth: 6,
    turretWidth: 25,
    gun: 28,
    barrels: 2,
    armor: true,
    deathBlasts: 5,
    defeatImage: 'assets/defeat-is2-ii.png',
    mg: Object.freeze({
      name: UI_TEXT.mg_dshk,
      interval: 0.12,
      sound: 'dshk',
      heavy: true,
      hits: Object.freeze({ scout: 7, moto: 1, rocket: 10 }),
    }),
  }),
]);
const MAX_TIER = PLAYER_TIERS.length - 1;
const UPGRADE_DURATION = 1.5;

// ---------- постоянные механик ----------
// Курсовой пулемёт: общие параметры пули. Смертника и забор любой пулемёт берёт с одного попадания.
const MG_CONFIG = Object.freeze({ speed: 900, rangeTiles: 30, spread: 0.03 });
// Инерция корпуса: постоянные времени разгона/торможения и поворота, с. Башня не инерционна.
const PLAYER_INERTIA = Object.freeze({ move: 0.18, turn: 0.15 });
// Множители скорости на покрытии и время плавного перехода от обычной земли к покрытию и обратно.
const SURFACE_SPEED = Object.freeze({
  sand: Object.freeze({ tank: 0.5, light: 0.5 }),
  road: Object.freeze({ tank: 1.25, light: 1.4 }),
  blend: 1,
});
// Panzerwerfer 42: разметка трёх зон за mark секунд, пауза wait, затем два залпа по три ракеты.
const ROCKET_CONFIG = Object.freeze({
  points: 3,
  mark: 3,
  wait: 3,
  volleys: 2,
  radius: 30,
  damage: 1,
  trail: 14,
  trailLife: 0.5,
  firstDelay: 2.5,
});
const SUPPORT_CONFIG = Object.freeze({ interval: 0.06, warning: 2, speed: 3000 });
const VICTORY_CONFIG = Object.freeze({ image: 'assets/victory-marx-earth.png', darken: 1, reveal: 1, creditsSpeed: 42, awardFade: 1 });
const DEFEAT_DARKEN_DURATION = 0.65;
const DEFEAT_FADE_DURATION = 1.8;
const DEFEAT_RESTART_DELAY = 2;
const HUD_LAYOUT = Object.freeze({ breakpoint: 900, width: 240, gap: 12, padding: 12, toolbarHeight: 52, compactHeight: 220 });
const UI_W = 960,
  UI_H = 640;
const MENU_TRACK = 'assets/red-steel-menu.mp3',
  LEVEL_TRACKS = ['assets/mehvod.mp3', 'assets/red-steel-1.mp3', 'assets/red-steel-2.mp3'];
const MAP_SIZES = [30, 45, 60];
const PRESET_MAX = 12;

// ---------- баланс ----------
// Каждый ключ CFG обязан иметь строку в CFG_FIELDS: это и есть панель разработчика.
// В сохранения попадают только значения, изменённые относительно этого файла (settings.js).
const CFG = {
  powerupTime: 10,
  repairAmount: 2,
  railMax: 3,
  waveBase: 6,
  wavePerLevel: 2,
  maxAliveBase: 3,
  maxAliveCap: 7,
  enemySpeedPerWave: 0.02,
  waveBonus: 300,
  waveHeal: 1,
  mapElements: 42,
  invulnTime: 0.7,
  enemySight: 460,
  treeStealth: 90,
  shake: 1,
  hitstop: 0.06,
  godMode: false,
  allies: false,
  allyCount: 2,
  bomberChance: 0.1,
  bomberFuse: 2.5,
  bomberSpeed: 75,
  rocketChance: 0.06,
  rocketVolleyGap: 0.8,
  // Подбитый танк взрывается (урон вокруг) только с этим шансом, иначе просто горит без урона.
  tankBlastChance: 0.25,
};

// ---------- выбор игрока ----------
// Не баланс: размер поля, режим расстановки, выбранная карта и стартовый уровень кампании.
const PREFS = { mapSize: 30, mapMode: 'original', mapPick: '', campaignStart: 0 };
const MAP_MODES = ['original', 'preset01', 'map', 'campaign'];

// ---------- поля панели разработчика ----------
// [ключ, подпись, минимум, максимум, шаг]. Строка показывается у видов техники, в которых ключ есть.
const TANK_FIELDS = [
  ['hp', UI_TEXT.khp, 1, 99, 1],
  ['speed', UI_TEXT.skorost_tanka, 0, 400, 5],
  ['bulletSpeed', UI_TEXT.skorost_snaryada, 50, 4000, 10],
  ['fireRate', UI_TEXT.perezaryadka_s, 0.05, 10, 0.05],
  ['dmg', UI_TEXT.uron_snaryada, 0, 20, 1],
  ['turretSpeed', UI_TEXT.skorost_povorota_bashni_rad_s, 0.1, 20, 0.1],
  ['hullTurn', UI_TEXT.skorost_povorota_korpusa_rad_s, 0.2, 10, 0.1],
  ['hold', UI_TEXT.distantsiya_stoyanki, 0, 600, 10],
  ['score', UI_TEXT.ochki_za_unichtozhenie, 0, 5000, 50],
  ['scrap', UI_TEXT.metallolom_5, 0, 50, 1],
];

const CFG_FIELDS = [
  [
    UI_TEXT.bonusy,
    [
      ['powerupTime', UI_TEXT.dlitelnost_bonusov_s, 1, 60, 1],
      ['repairAmount', UI_TEXT.remont_khp, 1, 20, 1],
      ['railMax', UI_TEXT.maks_zaryadov_relsotrona, 1, 20, 1],
    ],
  ],
  [
    UI_TEXT.volny,
    [
      ['waveBase', UI_TEXT.vragov_v_1_y_volne, 1, 50, 1],
      ['wavePerLevel', UI_TEXT.prirost_vragov_za_volnu, 0, 20, 1],
      ['maxAliveBase', UI_TEXT.vragov_odnovremenno_baza, 1, 20, 1],
      ['maxAliveCap', UI_TEXT.vragov_odnovremenno_maks, 1, 30, 1],
      ['enemySpeedPerWave', UI_TEXT.uskorenie_vragov_za_volnu, 0, 0.2, 0.01],
      ['waveBonus', UI_TEXT.bonus_za_volnu_nomer, 0, 5000, 50],
      ['waveHeal', UI_TEXT.lechenie_mezhdu_volnami, 0, 20, 1],
    ],
  ],
  [
    UI_TEXT.mir_i_effekty,
    [
      ['mapElements', UI_TEXT.grupp_elementov_na_30_20_plotnost, 0, 180, 1],
      ['invulnTime', UI_TEXT.neuyazvimost_posle_urona_s, 0, 5, 0.1],
      ['enemySight', UI_TEXT.dalnost_obzora_vragov, 50, 1500, 10],
      ['treeStealth', UI_TEXT.vidyat_v_kronakh_blizhe_chem, 0, 500, 10],
      ['tankBlastChance', UI_TEXT.shans_vzryva_podbitogo_tanka, 0, 1, 0.05],
      ['shake', UI_TEXT.tryaska_ekrana, 0, 3, 0.1],
      ['hitstop', UI_TEXT.stop_kadr_pri_vzryve_s, 0, 0.3, 0.01],
      ['godMode', UI_TEXT.rezhim_boga, 'bool'],
    ],
  ],
  [
    UI_TEXT.soyuzniki,
    [
      ['allies', UI_TEXT.soyuznye_tanki, 'bool'],
      ['allyCount', UI_TEXT.soyuznikov_na_karte, 1, 6, 1],
    ],
  ],
  [
    UI_TEXT.miny_i_smertniki,
    [
      ['bomberChance', UI_TEXT.shans_smertnika_v_zeleni, 0, 1, 0.01],
      ['bomberFuse', UI_TEXT.vzryv_smertnika_cherez_s, 0.5, 30, 0.5],
      ['bomberSpeed', UI_TEXT.skorost_smertnika, 10, 300, 5],
    ],
  ],
  [
    UI_TEXT.rszo,
    [
      ['rocketChance', UI_TEXT.shans_rszo_v_volne, 0, 1, 0.01],
      ['rocketVolleyGap', UI_TEXT.pauza_mezhdu_zalpami_s, 0.1, 5, 0.1],
    ],
  ],
];
