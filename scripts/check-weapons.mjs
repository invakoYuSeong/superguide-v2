import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { weapons, weaponsSource } from '../db/weapons.js';
import { parseInfobox, plainWiki, seconds, chargeDamage, reloadTimes, koreanMatches, manualKoreanNames, repairReferences } from './build-weapons.mjs';
import { extractHeadings, compactKoreanPage, matchKoreanNames, normalizeCode } from './fetch-weapons-source.mjs';
import { infoboxExtras, infoboxDisagreements } from './weapon-infobox.mjs';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const source = await read('db/source/weapons_data.json');
const categorySource = await read('db/source/wiki_categories.json');
const pageSource = await read('db/source/wiki_pages.json');
const koreanSource = await read('db/source/korean_names.json');
const data = source.data;
repairReferences(data);   // same reference repairs as the generator (see build-weapons.mjs)
// Report all drift before asserting, so one failure never hides later weapons.
let disagreementCount = 0, unrecordedCount = 0;
for (const weapon of weapons) {
  const disagreements = infoboxDisagreements(weapon, parseInfobox(pageSource.pages[weapon.en].wikitext), data);
  for (const conflict of disagreements) {
    const recorded = weapon.infoboxConflicts.some(c => JSON.stringify(c) === JSON.stringify(conflict));
    disagreementCount++;
    if (!recorded) unrecordedCount++;
    console.log(`Infobox ${recorded ? 'RECORDED' : 'NEW'}: ${weapon.en} | ${conflict.field} | DB=${JSON.stringify(conflict.db)} | infobox=${JSON.stringify(conflict.infobox)} | raw=${JSON.stringify(conflict.raw)}`);
  }
  for (const recorded of weapon.infoboxConflicts) assert(disagreements.some(c => JSON.stringify(c) === JSON.stringify(recorded)), `${weapon.en}: stale conflict record`);
}
console.log(`Infobox cross-check: 107 pages; ${disagreementCount} disagreements; ${unrecordedCount} unrecorded.`);
assert.equal(unrecordedCount, 0, 'Unrecorded infobox drift; inspect the local sources and review each conflict.');
const categories = categorySource.categories;
const roster = { primary: 'Primary Weapons', secondary: 'Secondary Weapons', throwable: 'Throwables' };
const typeNames = ['Assault Rifles', 'Marksman Rifles', 'Shotguns', 'Submachine Guns', 'Energy-Based', 'Pistols', 'Melee', 'Special Secondaries', 'Standard Throwables', 'Special Throwables'];
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalize = value => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const numericStats = ['direct', 'durable', 'ap', 'splash', 'splashDurable', 'splashAp', 'radius', 'innerRadius', 'pellets', 'shrapnelCount', 'demolition', 'stun', 'push'];
const handling = ['magazine', 'spareMags', 'rpm', 'ergonomics', 'fuse', 'reload', 'reloadTactical', 'spareRounds', 'beamFireRate', 'beams', 'barrels', 'throwableCapacity', 'throwableStart'];
const perHit = [...numericStats, 'apAll', 'splashApAll', 'delivery', 'element', 'statuses', 'splashElement', 'splashStatuses', 'damageKind', 'unit'];
const count = (items, field) => Object.fromEntries([...new Set(items.map(item => item[field] ?? 'null'))].sort().map(value => [value, items.filter(item => (item[field] ?? 'null') === value).length]));
const finite = (value, path) => assert(value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0, path);
function allNumbers(value, path) {
  if (typeof value === 'number') finite(value, path);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) allNumbers(child, `${path}.${key}`);
}
function checkStats(item, path) {
  for (const field of perHit) assert(Object.hasOwn(item, field), `${path}.${field} missing`);
  for (const field of numericStats) finite(item[field], `${path}.${field}`);
  for (const field of ['ap', 'splashAp']) assert(item[field] === null || item[field] <= 10, `${path}.${field}`);
  for (const field of ['apAll', 'splashApAll']) {
    if (item[field] === null) continue;
    assert(Array.isArray(item[field]) && item[field].length === 4, `${path}.${field}`);
    for (const value of item[field]) { finite(value, `${path}.${field}`); assert(value === null || value <= 10); }
  }
  if (item.innerRadius !== null && item.radius !== null) assert(item.innerRadius <= item.radius, `${path}: radii`);
  for (const field of ['statuses', 'splashStatuses']) assert(Array.isArray(item[field]) && item[field].every(value => typeof value === 'string'));
  assert([null, 'projectile', 'explosion', 'beam', 'arc', 'spray', 'melee', 'damage', 'weapons', 'status'].includes(item.delivery), `${path}: delivery`);
}

// Independently follow the raw foreign keys, guarding against swapped durable/AP/radius fields.
function checkProjection(item, attack, type) {
  const node = data[attack?.type]?.[attack?.name];
  const direct = attack?.type === 'explosion' ? undefined : attack?.type === 'damage' ? node : data.damage[node?.damage_id];
  const explosion = attack?.type === 'explosion' ? node : data.explosion[node?.explode_on_impact_id];
  const splash = data.damage[explosion?.damage_id];
  const effect = direct ?? splash;
  const expected = {
    direct: direct?.dmg, durable: direct?.dmg2, ap: direct?.ap1,
    splash: splash?.dmg, splashDurable: splash?.dmg2, splashAp: splash?.ap1,
    radius: explosion?.r2, innerRadius: explosion?.r1, pellets: node?.pellets, shrapnelCount: explosion?.shrapnel_count,
    demolition: effect?.demo, stun: effect?.stun, push: effect?.push,
  };
  for (const [field, value] of Object.entries(expected)) assert.equal(item[field], value ?? null, `${item.id}.${field}: source mismatch`);
  assert.equal(item.delivery, attack?.type === 'damage' && type === 'melee' ? 'melee' : attack?.type ?? null);
  assert.deepEqual(item.statuses, effect?.statuses ?? []);
  assert.deepEqual(item.splashStatuses, splash?.statuses ?? []);
  assert.equal(item.element, effect?.element_name && effect.element_name !== 'none' ? effect.element_name : null);
  assert.equal(item.splashElement, splash?.element_name && splash.element_name !== 'none' ? splash.element_name : null);
  for (const [field, damage] of [['apAll', direct], ['splashApAll', splash]]) {
    const values = [1, 2, 3, 4].map(index => damage?.[`ap${index}`] ?? null);
    assert.deepEqual(item[field], damage && new Set(values).size > 1 ? values : null);
  }
}

assert.equal(weapons.length, 107);
// Real-snapshot regression expectations, independent of the parser's own projection.
const byCode = code => weapons.find(w => w.code === code);
for (const [code, type] of Object.entries({ 'CB-9': 'explosives', 'GL-15': 'explosives', 'JAR-5': 'special', 'R-36': 'explosives', 'VG-70': 'special', 'FLAM-66': 'special' })) assert.equal(byCode(code).type, type);
const fuseExpected = { 'G-10': 2.9, 'G-109': 2.9, 'G-12': 3.5, 'G-123': 2.9, 'G-13': null, 'G-142': 2.9, 'G-16': null, 'G-23': 1.8, 'G-3': 2.4, 'G-31': 3, 'G-4': 2.9, 'G-48': null, 'G-50': null, 'G-6': 2.4, 'G-60': null, 'G-7': 2.4, 'G-8': null, 'G-89': null, 'G/40-K': null, 'G/SH-39': 0, 'K-2': null, 'TED-63': null, 'TM-1': null };
assert.equal(Object.keys(fuseExpected).length, 23);
for (const [code, value] of Object.entries(fuseExpected)) {
  const weapon = byCode(code);
  assert.equal(weapon.fuse, value, `${code}: real fuse regression`);
  if (value === null) assert(weapon.notes.some(n => n.includes(`fuse=${parseInfobox(pageSource.pages[weapon.en].wikitext).fuse}`)));
}
assert.deepEqual(byCode('PLAS-101').variants.filter(v => v.id.startsWith('wiki-')).map(v => [v.chargeState, v.direct, v.splash]), [['uncharged', 100, 75], ['charged', 200, 300]]);
for (const code of ['PLAS-39', 'PLAS-15']) {
  const weapon = byCode(code);
  assert.equal(weapon.variants.filter(v => v.id.startsWith('wiki-')).length, 0);
  assert(weapon.notes.some(n => n.startsWith('인포박스 충전 피해 공백:') && n.includes(parseInfobox(pageSource.pages[weapon.en].wikitext).damage)));
}
for (const [code, reload, tactical] of [['AR-2', 3, 2], ['AR-23A', 2.5, null], ['AR-32', 3, 1.85], ['M90A', 3.6, null], ['GL-15', 2.75, null], ['AR/GL-21', 3.33, 1.95], ['SMG/FLAM-34', 2.8, 1.73], ['R-36', 4.67, 2.75]]) {
  assert.equal(byCode(code).reload, reload, `${code}: reload regression`);
  assert.equal(byCode(code).reloadTactical, tactical, `${code}: tactical reload regression`);
}
assert.equal(byCode('AR/GL-21').reloadDetails.find(d => d.field === 'reload_time').values[1].seconds, 2.5);
assert.equal(byCode('SMG/FLAM-34').reloadDetails.find(d => d.field === 'reload_time').values[1].seconds, 2.3);
assert.equal(byCode('AR/GL-21').name, '원-투');
assert.equal(byCode('MA5C').name, '어썰트 라이플');
assert.equal(byCode('SMG/FLAM-34').name, '스토커');
assert.deepEqual(koreanMatches.unmatchedRoster.map(w => w.code).sort(), []);
assert.equal(byCode('AR-32').name, '퍼시파이어');
assert.equal(byCode('CQC-73').name, '참호 도구');
assert.equal(byCode('CQC-73').nameSource.matchedCode, 'CQC-72');
assert.equal(byCode('ARC-12').rpm, 45);
assert.equal(byCode('LAS-13').rpm, 300);
assert.deepEqual(byCode('VG-70').rpmModes, [300, 550, 750]);
assert.deepEqual(byCode('AR-61').rpmModes, [600, 850]);
assert.equal(byCode('GP-20').spareRounds, 1);
assert.equal(byCode('P-33').spareRounds, 3);
assert.equal(byCode('P-34').spareRounds, 2);
for (const [code, rate] of [['CQC-2', 150], ['CQC-42', 72], ['CQC-5', 100], ['CQC-73', 150]]) assert.equal(byCode(code).swingsPerMinute, rate);
for (const [code, rate] of [['G-10', 100], ['G-123', 150], ['FLAM-66', 150], ['P-72', 150], ['SMG/FLAM-34', 150], ['R-4', 100], ['SG-225IE', 100], ['G-142', 20], ['G-13', 100], ['G-4', 25], ['LAS-5', 100], ['LAS-7', 100]]) assert.equal(byCode(code).dot.perSecond, rate);
assert.equal(byCode('G-123').dot.duration, 6.5);
for (const [code, seconds, shots] of [['LAS-12', 4, 53], ['LAS-16', 8.4, 106], ['LAS-17', 15, 175], ['LAS-5', 8, null], ['LAS-7', 6.67, null], ['LAS-13', 2, 10], ['LAS-58', null, null]]) {
  assert.equal(byCode(code).heatCapacity.seconds, seconds);
  assert.equal(byCode(code).heatCapacity.shots, shots);
}
// Mutations exercise drift detection independently of the reviewed snapshot.
for (const [code, key, raw, field] of [['AR-23', 'damage', '{{Damage|Ballistic|999}}', 'damage'], ['AR-23', 'penetration', '{{Armor|9|AP}}', 'penetration'], ['AR-23', 'capacity', '999', 'magazine'], ['G-12', 'capacity', '999', 'throwableCapacity'], ['AR-23', 'fire_rate', '999 rpm', 'rpm'], ['AR-23', 'spare_mags', '999', 'spareMags'], ['P-4', 'spare_rounds', '999', 'spareRounds'], ['G-12', 'radius', '999m', 'radius'], ['LAS-5', 'damage', '{{Damage|Fire|999 DPS}}', 'dot'], ['LAS-12', 'capacity', '99s (999)', 'heatCapacity']]) {
  const w = byCode(code), box = { ...parseInfobox(pageSource.pages[w.en].wikitext), [key]: raw };
  assert(infoboxDisagreements(w, box, data).some(c => c.field === field && !w.infoboxConflicts.some(known => JSON.stringify(known) === JSON.stringify(c))), `${code}.${key}: new drift must fail`);
}
for (const code of ['LAS-13', 'SG-20', 'ARC-12', 'P-11', 'G-3', 'G-89', 'G/SH-39']) {
  const w = byCode(code);
  assert.deepEqual(infoboxDisagreements(w, parseInfobox(pageSource.pages[w.en].wikitext), data), [], `${code}: representation is not drift`);
}
assert.deepEqual(infoboxExtras({ damage: '{{Damage|Fire|unknown DPS}}', capacity: 'unknown' }, { roundType: 'heat' }).dot, { element: 'fire', perSecond: null, duration: null, raw: '{{Damage|Fire|unknown DPS}}' });
for (const page of koreanSource.pages) {
  assert.deepEqual(Object.keys(page).sort(), ['headings', 'modifiedAt', 'retrievedAt', 'source', 'status']);
  assert.deepEqual(compactKoreanPage(page), page);
  assert(page.headings.every(h => !/<[^>]*>|&#\d+;|\[편집\]|^\d+\./.test(h)));
}
// Synthetic parser cases are validation only, never database sources.
for (const template of ['Weapon', 'Infobox_Weapon', 'Infobox Weapon', 'Infobox Throwable']) {
  for (const field of ['|weapon_type=Explosives', '| weapon_type = Explosives', '|   weapon_type   =   Explosives']) assert.equal(parseInfobox(`{{${template}\n${field}\n}}`).weapon_type, 'Explosives');
}
assert.deepEqual(extractHeadings('<h3>2.1. <a>STA-52</a> 어썰트 Mk.2&#91;편집&#93;</h3><h2>3. A &amp; B &#x5b;편집&#x5d;</h2>'), ['STA-52 어썰트 Mk.2', 'A & B']);
const testPage = headings => [{ source: 'fixture', status: 200, retrievedAt: 'fixture', modifiedAt: null, headings }];
assert.equal(matchKoreanNames(testPage(['STA - 52 어썰트 Mk.2']), ['StA-52 Assault Rifle']).names['StA-52'].name, '어썰트 Mk.2');
assert.equal(Object.keys(matchKoreanNames(testPage(['STA-52 이름', 'StA-52 이름']), ['StA-52 Assault Rifle']).names).length, 0);
assert.equal(Object.keys(matchKoreanNames(testPage(['STA-52 이름']), ['StA-52 Assault Rifle', 'STA-52 Other']).names).length, 0);
assert.equal(Object.keys(matchKoreanNames(testPage(['AR-23P 이름']), ['AR-23 Liberator']).names).length, 0);
assert.equal(reloadTimes({ reload_time: '2.5s-3s' }).reload, null);
assert.deepEqual(parseInfobox('{{Infobox Weapon\n|weapon_type=[[Weapons|Explosives]]\n|damage={{value|100}}\n|fuse=2.4s<!--x-->\n}}'), { weapon_type: '[[Weapons|Explosives]]', damage: '{{value|100}}', fuse: '2.4s' });
assert.equal(seconds('2.4s'), 2.4);
assert.equal(seconds('0 seconds'), 0);
for (const text of ['Impact', '2–3s', '-1s', '2s / 3s', '{{time|2}}', '', undefined]) assert.equal(seconds(text), null);
assert.deepEqual(chargeDamage('100 (Uncharged Bolt)<br>75 (Explosion)<br>200 (Charged Bolt)<br>300 (Explosion)').map(({ state, direct, splash }) => ({ state, direct, splash })), [{ state: 'uncharged', direct: 100, splash: 75 }, { state: 'charged', direct: 200, splash: 300 }]);
assert.deepEqual(chargeDamage('100 bolt + 75 explosion'), []);
assert.deepEqual(chargeDamage('100 (Bolt, uncharged)<br>75 (Explosion, uncharged)<br>200 (Bolt, charged)<br>300 (Explosion, charged)').map(v => [v.state, v.direct, v.splash]), [['uncharged', 100, 75], ['charged', 200, 300]]);
assert.deepEqual(chargeDamage('Uncharged: 100 bolt + 75 explosion; Charged: 200 bolt + 300 explosion').map(v => [v.state, v.direct, v.splash]), [['uncharged', 100, 75], ['charged', 200, 300]]);
assert.deepEqual(chargeDamage('Charged: 100–200 bolt'), []);
assert.throws(() => chargeDamage('Charged: 100 bolt<br>200 bolt'), /Conflicting/);
assert.deepEqual(Object.keys(pageSource.pages).sort(), weapons.map(w => w.en).sort());
assert.equal(new Set(weapons.map(w => w.id)).size, 107);
assert.deepEqual(count(weapons, 'category'), { primary: 57, secondary: 26, throwable: 24 });
assert.match(weaponsSource.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(weaponsSource.retrievedAt, source.retrievedAt.slice(0, 10));
assert.equal(weaponsSource.attacks, source.source);
assert.equal(weaponsSource.attacksRevision, source.revision);
assert.equal(weaponsSource.categories, categorySource.source);
allNumbers(weaponsSource, 'weaponsSource');
for (const [category, name] of Object.entries(roster)) assert.deepEqual(weapons.filter(w => w.category === category).map(w => w.en).sort(), categories[name].map(m => m.title).sort());

for (const weapon of weapons) {
  assert.match(weapon.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert(Object.hasOwn(roster, weapon.category));
  assert(weapon.type !== null && /^[a-z]+(?:-[a-z]+)*$/.test(weapon.type));
  const page = pageSource.pages[weapon.en];
  if (page.wikitext === null) { assert(page.error); assert.equal(page.revision, null); }
  else { assert(typeof page.wikitext === 'string' && page.wikitext.length > 0); assert(Number.isInteger(page.revision) && page.revision > 0); assert(page.retrievedAt); }
  const box = parseInfobox(page.wikitext);
  const subtypes = typeNames.filter(name => categories[name].some(m => m.title === weapon.en));
  const boxType = plainWiki(box.weapon_type);
  assert.equal(weapon.type, boxType ? slug(boxType) : subtypes.length ? slug(subtypes[0]) : null);
  if (subtypes.length && boxType && slug(subtypes[0]) !== weapon.type) assert(weapon.notes.some(n => n.startsWith('유형 불일치:')));
  assert(typeof weapon.en === 'string' && weapon.en.length > 0);
  assert.equal(weapon.source, `https://helldivers.wiki.gg/wiki/${encodeURIComponent(weapon.en.replaceAll(' ', '_'))}`);
  assert.equal(weapon.sourceRevision, categories[roster[weapon.category]].find(m => m.title === weapon.en).revision);
  assert(weapon.name === null || typeof weapon.name === 'string' && weapon.name.trim().length > 0);
  const korean = koreanMatches.names[weapon.code];
  const manual = korean ? null : manualKoreanNames[weapon.code];
  assert.equal(weapon.name, korean?.name ?? manual?.name ?? null);
  if (manual) assert.deepEqual(weapon.nameSource, { file: 'scripts/build-weapons.mjs', code: weapon.code, manual: true, reason: manual.reason });
  else if (weapon.name !== null) {
    assert.deepEqual(weapon.nameSource, { file: 'db/source/korean_names.json', code: weapon.code, ...korean });
    assert(normalizeCode(korean.evidence).startsWith(normalizeCode(korean.matchedCode ?? weapon.code)) && korean.evidence.includes(weapon.name));
    assert(koreanSource.pages.some(p => p.source === korean.source && p.retrievedAt === korean.retrievedAt && p.status === 200 && p.headings.includes(korean.evidence)));
  } else assert.equal(weapon.nameSource, null);
  const reloading = reloadTimes(box);
  assert.deepEqual(weapon.reloadDetails, reloading.details);
  for (const [field, sourceField, value] of [['fuse', 'fuse', weapon.category === 'throwable' ? seconds(box.fuse) : null], ['reload', reloading.reload?.field, reloading.reload?.value ?? null], ['reloadTactical', 'tac_reload_time', reloading.tactical?.value ?? null]]) {
    assert.equal(weapon[field], value, `${weapon.id}.${field}: infobox source`);
    if (weapon[field] !== null) assert.deepEqual(weapon.fieldSources[field], { file: 'db/source/wiki_pages.json', title: weapon.en, field: `infobox.${sourceField}`, revision: page.revision, source: page.source, retrievedAt: page.retrievedAt });
    else assert.equal(weapon.fieldSources[field], null);
  }
  if (boxType) assert.deepEqual(weapon.fieldSources.type, { file: 'db/source/wiki_pages.json', title: weapon.en, field: 'infobox.weapon_type', revision: page.revision, source: page.source, retrievedAt: page.retrievedAt });
  else if (subtypes.length) assert.deepEqual(weapon.fieldSources.type, { file: 'db/source/wiki_categories.json', category: subtypes[0] });
  else assert.equal(weapon.fieldSources.type, null);
  const designation = weapon.en.match(/^(\S*\d\S*)\s+(.+)$/);
  assert.equal(weapon.code, designation?.[1] ?? null);
  const baseId = slug(designation?.[2] ?? weapon.en);
  assert(weapon.id === baseId || weapon.id.startsWith(`${baseId}-`));
  assert(typeof weapon.dataKey === 'string' && Object.hasOwn(data.weapons, weapon.dataKey));
  if (weapon.en === 'CQC-73 Entrenchment Tool') {
    assert.equal(weapon.dataKey, 'CQC-72 ENTRENCHMENT TOOL');
    assert(weapon.notes.some(note => note.includes('CQC-73') && note.includes('CQC-72')));
  } else assert.equal(normalize(weapon.en), normalize(weapon.dataKey));
  const raw = data.weapons[weapon.dataKey];
  const extras = infoboxExtras(box, weapon);
  assert.deepEqual(weapon.infoboxRaw, Object.fromEntries(['damage', 'penetration', 'capacity', 'fire_rate', 'spare_mags', 'spare_rounds', 'radius'].map(field => [field, box[field] ?? null])));
  for (const [field, sourceField, present] of [['dot', 'damage', extras.dot.raw !== null], ['heatCapacity', 'capacity', extras.heatCapacity.raw !== null], ['swingsPerMinute', 'fire_rate', extras.swingsPerMinute !== null], ['rpmModes', 'fire_rate', extras.rpmModes.length > 0], ['rpm', 'fire_rate', raw.rpm == null && extras.rpm !== null], ['spareRounds', 'spare_rounds', raw.rounds == null && extras.spareRounds !== null]]) {
    assert.deepEqual(weapon.fieldSources[field], present ? { file: 'db/source/wiki_pages.json', title: weapon.en, field: `infobox.${sourceField}`, revision: page.revision, source: page.source, retrievedAt: page.retrievedAt } : null);
  }
  assert.deepEqual(weapon.attacks, raw.attacks ?? []);
  assert.deepEqual(weapon.charge, raw.charge ?? null);
  assert.deepEqual(weapon.fireModes, raw.fire_modes ?? []);
  for (const [field, sourceField] of Object.entries({ magazine: 'cap', spareMags: 'mags', rpm: 'rpm', ergonomics: 'ergonomics', spareRounds: 'rounds', beamFireRate: 'beam_fire_rate', beams: 'beams', barrels: 'barrels', throwableCapacity: 'max', throwableStart: 'start' })) assert.equal(weapon[field], raw[sourceField] ?? (['rpm', 'spareRounds'].includes(field) ? extras[field] : null));
  assert(Array.isArray(weapon.notes) && weapon.notes.every(note => typeof note === 'string'));
  for (const field of handling) finite(weapon[field], `${weapon.id}.${field}`);
  allNumbers(weapon, weapon.id);
  checkStats(weapon, weapon.id);
  checkProjection(weapon, raw.attacks.find(a => a.level === 1) ?? raw.attacks[0], weapon.type);
  assert.equal(new Set(weapon.variants.map(v => v.id)).size, weapon.variants.length);
  const wikiVariants = weapon.variants.filter(v => v.id.startsWith('wiki-'));
  const expectedCharge = chargeDamage(box.damage);
  assert.equal(wikiVariants.length, expectedCharge.length);
  if ((raw.charge || /\bcharged\b/i.test(box.damage ?? '')) && wikiVariants.length !== 2) assert(weapon.notes.some(n => n.startsWith('인포박스 충전 피해 공백:')), `${weapon.id}: undocumented charge gap`);
  for (const variant of weapon.variants) {
    assert.match(variant.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert(typeof variant.name === 'string' && variant.name.length > 0);
    checkStats(variant, `${weapon.id}.${variant.id}`);
    if (variant.id.startsWith('wiki-')) {
      const expected = expectedCharge.find(v => v.state === variant.chargeState);
      assert(expected);
      assert.equal(variant.direct, expected.direct);
      assert.equal(variant.splash, expected.splash);
      assert.deepEqual(variant.evidence, expected.evidence);
      assert.equal(variant.attack, null);
      assert.deepEqual(variant.source, { file: 'db/source/wiki_pages.json', title: weapon.en, field: 'infobox.damage', revision: page.revision, source: page.source, retrievedAt: page.retrievedAt });
      for (const field of numericStats.filter(f => !['direct', 'splash'].includes(f))) assert.equal(variant[field], null);
      continue;
    }
    checkProjection(variant, variant.attack, weapon.type);
    const burst = variant.attack.type === 'projectile' ? data.explosion[variant.attack.parent] : null;
    if (burst?.shrapnel === variant.attack.name) {
      assert(variant.id.startsWith('shrapnel'), `${weapon.id}.${variant.id}: shrapnel label`);
      assert(variant.name.includes(`${burst.shrapnel_count}개`), `${weapon.id}.${variant.id}: shrapnel count`);
    }
  }
  for (const linked of weapon.linkedAttacks) assert.deepEqual(linked.attacks, data.weapons[linked.dataKey].attacks);
  const expanded = raw.attacks.flatMap(a => a.type === 'weapons' ? data.weapons[a.name].attacks : [a]);
  const impacts = new Set(expanded.map(a => data[a.type]?.[a.name]?.explode_on_impact_id).filter(Boolean));
  const modes = expanded.filter(a => a.type !== 'status' && !(a.type === 'explosion' && impacts.has(a.name)));
  const attackVariants = weapon.variants.filter(v => !v.id.startsWith('charge-stage-') && !v.id.startsWith('wiki-'));
  assert.deepEqual(attackVariants.map(v => v.attack), modes.length > 1 || raw.charge ? modes : []);
  if (raw.charge) {
    const stages = weapon.variants.filter(v => v.id.startsWith('charge-stage-'));
    assert.equal(stages.length, raw.charge.charge.length);
    for (const [index, stage] of raw.charge.charge.entries()) {
      assert.equal(stages[index].attack.name, stage.proj);
      assert.equal(stages[index].chargeTime, stage.charge_time);
    }
  }
}

// Rebuild to stdout so checking never rewrites db/weapons.js.
const committed = await readFile(new URL('db/weapons.js', root), 'utf8');
for (let run = 1; run <= 2; run++) {
  const rebuilt = execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build-weapons.mjs', root)), '--stdout'], { cwd: fileURLToPath(root), encoding: 'utf8' });
  assert.equal(rebuilt, committed, `Build ${run}: db/weapons.js is stale; run node scripts/build-weapons.mjs`);
}
console.log('Validated 107 weapons; source projections and two byte-identical rebuilds passed.');
console.log(`Category counts: ${JSON.stringify(count(weapons, 'category'))}`);
console.log(`Type counts: ${JSON.stringify(count(weapons, 'type'))}`);
const nullCounts = (items, fields) => Object.fromEntries(fields.map(field => [field, items.filter(item => item[field] === null).length]));
console.log(`Null counts (weapons, all top-level fields): ${JSON.stringify(nullCounts(weapons, Object.keys(weapons[0])))}`);
const variants = weapons.flatMap(w => w.variants);
console.log(`Variants: ${variants.length}`);
console.log(`Null counts (variants, per-hit fields): ${JSON.stringify(nullCounts(variants, perHit))}`);
const list = predicate => weapons.filter(predicate).map(w => w.en).join('; ') || '(none)';
console.log(`Missing data keys: ${list(w => !w.dataKey)}`);
console.log(`Empty attacks: ${list(w => !w.attacks.length)}`);
console.log(`Missing damage links: ${list(w => w.notes.some(n => n.startsWith('피해 레코드 연결')))}`);
console.log(`No subtype: ${list(w => w.type === null)}`);
console.log(`Title/key mismatch: ${list(w => normalize(w.en) !== normalize(w.dataKey))}`);
console.log(`Charge interpretation gaps: ${list(w => w.charge !== null)}`);
console.log(`Unresolved attack references: ${list(w => w.notes.some(n => n.startsWith('공격 참조 미확인')))}`);
console.log(`Underbarrels: ${list(w => w.linkedAttacks.length > 0)}`);
console.log(`Multiple attack components/modes: ${list(w => w.variants.length > 0)}`);
console.log(`Beam/spray/arc units: ${list(w => [w, ...w.variants].some(v => ['beam', 'spray', 'arc'].includes(v.delivery)))}`);
console.log(`Uncertain damage-only units: ${list(w => [w, ...w.variants].some(v => v.delivery === 'damage'))}`);
console.log(`Gap fills: fuse ${weapons.filter(w => w.fuse !== null).length}/23; infobox type ${weapons.filter(w => w.fieldSources.type?.field === 'infobox.weapon_type').length}/103; names ${weapons.filter(w => w.name !== null).length}/103; reload ${weapons.filter(w => w.reload !== null).length}/103; tactical reload ${weapons.filter(w => w.reloadTactical !== null).length}/107`);
console.log(`Unmatched Korean roster: ${koreanMatches.unmatchedRoster.map(w => `${w.title} (${w.reason})`).join('; ') || '(none)'}`);
for (const page of koreanSource.pages) console.log(`Unmapped Namu headings [${decodeURIComponent(page.source).split('/w/')[1]}]: ${koreanMatches.unmappedHeadings.filter(h => h.source === page.source).map(h => h.heading).join('; ') || '(none)'}`);
console.log(`Infobox charged variants: ${list(w => w.variants.some(v => v.id.startsWith('wiki-')))}`);
console.log(`Unavailable page sources: ${Object.values(pageSource.pages).filter(p => p.wikitext === null).length}/107`);
console.log(`Infobox additions: ${JSON.stringify(Object.fromEntries(Object.entries({ infoboxConflicts: w => w.infoboxConflicts.length, dot: w => w.dot.raw !== null, heatCapacity: w => w.heatCapacity.raw !== null, swingsPerMinute: w => w.swingsPerMinute !== null, rpmModes: w => w.rpmModes.length, filledRpm: w => w.fieldSources.rpm !== null, filledSpareRounds: w => w.fieldSources.spareRounds !== null }).map(([field, predicate]) => [field, weapons.filter(predicate).length])))}`);
console.log(`Type disagreements: ${list(w => w.notes.some(n => n.startsWith('유형 불일치:')))}`);
