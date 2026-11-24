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
// Unlock on the ship (Patriotic Administration Center): the infobox unlock_level and a Requisition
// unlock_cost ("Free" = given at the start). Warbond stratagems cost medals and get their warbond chip
// instead, and mission stratagems have neither, so both stay null.
export function unlockOf(box) {
  const level = /\|\s*unlock_level\s*=\s*(\d+)\s*(?:\n|\|)/.exec(box || '')?.[1];
  const cost = /\|\s*unlock_cost\s*=\s*(?:\{\{Currency\|Requisition(?: Slips)?\|([\d,]+)\}\}|(Free))/.exec(box || '');
  if (!level || !cost) return null;
  return { level: Number(level), requisition: cost[2] ? 0 : Number(cost[1].replace(/,/g, '')) };
}
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
    // Wiki infobox trait "One Handed" (only kept when set, like the weapons' one-handed badge).
    ...(unlockOf(box) && { unlock: unlockOf(box) }),
    ...(/\bone handed\b/i.test(/\|\s*traits\s*=([^\n]*)/.exec(box || '')?.[1] ?? '') && { oneHanded: true }),
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
// Times the wiki's datamine table shows for a stratagem (Template:Attack_Data_Stratagem): Lifetime of a
// sentry or tower, Duration of a strike, recharge of a pack. Found by name, attacks or not; null when absent.
export function timesOf(id, title, strat) {
  const upper = title.toUpperCase(), bare = upper.replace(/^\S*\d\S*\s+/, '');
  const [table, key] = DATAMINE_KEYS[id] ?? [];
  const entry = [table !== 'weapons' && key, upper, bare].filter(Boolean).map(name => strat.stratagems[name]).find(Boolean);
  if (!entry) return null;
  const times = { lifetime: entry.lifetime, duration: entry.duration, recharge: entry.recharge_time };
  const kept = Object.fromEntries(Object.entries(times).filter(([, value]) => Number.isFinite(value)));
  return Object.keys(kept).length ? kept : null;
}
// Main Health and Main Armor the wiki's datamine table shows: of a sentry or emplacement (its stratagem entry),
// or of a backpack drone (its weapon entry, with the drone gun's magazine and Max Rounds; a heat-based
// drone such as the Rover has no magazine). Mines are left out: their entry's health is not clearly the mine's.
export function bodyOf(id, title, type, strat, weapons) {
  const upper = title.toUpperCase(), bare = upper.replace(/^\S*\d\S*\s+/, '');
  const [table, key] = DATAMINE_KEYS[id] ?? [];
  const drone = [key, upper].filter(Boolean).map(name => weapons.weapons[name]).find(entry => entry?.drone);
  if (drone) {
    const gun = (drone.attacks ?? []).filter(attack => attack.type === 'weapons').map(attack => weapons.weapons[attack.name]).find(Boolean);
    const ammo = gun && !gun.heatdata && Number.isFinite(gun.cap) && Number.isFinite(drone.max);
    return { drone: true, health: drone.health, armor: drone.armor, ...(ammo && { magazine: gun.cap, mags: drone.max }) };
  }
  if (!['Sentry', 'Emplacement'].includes(type) || /mine/i.test(id)) return null;
  const entry = [table !== 'weapons' && key, upper, bare].filter(Boolean).map(name => strat.stratagems[name]).find(Boolean);
  return Number.isFinite(entry?.health) ? { health: entry.health, armor: entry.armor } : null;
}
// Gun of a sentry: fire rate and ammo from the wiki Stratagem Stats Table (sentry_rpm, sentry_ammo and the
// ship-module values sentry_ammo_upgraded and sentry_health_upgraded; '~32' is kept as approximate, '40*'
// keeps its number) and from the attack datamine weapon entry (rpm and cap, the rounds fired before it
// reloads). Null for anything but a sentry or when neither has a gun value.
export function sentryOf(id, title, type, table, strat) {
  if (type !== 'Sentry') return null;
  const upper = title.toUpperCase(), bare = upper.replace(/^\S*\d\S*\s+/, '');
  const gun = [upper, bare].map(name => strat.weapons[name]).find(Boolean);
  const wiki = key => { const m = /^(~)?\s*(\d+(?:\.\d+)?)\*?$/.exec(field(table, key)); return m ? { value: Number(m[2]), approx: Boolean(m[1]) } : null; };
  const rpm = wiki('sentry_rpm'), ammo = wiki('sentry_ammo');
  const out = {
    ...(rpm && { rpm: rpm.value, ...(rpm.approx && { rpmApprox: true }) }),
    ...(Number.isFinite(gun?.rpm) && { rpmData: gun.rpm }),
    ...(ammo && { ammo: ammo.value }),
    ...(wiki('sentry_ammo_upgraded') && { ammoModules: wiki('sentry_ammo_upgraded').value }),
    ...(Number.isFinite(gun?.cap) && !gun.heatdata && { magazine: gun.cap }),
    ...(wiki('sentry_health_upgraded') && { healthModules: wiki('sentry_health_upgraded').value }),
  };
  return Object.keys(out).length ? out : null;
}
/** Aim sway multiplier (datamine `sway`, 1 = standard) of the same weapon entry; else null. */
// Support weapon reload from the wiki infobox: reload_time '5.0s<br>4.55s (Upgraded)<br>3s (Assisted)' (base, with the
// Payroll Management System ship module, by a teammate from the backpack) and tac_reload_time (with rounds left);
// stationary = the Stationary Reload trait (the Helldiver cannot move while reloading). Null without any of them.
const reloadParts = text => {
  const out = {};
  for (const token of String(text ?? '').split(/<br\s*\/?>|\{\{\*\}\}/)) {
    const m = /(\d+(?:\.\d+)?)\s*s?\s*(?:\(([^)]+)\))?/.exec(token.trim());
    if (!m) continue;
    const key = m[2] ? m[2].trim().toLowerCase() : 'plain';
    if (!(key in out)) out[key] = Number(m[1]);
  }
  // '1.2s {{*}} 1.35s (Base)' (Railgun): the labelled base wins over an unlabelled number.
  return { base: out.base ?? out.plain ?? null, upgraded: out.upgraded ?? null, assisted: out.assisted ?? null };
};
export function reloadOf(entry) {
  const box = entry?.infobox ?? '';
  if (!/Infobox Support Weapon/.test(box)) return null;
  const line = key => new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n]*)`).exec(box)?.[1] ?? '';
  // Clip-fed weapons (Autocannon) give the full reload and each clip instead: rounds_reload_full_time / _first / _rest.
  const full = reloadParts(line('reload_time') || line('rounds_reload_full_time')), tac = reloadParts(line('tac_reload_time'));
  const first = reloadParts(line('rounds_reload_first')), rest = reloadParts(line('rounds_reload_rest'));
  const stationary = /Stationary Reload/i.test(line('traits'));
  // *Upgraded: the wiki's value with the ship module (shown while ship modules are on, user request 2026-11-24).
  const pair = (key, parts) => ({ ...(parts.base != null && { [key]: parts.base }), ...(parts.upgraded != null && { [`${key}Upgraded`]: parts.upgraded }) });
  const out = { ...pair('time', full), ...pair('tactical', tac), ...(full.assisted != null && { assisted: full.assisted }), ...pair('clipFirst', first), ...pair('clipRest', rest), ...(stationary && { stationary }) };
  return Object.keys(out).length ? out : null;
}
export const swayOf = found => Number.isFinite(found?.entry?.sway) ? found.entry.sway : null;
// Continuous-fire heat of a beam weapon (datamine heatdata, the table the wiki shows as Heat Data): it overheats
// once heat_per_second takes it to overheat_temp, as the wiki infobox capacity of the Laser Cannon (100 / 8 = 12.5 s)
// and the Scythe (8 s) show; heatsinks = spare heat sinks of a support weapon. Sentries keep their gun under weapons
// by their bare name (LASER SENTRY).
export function heatOf(found, title, strat) {
  const bare = title.toUpperCase().replace(/^\S*\d\S*\s+/, '');
  const heat = found?.entry?.heatdata ?? strat.weapons?.[bare]?.heatdata;
  if (!(heat?.overheat_temp > 0 && heat.heat_per_second > 0)) return null;
  const heatsinks = Number.isFinite(found?.entry?.mags) && found.entry.roundtype === 'heat' ? found.entry.mags : null;
  return { overheatTemp: heat.overheat_temp, perSecond: heat.heat_per_second, seconds: Math.round(heat.overheat_temp / heat.heat_per_second * 100) / 100, ...(heatsinks != null && { heatsinks }) };
}

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
      // "..._Overcharge_E" is the weapon blowing up when overcharged (Railgun, Epoch), not a shot;
      // "..._BACKBLAST_E" is the blast out of the back of a launcher when it fires (Recoilless, EATs, Commando...).
      const kind = /Overcharge/i.test(attack.name) ? 'overcharge' : /BACKBLAST/i.test(attack.name) ? 'backblast' : attack.type === 'projectile' && attack.level > 1 ? 'fragment' : KIND[attack.type];
      // attack: the top-level record the group belongs to (e.g. SEAF Artillery shell S_P8), so a mode can pick its own.
      const group = local.get(top(attack)) ?? { weapon, attack: top(attack), parts: [] };
      local.set(top(attack), group);
      if (!group.parts.some(part => part.kind === kind && part.demo === damage.demo && part.stun === damage.stun && part.push === damage.push)) group.parts.push({ kind, demo: damage.demo ?? null, stun: damage.stun, push: damage.push });
    }
    for (const group of local.values()) if (!groups.some(other => JSON.stringify(other) === JSON.stringify(group))) groups.push(group);
  };
  walk(found.entry, found.data, null);
  return groups;
}

// A vehicle's death explosion (db/source/vehicle_explosions.json) as its own 'wreck' force group with the
// blast damage and radii, or nothing for a vehicle without one.
export const wreckForces = (id, wrecks) => wrecks[id] ? [{ weapon: null, parts: [{ kind: 'wreck', demo: wrecks[id].damage.demo, stun: wrecks[id].damage.stun, push: wrecks[id].damage.push,
  damage: wrecks[id].damage.dmg, ap: wrecks[id].damage.ap1, inner: wrecks[id].explosion.r1, outer: wrecks[id].explosion.r2, shockwave: wrecks[id].explosion.r3 }] }] : [];
