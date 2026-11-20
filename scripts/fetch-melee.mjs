// Downloads the quick melee attacks every Helldiver has (Melee_Helldiver) and the bayonet some
// weapons carry (Melee_Bayonet) from the wiki datamine (Module:Decodedata-Attacks/new gear.json,
// the data the wiki Combat page shows) into db/source/wiki_melee.json.
// Usage: node scripts/fetch-melee.mjs  ->  node scripts/build-melee.mjs
import { writeFile } from 'node:fs/promises';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const TITLE = 'Module:Decodedata-Attacks/new gear.json';
const KEYS = ['Melee_Helldiver', 'Melee_Bayonet'];

const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', format: 'json', formatversion: '2', titles: TITLE });
const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error(`${res.status} ${TITLE}`);
const page = (await res.json()).query.pages[0];
const data = JSON.parse(page.revisions[0].slots.main.content);
const attacks = Object.fromEntries(KEYS.map(key => {
  if (!data.damage?.[key]) throw new Error(`${TITLE} has no damage.${key}`);
  return [key, data.damage[key]];
}));
const out = { source: `https://helldivers.wiki.gg/wiki/${TITLE.replaceAll(' ', '_')}`, revision: page.revisions[0].revid, revisionTimestamp: page.revisions[0].timestamp, retrievedAt: new Date().toISOString().slice(0, 10), attacks };
await writeFile(new URL('../db/source/wiki_melee.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`${TITLE} revision ${out.revision}: ${KEYS.join(', ')}`);
