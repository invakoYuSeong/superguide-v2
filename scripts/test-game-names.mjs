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
    ok(korean, `${group}/${key}: no game Korean for "${target.game}" (run scripts/tools/export-game-names.mjs)`);
    const expected = `${target.prefix ?? ''}${korean}${target.suffix ?? ''}`;
    ok(target.part ? korean.startsWith(item.name) && item.name.length > 1 : item.name === expected, `${group}/${key}: shows "${item.name}", the game says "${target.part ? korean : expected}"`);
  }
}
console.log(`PASS game names: ${checks} checks (${Object.values(targets).filter(value => typeof value === 'object').reduce((sum, group) => sum + Object.keys(group).length, 0)} names follow game build ${game.build}).`);
