// Enemy view extras from the wiki enemy pages: every enemy has its entry, fire multiplier and
// stagger threshold are the infobox values, the subfaction is a faction picks guide, and the
// Spawning/Behavior summaries are tied to the current wiki revision with an English line each.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { enemies } from '../dist/data/combat-data.js';
import { enemyPages } from '../dist/data/enemy-pages.js';
import { factionGuides } from '../dist/data/faction-data.js';
import { pageTitle, infoboxNumber } from './enemy-page-title.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const wiki = (await read('wiki_enemy_pages.json')).pages;
const summaries = await read('enemy_behavior_korean.json');
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };
const numberOf = infoboxNumber;
// Korean, ASCII and the middle dot only (no arrows, dashes, curly quotes or emoji).
const PLAIN = /^[\x20-\x7e가-힣·]*$/;
// English may spell small numbers out ("three-rocket salvo"); compare them as digits.
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const digits = text => text.replace(/\btrios?\b/gi, '3').replace(/\btwice\b/gi, '2').replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, word => String(WORDS.indexOf(word.toLowerCase())));
const numbers = text => new Set(text.match(/\d+(?:\.\d+)?/g) ?? []);
// A number written in digits on one side must be on the other side (English may spell it out,
// Korean may write it as a word like 한 or 세).
const sameNumbers = (ko, en) => [...numbers(ko)].every(n => numbers(digits(en)).has(n)) && [...numbers(en)].every(n => numbers(ko).has(n));

// Missing or out-of-date summaries never fail the check (user decision 2026-11-19): a new enemy or
// a re-fetched wiki page must not block a deploy. They are only counted in the PASS line.
const later = { noEntry: [], noSummary: [], olderSummary: [] };
for (const enemy of enemies) {
  const item = enemyPages[enemy.id];
  const page = wiki[pageTitle(enemy)];
  if (!item || !page || item.revision !== page.revision) { later.noEntry.push(enemy.id); continue; }
  ok(item.fireMult === numberOf(page.fireMult) && item.staggerReq === numberOf(page.staggerReq), `${enemy.id}: fire multiplier or stagger threshold is not the wiki infobox value`);
  ok(item.subfaction === null || factionGuides.some(guide => guide.id === item.subfaction), `${enemy.id}: unknown subfaction ${item.subfaction}`);
  const summary = summaries[item.page];
  if (!summary) { later.noSummary.push(enemy.id); continue; }
  if (summary.revision !== page.revision) later.olderSummary.push(enemy.id);
  for (const key of ['spawning', 'behavior']) {
    ok(item[key].length === item[`${key}En`].length && item[key].length === summary[key].length, `${enemy.id}: ${key} lines and English lines differ (run build-enemy-pages)`);
    item[key].forEach((line, i) => {
      const en = item[`${key}En`][i];
      ok(/[가-힣]/.test(line) && en.trim() && !/[가-힣]/.test(en), `${enemy.id}: ${key} line ${i + 1} is not Korean with English`);
      ok(PLAIN.test(line) && PLAIN.test(en), `${enemy.id}: ${key} line ${i + 1} has special characters`);
      ok(sameNumbers(line, en),`${enemy.id}: ${key} line ${i + 1} numbers differ between Korean and English: ${line} / ${en}`);
    });
  }
}
const waiting = Object.entries(later).filter(([, list]) => list.length).map(([key, list]) => `${key} ${list.length}`).join(', ');
console.log(`PASS enemy pages: ${checks} checks (${enemies.length} enemies, ${Object.keys(summaries).length} wiki pages summarized${waiting ? `; to update when convenient: ${waiting}` : ''}).`);
