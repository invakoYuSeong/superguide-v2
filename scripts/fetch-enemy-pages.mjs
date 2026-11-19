// Downloads the wiki page of every enemy on the enemy view and keeps what the view shows besides
// the anatomy: the infobox fire multiplier (fire_mult), stagger threshold (stagger_req), subfaction
// (faction) and lowest difficulty, and the Spawning and Behavior sections that
// db/source/enemy_behavior_korean.json summarizes. Output: db/source/wiki_enemy_pages.json.
// Usage: node scripts/fetch-enemy-pages.mjs
import { writeFile } from 'node:fs/promises';
import { enemies } from '../dist/data/combat-data.js';
import { pageTitle } from './enemy-page-title.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function patient(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
    const body = res.ok ? await res.json() : null;
    if (body && !body.error) return body;
    if (attempt === 5) throw new Error(`${res.status} ${body?.error?.code ?? ''} ${url}`);
    await sleep(20000 * (attempt + 1));
  }
}
// Same line only: an empty value must not swallow the next parameter.
const field = (text, key) => new RegExp(`\\|[ \\t]*${key}[ \\t]*=[ \\t]*([^\\n]*)`).exec(text)?.[1].trim() ?? '';
// One top-level section ("== Spawning ==") up to the next heading of the same level.
const section = (text, name) => {
  const start = new RegExp(`^==\\s*${name}\\s*==\\s*$`, 'mi').exec(text);
  if (!start) return null;
  const rest = text.slice(start.index + start[0].length);
  const end = /^==[^=].*==\s*$/m.exec(rest);
  return (end ? rest.slice(0, end.index) : rest).trim();
};

const titles = [...new Set(enemies.map(pageTitle))].sort();
const out = { source: API, retrievedAt: new Date().toISOString().slice(0, 10), pages: {} };
for (let i = 0; i < titles.length; i += 40) {
  const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', format: 'json', formatversion: '2', redirects: '1', titles: titles.slice(i, i + 40).join('|') });
  const { query } = await patient(`${API}?${params}`);
  const alias = new Map([...(query.normalized || []), ...(query.redirects || [])].map(entry => [entry.from, entry.to]));
  for (const title of titles.slice(i, i + 40)) {
    let target = title;
    for (let n = 0; n < 3 && alias.has(target); n++) target = alias.get(target);
    const page = query.pages.find(p => p.title === target);
    if (!page || page.missing) { console.log(`missing: ${title}`); continue; }
    const text = page.revisions[0].slots.main.content;
    out.pages[title] = {
      title: page.title, revision: page.revisions[0].revid,
      faction: field(text, 'faction') || null, fireMult: field(text, 'fire_mult') || field(text, 'elemental_mult') || null, staggerReq: field(text, 'stagger_req') || null,
      minDifficulty: /Difficulty\|(\d+)/.exec(field(text, 'min_difficulty'))?.[1] ?? null,
      spawning: section(text, 'Spawning'), behavior: section(text, 'Behaviou?r'),
    };
  }
  await sleep(3000);
}
await writeFile(new URL('../db/source/wiki_enemy_pages.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
const pages = Object.values(out.pages);
console.log(`${pages.length} pages; fire_mult ${pages.filter(p => p.fireMult).length}, stagger_req ${pages.filter(p => p.staggerReq).length}, spawning ${pages.filter(p => p.spawning).length}, behavior ${pages.filter(p => p.behavior).length}`);
