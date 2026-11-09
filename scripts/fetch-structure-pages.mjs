// Downloads the wiki pages behind the demolition structures that are not
// covered by the Demolition summary table alone (thresholds, health, tactics),
// into db/source/wiki_structures.json with each page's revision.
// scripts/test-structures.mjs checks dist/data/demolition-data.js against it.
// Usage: node scripts/fetch-structure-pages.mjs
import { writeFile } from 'node:fs/promises';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const TITLES = [
  'Stalker Lair', 'Cleanse Infested District', 'Destroy Spore Lung',
  'Enemy Bio-Processors', 'Automaton Megafactory', 'Erase Terrorist Memorials', 'Anti-Air Emplacement',
  'Mortar Emplacement', 'Bunker Turret', 'Destroy Transmission Network', 'Sabotage Air Base', 'Halt Cyborg Production',
  'Gazer', 'Gazer Spire', 'Warp Gateway',
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const out = { source: API, retrievedAt: new Date().toISOString().slice(0, 10), pages: {} };
for (const title of TITLES) {
  const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: title });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${title}`);
  const page = (await res.json()).query.pages[0];
  if (page.missing) throw new Error(`${title}: missing`);
  const revision = page.revisions[0];
  out.pages[title] = { title: page.title, revision: revision.revid, timestamp: revision.timestamp, text: revision.slots.main.content };
  console.log(title, revision.revid);
  await sleep(1500);
}
await writeFile(new URL('../db/source/wiki_structures.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
