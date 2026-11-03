// Offline build of the armor guide data from local snapshots only (no network, no clock).
//   db/source/wiki_armor.json            ← scripts/fetch-armor.mjs (Helldivers Wiki wikitext)
//   db/source/namu_armor.json            ← scripts/fetch-armor.mjs (Namu Wiki headings: Korean armor and passive names)
//   db/source/armor_passive_korean.json  ← Korean passive names and effect lines (in-game text)
// Writes dist/data/armor.js. Usage: node scripts/build-armor.mjs [--stdout]
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArmorPage, parsePassivePage, numbersOf, armorId, WEIGHTS, UNCONFIRMED } from './armor-parse.mjs';
import { matchKoreanNames } from './fetch-weapons-source.mjs';
import { warbondId, baseTitle } from './build-warbonds.mjs';
import { warbonds } from '../dist/data/warbonds.js';

const root = new URL('../', import.meta.url);
const NAMU_WEIGHT_PAGES = /\/%EB%B0%A9%EC%96%B4%EA%B5%AC\/(%EA%B2%BD%EB%9F%89|%EC%9D%BC%EB%B0%98|%EC%A4%91%EB%9F%89)$/; // 방어구/경량|일반|중량
// Non-warbond sources on the wiki infobox → names shown on the site.
export const SOURCE_NAMES = {
  Superstore: { name: '슈퍼 스토어', en: 'Superstore' },
  'Starter Equipment': { name: '기본 지급', en: 'Starter equipment' },
  'Pre-Order Bonus': { name: '사전 예약 보너스', en: 'Pre-order bonus' },
  'Super Citizen Edition': { name: '슈퍼 시민 에디션', en: 'Super Citizen Edition' },
  'Downloadable Content': { name: '다운로드 콘텐츠', en: 'Downloadable content' },
  'Escalation of Freedom': { name: 'Escalation of Freedom 업데이트', en: 'Escalation of Freedom update' },
  'Liberty Day': { name: 'Liberty Day 이벤트', en: 'Liberty Day event' },
  'Anniversary Gift': { name: '1주년 기념 선물', en: 'Anniversary gift' },
};
const campaignName = key => ({ name: `캠페인 보상 (${key})`, en: `Campaign reward (${key})` });

// JSON with one line per leaf record (an object/array holding no list of records).
function format(value, indent = '') {
  const records = v => Array.isArray(v) && v.some(x => x && typeof x === 'object');
  const inner = indent + '  ';
  if (Array.isArray(value) && records(value)) return `[\n${value.map(x => inner + format(x, inner)).join(',\n')}\n${indent}]`;
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).some(records)) {
    return `{\n${Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${format(v, inner)}`).join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

export function buildArmor(snapshot, namu, korean, warbondList = warbonds) {
  const discrepancies = [];
  const namuHeadings = new Set(namu.pages.flatMap(page => page.headings));

  // --- Passives ---------------------------------------------------------------------
  const passiveIds = new Map();
  const passives = Object.entries(snapshot.passives).map(([title, page]) => {
    const parsed = parsePassivePage(page.wikitext, title);
    const ko = korean.passives[title];
    if (!ko) throw new Error(`No Korean entry for passive "${title}" (db/source/armor_passive_korean.json)`);
    if (ko.name != null && !namuHeadings.has(ko.name) && !namuHeadings.has(ko.name.split(', ')[0])) throw new Error(`Korean passive name "${ko.name}" (${title}) is not a Namu Wiki heading in db/source/namu_armor.json`);
    if (ko.effects.length !== parsed.effects.length) throw new Error(`${title}: ${ko.effects.length} Korean effect lines for ${parsed.effects.length} wiki lines`);
    const effects = parsed.effects.map((en, i) => {
      if (numbersOf(ko.effects[i]).join() !== numbersOf(en).join()) throw new Error(`${title}: numbers differ between "${ko.effects[i]}" and wiki "${en}"`);
      return { name: ko.effects[i], en };
    });
    const id = armorId(title);
    passiveIds.set(title, id);
    return {
      id, name: ko.name ?? title, en: title, nameStatus: ko.name == null ? UNCONFIRMED : 'confirmed',
      order: parsed.order, icon: parsed.icon, effects,
      source: page.source, revision: page.revision, revisionTimestamp: page.revisionTimestamp,
    };
  });
  const extra = Object.keys(korean.passives).filter(title => !snapshot.passives[title]);
  if (extra.length) throw new Error(`Korean passive entries without a wiki page: ${extra.join(', ')}`);
  passives.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.en.localeCompare(b.en));

  // Every Korean line maps to exactly one English line (the dictionary is keyed by Korean).
  const englishOf = new Map();
  for (const passive of passives) for (const line of [{ name: passive.name, en: passive.en }, ...passive.effects]) {
    if (englishOf.has(line.name) && englishOf.get(line.name) !== line.en) throw new Error(`Korean "${line.name}" stands for both "${englishOf.get(line.name)}" and "${line.en}"`);
    englishOf.set(line.name, line.en);
  }

  // --- Body armor ---------------------------------------------------------------------
  const titles = Object.keys(snapshot.armors);
  const namuNames = matchKoreanNames(namu.pages.filter(page => NAMU_WEIGHT_PAGES.test(page.source)), titles).names;
  const warbondByTitle = new Map(warbondList.map(w => [w.id, w]));
  const armors = titles.map(title => {
    const page = snapshot.armors[title];
    const parsed = parseArmorPage(page.wikitext, title);
    const code = title.match(/^(\S*\d\S*)\s/)?.[1] ?? null;
    // Namu keeps a few names in Latin letters ('SA-8 RAM'); those match the English name itself.
    const latin = code && !namuNames[code] && namu.pages.flatMap(p => p.headings).find(h => h.toLowerCase() === title.toLowerCase());
    const koName = code && (namuNames[code]?.name ?? (latin ? latin.slice(code.length).trim() : null));
    const category = WEIGHTS.find(weight => snapshot.categories[weight].includes(title));
    if (!parsed.weight) throw new Error(`${title}: unknown armor type`);
    if (category !== parsed.weight) discrepancies.push({ armor: title, field: 'weight', infobox: parsed.weight, category, note: 'The infobox type (shown) differs from the wiki weight category.' });
    if (!passiveIds.has(parsed.passive)) throw new Error(`${title}: passive "${parsed.passive}" has no passive page`);
    for (const field of ['armorRating', 'speed', 'staminaRegen']) if (parsed[field] == null) discrepancies.push({ armor: title, field, note: `${UNCONFIRMED}: no number in the infobox` });

    let source;
    if (parsed.source.kind === 'warbond') {
      const id = warbondId(baseTitle(parsed.source.title));
      const warbond = warbondByTitle.get(id);
      if (!warbond) throw new Error(`${title}: warbond "${parsed.source.title}" is not in dist/data/warbonds.js`);
      // Cross-check against the warbond page board (dist/data/warbonds.js).
      // Board items may carry an ' Armor' suffix (Castellan's Creed).
      const listed = warbond.pages.flatMap(p => p.items.filter(item => item.kind === 'armor' && (item.name === title || item.name === `${title} Armor`)).map(item => ({ page: p.number, cost: item.cost })));
      if (listed.length !== 1) discrepancies.push({ armor: title, field: 'source', note: `listed ${listed.length} times on the ${warbond.en} page boards` });
      else {
        if (parsed.source.page != null && listed[0].page !== parsed.source.page) discrepancies.push({ armor: title, field: 'page', armorPage: parsed.source.page, warbondPage: listed[0].page });
        if (listed[0].cost != null && parsed.cost.unit === 'Medals' && listed[0].cost !== parsed.cost.amount) discrepancies.push({ armor: title, field: 'cost', armorPage: parsed.cost.amount, warbondPage: listed[0].cost });
      }
      source = { kind: 'warbond', warbondId: id, page: parsed.source.page ?? listed[0]?.page ?? null };
    } else if (parsed.source.kind === 'campaign') {
      source = { kind: 'campaign', ...campaignName(parsed.source.key) };
    } else {
      const known = SOURCE_NAMES[parsed.source.key];
      if (!known) throw new Error(`${title}: no Korean name for source "${parsed.source.key}" (SOURCE_NAMES in scripts/build-armor.mjs)`);
      source = { kind: parsed.source.key === 'Superstore' ? 'superstore' : 'other', ...known };
    }
    return {
      id: armorId(title), code, name: koName ? `${code} ${koName}` : title, en: title, nameStatus: koName ? 'confirmed' : UNCONFIRMED,
      weight: parsed.weight, armorRating: parsed.armorRating, speed: parsed.speed, staminaRegen: parsed.staminaRegen,
      passive: passiveIds.get(parsed.passive), source,
      cost: parsed.cost.amount != null ? { amount: parsed.cost.amount, unit: parsed.cost.unit } : null,
      costStatus: parsed.cost.amount != null ? 'confirmed' : parsed.cost.exclusive ? 'exclusive' : UNCONFIRMED,
      image: parsed.image,
      wiki: page.source, revision: page.revision, revisionTimestamp: page.revisionTimestamp,
    };
  });
  const ids = new Set();
  for (const item of [...passives, ...armors]) { if (ids.has(item.id)) throw new Error(`Duplicate armor id ${item.id}`); ids.add(item.id); }
  for (const armor of armors) if (englishOf.has(armor.name) && englishOf.get(armor.name) !== armor.en) throw new Error(`Armor name "${armor.name}" is also a passive line`);
  armors.sort((a, b) => WEIGHTS.indexOf(a.weight) - WEIGHTS.indexOf(b.weight) || a.en.localeCompare(b.en));
  const unnamed = armors.filter(armor => armor.nameStatus !== 'confirmed').map(armor => armor.en);
  return { passives, armors, discrepancies, unnamed };
}

export async function generate() {
  const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
  const snapshot = await read('db/source/wiki_armor.json');
  const namu = await read('db/source/namu_armor.json');
  const korean = await read('db/source/armor_passive_korean.json');
  const { passives, armors, discrepancies, unnamed } = buildArmor(snapshot, namu, korean);
  const exports = {
    armorCheckedAt: snapshot.retrievedAt,
    armorSource: {
      source: snapshot.source, site: 'https://helldivers.wiki.gg/', license: 'CC BY-NC-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', file: 'db/source/wiki_armor.json',
      koreanNamesFile: 'db/source/namu_armor.json', koreanPassivesFile: 'db/source/armor_passive_korean.json',
    },
    armorWeights: [{ id: 'light', name: '경량' }, { id: 'medium', name: '일반' }, { id: 'heavy', name: '중량' }],
    armorPassives: passives,
    armors,
    armorDiscrepancies: discrepancies,
  };
  const text = '// Generated by scripts/build-armor.mjs from local db/source/wiki_armor.json, db/source/namu_armor.json and db/source/armor_passive_korean.json. Do not edit by hand.\n'
    + Object.entries(exports).map(([name, value]) => `export const ${name} = ${format(value)};\n`).join('\n');
  return { text, passives, armors, discrepancies, unnamed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { text, passives, armors, discrepancies, unnamed } = await generate();
  if (process.argv.includes('--stdout')) process.stdout.write(text);
  else {
    await writeFile(new URL('dist/data/armor.js', root), text, 'utf8');
    console.log(`Generated dist/data/armor.js: ${armors.length} armors (${WEIGHTS.map(w => `${w} ${armors.filter(a => a.weight === w).length}`).join(', ')}), ${passives.length} passives.`);
    console.log(`No Korean name (English shown): ${[...unnamed, ...passives.filter(p => p.nameStatus !== 'confirmed').map(p => `${p.en} (passive)`)].join(', ') || 'none'}`);
    console.log(`Discrepancies ${discrepancies.length}: ${discrepancies.map(d => `${d.armor} ${d.field}${d.note ? ` (${d.note})` : ` ${JSON.stringify(d)}`}`).join('; ') || 'none'}`);
  }
}
