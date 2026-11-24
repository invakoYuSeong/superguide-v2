// Pure local-source parsing shared by the builder and read-only cross-check.
const clean = value => (value ?? '').replace(/<[^>]*>/g, ' ').replace(/'''?/g, '').trim();
const numeric = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const num = value => Number(value.replaceAll(',', ''));
export const scalar = value => {
  const match = clean(value).match(new RegExp(`^(${numeric})$`));
  return match ? num(match[1]) : null;
};
export function damageEntries(raw) {
  return [...(raw ?? '').matchAll(/\{\{\s*Damage\s*\|\s*([^|}]+)\|\s*([^|}]+)(?:\|[^}]*)?\}\}/gi)].map(m => ({ element: m[1].trim().toLowerCase(), text: m[2].trim(), raw: m[0] }));
}
export function infoboxExtras(box, weapon) {
  const entries = damageEntries(box.damage);
  const burning = entries.filter(e => !['laser', 'beam'].includes(e.element) && /DPS|\/s\b|per second/i.test(e.text));
  // Preserve unknown DoT wording too; never derive DPS from total damage.
  const dotRaw = burning.length ? burning.map(e => e.raw).join('\n') : /DPS|\/s\b|per second|damage.over.time/i.test(box.damage ?? '') && !entries.length ? box.damage : null;
  const dot = { element: burning.length === 1 ? burning[0].element : null, perSecond: null, duration: null, raw: dotRaw };
  if (burning.length === 1) {
    const text = burning[0].text;
    const rate = text.match(new RegExp(`^(${numeric})\\s*(?:Fire\\s+|Gas\\s+)?(?:DPS|/s|per second)(?:\\s+(?:Fire|Gas))?(?:\\s+over\\s+${numeric}\\s*s)?$`, 'i'));
    if (rate) dot.perSecond = num(rate[1]);
    const duration = text.match(new RegExp(`\\bover\\s+(${numeric})\\s*s\\b`, 'i'));
    if (duration) dot.duration = num(duration[1]);
  }
  const heatRaw = weapon.roundType === 'heat' && box.capacity ? box.capacity : null;
  const heat = clean(heatRaw).match(new RegExp(`^(${numeric})\\s*s(?:\\s*\\((${numeric})\\))?(?:\\s*\\(Fires Indefinitely\\))?$`, 'i'));
  // A bare whole number is shots, not seconds: the Talon's '7' (its page: 'can overheat within 7 shots').
  const bareShots = !heat && /^\d+$/.test(clean(heatRaw)) ? num(clean(heatRaw)) : null;
  const heatCapacity = { seconds: heat ? num(heat[1]) : null, shots: heat?.[2] ? num(heat[2]) : bareShots, raw: heatRaw };
  const rateText = clean(box.fire_rate);
  const rateParts = rateText.split(/\{\{\s*\*\s*\}\}/).map(s => s.trim());
  const rates = rateParts.map(s => s.match(new RegExp(`^(${numeric})\\s*(?:rpm)?$`, 'i'))).map(m => m ? num(m[1]) : null);
  const validRates = rates.length && rates.every(n => n !== null) ? rates : [];
  // Round-by-round reload (Rounds Reload weapons): rounds_reload_first '1.25s (Empty)<br>0.4s (Partial)' and _rest per
  // round. clip: an empty magazine refills at once by clip or speedloader (reload_time, no rounds_reload_full_time:
  // Constitution, Senator, Stim Pistol), so it is faster than loading round by round.
  const seconds = text => { const m = clean(text).match(new RegExp(`^(${numeric})\\s*s?$`, 'i')); return m ? num(m[1]) : null; };
  const firstParts = String(box.rounds_reload_first ?? '').split(/<br\s*\/?>/i).map(part => clean(part));
  const firstOf = label => { const part = firstParts.find(p => new RegExp(`\\(${label}\\)`, 'i').test(p)) ?? (label === 'Empty' ? firstParts.find(p => !/\(/.test(p)) : null); return part ? seconds(part.replace(/\([^)]*\)/, '')) : null; };
  const roundsReload = weapon.roundType === 'rounds' && firstOf('Empty') != null && seconds(box.rounds_reload_rest) != null
    ? { first: firstOf('Empty'), firstPartial: firstOf('Partial'), rest: seconds(box.rounds_reload_rest), clip: Boolean(clean(box.reload_time)) && !clean(box.rounds_reload_full_time) }
    : null;
  return { dot, heatCapacity, roundsReload, swingsPerMinute: weapon.type === 'melee' ? scalar(box.fire_rate) : null,
    rpmModes: weapon.type !== 'melee' && validRates.length > 1 ? validRates : [],
    rpm: weapon.type !== 'melee' && validRates.length === 1 ? validRates[0] : null,
    spareRounds: scalar(box.spare_rounds) };
}

// Reviewed snapshot disagreements only. Do not automatically acknowledge new drift
// during a rebuild: the complete tuple must still match this explicit ledger.
export const reviewedConflicts = {
  'PLAS-39 Accelerator Rifle': [{ field: 'spareMags', db: 12, infobox: 8, raw: '8' }],
  'P-92 Warrant': [{ field: 'spareMags', db: 7, infobox: 8, raw: '8' }],
  'G-123 Thermite': [{ field: 'radius', db: [1.5, 2.5], infobox: 2, raw: '2 m' }],
  // Patch 1.007.200 raised spare magazines from 6 to 7; the datamine has it, the infobox not yet.
  'StA-52 Assault Rifle': [{ field: 'spareMags', db: 7, infobox: 6, raw: '6' }],
};

export function infoboxDisagreements(w, box, data) {
  const result = [];
  const compare = (field, db, infobox, raw) => {
    if (JSON.stringify(db) !== JSON.stringify(infobox)) result.push({ field, db, infobox, raw });
  };
  const members = [w, ...w.variants];
  const values = fields => [...new Set(members.flatMap(v => fields.map(f => v[f])).filter(v => v !== null))];
  const includes = (set, n) => set.some(v => Math.abs(v - n) < 0.00001);
  const checkSet = (field, set, n, raw) => { if (!includes(set, n)) result.push({ field, db: set, infobox: n, raw }); };
  const extras = infoboxExtras(box, w);
  for (const field of ['dot', 'heatCapacity', 'swingsPerMinute', 'rpmModes']) compare(field, w[field], extras[field], ({ dot: box.damage, heatCapacity: box.capacity, swingsPerMinute: box.fire_rate, rpmModes: box.fire_rate })[field] ?? '');
  for (const [field, key] of [['spareMags', 'spare_mags'], ['spareRounds', 'spare_rounds']]) {
    const text = clean(box[key]).replace(/\s+Clips$/i, '');
    const n = scalar(text);
    if (n !== null) compare(field, w[field], n, box[key]);
  }
  const rates = extras.rpmModes.length ? extras.rpmModes : extras.rpm !== null ? [extras.rpm] : [];
  if (rates.length && !rates.includes(w.rpm)) result.push({ field: 'rpm', db: w.rpm, infobox: rates.length === 1 ? rates[0] : rates, raw: box.fire_rate });
  if (w.roundType !== 'heat') {
    const capacities = [w.magazine, ...w.linkedAttacks.map(a => data.weapons[a.dataKey]?.cap)].filter(v => v != null);
    for (const part of (box.capacity ?? '').split(/<hr\s*\/?>|<br\s*\/?>/i)) {
      const m = clean(part).match(new RegExp(`^(${numeric})(?:\\s*\\((?:x(${numeric})|[^)]+)\\))?$`, 'i'));
      if (m) {
        const n = num(m[1]) * (m[2] ? num(m[2]) : 1);
        if (w.category === 'throwable') compare('throwableCapacity', w.throwableCapacity, n, box.capacity);
        else checkSet('magazine', capacities, n, box.capacity);
      }
    }
  }
  const damage = values(['direct', 'splash']);
  for (const v of members) {
    if (v.direct !== null && v.pellets !== null) damage.push(v.direct * v.pellets);
    if (v.delivery === 'beam' && v.direct !== null && w.beams !== null) damage.push(v.direct * w.beams);
    if (v.delivery === 'arc' && v.direct !== null && w.barrels !== null) damage.push(v.direct * w.barrels);
  }
  if (w.dot.perSecond !== null) damage.push(w.dot.perSecond);
  const entries = damageEntries(box.damage);
  const bare = scalar(box.damage);
  if (!entries.length && bare !== null) entries.push({ text: String(bare) });
  for (const entry of entries) {
    const m = entry.text.match(new RegExp(`^(${numeric})(?:\\s*[-–]\\s*(${numeric}))?(?:\\s|/|$)`));
    if (!m) continue;
    for (const value of [m[1], m[2]].filter(Boolean).map(num)) {
      if (value === 0 && !damage.length) continue; // Non-damaging utility items have no damage link.
      checkSet('damage', [...new Set(damage)], value, box.damage);
    }
  }
  const armor = values(['ap', 'splashAp']);
  for (const m of (box.penetration ?? '').matchAll(/\{\{\s*Armor\s*\|\s*(-?\d+)\s*(?:\|[^}]*)?\}\}/gi)) {
    if (Number(m[1]) === -1 && !armor.length) continue; // Wiki sentinel for non-damaging items.
    checkSet('penetration', armor, Number(m[1]), box.penetration);
  }
  const radius = clean(box.radius).match(new RegExp(`^(${numeric})\\s*m?$`, 'i'));
  if (radius) {
    const radii = values(['innerRadius', 'radius']);
    // Shield radius is not an explosion radius; compare its actual source field.
    if (!radii.length && data.weapons[w.dataKey]?.shieldradius != null) radii.push(data.weapons[w.dataKey].shieldradius);
    checkSet('radius', radii, num(radius[1]), box.radius);
  }
  return result;
}
