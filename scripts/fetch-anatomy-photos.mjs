// Downloads the wiki anatomy photo of every part of a re-checked enemy
// (anatomyRevision) that has no photo yet, using the image names recorded in
// db/source/wiki_anatomy.json (or the structure pages, see scripts/anatomy-source.mjs).
// Each photo is saved as WebP (quality 90, via Pillow) with a 320px thumbnail,
// added to scripts/anatomy-webp.json, and
// listed in dist/data/combat-images-revised.js with the PNG hashes.
// Usage: node scripts/fetch-anatomy-photos.mjs   (needs network and python with Pillow)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { enemies } from '../dist/data/combat-data.js';
import { baseCombatImages } from '../dist/data/combat-images.js';
import { anatomySnapshot } from './anatomy-source.mjs';

const root = new URL('../', import.meta.url);
const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const IMAGE_FIELDS = ['front_image', 'side_image', 'rear_image', 'left_image', 'right_image'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const clean = text => text.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const titleOf = enemy => decodeURIComponent(enemy.source.split('/wiki/')[1]).replaceAll('_', ' ');
const today = new Date().toISOString().slice(0, 10);

const snapshot = await anatomySnapshot();
const manifestUrl = new URL('scripts/anatomy-webp.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

const get = async (url, as = 'json', tries = 3) => {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    await new Promise(resolve => setTimeout(resolve, 250));
    return as === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer());
  } catch (error) {
    if (tries <= 1) throw error;
    await new Promise(resolve => setTimeout(resolve, 2000));
    return get(url, as, tries - 1);
  }
};
const imageInfo = async (file, width) => {
  const params = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: String(width), titles: `File:${file}` });
  const info = (await get(`${API}?${params}`)).query.pages[0].imageinfo?.[0];
  if (!info) throw new Error(`No wiki file ${file}`);
  return info;
};
const toWebp = (png, webp) => execFileSync('python', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=90, method=6)', png, webp]);

async function photo(enemyId, partId, stage, file) {
  const big = await imageInfo(file, 800);
  const small = await imageInfo(file, 320);
  const name = `revised-${enemyId}-${partId}${stage === 'exposed' ? '-exposed' : ''}`;
  const hashes = {};
  for (const [suffix, url] of [['', big.thumburl], ['-thumb', small.thumburl]]) {
    const png = await get(url, 'bytes');
    const pngPath = fileURLToPath(new URL(`dist/assets/anatomy/${name}${suffix}.png`, root));
    const webpPath = pngPath.replace(/\.png$/, '.webp');
    await writeFile(pngPath, png);
    toWebp(pngPath, webpPath);
    execFileSync('python', ['-c', 'import os, sys; os.remove(sys.argv[1])', pngPath]);
    manifest[`./assets/anatomy/${name}${suffix}.webp`] = { sha256: sha(await readFile(webpPath)), sourceSha256: sha(png) };
    hashes[suffix ? 'thumbnailSha256' : 'sha256'] = sha(png);
  }
  return {
    src: `./assets/anatomy/${name}.webp`, thumbnail: `./assets/anatomy/${name}-thumb.webp`, title: file, stage,
    source: `https://helldivers.wiki.gg/wiki/File:${file.replaceAll(' ', '_')}`, originalUrl: big.url, renderedUrl: big.thumburl, thumbnailUrl: small.thumburl,
    width: big.thumbwidth, height: big.thumbheight, thumbnailWidth: small.thumbwidth, thumbnailHeight: small.thumbheight,
    sha256: hashes.sha256, thumbnailSha256: hashes.thumbnailSha256, retrievedAt: today,
  };
}

const moduleUrl = new URL('dist/data/combat-images-revised.js', root);
const { revisedCombatImages: previous } = await import(moduleUrl);
const revised = structuredClone(previous);
let added = 0;
for (const enemy of enemies.filter(item => item.anatomyRevision)) {
  // Same row names as scripts/test-anatomy.mjs: extra tabs are "<tab>: <part>".
  const home = enemy.anatomyTable ?? 0;
  const rows = new Map(snapshot.pages[titleOf(enemy)].rows.map(row => [(row.table ?? 0) === home ? clean(row.part_name) : `${row.tab}: ${clean(row.part_name)}`, row]));
  for (const part of enemy.parts) {
    if (baseCombatImages[enemy.id]?.[part.id] || revised[enemy.id]?.[part.id]) continue;
    const photos = [];
    for (const [stage, layer] of [['initial', part], ['exposed', part.next]]) {
      // "Anatomy Placeholder.png" marks a part without a real photo.
      const file = layer?.sourcePart && IMAGE_FIELDS.map(field => rows.get(layer.sourcePart)?.[field]).find(name => name && !/^Anatomy Placeholder/i.test(name));
      if (file) photos.push(await photo(enemy.id, part.id, stage, file));
    }
    if (!photos.length) continue;
    (revised[enemy.id] ||= {})[part.id] = photos;
    added += photos.length;
    console.log(`${enemy.id}/${part.id}: ${photos.map(item => item.title).join(', ')}`);
  }
}
await writeFile(manifestUrl, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))), null, 2) + '\n');
await writeFile(moduleUrl, `// Generated by scripts/fetch-anatomy-photos.mjs: wiki anatomy photos for parts added\n// when an enemy was re-checked (anatomyRevision). sha256/thumbnailSha256 are the\n// Wiki PNGs; the served files are their WebP (quality 90) encodings.\nexport const revisedCombatImages = ${JSON.stringify(revised, null, 2)};\n`);
console.log(`${added} photos added`);
