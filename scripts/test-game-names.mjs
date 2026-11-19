// Names that follow the game's own Korean (db/source/game_name_targets.json): every
// listed stratagem, weapon, armor set, passive, enemy and structure shows exactly the
// game's name from db/source/game_names_ko.json (with the listed prefix or suffix).
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stratagems } from '../dist/core/catalog.js';
import { personalWeapons } from '../dist/data/personal-weapons.js';
import { armors, armorPassives } from '../dist/data/armor.js';
import { enemies } from '../dist/data/combat-data.js';
import { structures } from '../dist/data/demolition-data.js';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const targets = await read('game_name_targets.json');
const game = await read('game_names_ko.json');
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

const lists = {
  stratagems: [stratagems, item => item.id], weapons: [personalWeapons, item => item.code], armor: [armors, item => item.en],
  passives: [armorPassives, item => item.en], enemies: [enemies, item => item.id], structures: [structures, item => item.id],
};
for (const [group, entries] of Object.entries(targets).filter(([key]) => key !== 'note')) {
  const [list, keyOf] = lists[group];
  for (const [key, target] of Object.entries(entries)) {
    const item = list.find(entry => keyOf(entry) === key);
    ok(item, `${group}/${key}: not on the site`);
    const korean = game.strings.names[target.game];
    ok(korean, `${group}/${key}: no game Korean for "${target.game}" (run scripts/build-game-names.mjs)`);
    const expected = `${target.prefix ?? ''}${korean}${target.suffix ?? ''}`;
    ok(target.part ? korean.startsWith(item.name) && item.name.length > 1 : item.name === expected, `${group}/${key}: shows "${item.name}", the game says "${target.part ? korean : expected}"`);
  }
}
// game_names_ko.json is what build-game-names.mjs picks from the repository's string table.
const table = (await readFile(new URL('../db/source/game_strings_ko.tsv', import.meta.url), 'utf8')).split('\n');
ok(table[0] === `#build\t${game.build}`, 'game_names_ko.json and game_strings_ko.tsv come from the same game build (run build-game-names)');
const exact = new Map(), folded = new Map();
for (const line of table.filter(line => line && !line.startsWith('#'))) { const [en, ko] = line.split('\t'); exact.set(en, ko); if (!folded.has(en.toLowerCase())) folded.set(en.toLowerCase(), ko); }
for (const [group, strings] of Object.entries(game.strings)) for (const [en, ko] of Object.entries(strings)) ok((exact.get(en) ?? folded.get(en.toLowerCase())) === ko, `${group}: "${en}" no longer matches db/source/game_strings_ko.tsv (run build-game-names)`);
console.log(`PASS game names: ${checks} checks (${Object.values(targets).filter(value => typeof value === 'object').reduce((sum, group) => sum + Object.keys(group).length, 0)} names follow game build ${game.build}).`);
