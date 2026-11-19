// Missions per demolition structure: every listed mission page names the structure,
// the names are the game's Korean, and the generated file matches its sources.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { structureObjectives } from '../dist/data/structure-objectives.js';
import { structures } from '../dist/data/demolition-data.js';
import { english } from '../dist/i18n/en.js';

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));
const map = (await read('structure_objectives.json')).structures;
const wiki = await read('wiki_objectives.json');
const game = await read('game_names_ko.json');
let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };

ok(JSON.stringify(Object.keys(structureObjectives)) === JSON.stringify(Object.keys(map)), 'structure-objectives.js is stale (run build-structure-objectives)');
for (const [id, entries] of Object.entries(map)) {
  const structure = structures.find(item => item.id === id);
  ok(structure, `${id}: not a demolition structure`);
  entries.forEach((entry, index) => {
    const page = wiki.pages[entry.page];
    ok(page, `${id}: ${entry.page} not downloaded (run fetch-objectives)`);
    const keyword = entry.keyword ?? english[structure.name];
    ok(page.text.includes(keyword), `${id}: the wiki page ${entry.page} does not mention ${keyword}`);
    ok(['main', 'tactical'].includes(entry.kind) && wiki.cargo[entry.kind][entry.page], `${id}: ${entry.page} is not a ${entry.kind} objective in the wiki Cargo tables`);
    const built = structureObjectives[id][index];
    const row = wiki.cargo[entry.kind][entry.page];
    ok(built.name === game.strings.objectives[entry.game] && built.kind === entry.kind && built.min === row.min && built.max === row.max && built.revision === page.revision, `${id}: ${entry.page} is stale (run build-structure-objectives)`);
  });
}
console.log(`PASS structure objectives: ${checks} checks (${Object.keys(map).length} structures, ${Object.values(map).flat().length} missions, game build ${game.build}).`);
