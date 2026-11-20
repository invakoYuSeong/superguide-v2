// Downloads the "Weapons Loadout" boxes ({{Enemy Loadout Box}}: damage, AP, demolition, stagger,
// push) of every enemy page on the enemy view, and the wiki's Helldiver armor table
// (Template:Armor Ratings: health and the damage factor of each armor rating), into
// db/source/wiki_enemy_weapons.json. The other enemy page fields stay in wiki_enemy_pages.json.
// Usage: node scripts/fetch-enemy-weapons.mjs  ->  node scripts/build-enemy-weapons.mjs
import { writeFile } from 'node:fs/promises';
import { enemies } from '../dist/data/combat-data.js';
import { pageTitle } from './enemy-page-title.mjs';
import { loadoutBoxes } from './enemy-weapon-parse.mjs';

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
const revisions = titles => patient({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', redirects: '1', titles: titles.join('|') });

const out = { source: API, retrievedAt: new Date().toISOString().slice(0, 10), armorRatings: null, pages: {} };
const template = (await revisions(['Template:Armor Ratings'])).query.pages[0];
out.armorRatings = { title: template.title, revision: template.revisions[0].revid, text: template.revisions[0].slots.main.content };
const titles = [...new Set(enemies.map(pageTitle))].sort();
for (let i = 0; i < titles.length; i += 40) {
  await sleep(3000);
  const { query } = await revisions(titles.slice(i, i + 40));
  const alias = new Map([...(query.normalized || []), ...(query.redirects || [])].map(entry => [entry.from, entry.to]));
  for (const title of titles.slice(i, i + 40)) {
    let target = title;
    for (let n = 0; n < 3 && alias.has(target); n++) target = alias.get(target);
    const page = query.pages.find(p => p.title === target);
    if (!page || page.missing) { console.log(`missing: ${title}`); continue; }
    const boxes = loadoutBoxes(page.revisions[0].slots.main.content);
    if (boxes.length) out.pages[title] = { title: page.title, revision: page.revisions[0].revid, boxes };
  }
}
await writeFile(new URL('../db/source/wiki_enemy_weapons.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
const pages = Object.values(out.pages);
console.log(`${pages.length} of ${titles.length} pages have loadout boxes, ${pages.reduce((sum, page) => sum + page.boxes.length, 0)} boxes; Armor Ratings revision ${out.armorRatings.revision}`);
