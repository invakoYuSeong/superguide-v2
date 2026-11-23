// Downloads what the planet tab is checked against: the wiki Effects, Status Effects
// and Module:Environmental Conditions pages, every biome page listed on the Biomes
// page, and the original SVG icon of each environmental condition (into
// dist/assets/conditions/). Output: db/source/wiki_planets.json.
// Usage: node scripts/fetch-planet-pages.mjs  ->  node scripts/build-game-names.mjs  ->  node scripts/build-planets.mjs
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSvg } from './svg-safety.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const get = async params => {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(params)}`);
  return res.json();
};
const pages = async titles => {
  const { query } = await get({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', redirects: '1', titles: titles.join('|') });
  return Object.fromEntries(query.pages.map(page => {
    if (page.missing) throw new Error(`${page.title}: missing`);
    const revision = page.revisions[0];
    return [page.title, { revision: revision.revid, timestamp: revision.timestamp, text: revision.slots.main.content }];
  }));
};
const field = (text, key) => new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n|]*)`).exec(text)?.[1].trim() ?? '';
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const main = await pages(['Effects', 'Status Effects', 'Module:Environmental Conditions', 'Biomes', 'Exostorm', 'Heavy SEAF Presence', 'Democracy Space Station', 'Template:DSS Action']);
const out = {
  source: API, retrievedAt: new Date().toISOString().slice(0, 10),
  effects: main.Effects, statusEffects: main['Status Effects'], environmentModule: main['Module:Environmental Conditions'],
  // Planet effects outside the Environmental Conditions list (exostorm classes, Heavy SEAF Presence, the
  // Democracy Space Station with the template that holds its Tactical Action costs and timers).
  specialPages: {
    Exostorm: main.Exostorm, 'Heavy SEAF Presence': main['Heavy SEAF Presence'],
    'Democracy Space Station': { ...main['Democracy Space Station'], templates: { 'Template:DSS Action': main['Template:DSS Action'] } },
  },
  biomesRevision: main.Biomes.revision, biomes: {}, icons: {},
};
// Environmental hazards (Category:Environmental Hazards without its two overview pages), 2026-11-20.
const HAZARD_PAGES = ['Automaton Mine', 'Barbed Wire', 'Bug Mine', 'Cars', 'Exploding Barrels', 'Ice Plant', 'Lava', 'Lava Geyser', 'Lava Pits', 'Moor Mushroom', 'Shrub', 'Spike Plant', 'Volcano Plant'];
await sleep(2000);
out.hazardPages = await pages(HAZARD_PAGES);
// Each environmental condition's own page (its Details numbers), 2026-11-23.
const CONDITION_PAGES = ['Acid Storms', 'Blizzards', 'Extreme Cold', 'Fire Tornados', 'Intense Heat', 'Ion Storms', 'Meteor Storms', 'Rainstorms', 'Sandstorms', 'Thick Fog', 'Tremors', 'Volcanic Activity'];
await sleep(2000);
out.conditionPages = await pages(CONDITION_PAGES);
// Operation modifier pages whose Details the planet tab summarizes, 2026-11-23.
await sleep(2000);
out.modifierPages = await pages(['Orbital Fluctuations', 'Poor Intel']);
// The datamine records the Meteor Storms and Volcanic Activity pages show in their Attack Data boxes.
await sleep(2000);
const ENEMY_DATA = 'Module:Decodedata-Attacks/enemydata.json';
const enemyData = (await pages([ENEMY_DATA]))[ENEMY_DATA];
const attacks = JSON.parse(enemyData.text);
const attackOf = (projectile, explosion) => {
  const record = { explosion: attacks.explosion[explosion] };
  record.explosionDamage = attacks.damage[record.explosion.damageid];
  if (projectile) Object.assign(record, { projectile: attacks.projectile[projectile], damage: attacks.damage[attacks.projectile[projectile].damageid] });
  if (Object.values(record).some(value => !value)) throw new Error(`${ENEMY_DATA}: ${projectile ?? explosion} record missing`);
  return record;
};
out.conditionAttacks = {
  source: ENEMY_DATA, revision: enemyData.revision, timestamp: enemyData.timestamp,
  records: { 'Meteor Storms': attackOf('World_Meteor', 'World_Meteor'), 'Volcanic Activity': attackOf('World_VolcanoStrike', 'World_VolcanoStrike') },
};
// Biome pages named in the Biomes page's {{BiomeBox|...}} lists (the city megastructures are regions, not biomes).
const titles = [...main.Biomes.text.matchAll(/\{\{BiomeBox\|([^}]+)\}\}/g)].flatMap(match => match[1].split('|').map(title => title.trim()))
  .filter(title => !['Metropolis', 'Automaton Megafactory', 'Colonies'].includes(title));
await sleep(2000);
for (const [title, page] of Object.entries(await pages(titles))) {
  const description = field(page.text, 'description').replace(/<!--.*$/, '').trim();
  out.biomes[title] = {
    revision: page.revision, internal: field(page.text, 'internal_name') || null, archetype: field(page.text, 'archetype') || null,
    landscape: field(page.text, 'landscape') || null,
    description: /^No description/i.test(description) ? null : description,
    conditions: [...page.text.matchAll(/\{\{Environmental Conditions\|([^}]*)\}\}/g)].flatMap(match => match[1].split('|').map(name => name.trim())).filter(Boolean),
  };
}
// Condition icons from the module's `file = "... Icon.svg"` lines.
await mkdir(new URL('../dist/assets/conditions/', import.meta.url), { recursive: true });
for (const [, key, file] of out.environmentModule.text.matchAll(/\["([a-z ]+)"\]\s*=\s*\{\s*file\s*=\s*"([^"]+\.svg)"/g)) {
  await sleep(1500);
  const info = (await get({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: `File:${file}` })).query.pages[0].imageinfo[0];
  const res = await fetch(info.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${info.url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  validateSvg(bytes, { name: file });
  const name = `${slug(key)}.svg`;
  await writeFile(new URL(`../dist/assets/conditions/${name}`, import.meta.url), bytes);
  out.icons[slug(key)] = { file: name, title: file, source: `https://helldivers.wiki.gg/wiki/File:${file.replaceAll(' ', '_')}`, sha256: createHash('sha256').update(bytes).digest('hex') };
}
// Icons of effects outside the module (stored like the condition icons): saved file name -> wiki file
// and the effect ids that show it (user choices 2026-11-19).
const EXTRA_ICONS = {
  'heavy-seaf-presence': { file: 'Heavy SEAF Presence Icon.svg', ids: ['heavy-seaf-presence'] },
  exostorm: { file: 'Destroy Exospire Mission Icon.svg', ids: ['exostorm-1', 'exostorm-2', 'exostorm-3'] },
  // The DSS Action template's icons (2026-11-20).
  dss: { file: 'DSS Icon.svg', ids: ['dss', 'dss-operational-support', 'dss-exosuit-reserves'] },
  'dss-eagle-storm': { file: 'DSS Eagle Icon.svg', ids: ['dss-eagle-storm'] },
  'dss-orbital-blockade': { file: 'DSS Orbital Blockade Icon.svg', ids: ['dss-orbital-blockade'] },
  'dss-heavy-ordnance': { file: 'DSS Heavy Ordnance Distribution Icon.svg', ids: ['dss-heavy-ordnance'] },
};
for (const [name, { file, ids }] of Object.entries(EXTRA_ICONS)) {
  await sleep(1500);
  const info = (await get({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: `File:${file}` })).query.pages[0].imageinfo[0];
  const res = await fetch(info.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${info.url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  validateSvg(bytes, { name: file });
  await writeFile(new URL(`../dist/assets/conditions/${name}.svg`, import.meta.url), bytes);
  const record = { file: `${name}.svg`, title: file, source: `https://helldivers.wiki.gg/wiki/File:${file.replaceAll(' ', '_')}`, sha256: createHash('sha256').update(bytes).digest('hex') };
  for (const id of ids) out.icons[id] = record;
}
// Planets that have a wiki page (the biome tab links their names; many game planets have none).
out.planetPages = (await get({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Planets', cmnamespace: '0', cmlimit: '500' })).query.categorymembers.map(page => page.title).sort();
await writeFile(new URL('../db/source/wiki_planets.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out.biomes).length} biomes, ${Object.keys(out.icons).length} condition icons`);
