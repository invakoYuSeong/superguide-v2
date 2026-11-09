import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { weapons } from '../db/weapons.js';
import { personalWeapons, personalWeaponsCheckedAt, personalWeaponsSource } from '../dist/data/personal-weapons.js';
import { personalProfiles, personalUnsupported, personalGroups } from '../dist/core/personal-combat.js';
import { enemies, weaponProfiles } from '../dist/data/combat-data.js';
import { stratagems } from '../dist/core/catalog.js';
import { solveMatchup, withHitAssumption } from '../dist/core/combat.js';
import { compareAttacks, resolveAttack } from '../dist/core/compare.js';
import { encodeLoadout, decodeLoadout, loadoutFactions, loadoutCoverage, suggestFixes, loadoutView } from '../dist/core/loadout.js';
import { parseRoute, formatRoute } from '../dist/core/route.js';
import { parseInfobox } from './build-weapons.mjs';
import { buildPersonalProfiles } from './personal-profiles.mjs';
import { assumptionSummary, assumptionTag, assumptionText, unitOf, countText, aimText, attackStats, deliveryOf, routeNotes } from '../dist/core/explain.js';
import { fuseDetails } from './personal-display.mjs';
import { enemySize, isLargeEnemy, SIZE_NAMES } from '../dist/core/enemy-size.js';
import { enemySizes, enemySizeEvidence, unmappedEnemySizes, enemySizesCheckedAt } from '../dist/data/enemy-sizes.js';
import { buildEnemySizes } from './build-enemy-sizes.mjs';
import { solveAccumulation, noFatalPart } from '../dist/core/accumulate.js';

const root = new URL('../', import.meta.url);
let checked = 0;
const ok = (test, message) => { assert(test, message); checked++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checked++; };
const pages = JSON.parse(await readFile(new URL('db/source/wiki_pages.json', root), 'utf8')).pages;
const enemy = id => enemies.find(item => item.id === id);
const mode = id => personalProfiles[id].modes[0];
const head = (target, attack) => solveMatchup(enemy(target), attack).rows.find(row => row.target.id === 'head');

// Sequential transfers are additive; the legacy per-part solver stays intact.
const fleshmob = enemy('fleshmob');
eq(fleshmob.parts.map(part => part.count), [6, 2, 4, 2], 'explicit source instance counts');
for (const part of fleshmob.parts) eq(part.count, Number(part.sourcePart.match(/\((\d+)\)$/)[1]));
ok(noFatalPart(fleshmob), 'break-only anatomy has no fatal target');
eq(noFatalPart(enemy('hunter-hardened')), false);
eq(noFatalPart({ parts: [{ effect: 'armor', next: { effect: 'kill' } }] }), false, 'exposed fatal layer counts');
eq(noFatalPart({ parts: [{ effect: 'break', mainOnly: true }] }), false);
eq(noFatalPart(null), false);
const beforeAccumulation = JSON.stringify(fleshmob);
for (const [weaponId, expectedHits, expectedSteps] of [
  ['autocannon', 9, [
    ['head-chunk', 6, 1, 6, 3780], ['stomach-chunk', 2, 1, 2, 822], ['leg', 1, 1, 1, 411],
  ]],
  ['machine-gun', 54, [
    ['head-chunk', 6, 6, 36, 3924], ['stomach-chunk', 2, 7, 14, 882], ['leg', 1, 4, 4, 252],
  ]],
]) {
  const attack = weaponProfiles[weaponId].modes[0];
  // MG head = floor(90*.75+23*.25)=73, transfer=floor(73*1.5)=109;
  // six 400-HP heads: 36 hits/3924 main; stomach+legs: 63 main per hit.
  // AC head = floor(325*.75+260*.25)=308 direct + floor(150*.75)=112 blast;
  // (308+112)*1.5=630 main. Stomach/leg: 299+112=411 main.
  eq(solveMatchup(fleshmob, attack).best, null, 'legacy still has no fatal part route');
  const route = solveAccumulation(fleshmob, attack);
  eq(route.hits, expectedHits);
  eq(route.outcome, 'kill');
  eq(route.steps.map(s => [s.partId, s.instances, s.hitsPerInstance, s.hits, s.mainDamage]), expectedSteps, 'hand-computed sequential damage');
  eq(route.steps.reduce((sum, s) => sum + s.hits, 0), route.hits);
  const answer = compareAttacks(fleshmob, [{ weaponId }]).entries[0];
  eq([answer.status, answer.verified, answer.accumulated, answer.oneShot, answer.hits], ['route', true, true, false, expectedHits]);
  eq(answer.steps, route.steps);
  ok(answer.reason.includes('누적 경로'));
  eq(compareAttacks(fleshmob, [{ weaponId }], { partId: 'head-chunk' }).entries[0].accumulated, false, 'part selection cannot silently become a sequence');
  const row = loadoutCoverage({ stratagems: [weaponId] }, 'illuminate').rows.find(r => r.enemyId === 'fleshmob');
  eq([row.status, row.best.accumulated, row.best.hits, row.oneShot], ['route', true, expectedHits, false]);
  eq(loadoutView({ stratagems: [weaponId] }, 'illuminate', { limit: 0 }).rows.find(r => r.enemyId === 'fleshmob').best.steps, route.steps);
}
eq(JSON.stringify(fleshmob), beforeAccumulation, 'accumulation never mutates source anatomy');
const ordinaryEnemy = enemy('hunter-hardened');
const ordinaryMode = weaponProfiles['machine-gun'].modes[0];
eq(solveAccumulation(ordinaryEnemy, ordinaryMode), null, 'normal routes always take precedence');
eq(compareAttacks(ordinaryEnemy, [{ weaponId: 'machine-gun' }]).entries[0].route, solveMatchup(ordinaryEnemy, ordinaryMode).best, 'normal comparison route unchanged');

const sequenceEnemy = { main: { hp: 250, armor: 0, durability: 0, exdr: 0 }, parts: [
  { id: 'chunk', name: '덩어리', count: 2, hp: 100, armor: 0, durability: 0, exdr: 0, toMain: 100, overflowCap: false, effect: 'break' },
] };
const sequenceMode = { standard: 80, durable: 80, ap: 3, explosion: 0, explosionAp: 0 };
const changedSequence = (part = {}, main = {}) => ({ ...sequenceEnemy, main: { ...sequenceEnemy.main, ...main }, parts: [{ ...sequenceEnemy.parts[0], ...part }] });
eq(solveAccumulation(sequenceEnemy, sequenceMode).hits, 4, 'uncapped final-hit transfer includes overkill as in combat.js');
eq(solveAccumulation(changedSequence({ overflowCap: true }), sequenceMode), null, 'per-instance cap prevents invented transfer');
eq(solveAccumulation(changedSequence({ overflowCap: true, transferExtraHealth: 30 }), sequenceMode).hits, 4, 'explicit extra transfer allowance');
eq(solveAccumulation(changedSequence({ overflowCap: true, destroyMainDamage: 25 }), sequenceMode).hits, 4, 'destruction bonus applied once per instance');
eq(solveAccumulation(changedSequence({ overflowCap: true, count: 3, staticConstitution: 20 }), sequenceMode).hits, 5, 'fresh hp/cap pools and partial final instance');
eq(solveAccumulation(changedSequence({}, { hp: 300, constitution: 100 }), sequenceMode).outcome, 'bleed', 'main constitution follows legacy fatal semantics');
eq(solveAccumulation(changedSequence({ armor: 3, count: 3 }), sequenceMode).hits, 5, 'equal armor uses 65% damage');
eq(solveAccumulation(sequenceEnemy, { ...sequenceMode, durable: 0 }).hits, 4, 'zero durability uses standard damage');
eq(solveAccumulation(changedSequence({ durability: 100 }), { ...sequenceMode, durable: 0 }), null, 'fully durable target takes no standard damage');
for (const part of [{ count: undefined }, { count: 0 }, { count: 1.5 }, { toMain: null }, { capUnverified: true, overflowCap: null }, { unknownReason: '미확인' }, { prerequisite: '장갑 제거' }, { next: {} }, { partOnly: true }, { isolated: true }, { armor: 4 }]) {
  eq(solveAccumulation(changedSequence(part), sequenceMode), null, 'missing/conditional/blocked parts never supply fabricated damage');
}
eq(solveAccumulation({ ...sequenceEnemy, regeneration: { note: '재생' } }, sequenceMode), null);
eq(solveAccumulation({ ...sequenceEnemy, shield: { note: '보호막' } }, sequenceMode), null);
eq(solveAccumulation({ ...sequenceEnemy, shield: { note: '보호막' } }, sequenceMode, { shieldCleared: true }).hits, 4);
eq(solveAccumulation(sequenceEnemy, { ...sequenceMode, beam: {} }), null);
const pelletSequenceMode = { ...sequenceMode, hitCondition: { kind: 'pellets', min: 1, max: 4 } };
eq(solveAccumulation(sequenceEnemy, pelletSequenceMode), null, 'unselected pellets stay unresolved');
eq(solveAccumulation(changedSequence({ hp: 50, count: 3 }, { hp: 200 }), withHitAssumption(pelletSequenceMode, { hitCount: 4 })).hits, 3, 'remaining pellets never retarget another chunk in the same shot');
const redirectSequence = changedSequence({ hp: 50, count: 3, exdr: 100, overflowCap: true }, { hp: 450 });
eq(solveAccumulation(redirectSequence, { ...sequenceMode, explosion: 100, explosionAp: 3 }).hits, 3, 'redirected blast counted once per targeted instance, outside transfer cap');
eq(solveAccumulation(redirectSequence, { ...sequenceMode, explosion: 100, explosionAp: 3 }, { excludeMainExplosion: true }), null, 'main explosion exclusion respected');
const roundingSequence = changedSequence({ hp: 1, count: 5, toMain: 50 }, { hp: 5 });
const roundingMode = { ...sequenceMode, standard: 1, durable: 1, explosion: 1, explosionAp: 3 };
eq(solveAccumulation(roundingSequence, roundingMode).hits, 5, 'legacy combined transfer rounding');
eq(solveAccumulation(roundingSequence, { ...roundingMode, explosions: [{ standard: 1, durable: 1, ap: 3 }] }), null, 'explicit separate blast rounds transfer separately');
const rankedSequence = { ...sequenceEnemy, main: { ...sequenceEnemy.main, hp: 500 }, parts: [
  { ...sequenceEnemy.parts[0], id: 'slow', hp: 200, toMain: 50, count: 6 },
  { ...sequenceEnemy.parts[0], id: 'fast', hp: 200, toMain: 150, count: 2 },
] };
eq(solveAccumulation(rankedSequence, sequenceMode).steps[0].partId, 'fast', 'higher main transfer per shot first');
const cachedSequence = compareAttacks(fleshmob, [{ weaponId: 'autocannon' }]).entries[0];
cachedSequence.steps[0].instances = 999;
eq(compareAttacks(fleshmob, [{ weaponId: 'autocannon' }]).entries[0].steps[0].instances, 6, 'sequence cache isolates callers');

// Size labels come only from exact source page titles, never anatomy or names.
const sizeSnapshot = JSON.parse(await readFile(new URL('db/source/wiki_enemy_sizes.json', root), 'utf8'));
const sizePages = Object.entries(sizeSnapshot.categories).flatMap(([size, category]) => category.members.map(page => ({ ...page, size, category: category.category })));
eq(enemySizesCheckedAt, sizeSnapshot.retrievedAt);
eq(Object.keys(enemySizes).sort(), enemies.map(e => e.id).sort(), 'every roster entry has a size decision');
eq(Object.keys(enemySizeEvidence).sort(), Object.keys(enemySizes).sort(), 'every size decision has provenance');
eq(Object.keys(unmappedEnemySizes).sort(), ['aa-emplacement', 'bunker-turret', 'dropship-base', 'gatekeeper', 'mortar-emplacement', 'obtruder', 'veracitor']);
eq(SIZE_NAMES, { small: '소형', medium: '중형', large: '대형', massive: '초대형' });
for (const e of enemies) {
  const title = decodeURIComponent(new URL(e.source).pathname.slice('/wiki/'.length)).replaceAll('_', ' ');
  const matches = sizePages.filter(page => page.title === title);
  ok(matches.length <= 1, 'size source has no ambiguous membership');
  const page = matches[0];
  eq(enemySize(e), page?.size ?? null, `${e.id}: size follows source category`);
  eq(enemySize(e.id), enemySize(e), 'ID/object overload');
  eq(enemySizeEvidence[e.id], { title, source: e.source, category: page?.category ?? null, pageid: page?.pageid ?? null, revision: page?.revision ?? null }, 'source title and revision retained');
  eq(isLargeEnemy(e), Boolean(page && ['large', 'massive'].includes(page.size)));
  ok(page ? !Object.hasOwn(unmappedEnemySizes, e.id) : typeof unmappedEnemySizes[e.id] === 'string' && /[가-힣]/.test(unmappedEnemySizes[e.id]), 'exactly mapped or explicitly explained');
}
eq(enemySize('bile-titan'), 'massive');
eq(enemySize('hulk'), 'large');
eq(enemySize('obtruder'), null);
eq(isLargeEnemy('obtruder'), false, 'unmapped is never inferred large');
for (const value of [null, undefined, {}, '__proto__', 'toString', 'unknown']) eq(enemySize(value), null, 'unknown input stays null');
const shuffledSizeSnapshot = structuredClone(sizeSnapshot);
for (const category of Object.values(shuffledSizeSnapshot.categories)) category.members.reverse();
eq(buildEnemySizes(shuffledSizeSnapshot, [...enemies].reverse()), { enemySizes, enemySizeEvidence, unmappedEnemySizes }, 'size projection independent of input order');
const ambiguousSizeSnapshot = structuredClone(sizeSnapshot);
ambiguousSizeSnapshot.categories.large.members.push(ambiguousSizeSnapshot.categories.small.members[0]);
assert.throws(() => buildEnemySizes(ambiguousSizeSnapshot, enemies), /Duplicate or ambiguous/);

eq(personalWeapons.map(w => w.id), weapons.map(w => w.id), 'complete source roster and stable order');
eq(personalWeapons.length, 107);
eq(new Set([...personalWeapons, ...stratagems].map(w => w.id)).size, personalWeapons.length + stratagems.length, 'no personal/stratagem ID collisions');
eq(personalGroups.map(g => g.id), ['primary', 'secondary', 'throwable']);
ok(/^\d{4}-\d{2}-\d{2}$/.test(personalWeaponsCheckedAt), 'checkedAt format');
eq(personalWeaponsSource.attacksRevision, 142136);
const playerCopy = [...Object.values(personalUnsupported)];
const collectModeCopy = attack => {
  playerCopy.push(...[attack.name, attack.note, attack.unsupported, attack.hitCondition?.projectileName].filter(Boolean));
  if (attack.bomblet) collectModeCopy(attack.bomblet);
};
for (const profile of Object.values(personalProfiles)) {
  playerCopy.push(profile.note);
  profile.modes.forEach(collectModeCopy);
}
for (const text of playerCopy) ok(!/ap1|원본|레코드|탄체|\blevel\b|damage(?:_id)?|durable|splash|beam_fire_rate|charge_time|tac_reload_time/i.test(text), 'personal combat copy has no internal terminology');
eq(personalUnsupported.purifier, '충전했을 때의 정확한 피해가 확인되지 않아 계산하지 않습니다.');
eq(personalUnsupported.scythe, '광선을 얼마나 오래 비추는지에 따라 피해가 달라져 발 단위로 계산하지 않습니다.');
eq(personalUnsupported.torcher, '불꽃이 몇 번 닿는지 확인되지 않아 발 단위로 계산하지 않습니다.');
ok(personalProfiles.frag.modes[0].note.includes('20%') && personalProfiles.frag.modes[0].note.includes('폭발 피해도'), 'throwable note describes default fragments plus blast');
ok(personalProfiles.eruptor.modes[0].note.includes('직접 맞혔을 때의 피해와 폭발 피해도'), 'Eruptor note keeps primary direct plus blast');
const weaponOf = id => personalWeapons.find(w => w.id === id);
eq([weaponOf('dynamite').fuseType, weaponOf('dynamite').fuseOptions, weaponOf('dynamite').fuse], ['selectable', [5, 15, 60], null], 'selectable fuse never chooses a single time');
eq([weaponOf('impact').fuseType, weaponOf('impact').fuse], ['impact', null]);
eq(weaponOf('melta-mine').fuseType, 'proximity');
eq([weaponOf('shield').fuseType, weaponOf('shield').fuse], ['timed', 0], 'explicit zero seconds is not no fuse');
eq(weaponOf('throwing-knife').fuseType, 'none');
eq(weaponOf('liberator').fuseType, null, 'no inferred fuse for firearms');
eq(fuseDetails('5s / unknown', 'throwable'), { fuseType: null, fuseOptions: [] });
eq(fuseDetails('5-15s', 'throwable'), { fuseType: null, fuseOptions: [] }, 'range is not selectable options');
eq(fuseDetails('', 'throwable'), { fuseType: null, fuseOptions: [] }, 'absent is not none');
eq(fuseDetails('0s', 'throwable'), { fuseType: 'timed', fuseOptions: [] });
eq(weaponOf('frag').variants.find(v => v.id === 'shrapnel').displayName, '파편');
eq(weaponOf('frag').variants[0].displayName, '폭발');
eq(weaponOf('one-two').variants[1].displayName, '하부 유탄 발사기');
eq(weaponOf('arbitrator').variants[1].displayName, '하부 산탄총');
eq(weaponOf('stoker').variants[1].displayName, '하부 화염방사기');
eq(weaponOf('liberator').playerNotes, [], 'ordinary weapon has no noisy developer commentary');
ok(weaponOf('accelerator-rifle').playerNotes.some(note => note.includes('8개') && note.includes('12개')), 'conflict communicated to player');
ok(weaponOf('thermite').playerNotes.some(note => note.includes('2m') && note.includes('1.5m') && note.includes('2.5m')), 'radius conflict preserves both boundaries');
for (const id of ['frag', 'torcher', 'scythe', 'purifier', 'one-two']) ok(weaponOf(id).playerNotes.length > 0, `${id}: relevant caveat`);
for (const weapon of personalWeapons) {
  const source = weapons.find(w => w.id === weapon.id);
  const profile = personalProfiles[weapon.id], reason = personalUnsupported[weapon.id];
  ok(Array.isArray(weapon.playerNotes) && weapon.playerNotes.every(note => typeof note === 'string' && /[가-힣]/.test(note)), 'player notes are Korean sentences');
  ok(weapon.playerNotes.every(note => !/인포박스|데이터마이닝|\bDB\b|variants|tac_reload_time|revision|null|damage_id|sourceRevision/.test(note)), 'no developer jargon in player notes');
  ok([null, 'timed', 'impact', 'proximity', 'selectable', 'none'].includes(weapon.fuseType), 'fuse enum');
  ok(Array.isArray(weapon.fuseOptions) && weapon.fuseOptions.every(v => Number.isFinite(v) && v >= 0), 'numeric fuse options');
  for (const variant of weapon.variants) {
    ok(variant.displayName && /[가-힣]/.test(variant.displayName) && !/[A-Z]|_/.test(variant.displayName), 'friendly variant label, no raw attack keys');
    eq(variant.name, source.variants.find(v => v.id === variant.id).name, 'raw variant name retained');
  }
  ok(Boolean(profile) !== Boolean(reason), `${weapon.id}: exactly profile or reason`);
  eq(weapon.image, parseInfobox(pages[weapon.en].wikitext).image?.replace(/\{\{\s*PAGENAME\s*\}\}/gi, weapon.en) || null, `${weapon.id}: source image`);
  for (const field of ['direct', 'durable', 'ap', 'splash', 'splashDurable', 'pellets', 'magazine', 'dot', 'notes', 'infoboxConflicts']) eq(weapon[field], source[field], `${weapon.id}.${field}`);
  ok(!['attacks', 'linkedAttacks', 'charge', 'infoboxRaw', 'wikitext'].some(key => Object.hasOwn(weapon, key)), 'lean display projection');
  if (reason) { ok(/[가-힣]/.test(reason), 'Korean unsupported reason'); continue; }
  ok(profile.source.startsWith('https://') && profile.note && profile.checkedAt === personalWeaponsCheckedAt, 'profile provenance');
  ok(profile.modes.length > 0, 'nonempty profile');
  eq(new Set(profile.modes.map(m => m.id)).size, profile.modes.length, 'unique mode IDs');
  for (const attack of profile.modes) {
    ok(attack.id && attack.name, 'mode labels');
    if (attack.unsupported) { ok(/[가-힣]/.test(attack.unsupported), 'mode reason'); continue; }
    for (const field of ['standard', 'durable', 'ap', 'explosion', 'explosionDurable', 'explosionAp']) ok(Number.isFinite(attack[field]) && attack[field] >= 0, `${weapon.id}/${attack.id}.${field}`);
    for (const field of ['radius', 'innerRadius', 'magazine']) ok(attack[field] === null || Number.isFinite(attack[field]) && attack[field] >= 0, `${weapon.id}/${attack.id}.${field}`);
    ok(attack.unit && attack.delivery, 'units and delivery');
    ok(Number.isInteger(attack.ammoPerShot) && attack.ammoPerShot > 0, 'ammo use');
    if (attack.hitCondition) {
      const { min, max } = attack.hitCondition;
      const pct = ['pellets', 'arcs'].includes(attack.hitCondition.kind) ? 100 : 20;
      eq(attack.hitCondition.defaultPct, pct);
      eq(attack.hitCondition.default, Math.max(min, Math.round(max * pct / 100)), `${weapon.id}/${attack.id}: rounded default count`);
      ok(Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max >= min, 'assumption bounds');
      eq(head('hunter-hardened', attack).reason, 'assumption-needed', 'raw engine requires applied assumption; comparison/UI apply default');
      for (const hitCount of [-1, max + 1, 1.5, 'bogus', '']) ok(!withHitAssumption(attack, { hitCount }).events, 'invalid count stays pending');
      ok(withHitAssumption(attack, { hitCount: min }).events, 'minimum explicit assumption works');
    }
    ok(!attack.id.startsWith('shrapnel'), 'linked fragment never selectable');
  }
}
eq(personalWeapons.find(w => w.id === 'liberator').image, 'AR-23 Liberator Primary Render.png');
eq(personalProfiles['one-two'].modes.map(m => m.id), ['standard', 'underbarrel']);
eq(personalProfiles['one-two'].modes[1].magazine, 1, 'underbarrel capacity does not inherit rifle capacity');
eq(personalProfiles.halt.modes.map(m => m.magazine), [8, 8], 'independent ammo tubes');
ok(personalProfiles.stoker.modes[1].unsupported, 'spray underbarrel remains unsupported');

// Independent anatomy arithmetic: Hunter head 40 HP, AV0, durability0;
// Liberator 90 > 40. Devastator head 110 HP, AV1; Senator 225 > 110.
eq([enemy('hunter-hardened').parts[0].hp, mode('liberator').standard], [40, 90]);
eq([head('hunter-hardened', mode('liberator')).hits, head('hunter-hardened', mode('liberator')).outcome], [1, 'kill']);
eq([enemy('devastator').parts[0].hp, mode('senator').standard], [110, 225]);
eq(head('devastator', mode('senator')).hits, 1);
// Frag: head ExDR100 redirects the 500 blast to the AV0/ExDR0 main
// pool (160 HP). No direct damage or assumed fragments: 1 explosion kills.
const frag = head('hunter-hardened', withHitAssumption(mode('frag'), { hitCount: 0 }));
eq([frag.hits, frag.outcome, frag.via], [1, 'kill', 'main']);
eq(frag.stages[0].damage, { direct: 0, explosion: 0, mainExplosion: 500 });
// Breacher: one firing mode whose stuck round detonates the 2000/AP7 delayed
// explosion on the part it hit. Charger head (1200 HP, AV4, dur 75, ExDR 25):
// direct floor(floor(60*0.25)*0.65)=9 + blast floor(2000*0.75)=1500 → 1 shot.
eq(personalProfiles.breacher.modes.length, 1, 'Breacher has one firing mode');
eq(mode('breacher').explosions.map(b => [b.id, b.durable, b.ap, b.innerRadius, b.radius]), [['delayed', 2000, 7, 1.5, 2.5]]);
eq(head('charger', mode('breacher')).stages[0].damage, { direct: 9, explosion: 1500, mainExplosion: 0 });
eq([head('charger', mode('breacher')).hits, head('charger', mode('breacher')).outcome], [1, 'kill']);
// A held beam burns through armor and carries on into the exposed layer.
// Meltagun near = 3640 per 1.4s shot. Impaler leg armor 1000 takes 0.2747 of
// a shot (500 to main), then leg flesh 1000 takes another 0.2747 → 1 shot.
const melta = weaponProfiles.meltagun.modes.find(m => m.id === 'near');
const impalerLeg = solveMatchup(enemy('impaler'), melta).rows.find(row => row.target.id === 'leg-armor');
eq([impalerLeg.hits, impalerLeg.outcome, impalerLeg.via, impalerLeg.stages.length], [1, 'kill', 'part', 2]);
eq(impalerLeg.stages.map(stage => [stage.part.id, stage.hits, Math.round(stage.contactSeconds * 1000), Math.round(stage.mainTotal)]), [['leg-armor', 1, 385, 500], ['leg-flesh', 0, 385, 500]]);
// Bile Titan leg: armor 1000 (0.2747 shot, 1000 to main) then flesh 2000 plus
// 2000 extra health that never decays (1.0989 shots) → 1.37 → 2 shots.
const titanLeg = solveMatchup(enemy('bile-titan'), melta).rows.find(row => row.target.id === 'leg');
eq([titanLeg.hits, titanLeg.outcome, titanLeg.via], [2, 'kill', 'part']);
// Impaler torso: armor 1000 (0.2747 shot, 75% capped at 1000 → 750 to main),
// then inner flesh sends 150% of 3640 per shot to the 3250 left → 1 shot.
const impalerTorso = solveMatchup(enemy('impaler'), melta).rows.find(row => row.target.id === 'torso-armor');
eq([impalerTorso.hits, impalerTorso.outcome, impalerTorso.via], [1, 'kill', 'main']);
// A layer the beam cannot hurt after the armor breaks stops as armor removal.
const armoredFlesh = { main: { hp: 5000, armor: 0, durability: 0, exdr: 0 }, parts: [{ id: 'plate', name: 'plate', hp: 1000, armor: 4, durability: 0, exdr: 0, toMain: 0, overflowCap: false, effect: 'armor', next: { id: 'core', name: 'core', hp: 100, armor: 9, durability: 0, exdr: 0, toMain: 100, overflowCap: false, effect: 'kill' } }] };
eq((({ hits, outcome, reason }) => ({ hits, outcome, reason }))(solveMatchup(armoredFlesh, melta).rows[0]), { hits: 1, outcome: 'armor', reason: 'no-damage-after-armor' });
// Breaker 30 per pellet: one hit pellet takes 2 shots, two take 1.
eq(head('hunter-hardened', withHitAssumption(mode('breaker'), { hitCount: 1 })).hits, 2);
eq(head('hunter-hardened', withHitAssumption(mode('breaker'), { hitCount: 2 })).hits, 1);
ok(assumptionSummary(withHitAssumption(mode('breaker'), { hitCount: 2 })).includes('펠릿 11개 중 2개'), 'pellets not labelled as bomblets');
ok(assumptionSummary(withHitAssumption(mode('frag'), { hitCount: 0 })).includes('파편 0개'), 'zero-fragment label');
const pelletsTwo = withHitAssumption(mode('breaker'), { hitCount: 2 });
const fragmentsZero = withHitAssumption(mode('frag'), { hitCount: 0 });
const fragmentsThree = withHitAssumption(mode('eruptor'), { hitCount: 3 });
eq(assumptionSummary(pelletsTwo), '펠릿 11개 중 2개 명중 (약 18%)');
eq(assumptionSummary(withHitAssumption(mode('breaker'), { hitCount: 6 })), '펠릿 11개 중 6개 명중 (약 55%)');
eq(assumptionSummary(withHitAssumption(mode('breaker'), { hitCount: 11 })), '펠릿 11개가 모두 이 부위에 명중 (전탄 명중 가정)');
eq(assumptionTag(withHitAssumption(mode('breaker'), { hitCount: 11 })), '전탄 명중 가정');
eq(assumptionSummary(fragmentsZero), '폭발 1회당 파편 0개가 이 부위에 명중 + 주폭발 (파편 피해 제외)');
eq(assumptionSummary(fragmentsThree), '파편 30개 중 3개(10%)가 이 부위에 명중 (명중 수 가정) + 주탄 직격 + 폭발');
ok(assumptionSummary(mode('breaker')).includes('펠릿 수를 고르세요'), 'pending pellet prompt');
ok(assumptionSummary(withHitAssumption(mode('frag'), { hitCount: -1 })).includes('파편 수를 고르세요'), 'invalid fragment count stays pending in copy');
eq(assumptionTag(mode('breaker')), '펠릿 명중 수 선택 필요');
eq(assumptionTag(pelletsTwo), '펠릿 명중 수 가정');
eq(assumptionTag(fragmentsZero), '파편 제외 · 폭발만');
eq(assumptionTag(fragmentsThree), '파편 명중 수 가정');
ok(assumptionText(mode('breaker')).includes('명중률을 낮춰 다시 계산'), 'pellet default caveat');
ok(!assumptionText(mode('high-explosive')).includes('직격'), 'pure explosion does not claim direct hit');
eq(unitOf(mode('frag')), { unit: '개', noun: '수류탄 개수', one: '수류탄 1개' });
eq(countText({ hits: 2 }, mode('frag')), '수류탄 2개');
eq(countText({ hits: 2, lowerBound: true }, mode('melta-mine')), '지뢰 2개 이상');
eq(unitOf(mode('dynamite')).one, '다이너마이트 1개');
eq(unitOf(weaponProfiles['c4-pack'].modes[0]), { unit: '개', noun: '장약 수', one: '장약 1개' }, 'legacy C4 unit unchanged');
eq(countText({ hits: 2 }, weaponProfiles['c4-pack'].modes[0]), '2개', 'legacy count format unchanged');
eq(deliveryOf(mode('frag')).hit, '폭발');
eq(deliveryOf(mode('breaker')).hit, '펠릿 1개');
ok(attackStats(mode('frag')).some(stat => stat.label === '파편 1개'), 'fragment stats labelled correctly');
ok(!attackStats(mode('frag')).some(stat => stat.label.includes('자탄')), 'fragments are not bomblets');
ok(aimText(frag, fragmentsZero).some(line => line.includes('파편 0개')), 'aim repeats selected assumption');
ok(aimText(frag, fragmentsZero).some(line => line.includes('폭발 중심')), 'fragment shots retain blast aim condition');
ok(routeNotes(head('hunter-hardened', mode('breaker')), mode('breaker')).some(note => note.includes('펠릿 수를 고르세요')), 'pending route notes identify pellets');
eq(assumptionSummary(withHitAssumption(weaponProfiles['de-escalator'].modes[0], { hitCount: 2 })), '전격 10회 중 2회(20%)가 이 부위에 명중 (명중 수 가정)');
eq(assumptionSummary(withHitAssumption(weaponProfiles['airburst-launcher'].modes[0], { hitCount: 2 })), '주탄 폭발만 · 자탄 25개 중 2개(8%) 폭발이 이 부위에 명중 (명중 수 가정)');
eq(assumptionSummary(withHitAssumption(mode('frag'), { hitCount: 7 })), '파편 35개 중 7개(20%)가 이 부위에 명중 (기본 가정) + 주폭발');
eq(assumptionSummary(withHitAssumption(mode('pineapple'), { hitCount: 4 })), '파편 18개 중 4개(약 22%)가 이 부위에 명중 (기본 가정) + 주폭발', 'display actual rounded count percentage, retain configured 20 in metadata');
eq(assumptionSummary(withHitAssumption(mode('blitzer'), { hitCount: 5 })), '전격 5회 모두 이 부위에 명중 (기본 가정)');
eq(assumptionTag(withHitAssumption(mode('frag'), { hitCount: 7 })), '파편 20% 기본 가정');
eq(assumptionTag(withHitAssumption(mode('blitzer'), { hitCount: 5 })), '전격 100% 기본 가정');
eq(assumptionTag(withHitAssumption(weaponProfiles['airburst-launcher'].modes[0], { hitCount: 5 })), '자탄 20% 기본 가정');
ok(assumptionSummary(withHitAssumption(personalProfiles.variable.modes.find(m => m.id === 'volley'), { hitCount: 2 })).includes('탄환 7개 중 2개'), 'volley bullets are not shotgun pellets');
eq(mode('eruptor').hitCondition.kind, 'shrapnel');
eq(withHitAssumption(mode('eruptor'), { hitCount: 0 }).assumption.primaryHit, 'direct');
const defaultEruptor = withHitAssumption(mode('eruptor'), { hitCount: mode('eruptor').hitCondition.default });
eq(defaultEruptor.events.length, 2, 'default Eruptor includes primary and fragments');
const defaultEruptorHead = head('hunter-hardened', defaultEruptor);
eq([defaultEruptorHead.hits, defaultEruptorHead.outcome], [1, 'kill'], 'default Eruptor kills Hunter');
eq(defaultEruptorHead.stages[0].damage, { direct: 890, explosion: 0, mainExplosion: 225 }, 'Eruptor potential shot damage includes six 110-damage fragments');
eq(personalProfiles['double-freedom'].modes[1].ammoPerShot, 2);
const missingBlast = buildPersonalProfiles([weapons.find(w => w.id === 'liberator')], { projectile: { 'AR-23_P': { explode_on_impact_id: 'unknown-blast' } } }, pages, personalWeaponsCheckedAt);
ok(missingBlast.personalUnsupported.liberator, 'linked but unknown explosion is never silently zero');

const compare = (id, weaponId, options = {}, modeId) => compareAttacks(enemy(id), [{ weaponId, modeId }], options).entries[0];
// New support hit-count modes are traceable to every local datamined record.
const supportSnapshot = JSON.parse(await readFile(new URL('db/source/weapons_data.json', root), 'utf8'));
const supportData = supportSnapshot.data;
const flakMode = weaponProfiles.autocannon.modes.find(m => m.id === 'flak');
const waspMode = weaponProfiles.wasp.modes.find(m => m.id === 'submunitions');
for (const [attack, projectileId] of [[flakMode, 'AC-8_P1'], [waspMode, 'StA-X3_P1'], [waspMode.bomblet, 'StA-X3_P']]) {
  const projectile = supportData.projectile[projectileId];
  const damage = supportData.damage[projectile.damage_id];
  const explosion = supportData.explosion[projectile.explode_on_impact_id];
  const blast = supportData.damage[explosion.damage_id];
  eq([attack.standard, attack.durable, attack.ap], [damage.dmg, damage.dmg2, damage.ap1], `${projectileId}: direct source values`);
  eq([attack.explosion, attack.explosionDurable, attack.explosionAp, attack.innerRadius, attack.radius], [blast.dmg, blast.dmg2, blast.ap1, explosion.r1, explosion.r2], `${projectileId}: linked explosion values`);
}
const flakExplosion = supportData.explosion[supportData.projectile['AC-8_P1'].explode_on_impact_id];
eq([flakExplosion.shrapnel, flakExplosion.shrapnel_count], ['AC-8_P2', flakMode.hitCondition.max]);
const flakFragment = supportData.projectile[flakExplosion.shrapnel];
const fragmentDamage = supportData.damage[flakFragment.damage_id];
eq([flakMode.bomblet.standard, flakMode.bomblet.durable, flakMode.bomblet.ap], [fragmentDamage.dmg, fragmentDamage.dmg2, fragmentDamage.ap1]);
ok(!flakFragment.explode_on_impact_id && flakMode.bomblet.explosion === 0, 'fragment has no linked blast');
const waspExplosion = supportData.explosion[supportData.projectile['StA-X3_P1'].explode_on_impact_id];
eq([waspExplosion.shrapnel, waspExplosion.shrapnel_count, waspExplosion.cone_angle], ['StA-X3_P', waspMode.hitCondition.max, waspMode.coneAngle]);
for (const profile of [flakMode, weaponProfiles.wasp]) eq([profile.source, profile.sourceRevision, profile.checkedAt], [supportSnapshot.source, supportSnapshot.revision, supportSnapshot.retrievedAt], 'support source provenance');
eq(supportData.projectile['StA-X3_P1'].explode_proximity, 12, 'parent proximity exceeds blast radius');
ok(supportData.weapons['STA-X3 W.A.S.P. LAUNCHER'].attacks.some(a => a.name === 'StA-X3_P1' && a.level === 1), 'parent is a linked weapon attack');
const flakZero = withHitAssumption(flakMode, { hitCount: 0 });
const numericView = result => result.rows.map(row => [row.target.id, row.hits, row.outcome, row.via, row.conditional, row.lowerBound, row.stages.map(s => [s.part.id, s.hits, s.damage])]);
// Golden flak had no numeric route. Independently verify every zero-fragment
// result against a plain blast built from the local explosion, with no direct hit.
const plainFlakBlast = { standard: 0, durable: 0, ap: 0, explosion: 190, explosionDurable: 190, explosionAp: 3, innerRadius: 2, radius: 7 };
for (const target of enemies) for (const shieldCleared of [false, true]) eq(
  numericView(solveMatchup(target, flakZero, { shieldCleared })),
  numericView(solveMatchup(target, plainFlakBlast, { shieldCleared })), `${target.id}: zero fragments preserves plain blast numeric results`);
eq(head('hunter-hardened', flakZero).stages[0].damage, { direct: 0, explosion: 0, mainExplosion: 190 });
eq(head('hunter-hardened', withHitAssumption(flakMode, { hitCount: 6 })).stages[0].damage, { direct: 660, explosion: 0, mainExplosion: 190 });
const waspDefault = withHitAssumption(waspMode, { hitCount: 1 });
eq(waspDefault.assumption, { count: 1, primaryHit: 'none', bombletDirect: true });
eq(head('hunter-hardened', waspDefault).stages[0].damage, { direct: 200, explosion: 0, mainExplosion: 600 }, 'one sub-missile direct plus explosion, parent excluded');
eq(waspDefault.events.length, 1);
eq(waspDefault.events[0].directHit, true);
eq(compare('hunter-hardened', 'wasp').magazinesNeeded, null, 'compound attack ammunition consumption is not inferred');
eq(compare('hunter-hardened', 'wasp', {}, 'guided').status, 'unsupported', 'unverified guided target restrictions remain unsupported');
ok(compare('hunter-hardened', 'wasp', {}, 'guided').reason.includes('유도'));
const explicitWaspBlast = compare('hunter-hardened', 'wasp', { assume: { primaryHit: 'blast', bombletDirect: false } });
eq(explicitWaspBlast.assumption, { count: 1, primaryHit: 'blast', bombletDirect: false }, 'explicit delivery overrides new mode defaults');
eq(explicitWaspBlast.rows.find(r => r.target.id === 'head').stages[0].damage, { direct: 0, explosion: 0, mainExplosion: 1200 });
eq(compare('hunter-hardened', 'wasp').assumption, waspDefault.assumption, 'default cache distinct from blast/false override');
eq(compare('hunter-hardened', 'wasp', { assume: { primaryHit: null } }).verified, false, 'invalid delivery does not collide with default cache');
eq(compare('hunter-hardened', 'wasp', { assume: { hitCount: 0 } }).hits, null, 'zero sub-missiles with parent excluded gives no damage');
eq(compare('hunter-hardened', 'autocannon', { assume: { hitCount: 0 } }, 'flak').fragmentsExcluded, true);
ok(assumptionSummary(waspDefault).includes('주탄 피해 제외') && assumptionSummary(waspDefault).includes('직격 + 폭발'), 'WASP summary matches actual events');
ok(assumptionText(waspMode).includes('직격과 폭발') && assumptionText(waspMode).includes('주탄 피해는 기본에서 제외'));
ok(assumptionSummary(withHitAssumption(flakMode, { hitCount: 6 })).includes('주폭발') && !assumptionSummary(withHitAssumption(flakMode, { hitCount: 6 })).includes('주탄 직격'));
const supportCountTarget = { id: 'support-count-test', main: { hp: 99999, armor: 0, durability: 0, exdr: 0 },
  parts: [{ id: 'body', name: '몸통', hp: 1000, armor: 0, durability: 0, exdr: 0, toMain: 0, overflowCap: false, effect: 'kill' }] };
eq(compareAttacks(supportCountTarget, [{ weaponId: 'autocannon', modeId: 'flak' }]).entries[0].hits, 2, '190 blast + 6*110 fragments per shot');
eq(compareAttacks(supportCountTarget, [{ weaponId: 'autocannon', modeId: 'flak' }], { assume: { hitCount: 0 } }).entries[0].hits, 6, 'zero fragments uses only 190 blast');
const armoredWaspTarget = { ...supportCountTarget, parts: [{ ...supportCountTarget.parts[0], hp: 300, armor: 5, durability: 100 }] };
eq(compareAttacks(armoredWaspTarget, [{ weaponId: 'wasp' }]).entries[0].hits, 2, 'AP6 sub-missile direct penetrates armor5; AP3 blast blocked');
eq(compareAttacks(armoredWaspTarget, [{ weaponId: 'wasp' }], { assume: { hitCount: 2 } }).entries[0].hits, 1, 'two explicitly assumed sub-missiles increase damage');
eq(compareAttacks(armoredWaspTarget, [{ weaponId: 'wasp' }], { assume: { bombletDirect: false } }).entries[0].hits, null, 'disabling direct leaves blocked explosion; cache stays distinct');
// Every supported assumption kind shares the same default contract. pct is the
// configured slider percentage, not the rounded count/max ratio (4/18 != 20%).
for (const [weaponId, modeId, kind, count, max, pct, slot] of [
  ['blitzer', 'standard', 'arcs', 5, 5, 100, 'primary'],
  ['de-escalator', 'arc', 'arcs', 10, 10, 100, 'stratagems'],
  ['airburst-launcher', 'flak', 'bomblets', 5, 25, 20, 'stratagems'],
  ['airburst-launcher', 'cluster', 'bomblets', 5, 25, 20, 'stratagems'],
  ['autocannon', 'flak', 'shrapnel', 6, 30, 20, 'stratagems'],
  ['wasp', 'submunitions', 'bomblets', 1, 7, 20, 'stratagems'],
  ['eruptor', 'standard', 'shrapnel', 6, 30, 20, 'primary'],
  ['frag', 'standard', 'shrapnel', 7, 35, 20, 'throwable'],
  ['pineapple', 'standard', 'shrapnel', 4, 18, 20, 'throwable'],
  ['lure-mine', 'standard', 'shrapnel', 7, 35, 20, 'throwable'],
]) {
  const attack = resolveAttack(weaponId).profile.modes.find(m => m.id === modeId);
  eq([attack.hitCondition.default, attack.hitCondition.defaultPct], [count, pct]);
  eq(count, Math.max(attack.hitCondition.min, Math.round(max * pct / 100)));
  const result = compare('hunter-hardened', weaponId, {}, modeId);
  eq([result.status, result.verified, result.defaulted, result.fragmentsExcluded], ['route', true, true, false]);
  eq(result.defaultAssumed, { kind, count, max, pct });
  eq(result.assumption.count, count);
  ok(assumptionSummary(result.mode).includes('(기본 가정)'));
  const explicit = compare('hunter-hardened', weaponId, { assume: { hitCount: String(count) } }, modeId);
  eq([explicit.verified, explicit.defaulted, explicit.defaultAssumed], [true, false, result.defaultAssumed], 'explicit default count has same acceptance');
  const otherCount = count === 1 ? 2 : 1;
  const lower = compare('hunter-hardened', weaponId, { assume: { [`${weaponId}:${modeId}`]: { hitCount: otherCount } } }, modeId);
  eq([lower.assumption.count, lower.defaulted, lower.defaultAssumed, lower.status], [otherCount, false, null, 'assume'], 'other count overrides without adopting default acceptance');
  const invalid = compare('hunter-hardened', weaponId, { assume: { hitCount: max + 1 } }, modeId);
  eq([invalid.defaulted, invalid.defaultAssumed, invalid.verified], [false, null, false]);
  eq(compare('hunter-hardened', weaponId, { assume: { hitCount: null } }, modeId).defaultAssumed, result.defaultAssumed, 'null restores configured default');
  const loadout = { [slot]: slot === 'stratagems' ? [weaponId] : weaponId };
  const coverage = loadoutCoverage(loadout, 'terminid');
  const row = coverage.rows.find(r => r.enemyId === 'hunter-hardened');
  const answer = row.perSlot[0].modes.find(m => m.modeId === modeId);
  eq([row.status, answer.verified, answer.defaultAssumed], ['route', true, result.defaultAssumed]);
  ok(!coverage.gaps.some(r => r.enemyId === row.enemyId), 'default routes fill loadout gaps');
  eq(loadoutView(loadout, 'terminid', { limit: 0 }).rows.find(r => r.enemyId === row.enemyId).best.defaultAssumed, row.best.defaultAssumed);
}
eq(compare('hunter-hardened', 'liberator').defaultAssumed, null, 'plain fire never claims a default hit-count assumption');
const changedBombletDelivery = compare('hunter-hardened', 'airburst-launcher', { assume: { primaryHit: 'none', bombletDirect: true } }, 'cluster');
eq(changedBombletDelivery.assumption, { count: 5, primaryHit: 'none', bombletDirect: true }, 'default count preserves explicit delivery options');
const withInvalidDelivery = compare('hunter-hardened', 'airburst-launcher', { assume: { primaryHit: 'invalid' } });
eq([withInvalidDelivery.defaultAssumed, withInvalidDelivery.verified], [null, false], 'invalid delivery cannot validate a default count');
eq(resolveAttack('liberator').kind, 'personal');
eq(resolveAttack('autocannon').profile, weaponProfiles.autocannon);
ok(resolveAttack('__proto__').unsupported && !resolveAttack('__proto__').profile, 'untrusted IDs cannot resolve prototypes');
eq(compare('hunter-hardened', 'liberator', { partId: 'head' }).magazinesNeeded, 1);
eq(compare('hunter-hardened', 'torcher').status, 'unsupported');
eq(compare('hunter-hardened', 'liberator', {}, 'not-a-mode').status, 'unsupported');
eq(compare('hunter-hardened', 'liberator', { partId: 'not-a-part' }).status, 'none');
const defaultBreaker = compare('hunter-hardened', 'breaker');
eq(compare('hunter-hardened', 'liberator').oneShot, true, 'one bullet fatal answer');
eq(compare('hunter-hardened', 'frag').oneShot, true, 'one grenade fatal answer');
eq(compare('hunter-hardened', 'saber').oneShot, true, 'one melee hit fatal answer');
eq(compare('hunter-hardened', 'senator', { partId: 'claw' }).oneShot, false, 'one-hit nonfatal break is not oneShot');
eq(compare('hunter-hardened', 'torcher').oneShot, false, 'unsupported is not oneShot');
eq(compare('harvester', 'recoilless').oneShot, false, 'blocked shield is not oneShot');
eq(compare('hunter-hardened', 'breaker', { assume: { hitCount: 2 } }).oneShot, false, 'nonaccepted assumption is not oneShot even if hits is 1');
eq([defaultBreaker.status, defaultBreaker.hits, defaultBreaker.verified, defaultBreaker.defaulted, defaultBreaker.allPelletsAssumed, defaultBreaker.assumption.count], ['route', 1, true, true, true, 11]);
const fewerBreaker = compare('hunter-hardened', 'breaker', { assume: { hitCount: 1 } });
eq([fewerBreaker.hits, fewerBreaker.defaulted, fewerBreaker.allPelletsAssumed, fewerBreaker.status], [2, false, false, 'assume'], 'lower explicit count overrides and increases hits');
eq(compare('hunter-hardened', 'breaker', { assume: { 'breaker:standard': { hitCount: 1 } } }).hits, 2, 'per-mode override');
const explicitFull = compare('hunter-hardened', 'breaker', { assume: { hitCount: '11' } });
eq([explicitFull.verified, explicitFull.defaulted, explicitFull.allPelletsAssumed], [true, false, true], 'explicit max is same full-hit scenario');
eq(compare('hunter-hardened', 'breaker', { assume: { hitCount: '' } }).allPelletsAssumed, true, 'blank restores full default');
eq(compare('hunter-hardened', 'breaker', { assume: { hitCount: 12 } }).verified, false, 'invalid count cannot silently use default');
eq(compare('hunter-hardened', 'breaker').hits, 1, 'default cache remains separate from explicit lower count');
for (const [weaponId, profile] of Object.entries(personalProfiles)) for (const attack of profile.modes) {
  if (attack.hitCondition?.kind !== 'pellets') continue;
  const result = compare('hunter-hardened', weaponId, {}, attack.id);
  ok(result.defaulted && result.allPelletsAssumed && result.assumption.count === attack.hitCondition.max, `${weaponId}/${attack.id}: comparison applies full pellet default`);
}
const assumed = compare('hunter-hardened', 'breaker', { assume: { hitCount: 2 } });
eq([assumed.status, assumed.hits, assumed.assumption.count, assumed.verified], ['assume', 1, 2, false]);
eq(compare('hunter-hardened', 'frag', { assume: { 'frag:standard': { hitCount: 0 } } }).hits, 1);
for (const id of ['eruptor', 'frag', 'pineapple', 'lure-mine']) {
  const conservative = compare('hunter-hardened', id);
  eq([conservative.status, conservative.verified, conservative.defaulted, conservative.fragmentsExcluded, conservative.assumption.count], ['route', true, true, false, mode(id).hitCondition.default], `${id}: configured default is accepted`);
  const explicitZero = compare('hunter-hardened', id, { assume: { hitCount: '0' } });
  eq([explicitZero.verified, explicitZero.defaulted, explicitZero.fragmentsExcluded], [true, false, true], 'explicit zero is also conservative');
  eq(compare('hunter-hardened', id, { assume: { hitCount: '' } }).defaulted, true, 'blank selector uses default');
  const positive = compare('hunter-hardened', id, { assume: { hitCount: 1 } });
  eq([positive.status, positive.verified, positive.defaulted, positive.fragmentsExcluded], ['assume', false, false, false], 'positive fragments remain hypothetical');
  const invalid = compare('hunter-hardened', id, { assume: { hitCount: -1 } });
  eq([invalid.status, invalid.verified, invalid.assumption, invalid.defaulted], ['assume', false, null, false], 'invalid explicit input never silently defaults');
  eq(compare('hunter-hardened', id).assumption.count, mode(id).hitCondition.default, 'cache keeps default apart from other positive assumption');
}
eq(compare('hunter-hardened', 'sickle').magazinesNeeded, null, 'heat is not a magazine');
eq(compare('hunter-hardened', 'frag', { assume: { hitCount: 0 } }).magazinesNeeded, null, 'throwables are not magazines');
eq(compare('hunter-hardened', 'spear').status, 'unsupported', 'lock-on restriction');
eq(compare('harvester', 'recoilless').verified, false, 'shield uncleared by default');
ok(compare('harvester', 'recoilless', { shieldCleared: true }).shieldAssumed, 'shield prerequisite visible');
const synthetic = { id: 'test', main: { hp: 99999, armor: 0, exdr: 0 }, parts: [{ id: 'body', name: '몸통', hp: 46 * 90, armor: 0, durability: 0, exdr: 0, toMain: 0, overflowCap: false, effect: 'kill' }] };
eq(compareAttacks(synthetic, [{ weaponId: 'liberator' }]).entries[0].magazinesNeeded, 2, 'magazine boundary');
const volley = compareAttacks({ ...synthetic, parts: [{ ...synthetic.parts[0], hp: 150 }] }, [{ weaponId: 'bushwhacker', modeId: 'all-barrels' }], { assume: { hitCount: 1 } }).entries[0];
eq([volley.hits, volley.magazinesNeeded], [3, 3], 'multi-barrel event consumes three shells per trigger');
const before = compare('hunter-hardened', 'liberator'); before.route.hits = 999;
eq(compare('hunter-hardened', 'liberator').hits, 1, 'cache protected from result mutation');
eq(compareAttacks(enemy('hunter-hardened'), [{ weaponId: 'senator' }, { weaponId: 'liberator' }]).parts.map(p => p.id), enemy('hunter-hardened').parts.map(p => p.id));

const fixed = { primary: 'liberator', secondary: 'senator', throwable: 'high-explosive', stratagems: ['autocannon', 'recoilless', '', ''], faction: 'terminid' };
eq(decodeLoadout(encodeLoadout(fixed)), fixed, 'URL round trip preserves positions');
eq(decodeLoadout(`#/gear?${encodeLoadout(fixed)}`), fixed);
eq(decodeLoadout(new URLSearchParams(encodeLoadout(fixed))), fixed);
eq(decodeLoadout({ p: 'senator', s: 'liberator', g: 'bad', st: 'autocannon,bad,recoilless,autocannon,quasar', f: 'bad' }), { primary: '', secondary: '', throwable: '', stratagems: ['autocannon', '', 'recoilless', ''], faction: 'terminid' }, 'drop wrong category, unknown IDs, duplicate and excess stratagems');
eq(decodeLoadout('p=%ZZ&s=__proto__').primary, '', 'malformed query tolerated');
eq(parseRoute(formatRoute({ view: 'gear', query: Object.fromEntries(new URLSearchParams(encodeLoadout(fixed))) })).view, 'gear');
eq(parseRoute('#combat').view, 'enemy', 'legacy unchanged');
for (const faction of loadoutFactions) for (const id of faction.enemyIds) ok(enemy(id)?.faction === faction.name, 'faction checklist has existing same-faction anatomy');
const coverage = loadoutCoverage(fixed, 'terminid');
// One row per checklist enemy; sub-faction guides each add their last unit (core/loadout.js).
eq(coverage.rows.length, loadoutFactions.find(faction => faction.id === 'terminid').enemyIds.length);
eq(coverage.gaps.length, 0, 'fixed loadout covers Terminid checklist');
const charger = coverage.rows.find(row => row.enemyId === 'charger');
eq([charger.best.weaponId, charger.best.modeId, charger.best.hits], ['recoilless', 'heat', 1]);
ok(coverage.rows.every(row => row.best.verified && row.perSlot.length === 5), 'per-slot evidence');
for (const row of coverage.rows) {
  eq(row.size, enemySize(row.enemyId));
  eq(row.isLarge, isLargeEnemy(row.enemyId));
  eq(row.oneShot, Boolean(row.best?.verified && row.best.hits === 1), 'row reflects best answer');
  for (const slot of row.perSlot) for (const answer of slot.modes) eq(answer.oneShot, answer.verified && answer.hits === 1, 'every Answer carries oneShot');
}
// The recoilless rifle one-shots every large Terminid on the checklist, so
// priority ordering is checked on the same loadout without it.
ok(coverage.rows.every(row => !row.isLarge || row.oneShot), 'fixed loadout one-shots the large Terminids');
const partial = { ...fixed, stratagems: ['autocannon', '', '', ''] };
const partialCoverage = loadoutCoverage(partial, 'terminid');
const impaler = partialCoverage.rows.find(row => row.enemyId === 'impaler');
ok(impaler.isLarge && !impaler.oneShot, 'partial loadout has a large non-one-shot priority target');
const prioritized = loadoutCoverage(partial, 'terminid', { prioritizeLarge: true });
eq(prioritized.rows.slice(0, 5).map(r => r.enemyId), ['charger', 'impaler', 'bile-titan', 'spore-burst-bile-titan', 'rupture-charger']);
eq(prioritized.rows.filter(r => r.isLarge && !r.oneShot).map(r => r.enemyId), partialCoverage.rows.filter(r => r.isLarge && !r.oneShot).map(r => r.enemyId), 'priority group remains stable');
eq(prioritized.rows.filter(r => !(r.isLarge && !r.oneShot)).map(r => r.enemyId), partialCoverage.rows.filter(r => !(r.isLarge && !r.oneShot)).map(r => r.enemyId), 'remaining group remains stable');
eq(loadoutCoverage(partial, 'terminid', { prioritizeLarge: false }).rows.map(r => r.enemyId), partialCoverage.rows.map(r => r.enemyId), 'default guide order unchanged');
eq(loadoutView(partial, 'terminid', { prioritizeLarge: true, limit: 0 }).rows.map(r => r.enemyId), prioritized.rows.map(r => r.enemyId), 'view forwards priority option');
const emptyPrioritized = loadoutCoverage({}, 'illuminate', { prioritizeLarge: true });
ok(emptyPrioritized.rows[0].isLarge && !emptyPrioritized.rows[0].oneShot, 'large gaps are also prioritized');
eq(emptyPrioritized.rows.find(r => r.enemyId === 'gatekeeper').size, null, 'unmapped size retained in coverage');
ok(emptyPrioritized.rows.every(r => r.oneShot === false), 'empty loadout has no one-shot answers');
eq(loadoutCoverage({}, 'automaton').gaps.length, loadoutFactions.find(f => f.id === 'automaton').enemyIds.length, 'empty loadout gaps');
eq(loadoutCoverage({ primary: 'breaker' }, 'terminid', { assume: { hitCount: 1 } }).gaps.length, loadoutFactions.find(f => f.id === 'terminid').enemyIds.length, 'lower explicit hit assumption retains existing gap policy');
for (const loadout of [{ primary: 'eruptor' }, { throwable: 'frag' }]) {
  const row = loadoutCoverage(loadout, 'terminid').rows.find(row => row.enemyId === 'hunter-hardened');
  eq([row.status, row.best.fragmentsExcluded, row.best.assumption.count], ['route', false, row.best.mode.hitCondition.default], 'loadout uses configured default');
  eq(loadoutView(loadout, 'terminid', { limit: 0 }).rows.find(row => row.enemyId === 'hunter-hardened').best.weaponId, row.best.weaponId, 'loadout view uses same default');
  eq(loadoutCoverage(loadout, 'terminid', { assume: { hitCount: 1 } }).rows.find(row => row.enemyId === 'hunter-hardened').status, 'gap', 'positive fragment assumption cannot close gap');
}
const shotgunOnly = loadoutCoverage({ primary: 'breaker' }, 'terminid');
ok(shotgunOnly.rows.some(row => row.status === 'route' && row.best.allPelletsAssumed), 'shotgun alone covers enemies with full-hit default');
eq(loadoutView({ primary: 'breaker' }, 'terminid', { limit: 0 }).rows.find(row => row.enemyId === 'hunter-hardened').best.weaponId, 'breaker');
eq(loadoutCoverage({ primary: 'breaker', secondary: 'senator' }, 'terminid').rows.find(row => row.enemyId === 'hunter-hardened').best.weaponId, 'senator', 'equal hits prefer route without pellet assumption');
ok(suggestFixes({}, 'terminid', { limit: 20 }).some(gap => gap.replacements.some(candidate => candidate.allPelletsAssumed && candidate.verified)), 'full-pellet routes are available as replacements');
const nonSupport = stratagems.find(s => s.category !== 'support');
eq(loadoutCoverage({ stratagems: [nonSupport.id] }, 'terminid').notComputable[0].id, nonSupport.id);
eq(decodeLoadout(encodeLoadout({ stratagems: [nonSupport.id] })).stratagems[0], nonSupport.id, 'noncombat stratagems carried');
eq(loadoutCoverage({}, 'unknown').rows, []);
const fixes = suggestFixes({ primary: 'liberator' }, 'automaton', { limit: 2 });
ok(fixes.length > 0 && fixes.some(gap => gap.replacements.length), 'real gaps have replacements');
eq(suggestFixes({ primary: 'liberator' }, 'automaton', { limit: 2 }), fixes, 'deterministic suggestions');
for (const gap of fixes) {
  const counts = new Map();
  for (const replacement of gap.replacements) {
    const key = `${replacement.slot}:${replacement.slotIndex}`;
    counts.set(key, (counts.get(key) || 0) + 1);
    ok(replacement.verified && (!replacement.assumption || replacement.fragmentsExcluded && replacement.assumption.count === 0 || replacement.defaultAssumed && replacement.assumption.count === replacement.mode.hitCondition.default) && !replacement.lowerBound, 'only accepted default scenarios can be replacements');
    const next = { primary: 'liberator', stratagems: ['', '', '', ''] };
    if (replacement.slot === 'stratagems') next.stratagems[replacement.slotIndex] = replacement.weaponId;
    else { next[replacement.slot] = replacement.weaponId; eq(resolveAttack(replacement.weaponId).weapon.category, replacement.slot); }
    ok(loadoutCoverage(next, 'automaton').rows.find(row => row.enemyId === gap.enemyId).best, 'suggestion actually closes its gap');
  }
  ok([...counts.values()].every(count => count <= 2), 'per-position limit');
}
eq(suggestFixes({}, 'terminid', { limit: 0 }).every(gap => !gap.replacements.length), true);
eq(loadoutView({ p: fixed.primary, s: fixed.secondary, g: fixed.throwable, st: fixed.stratagems, f: fixed.faction }, fixed.faction).gaps, [], 'gear short-key adapter');

for (const path of ['db/weapons.js', 'dist/data/personal-weapons.js', 'dist/data/personal-profiles.js']) {
  const saved = await readFile(new URL(path, root), 'utf8');
  ok(saved.startsWith('// Generated by scripts/build-weapons.mjs'), 'generated header');
  ok(!saved.includes('\r'), `${path}: LF only`);
  for (let run = 0; run < 2; run++) {
    const rebuilt = execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build-weapons.mjs', root)), '--stdout', path], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    eq(rebuilt, saved, `${path}: stale or nondeterministic generated output`);
  }
}
const sizesOutput = await readFile(new URL('dist/data/enemy-sizes.js', root), 'utf8');
ok(sizesOutput.startsWith('// Generated by scripts/build-enemy-sizes.mjs'), 'size generated header');
ok(!sizesOutput.includes('\r'), 'size output LF only');
for (let run = 0; run < 2; run++) eq(execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build-enemy-sizes.mjs', root)), '--stdout'], { encoding: 'utf8' }), sizesOutput, 'size output is current and deterministic');
console.log(`PASS personal: ${checked} assertions; ${personalWeapons.length} weapons (${Object.keys(personalProfiles).length} supported / ${Object.keys(personalUnsupported).length} unsupported); comparison, loadout, suggestions and two byte-identical builds per output.`);
