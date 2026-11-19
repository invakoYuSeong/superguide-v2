// Settles a warbond page's own disagreement (the Acquisitions Page template and the item table give
// different costs or pages) with the item's own wiki page: armor and helmets on the armor set page
// (cost / helmet_cost), capes and player cards on the cape-card page (cape_cost / card_cost),
// boosters on the booster page (cost and the page in source). The side that matches is kept; when
// neither does, the item stays 미확인. Used by build-warbonds.mjs and fetch-warbond-item-pages.mjs.
import { UNCONFIRMED } from './warbond-parse.mjs';

const field = (text, key) => new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n]*)`).exec(text)?.[1] ?? '';
const medals = raw => Number(/Currency\|Medals?\|(\d+)/i.exec(raw)?.[1]) || null;

// The wiki page that describes one tile, and which infobox field holds its cost.
export function itemPageOf(item) {
  const type = String(item.type || '');
  const name = item.link || item.name;
  if (/helmet/i.test(type)) return { title: name.replace(/ Helmet$/, ''), costField: 'helmet_cost' };
  if (/armor/i.test(type)) return { title: name.replace(/ Armor$/, ''), costField: 'cost' };
  if (/player card/i.test(type)) return { title: name.replace(/ Player Card$/, ''), costField: 'card_cost' };
  if (/cape/i.test(type)) return { title: name.replace(/ Cape$/, ''), costField: 'cape_cost' };
  if (/booster/i.test(type)) return { title: name, costField: 'cost' };
  return null;
}

export function itemPageFacts(item, text) {
  const where = itemPageOf(item);
  if (!where || !text) return null;
  const source = where.costField === 'helmet_cost' ? field(text, 'helmet_source') : where.costField === 'card_cost' || where.costField === 'cape_cost' || where.costField === 'cost' ? field(text, 'source') : '';
  return { cost: medals(field(text, where.costField)), page: Number(/Tooltip\|P(\d+)/.exec(source)?.[1]) || null };
}

// Tiles left 미확인 by a cost or page disagreement, as { page, item } pairs of a parsed warbond.
export const disputed = parsed => parsed.pages.flatMap(page => page.items
  .filter(item => item.costStatus === UNCONFIRMED && item.templateCost != null && item.tableCost != null)
  .map(item => ({ page, item })));

/** Resolves the parsed warbond in place; returns the discrepancy codes it settled ({ page, item, by }). */
export function resolveWithItemPages(parsed, itemPages) {
  const settled = [];
  for (const { page, item } of disputed(parsed)) {
    const where = itemPageOf(item);
    const own = where && itemPages[where.title];
    const facts = own && itemPageFacts(item, own.text);
    if (!facts?.cost) continue;
    const moved = item.pageStatus === UNCONFIRMED;
    let value = null;
    if (facts.cost === item.templateCost && (!moved || facts.page === page.number)) value = item.templateCost;
    else if (!moved && facts.cost === item.tableCost) value = item.tableCost;
    if (value == null) continue;
    item.cost = value; item.costStatus = 'confirmed';
    delete item.pageStatus; delete item.tablePage;
    item.costSource = { page: own.title, revision: own.revision, field: where.costField };
    settled.push({ page: page.number, name: item.name, value, by: own.title });
  }
  return settled;
}
