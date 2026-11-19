// Parses the wiki Superstore page (db/source/wiki_superstore.json, scripts/fetch-superstore.mjs):
// its "Stock" tabber holds one tab per store page, each with a title image linking the warbond
// the page is themed on, an {{Acquisitions Page|mode = super-store}} 3x2 board and a collapsed
// Item/Cost table ending in TOTAL. Shared by build-superstore and build-game-names.
import { findTemplates, templateParams, plainText, layoutProblems } from './warbond-parse.mjs';

export const SUPERSTORE_BOARD = { cols: 3, rows: 2 };
const KINDS = { armor: 'armor', helmet: 'helmet', cape: 'cape', playercard: 'player-card', emote: 'emote' };

/** Item kind and set/base name from the wiki item name ("CE-67 Titan (Helmet)", "Arctic Decree Cape"). */
export function itemKind(name) {
  const match = /^(.*?)\s*\((Armor|Helmet|Cape|Player ?Card|Emote)\)$/i.exec(name) ?? /^(.*?)\s+(Armor|Helmet|Cape|Player Card)$/i.exec(name);
  if (!match) return { kind: 'weapon', base: name };
  return { kind: KINDS[match[2].toLowerCase().replace(/\s/g, '')], base: match[1].trim() };
}

/** English strings the game table may hold for a cape, player card or emote. */
export const superstoreGameKeys = item => [...new Set([item.base, item.name.replace(/\s*\((Cape|Player ?Card|Emote)\)$/i, '')])];

export function parseSuperstore(wikitext) {
  const stock = wikitext.slice(wikitext.indexOf('== Stock =='), wikitext.indexOf('</tabber>'));
  const tabs = stock.split(/\n\|-\|/).slice(1);
  const pages = tabs.map((tab, index) => {
    const number = Number(/^Page (\d+)\s*=/.exec(tab)?.[1]);
    const titleFile = /\[\[File:([^|\]]+?Superstore[^|\]]*?Title\.png)([^\]]*)\]\]/.exec(tab);
    const link = /\|\s*link=([^|\]]+)/.exec(titleFile?.[2] ?? '')?.[1].trim() ?? null;
    const [template] = findTemplates(tab, /Acquisitions Page/);
    const params = template ? templateParams(template.body).named : {};
    const items = [];
    for (let n = 1; params[`${n}_name`] != null; n++) {
      const name = plainText(params[`${n}_name`]);
      const cost = params[`${n}_cost`];
      items.push({
        name, ...itemKind(name),
        link: (params[`${n}_link`] || '').trim() || null,
        image: (params[`${n}_image`] || '').trim() || null,
        col: Number(params[`${n}_col`]), row: Number(params[`${n}_row`]),
        colspan: Number(params[`${n}_colspan`] || 1), rowspan: Number(params[`${n}_rowspan`] || 1),
        cost: /^\d[\d,]*$/.test(cost || '') ? Number(cost.replaceAll(',', '')) : null,
      });
    }
    const tableTotal = /\|\s*TOTAL\s*\n\|\s*\{\{\s*Currency\s*\|\s*SC\s*\|\s*([\d,]+)/i.exec(tab)?.[1];
    return {
      number: number || index + 1, titleImage: titleFile?.[1].trim() ?? null,
      warbondPage: link, warHorses: /War Horses/.test(titleFile?.[1] ?? ''),
      items, tableTotal: tableTotal ? Number(tableTotal.replaceAll(',', '')) : null,
      layout: layoutProblems(items, SUPERSTORE_BOARD),
    };
  });
  const total = /\|\s*TOTAL\s*\n\|\s*'*\{\{\s*Currency\s*\|\s*SC\s*\|\s*([\d,]+)/i.exec(wikitext.slice(wikitext.indexOf('=== Total Cost ===')))?.[1];
  return { pages, listedTotal: total ? Number(total.replaceAll(',', '')) : null };
}
