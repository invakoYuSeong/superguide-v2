// Downloads the Anatomy table (part health, armor, durability, damage to main) of every vehicle
// stratagem page on the wiki (Category:Vehicle Stratagems: Exosuits, FRVs, tanks) into
// db/source/wiki_vehicles.json, read with the same row parser as the enemy anatomy.
// Usage: node scripts/fetch-vehicle-pages.mjs  ->  node scripts/build-vehicle-durability.mjs
import { writeFile } from 'node:fs/promises';
import { anatomyRows } from './anatomy-source.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function patient(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
    const body = res.ok ? await res.json() : null;
    if (body && !body.error) return body;
    if (attempt === 5) throw new Error(`${res.status} ${body?.error?.code ?? ''} ${url}`);
    await sleep(20000 * (attempt + 1));
  }
}

const members = (await patient({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Vehicle Stratagems', cmnamespace: '0', cmlimit: '100' }))
  .query.categorymembers.map(page => page.title).filter(title => !/\(disambiguation\)/.test(title));
await sleep(3000);
const { query } = await patient({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: members.join('|') });
const out = { source: API, category: 'Category:Vehicle Stratagems', retrievedAt: new Date().toISOString().slice(0, 10), pages: {} };
for (const page of query.pages.sort((a, b) => a.title.localeCompare(b.title))) {
  const revision = page.revisions[0];
  out.pages[page.title] = { revision: revision.revid, timestamp: revision.timestamp, rows: anatomyRows(revision.slots.main.content) };
}
await writeFile(new URL('../db/source/wiki_vehicles.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(Object.entries(out.pages).map(([title, page]) => `${title}: ${page.rows.length} rows`).join('\n'));
