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

const main = await pages(['Effects', 'Status Effects', 'Module:Environmental Conditions', 'Biomes', 'Exostorm', 'Heavy SEAF Presence']);
const out = {
  source: API, retrievedAt: new Date().toISOString().slice(0, 10),
  effects: main.Effects, statusEffects: main['Status Effects'], environmentModule: main['Module:Environmental Conditions'],
  // Planet effects outside the Environmental Conditions list (exostorm classes, Heavy SEAF Presence).
  specialPages: { Exostorm: main.Exostorm, 'Heavy SEAF Presence': main['Heavy SEAF Presence'] },
  biomesRevision: main.Biomes.revision, biomes: {}, icons: {},
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
// Icons of effects outside the module, by their wiki file (stored like the condition icons).
const EXTRA_ICONS = { 'heavy-seaf-presence': 'Heavy SEAF Presence Icon.svg' };
for (const [key, file] of Object.entries(EXTRA_ICONS)) {
  await sleep(1500);
  const info = (await get({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: `File:${file}` })).query.pages[0].imageinfo[0];
  const res = await fetch(info.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${info.url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  validateSvg(bytes, { name: file });
  await writeFile(new URL(`../dist/assets/conditions/${key}.svg`, import.meta.url), bytes);
  out.icons[key] = { file: `${key}.svg`, title: file, source: `https://helldivers.wiki.gg/wiki/File:${file.replaceAll(' ', '_')}`, sha256: createHash('sha256').update(bytes).digest('hex') };
}
// Planets that have a wiki page (the biome tab links their names; many game planets have none).
out.planetPages = (await get({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Planets', cmnamespace: '0', cmlimit: '500' })).query.categorymembers.map(page => page.title).sort();
await writeFile(new URL('../db/source/wiki_planets.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out.biomes).length} biomes, ${Object.keys(out.icons).length} condition icons`);
