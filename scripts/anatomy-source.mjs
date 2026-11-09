// Wiki Anatomy rows of the combat enemies, in one shape for every reader.
// db/source/wiki_anatomy.json holds the enemy pages (scripts/fetch-enemy-anatomy.mjs).
// Automaton defences that are also mission objectives (emplacements, the Bunker
// Turret, the parked Air Base dropship) were saved with their whole page text in
// db/source/wiki_structures.json (scripts/fetch-structure-pages.mjs); a page that
// is not in the anatomy snapshot is read from there with the same row parser.
import { readFile } from 'node:fs/promises';

// One Anatomy Row → its fields, keeping the raw wiki text of each value.
// Pages with several Anatomy Tables (tabs such as "Pilot") record the table
// index and its tab label on each row, so equal part names stay apart.
export function anatomyRows(wikitext) {
  const starts = [...wikitext.matchAll(/\{\{\s*Anatomy Table/g)].map(match => match.index);
  return starts.flatMap((start, table) => {
    const before = wikitext.slice(table ? starts[table - 1] : 0, start);
    const label = [...before.matchAll(/\|-\|\s*([^=\n]+?)\s*=/g)].at(-1)?.[1] ?? null;
    const body = wikitext.slice(start, starts[table + 1] ?? wikitext.length);
    return [...body.matchAll(/\{\{\s*Anatomy Row([\s\S]*?)\n\s*\}\}/g)].map(match => {
      const row = starts.length > 1 ? { table, tab: label } : {};
      for (const line of match[1].split('\n')) {
        const field = line.match(/^\s*\|\s*([a-z_]+)\s*=\s*(.*)$/i);
        if (field) row[field[1].toLowerCase()] = field[2].trim();
      }
      return row;
    });
  });
}

const read = async name => JSON.parse(await readFile(new URL(`../db/source/${name}`, import.meta.url), 'utf8'));

/** { retrievedAt, pages: { title: { source, revision, rows, snapshot? } } } */
export async function anatomySnapshot() {
  const [anatomy, structures] = await Promise.all([read('wiki_anatomy.json'), read('wiki_structures.json')]);
  const pages = { ...anatomy.pages };
  for (const [title, page] of Object.entries(structures.pages)) {
    if (pages[title] || !/\{\{\s*Anatomy Row/.test(page.text)) continue;
    pages[title] = { source: `https://helldivers.wiki.gg/wiki/${title.replaceAll(' ', '_')}`, revision: page.revision, rows: anatomyRows(page.text), snapshot: 'wiki_structures.json' };
  }
  return { retrievedAt: anatomy.retrievedAt, pages };
}
