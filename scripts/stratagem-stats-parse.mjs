// Reads cooldown facts out of the wikitext saved by fetch-stratagem-stats.mjs.
// Shared by build-stratagem-stats.mjs and test-stratagem-stats.mjs.
export const field = (text, key) => {
  const match = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n|}]*)`).exec(text || '');
  return match ? match[1].trim() : '';
};
// "480s", "66.5", "Unlimited", "N/A", "Unknown" -> number, 'unlimited' or null.
export const value = text => {
  if (/^(unlimited|inf)$/i.test(text)) return 'unlimited';
  const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(text);
  return match ? Number(match[1]) : null;
};

const PERMITS = { supply: 'supply', offensive: 'offensive', offense: 'offensive', defensive: 'defensive' };
// Type (permit) the user set over the wiki's Supply: these are mission tools (user decision 2026-11-19).
export const PERMIT_OVERRIDES = { sos: 'mission', 'tactical-camera': 'mission' };
export function statsOf(entry) {
  if (!entry || entry.missing) return null;
  const table = entry.statsTable, box = entry.infobox;
  const cooldown = value(field(table, 'cooldown')) ?? value(field(box, 'base_cooldown'));
  return {
    type: field(box, 'stratagem_type') || null,
    // In-game permit (menu colour): the infobox permit_type; mission stratagems have none.
    permit: PERMITS[(field(box, 'permit_type') || '').toLowerCase()] ?? 'mission',
    cooldown: typeof cooldown === 'number' ? cooldown : null,
    callIn: value(field(table, 'call_time')),
    callInModules: value(field(table, 'call_time_upgraded')),
    uses: value(field(table, 'uses')),
    rearm: value(field(table, 'rearm_time')),
    revision: entry.revision,
  };
}

// --- Stagger and push force from the attack datamine ----------------------------------------
// Datamine entries whose name is not the wiki page title (upper case, with or without code).
const DATAMINE_KEYS = {
  'eagle-gas': ['stratagems', 'EAGLE GAS AIRSTRIKE'], 'guard-dog': ['weapons', 'AX/AR-23 GUARD DOG'], rover: ['weapons', 'AX/LAS-5 ROVER'],
  k9: ['weapons', 'AX/ARC-3 K-9'], 'hot-dog': ['weapons', 'AX/FLAM-75 HOT DOG'], 'dog-breath': ['weapons', 'AX/TX-13 DOG BREATH'],
};
const KIND = { projectile: 'direct', beam: 'beam', arc: 'arc', spray: 'spray', explosion: 'blast', damage: 'direct' };

// Finds the stratagem's attack entry: the weapons datamine (support weapons, Guard Dogs)
// or the stratagem datamine; null when neither has attack records for it.
/** Weapon handling (datamine `ergonomics`) of a stratagem whose datamine entry is a weapon; else null. */
export const ergonomicsOf = found => Number.isFinite(found?.entry?.ergonomics) ? found.entry.ergonomics : null;
/** Aim sway multiplier (datamine `sway`, 1 = standard) of the same weapon entry; else null. */
export const swayOf = found => Number.isFinite(found?.entry?.sway) ? found.entry.sway : null;

export function datamineEntry(id, title, strat, weapons) {
  const upper = title.toUpperCase(), bare = upper.replace(/^\S*\d\S*\s+/, '');
  const [table, key] = DATAMINE_KEYS[id] ?? [];
  if (table === 'weapons') return weapons.weapons[key] ? { entry: weapons.weapons[key], data: weapons } : null;
  if (weapons.weapons[upper]) return { entry: weapons.weapons[upper], data: weapons };
  for (const name of key ? [key] : [upper, bare]) {
    if (strat.stratagems[name]?.attacks?.length) return { entry: strat.stratagems[name], data: strat };
    if (strat.weapons[name]?.attacks?.length) return { entry: strat.weapons[name], data: strat };
  }
  return null;
}

// Groups of { weapon, parts: [{ kind, stun, push }] }: one group per first-level attack of each
// weapon (a shell and the explosion and fragments it causes), duplicates dropped.
export function forcesOf(found, strat, weapons) {
  if (!found) return [];
  const lookup = (type, name, data) => data[type]?.[name] ?? (data === strat ? weapons : strat)[type]?.[name] ?? null;
  const groups = [];
  const walk = (entry, data, weapon) => {
    const byName = new Map(entry.attacks.map(attack => [attack.name, attack]));
    const top = attack => { let at = attack; while (at.level > 1 && byName.has(at.parent)) at = byName.get(at.parent); return at.name; };
    const local = new Map();
    for (const attack of entry.attacks) {
      if (attack.type === 'weapons') {
        const sub = strat.weapons[attack.name] ?? weapons.weapons[attack.name];
        if (sub?.attacks?.length) walk(sub, strat.weapons[attack.name] ? strat : weapons, attack.name.replace(/^SWP_/, '').replace(`${entry.name} `, ''));
        continue;
      }
      if (!KIND[attack.type]) continue;
      const record = lookup(attack.type, attack.name, data);
      const damage = attack.type === 'damage' ? record : record && lookup('damage', record.damage_id, data);
      if (!damage || (damage.stun == null && damage.push == null && damage.demo == null)) continue;
      // "..._Overcharge_E" is the weapon blowing up when overcharged (Railgun, Epoch), not a shot.
      const kind = /Overcharge/i.test(attack.name) ? 'overcharge' : attack.type === 'projectile' && attack.level > 1 ? 'fragment' : KIND[attack.type];
      const group = local.get(top(attack)) ?? { weapon, parts: [] };
      local.set(top(attack), group);
      if (!group.parts.some(part => part.kind === kind && part.demo === damage.demo && part.stun === damage.stun && part.push === damage.push)) group.parts.push({ kind, demo: damage.demo ?? null, stun: damage.stun, push: damage.push });
    }
    for (const group of local.values()) if (!groups.some(other => JSON.stringify(other) === JSON.stringify(group))) groups.push(group);
  };
  walk(found.entry, found.data, null);
  return groups;
}
