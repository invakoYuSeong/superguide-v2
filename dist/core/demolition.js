// Demolition: can an attack destroy a structure, and how?
//
// Two independent paths exist (https://helldivers.wiki.gg/wiki/Demolition):
//  1. Demolition force - a single hit or blast whose force meets a route's
//     threshold destroys it instantly. Force never adds up across hits.
//  2. Health - some structures also have a health pool that normal damage
//     can wear down.
// Unknown force or damage stays unknown; it is never read as "cannot".
// A route whose threshold is unverified (null) never passes or fails on force.
import { hitDamage, known } from './combat.js';

export const forceRange = value => value == null ? null : typeof value === 'number' ? { min: value, max: value } : value;

const POSSIBLE = ['demolish', 'health', 'conditional'];
export const isPossible = result => POSSIBLE.includes(result.outcome);

function checkForce(route, attack) {
  const parts = ['direct', 'explosion'].map(kind => {
    const force = forceRange(attack[kind]);
    let verdict = 'short';
    if (route.explosiveOnly && kind === 'direct') verdict = 'n/a';
    else if (attack.forceUnknown || route.threshold == null) verdict = 'unknown';
    else if (force?.min >= route.threshold) verdict = 'pass';
    else if (force?.max >= route.threshold) verdict = 'unknown'; // conflicting sources straddle the threshold
    // The Warp Ship hull's non-explosive route is disputed except for verified attacks.
    if (verdict === 'pass' && kind === 'direct' && route.nonExplosiveUncertain && !attack.shieldBypass && !attack.warpHullDirect) verdict = 'unknown';
    return { kind, force, verdict };
  });
  // Prefer the explosion: its centre can reach the structure without a physical hit.
  const winner = [...parts].reverse().find(part => part.verdict === 'pass');
  return { route, parts, via: winner?.kind ?? null, verdict: winner ? 'pass' : parts.some(part => part.verdict === 'unknown') ? 'unknown' : 'short' };
}

export function healthDamage(structure, attack) {
  if (!structure.health || !attack?.damage) return null;
  const d = attack.damage;
  if (!['standard', 'durable', 'ap', 'explosion', 'explosionAp'].every(key => known(d[key]))) return null;
  const { direct, explosion } = hitDamage(d, structure.health, structure.health);
  const total = direct + explosion;
  return { direct, explosion, total, hits: total > 0 ? Math.ceil(structure.health.hp / total) : null };
}

/**
 * outcome: demolish | health | conditional | blocked | unknown
 * conditions: [{ kind: 'opening'|'aim'|'shield'|'jammer'|'anti-air', text? }]
 */
export function solveDemolition(structure, profile, attack, { shieldCleared = false, jammerDisabled = false } = {}) {
  const base = { structure, outcome: 'unknown', method: null, route: null, via: null, hits: null, unit: attack?.unit || '발', conditions: [], routes: [], health: null };
  if (!profile || !attack) return { ...base, reason: 'no-data' };

  const routes = structure.routes.map(route => checkForce(route, attack));
  const health = healthDamage(structure, attack);
  const outer = routes.find(row => row.verdict === 'pass' && !row.route.opening);
  const opening = routes.find(row => row.verdict === 'pass' && row.route.opening);
  const result = { ...base, routes, health };

  // Outer surface first, then wearing down health, then an explosion inside an opening.
  if (outer) Object.assign(result, { outcome: 'demolish', method: 'force', route: outer.route, via: outer.via, reason: outer.via === 'explosion' ? 'force-blast' : 'force-direct' });
  else if (health?.hits) Object.assign(result, { outcome: 'health', method: 'health', hits: health.hits, reason: 'health' });
  else if (opening) Object.assign(result, { outcome: 'demolish', method: 'force', route: opening.route, via: opening.via, reason: 'force-opening' });
  else if (routes.some(row => row.verdict === 'unknown')) result.reason = structure.routes.every(route => route.threshold == null) ? 'threshold-unknown' : 'force-unknown';
  else if (structure.health && !health) result.reason = 'health-unknown';
  else Object.assign(result, { outcome: 'blocked', reason: health ? 'blocked-armor' : 'blocked-force' });

  if (result.method) {
    if (result.route?.opening) result.conditions.push({ kind: 'opening', route: result.route });
    if (profile.conditionalAim) result.conditions.push({ kind: 'aim', text: profile.note });
    if (structure.condition === 'shield' && !shieldCleared && !(attack.shieldBypass && !result.route?.opening)) result.conditions.push({ kind: 'shield' });
    if (structure.condition === 'jammer' && profile.requiresCallIn && !jammerDisabled) result.conditions.push({ kind: 'jammer' });
    if (structure.condition === 'anti-air' && profile.eagle) result.conditions.push({ kind: 'anti-air' });
    if (result.conditions.length) result.outcome = 'conditional';
  }
  return result;
}

/** Structure-first view: which stratagems (and which of their modes) can destroy it. */
export function structureOverview(structure, stratagems, profiles, options = {}) {
  const entries = [];
  let unknown = 0, blocked = 0;
  for (const weapon of stratagems) {
    const profile = profiles[weapon.id];
    // Each firing mode stands alone; an unverified mode is never lifted by another.
    const attacks = (profile?.modes || []).map(mode => ({ mode, result: solveDemolition(structure, profile, mode, options) }));
    const viable = attacks.filter(attack => isPossible(attack.result));
    if (viable.length) {
      const outcome = viable.find(attack => attack.result.outcome !== 'conditional')?.result.outcome || 'conditional';
      entries.push({ weapon, profile, attacks: viable, outcome });
    } else if (!attacks.length || attacks.some(attack => attack.result.outcome === 'unknown')) unknown++;
    else blocked++;
  }
  const conditional = entries.filter(entry => entry.outcome === 'conditional').length;
  return { structure, entries, possible: entries.length - conditional, conditional, unknown, blocked };
}

/** Weapon-first view: one attack mode against every structure. */
export const weaponOverview = (structures, profile, mode, options = {}) =>
  structures.map(structure => solveDemolition(structure, profile, mode, options));
