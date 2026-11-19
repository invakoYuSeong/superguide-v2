// Downloads the cooldown facts of every stratagem from its wiki page (infobox
// `stratagem_type` / `base_cooldown` and the "Stratagem Stats Table"), plus the
// Ship Modules page whose upgrade rates dist/data/ship-modules.js follows,
// into db/source/wiki_stratagem_stats.json with each page's revision, and the
// stratagem datamine (stagger and push force per attack) into db/source/stratagems_data.json.
// Usage: node scripts/fetch-stratagem-stats.mjs  ->  node scripts/build-stratagem-stats.mjs
import { writeFile } from 'node:fs/promises';
import { stratagems } from '../dist/core/catalog.js';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const titleOf = item => decodeURIComponent(item.source.split('/wiki/')[1]).replaceAll('_', ' ');

async function pages(titles) {
  const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: titles.join('|') });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${titles[0]}`);
  const { query } = await res.json();
  const alias = new Map([...(query.normalized || []), ...(query.redirects || [])].map(entry => [entry.from, entry.to]));
  const resolve = title => { let t = title; for (let i = 0; i < 3 && alias.has(t); i++) t = alias.get(t); return t; };
  const byTitle = new Map(query.pages.map(page => [page.title, page]));
  return new Map(titles.map(title => [title, byTitle.get(resolve(title))]));
}

// Keep only the wikitext the build reads, so the snapshot stays small and reviewable.
const block = (text, start) => {
  const at = text.indexOf(start);
  if (at < 0) return '';
  let depth = 0;
  for (let i = at; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (!depth) return text.slice(at, i + 1); }
  }
  return text.slice(at);
};

const out = { source: API, retrievedAt: new Date().toISOString().slice(0, 10), stratagems: {}, shipModules: null };
const titles = [...new Set(stratagems.map(titleOf))];
const found = new Map();
for (let i = 0; i < titles.length; i += 40) {
  for (const [title, page] of await pages(titles.slice(i, i + 40))) found.set(title, page);
  await sleep(2000);
}
for (const item of stratagems) {
  const page = found.get(titleOf(item));
  if (!page || page.missing) { out.stratagems[item.id] = { title: titleOf(item), missing: true }; continue; }
  const revision = page.revisions[0];
  const text = revision.slots.main.content;
  out.stratagems[item.id] = {
    title: page.title, revision: revision.revid, timestamp: revision.timestamp,
    infobox: block(text, '{{Infobox'), statsTable: block(text, '{{Stratagem Stats Table'),
  };
}
const ship = (await pages(['Ship Modules'])).get('Ship Modules');
const shipText = ship.revisions[0].slots.main.content;
out.shipModules = {
  title: ship.title, revision: ship.revisions[0].revid, timestamp: ship.revisions[0].timestamp,
  text: shipText.slice(shipText.indexOf('==Module Upgrades=='), shipText.indexOf('== Notes ==')),
};
await writeFile(new URL('../db/source/wiki_stratagem_stats.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
// Support weapons take their attack records from db/source/weapons_data.json (fetch-weapons-source.mjs).
await sleep(2000);
const datamineTitle = 'Module:Decodedata-Attacks/stratagems_data.json';
const datamine = (await pages([datamineTitle])).get(datamineTitle);
await writeFile(new URL('../db/source/stratagems_data.json', import.meta.url), JSON.stringify({
  source: `https://helldivers.wiki.gg/wiki/${datamineTitle.replaceAll(' ', '_')}`, revision: datamine.revisions[0].revid,
  revisionTimestamp: datamine.revisions[0].timestamp, retrievedAt: out.retrievedAt, data: JSON.parse(datamine.revisions[0].slots.main.content),
}, null, 1) + '\n');
console.log(`${Object.keys(out.stratagems).length} stratagems, Ship Modules revision ${out.shipModules.revision}`);
