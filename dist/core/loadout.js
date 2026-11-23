import { personalWeapons } from '../data/personal-weapons.js';
import { enemies } from '../data/combat-data.js';
import { factionSides, factionGuides } from '../data/faction-data.js';
import { stratagems, stratagemById } from './catalog.js';
import { compareAttacks, resolveAttack } from './compare.js';
import { enemySize, isLargeEnemy } from './enemy-size.js';
import { L } from './i18n.js';

// Common light/medium/heavy/air threats, plus the final (usually heavy) unit
// in each existing variant guide. This is a documented checklist, not spawn odds.
// Guides marked checklist: false (the Standard and Dragonroach · Hive Lord guides, 2026-11-23) add nothing:
// the Hive Lord's 150,000 health is not a one-shot target.
const baseline = {
  terminid: ['hunter-hardened', 'hive-guard', 'bile-spewer-armored', 'stalker', 'charger', 'impaler', 'shrieker', 'bile-titan'],
  automaton: ['trooper', 'berserker', 'devastator', 'heavy-devastator', 'hulk', 'annihilator-tank', 'gunship', 'factory-strider'],
  illuminate: ['voteless-light', 'overseer', 'elevated-overseer', 'watcher', 'fleshmob', 'harvester', 'warp-ship', 'leviathan'],
};
const enemyById = new Map(enemies.map(enemy => [enemy.id, enemy]));
const personalById = new Map(personalWeapons.map(weapon => [weapon.id, weapon]));
export const loadoutFactions = factionSides.map(({ id, name }) => ({
  id, name, enemyIds: [...new Set([...baseline[id], ...factionGuides.filter(guide => guide.side === id && guide.checklist !== false).map(guide => guide.units.at(-1).enemy)])],
}));

const personalSlots = ['primary', 'secondary', 'throwable'];
const keys = { primary: 'p', secondary: 's', throwable: 'g' };
function normalize(loadout = {}) {
  loadout ||= {};
  const result = Object.fromEntries(personalSlots.map(slot => {
    const id = loadout[slot] ?? loadout[keys[slot]];
    return [slot, personalById.get(id)?.category === slot ? id : ''];
  }));
  const input = loadout.stratagems ?? loadout.st ?? [];
  const ids = Array.isArray(input) ? input : typeof input === 'string' ? input.split(',') : [];
  const seen = new Set();
  result.stratagems = Array.from({ length: 4 }, (_, index) => {
    const id = ids[index];
    if (!stratagemById.has(id) || seen.has(id)) return '';
    seen.add(id); return id;
  });
  result.faction = loadoutFactions.some(f => f.id === (loadout.faction ?? loadout.f)) ? loadout.faction ?? loadout.f : 'terminid';
  return result;
}

/** Query string without ? or #. Empty stratagem positions are preserved. */
export function encodeLoadout(loadout) {
  const value = normalize(loadout);
  return new URLSearchParams({ p: value.primary, s: value.secondary, g: value.throwable, st: value.stratagems.join(','), f: value.faction }).toString();
}
/** Accepts a query string, full gear hash, URLSearchParams, or route.query. */
export function decodeLoadout(query) {
  let value;
  if (query instanceof URLSearchParams) value = Object.fromEntries(query);
  else if (typeof query === 'string') value = Object.fromEntries(new URLSearchParams(query.includes('?') ? query.slice(query.indexOf('?') + 1) : query.replace(/^\?/, '')));
  else value = query || {};
  return normalize(value);
}

function slotsOf(loadout) {
  return [...personalSlots.map(slot => ({ slot, slotIndex: null, weaponId: loadout[slot] })),
    ...loadout.stratagems.map((weaponId, slotIndex) => ({ slot: 'stratagems', slotIndex, weaponId }))].filter(item => item.weaponId);
}
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const simplicity = answer => Number(Boolean(answer.conditional)) + Number(Boolean(answer.assumption) && !answer.fragmentsExcluded) + Number(Boolean(answer.lowerBound))
  + (answer.accumulated ? answer.steps.reduce((sum, step) => sum + step.instances, 0) : Math.max(0, (answer.route?.stages.length || 1) - 1));
const rank = (a, b) => Number(b.verified) - Number(a.verified)
  || (a.hits ?? Infinity) - (b.hits ?? Infinity) || simplicity(a) - simplicity(b)
  || Number(a.outcome !== 'kill') - Number(b.outcome !== 'kill')
  || compareText(a.weaponId, b.weaponId) || compareText(a.modeId || '', b.modeId || '');

function answers(enemy, slot, options) {
  const resolved = resolveAttack(slot.weaponId);
  const entries = resolved.profile?.modes.map(mode => ({ weaponId: slot.weaponId, modeId: mode.id })) || [{ weaponId: slot.weaponId }];
  return compareAttacks(enemy, entries, options).entries.map(answer => ({
    ...answer, ...slot, modeName: answer.modeLabel, partName: answer.part?.name || null,
    partId: answer.part?.id || null, unit: answer.mode?.unit || '발', resultLabel: answer.part?.resultLabel || null,
  })).sort(rank);
}

/** A gap has no unconditional, non-regenerating fatal route under the accepted
 * defaults. All configured hit-count defaults are allowed and keep their
 * defaultAssumed metadata and assumption simplicity penalty. Explicit zero
 * fragments excludes damage and has no positive hit-assumption penalty.
 * Explicit shieldCleared may unlock routes; shieldAssumed reports
 * that prerequisite. Each answer uses one weapon/mode; the accumulation fallback
 * may target several explicitly counted instances sequentially.
 */
export function loadoutCoverage(loadout, factionId, options = {}) {
  options ||= {};
  const value = normalize(loadout);
  const faction = loadoutFactions.find(f => f.id === (factionId || value.faction));
  const slots = slotsOf(value);
  const notComputable = slots.flatMap(slot => {
    const attack = resolveAttack(slot.weaponId);
    return attack.profile ? [] : [{ ...slot, id: slot.weaponId, reason: attack.unsupported }];
  });
  if (!faction) return { faction: null, rows: [], gaps: [], notComputable, reason: L('알 수 없는 진영 ID입니다.', 'Unknown faction ID.') };
  const rows = faction.enemyIds.map(enemyId => {
    const enemy = enemyById.get(enemyId);
    const perSlot = slots.map(slot => {
      const modes = answers(enemy, slot, options);
      return { ...slot, best: modes.find(mode => mode.verified) || modes[0], modes };
    });
    const verified = perSlot.flatMap(slot => slot.modes.filter(mode => mode.verified)).sort(rank);
    const best = verified[0] || null;
    return { enemyId, enemyName: enemy?.name || enemyId, enemy, best, status: best ? 'route' : 'gap', perSlot,
      size: enemySize(enemyId), isLarge: isLargeEnemy(enemyId), oneShot: best?.oneShot ?? false,
      reason: best ? null : L('편성 내 단일 무기의 확인된 처치 경로가 없습니다. 가정·자료 미확인 결과는 공백으로 남깁니다.', 'No single weapon in this loadout has a verified kill route. Assumed or unverified results are left as gaps.') };
  });
  // Stable partition: large/massive enemies without a one-hit answer first;
  // keep guide order within both groups and preserve it entirely by default.
  if (options.prioritizeLarge === true) rows.sort((a, b) => Number(b.isLarge && !b.oneShot) - Number(a.isLarge && !a.oneShot));
  return { faction, rows, gaps: rows.filter(row => row.status === 'gap'), notComputable };
}

/** Array of {enemyId, enemyName, replacements}; up to options.limit (default 3)
 * for EACH slot position. Each candidate is one complete same-category swap.
 * Already carried stratagems are excluded; ties use stable IDs after simplicity.
 */
export function suggestFixes(loadout, factionId, options = {}) {
  options ||= {};
  const value = normalize(loadout);
  const coverage = loadoutCoverage(value, factionId, options);
  const requested = options.limit ?? options.maxPerSlot ?? 3;
  const limit = Number.isInteger(requested) ? Math.max(0, Math.min(requested, 20)) : 3;
  const slots = [...personalSlots.map(slot => ({ slot, slotIndex: null, current: value[slot] })),
    ...value.stratagems.map((current, slotIndex) => ({ slot: 'stratagems', slotIndex, current }))];
  return coverage.gaps.map(gap => ({
    enemyId: gap.enemyId, enemyName: gap.enemyName,
    replacements: slots.flatMap(slot => {
      if (!limit) return [];
      const candidates = slot.slot === 'stratagems' ? stratagems.filter(w => w.category === 'support' && !value.stratagems.includes(w.id))
        : personalWeapons.filter(w => w.category === slot.slot && w.id !== slot.current);
      return candidates.flatMap(weapon => {
        const candidate = answers(gap.enemy, { slot: slot.slot, slotIndex: slot.slotIndex, weaponId: weapon.id }, options).find(answer => answer.verified);
        return candidate ? [{ ...candidate, replaces: slot.current || null }] : [];
      }).sort(rank).slice(0, limit);
    }),
  }));
}

// Additive adapter for the supervisor's short-key gear UI. Core APIs above keep
// their canonical slot names; only view fixes use p/s/g/st0..st3 action keys.
export function loadoutView(loadout, factionId, options = {}) {
  const coverage = loadoutCoverage(loadout, factionId, options);
  const fixes = suggestFixes(loadout, factionId, options);
  return { ...coverage, rows: coverage.rows.map(row => ({ ...row,
    fixes: (fixes.find(fix => fix.enemyId === row.enemyId)?.replacements || []).map(fix => ({
      ...fix, slot: fix.slot === 'stratagems' ? `st${fix.slotIndex}` : keys[fix.slot],
    })),
  })) };
}
