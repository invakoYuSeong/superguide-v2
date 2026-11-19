// Downloads every booster page in the wiki's Category:Boosters (infobox and the
// body text the detail lines are checked against) into db/source/wiki_boosters.json,
// and each booster's original SVG icon into dist/assets/boosters/.
// Usage: node scripts/fetch-boosters.mjs  ->  node scripts/tools/export-game-names.mjs <tsv>  ->  node scripts/build-boosters.mjs
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
export const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const members = (await get({ action: 'query', list: 'categorymembers', cmtitle: 'Category:Boosters', cmlimit: '100' }))
  .query.categorymembers.filter(page => page.ns === 0 && page.title !== 'Boosters').map(page => page.title);
await sleep(1500);
const { query } = await get({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', titles: members.join('|') });
const out = { source: API, category: 'Category:Boosters', retrievedAt: new Date().toISOString().slice(0, 10), boosters: {} };
await mkdir(new URL('../dist/assets/boosters/', import.meta.url), { recursive: true });
for (const page of query.pages.sort((a, b) => a.title.localeCompare(b.title))) {
  const revision = page.revisions[0];
  const text = revision.slots.main.content;
  const image = /\|\s*image\s*=\s*([^\n|]+)/.exec(text)?.[1].trim();
  await sleep(1500);
  const info = (await get({ action: 'query', prop: 'imageinfo', iiprop: 'url|sha1', titles: `File:${image}` })).query.pages[0].imageinfo[0];
  const res = await fetch(info.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${res.status} ${info.url}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  validateSvg(bytes, { name: image });
  const file = `${slug(page.title)}.svg`;
  await writeFile(new URL(`../dist/assets/boosters/${file}`, import.meta.url), bytes);
  out.boosters[slug(page.title)] = {
    title: page.title, revision: revision.revid, timestamp: revision.timestamp, text,
    icon: { file, title: image, source: `https://helldivers.wiki.gg/wiki/File:${image.replaceAll(' ', '_')}`, sha256: createHash('sha256').update(bytes).digest('hex') },
  };
  console.log(page.title, revision.revid);
}
await writeFile(new URL('../db/source/wiki_boosters.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out.boosters).length} boosters`);
