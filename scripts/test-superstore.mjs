// Superstore (Store tab, #/superstore): the wiki's store pages as 3x2 boards with Super Credit
// prices; weapons and armor point at the site's own entries, cosmetics carry the game's Korean.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { superstorePages, superstoreTotal, superstoreSource } from '../dist/data/superstore.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { armors } from '../dist/data/armor.js';
import { warbonds } from '../dist/data/warbonds.js';
import { warbondItemImages, warbondItemImagesMissing } from '../dist/data/warbond-item-images.js';
import { parseRoute, TAB_OF } from '../dist/core/route.js';
import { parseSuperstore, superstoreGameKeys, SUPERSTORE_BOARD } from './superstore-parse.mjs';
import { layoutProblems } from './warbond-parse.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const wiki = await read('wiki_superstore.json');
const gameNames = (await read('game_names_ko.json')).strings.superstoreItems;
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

const parsed = parseSuperstore(wiki.text);
ok(superstoreSource.revision === wiki.revision && superstorePages.length === parsed.pages.length, 'superstore.js is stale (run build-superstore)');
ok(superstoreTotal.sum === superstorePages.reduce((sum, page) => sum + page.total, 0), 'page totals add up to the grand total');
// The wiki keeps its Total Cost table by hand ("might be outdated"), so a different total only informs
// (user decision 2026-11-19: wiki changes must not block a deploy).
const notes = [];
if (superstoreTotal.sum !== superstoreTotal.listed) notes.push(`prices add up to ${superstoreTotal.sum}, the wiki's Total Cost table says ${superstoreTotal.listed ?? 'nothing'}`);
// The collapsed table of page 17 says I-44 Salamander Helmet 75 (total 700); the board says 125, and so
// do the armor's own page (I-44 Salamander rev 139519, helmet_cost 125) and the wiki's grand total.
// The board price is used; a table total that disagrees is only noted, and the typo may get fixed.
const REVIEWED = { 17: { total: 750, table: 700 } };
for (const page of superstorePages) {
  const reviewed = REVIEWED[page.number];
  if (page.tableTotal != null && !(reviewed && page.total === reviewed.total && page.tableTotal === reviewed.table)) notes.push(`page ${page.number}: board total ${page.total}, table ${page.tableTotal}`);
  ok(!layoutProblems(page.items, SUPERSTORE_BOARD).length, `page ${page.number}: tiles do not fill the 3x2 board`);
  ok(page.warHorses ? page.warbondId === null : warbonds.some(warbond => warbond.id === page.warbondId), `page ${page.number}: unknown warbond ${page.warbondId}`);
  for (const item of page.items) {
    ok(Number.isInteger(item.cost) && item.cost > 0, `${item.name}: no price`);
    if (item.kind === 'weapon') ok(personalWeapons.some(weapon => weapon.id === item.ref?.id), `${item.name}: not linked to a weapon`);
    else if (item.kind === 'armor' || item.kind === 'helmet') ok(armors.some(armor => armor.id === item.ref?.id && armor.en === item.set), `${item.name}: not linked to its armor set`);
    // A cosmetic without the game's Korean yet (the game table is refreshed on one PC) keeps its English
    // name, and a tile without a fetched image shows its name only: both only inform, so a new store
    // page never blocks a deploy (user decision 2026-11-19). A Korean name must still be the game's.
    else if (!item.ko) notes.push(`${item.name}: no game Korean name yet (run build-game-names after the game table update)`);
    else ok(parsed.pages.flatMap(p => p.items).filter(p => p.name === item.name).flatMap(superstoreGameKeys).some(key => gameNames[key] === item.ko), `${item.name}: Korean name is not the game's`);
    if (!item.image || !(warbondItemImages[item.image] || warbondItemImagesMissing.includes(item.image))) notes.push(`${item.name}: image ${item.image} not fetched (run fetch-warbond-item-images.py)`);
  }
}
ok(parseRoute('#/superstore').view === 'superstore' && TAB_OF.superstore === 'warbonds', 'the Superstore opens under the Store tab');
console.log(`PASS superstore: ${checks} checks (${superstorePages.length} pages, ${superstorePages.reduce((sum, page) => sum + page.items.length, 0)} items, ${superstoreTotal.sum} SC${notes.length ? `; to look at: ${notes.join('; ')}` : ''}).`);
