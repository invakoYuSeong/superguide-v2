// The rewritten engines must reproduce every recorded result of the legacy
// engine: all enemy x weapon x mode x option combinations, every structure x
// attack, every faction pick and shield recovery case. Reason codes are
// checked against the legacy wording they replace.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { enemies, weaponProfiles } from '../dist/data/combat-data.js';
import { structures, demolitionProfiles } from '../dist/data/demolition-data.js';
import { factionGuides } from '../dist/data/faction-data.js';
import { solveMatchup, withHitAssumption } from '../dist/core/combat.js';
import { solveDemolition, structureOverview, weaponOverview } from '../dist/core/demolition.js';
import { recommend, findEnemy } from '../dist/core/factions.js';
import { shieldRecovery } from '../dist/core/defense.js';
import { stratagems } from '../dist/core/catalog.js';

const golden = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/legacy-golden.json.gz', import.meta.url))));

const legacyReason = {
  'cap-unknown': '본체 전달 상한의 적용 여부에 따라 결과가 달라져 계산을 보류합니다.',
  'assumption-needed': '한 발당 해당 부위의 명중 수를 선택하면 그 가정의 탄수를 계산합니다. 실제 명중 수는 자료 미확인입니다.',
  'data-missing': '자료 미확인: 이 부위에 적용되는 일부 피해·관통·반경을 확인하지 못해 최종 횟수는 계산 보류합니다. 확인된 피해는 계산 과정에 별도로 표시합니다.',
  'assumption-data-missing': '자료 미확인: 선택한 명중 조건에 필요한 피해 수치가 확인되지 않았습니다.',
  'no-damage': '이 부위와 본체에 계산상 피해가 들어가지 않습니다.',
  'no-damage-after-armor': '장갑은 제거했지만 노출 부위에 피해를 주지 못합니다.',
  'no-damage-assumed': '선택한 명중 조건에서는 이 부위와 본체에 피해가 들어가지 않습니다.',
  'leftover-events': '장갑 파괴 후 같은 발의 남은 전격·자탄이 노출 부위에 닿는지는 자료 미확인입니다. 최종 탄수는 계산 보류합니다.',
  'too-many-hits': '계산 범위를 초과했습니다.',
  'beam-data-missing': '자료 미확인: 광선의 피해·지속시간 또는 부위 수치가 확인되지 않아 계산을 보류합니다.',
  'beam-blocked': '광선이 해당 부위 장갑을 관통하지 못하거나 직접 닿지 않습니다.',
  'beam-armor-only': '장갑 파괴까지의 탄수입니다. 남은 광선이 노출된 살점에 이어서 닿는 조건은 자료 미확인이므로 최종 처치 탄수는 계산 보류합니다.',
};
const reasonText = row => row.reason === 'unsupported' ? row.detail || '정밀 피해 자료를 아직 확인하지 않았습니다.'
  : ['shield', 'part-unknown'].includes(row.reason) ? row.detail : row.reason ? legacyReason[row.reason] : null;

const view = row => ({
  t: row.target.id, h: row.hits, o: row.outcome, v: row.via ?? null, lb: Boolean(row.lowerBound), c: Boolean(row.conditional),
  r: reasonText(row), n: row.notes.length ? row.notes.join(' ') : null,
  s: row.stages.map(stage => [stage.part.name, stage.hits, stage.damage.direct, stage.damage.explosion, stage.damage.mainExplosion, stage.contactSeconds ?? null]),
});

// --- Combat ------------------------------------------------------------------
// These modes gained hit-count controls after the frozen legacy snapshot.
// Preserve zero extra fragments for numeric legacy comparisons. In this actual
// snapshot AC flak was entirely unsupported (there are no legacy flak numbers),
// so preserve that explicit historical status. New flak arithmetic, including
// count=0, is independently source-checked in test-personal.mjs.
const addedHitConditions = new Set(['autocannon:flak']);
const legacyUnsupported = {
  'autocannon:flak': '근접 신관과 파편의 명중 수에 따라 피해가 크게 달라져 고정 탄수를 계산하지 않습니다.',
};
assert(!golden.combat.some(row => row.weapon === 'wasp'), 'W.A.S.P. had no legacy combat profile');
// Deliberate data updates from a later anatomy check keep each replaced
// value in anatomyLegacy ('main.armor', 'head.armor', 'leg.next.hp'). Legacy
// results are replayed on those values, so the engine is still checked
// exactly; test-anatomy.mjs checks the new values against the wiki.
function legacyEnemy(enemy) {
  if (!enemy.anatomyLegacy) return enemy;
  const copy = structuredClone(enemy);
  for (const [path, value] of Object.entries(enemy.anatomyLegacy)) {
    const [first, ...rest] = path.split('.');
    let target = first === 'main' ? copy.main : copy.parts.find(part => part.id === first);
    while (rest.length > 1) target = target[rest.shift()];
    // null means the field did not exist in the legacy data.
    assert(target && Object.hasOwn(target, rest[0]), `${enemy.id}: legacy path ${path}`);
    if (value === null) delete target[rest[0]];
    else target[rest[0]] = value;
  }
  legacyReplayed.add(enemy.id);
  return copy;
}
const legacyReplayed = new Set();
let checked = 0, beamCarried = 0, addedRows = 0;
for (const expected of golden.combat) {
  const enemy = legacyEnemy(enemies.find(item => item.id === expected.enemy));
  const currentMode = weaponProfiles[expected.weapon].modes.find(item => item.id === expected.mode);
  const key = `${expected.weapon}:${expected.mode}`;
  if (legacyUnsupported[key]) assert(expected.rows.every(row => row.h === null && row.o === 'unknown' && row.r === legacyUnsupported[key]), 'historical unsupported adapter must not bypass any numeric golden result');
  const mode = legacyUnsupported[key] ? { ...currentMode, unsupported: legacyUnsupported[key] } : currentMode;
  const options = addedHitConditions.has(key) ? { ...expected.options, hitCount: 0 } : expected.options;
  const { rows, best } = solveMatchup(enemy, withHitAssumption(mode, options), options);
  const label = `${expected.enemy} × ${expected.weapon}/${expected.mode} ${JSON.stringify(expected.options)}`;
  const pairIds = { 'hive-guard': 'claw-both', 'brood-commander': 'claw-both', 'alpha-commander': 'claw-both', 'vox-engine': 'cannon-both' };
  const pairRows = rows.filter(row => row.target.id === pairIds[enemy.id]);
  const actual = rows.filter(row => !pairRows.includes(row)).map(view);
  const legacyBestCurrent = rows.filter(row => !pairRows.includes(row) && !row.conditional && ['kill', 'bleed', 'down'].includes(row.outcome)).sort((a, b) => a.hits - b.hits || Number(a.outcome !== 'kill') - Number(b.outcome !== 'kill'))[0] || null;
  if (best !== legacyBestCurrent) assert(pairRows.includes(best), `${label}: only a new pair route can change best`);
  // Deliberate change: the legacy engine stopped a beam at a broken armor
  // layer. A beam held on the spot now carries on into the exposed layer, so
  // those rows keep the legacy armor stage exactly and only extend past it.
  const carried = new Set();
  expected.rows.forEach((row, i) => {
    if (row.r !== legacyReason['beam-armor-only']) return assert.deepEqual(actual[i], row, `${label}: ${row.t}`);
    carried.add(row.t); beamCarried++;
    assert.deepEqual([actual[i].t, actual[i].c, actual[i].s[0]], [row.t, row.c, row.s[0]], `${label}: ${row.t} armor stage unchanged`);
    assert(actual[i].s.length === 2 && actual[i].h >= row.h && actual[i].r !== row.r, `${label}: ${row.t} beam reaches the exposed layer`);
  });
  // Deliberate change: enemies re-checked against a newer Wiki Anatomy
  // revision (anatomyRevision) gain parts after the legacy ones. Legacy rows
  // stay exact above; a new part may only become the best route if faster.
  const added = new Set(actual.slice(expected.rows.length).map(row => row.t));
  assert(actual.length === expected.rows.length || enemy.anatomyRevision && added.size, `${label}: part rows`);
  if (added.size) addedRows += added.size;
  const legacyBest = expected.rows.find(row => row.t === expected.best);
  const improved = id => (carried.has(id) || added.has(id)) && (!legacyBest || legacyBestCurrent.hits <= legacyBest.h);
  assert((legacyBestCurrent?.target.id ?? null) === expected.best || improved(legacyBestCurrent?.target.id), `${label}: best route`);
  checked++;
}
assert.equal(checked, golden.combat.length);
assert(checked > 20000, 'combat coverage shrank');
assert(beamCarried > 0, 'beam carry-over adapter is exercised');

// --- Demolition ----------------------------------------------------------------
const conditionText = (condition, profile) => ({
  opening: () => `${condition.route.name}에 폭발을 넣어야 합니다.`,
  aim: () => profile.note || '실제 명중·기폭 조건을 확인하세요.',
  shield: () => '워프 함선의 보호막을 먼저 제거해야 합니다. 아래 탄수에는 보호막이 포함되지 않습니다.',
  jammer: () => '교란기를 비활성화한 뒤 호출해야 합니다. 활성 상태에서는 이 공격을 호출할 수 없습니다.',
})[condition.kind]();
const demolitionReason = {
  'no-data': () => '이 장비·공격의 철거 수치와 시설 피해를 아직 확인하지 않았습니다. 파괴 불가능이라는 뜻은 아닙니다.',
  'force-blast': () => '폭발 중심부가 이 부위에 닿으면 철거력 조건을 충족합니다.',
  'force-direct': () => '탄체·광선·타격이 이 부위에 직접 닿으면 철거력 조건을 충족합니다.',
  'force-opening': () => '폭발이 입구 안쪽에 들어가야 합니다. 바깥 표면에 맞히는 것과는 다릅니다.',
  'health': mode => `같은 시설 본체에 최대 피해를 주어 체력을 소진하는 ${mode.unit === '개' ? '폭약 개수' : '탄수'}입니다.`,
  'force-unknown': () => '철거 수치가 미확인이거나 출처가 엇갈려 파괴 여부를 확정하지 않습니다.',
  'health-unknown': () => '철거력은 부족하지만 체력 파괴 경로가 있습니다. 이 공격의 시설 피해·탄수는 아직 확인하지 않았습니다.',
  'blocked-armor': () => '철거력이 부족하고 본체 장갑을 뚫는 피해도 없습니다.',
  'blocked-force': () => '확인된 철거력 조건에 미달합니다. 여러 발의 철거력을 합산해 파괴할 수는 없습니다.',
};
const legacyVerdict = { pass: 'pass', short: 'insufficient', unknown: 'unknown', 'n/a': 'inapplicable' };
for (const expected of golden.demolition) {
  const structure = structures.find(item => item.id === expected.structure);
  const profile = demolitionProfiles[expected.weapon];
  const mode = profile.modes.find(item => item.id === expected.mode);
  const result = solveDemolition(structure, profile, mode, expected.options);
  assert.deepEqual({
    outcome: result.outcome, method: result.method, route: result.route?.id ?? null, component: result.via, hits: result.hits,
    reason: demolitionReason[result.reason](mode), conditions: result.conditions.map(item => conditionText(item, profile)), health: result.health,
    routes: result.routes.map(row => [row.route.id, legacyVerdict[row.verdict], row.via, row.parts.map(part => legacyVerdict[part.verdict])]),
  }, {
    outcome: expected.outcome, method: expected.method, route: expected.route, component: expected.component, hits: expected.hits,
    reason: expected.reason, conditions: expected.conditions, health: expected.health, routes: expected.routes,
  }, `${expected.structure} × ${expected.weapon}/${expected.mode} ${JSON.stringify(expected.options)}`);
}

// Stratagems added after the legacy fixture was made. The legacy overviews list
// the catalogue as it was then, so these are left out when replaying them.
const addedAfterLegacy = new Set(['apex', 'nova', 'maelstrom', 'incinerator-frv']);
const legacyCatalogue = stratagems.filter(item => !addedAfterLegacy.has(item.id));
assert.equal(legacyCatalogue.length, 110, 'legacy catalogue size');
// Structures added after the legacy fixture (2026-11-09) are left out of the
// "every structure" overviews the same way; test-structures.mjs checks them.
const legacyStructureIds = new Set(golden.demolition.map(row => row.structure));
const legacyStructures = structures.filter(item => legacyStructureIds.has(item.id));
assert.equal(legacyStructures.length, 18, 'legacy structure list size');
for (const expected of golden.selections) {
  const options = { shieldCleared: expected.shieldCleared, jammerDisabled: false };
  const structure = structures.find(item => item.id === expected.structure);
  const label = `${expected.structure} × ${expected.weapon}/${expected.mode}`;
  if (expected.view === 'empty') {
    assert(!structure && expected.weapon === 'all' || !stratagems.some(item => item.id === expected.weapon) && expected.weapon !== 'all', label);
  } else if (expected.view === 'weapons') {
    // The new catalogue lists stratagems in plain category order, so compare as sets.
    const overview = structureOverview(structure, legacyCatalogue, demolitionProfiles, options);
    const byId = (a, b) => a[0].localeCompare(b[0]);
    assert.deepEqual(overview.entries.map(entry => [entry.weapon.id, entry.outcome, entry.attacks.map(attack => attack.mode.id)]).sort(byId), [...expected.entries].sort(byId), label);
    assert.deepEqual([overview.possible, overview.conditional, overview.unknown, overview.blocked], expected.counts, label);
  } else {
    const profile = demolitionProfiles[expected.weapon];
    const mode = profile?.modes.find(item => item.id === expected.mode);
    const targets = expected.structure === 'all' ? legacyStructures : [structure];
    assert.deepEqual(weaponOverview(targets, profile, mode, options).map(row => [row.structure.id, row.outcome]), expected.rows, label);
  }
}

// --- Factions ------------------------------------------------------------------
// Picks the legacy engine recorded must still match, in the same order. Guides added after
// the recording (Caustic and Noxious Strains) are not in it; their picks must still resolve.
const recorded = new Set(golden.factions.map(item => `${item.guide}/${item.enemy}/${item.choice}`));
let picks = 0, addedPicks = 0;
for (const guide of factionGuides) for (const unit of guide.units) for (const choice of unit.weapons) {
  if (!recorded.has(`${guide.id}/${unit.enemy}/${choice}`)) {
    const pick = recommend(unit, choice, findEnemy(unit.enemy));
    assert(pick.adviceOnly || pick.route, `${guide.id}/${unit.enemy}/${choice}: a pick added after the recording resolves to a route or advice`);
    addedPicks++;
    continue;
  }
  const expected = golden.factions[picks++];
  assert.deepEqual([expected.guide, expected.enemy, expected.choice], [guide.id, unit.enemy, choice]);
  const pick = recommend(unit, choice, legacyEnemy(findEnemy(unit.enemy)));
  assert.deepEqual({
    adviceOnly: Boolean(pick.adviceOnly), mode: pick.mode?.id ?? null, row: pick.route ? view(pick.route) : null,
    alternatives: (pick.alternatives || []).map(view), reference: pick.reference ? [pick.reference.weapon, pick.reference.mode, pick.reference.hits] : null,
    approach: Boolean(pick.approach), tactic: Boolean(pick.tactic),
  }, {
    adviceOnly: expected.adviceOnly, mode: expected.mode, row: expected.row, alternatives: expected.alternatives,
    reference: expected.reference, approach: expected.approach, tactic: expected.tactic,
  }, `${unit.enemy}/${choice}`);
}
assert.equal(picks, golden.factions.length);

// --- Defense -------------------------------------------------------------------
for (const expected of golden.defense) {
  const item = stratagems.find(entry => entry.id === expected.id);
  const cap = item.defense.shield?.capacity;
  assert.deepEqual([0, cap / 2, cap, -1, undefined].map(value => shieldRecovery(item.defense, value)), expected.recovery, expected.id);
}

console.log(`PASS parity: ${golden.combat.length} matchups (${beamCarried} beam routes now carry past armor, ${addedRows} rows for re-checked anatomy, ${legacyReplayed.size} enemies replayed on legacy values), ${golden.demolition.length} demolition cases, ${golden.selections.length} overviews, ${picks} faction picks match ${golden.generatedFrom} (+${addedPicks} added since).`);
