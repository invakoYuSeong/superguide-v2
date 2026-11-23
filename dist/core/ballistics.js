// Projectile flight from the wiki Damage page (rev 142577, "Velocity-Based Falloff"):
// quadratic drag dv/dt = -D * v * |v| with D = 0.0004712389 * caliber^2 * Cd / mass (mm, g),
// and the damage multiplier 0.25 + 0.75 * (v / v0)^2, which along a straight path is
// 1 - 0.75 * (1 - e^(-2Dx)). The wiki marks this as an approximation: it ignores gravity.
// Drop is drawn from the same drag plus gravity: 9.82 m/s^2 times the record's gravity multiplier, the
// value helldiversotl.com's ballistics calculator uses as checked in the game code (game 7.1.0; not on the
// wiki; user decision 2026-11-23). The same site's drag term matches the wiki's D exactly.
import { projectileBallistics } from '../data/ballistics.js';

export const GAME_GRAVITY = 9.82;

export const ballisticsOf = attack => (attack?.record ? projectileBallistics[attack.record] ?? null : null);

// Whether range reduces this attack's own hit: a record with drag, unless the shot is
// rocket-propelled and keeps its speed (`propelled`, support-records.js).
export const fallsWithRange = attack => !attack?.propelled && dragOf(ballisticsOf(attack)) > 0;

// Drag deceleration D, per metre.
export const dragOf = b => (b && b.caliber > 0 && b.mass > 0 && b.drag > 0 ? (0.0004712389 * b.caliber ** 2 * b.drag) / b.mass : 0);

// Damage multiplier after `x` metres of flight.
export const falloffAt = (b, x) => (x > 0 ? 1 - 0.75 * (1 - Math.exp(-2 * dragOf(b) * x)) : 1);

// Distance at which damage falls to `share` (0.25-1), or null when it never does.
export function distanceAt(b, share) {
  const d = dragOf(b);
  if (!d || share <= 0.25 || share >= 1) return null;
  return Math.log(0.75 / (share - 0.25)) / (2 * d);
}

// Flight fired level from the muzzle, stepped in time: distance, drop below the line
// of fire (m), speed and time at each whole metre up to `maxX`, or until the lifetime
// runs out. Returns { points, endX } where endX is where a limited lifetime ends it.
const TRAJECTORY_CACHE = new WeakMap();

export function trajectory(b, maxX = 200) {
  if (b && maxX === 200 && TRAJECTORY_CACHE.has(b)) return TRAJECTORY_CACHE.get(b);
  const points = [{ x: 0, drop: 0, speed: b.velocity, time: 0 }];
  if (!(b?.velocity > 0)) return { points, endX: 0 };
  const d = dragOf(b), g = GAME_GRAVITY * (b.gravity || 0), life = b.lifetime > 0 ? b.lifetime : Infinity;
  const dt = Math.min(0.0005, 0.25 / b.velocity);
  let vx = b.velocity, vy = 0, x = 0, y = 0, t = 0, next = 1;
  while (x < maxX && t < life && t < 30) {
    const speed = Math.hypot(vx, vy);
    vx += -d * speed * vx * dt;
    vy += (-d * speed * vy - g) * dt;
    x += vx * dt; y += vy * dt; t += dt;
    while (x >= next && next <= maxX) { points.push({ x: next, drop: -y, speed: Math.hypot(vx, vy), time: t }); next++; }
  }
  const result = { points, endX: t >= life ? x : null };
  if (b && maxX === 200) TRAJECTORY_CACHE.set(b, result);
  return result;
}
