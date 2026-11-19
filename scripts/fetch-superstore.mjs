// Downloads the wiki Superstore page into db/source/wiki_superstore.json (wikitext and revision);
// scripts/build-superstore.mjs turns it into dist/data/superstore.js.
// Usage: node scripts/fetch-superstore.mjs
import { writeFile } from 'node:fs/promises';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: 'Superstore', redirects: '1', format: 'json', formatversion: '2' });
let body;
for (let attempt = 0; attempt < 6; attempt++) {
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  body = res.ok ? await res.json() : null;
  if (body?.query) break;
  await new Promise(resolve => setTimeout(resolve, 20000 * (attempt + 1)));
}
const page = body.query.pages[0];
const revision = page.revisions[0];
await writeFile(new URL('../db/source/wiki_superstore.json', import.meta.url), JSON.stringify({
  source: 'https://helldivers.wiki.gg/wiki/Superstore', retrievedAt: new Date().toISOString().slice(0, 10),
  revision: revision.revid, timestamp: revision.timestamp, text: revision.slots.main.content,
}, null, 1) + '\n');
console.log(`Superstore revision ${revision.revid} (${revision.timestamp})`);
