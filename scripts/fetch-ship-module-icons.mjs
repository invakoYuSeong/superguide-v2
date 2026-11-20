// Downloads the six ship section icons the wiki Ship Modules table shows (Patriotic
// Administration Center ... Robotics Workshop) into dist/assets/ship-modules/<section>.svg,
// safety-checked, and lists them in db/source/wiki_ship_module_icons.json. The table itself
// comes from db/source/wiki_stratagem_stats.json (scripts/fetch-stratagem-stats.mjs).
// Usage: node scripts/fetch-ship-module-icons.mjs  ->  node scripts/build-ship-module-upgrades.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSvg } from './svg-safety.mjs';
import { parseShipModules } from './ship-module-parse.mjs';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function patient(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) });
    const limited = res.status === 429 || (res.headers.get('content-type') || '').includes('json') && (await res.clone().json()).error?.code === 'ratelimited';
    if (!limited && res.ok) return res;
    if (attempt === 5) throw new Error(`${res.status} ${url}`);
    await sleep(20000 * (attempt + 1));
  }
}
export const sectionId = en => en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const source = JSON.parse(await readFile(new URL('../db/source/wiki_stratagem_stats.json', import.meta.url), 'utf8')).shipModules;
const { sections } = parseShipModules(source.text);
await mkdir(new URL('../dist/assets/ship-modules/', import.meta.url), { recursive: true });
const icons = {};
for (const section of sections) {
  await sleep(3000);
  const info = (await (await patient(`${API}?${new URLSearchParams({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: `File:${section.icon}`, format: 'json', formatversion: '2' })}`)).json()).query.pages[0].imageinfo[0];
  // A standard SVG 1.1 DOCTYPE line (no entities) is dropped: the safety check allows no DTD.
  const raw = Buffer.from(await (await patient(info.url)).arrayBuffer()).toString('utf8');
  const bytes = Buffer.from(raw.replace(/<!DOCTYPE svg PUBLIC "-\/\/W3C\/\/DTD SVG 1\.1\/\/EN" "http:\/\/www\.w3\.org\/Graphics\/SVG\/1\.1\/DTD\/svg11\.dtd">\s*/, ''), 'utf8');
  validateSvg(bytes, { name: section.icon });
  const id = sectionId(section.en);
  await writeFile(new URL(`../dist/assets/ship-modules/${id}.svg`, import.meta.url), bytes);
  icons[section.en] = { file: `${id}.svg`, title: section.icon, source: `https://helldivers.wiki.gg/wiki/File:${section.icon.replaceAll(' ', '_')}`, sha256: createHash('sha256').update(bytes).digest('hex') };
  console.log(section.en, section.icon);
}
await writeFile(new URL('../db/source/wiki_ship_module_icons.json', import.meta.url), JSON.stringify({ retrievedAt: new Date().toISOString().slice(0, 10), icons }, null, 1) + '\n');
