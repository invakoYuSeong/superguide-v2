// Reads the "Module Upgrades" table of the wiki Ship Modules page (kept in
// db/source/wiki_stratagem_stats.json by fetch-stratagem-stats.mjs) and matches each effect to
// the game's own English text. Shared by fetch-ship-module-icons.mjs, build-game-names.mjs,
// build-ship-module-upgrades.mjs and test-ship-module-upgrades.mjs.

const plain = text => String(text ?? '')
  .replace(/<span[^>]*><\/span>/g, '')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/'''?/g, '')
  .trim();
const cost = (cell, kind) => {
  const m = new RegExp(`\\{\\{Currency\\|${kind}\\|([\\d,]+)`, 'i').exec(cell);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};

/** { sections: [{ en, icon, modules: [{ en, tier, cost, effect }] }], total } from the page text. */
export function parseShipModules(text) {
  const table = /==\s*Module Upgrades\s*==[\s\S]*?\{\|([\s\S]*?)\n\|\}/.exec(text)?.[1];
  if (!table) throw new Error('Ship Modules: no Module Upgrades table');
  const rows = table.split(/\n\|-\s*\n/).slice(1).map(row => row.split('\n').filter(line => line.startsWith('|')).map(line => line.slice(1).trim()));
  const sections = [];
  let total = null;
  for (let cells of rows) {
    if (/'''Total'''/.test(cells[0])) {
      total = { common: cost(cells[1], 'Common'), rare: cost(cells[2], 'Rare'), super: cost(cells[3], 'Super'), requisition: cost(cells[4], 'Requisition') };
      continue;
    }
    if (/rowspan/.test(cells[0])) {
      const en = /'''\[\[([^\]|]+)/.exec(cells[0])?.[1];
      const icon = /\[\[File:([^|\]]+)/.exec(cells[0])?.[1].trim();
      if (!en || !icon) throw new Error(`Ship Modules: section cell not understood: ${cells[0]}`);
      sections.push({ en, icon, modules: [] });
      cells = cells.slice(1);
    }
    const section = sections.at(-1);
    if (!section || cells.length !== 6) throw new Error(`Ship Modules: row not understood: ${cells.join(' || ')}`);
    section.modules.push({
      en: plain(cells[0]), tier: section.modules.length + 1,
      cost: { common: cost(cells[1], 'Common'), rare: cost(cells[2], 'Rare'), super: cost(cells[3], 'Super'), requisition: cost(cells[4], 'Requisition') },
      effect: plain(cells[5]),
    });
  }
  if (!total) throw new Error('Ship Modules: no Total row');
  return { sections, total };
}

const fold = text => String(text).replace(/<\/?[ci](?:=[^>]*)?>/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
/**
 * The game's English string for a wiki effect: the same words once the game's #VALUE takes the
 * wiki's number, ignoring tags, case and punctuation. Returns { key, value } or null.
 */
export function gameEffect(effect, gameEnglish) {
  const target = fold(effect);
  const numbers = [...new Set(String(effect).match(/\d+(?:\.\d+)?/g) || [])];
  for (const key of gameEnglish) {
    if (!key.includes('#VALUE')) { if (fold(key) === target) return { key, value: null }; continue; }
    for (const value of numbers) if (fold(key.replaceAll('#VALUE', value)) === target) return { key, value };
  }
  return null;
}
