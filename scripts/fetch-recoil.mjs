// Downloads the weapon recoil table of helldiversotl.com/research/recoil (base sway, weapon drift and
// camera climb from the game's weapon data; the page states the game version it was written for) into
// db/source/otl_recoil.json. The page's own text is kept as numbers: '10 / 15' -> [10, 15], '1x' -> 1.
// The site takes drift and climb from the wiki datamine (they matched this table on 2026-11-24); only the
// angle limits (where vertical recoil eases off), which the datamine lacks, come from here.
// Usage: node scripts/fetch-recoil.mjs  ->  node scripts/build-recoil.mjs
import { writeFile } from 'node:fs/promises';

const URL_ = 'https://helldiversotl.com/research/recoil';
const res = await fetch(URL_, { signal: AbortSignal.timeout(60000) });
if (!res.ok) throw new Error(`${res.status} ${URL_}`);
const page = await res.text();
const unescape = text => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const pair = (text, name) => {
  const values = String(text).match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (values?.length !== 2) throw new Error(`${name}: cannot read "${text}"`);
  return values;
};
const rows = [...page.matchAll(/data-row="([^"]+)"/g)].map(match => JSON.parse(unescape(match[1]))).filter(row => 'weaponDrift' in row)
  .map(row => ({ name: row.name, category: row.category, sway: Number(String(row.sway).match(/\d+(?:\.\d+)?/)[0]), drift: pair(row.weaponDrift, row.name), climb: pair(row.cameraClimb, row.name), limit: pair(row.angleLimit, row.name) }));
if (rows.length < 50) throw new Error(`Only ${rows.length} weapon rows found: the page layout may have changed`);
const text = unescape(page.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const meta = (label, pattern) => text.match(new RegExp(`${label} ${pattern}`))?.[1] ?? null;
const out = {
  source: URL_, retrievedAt: new Date().toISOString().slice(0, 10),
  writtenFor: meta('Written for Game', '([0-9.]+)'), codeVerified: meta('Code verified for Game', '([0-9.]+)'), lastModified: meta('Last modified', '([A-Z][a-z]{2} \\d{1,2}, \\d{4})'),
  rows,
};
// One weapon a line, so a re-fetch diffs by weapon.
const json = JSON.stringify({ ...out, rows: [] }, null, 1).replace('"rows": []', `"rows": [\n${rows.map(row => `  ${JSON.stringify(row)}`).join(',\n')}\n ]`);
await writeFile(new URL('../db/source/otl_recoil.json', import.meta.url), json + '\n');
console.log(`${URL_}: ${rows.length} weapons (written for ${out.writtenFor}, last modified ${out.lastModified})`);
