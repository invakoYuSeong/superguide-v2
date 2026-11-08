// Data integrity, search, routing, rendering helpers and deploy versioning.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { stratagems, categories, apBands, apBandOf } from '../dist/core/catalog.js';
import { search, stratagemFields, personalNames, initials, normalize } from '../dist/core/search.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { parseRoute, formatRoute } from '../dist/core/route.js';
import { josa, countText, outcomeOf, reasonText } from '../dist/core/explain.js';
import { enemies, weaponProfiles, unsupportedWeapons } from '../dist/data/combat-data.js';
import { demolitionProfiles } from '../dist/data/demolition-data.js';
import { factionGuides, factionSides } from '../dist/data/faction-data.js';
import { factionLoadouts } from '../dist/data/faction-loadouts.js';
import { wikiIcons } from '../dist/data/wiki-icons.js';
import { combatImages } from '../dist/data/combat-images.js';
import { pickerEnemyImages, pickerStructureImages } from '../dist/data/selector-images.js';
import { solveMatchup } from '../dist/core/combat.js';
import { recommend } from '../dist/core/factions.js';
import { versionFiles, readSources, localReferences } from './version-assets.mjs';

const dist = new URL('../dist/', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };

// --- Catalogue -------------------------------------------------------------------
ok(stratagems.length === 114, 'catalogue keeps all 114 stratagems');
ok(new Set(stratagems.map(item => item.id)).size === stratagems.length, 'stratagem ids are unique');
for (const item of stratagems) {
  ok(categories.some(cat => cat.id === item.category), `${item.id}: category`);
  for (const key of ['name', 'en', 'summary', 'usage', 'source']) ok(typeof item[key] === 'string' && item[key].trim(), `${item.id}: ${key}`);
  ok(new URL(item.source).hostname === 'helldivers.wiki.gg', `${item.id}: source host`);
  ok(wikiIcons[item.id]?.src, `${item.id}: icon`);
  ok(apBandOf(item), `${item.id}: every stratagem falls in one AP band`);
  ok(apBands.filter(band => band.test(item)).length === 1, `${item.id}: AP bands do not overlap`);
  if (item.input) ok(/^[↑↓←→]+$/.test(item.input), `${item.id}: call code`);
}

// --- Assets exist and match their recorded hashes ------------------------------------
const exists = path => access(new URL(path.replace(/^\.\//, ''), dist)).then(() => true, () => false);
for (const [id, icon] of Object.entries(wikiIcons)) {
  const bytes = await readFile(new URL(icon.src.replace(/^\.\//, ''), dist));
  ok(sha256(bytes) === icon.sha256, `${id}: icon bytes match the Wiki original`);
}
const anatomy = JSON.parse(await readFile(new URL('./anatomy-webp.json', import.meta.url), 'utf8'));
const photos = Object.values(combatImages).flatMap(parts => Object.values(parts).flat());
for (const photo of photos) for (const src of [photo.src, photo.thumbnail].filter(Boolean)) {
  ok(await exists(src), `missing anatomy image ${src}`);
  if (anatomy[src]) ok(sha256(await readFile(new URL(src.replace(/^\.\//, ''), dist))) === anatomy[src].sha256, `${src}: WebP matches manifest`);
}
for (const image of [...Object.values(pickerEnemyImages), ...Object.values(pickerStructureImages)]) if (image?.src) ok(await exists(image.src), `missing portrait ${image.src}`);
for (const side of factionSides) ok(await exists(side.icon), `missing faction icon ${side.icon}`);

// --- Cross references ----------------------------------------------------------------
const byId = new Map(stratagems.map(item => [item.id, item]));
for (const id of [...Object.keys(weaponProfiles), ...Object.keys(unsupportedWeapons)]) ok(byId.get(id)?.category === 'support', `${id}: combat weapon is a support stratagem`);
for (const id of Object.keys(demolitionProfiles)) ok(byId.has(id), `${id}: demolition profile has a stratagem`);
for (const guide of factionGuides) for (const unit of guide.units) for (const choice of unit.weapons) {
  const pick = factionLoadouts[unit.enemy].find(item => item.weapon === choice);
  ok(pick?.label && pick.note, `${unit.enemy}/${choice}: editorial label and note`);
  ok(byId.get(choice.split(':')[0])?.category === 'support', `${choice}: faction picks are support weapons`);
  const result = recommend(unit, choice);
  if (result.route) ok(pick.targets.includes(result.route.target.id), `${unit.enemy}/${choice}: never swaps the editor's aim point`);
}

// --- Engine sanity (independent of the legacy fixture) -----------------------------------
const charger = enemies.find(enemy => enemy.id === 'charger');
const aphet = weaponProfiles.autocannon.modes[0];
const { rows, best } = solveMatchup(charger, aphet);
ok(best.target.id === 'butt' && best.hits === 3 && best.outcome === 'bleed', 'autocannon vs charger: 3 shots to the rear bleeds it out');
ok(rows.find(row => row.target.id === 'head').hits === 7, 'autocannon vs charger head: 7 shots');
ok(countText({ hits: 3, lowerBound: true }, aphet) === '3발 이상', 'lower bounds read as "이상"');
ok(outcomeOf({ outcome: 'break', target: { resultLabel: '담즙낭 파괴' } }).label === '담즙낭 파괴', 'custom break labels');
ok(reasonText({ reason: 'shield', detail: 'X' }) === 'X', 'data-provided reasons pass through');

const testPart = { id: 'test', name: 'test', hp: 100, armor: 0, durability: 0, exdr: 0, toMain: 0, overflowCap: true, effect: 'kill' };
const testEnemy = { main: { hp: 1000, armor: 0, exdr: 0 }, parts: [testPart] };
const shot = { standard: 40, durable: 40, ap: 1, explosion: 0 };
const routeFor = (part, attack = shot, mainHp = 1000) => solveMatchup({ ...testEnemy, main: { ...testEnemy.main, hp: mainHp }, parts: [part] }, attack).rows[0];
const single = routeFor(testPart);
const pair = routeFor({ ...testPart, copies: 2 });
ok(single.hits === 3 && pair.hits === 6 && pair.stages.map(stage => stage.hits).join(',') === '3,3', 'two copies each require a full pool');
const pellets = { ...shot, events: [{ attack: shot, times: 4, directHit: true }] };
ok(routeFor({ ...testPart, copies: 2 }, pellets).hits === 2, 'leftover pellets do not hit the next copy');
const transferPair = routeFor({ ...testPart, copies: 2, toMain: 100 }, shot, 150);
ok(transferPair.hits === 5 && transferPair.via === 'main', 'main damage accumulates across copies with a fresh cap');
const beam = { ...shot, standard: 60, durable: 60, beam: { duration: 1, standardPerSecond: 60, durablePerSecond: 60 } };
const beamPair = routeFor({ ...testPart, copies: 2 }, beam);
ok(beamPair.hits === 4 && beamPair.stages.length === 2 && beamPair.stages.every(stage => stage.hits === 2), 'beam starts a new whole shot for each copy');
const implicit = routeFor(testPart), explicit = routeFor({ ...testPart, copies: 1 });
ok(JSON.stringify([implicit.hits, implicit.outcome, implicit.via, implicit.stages.map(s => [s.hits, s.damage])]) === JSON.stringify([explicit.hits, explicit.outcome, explicit.via, explicit.stages.map(s => [s.hits, s.damage])]), 'default copy count preserves results');

// --- Search ------------------------------------------------------------------------
const names = query => search(stratagems, query, stratagemFields).map(item => item.name);
ok(names('ㄱㄷㅈㅁ')[0] === '궤도 정밀 타격', 'initial-consonant search');
ok(names('도밀타')[0] === '궤도 정밀 타격', 'any-order syllables');
ok(names('반톤')[0] === '이글 500kg 폭탄', 'alias search');
ok(search(personalWeapons, '석궁', item => ({ names: personalNames(item), text: [] }))[0]?.id === 'exploding-crossbow', 'weapon alias: 석궁 finds the Exploding Crossbow');
ok(names('500').length === 1, 'digits do not match in any order');
ok(names('AC-8')[0] === '오토캐넌', 'code search');
ok(initials('궤도 정밀') === 'ㄱㄷㅈㅁ', 'initials');
ok(normalize('ＡＢ ㄱ') === 'abㄱ', 'NFKC folding keeps typed consonants');
ok(names('').length === stratagems.length, 'empty query keeps everything');

// --- Routing -----------------------------------------------------------------------
const route = parseRoute('#/enemy/charger?w=autocannon&m=aphet');
ok(route.view === 'enemy' && route.id === 'charger' && route.query.w === 'autocannon' && route.query.m === 'aphet', 'parse route');
ok(formatRoute(route) === '#/enemy/charger?w=autocannon&m=aphet', 'format round-trips');
ok(parseRoute('#combat').view === 'enemy' && parseRoute('#catalog').view === 'arsenal', 'old-site hashes still work');
ok(parseRoute('').view === 'warbonds' && parseRoute('#/nowhere').view === 'warbonds' && formatRoute(parseRoute('')) === '#/warbonds', 'empty and unknown routes open the warbond main page');
for (const hash of ['#/arsenal', '#/arsenal/eagle-500kg?c=eagle', '#/gear/liberator?cat=primary', '#/gear?tab=loadout&p=liberator', '#/enemy/charger?w=autocannon', '#/demolition?s=spore-spewer', '#/factions/predator-strain', '#/warbonds/cutting-edge?t=premium']) {
  ok(formatRoute(parseRoute(hash)) === hash, `existing link keeps its screen: ${hash}`);
}
ok(parseRoute('#/arsenal?q=%EB%8F%84%EB%B0%80%ED%83%80%26x').query.q === '도밀타&x', 'queries decode once');
ok(formatRoute({ view: 'arsenal', query: { q: '', c: null } }) === '#/arsenal', 'empty params are dropped');

// --- Rendering helpers ----------------------------------------------------------------
const { html, raw } = await import('../dist/ui/dom.js');
ok(String(html`<p>${'<img onerror=x>'}</p>`) === '<p>&lt;img onerror=x&gt;</p>', 'data text is escaped');
ok(String(html`<p>${raw('<b>')}${['a', html`<i>${'&'}</i>`]}</p>`) === '<p><b>a<i>&amp;</i></p>', 'nested templates stay markup');
ok(josa('헐크', ['과', '와']) === '헐크와' && josa('살점', ['을', '를']) === '살점을', 'Korean particles');

// --- Analytics: only the published sites, each to its own GA4 property ---------------
const { initAnalytics } = await import('../dist/ui/analytics.js');
const gaRun = url => {
  const win = { location: new URL(url) }; const loaded = [];
  initAnalytics(win, { createElement: () => ({}), head: { appendChild: script => loaded.push(script) } })('enemy');
  const layer = win.dataLayer || [];
  return { src: loaded[0]?.src, config: layer.find(args => args[0] === 'config')?.[1], events: layer.filter(args => args[0] === 'event').map(args => [args[2].feature, args[2].send_to]) };
};
const v2 = gaRun('https://modocracy.github.io/superguide-v2/#/enemy');
ok(v2.config === 'G-XKLV3JPDC0' && v2.src.endsWith('id=G-XKLV3JPDC0'), 'v2 site reports to its own property');
ok(JSON.stringify(v2.events) === JSON.stringify([['combat', 'G-XKLV3JPDC0']]), 'feature events go to the v2 property with the old names');
ok(gaRun('https://modocracy.github.io/superguide/').config === 'G-5XFT3VQ054', 'original site keeps its property');
for (const url of ['http://localhost:4173/', 'https://modocracy.github.io/superguide-v3/', 'https://example.com/superguide-v2/', 'https://jj-dot-eng.github.io/superguide-v2/']) ok(!gaRun(url).src, `no analytics on ${url}`);

// --- Deploy versioning ----------------------------------------------------------------
const sources = await readSources();
const { files, versions } = versionFiles(sources);
ok(localReferences('index.html', sources.get('index.html')).includes('ui/main.js'), 'index loads ui/main.js');
const urls = new Map();
for (const [file, text] of files) for (const match of text.matchAll(/(['"])(\.{1,2}\/[\w./-]+\.(?:js|css))(\?v=[0-9a-f]{12})?\1/g)) {
  ok(match[3], `${file}: unversioned ${match[2]}`);
  const target = new URL(match[2], new URL(file, 'https://x/')).pathname.slice(1);
  ok(match[3] === `?v=${versions.get(target)}`, `${file}: stale version for ${target}`);
  urls.set(target, (urls.get(target) || new Set()).add(match[3]));
}
for (const [file, seen] of urls) ok(seen.size === 1, `${file} is requested under one URL`);
const edited = new Map(sources);
edited.set('core/search.js', `${sources.get('core/search.js')}\n// changed`);
const next = versionFiles(edited).versions;
ok(next.get('ui/views/arsenal.js') !== versions.get('ui/views/arsenal.js'), 'importers refresh when a dependency changes');
ok(next.get('core/combat.js') === versions.get('core/combat.js'), 'unrelated modules keep their key');
assert.deepEqual(versionFiles(files).files, files, 'versioning is idempotent'); checks++;

console.log(`PASS units: ${checks} checks (catalogue, assets, references, search, routes, rendering, analytics, versioning).`);
