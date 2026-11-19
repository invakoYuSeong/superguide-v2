// Boosters: every wiki booster is listed with the game's Korean, its icon is the
// checked original SVG, the detail lines only use numbers from the wiki page, and
// the warbond, page and medal cost agree with the warbond board.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { boosters, boostersGameBuild } from '../dist/data/boosters.js';
import { warbonds } from '../dist/data/warbonds.js';
import { validateSvg } from './svg-safety.mjs';
import { boosterFacts, gameText } from './booster-parse.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const wiki = await read('wiki_boosters.json');
const korean = (await read('booster_korean.json')).boosters;
const game = await read('game_names_ko.json');
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

ok(boosters.length === Object.keys(wiki.boosters).length, 'every wiki booster is listed (run build-boosters)');
ok(boostersGameBuild === game.build, 'boosters.js was built from the current game_names_ko.json');
const tiles = warbonds.flatMap(warbond => warbond.pages.flatMap((page, index) => page.items.filter(item => item.kind === 'booster').map(item => ({ ...item, warbondId: warbond.id, page: index + 1 }))));
for (const booster of boosters) {
  const page = wiki.boosters[booster.id], text = korean[booster.id];
  ok(page && page.revision === booster.revision, `${booster.id}: stale (run build-boosters)`);
  ok(booster.name === game.strings.boosters[text.name], `${booster.id}: name is not the game's Korean`);
  ok(text.description === null ? booster.description === null : booster.description === gameText(game.strings.boosters[text.description], text.value), `${booster.id}: description is not the game's Korean`);
  ok(!booster.description?.includes('#') && !/<[a-z]/i.test(booster.description || ''), `${booster.id}: game markup left in the description`);
  ok(Boolean(booster.description || booster.detail), `${booster.id}: nothing to say about it`);
  // Every number in the detail lines comes from the wiki page.
  const numbers = `${booster.detail || ''} ${booster.detailEn || ''}`.match(/\d+(?:\.\d+)?/g) || [];
  for (const number of numbers) ok(page.text.includes(number), `${booster.id}: ${number} in the detail line is not on the wiki page`);
  ok(Boolean(booster.detail) === Boolean(booster.detailEn), `${booster.id}: detail needs both Korean and English`);
  // Icon: the original SVG, unchanged and safe.
  const bytes = await readFile(new URL(`../dist/${booster.icon.src.slice(2)}`, import.meta.url));
  ok(createHash('sha256').update(bytes).digest('hex') === booster.icon.sha256, `${booster.id}: icon changed`);
  validateSvg(bytes, { name: booster.icon.src }); checks++;
  // Same warbond, page and cost as the warbond board tile (where the board has a cost), and the same Korean name.
  const facts = boosterFacts(page.text);
  const tile = tiles.find(item => item.name === booster.en);
  ok(tile, `${booster.id}: no tile on the warbond board`);
  ok(tile.warbondId === booster.warbondId && (tile.cost == null || tile.cost === booster.cost), `${booster.id}: warbond board says ${tile.warbondId} ${tile.cost}, wiki page ${booster.warbondId} ${booster.cost}`);
  ok(tile.page === booster.page, `${booster.id}: warbond board page ${tile.page}, booster page ${booster.page}`);
  ok(!tile.ko || tile.ko === booster.name, `${booster.id}: warbond tile is named ${tile.ko}, the game says ${booster.name}`);
  ok(facts.page === booster.page, `${booster.id}: page parse`);
}
console.log(`PASS boosters: ${checks} checks (${boosters.length} boosters, game build ${boostersGameBuild}).`);
