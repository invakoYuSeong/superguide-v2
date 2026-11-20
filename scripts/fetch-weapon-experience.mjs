// Downloads the "Weapon Experience" section of the wiki Attachments page (total experience a primary
// weapon needs for each level, the same for every primary) into db/source/wiki_weapon_experience.json.
// Usage: node scripts/fetch-weapon-experience.mjs  ->  node scripts/build-weapon-experience.mjs
import { writeFile } from 'node:fs/promises';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const params = new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main', format: 'json', formatversion: '2', titles: 'Attachments' });
const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error(`${res.status} Attachments`);
const page = (await res.json()).query.pages[0];
const text = page.revisions[0].slots.main.content;
const section = /==\s*Weapon Experience\s*==([\s\S]*?)\n==[^=]/.exec(text)?.[1];
if (!section) throw new Error('Attachments: no "Weapon Experience" section');
const out = { source: 'https://helldivers.wiki.gg/wiki/Attachments#Weapon_Experience', revision: page.revisions[0].revid, revisionTimestamp: page.revisions[0].timestamp, retrievedAt: new Date().toISOString().slice(0, 10), section: section.trim() };
await writeFile(new URL('../db/source/wiki_weapon_experience.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`Attachments revision ${out.revision}: Weapon Experience section saved`);
