// Downloads the wiki Anatomy tables of every combat enemy page into
// db/source/wiki_anatomy.json. Offline checks (scripts/test-anatomy.mjs) read
// that snapshot through scripts/anatomy-source.mjs, which falls back to the
// structure pages in db/source/wiki_structures.json for a page not saved here.
// Usage: node scripts/fetch-enemy-anatomy.mjs
import { writeFile } from 'node:fs/promises';
import { enemies } from '../dist/data/combat-data.js';
import { anatomyRows } from './anatomy-source.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const titleOf = enemy => decodeURIComponent(enemy.source.split('/wiki/')[1]).replaceAll('_', ' ');

const titles = [...new Set(enemies.map(titleOf))].sort();
const pages = {};
for (let i = 0; i < titles.length; i += 50) {
  // redirects=1: renamed wiki pages (Bile Spewer → Caustic Spewer) still return
  // their content; the snapshot key stays the title the site asked for.
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'revisions', rvprop: 'ids|content', rvslots: 'main', titles: titles.slice(i, i + 50).join('|') });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} anatomy batch ${i}`);
  const json = await res.json();
  const normalized = Object.fromEntries((json.query.normalized || []).map(item => [item.to, item.from]));
  const redirected = {};
  for (const item of json.query.redirects || []) (redirected[item.to] ??= []).push(normalized[item.from] ?? item.from);
  for (const page of json.query.pages) {
    const revision = page.revisions?.[0];
    const askedTitles = redirected[page.title] ?? [normalized[page.title] ?? page.title];
    for (const title of askedTitles) {
      if (!revision) throw new Error(`Missing wiki page: ${title}`);
      pages[title] = { source: `https://helldivers.wiki.gg/wiki/${title.replaceAll(' ', '_')}`, ...(page.title !== title ? { redirectTo: page.title } : {}), revision: revision.revid, rows: anatomyRows(revision.slots.main.content) };
    }
  }
  await new Promise(resolve => setTimeout(resolve, 250));
}
const missing = titles.filter(title => !pages[title]);
if (missing.length) throw new Error(`Missing pages: ${missing.join(', ')}`);
const body = { retrievedAt: new Date().toISOString().slice(0, 10), pages: Object.fromEntries(titles.map(title => [title, pages[title]])) };
await writeFile(new URL('../db/source/wiki_anatomy.json', import.meta.url), JSON.stringify(body, null, 1) + '\n');
console.log(`${titles.length} pages, ${Object.values(pages).reduce((sum, page) => sum + page.rows.length, 0)} anatomy rows`);
