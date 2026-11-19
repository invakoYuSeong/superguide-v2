// Downloads the wiki pages of the warbond tiles whose cost or page the warbond page itself
// disagrees on (template vs item table), so build-warbonds.mjs can settle them with the item's
// own page (scripts/warbond-resolve.mjs). Output: db/source/wiki_warbond_item_pages.json.
// Usage: node scripts/fetch-warbonds.mjs  ->  node scripts/fetch-warbond-item-pages.mjs  ->  node scripts/build-warbonds.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { parseWarbondPage } from './warbond-parse.mjs';
import { disputed, itemPageOf } from './warbond-resolve.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const snapshot = JSON.parse(await readFile(new URL('../db/source/wiki_warbonds.json', import.meta.url), 'utf8'));
const titles = [...new Set(Object.entries(snapshot.pages)
  .flatMap(([title, page]) => disputed(parseWarbondPage(page.wikitext, title)))
  .map(({ item }) => itemPageOf(item)?.title).filter(Boolean))].sort();
const out = { source: API, retrievedAt: new Date().toISOString().slice(0, 10), pages: {} };
if (titles.length) {
  const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: titles.join('|') });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status}`);
  const { query } = await res.json();
  const alias = new Map([...(query.normalized || []), ...(query.redirects || [])].map(entry => [entry.from, entry.to]));
  for (const title of titles) {
    const page = query.pages.find(p => p.title === (alias.get(title) ?? title));
    if (!page || page.missing) { console.log(`missing: ${title}`); continue; }
    const revision = page.revisions[0];
    out.pages[title] = { title: page.title, revision: revision.revid, timestamp: revision.timestamp, text: revision.slots.main.content };
  }
}
await writeFile(new URL('../db/source/wiki_warbond_item_pages.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out.pages).length} item pages: ${titles.join(', ')}`);
