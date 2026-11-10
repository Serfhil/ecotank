'use strict';
// Event counters; neither DOM access nor per-frame scans. Retries retain this operation.
// В титрах победы — вся вражеская техника из KINDS и пешие смертники.
const STAT_ENEMY_TYPES = Object.freeze([...Object.keys(KINDS).filter(kind => KINDS[kind].side === 'enemy'), 'bomber']);
let operationStats = null;
function resetStatistics() {
  operationStats = {
    enemies: Object.fromEntries(STAT_ENEMY_TYPES.map(k => [k, 0])),
    bricks: 0,
    fences: 0,
    foliage: 0,
    flocks: 0,
    deaths: 0,
    allies: 0,
  };
}
function recordStatistic(type, kind) {
  if (
    !operationStats ||
    (state !== 'play' && state !== 'between' && !(state === 'story' && scenario.countsStatistics && scenario.countsStatistics()))
  )
    return;
  if (type === 'enemies') {
    if (Object.prototype.hasOwnProperty.call(operationStats.enemies, kind)) operationStats.enemies[kind]++;
  } else if (Object.prototype.hasOwnProperty.call(operationStats, type) && type !== 'enemies') operationStats[type]++;
}
function snapshotStatistics() {
  const s = operationStats;
  return Object.freeze({ ...s, enemies: Object.freeze({ ...s.enemies }) });
}
