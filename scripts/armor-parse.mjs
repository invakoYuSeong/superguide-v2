// Offline parser for Helldivers Wiki armor pages (local wikitext only, no network).
// Body armor: {{Infobox Armor}} (type, armor, speed, stam_regen, passive, source, cost, image).
// Passives: {{Infobox Armor Passive}} (description lines split on <br>, order, icon).
import { findTemplates, templateParams, parseCurrency, plainText } from './warbond-parse.mjs';

export const UNCONFIRMED = '미확인';
export const WEIGHTS = ['light', 'medium', 'heavy'];

const pageName = (raw, title) => String(raw ?? '').replaceAll('{{PAGENAME}}', title).trim();
const integer = raw => /^\d+$/.test(String(raw ?? '').trim()) ? Number(String(raw).trim()) : null;
export const armorId = title => title.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** One infobox per page; anything else is a page the parser does not understand. */
function infobox(wikitext, nameRe, title) {
  const found = findTemplates(wikitext, nameRe);
  if (found.length !== 1) throw new Error(`${title}: expected one ${nameRe.source} template, found ${found.length}`);
  return templateParams(found[0].body).named;
}

/** Description markup → plain lines: emphasis spans, {{ColorHighlight|x}} and links unwrapped. */
export function effectLines(raw) {
  return String(raw ?? '')
    .replace(/\{\{\s*ColorHighlight\s*\|([^{}|]*)\}\}/gi, '$1')
    .split(/<br\s*\/?>/i)
    .map(line => plainText(line.replace(/<[^>]+>/g, '')))
    .filter(Boolean);
}

/** The numbers a line states, in order ('+2', '2.0s', '30%' → ['2', '2.0', '30']). */
export const numbersOf = text => String(text).match(/\d+(?:\.\d+)?/g) ?? [];

/**
 * Where an armor comes from. Warbond links keep the warbond page title and page number
 * ('#Page 3' anchor, else the {{Tooltip|P3|Page 3}} note); every other source is a fixed key.
 */
export function parseSource(raw) {
  const text = String(raw ?? '').trim();
  const link = text.match(/\[\[([^|\]#]*)(?:#([^|\]]*))?(?:\|([^\]]*))?\]\]/);
  const target = link?.[1]?.trim() ?? null;
  const anchorPage = link?.[2]?.match(/^Page (\d+)$/i)?.[1];
  const tooltipPage = text.match(/\{\{\s*Tooltip\s*\|\s*P(\d+)\s*\|/i)?.[1];
  const page = Number(anchorPage ?? tooltipPage) || null;
  if (target && /Warbond$/.test(target)) {
    if (anchorPage && tooltipPage && anchorPage !== tooltipPage) throw new Error(`Source page anchor and note disagree: ${text}`);
    return { kind: 'warbond', title: target, page, raw: text };
  }
  if (target === 'Campaigns') return { kind: 'campaign', key: plainText(link[3] || link[2] || target), raw: text };
  return { kind: 'other', key: plainText(target ?? text), raw: text };
}

/** '{{Currency|SC|250|notext}}' → {amount:250, unit:'SC'}; exclusive or missing → null amount. */
export function parseCost(raw) {
  const text = String(raw ?? '').trim();
  if (/\{\{\s*Tooltip\s*\|[^|}]*\|\s*Exclusive\s*\}\}/i.test(text)) return { amount: null, unit: null, exclusive: true };
  const usd = text.match(/^\{\{\s*Tooltip\s*\|[^|}]*\|\s*USD\s*\}\}\s*([\d.]+)$/i);
  if (usd) return { amount: Number(usd[1]), unit: 'USD' };
  const cost = parseCurrency(text);
  return cost.amount != null && (cost.unit === 'SC' || cost.unit === 'Medals') ? { amount: cost.amount, unit: cost.unit } : { amount: null, unit: null };
}

export function parseArmorPage(wikitext, title) {
  const named = infobox(wikitext, /Infobox[ _]Armor/, title);
  const type = String(named.type ?? '').trim().toLowerCase();
  return {
    title,
    weight: WEIGHTS.includes(type) ? type : null,
    armorRating: integer(named.armor),
    speed: integer(named.speed),
    staminaRegen: integer(named.stam_regen),
    passive: plainText(named.passive) || null,
    source: parseSource(named.source),
    cost: parseCost(named.cost),
    image: pageName(named.image, title) || null,
  };
}

export function parsePassivePage(wikitext, title) {
  const named = infobox(wikitext, /Infobox[ _]Armor[ _]Passive/, title);
  return {
    title,
    order: integer(named.order),
    icon: pageName(named.image, title) || null,
    effects: effectLines(named.description),
  };
}
