// Copies the game data sheets made from the game's own data tables (hd2-modding repository,
// 소스/자료/게임시트, written by 도구/game_sheets.py on the PC that has the game) into
// db/source/game_sheets/, so this site can be checked and updated from game data instead of wiki pages.
// Files: armor.json (passives with their in-game effect text and values, armor kits with weight, passive,
// description), stratagems.json (input code, cooldown, activation delay, Eagle uses per rearm),
// weapons.json (rate of fire, magazines, default attachments, projectile -> damage -> explosion chain),
// enemies.json (main health and every damage zone: health, armor, durable ratio, share to main, constitution),
// system.json (galactic effects with names and descriptions, planet region names, Freedom Party policies).
// weapons.json also lists every attachment with its description and the values it changes.
// Field meanings and what is still unverified: db/source/game_sheets/README.md (copied from the same folder).
// Usage: node scripts/tools/import-game-sheets.mjs <path to 소스/자료/게임시트>
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const FILES = [
  ['방어구.json', 'armor.json'],
  ['스트라타젬.json', 'stratagems.json'],
  ['무기.json', 'weapons.json'],
  ['적.json', 'enemies.json'],
  ['시스템.json', 'system.json'],
  ['README.md', 'README.md'],
];
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/tools/import-game-sheets.mjs <path to 소스/자료/게임시트>');
const out = new URL('../../db/source/game_sheets/', import.meta.url);
await mkdir(out, { recursive: true });
const builds = new Set();
for (const [from, to] of FILES) {
  const text = (await readFile(join(input, from), 'utf8')).replace(/\r\n/g, '\n');
  if (to.endsWith('.json')) builds.add(JSON.parse(text).game_build);
  await writeFile(new URL(to, out), text);
}
if (builds.size !== 1) throw new Error(`Sheets come from different game builds: ${[...builds].join(', ')}`);
console.log(`Copied ${FILES.length} files from game build ${[...builds][0]} into db/source/game_sheets/`);
