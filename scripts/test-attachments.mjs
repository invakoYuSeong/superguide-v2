// Weapon customization: the generated attachment data is current and matches the wiki
// snapshot, and the gear detail (also used by the warbond item pane) shows every
// attachment with its slot, unlock level, cost and stat changes. Expected values are read
// from the data, so a wiki refresh does not need test edits.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildAttachments, formatModule, SLOTS, PRIMARIES } from './build-attachments.mjs';
import { attachmentParts, weaponAttachments, attachmentDiscrepancies } from '../dist/data/weapon-attachments.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { weaponDetail, attachmentEffects } from '../dist/ui/views/gear.js';
import { escape } from '../dist/ui/dom.js';
import { num } from '../dist/core/explain.js';
import { setLang } from '../dist/core/i18n.js';

const root = new URL('../', import.meta.url);
let checks = 0;
const ok = (value, message) => { assert(value, message); checks++; };
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const snapshot = await read('db/source/wiki_attachments.json');
const weaponPages = await read('db/source/wiki_pages.json');

// --- Generated file -------------------------------------------------------------------
const built = buildAttachments(snapshot, weaponPages);
const onDisk = await readFile(new URL('dist/data/weapon-attachments.js', root), 'utf8');
ok(formatModule(built) === onDisk, 'dist/data/weapon-attachments.js is up to date (run node scripts/build-attachments.mjs)');
ok(!onDisk.includes('\r'), 'LF line endings');
ok(Buffer.byteLength(onDisk) < 80000, `attachment data stays small (${Buffer.byteLength(onDisk)} bytes)`);

// --- Data matches the wiki snapshot ---------------------------------------------------
const costs = snapshot.costs.data;
const cargoFor = title => snapshot.cargo.rows.filter(row => row.available_on.split(',').map(name => name.trim()).includes(title));
for (const [id, list] of Object.entries(weaponAttachments)) {
  const weapon = personalWeapons.find(w => w.id === id);
  ok(weapon?.category === 'primary', `${id}: a primary weapon`);
  const entry = costs[weapon.en.toUpperCase()] ?? {};
  const fixed = attachmentDiscrepancies.filter(item => item.weapon === weapon.en && /read as|priced in/.test(item.issue)).length;
  ok(list.length === cargoFor(weapon.en).length + fixed, `${weapon.en}: one row per wiki attachment row`);
  ok(new Set(list.map(item => attachmentParts[item.part].name)).size === list.length, `${weapon.en}: no attachment twice`);
  for (const item of list) {
    const part = attachmentParts[item.part];
    ok(Object.values(SLOTS).includes(part.slot), `${weapon.en} / ${part.name}: known slot`);
    const cost = entry[part.name.toUpperCase()];
    ok(item.level === (cost ? Number(cost.lvl) : null), `${weapon.en} / ${part.name}: unlock level from the cost data`);
    ok(cost?.cost === 'BUILT-IN' ? item.builtIn === true && item.cost === null : item.cost === (cost && /^[\d,]+$/.test(cost.cost) ? Number(cost.cost.replaceAll(',', '')) : null), `${weapon.en} / ${part.name}: cost from the cost data`);
    ok(snapshot.pages[part.name]?.revision === part.revision, `${weapon.en} / ${part.name}: page revision recorded`);
  }
  const slots = list.map(item => Object.values(SLOTS).indexOf(attachmentParts[item.part].slot));
  ok(slots.every((slot, i) => i === 0 || slot >= slots[i - 1]), `${weapon.en}: rows grouped by slot`);
}
for (const weapon of PRIMARIES) {
  const onPage = /\{\{\s*Attachments Table\s*\|/.test(weaponPages.pages[weapon.en]?.wikitext ?? '');
  ok(onPage === Boolean(weaponAttachments[weapon.id]), `${weapon.en}: data exactly when the wiki page has the attachments table`);
}

// --- Build guards ---------------------------------------------------------------------
const clone = value => JSON.parse(JSON.stringify(value));
const liberator = PRIMARIES.find(w => w.id === 'liberator');
const firstPart = attachmentParts[weaponAttachments.liberator[0].part].name;
const noCost = clone(snapshot);
noCost.costs.data[liberator.en.toUpperCase()][firstPart.toUpperCase()].cost = 'ENTER COST';
const unpriced = buildAttachments(noCost, weaponPages).weapons.liberator.find(item => attachmentParts[item.part].name === firstPart);
ok(unpriced.cost === null && unpriced.level != null, 'a cost the wiki has not entered stays unconfirmed (null), never 0');
ok(buildAttachments(noCost, weaponPages).discrepancies.some(item => item.weapon === liberator.en && item.attachment === firstPart), 'an unentered cost is recorded as a discrepancy');
const badValue = clone(snapshot);
badValue.cargo.rows.find(row => row.ergonomics).ergonomics = 'lots';
assert.throws(() => buildAttachments(badValue, weaponPages), /unexpected ergonomics/); checks++;
const noTable = clone(weaponPages);
noTable.pages[liberator.en].wikitext = noTable.pages[liberator.en].wikitext.replace(/\{\{\s*Attachments Table\s*\|[^}]*\}\}/, '');
assert.throws(() => buildAttachments(snapshot, noTable), /has no \{\{Attachments Table\}\}/); checks++;

// --- Rendering ------------------------------------------------------------------------
const SLOT_KO = { optics: '광학 장비', underbarrel: '총열 하부', muzzle: '총구', magazine: '탄창' };
for (const weapon of personalWeapons) {
  const content = String(weaponDetail(weapon));
  const list = weaponAttachments[weapon.id];
  if (!list) { ok(!content.includes('gear-attach'), `${weapon.en}: no customization section without data`); continue; }
  const section = content.slice(content.indexOf('gear-attach-block'));
  ok(section.includes('<h3>커스터마이징</h3>'), `${weapon.en}: customization heading`);
  for (const slot of new Set(list.map(item => attachmentParts[item.part].slot))) ok(section.includes(`>${SLOT_KO[slot]}</th>`), `${weapon.en}: slot ${slot} shown`);
  const rows = section.split('<tr>').slice(1).filter(row => row.includes('scope="row"'));
  ok(rows.length === list.length, `${weapon.en}: one table row per attachment`);
  list.forEach((item, i) => {
    const part = attachmentParts[item.part];
    const row = rows[i];
    ok(row.includes(part.none ? '장착 안 함' : escape(part.name)), `${weapon.en} / ${part.name}: name`);
    ok(row.includes(item.level != null ? `레벨 ${item.level}` : '미확인'), `${weapon.en} / ${part.name}: unlock level`);
    ok(row.includes(item.builtIn ? '기본 장착' : item.cost != null ? num(item.cost) : '미확인'), `${weapon.en} / ${part.name}: cost`);
    if (!part.effects) ok(row.includes('미확인'), `${weapon.en} / ${part.name}: unknown stat changes are unconfirmed`);
    else for (const effect of attachmentEffects(part.effects)) ok(row.includes(`${escape(effect.label)} <b>${escape(effect.text)}</b>`), `${weapon.en} / ${part.name}: ${effect.key} shown`);
  });
}
const secondary = personalWeapons.find(w => w.category === 'secondary');
ok(!String(weaponDetail(secondary)).includes('gear-attach'), 'secondaries have no customization section');
// Every effect key in the data has a label and text.
for (const part of Object.values(attachmentParts)) if (part.effects) ok(attachmentEffects(part.effects).length === Object.keys(part.effects).length, `${part.name}: every effect is rendered`);

setLang('en');
const english = String(weaponDetail(liberator));
ok(english.includes('<h3>Customization</h3>') && english.includes('>Optics</th>') && english.includes('Level ') && !/[가-힣]/.test(english.slice(english.indexOf('gear-attach-block'), english.indexOf('</section>', english.indexOf('gear-attach-block')))), 'English customization section has no Korean');
setLang('ko');

const total = Object.values(weaponAttachments).reduce((sum, list) => sum + list.length, 0);
console.log(`PASS attachments: ${checks} checks (${Object.keys(weaponAttachments).length} primaries, ${total} attachment rows, ${attachmentDiscrepancies.length} wiki discrepancy).`);
