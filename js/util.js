'use strict';
// Общие утилиты. Вся случайность игры идёт только через Math.random (rnd/ri): проверки подменяют его
// генератором с зерном, и любой другой источник случайности ломает воспроизводимость.

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const turnTo = (a, b, s) => {
  const d = angDiff(a, b);
  return Math.abs(d) <= s ? b : a + Math.sign(d) * s;
};
