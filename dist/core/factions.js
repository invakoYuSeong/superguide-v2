// Faction loadout recommendations. The weapon order and aim points are
// editorial (easy aim first, not fewest hits); the numbers always come from
// the combat engine for the editor's chosen aim points.
import { enemies, weaponProfiles } from '../data/combat-data.js';
import { factionLoadouts } from '../data/faction-loadouts.js';
import { factionAimTargets, factionTactics, factionApproaches, factionGuideEnemies } from '../data/faction-data.js';
import { solveMatchup, isFatal, sortRoutes, spearCannotLock } from './combat.js';

export const findEnemy = id => enemies.find(item => item.id === id) || factionGuideEnemies[id];

/** Wiki-described tactical result for this exact weapon mode, if any. */
export function wikiReference(enemy, weaponId, mode) {
  if (!mode || mode.hitCondition && !mode.assumption || spearCannotLock(enemy, mode)) return null;
  return enemy.tacticalResults?.find(item => item.weapon === weaponId && item.mode === mode.id) || null;
}

// `enemy` defaults to the current data; the parity test passes the legacy values (and engine
// options that switch off rules the legacy engine did not have).
export function recommend(unit, choice, enemy = findEnemy(unit.enemy), engineOptions = {}) {
  const [weaponId, modeId] = choice.split(':');
  const pick = factionLoadouts[unit.enemy]?.find(item => item.weapon === choice);
  if (enemy && pick?.adviceOnly) return { enemy, weaponId, pick, adviceOnly: true };

  const profile = weaponProfiles[weaponId];
  const mode = modeId ? profile?.modes.find(item => item.id === modeId) : profile?.modes[0];
  if (!enemy || !mode) throw new Error(`Unknown faction recommendation: ${unit.enemy}/${choice}`);
  const approach = factionApproaches[`${enemy.id}:${choice}`];
  // Guides assume the shield is handled; approaches may exclude the direct hit.
  const matchup = solveMatchup(enemy, mode, { shieldCleared: true, ...engineOptions, ...(approach ? { directHit: approach.directHit } : {}) });
  const aims = approach ? [approach.target] : pick?.targets || factionAimTargets[`${enemy.id}:${choice}`] || unit.targets;
  // Only the editor's aim points count: never silently swap in an easier-to-count part.
  const options = sortRoutes(aims.map(id => matchup.rows.find(row => row.target.id === id)).filter(row => row && isFatal(row)));
  const route = options[0] || (pick ? null : matchup.best);
  return {
    enemy, weaponId, profile, mode, pick, approach, route,
    alternatives: options.slice(1),
    reference: wikiReference(enemy, weaponId, mode),
    tactic: factionTactics[`${enemy.id}:${choice}`] || null,
  };
}
