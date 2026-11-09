// Downloads the weapon customization (attachment) sources into db/source/wiki_attachments.json.
// A weapon page's "== Attachments ==" table is {{Attachments Table|<weapon>}}, which runs
// Module:Weapon Attach. That module joins two things, and this script saves both:
//   costs  Module:Weapon Attach/data_weapons.json  per weapon: attachment -> unlock level + cost
//   rows   the wiki's Cargo table "Attachments"    per attachment (and per variant): slot, the
//          weapons it fits ("available on") and its stat changes; filled from the attachment pages
// The revision of every attachment page that fills the Cargo table is recorded too.
// Turning it into site data happens offline in scripts/build-attachments.mjs.
// Usage: node scripts/fetch-attachments.mjs
// wiki.gg rejects browser (Mozilla) User-Agents, so a plain tool UA is sent.
import { writeFile } from 'node:fs/promises';

const API = 'https://helldivers.wiki.gg/api.php';
const UA = 'HD2FieldGuide/2.0 (fan site data check; contact via github modocracy)';
const COSTS = 'Module:Weapon Attach/data weapons.json'; // the module reads data_weapons.json; MediaWiki titles use spaces
const CODE = ['Template:Attachments Table', 'Module:Weapon Attach', 'Template:Infobox Attachment', 'Template:AttachVariant/row'];
// The fields Module:Weapon Attach reads, plus where the row fits.
const FIELDS = ['_pageName', 'type', 'available_on', 'ergonomics', 'sway', 'optic_range',
  'horizontal_recoil', 'vertical_recoil', 'horizontal_spread', 'vertical_spread',
  'mag_capacity', 'max_magazines', 'start_magazines',
  'heatsink_overheat', 'heatsink_cooldown', 'heatsink_temp_per_shot',
  'full_reload_time', 'partial_reload_time', 'fire_rate', 'functionality'];
const wait = ms => new Promise(done => setTimeout(done, ms));
const pageUrl = title => `https://helldivers.wiki.gg/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replace(/%2F/g, '/').replace(/%3A/g, ':')}`;

const get = async params => {
  await wait(400);
  const res = await fetch(`${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(params).slice(0, 120)}`);
  const body = await res.json();
  if (body.error) throw new Error(`${body.error.code}: ${body.error.info}`);
  return body;
};
async function revisions(titles, content = false) {
  const out = {};
  for (let start = 0; start < titles.length; start += 50) {
    const r = await get({ action: 'query', prop: 'revisions', rvprop: content ? 'ids|timestamp|content' : 'ids|timestamp', ...(content ? { rvslots: 'main' } : {}), titles: titles.slice(start, start + 50).join('|') });
    for (const page of r.query.pages) {
      const rev = page.revisions?.[0];
      if (!rev) throw new Error(`No revision for ${page.title}`);
      out[page.title] = { source: pageUrl(page.title), revision: rev.revid, revisionTimestamp: rev.timestamp, ...(content ? { content: rev.slots.main.content } : {}) };
    }
  }
  const missing = titles.filter(title => !out[title]);
  if (missing.length) throw new Error(`Missing pages: ${missing.join(', ')}`);
  return Object.fromEntries(titles.map(title => [title, out[title]]));
}

const retrievedAt = new Date().toISOString().slice(0, 10);
const code = await revisions(CODE);
const { [COSTS]: costPage } = await revisions([COSTS], true);
const costs = JSON.parse(costPage.content);

// Same filter as Module:Weapon Attach (rows without a slot are never shown).
const rows = [];
for (let offset = 0; ; offset += 500) {
  const r = await get({ action: 'cargoquery', tables: 'Attachments', fields: FIELDS.join(','), where: 'type IS NOT NULL', order_by: '_pageName,_ID', limit: '500', offset: String(offset) });
  const batch = r.cargoquery.map(item => item.title);
  // Cargo returns field names with spaces; keep the wiki's underscore names.
  rows.push(...batch.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replaceAll(' ', '_'), value]))));
  if (batch.length < 500) break;
}
const pages = await revisions([...new Set(rows.map(row => row._pageName))].sort());

await writeFile(new URL('../db/source/wiki_attachments.json', import.meta.url), JSON.stringify({
  source: pageUrl('Attachments'),
  license: 'CC BY-NC-SA 4.0',
  retrievedAt,
  code,
  costs: { title: COSTS, source: costPage.source, revision: costPage.revision, revisionTimestamp: costPage.revisionTimestamp, data: costs },
  cargo: { table: 'Attachments', source: 'https://helldivers.wiki.gg/wiki/Special:CargoTables/Attachments', where: 'type IS NOT NULL', fields: FIELDS, rows },
  pages,
}, null, 1) + '\n');

console.log(`Wrote db/source/wiki_attachments.json: ${Object.keys(costs).length} weapons in ${COSTS} r${costPage.revision}, ${rows.length} Cargo rows from ${Object.keys(pages).length} attachment pages (retrieved ${retrievedAt}).`);
console.log(Object.entries(code).map(([title, page]) => `${title} r${page.revision}`).join(', '));
