// Offline build of the warbond guide data from local snapshots only (no network, no clock).
//   db/source/wiki_warbonds.json        ← scripts/fetch-warbonds.mjs (Helldivers Wiki wikitext)
//   db/source/warbond_korean_names.json ← Korean warbond names (in-game text), name only
// Writes dist/data/warbonds.js and the small item → warbond index dist/data/warbond-sources.js.
// Usage: node scripts/build-warbonds.mjs [--stdout]
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWarbondPage, normalizeName, layoutProblems, BOARD, UNCONFIRMED } from './warbond-parse.mjs';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { stratagems } from '../dist/core/catalog.js';

const root = new URL('../', import.meta.url);
export const TIERS = ['standard', 'premium', 'legendary'];

// Wiki "Type" column → item kind. Weapons and stratagems are then linked to the site's own entries.
const KIND_BY_TYPE = {
  Currency: 'super-credits', Helmet: 'helmet', 'Light Armor': 'armor', 'Medium Armor': 'armor', 'Heavy Armor': 'armor',
  Cape: 'cape', 'Player Card': 'player-card', Pattern: 'pattern', Emote: 'emote', 'Victory Pose': 'victory-pose', Title: 'title', Booster: 'booster',
};
// Old wiki names still used on warbond pages → the current name of the same item on the site.
// LAS-16 Trident: the LAS-13 Trident page (db/source/wiki_pages.json, revision 140438) lists its
// source as Siege Breakers page 1 for 35 medals (the same slot and cost) and its change history
// for 1.006.003 says 'Changed name from "LAS-16 Trident" to correct confusion with LAS-16 Sickle'.
export const RENAMED = { 'LAS-16 Trident': 'LAS-13 Trident' };
const STRATAGEM_TYPES =new Set(['Stratagem', 'Stratagems', 'Support Weapon', 'Backpack', 'Backpack Weapon', 'Sentry', 'Mortar', 'Emplacement', 'Vehicle']);

/** 'Cutting Edge Premium Warbond' → 'Cutting Edge' (the key used by the Korean name list). */
export const baseTitle = title => title.replace(/\s+(?:(?:Premium|Legendary)\s+)?Warbond$/, '');
export const warbondId = title => baseTitle(title).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The warbond shown in the "latest release" banner: the newest ISO release date.
 * Tie-break (same date): the English title in plain code-unit order (A before B),
 * so the pick never depends on snapshot key order or locale. Undated warbonds are never picked.
 */
export function pickLatest(list) {
  const dated = list.filter(item => /^\d{4}-\d\d-\d\d$/.test(item.date || ''));
  dated.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.en < b.en ? -1 : a.en > b.en ? 1 : 0));
  return dated[0]?.id ?? null;
}

export function buildWarbonds(snapshot, koreanNames, { weapons = personalWeapons, strats = stratagems } = {}) {
  const weaponByName = new Map(weapons.map(item => [normalizeName(item.en), item]));
  const stratByName = new Map(strats.map(item => [normalizeName(item.en), item]));
  // Fallback: the name without its designation code and quoted nickname
  // ('Flame Sentry' = 'A/FLAM-40 Flame Sentry'), only when that name is unique on the site.
  const bare = text => normalizeName(String(text ?? '').replace(/["“”][^"“”]*["“”]/g, ' ').replace(/^\S*\d\S*\s+/, ''));
  const byBare = new Map();
  for (const [view, item] of [...weapons.map(item => ['gear', item]), ...strats.map(item => ['arsenal', item])]) {
    const key = bare(item.en);
    byBare.set(key, byBare.has(key) ? null : { view, item });
  }
  const usedKorean = new Set();
  const unmatched = [];
  const fuzzy = [];
  const discrepancies = [];
  const layouts = []; // pages whose tiles do not fill the board
  const out = [];
  for (const [title, page] of Object.entries(snapshot.pages)) {
    const parsed = parseWarbondPage(page.wikitext, title);
    const key = baseTitle(title);
    const name = koreanNames[key];
    if (typeof name !== 'string' || !name.trim()) throw new Error(`No Korean name for warbond "${key}" (db/source/warbond_korean_names.json)`);
    usedKorean.add(key);
    if (!parsed.tier) throw new Error(`${title}: tier unknown`);
    const id = warbondId(title);
    for (const { reason, ...record } of parsed.discrepancies) discrepancies.push({ warbondId: id, ...record });
    const counts = { weapons: 0, stratagems: 0 };
    const pages = parsed.pages.map(p => {
      const items = p.items.map(item => {
        const keys = [item.link, item.name].filter(Boolean).flatMap(name => [name, RENAMED[name]]).filter(Boolean).map(normalizeName);
        const find = map => keys.map(k => map.get(k)).find(Boolean);
        let kind = KIND_BY_TYPE[item.type] || null, ref = null;
        if (!kind) {
          let weapon = find(weaponByName), strat = find(stratByName);
          const loose = weapon || strat ? null : [item.name, item.link].map(name => byBare.get(bare(name))).find(Boolean);
          if (loose) {
            if (loose.view === 'gear') weapon = loose.item; else strat = loose.item;
            fuzzy.push({ warbondId: id, page: p.number, name: item.name, type: item.type, matched: loose.item.en, id: loose.item.id });
          }
          if (weapon) { kind = weapon.category; ref = { view: 'gear', id: weapon.id }; counts.weapons++; }
          else if (strat) { kind = 'stratagem'; ref = { view: 'arsenal', id: strat.id }; counts.stratagems++; }
          else {
            kind = STRATAGEM_TYPES.has(item.type) ? 'stratagem' : item.type ? 'weapon' : 'other';
            unmatched.push({ warbondId: id, page: p.number, name: item.name, type: item.type });
          }
        }
        const confirmed = item.costStatus === 'confirmed';
        return {
          name: item.name, type: item.type, kind,
          // Tile on the 5×3 page board (Acquisitions Page template) and the wiki image file shown in it.
          col: item.col, row: item.row, colspan: item.colspan, rowspan: item.rowspan, image: item.image,
          ...(item.type && /Armor$/.test(item.type) ? { weight: item.type.split(' ')[0].toLowerCase() } : {}),
          cost: item.cost, costStatus: item.costStatus,
          ...(confirmed ? {} : { templateCost: item.templateCost, tableCost: item.tableCost }),
          ...(item.pageStatus ? { pageStatus: item.pageStatus, tablePage: item.tablePage } : {}),
          ...(item.nameStatus ? { nameStatus: item.nameStatus, tableName: item.tableName } : {}),
          ...(item.superCredits ? { superCredits: item.superCredits } : {}),
          ...(ref ? { ref } : {}),
          ...(item.link && item.link !== item.name ? { link: item.link } : {}), // wiki page title when it differs from the name
        };
      });
      const sure = items.every(item => item.costStatus === 'confirmed');
      // A page whose tiles do not fill the 5×3 board exactly is still listed, but the view
      // places its tiles one cell each instead of trusting the positions.
      const problems = layoutProblems(items);
      if (problems.length) layouts.push({ warbondId: id, page: p.number, problems });
      return {
        number: p.number, unlock: p.unlock, unlockStatus: p.unlockStatus, unlockSource: p.unlockSource,
        cost: sure ? items.reduce((sum, item) => sum + item.cost, 0) : null, costStatus: sure ? 'confirmed' : UNCONFIRMED,
        layoutStatus: problems.length ? UNCONFIRMED : 'confirmed',
        items,
      };
    });
    out.push({
      id, name, en: parsed.name, tier: parsed.tier, date: parsed.date,
      price: parsed.price, creditClaim: parsed.creditClaim, creditClaimStatus: parsed.creditClaimStatus,
      allPages: parsed.allPages, allPagesStatus: parsed.allPagesStatus,
      totalCost: parsed.totalCost, totalStatus: parsed.totalStatus,
      itemCount: pages.reduce((sum, p) => sum + p.items.length, 0), counts,
      cover: parsed.image,
      source: page.source, revision: page.revision, revisionTimestamp: page.revisionTimestamp,
      pages,
    });
  }
  const extra = Object.keys(koreanNames).filter(key => !usedKorean.has(key));
  if (extra.length) throw new Error(`Korean names without a warbond page: ${extra.join(', ')}`);
  const ids = new Set();
  for (const warbond of out) { if (ids.has(warbond.id)) throw new Error(`Duplicate warbond id ${warbond.id}`); ids.add(warbond.id); }
  // Tier order, then newest first (ties by English title) — independent of snapshot key order.
  out.sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || (b.date || '').localeCompare(a.date || '') || a.en.localeCompare(b.en));
  discrepancies.sort((a, b) => out.findIndex(w => w.id === a.warbondId) - out.findIndex(w => w.id === b.warbondId) || (a.page ?? 0) - (b.page ?? 0));
  unmatched.sort((a, b) => a.warbondId.localeCompare(b.warbondId) || a.page - b.page || a.name.localeCompare(b.name));
  const links = {
    weapons: out.reduce((sum, w) => sum + w.counts.weapons, 0),
    stratagems: out.reduce((sum, w) => sum + w.counts.stratagems, 0),
    unmatched,
    matchedWithoutCode: fuzzy.sort((a, b) => a.warbondId.localeCompare(b.warbondId) || a.page - b.page || a.name.localeCompare(b.name)),
  };
  return { warbonds: out, discrepancies, links, layouts, latestId: pickLatest(out) };
}

// JSON with one line per leaf record (an object/array holding no list of records).
function format(value, indent = '') {
  const records = v => Array.isArray(v) && v.some(x => x && typeof x === 'object');
  const inner = indent + '  ';
  if (Array.isArray(value) && records(value)) return `[\n${value.map(x => inner + format(x, inner)).join(',\n')}\n${indent}]`;
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).some(records)) {
    return `{\n${Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

export async function generate() {
  const snapshot = JSON.parse(await readFile(new URL('db/source/wiki_warbonds.json', root), 'utf8'));
  const koreanNames = JSON.parse(await readFile(new URL('db/source/warbond_korean_names.json', root), 'utf8'));
  const { warbonds, discrepancies, links, layouts, latestId } = buildWarbonds(snapshot, koreanNames);
  const exports = {
    warbondsCheckedAt: snapshot.retrievedAt,
    warbondsSource: {
      source: snapshot.source, site: 'https://helldivers.wiki.gg/', license: 'CC BY-NC-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', file: 'db/source/wiki_warbonds.json',
      koreanNamesFile: 'db/source/warbond_korean_names.json',
    },
    warbondBoard: BOARD, // page board size in tiles (columns × rows)
    warbondTiers: [{ id: 'standard', name: '기본' }, { id: 'premium', name: '프리미엄' }, { id: 'legendary', name: '전설' }],
    warbonds,
    warbondDiscrepancies: discrepancies,
    warbondLinks: links,
    latestWarbondId: latestId, // newest release date; ties by English title (pickLatest)
  };
  const text = '// Generated by scripts/build-warbonds.mjs from local db/source/wiki_warbonds.json and db/source/warbond_korean_names.json. Do not edit by hand.\n'
    + Object.entries(exports).map(([name, value]) => `export const ${name} = ${format(value)};\n`).join('\n');
  // Which warbond page each linked weapon or stratagem comes from, so detail pages can name it
  // without loading the whole board data.
  const sources = {};
  for (const bond of warbonds) for (const page of bond.pages) for (const item of page.items) {
    if (!item.ref) continue;
    const key = `${item.ref.view}/${item.ref.id}`;
    if (sources[key]) throw new Error(`${key} is in two warbonds: ${sources[key].id} and ${bond.id}`);
    sources[key] = { id: bond.id, name: bond.name, en: bond.en, tier: bond.tier, price: bond.price, page: page.number };
  }
  const sourcesText = '// Generated by scripts/build-warbonds.mjs from the same sources as warbonds.js. Do not edit by hand.\n'
    + `export const warbondSources = ${format(sources)};\n`;
  return { text, sourcesText, warbonds, discrepancies, links, layouts, latestId };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { text, sourcesText, warbonds, discrepancies, links, layouts, latestId } = await generate();
  if (process.argv.includes('--stdout')) process.stdout.write(text);
  else {
    await writeFile(new URL('dist/data/warbonds.js', root), text, 'utf8');
    await writeFile(new URL('dist/data/warbond-sources.js', root), sourcesText, 'utf8');
    console.log(`Generated dist/data/warbonds.js: ${warbonds.length} warbonds, ${warbonds.reduce((n, w) => n + w.itemCount, 0)} items, ${discrepancies.length} discrepancies.`);
    console.log(`Links: ${links.weapons} weapons, ${links.stratagems} stratagems; unmatched ${links.unmatched.length}: ${links.unmatched.map(u => `${u.name} (${u.type})`).join(', ') || 'none'}`);
    console.log(`Page boards: ${warbonds.reduce((n, w) => n + w.pages.length, 0)} pages; layouts that do not fill the board: ${layouts.map(l => `${l.warbondId} p${l.page} (${l.problems.join('; ')})`).join(', ') || 'none'}`);
    console.log(`Latest warbond (banner): ${latestId}`);
    console.log(`Matched by name without code: ${links.matchedWithoutCode.map(u => `${u.name} → ${u.matched}`).join(', ') || 'none'}`);
  }
}
