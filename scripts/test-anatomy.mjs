// Enemies re-checked against the Wiki Anatomy snapshot (db/source/wiki_anatomy.json):
// every wiki row is a part (matched by sourcePart), merged into a named part
// with the same numbers (anatomyMerged), or left out with a stated reason
// (anatomyOmitted), and every number of a modelled row matches the wiki.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enemies } from '../dist/data/combat-data.js';

const snapshot = JSON.parse(await readFile(new URL('../db/source/wiki_anatomy.json', import.meta.url), 'utf8'));
let checked = 0;
const ok = (test, message) => { assert(test, message); checked++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checked++; };

const clean = text => text.replace(/<!--[\s\S]*?-->/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
// Wiki numbers may list values per difficulty ("130 [Default]<br>160 at
// {{Difficulty|4}}"); the site uses the highest-difficulty value, the last one.
const number = text => Number(String(text).split(/<br\s*\/?>/i).at(-1).replace(/\s*at\s*\{\{.*$/, '').replace(/\[[^\]]*\]/g, '').replace(/[,%]/g, '').trim());
const titleOf = enemy => decodeURIComponent(enemy.source.split('/wiki/')[1]).replaceAll('_', ' ');
const partsOf = enemy => enemy.parts.flatMap(part => [part, ...(part.next ? [part.next] : [])]);
const isPoolRow = name => /(^|\s)Main$/.test(name);

// A part that shares the main pool is mainOnly, or (in legacy entries) a part
// with the full main health that passes at least all of it on, so both run
// out on the same hit.
const sharesMain = (part, main) => part.mainOnly === true || part.hp === main.hp && part.toMain >= 100;
const unknown = part => Boolean(part.unknownReason);

// anatomyOfficial: values the site takes from the official patch notes because
// the wiki table disagrees with them. Each entry names the wiki value it was
// reviewed against, so a later wiki edit fails here and is looked at again.
const usedOfficial = new Set();
function matches(part, row, label, main, enemy) {
  // A value the wiki gives as "-" is left uncalculated on the site.
  const value = (actual, text, message) => text === '-' ? ok(actual === null && unknown(part), `${message} left uncalculated`) : eq(actual, number(text), message);
  const official = enemy?.anatomyOfficial?.[`${part.id}.hp`];
  if (official) {
    usedOfficial.add(`${enemy.id}/${part.id}.hp`);
    eq(number(row.health), official.wiki, `${label}: wiki health is still the reviewed ${official.wiki} (site follows: ${official.source})`);
    ok(Number.isFinite(part.hp) && part.hp !== official.wiki && /^Patch [\d.]+ \(\d{4}-\d{2}-\d{2}\): /.test(official.source), `${label}: official health ${part.hp} with its patch-note source`);
  } else if (/^Main\b/.test(row.health)) ok(sharesMain(part, part.main || main), `${label}: health ${row.health} shares a main pool`);
  else if (/^Infinite/i.test(row.health)) ok(part.hp === null && unknown(part), `${label}: infinite health is left uncalculated`);
  else value(part.hp, row.health, `${label}: health`);
  value(part.armor, row.av, `${label}: armor`);
  value(part.durability, row.durability, `${label}: durability`);
  value(part.exdr, row.exdr, `${label}: explosive resistance`);
  // A main-pool row is the pool itself, so it has no transfer of its own.
  // "-" means a separate pool that passes nothing on (0%, a separate device,
  // or a transfer the site leaves unverified); some rows leave the cap empty.
  if (isPoolRow(clean(row.part_name))) ok(part.toMain >= 100, `${label}: hits the main pool directly`);
  else if (row.percent_to_main === '-') ok(part.toMain === 0 || part.partOnly === true || part.toMain === null && unknown(part), `${label}: separate pool passes nothing to main`);
  else {
    eq(part.toMain, number(row.percent_to_main), `${label}: % to main`);
    if (!['-', undefined].includes(row.dmg_cap_main)) eq(part.overflowCap, { Yes: true, No: false }[row.dmg_cap_main], `${label}: damage cap to main`);
    else ok(part.overflowCap !== undefined, `${label}: cap left unverified`);
  }
  // "(Downs)" marks the fatal flag, but some pages put it in the bleed cell:
  // "Yes (Downs)" is fatal, "No (Downs)" only knocks it down. When the bleed
  // cell holds that flag, the page gives no bleed amount.
  const downs = [row.fatal, row.bleed].find(cell => /Downs/.test(cell ?? ''));
  const both = /When.*both are.*destroyed/i.test(clean(row.fatal));
  const fatal = downs ? /^Yes/.test(downs) : /^Yes/.test(row.fatal);
  // "No (Downs)" on a flyer is the site's "down" (brought down, not a kill).
  const allowed = both ? (part.copies === 2 ? ['kill'] : ['break']) : fatal ? ['kill', 'bleed', 'down'] : ['break', 'armor', ...(downs ? ['down'] : [])];
  ok(allowed.includes(part.effect), `${label}: fatal ${row.fatal} vs ${part.effect}`);
  if (both) {
    ok(partsOf(enemy).some(other => other.sourcePart === part.sourcePart && other.effect === 'break' && !other.copies), `${label}: single copy breaks`);
    ok(partsOf(enemy).some(other => other.sourcePart === part.sourcePart && other.effect === 'kill' && other.copies === 2), `${label}: both copies kill`);
  }
  const bleedCell = /Downs/.test(row.bleed ?? '') ? null : row.bleed;
  const bleed = bleedCell?.match(/^([\d,]+) \[-?([\d.]+)\/s\]$/);
  if (bleedCell === null) return;
  if (['None', 'No', '-'].includes(bleedCell)) ok(!part.staticConstitution && !part.constitution, `${label}: no extra health`);
  else if (bleed && Number(bleed[2]) === 0) eq(part.staticConstitution, number(bleed[1]), `${label}: extra health that never decays`);
  else if (bleed) eq(part.constitution, number(bleed[1]), `${label}: bleed-out health`);
  else assert.fail(`${label}: unreadable bleed ${row.bleed}`);
}

const revised = enemies.filter(enemy => enemy.anatomyRevision);
ok(revised.length > 0, 'at least one re-checked enemy');
for (const enemy of revised) {
  const page = snapshot.pages[titleOf(enemy)];
  ok(page, `${enemy.id}: page in snapshot`);
  eq(page.revision, enemy.anatomyRevision, `${enemy.id}: snapshot revision is the one reviewed`);
  // Rows of an extra tab (e.g. "Pilot") are named "<tab>: <part>". An enemy
  // that is one tab of a shared page names its tab in anatomyTable.
  const home = enemy.anatomyTable ?? 0;
  const tables = enemy.anatomyTables ?? [...new Set(page.rows.map(row => row.table ?? 0))];
  const nameOf = row => (row.table ?? 0) === home ? clean(row.part_name) : `${row.tab}: ${clean(row.part_name)}`;
  const byName = new Map(page.rows.filter(row => tables.includes(row.table ?? 0)).map(row => [nameOf(row), row]));
  // The main pool is the "Main" row unless the page splits it (e.g. "Hull
  // Main"); a part with its own pool (a turret, a pilot) names it in sourceMain.
  const covered = new Set();
  const vitals = (main, name) => {
    ok(main && byName.has(name), `${enemy.id}: main pool ${name}`);
    const row = byName.get(name);
    eq([main.hp, main.armor, main.exdr], [number(row.health), number(row.av), number(row.exdr)], `${enemy.id}: ${name}`);
    covered.add(name);
  };
  vitals(enemy.main, enemy.anatomyMain ?? 'Main');
  const parts = partsOf(enemy);
  for (const part of parts.filter(part => part.sourceMain)) vitals(part.main, part.sourceMain);
  for (const part of parts.filter(part => part.sourcePart)) {
    const row = byName.get(part.sourcePart);
    ok(row, `${enemy.id}/${part.id}: wiki row ${part.sourcePart}`);
    matches(part, row, `${enemy.id}/${part.id}`, enemy.main, enemy);
    covered.add(part.sourcePart);
  }
  for (const [name, partId] of Object.entries(enemy.anatomyMerged || {})) {
    const part = parts.find(item => item.id === partId);
    ok(part && byName.has(name), `${enemy.id}: ${name} merged into ${partId}`);
    matches(part, byName.get(name), `${enemy.id}/${partId} (${name})`, enemy.main);
    covered.add(name);
  }
  for (const [name, reason] of Object.entries(enemy.anatomyOmitted || {})) {
    ok(byName.has(name) && !covered.has(name) && /^[ -~]{20,}$/.test(reason), `${enemy.id}: ${name} left out with an English reason`);
    covered.add(name);
  }
  const uncovered = [...byName.keys()].filter(name => !covered.has(name));
  eq(uncovered, [], `${enemy.id}: every wiki anatomy row is a part`);
}
for (const enemy of revised) for (const key of Object.keys(enemy.anatomyOfficial || {})) {
  ok(usedOfficial.has(`${enemy.id}/${key}`), `${enemy.id}: anatomyOfficial ${key} matches no part; remove it`);
}
console.log(`PASS anatomy: ${checked} checks; ${revised.length} enemies match Wiki Anatomy snapshot ${snapshot.retrievedAt}; ${usedOfficial.size} values follow the official patch notes.`);
