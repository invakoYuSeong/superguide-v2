// Downloads the wiki mission pages named in db/source/structure_objectives.json and
// their difficulty rows from the wiki's Cargo tables (Missions = main objectives,
// Optional_Objectives = tactical objectives) into db/source/wiki_objectives.json.
// Usage: node scripts/fetch-objectives.mjs  ->  node scripts/build-game-names.mjs  ->  node scripts/build-structure-objectives.mjs
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const get = async params => {
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(params)}`);
  return res.json();
};

const map = JSON.parse(await readFile(new URL('../db/source/structure_objectives.json', import.meta.url), 'utf8')).structures;
const titles = [...new Set(Object.values(map).flat().map(entry => entry.page))].sort();
const out = { source: API, retrievedAt: new Date().toISOString().slice(0, 10), pages: {}, cargo: { main: {}, tactical: {} } };
const { query } = await get({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', formatversion: '2', titles: titles.join('|') });
for (const page of query.pages) {
  if (page.missing) throw new Error(`${page.title}: missing`);
  const revision = page.revisions[0];
  out.pages[page.title] = { revision: revision.revid, timestamp: revision.timestamp, text: revision.slots.main.content };
}
for (const [kind, table] of [['main', 'Missions'], ['tactical', 'Optional_Objectives']]) {
  await sleep(2000);
  const rows = (await get({ action: 'cargoquery', tables: table, fields: '_pageName,faction,min_difficulty,max_difficulty', limit: '500' })).cargoquery.map(row => row.title);
  for (const row of rows) if (titles.includes(row._pageName)) {
    const number = value => Number(value) || null;
    out.cargo[kind][row._pageName] = { faction: row.faction || null, min: number(row['min difficulty']), max: number(row['max difficulty']) };
  }
}
await writeFile(new URL('../db/source/wiki_objectives.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out.pages).length} pages, ${Object.keys(out.cargo.main).length} main + ${Object.keys(out.cargo.tactical).length} tactical rows`);
