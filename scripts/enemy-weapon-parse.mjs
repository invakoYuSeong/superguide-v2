// Reads the {{Enemy Loadout Box}} templates of an enemy wiki page and the numbers in them.
// Shared by fetch-enemy-weapons.mjs, build-enemy-weapons.mjs and test-enemy-weapons.mjs.

// Every {{Enemy Loadout Box ...}} as its raw parameters ({ title, damage, ap, ... }).
export function loadoutBoxes(text) {
  const boxes = [];
  const start = /\{\{\s*Enemy Loadout Box/gi;
  for (let match; (match = start.exec(text));) {
    let depth = 0, i = match.index;
    for (; i < text.length; i++) {
      if (text.startsWith('{{', i)) { depth++; i++; } else if (text.startsWith('}}', i)) { depth--; i++; if (depth === 0) break; }
    }
    boxes.push(params(text.slice(match.index + 2, i - 1)));
    start.lastIndex = i;
  }
  return boxes;
}

// Top-level "| key = value" pairs; pipes inside {{...}} and [[...]] belong to the value.
function params(body) {
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; i++; } else if (two === '}}' || two === ']]') { depth--; i++; } else if (body[i] === '|' && depth === 0) { parts.push(body.slice(last, i)); last = i + 1; }
  }
  parts.push(body.slice(last));
  const out = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

// "{{damage|35 Ballistic Damage}}", "{{damage|melee|80 Melee Damage|notext}}" -> [{ value, type }].
export function damages(value) {
  return [...String(value ?? '').matchAll(/(\d[\d,.]*)\s*([A-Za-z]+)?\s*Damage/g)].map(m => ({ value: Number(m[1].replace(/,/g, '')), type: (m[2] || '').toLowerCase() || null }));
}

// "2/2/1/0" -> 2 (the direct-hit value); a lone number stays itself.
export const directAp = value => { const m = /^\s*(\d+)/.exec(String(value ?? '').replace(/\{\{[^}]*\}\}/g, '')); return m ? Number(m[1]) : null; };

// Plain leading number of a field ("25 ({{damage|stagger|Ragdolls|notext}})" -> 25).
export const leadingNumber = value => { const m = /^\s*(\d[\d,.]*)/.exec(String(value ?? '')); return m ? Number(m[1].replace(/,/g, '')) : null; };

// Helldiver health and armor-rating damage factors from Template:Armor Ratings.
export function armorRatings(text) {
  const health = Number(/#vardefine:health\|\{\{\{health\|(\d+)\}\}\}/.exec(text)?.[1]);
  const factors = {};
  for (const m of text.matchAll(/#vardefine:armor_(\d+)\|\{\{\{armor_\d+\|([\d.]+)\}\}\}/g)) factors[m[1]] = Number(m[2]);
  const part = key => Number(new RegExp(`#vardefine:${key}\\|\\{\\{\\{${key}\\|([\\d.]+)\\}\\}\\}`).exec(text)?.[1]);
  return { health, factors, head: part('head'), chest: part('chest'), arm: part('arm'), leg: part('leg'), fortified: part('fortified'), vitality: part('vitality') };
}

// Damage types whose number is one hit (bullet, punch, claw). Fire, acid and webs keep burning
// after the hit, so they get no hit count.
const HIT_TYPES = new Set(['ballistic', 'melee', 'slash', 'strike', 'eviscerate', 'eviserate']);
export const ARMOR_RATINGS = [50, 100, 150];
const blast = value => { const m = /(\d[\d,]*)\s*Blast/i.exec(String(value ?? '')); return m ? Number(m[1].replace(/,/g, '')) : null; };

/**
 * One loadout box as the enemy view shows it. `hits` (torso shots a Helldiver survives before
 * dying, per armor rating) is given only for a single plain hit with no explosion part: explosions
 * fall off with distance and can hit several body parts, and the wiki gives no rule for how enemy
 * AP meets Helldiver armor, so those are left out.
 */
export function enemyAttack(box, ratings) {
  const en = String(box.title).replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
  const found = damages(box.damage);
  const pellets = /\d\s*\/\s*\d/.test(String(box.damage ?? ''));
  const direct = found.length === 1 && !pellets && found[0].value > 0 ? found[0] : null;
  const explosion = blast(box.aoe_damage) || null;
  const hits = direct && !explosion && HIT_TYPES.has(direct.type)
    ? Object.fromEntries(ARMOR_RATINGS.map(rating => [rating, Math.ceil(ratings.health / (direct.value * ratings.chest * ratings.factors[rating]) - 1e-9)]))
    : null;
  return {
    en, damage: direct?.value ?? null, damageType: direct?.type ?? null, ap: direct ? directAp(box.ap) : null,
    explosion, explosionAp: explosion ? directAp(box.aoe_ap) : null, hits,
  };
}
