// Armor guide: infobox parsing, Korean names and effect lines tied to the wiki numbers,
// warbond cross-checks, images, the English dictionary, the gear route, and that the
// generated data is current.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateSvg } from './svg-safety.mjs';
import { parseArmorPage, parsePassivePage, parseSource, parseCost, effectLines, numbersOf, UNCONFIRMED } from './armor-parse.mjs';
import { generate, buildArmor } from './build-armor.mjs';
import { armors, armorPassives, armorWeights, armorDiscrepancies } from '../dist/data/armor.js';
import { armorImages, armorImagesMissing } from '../dist/data/armor-images.js';
import { warbonds } from '../dist/data/warbonds.js';
import { english } from '../dist/i18n/en.js';
import { parseRoute } from '../dist/core/route.js';

let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const root = new URL('../', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const snapshot = await read('db/source/wiki_armor.json');
const namu = await read('db/source/namu_armor.json');
const korean = await read('db/source/armor_passive_korean.json');

// --- Parsers --------------------------------------------------------------------------------
const page = `{{Infobox Armor\n|title={{PAGENAME}}\n|image= {{PAGENAME}} Armor Render.png\n|type=Light\n|armor=64\n|speed=536\n|stam_regen=\n||passive=[[Med-Kit]]\n|source=[[Cutting Edge Premium Warbond#Page 3|Cutting Edge]] <small>{{Tooltip|P3|Page 3}}</small>\n|cost={{Currency|Medals|64|notext}}|helmet_image= X.png\n|order=1\n}}\n'''{{PAGENAME}}''' is armor.`;
eq(parseArmorPage(page, 'XX-1 Test'), {
  title: 'XX-1 Test', weight: 'light', armorRating: 64, speed: 536, staminaRegen: null, passive: 'Med-Kit',
  source: { kind: 'warbond', title: 'Cutting Edge Premium Warbond', page: 3, raw: '[[Cutting Edge Premium Warbond#Page 3|Cutting Edge]] <small>{{Tooltip|P3|Page 3}}</small>' },
  cost: { amount: 64, unit: 'Medals' }, image: 'XX-1 Test Armor Render.png',
}, 'infobox: weight, stats (empty stays null), passive link, warbond page, cost, PAGENAME image');
eq(parseSource('[[Righteous Revenants Legendary Warbond|Righteous Revenants]] <small>{{Tooltip|P2|Page 2}}</small>').page, 2, 'page from the tooltip when the link has no anchor');
assert.throws(() => parseSource('[[A Warbond#Page 1|A]] <small>{{Tooltip|P2|Page 2}}</small>'), /disagree/); checks++;
eq(parseSource(' [[Campaigns#Permanent Enclosure|Permanent Enclosure]]'), { kind: 'campaign', key: 'Permanent Enclosure', raw: '[[Campaigns#Permanent Enclosure|Permanent Enclosure]]' }, 'campaign source');
eq(parseSource('Pre-Order Bonus').key, 'Pre-Order Bonus', 'plain-text source');
eq(parseCost('{{Tooltip|❌|Exclusive}}'), { amount: null, unit: null, exclusive: true }, 'exclusive has no price');
eq(parseCost('{{Tooltip|💲|USD}}20'), { amount: 20, unit: 'USD' }, 'edition price in USD');
eq(parseCost(''), { amount: null, unit: null }, 'missing cost stays null');
eq(effectLines("Reduces sway by {{ColorHighlight|35%}}.<br>Provides '''<span style=color:red>higher [[Damage#Armor|armor rating]]</span>'''. <br> Third."),
  ['Reduces sway by 35%.', 'Provides higher armor rating.', 'Third.'], 'effect lines: highlights, spans and links unwrapped, split on <br>');
eq(numbersOf('+2 그리고 2.0초, 30%'), ['2', '2.0', '30'], 'numbers in a line');
assert.throws(() => parseArmorPage('no infobox', 'X'), /expected one/); checks++;

// --- Snapshot → data ---------------------------------------------------------------------------
const categoryTitles = new Set(Object.values(snapshot.categories).flat());
eq(armors.length, categoryTitles.size, 'every page in the light/medium/heavy armor categories is listed once');
eq(armorPassives.length, Object.keys(snapshot.passives).length, 'every passive page is a group');
const passiveIds = new Set(armorPassives.map(p => p.id));
for (const armor of armors) {
  const parsed = parseArmorPage(snapshot.armors[armor.en].wikitext, armor.en);
  eq([armor.weight, armor.armorRating, armor.speed, armor.staminaRegen], [parsed.weight, parsed.armorRating, parsed.speed, parsed.staminaRegen], `${armor.en}: stats are the wiki infobox numbers`);
  ok(passiveIds.has(armor.passive), `${armor.en}: passive exists`);
  ok(armorWeights.some(w => w.id === armor.weight), `${armor.en}: known weight`);
  ok(armor.nameStatus === 'confirmed' ? armor.name !== armor.en && armor.name.startsWith(`${armor.code} `) || armor.name.toLowerCase() === armor.en.toLowerCase() : armor.name === armor.en, `${armor.en}: Korean name is "<code> <Namu name>" or the English name when unknown`);
  if (armor.source.kind === 'warbond') ok(warbonds.some(w => w.id === armor.source.warbondId), `${armor.en}: links to a warbond on the site`);
  else ok(armor.source.name && armor.source.en, `${armor.en}: named source`);
  ok(armor.cost ? Number.isFinite(armor.cost.amount) && ['Medals', 'SC', 'USD'].includes(armor.cost.unit) : ['exclusive', UNCONFIRMED].includes(armor.costStatus), `${armor.en}: cost or a stated reason`);
}
for (const passive of armorPassives) {
  const wiki = parsePassivePage(snapshot.passives[passive.en].wikitext, passive.en);
  eq(passive.effects.map(e => e.en), wiki.effects, `${passive.en}: English lines are the wiki description`);
  for (const effect of passive.effects) eq(numbersOf(effect.name), numbersOf(effect.en), `${passive.en}: Korean line keeps the wiki numbers: ${effect.name}`);
  ok(armors.some(a => a.passive === passive.id), `${passive.en}: has armor`);
  ok(passive.nameStatus === 'confirmed' ? passive.name !== passive.en : passive.name === passive.en, `${passive.en}: Korean name or the English name when unknown`);
}
const headings = new Set(namu.pages.flatMap(p => p.headings));
for (const passive of armorPassives.filter(p => p.nameStatus === 'confirmed')) ok(headings.has(passive.name) || headings.has(passive.name.split(', ')[0]), `${passive.en}: Korean name is a Namu Wiki heading`);
ok(armorDiscrepancies.every(d => d.armor && d.field), 'discrepancies name the armor and the field');

// The warbond boards agree with the armor pages (page and medal cost), so no source discrepancy remains.
ok(!armorDiscrepancies.some(d => ['source', 'page', 'cost'].includes(d.field)), `armor sources match the warbond boards: ${JSON.stringify(armorDiscrepancies)}`);
for (const armor of armors.filter(a => a.source.kind === 'warbond')) {
  const warbond = warbonds.find(w => w.id === armor.source.warbondId);
  ok(warbond.pages.some(p => p.number === armor.source.page && p.items.some(i => i.kind === 'armor' && [armor.en, `${armor.en} Armor`].includes(i.name))), `${armor.en}: on ${warbond.en} page ${armor.source.page}`);
}

// Build guards: wrong numbers, missing lines, unknown names and order independence.
const broken = structuredClone(korean);
broken.passives['Med-Kit'].effects[0] = '각성제의 초기 인벤토리와 소지 용량이 +3 증가합니다.';
assert.throws(() => buildArmor(snapshot, namu, broken), /numbers differ/); checks++;
const short = structuredClone(korean);
short.passives['Med-Kit'].effects.pop();
assert.throws(() => buildArmor(snapshot, namu, short), /Korean effect lines/); checks++;
const renamed = structuredClone(korean);
renamed.passives['Scout'].name = '없는 이름';
assert.throws(() => buildArmor(snapshot, namu, renamed), /not a Namu Wiki heading/); checks++;
const extra = structuredClone(korean);
extra.passives['Made Up'] = { name: null, effects: [] };
assert.throws(() => buildArmor(snapshot, namu, extra), /without a wiki page/); checks++;
const reversed = { ...snapshot, armors: Object.fromEntries(Object.entries(snapshot.armors).reverse()), passives: Object.fromEntries(Object.entries(snapshot.passives).reverse()) };
const again = buildArmor(reversed, namu, korean);
eq([again.armors.map(a => a.id), again.passives.map(p => p.id)], [armors.map(a => a.id), armorPassives.map(p => p.id)], 'snapshot order does not matter');

// Generated output is current, deterministic and LF only.
const first = await generate(), second = await generate();
const onDisk = await readFile(new URL('dist/data/armor.js', root), 'utf8');
ok(first.text === second.text, 'build is deterministic');
ok(first.text === onDisk, 'dist/data/armor.js is up to date (run node scripts/build-armor.mjs)');
ok(!onDisk.includes('\r'), 'LF line endings');

// --- English ----------------------------------------------------------------------------------
for (const item of [...armors, ...armorPassives, ...armorPassives.flatMap(p => p.effects), ...armors.map(a => a.source).filter(s => s.name)]) {
  if (/[가-힣]/.test(item.name)) eq(english[item.name], item.en, `English for ${item.name}`);
}
for (const weight of armorWeights) ok(english[weight.name] && !/[가-힣]/.test(english[weight.name]), `English for ${weight.name}`);

// --- Images -----------------------------------------------------------------------------------
const used = new Set([...armors.map(a => a.image), ...armorPassives.map(p => p.icon)].filter(Boolean));
for (const file of used) ok(Object.hasOwn(armorImages, file) !== armorImagesMissing.includes(file), `${file}: mapped or listed as missing (run python scripts/tools/fetch-armor-images.py)`);
const files = new Set(await readdir(new URL('dist/assets/armor/', root)));
eq(new Set(Object.values(armorImages).map(image => image.src.replace('./assets/armor/', ''))), files, 'every file in assets/armor is referenced and exists');
let bytes = 0;
for (const [file, image] of Object.entries(armorImages)) {
  ok(used.has(file), `${file}: used by an armor or passive`);
  ok(/^\.\/assets\/armor\/[a-z0-9-]+\.(?:webp|svg)$/.test(image.src), `${file}: local path`);
  const data = await readFile(new URL(`dist/${image.src.slice(2)}`, root));
  bytes += data.length;
  eq(createHash('sha256').update(data).digest('hex'), image.sha256, `${file}: file matches its record`);
  if (image.src.endsWith('.svg')) {
    eq(validateSvg(data, image), { width: image.width, height: image.height }, `${file}: passive SVG`);
    eq(createHash('sha1').update(data).digest('hex'), image.sha1, `${file}: original SVG matches the wiki SHA-1`);
  } else {
    ok(data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP', `${file}: WebP`);
    ok(image.width <= 180 && image.height <= 360, `${file}: fits the 180×360 box`);
  }
  eq(decodeURIComponent(new URL(image.source).pathname), `/wiki/File:${file.replaceAll(' ', '_')}`, `${file}: source is the wiki file`);
}
ok(bytes <= 4_000_000, `armor images total ${bytes} bytes (budget 4,000,000)`);
ok(!(await readFile(new URL('dist/data/armor-images.js', root), 'utf8')).includes('\r'), 'image mapping uses LF');

// --- Route ------------------------------------------------------------------------------------
eq(parseRoute('#/gear?tab=armor&w=heavy'), { view: 'gear', id: null, query: { tab: 'armor', w: 'heavy' } }, 'armor tab route');

console.log(`PASS armor: ${checks} checks (${armors.length} armors, ${armorPassives.length} passives, ${Object.keys(armorImages).length} images, ${armorImagesMissing.length} missing).`);
