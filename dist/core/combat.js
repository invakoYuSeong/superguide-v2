// Combat engine: how many hits a weapon needs on one hitbox route.
//
// Model: the same attack lands on the same hitbox again and again at maximum
// damage. Each hit damages the part and passes a share (toMain %) to the
// enemy's main health pool. A route ends when a fatal part breaks, the main
// pool runs out, or the part breaks without killing. Missing data is never
// read as zero: anything unverified yields `hits: null` with a reason code.
// Rules follow https://helldivers.wiki.gg/wiki/Damage.
import { L } from './i18n.js';

const EPSILON = 1e-9;
const MAX_HITS = 20000;
const floor = value => Math.floor(value + EPSILON);
export const known = value => Number.isFinite(value) && value >= 0;
const sumKnown = values => values.every(known) ? values.reduce((sum, value) => sum + value, 0) : null;

// Penetration: below the armor value nothing gets through, equal value 65%.
export const armorFactor = (ap, armor) => ap < armor ? 0 : ap === armor ? 0.65 : 1;

// Static constitution is extra health that never decays (not a bleed timer).
export const partPool = part => part.hp + (part.staticConstitution || 0);
const transferCap = part => partPool(part) + (part.constitution || 0) + (part.transferExtraHealth || 0);

// Attacks list their explosions explicitly, or carry one legacy explosion field
// (where an explicit `explosionDurable: null` means "unverified", not "same").
export function explosionsOf(attack) {
  if (attack.explosions) return attack.explosions;
  if (attack.explosion === 0) return [];
  return [{
    id: 'explosion', name: attack.explosionName || L('폭발', 'Explosion'), standard: attack.explosion,
    durable: Object.hasOwn(attack, 'explosionDurable') ? attack.explosionDurable : attack.explosion,
    ap: attack.explosionAp, innerRadius: attack.innerRadius, radius: attack.radius,
  }];
}

// Explosion strength at a distance from its centre: full inside the inner
// radius, then linear falloff with AP reduced by one (never below 2).
function blastAt(blast, distance) {
  if (!known(distance)) return { factor: null, ap: null };
  if (distance === 0) return { factor: 1, ap: blast.ap };
  if (known(blast.radius) && distance >= blast.radius) return { factor: 0, ap: blast.ap };
  if (!known(blast.innerRadius) || !known(blast.radius) || blast.radius < blast.innerRadius) return { factor: null, ap: null };
  if (distance <= blast.innerRadius) return { factor: 1, ap: blast.ap };
  return { factor: (blast.radius - distance) / (blast.radius - blast.innerRadius), ap: known(blast.ap) ? Math.max(2, blast.ap - 1) : null };
}

function directDamage(attack, part, directHit) {
  if (!directHit || attack.standard === 0 && attack.durable === 0) return 0;
  if (known(attack.ap) && attack.ap < part.armor) return 0;
  if (![attack.ap, part.durability, part.armor].every(known)) return null;
  // Durability blends normal and durable damage by the part's durable share.
  const d = part.durability;
  let blended = null;
  if (d === 0) blended = attack.standard;
  else if (d === 100) blended = attack.durable;
  else if (known(attack.standard) && known(attack.durable)) blended = floor(attack.standard * (1 - d / 100) + attack.durable * d / 100);
  return known(blended) ? floor(blended * armorFactor(attack.ap, part.armor)) : null;
}

// One impact against one part. A part immune to explosions (ExDR 100) routes
// the blast to the main body's armor and resistance instead.
export function hitDamage(attack, part, main, { directHit = true, excludeMainExplosion = false, blastDistance = 0 } = {}) {
  const direct = directDamage(attack, part, directHit);
  const blasts = explosionsOf(attack).map(blast => {
    const { factor, ap } = blastAt(blast, blastDistance);
    const redirected = part.exdr === 100;
    const receiver = redirected ? main : part;
    const excluded = redirected && excludeMainExplosion;
    let amount = null;
    if (excluded || factor === 0 || receiver.exdr === 100 || blast.durable === 0 || known(ap) && ap < receiver.armor) amount = 0;
    // Negative resistance is a verified weakness multiplier (Warp Ship hull).
    else if ([factor, ap, blast.durable, receiver.armor].every(known) && Number.isFinite(receiver.exdr) && receiver.exdr <= 100) {
      amount = floor(blast.durable * factor * armorFactor(ap, receiver.armor) * (1 - receiver.exdr / 100));
    }
    return { ...blast, effectiveAp: ap, factor, armor: receiver.armor, exdr: receiver.exdr, redirected, excluded,
      toPart: redirected ? 0 : amount, toMain: redirected ? amount : 0 };
  });
  return {
    direct, blasts,
    explosion: sumKnown(blasts.map(blast => blast.toPart)),
    mainExplosion: sumKnown(blasts.map(blast => blast.toMain)),
  };
}

// --- Hit-count assumptions for arcs and cluster bomblets -------------------

// Arcs and bomblets have no verified per-part hit count, so the user picks an
// explicit assumption. Without one the matchup stays pending.
export function withHitAssumption(mode, { hitCount = '',
  primaryHit = mode?.hitCondition?.defaultPrimaryHit ?? 'blast',
  bombletDirect = mode?.hitCondition?.defaultBombletDirect ?? false } = {}) {
  if (!mode?.hitCondition) return mode;
  const { kind, min, max } = mode.hitCondition;
  const count = typeof hitCount === 'number' || /^\d+$/.test(hitCount) ? Number(hitCount) : NaN;
  const valid = Number.isInteger(count) && count >= min && count <= max
    && ['none', 'blast', 'direct'].includes(primaryHit) && typeof bombletDirect === 'boolean';
  if (!valid) return { ...mode, events: undefined, assumption: undefined };
  const event = (name, attack, times, directHit) => ({ name, attack, times, directHit });
  const events = ['arcs', 'pellets'].includes(kind)
    ? [event(kind === 'arcs' ? L('전격', 'Arcs') : L('명중 탄체·펠릿', 'Projectiles/pellets hit'), mode, count, true)]
    : kind === 'shrapnel'
      ? [event(L('주탄·폭발', 'Main projectile/explosion'), mode, 1, mode.delivery !== 'explosive'),
        ...(count === 0 ? [] : [event(L('명중 파편', 'Fragments hit'), mode.bomblet, count, true)])]
    : [
      ...(primaryHit === 'none' ? [] : [event(L('주탄', 'Main projectile'), mode, 1, primaryHit === 'direct')]),
      ...(count === 0 ? [] : [event(L('자탄', 'Bomblets'), mode.bomblet, count, bombletDirect)]),
    ];
  return { ...mode, events, assumption: { count,
    primaryHit: kind === 'shrapnel' ? mode.delivery === 'explosive' ? 'blast' : 'direct' : primaryHit,
    bombletDirect: kind === 'shrapnel' ? true : bombletDirect } };
}

// --- Routes ------------------------------------------------------------------

const hasUnknownCap = part => part.capUnverified && part.overflowCap == null || Boolean(part.next && hasUnknownCap(part.next));
const assumeCap = (part, capped) => ({
  ...part,
  ...(part.capUnverified && part.overflowCap == null ? { overflowCap: capped } : {}),
  ...(part.next ? { next: assumeCap(part.next, capped) } : {}),
});
const CAP_NOTE = L('본체 전달 상한은 자료 미확인입니다. 상한 적용 여부가 표시 횟수와 결과에 영향을 주지 않는 경우만 계산했습니다.', 'The damage cap to main is unverified. Only cases where the cap does not change the count or the result were calculated.');

/**
 * @returns {{ target, stages, hits: number|null, outcome: string, via?: 'part'|'main',
 *   conditional: boolean, reason?: string, detail?: string, notes: string[], lowerBound?: boolean }}
 * outcome: kill | bleed | break | armor | down | blocked | shield | unknown
 */
export function solveRoute(enemy, target, attack, options = {}) {
  // An unknown transfer cap is not "no cap": solve both ways and only publish
  // a count when both agree.
  if (hasUnknownCap(target) && !target.unknownReason) {
    const capped = solveRoute(enemy, assumeCap(target, true), attack, options);
    const open = solveRoute(enemy, assumeCap(target, false), attack, options);
    if (capped.hits !== open.hits || capped.outcome !== open.outcome) {
      return { ...pending(target), reason: 'cap-unknown' };
    }
    const agreed = { ...capped, target, via: capped.via === open.via ? capped.via : undefined };
    return capped.hits == null ? agreed : { ...agreed, notes: [...agreed.notes, CAP_NOTE] };
  }
  // A separate device (e.g. a shield generator) is solved on its own; its
  // unverified link to the main body is not invented.
  if (target.partOnly && !target.unknownReason) {
    const device = { ...target, partOnly: false, toMain: 0, overflowCap: false, isolated: true };
    const result = solveRoute(enemy, device, attack, { ...options, excludeMainExplosion: true });
    return { ...result, target, notes: [target.partOnlyNote].filter(Boolean) };
  }
  const result = solveReviewed(enemy, target, attack, options);
  // Regenerating enemies: the count ignores regeneration, so it is a floor.
  const finalPart = target.next || target;
  if (enemy.regeneration && result.hits != null && !(result.via === 'part' && finalPart.regenerates === false)) {
    return { ...result, lowerBound: true, notes: [enemy.regeneration.note] };
  }
  return result;
}

const pending = target => ({ target, stages: [], hits: null, outcome: 'unknown', conditional: Boolean(target.prerequisite), notes: [] });

function solveReviewed(enemy, target, attack, options) {
  const base = pending(target);
  if (!attack || attack.unsupported) return { ...base, reason: 'unsupported', detail: attack?.unsupported };
  if (enemy.shield && !options.shieldCleared && (!enemy.shield.partial || target.requiresShieldClear)) {
    return { ...base, outcome: 'shield', reason: 'shield', detail: enemy.shield.note };
  }
  if (target.unknownReason) return { ...base, reason: 'part-unknown', detail: target.unknownReason };
  if (attack.beam) return solveBeam(enemy, target, attack, options);
  if (attack.hitCondition && !attack.events) return { ...base, reason: 'assumption-needed' };
  return solveImpacts(enemy, target, attack, options);
}

// Shots made of one or more damage events. A plain shot is a single event;
// arcs and bomblets are several, each rounded and transferred on its own.
function solveImpacts(enemy, target, attack, options) {
  const base = pending(target);
  const multi = Boolean(attack.events);
  const events = attack.events || [{ name: null, attack, times: 1, directHit: options.directHit }];
  // Separate explosions are separate damage events for transfer rounding.
  const splitTransfer = multi || Boolean(attack.explosions);
  const main = target.main || enemy.main;
  const perShot = events.reduce((sum, event) => sum + event.times, 0);
  const stages = [];
  let mainLeft = main.hp;
  let shots = 0;
  let part = target;
  let copy = 1;

  while (part) {
    const hits = events.map(event => ({ ...event, damage: hitDamage(event.attack, part, main, { ...options, directHit: event.directHit ?? options.directHit }) }));
    const total = Object.fromEntries(['direct', 'explosion', 'mainExplosion'].map(key =>
      [key, sumKnown(hits.map(event => known(event.damage[key]) ? event.damage[key] * event.times : null))]));
    const stage = { part, hits: 0, damage: total, events: hits, ...(part.copies > 1 ? { copy } : {}) };
    stages.push(stage);
    if (!Object.values(total).every(known)) return { ...base, stages, reason: multi ? 'assumption-data-missing' : 'data-missing' };
    if (total.direct + total.explosion + total.mainExplosion === 0) {
      const reason = multi ? 'no-damage-assumed' : shots ? 'no-damage-after-armor' : 'no-damage';
      return { ...base, stages, hits: shots || null, outcome: shots ? 'armor' : 'blocked', reason };
    }

    let partLeft = part.mainOnly ? Infinity : partPool(part);
    let capLeft = transferCap(part);
    let advanced = false;
    for (let shot = 0; shot < MAX_HITS && !advanced; shot++) {
      shots++; stage.hits++;
      let applied = 0;
      eventsInShot: for (const event of hits) for (let i = 0; i < event.times; i++) {
        applied++;
        const { direct, explosion, mainExplosion, blasts } = event.damage;
        const partDamage = direct + explosion;
        let transfer = splitTransfer
          ? [direct, ...blasts.map(blast => blast.toPart)].reduce((sum, amount) => sum + floor(amount * part.toMain / 100), 0)
          : floor(partDamage * part.toMain / 100);
        if (part.overflowCap) { transfer = Math.min(transfer, capLeft); capLeft -= transfer; }
        mainLeft -= transfer + mainExplosion;
        partLeft -= partDamage;
        if (partLeft <= 0) mainLeft -= part.destroyMainDamage || 0;

        const done = { ...base, stages, hits: shots };
        // A fatal part kills outright, skipping the main bleed-out pool.
        if (partLeft <= 0 && part.effect === 'kill' && copy >= (part.copies || 1)) return { ...done, outcome: 'kill', via: 'part' };
        if (partLeft <= -(part.constitution || Infinity) && part.effect === 'bleed' && copy >= (part.copies || 1)) return { ...done, outcome: 'kill', via: 'part' };
        // An isolated part never assumes a fresh main pool.
        if (!target.isolated && mainLeft <= 0) {
          return { ...done, outcome: main.constitution && mainLeft > -main.constitution ? 'bleed' : 'kill', via: 'main' };
        }
        if (partLeft <= 0) {
          if (copy < (part.copies || 1)) { copy++; advanced = true; break eventsInShot; }
          copy = 1;
          if (!part.next) return { ...done, outcome: part.effect, via: 'part' };
          // Leftover arcs/bomblets of the same shot hitting the exposed layer is unverified.
          if (applied < perShot) return { ...base, stages, reason: 'leftover-events' };
          part = part.next;
          advanced = true;
          break;
        }
      }
    }
    if (!advanced) return { ...base, stages, reason: 'too-many-hits' };
  }
  return base;
}

// A beam burst is a damage budget, not an instant hit: it stops when the part
// breaks or main health runs out. A beam held on the same spot keeps burning
// once the armor there breaks, so the rest of the budget reaches the exposed
// layer. Budgets are counted in bursts (fractions of one shot) per layer.
function solveBeam(enemy, target, attack, options) {
  const base = pending(target);
  const main = target.main || enemy.main;
  const { beam } = attack;
  const bleedOrKill = main.constitution ? 'bleed' : 'kill';
  const stages = [];
  let mainLeft = main.hp;
  let spent = 0;
  let part = target;
  let copy = 1;
  while (part) {
    const damage = hitDamage(attack, part, main, options);
    const stage = { part, hits: 0, damage, events: [{ name: null, attack, times: 1, damage }], ...(part.copies > 1 ? { copy } : {}) };
    stages.push(stage);
    if (![damage.direct, damage.explosion, damage.mainExplosion, beam.duration, beam.standardPerSecond, beam.durablePerSecond, part.hp, part.toMain, main.hp].every(known)
      || beam.duration === 0 || part.hp === 0 || main.hp === 0 || damage.explosion !== 0 || damage.mainExplosion !== 0) {
      return { ...base, stages, reason: 'beam-data-missing' };
    }
    if (damage.direct === 0) {
      return part === target ? { ...base, stages, outcome: 'blocked', reason: 'beam-blocked' }
        : { ...base, stages, hits: Math.ceil(spent - EPSILON), outcome: 'armor', reason: 'no-damage-after-armor' };
    }
    const partBursts = part.mainOnly ? Infinity : partPool(part) / damage.direct;
    const transferPerBurst = damage.direct * part.toMain / 100;
    const cap = part.overflowCap ? transferCap(part) : Infinity;
    const mainBursts = !target.isolated && transferPerBurst > 0 && mainLeft <= cap ? mainLeft / transferPerBurst : Infinity;
    const bursts = Math.min(partBursts, mainBursts);
    const before = spent;
    spent += bursts;
    const hits = Math.ceil(spent - EPSILON);
    if (hits < 1 || hits > MAX_HITS) return { ...base, stages, reason: 'too-many-hits' };
    // A layer's count is the shots that start on it; a shot that breaks the
    // armor carries on into the next layer.
    Object.assign(stage, { hits: hits - Math.ceil(before - EPSILON), contactSeconds: bursts * beam.duration, partTotal: damage.direct * bursts, mainTotal: Math.min(transferPerBurst * bursts, cap) });
    const done = { ...base, stages, hits };
    if (partBursts <= mainBursts && part.effect === 'kill' && copy >= (part.copies || 1)) return { ...done, outcome: 'kill', via: 'part' };
    if (partBursts <= mainBursts && mainLeft - stage.mainTotal - (part.destroyMainDamage || 0) <= 0) return { ...done, outcome: bleedOrKill, via: 'main' };
    if (mainBursts <= partBursts) return { ...done, outcome: bleedOrKill, via: 'main' };
    if (copy < (part.copies || 1)) {
      mainLeft -= stage.mainTotal + (part.destroyMainDamage || 0);
      spent = hits; copy++; continue;
    }
    copy = 1;
    if (!part.next) return { ...done, outcome: part.effect, via: 'part' };
    mainLeft -= stage.mainTotal + (part.destroyMainDamage || 0);
    part = part.next;
  }
  return base;
}

// --- Matchups ------------------------------------------------------------------

export const FATAL = ['kill', 'bleed', 'down'];
export const isFatal = row => !row.conditional && FATAL.includes(row.outcome) && row.hits != null;
const byFewestHits = (a, b) => a.hits - b.hits || Number(a.outcome !== 'kill') - Number(b.outcome !== 'kill');

/** Every part route of an enemy, plus the quickest unconditional fatal route. */
export function solveMatchup(enemy, attack, options = {}) {
  const rows = enemy.parts.map(part => solveRoute(enemy, part, attack, options));
  const best = rows.filter(row => !row.conditional && FATAL.includes(row.outcome)).sort(byFewestHits)[0] || null;
  return { rows, best };
}
export const sortRoutes = rows => [...rows].sort(byFewestHits);

// The Spear only locks onto listed large targets. Newer entries carry the flag.
const SPEAR_TARGETS = new Set(['charger', 'behemoth', 'bile-titan', 'hulk', 'harvester', 'brood-commander', 'stalker', 'impaler', 'scout-strider', 'reinforced-strider', 'gunship', 'annihilator-tank']);
export const spearCannotLock = (enemy, attack) => attack?.delivery === 'guided'
  && !(typeof enemy.spearLock === 'boolean' ? enemy.spearLock : SPEAR_TARGETS.has(enemy.id));
